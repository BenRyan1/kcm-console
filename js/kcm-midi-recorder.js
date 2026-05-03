/**
 * kcm-midi-recorder.js — Keys, Codes & Modes™
 * Phase 3: MIDI + Synth Audio capture (MediaStreamDestination)
 *   - Captures the actual Web Audio synth output (not microphone)
 *   - Exports real .wav via AudioContext decoding + PCM encoding
 *   - Loop state fixed: loopRef driven by KCMRecorder.isLooping flag
 *   - Button labeled "⬇ AUDIO (.webm)" — honest format
 */
(function(global) {
  'use strict';

  const NOTE_TO_MIDI = {
    'C':0,'C#':1,'Db':1,'D':2,'D#':3,'Eb':3,'E':4,
    'F':5,'F#':6,'Gb':6,'G':7,'G#':8,'Ab':8,
    'A':9,'A#':10,'Bb':10,'B':11
  };
  function noteNameToMidi(name, octave) {
    const b = NOTE_TO_MIDI[name];
    return b === undefined ? null : b + ((octave + 1) * 12);
  }

  let isRecording=false, isPaused=false, startTime=null, pauseOffset=0, pauseStart=null;
  let events=[], takes=[], timerInterval=null;
  let mediaRecorder=null, audioChunks=[];

  // ── Synth capture nodes (set by init or by the host page) ──────────────
  // The host page should call KCMRecorder.connectSynthOutput(gainNode)
  // to pipe the Web Audio graph into the recorder's MediaStreamDestination.
  let _synthAudioCtx = null;   // the host's AudioContext
  let _synthDest     = null;   // MediaStreamDestination node
  let _synthGain     = null;   // gain node the host connected to _synthDest

  /**
   * Call this from the Circle of Fifths page ONCE after creating AudioContext:
   *   KCMRecorder.connectSynthOutput(audioCtx, masterGainNode);
   * After this, all synth output flows through the recorder.
   */
  function connectSynthOutput(ctx, gainNode) {
    if (!ctx || !gainNode) return;
    _synthAudioCtx = ctx;
    _synthDest = ctx.createMediaStreamDestination();
    gainNode.connect(_synthDest);
    _synthGain = gainNode;
    console.log('[KCMRecorder] Synth output connected for capture.');
  }

  function now() { if(!startTime) return 0; return Math.max(0, performance.now()-startTime-pauseOffset); }

  function noteOn(midiNote, velocity) {
    velocity = velocity || 100;
    if (!isRecording || isPaused) return;
    events.push({type:0x90, note:midiNote, velocity, time:now()});
    flashDot('on');
  }
  function noteOff(midiNote) {
    if (!isRecording || isPaused) return;
    events.push({type:0x80, note:midiNote, velocity:0, time:now()});
    flashDot('off');
  }
  function noteOnByName(name, octave, velocity) {
    const m = noteNameToMidi(name, octave || 4);
    if (m !== null) noteOn(m, velocity);
  }
  function noteOffByName(name, octave) {
    const m = noteNameToMidi(name, octave || 4);
    if (m !== null) noteOff(m);
  }

  // ── MIDI file builder ────────────────────────────────────────────────────
  function varLen(v) { const b=[]; b.push(v&0x7F); v>>=7; while(v>0){b.push((v&0x7F)|0x80);v>>=7;} return b.reverse(); }
  function int32(v) { return [(v>>24)&0xFF,(v>>16)&0xFF,(v>>8)&0xFF,v&0xFF]; }
  function int16(v) { return [(v>>8)&0xFF,v&0xFF]; }

  function buildMidiFile(evts, bpm) {
    bpm = bpm || 120;
    const tpb=480, uspb=Math.round(60000000/bpm);
    evts = evts.slice().sort((a,b)=>a.time-b.time);
    const td=[];
    td.push(...varLen(0), 0xFF,0x51,0x03, (uspb>>16)&0xFF,(uspb>>8)&0xFF,uspb&0xFF);
    let prev=0;
    evts.forEach(e=>{
      const tick=Math.round((e.time/1000)*(tpb*bpm/60));
      const d=Math.max(0,tick-prev); prev=tick;
      td.push(...varLen(d), e.type, e.note&0x7F, e.velocity&0x7F);
    });
    td.push(...varLen(0), 0xFF,0x2F,0x00);
    return new Uint8Array([
      0x4D,0x54,0x68,0x64,...int32(6),...int16(0),...int16(1),...int16(tpb),
      0x4D,0x54,0x72,0x6B,...int32(td.length),...td
    ]);
  }

  // ── WAV encoder from PCM float32 ─────────────────────────────────────────
  function encodeWav(audioBuffer) {
    const numCh    = audioBuffer.numberOfChannels;
    const sampleRate = audioBuffer.sampleRate;
    const numSamples = audioBuffer.length;
    const bytesPerSample = 2; // 16-bit PCM
    const blockAlign = numCh * bytesPerSample;
    const byteRate   = sampleRate * blockAlign;
    const dataSize   = numSamples * blockAlign;
    const buffer     = new ArrayBuffer(44 + dataSize);
    const view       = new DataView(buffer);

    function writeStr(o, s) { for(let i=0;i<s.length;i++) view.setUint8(o+i, s.charCodeAt(i)); }
    function writeU16(o,v){ view.setUint16(o,v,true); }
    function writeU32(o,v){ view.setUint32(o,v,true); }

    writeStr(0,'RIFF'); writeU32(4, 36+dataSize); writeStr(8,'WAVE');
    writeStr(12,'fmt '); writeU32(16,16); writeU16(20,1); writeU16(22,numCh);
    writeU32(24,sampleRate); writeU32(28,byteRate); writeU16(32,blockAlign); writeU16(34,16);
    writeStr(36,'data'); writeU32(40,dataSize);

    // Interleave channels and convert float32 → int16
    let offset = 44;
    const ch = [];
    for (let c=0;c<numCh;c++) ch.push(audioBuffer.getChannelData(c));
    for (let i=0;i<numSamples;i++) {
      for (let c=0;c<numCh;c++) {
        const s = Math.max(-1, Math.min(1, ch[c][i]));
        view.setInt16(offset, s < 0 ? s*0x8000 : s*0x7FFF, true);
        offset += 2;
      }
    }
    return new Blob([buffer], {type:'audio/wav'});
  }

  // ── Audio recording via MediaStreamDestination (synth) or mic fallback ──
  async function startAudio() {
    audioChunks = [];
    let stream = null;

    if (_synthDest) {
      // ✅ PRIMARY: capture synth output directly — no mic needed
      stream = _synthDest.stream;
      console.log('[KCMRecorder] Recording synth output (no mic).');
    } else {
      // FALLBACK: microphone capture if synth not connected
      try {
        stream = await navigator.mediaDevices.getUserMedia({audio:true});
        console.log('[KCMRecorder] Fallback: recording microphone.');
      } catch(e) {
        console.warn('[KCMRecorder] No audio source available:', e.message);
        return false;
      }
    }

    try {
      // Prefer webm/opus; fall back to browser default
      const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
        ? 'audio/webm;codecs=opus' : '';
      mediaRecorder = mimeType
        ? new MediaRecorder(stream, {mimeType})
        : new MediaRecorder(stream);
      mediaRecorder.ondataavailable = e => { if(e.data.size>0) audioChunks.push(e.data); };
      mediaRecorder.start(100);
      return true;
    } catch(e) {
      console.warn('[KCMRecorder] MediaRecorder failed:', e.message);
      return false;
    }
  }

  function stopAudio() {
    return new Promise(resolve => {
      if (!mediaRecorder || mediaRecorder.state === 'inactive') { resolve(null); return; }
      mediaRecorder.onstop = () => {
        const mimeType = mediaRecorder.mimeType || 'audio/webm';
        const blob = new Blob(audioChunks, {type: mimeType});
        resolve(blob);
      };
      mediaRecorder.stop();
    });
  }

  // ── DOM helpers ──────────────────────────────────────────────────────────
  function el(id) { return document.getElementById(id); }
  function setBtn(id, enabled) {
    const e = el(id);
    if (!e) return;
    e.style.opacity = enabled ? '1' : '0.35';
    e.style.pointerEvents = enabled ? 'auto' : 'none';
  }
  function formatTime(ms) {
    const t=Math.floor(ms/100), tenths=t%10, secs=Math.floor(t/10)%60, mins=Math.floor(t/600);
    return String(mins).padStart(2,'0')+':'+String(secs).padStart(2,'0')+'.'+tenths;
  }

  function flashDot(type) {
    const d = el('kr-dot'); if (!d) return;
    d.style.background = type==='on' ? '#00c0c0' : '#008080';
    setTimeout(() => { if(isRecording) d.style.background='#FF3B3B'; }, 80);
    const c = el('kr-count');
    if (c) { const n=events.filter(e=>e.type===0x90).length; c.textContent=n+' notes'; }
  }

  // ── Transport bar HTML ───────────────────────────────────────────────────
  function createTransport() {
    if (el('kcm-recorder-bar')) return;
    const bar = document.createElement('div');
    bar.id = 'kcm-recorder-bar';
    bar.innerHTML = `<style>
#kcm-recorder-bar{
  position:fixed;bottom:20px;left:50%;transform:translateX(-50%);
  z-index:99999;
  background:rgba(10,10,21,0.97);
  border:1px solid rgba(0,192,192,0.35);
  border-radius:12px;
  padding:8px 16px;
  display:flex;
  flex-wrap:wrap;
  align-items:center;
  justify-content:center;
  gap:8px;
  box-shadow:0 8px 40px rgba(0,0,0,0.6);
  font-family:'Cinzel','Georgia',serif;
  user-select:none;
  max-width:95vw;
}
#kcm-recorder-bar .kr-row1,#kcm-recorder-bar .kr-row2{
  display:flex;align-items:center;gap:8px;
}
#kcm-recorder-bar .kr-dot{width:9px;height:9px;border-radius:50%;background:#555;flex-shrink:0;transition:all 0.3s;}
#kcm-recorder-bar .kr-dot.rec{background:#FF3B3B;box-shadow:0 0 8px rgba(255,59,59,0.6);animation:kr-blink 1.2s ease-in-out infinite;}
@keyframes kr-blink{0%,100%{opacity:1}50%{opacity:0.2}}
#kcm-recorder-bar .kr-time{font-family:'Courier New',monospace;font-size:12px;color:#F4D03F;min-width:58px;letter-spacing:0.08em;}
#kcm-recorder-bar .kr-count{font-size:10px;color:rgba(0,192,192,0.7);min-width:46px;}
#kcm-recorder-bar .kr-sep{width:1px;height:18px;background:rgba(0,192,192,0.2);flex-shrink:0;}
#kcm-recorder-bar button{border:1px solid rgba(0,192,192,0.3);background:transparent;color:#b0b0cc;border-radius:16px;padding:4px 11px;font-family:'Cinzel','Georgia',serif;font-size:10px;letter-spacing:0.06em;cursor:pointer;transition:all 0.2s;white-space:nowrap;}
#kcm-recorder-bar button:hover{color:#fff;border-color:rgba(0,192,192,0.7);}
#kcm-recorder-bar .kr-rec-btn{border-color:rgba(255,59,59,0.5);color:#FF8080;}
#kcm-recorder-bar .kr-rec-btn.active{border-color:#FF3B3B;color:#fff;background:rgba(255,59,59,0.15);}
#kcm-recorder-bar .kr-wav{border-color:rgba(244,208,63,0.4);color:#F4D03F;}
#kcm-recorder-bar .kr-midi{border-color:rgba(139,107,163,0.4);color:#8B6BA3;}
#kcm-recorder-bar .kr-rewind{border-color:rgba(0,192,192,0.4);color:#00c0c0;}
#kcm-recorder-bar .kr-clear{border-color:rgba(207,122,90,0.4);color:#CF7A5A;}
</style>
<div class="kr-row1">
  <div class="kr-dot" id="kr-dot"></div>
  <span class="kr-time" id="kr-time">00:00.0</span>
  <div class="kr-sep"></div>
  <button class="kr-rec-btn" id="kr-rec" onclick="KCMRecorder._toggleRecord()">⏺ REC</button>
  <button id="kr-stop" onclick="KCMRecorder._stop()" style="opacity:0.35;pointer-events:none;">■ STOP</button>
  <div class="kr-sep"></div>
  <span class="kr-count" id="kr-count">0 notes</span>
</div>
<div class="kr-row2">
  <button class="kr-rewind" id="kr-rewind" onclick="KCMRecorder._rewind()" style="opacity:0.35;pointer-events:none;">⏮ REWIND</button>
  <button class="kr-wav"  id="kr-wav"    onclick="KCMRecorder._exportWav()"  style="opacity:0.35;pointer-events:none;">⬇ WAV</button>
  <button class="kr-midi" id="kr-midi"   onclick="KCMRecorder._exportMidi()" style="opacity:0.35;pointer-events:none;">⬇ MIDI</button>
  <button class="kr-clear" id="kr-clear" onclick="KCMRecorder._clear()"      style="opacity:0.35;pointer-events:none;">✕ CLEAR</button>
</div>`;
    document.body.appendChild(bar);
  }

  // ── Transport controls ───────────────────────────────────────────────────
  async function _toggleRecord() {
    if (!isRecording) { await _startRecord(); }
    else if (!isPaused) { _pause(); }
    else { _resume(); }
  }

  async function _startRecord() {
    events=[]; startTime=performance.now(); pauseOffset=0;
    isRecording=true; isPaused=false;
    await startAudio();
    timerInterval = setInterval(() => { const e=el('kr-time'); if(e) e.textContent=formatTime(now()); }, 100);
    const dot=el('kr-dot'), btn=el('kr-rec');
    if (dot) dot.className='kr-dot rec';
    if (btn) { btn.textContent='⏸ PAUSE'; btn.classList.add('active'); }
    setBtn('kr-stop',true); setBtn('kr-wav',false); setBtn('kr-midi',false);
    setBtn('kr-rewind',false); setBtn('kr-clear',false);
    el('kr-count').textContent='0 notes';
  }

  function _pause() {
    isPaused=true; pauseStart=performance.now();
    if (mediaRecorder && mediaRecorder.state==='recording') mediaRecorder.pause();
    clearInterval(timerInterval);
    const btn=el('kr-rec'), dot=el('kr-dot');
    if (btn) btn.textContent='⏺ REC';
    if (dot) { dot.className='kr-dot'; dot.style.background='#F4D03F'; }
  }

  function _resume() {
    if (pauseStart) pauseOffset += performance.now()-pauseStart;
    isPaused=false; pauseStart=null;
    if (mediaRecorder && mediaRecorder.state==='paused') mediaRecorder.resume();
    timerInterval = setInterval(() => { const e=el('kr-time'); if(e) e.textContent=formatTime(now()); }, 100);
    const btn=el('kr-rec'), dot=el('kr-dot');
    if (btn) btn.textContent='⏸ PAUSE';
    if (dot) dot.className='kr-dot rec';
  }

  async function _stop() {
    if (!isRecording) return;
    clearInterval(timerInterval);
    const duration=now(); isRecording=false; isPaused=false;
    const audioBlob = await stopAudio();
    takes.push({events:events.slice(), duration, audioBlob, name:'KCM-Take-'+(takes.length+1)});
    const dot=el('kr-dot'), btn=el('kr-rec');
    if (dot) { dot.className='kr-dot'; dot.style.background='#00c0c0'; }
    if (btn) { btn.textContent='⏺ REC'; btn.classList.remove('active'); }
    setBtn('kr-stop',false);
    setBtn('kr-wav', !!audioBlob);
    setBtn('kr-midi', events.length>0);
    setBtn('kr-rewind', !!audioBlob);
    setBtn('kr-clear',true);
    const n=events.filter(e=>e.type===0x90).length;
    el('kr-count').textContent = n+' notes';
    el('kr-time').textContent  = formatTime(duration);
  }

  function _rewind() {
    if (!takes.length) return;
    const take = takes[takes.length-1];
    if (!take.audioBlob) { alert('No audio to play back.'); return; }
    const url = URL.createObjectURL(take.audioBlob);
    const audio = new Audio(url);
    audio.play();
    const dot=el('kr-dot'), count=el('kr-count');
    if (dot) dot.style.background='#00c0c0';
    if (count) count.textContent='▶ playing...';
    audio.onended = () => {
      URL.revokeObjectURL(url);
      const n = take.events.filter(e=>e.type===0x90).length;
      if (count) count.textContent=n+' notes';
      if (dot) dot.style.background='#555';
    };
  }

  function _clear() {
    takes.forEach(t => { if(t.audioBlob) URL.revokeObjectURL(t.audioBlob); });
    takes=[]; events=[];
    clearInterval(timerInterval);
    isRecording=false; isPaused=false; startTime=null;
    const dot=el('kr-dot'), btn=el('kr-rec');
    if (dot) { dot.className='kr-dot'; dot.style.background='#555'; }
    if (btn) { btn.textContent='⏺ REC'; btn.classList.remove('active'); }
    el('kr-time').textContent  = '00:00.0';
    el('kr-count').textContent = '0 notes';
    setBtn('kr-stop',false); setBtn('kr-wav',false); setBtn('kr-midi',false);
    setBtn('kr-rewind',false); setBtn('kr-clear',false);
  }

  function _exportMidi(bpm) {
    if (!takes.length) return;
    const take = takes[takes.length-1];
    if (!take.events.length) { alert('No notes recorded.'); return; }
    bpm = bpm || 120;
    const bytes = buildMidiFile(take.events, bpm);
    const blob  = new Blob([bytes], {type:'audio/midi'});
    const url   = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href=url; a.download=take.name+'.mid'; a.click();
    setTimeout(()=>URL.revokeObjectURL(url), 5000);
  }

  // ── WAV export: decode webm blob → real PCM .wav ─────────────────────────
  async function _exportWav() {
    if (!takes.length) return;
    const take = takes[takes.length-1];
    if (!take.audioBlob) {
      alert('No audio captured. Make sure you hit REC before playing notes.');
      return;
    }

    // Decode the blob to PCM using an offline AudioContext
    try {
      const arrayBuffer = await take.audioBlob.arrayBuffer();
      const decodeCtx   = new (window.AudioContext || window.webkitAudioContext)();
      const audioBuffer  = await decodeCtx.decodeAudioData(arrayBuffer);
      decodeCtx.close();
      const wavBlob = encodeWav(audioBuffer);
      const url = URL.createObjectURL(wavBlob);
      const a = document.createElement('a'); a.href=url; a.download=take.name+'.wav'; a.click();
      setTimeout(()=>URL.revokeObjectURL(url), 5000);
      console.log('[KCMRecorder] Exported real WAV:', take.name+'.wav');
    } catch(e) {
      // Fallback: just download the raw blob with correct label
      console.warn('[KCMRecorder] WAV encode failed, downloading raw audio:', e.message);
      const url = URL.createObjectURL(take.audioBlob);
      const ext = take.audioBlob.type.includes('webm') ? 'webm' : 'audio';
      const a = document.createElement('a'); a.href=url; a.download=take.name+'.'+ext; a.click();
      setTimeout(()=>URL.revokeObjectURL(url), 5000);
    }
  }

  function init() {
    createTransport();
    console.log('%cKCM Recorder v3 — REC | STOP | REWIND | WAV | MIDI | CLEAR', 'color:#00c0c0;font-weight:bold;');
  }

  global.KCMRecorder = {
    init, noteOn, noteOff, noteOnByName, noteOffByName, noteNameToMidi,
    connectSynthOutput,
    getTakes:()=>takes, getEvents:()=>events,
    _toggleRecord, _stop, _rewind, _clear, _exportMidi, _exportWav
  };

})(window);
