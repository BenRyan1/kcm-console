/**
 * kcm-midi-recorder.js
 * Keys, Codes & Modes™ — MIDI Recording Layer
 * Phase 2: Records note events from any KCM panel and exports .mid files
 *
 * Usage:
 *   <script src="kcm-midi-recorder.js"></script>
 *   KCMRecorder.init();
 *
 * Then fire note events from any panel:
 *   KCMRecorder.noteOn(noteNumber, velocity);   // e.g. noteOn(60, 100) = Middle C
 *   KCMRecorder.noteOff(noteNumber);
 *
 * The floating transport bar appears automatically over your panel.
 */

(function(global) {
  'use strict';

  // ── MIDI Note map for KCM chromatic notes ──
  const NOTE_TO_MIDI = {
    'C':0,'C#':1,'Db':1,'D':2,'D#':3,'Eb':3,
    'E':4,'F':5,'F#':6,'Gb':6,'G':7,'G#':8,
    'Ab':8,'A':9,'A#':10,'Bb':10,'B':11
  };

  // Convert KCM note name + octave → MIDI number (middle C = 60 = C4)
  function noteNameToMidi(name, octave) {
    const base = NOTE_TO_MIDI[name];
    if (base === undefined) return null;
    return base + ((octave + 1) * 12);
  }

  // ── STATE ──
  let isRecording  = false;
  let isPaused     = false;
  let startTime    = null;
  let pauseOffset  = 0;
  let pauseStart   = null;
  let events       = [];      // {type, note, velocity, time}
  let takes        = [];      // completed takes
  let timerInterval = null;
  let mediaRecorder = null;
  let audioChunks   = [];
  let audioStream   = null;
  let audioCtx      = null;
  let transport     = null;

  // ── TIMING ──
  function now() {
    if (!startTime) return 0;
    const raw = performance.now() - startTime - pauseOffset;
    return Math.max(0, raw);
  }

  // ── PUBLIC API ──

  /** Fire when a note is pressed on any KCM panel */
  function noteOn(midiNote, velocity) {
    velocity = velocity || 100;
    if (!isRecording || isPaused) return;
    events.push({ type: 0x90, note: midiNote, velocity, time: now() });
    flashEvent(midiNote, 'on');
  }

  /** Fire when a note is released */
  function noteOff(midiNote) {
    if (!isRecording || isPaused) return;
    events.push({ type: 0x80, note: midiNote, velocity: 0, time: now() });
    flashEvent(midiNote, 'off');
  }

  /** Convenience: fire from KCM note name e.g. noteOnByName('D', 4, 100) */
  function noteOnByName(name, octave, velocity) {
    const midi = noteNameToMidi(name, octave || 4);
    if (midi !== null) noteOn(midi, velocity);
  }
  function noteOffByName(name, octave) {
    const midi = noteNameToMidi(name, octave || 4);
    if (midi !== null) noteOff(midi);
  }

  // ── MIDI FILE BUILDER ──
  function varLen(value) {
    const bytes = [];
    bytes.push(value & 0x7F);
    value >>= 7;
    while (value > 0) {
      bytes.push((value & 0x7F) | 0x80);
      value >>= 7;
    }
    return bytes.reverse();
  }

  function int32(value) {
    return [(value >> 24) & 0xFF, (value >> 16) & 0xFF, (value >> 8) & 0xFF, value & 0xFF];
  }
  function int16(value) {
    return [(value >> 8) & 0xFF, value & 0xFF];
  }

  function buildMidiFile(evts, bpm) {
    bpm = bpm || 120;
    const ticksPerBeat = 480;
    const usPerBeat    = Math.round(60000000 / bpm);

    // Sort by time
    evts = evts.slice().sort((a, b) => a.time - b.time);

    // Build track data
    const trackData = [];

    // Tempo meta event (delta=0)
    trackData.push(...varLen(0));
    trackData.push(0xFF, 0x51, 0x03);
    trackData.push((usPerBeat >> 16) & 0xFF, (usPerBeat >> 8) & 0xFF, usPerBeat & 0xFF);

    // Note events
    let prevTick = 0;
    evts.forEach(evt => {
      const tick  = Math.round((evt.time / 1000) * (ticksPerBeat * bpm / 60));
      const delta = Math.max(0, tick - prevTick);
      prevTick = tick;
      trackData.push(...varLen(delta));
      trackData.push(evt.type, evt.note & 0x7F, evt.velocity & 0x7F);
    });

    // End of track
    trackData.push(...varLen(0));
    trackData.push(0xFF, 0x2F, 0x00);

    // Header chunk
    const header = [
      0x4D, 0x54, 0x68, 0x64,   // MThd
      ...int32(6),               // chunk length
      ...int16(0),               // format 0
      ...int16(1),               // 1 track
      ...int16(ticksPerBeat),
    ];

    // Track chunk
    const track = [
      0x4D, 0x54, 0x72, 0x6B,   // MTrk
      ...int32(trackData.length),
      ...trackData,
    ];

    return new Uint8Array([...header, ...track]);
  }

  // ── AUDIO CAPTURE ──
  async function startAudio() {
    try {
      audioStream = await navigator.mediaDevices.getUserMedia({ audio: true });
      audioCtx    = new (window.AudioContext || window.webkitAudioContext)();
      mediaRecorder = new MediaRecorder(audioStream);
      audioChunks   = [];
      mediaRecorder.ondataavailable = e => { if (e.data.size > 0) audioChunks.push(e.data); };
      mediaRecorder.start(100);
      return true;
    } catch(e) {
      console.warn('KCMRecorder: Audio capture unavailable —', e.message);
      return false;
    }
  }

  function stopAudio() {
    return new Promise(resolve => {
      if (!mediaRecorder || mediaRecorder.state === 'inactive') { resolve(null); return; }
      mediaRecorder.onstop = () => {
        const blob = new Blob(audioChunks, { type: 'audio/webm;codecs=opus' });
        if (audioStream) audioStream.getTracks().forEach(t => t.stop());
        resolve(blob);
      };
      mediaRecorder.stop();
    });
  }

  // ── TRANSPORT UI ──
  function createTransport() {
    if (document.getElementById('kcm-recorder-bar')) return;

    const bar = document.createElement('div');
    bar.id = 'kcm-recorder-bar';
    bar.innerHTML = `
      <style>
        #kcm-recorder-bar {
          position: fixed;
          bottom: 24px;
          left: 50%;
          transform: translateX(-50%);
          z-index: 99999;
          background: rgba(10,10,21,0.97);
          border: 1px solid rgba(0,192,192,0.35);
          border-radius: 40px;
          padding: 10px 20px;
          display: flex;
          align-items: center;
          gap: 14px;
          box-shadow: 0 8px 40px rgba(0,0,0,0.6);
          font-family: 'Cinzel', 'Georgia', serif;
          user-select: none;
          min-width: 340px;
        }
        #kcm-recorder-bar .kr-dot {
          width: 10px; height: 10px;
          border-radius: 50%;
          background: #555;
          flex-shrink: 0;
          transition: all 0.3s;
        }
        #kcm-recorder-bar .kr-dot.rec {
          background: #FF3B3B;
          box-shadow: 0 0 10px rgba(255,59,59,0.6);
          animation: kr-blink 1.2s ease-in-out infinite;
        }
        @keyframes kr-blink { 0%,100%{opacity:1} 50%{opacity:0.2} }
        #kcm-recorder-bar .kr-time {
          font-family: 'Courier New', monospace;
          font-size: 13px;
          color: #F4D03F;
          min-width: 64px;
          letter-spacing: 0.1em;
        }
        #kcm-recorder-bar .kr-count {
          font-size: 10px;
          color: rgba(0,192,192,0.7);
          min-width: 60px;
          letter-spacing: 0.08em;
        }
        #kcm-recorder-bar button {
          border: 1px solid rgba(0,192,192,0.3);
          background: transparent;
          color: #b0b0cc;
          border-radius: 20px;
          padding: 5px 14px;
          font-family: 'Cinzel', 'Georgia', serif;
          font-size: 11px;
          letter-spacing: 0.1em;
          cursor: pointer;
          transition: all 0.2s;
        }
        #kcm-recorder-bar button:hover { color: #fff; border-color: rgba(0,192,192,0.7); }
        #kcm-recorder-bar button.kr-rec-btn {
          border-color: rgba(255,59,59,0.5);
          color: #FF8080;
        }
        #kcm-recorder-bar button.kr-rec-btn:hover { border-color: #FF3B3B; color: #fff; }
        #kcm-recorder-bar button.kr-rec-btn.active {
          border-color: #FF3B3B;
          color: #fff;
          background: rgba(255,59,59,0.15);
        }
        #kcm-recorder-bar .kr-sep {
          width: 1px; height: 20px;
          background: rgba(0,192,192,0.2);
          flex-shrink: 0;
        }
        #kcm-recorder-bar .kr-export {
          border-color: rgba(244,208,63,0.4);
          color: #F4D03F;
        }
        #kcm-recorder-bar .kr-export:hover { border-color: #F4D03F; color: #fff; }
        #kcm-recorder-bar .kr-midi-export {
          border-color: rgba(139,107,163,0.4);
          color: #8B6BA3;
        }
        #kcm-recorder-bar .kr-midi-export:hover { border-color: #8B6BA3; color: #fff; }
      </style>
      <div class="kr-dot" id="kr-dot"></div>
      <span class="kr-time" id="kr-time">00:00.0</span>
      <div class="kr-sep"></div>
      <button class="kr-rec-btn" id="kr-rec" onclick="KCMRecorder._toggleRecord()">⏺ Record</button>
      <button id="kr-stop" onclick="KCMRecorder._stop()" style="opacity:0.35;pointer-events:none;">■ Stop</button>
      <div class="kr-sep"></div>
      <span class="kr-count" id="kr-count">0 notes</span>
      <div class="kr-sep"></div>
      <button class="kr-export" id="kr-wav" onclick="KCMRecorder._exportWav()" style="opacity:0.35;pointer-events:none;">⬇ WAV</button>
      <button class="kr-midi-export" id="kr-midi" onclick="KCMRecorder._exportMidi()" style="opacity:0.35;pointer-events:none;">⬇ MIDI</button>
    `;
    document.body.appendChild(bar);
    transport = bar;
  }

  function setBtn(id, enabled) {
    const el = document.getElementById(id);
    if (!el) return;
    el.style.opacity = enabled ? '1' : '0.35';
    el.style.pointerEvents = enabled ? 'auto' : 'none';
  }

  function flashEvent(note, type) {
    const dot = document.getElementById('kr-dot');
    if (!dot) return;
    dot.style.background = type === 'on' ? '#00c0c0' : '#008080';
    setTimeout(() => {
      if (isRecording) dot.style.background = '#FF3B3B';
    }, 80);
    const count = document.getElementById('kr-count');
    if (count) {
      const n = events.filter(e => e.type === 0x90).length;
      count.textContent = n + ' note' + (n !== 1 ? 's' : '');
    }
  }

  function formatTime(ms) {
    const total  = Math.floor(ms / 100);
    const tenths = total % 10;
    const secs   = Math.floor(total / 10) % 60;
    const mins   = Math.floor(total / 600);
    return `${String(mins).padStart(2,'0')}:${String(secs).padStart(2,'0')}.${tenths}`;
  }

  // ── TRANSPORT ACTIONS ──
  async function _toggleRecord() {
    if (!isRecording) {
      await _startRecord();
    } else if (!isPaused) {
      _pause();
    } else {
      _resume();
    }
  }

  async function _startRecord() {
    events     = [];
    startTime  = performance.now();
    pauseOffset = 0;
    isRecording = true;
    isPaused    = false;

    await startAudio();

    timerInterval = setInterval(() => {
      const el = document.getElementById('kr-time');
      if (el) el.textContent = formatTime(now());
    }, 100);

    const dot = document.getElementById('kr-dot');
    const btn = document.getElementById('kr-rec');
    if (dot) dot.className = 'kr-dot rec';
    if (btn) { btn.textContent = '⏸ Pause'; btn.classList.add('active'); }
    setBtn('kr-stop', true);
    setBtn('kr-wav', false);
    setBtn('kr-midi', false);
    document.getElementById('kr-count').textContent = '0 notes';
  }

  function _pause() {
    isPaused   = true;
    pauseStart = performance.now();
    if (mediaRecorder && mediaRecorder.state === 'recording') mediaRecorder.pause();
    clearInterval(timerInterval);
    const btn = document.getElementById('kr-rec');
    const dot = document.getElementById('kr-dot');
    if (btn) btn.textContent = '⏺ Resume';
    if (dot) { dot.className = 'kr-dot'; dot.style.background = '#F4D03F'; }
  }

  function _resume() {
    if (pauseStart) pauseOffset += performance.now() - pauseStart;
    isPaused   = false;
    pauseStart = null;
    if (mediaRecorder && mediaRecorder.state === 'paused') mediaRecorder.resume();
    timerInterval = setInterval(() => {
      const el = document.getElementById('kr-time');
      if (el) el.textContent = formatTime(now());
    }, 100);
    const btn = document.getElementById('kr-rec');
    const dot = document.getElementById('kr-dot');
    if (btn) btn.textContent = '⏸ Pause';
    if (dot) dot.className = 'kr-dot rec';
  }

  async function _stop() {
    if (!isRecording) return;
    clearInterval(timerInterval);
    const duration = now();
    isRecording = false;
    isPaused    = false;

    const audioBlob = await stopAudio();

    takes.push({ events: events.slice(), duration, audioBlob, name: `KCM-Take-${takes.length + 1}` });

    const dot = document.getElementById('kr-dot');
    const btn = document.getElementById('kr-rec');
    if (dot) { dot.className = 'kr-dot'; dot.style.background = '#00c0c0'; }
    if (btn) { btn.textContent = '⏺ Record'; btn.classList.remove('active'); }
    setBtn('kr-stop', false);
    setBtn('kr-wav', !!audioBlob);
    setBtn('kr-midi', events.length > 0);

    const n = events.filter(e => e.type === 0x90).length;
    document.getElementById('kr-count').textContent = n + ' notes captured';
  }

  function _exportMidi(bpm) {
    if (!takes.length) return;
    const take = takes[takes.length - 1];
    if (!take.events.length) { alert('No notes recorded in this take.'); return; }
    bpm = bpm || 120;
    const bytes = buildMidiFile(take.events, bpm);
    const blob  = new Blob([bytes], { type: 'audio/midi' });
    const url   = URL.createObjectURL(blob);
    const a     = document.createElement('a');
    a.href      = url;
    a.download  = take.name + '.mid';
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 5000);
  }

  function _exportWav() {
    if (!takes.length) return;
    const take = takes[takes.length - 1];
    if (!take.audioBlob) { alert('No audio captured for this take.'); return; }
    const url  = URL.createObjectURL(take.audioBlob);
    const a    = document.createElement('a');
    a.href     = url;
    a.download = take.name + '.webm';
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 5000);
  }

  // ── INIT ──
  function init(options) {
    options = options || {};
    createTransport();
    console.log('%cKCM Recorder ready. Call KCMRecorder.noteOn(midiNote, velocity) from any panel.', 'color:#00c0c0;font-weight:bold;');
  }

  // ── EXPOSE ──
  global.KCMRecorder = {
    init,
    noteOn,
    noteOff,
    noteOnByName,
    noteOffByName,
    noteNameToMidi,
    getTakes: () => takes,
    getEvents: () => events,
    // internal (called by transport buttons)
    _toggleRecord,
    _stop,
    _exportMidi,
    _exportWav,
  };

})(window);
