/**
 * kcm-mic-engine.js  — v2.0
 * Keys, Codes & Modes™  |  Benjamin Ryan
 *
 * Observatory-grade mic → pitch detection → KCM_STATE broadcast
 * + Chord naming  (simultaneous notes → "G maj", "D min7", etc.)
 * + Scale recognition  (rolling 6-second history → "G Major", "D Dorian", etc.)
 * + Arpeggio detection  (ascending / descending sequential patterns)
 *
 * Install:
 *   1. Copy to  js/kcm-mic-engine.js
 *   2. Add  <div id="kcm-mic-bar"></div>  in index.html above .kcm-panels
 *   3. Add  <script src="js/kcm-mic-engine.js"></script>  at bottom of <body>
 *      after console.js / bridge.js
 */

(function () {
  'use strict';

  // ── KCM 12-Color Chromatic Spectrum™ ─────────────────────────────────────────
  const NOTES = [
    { name:'C',  flat:'C',  color:'#FFFF00', tc:'#222' },
    { name:'C♯', flat:'Db', color:'#FFC400', tc:'#222' },
    { name:'D',  flat:'D',  color:'#FF8000', tc:'#fff' },
    { name:'D♯', flat:'Eb', color:'#FF4000', tc:'#fff' },
    { name:'E',  flat:'E',  color:'#FF0000', tc:'#fff' },
    { name:'F',  flat:'F',  color:'#C4007F', tc:'#fff' },
    { name:'F♯', flat:'Gb', color:'#8000FF', tc:'#fff' },
    { name:'G',  flat:'G',  color:'#4000FF', tc:'#fff' },
    { name:'G♯', flat:'Ab', color:'#0000FF', tc:'#fff' },
    { name:'A',  flat:'A',  color:'#007FFF', tc:'#fff' },
    { name:'A♯', flat:'Bb', color:'#00FF80', tc:'#222' },
    { name:'B',  flat:'B',  color:'#80FF00', tc:'#222' },
  ];

  // ── Chord templates — longest match wins ─────────────────────────────────────
  const CHORD_TEMPLATES = [
    { name:'maj7',  ints:[0,4,7,11] },
    { name:'min7',  ints:[0,3,7,10] },
    { name:'dom7',  ints:[0,4,7,10] },
    { name:'dim7',  ints:[0,3,6,9]  },
    { name:'m7♭5',  ints:[0,3,6,10] },
    { name:'aug',   ints:[0,4,8]    },
    { name:'dim',   ints:[0,3,6]    },
    { name:'sus4',  ints:[0,5,7]    },
    { name:'sus2',  ints:[0,2,7]    },
    { name:'maj',   ints:[0,4,7]    },
    { name:'min',   ints:[0,3,7]    },
    { name:'5th',   ints:[0,7]      },
  ];

  // ── Scale templates ───────────────────────────────────────────────────────────
  const SCALE_TEMPLATES = [
    { name:'Major',          steps:[0,2,4,5,7,9,11] },
    { name:'Natural Minor',  steps:[0,2,3,5,7,8,10] },
    { name:'Dorian',         steps:[0,2,3,5,7,9,10] },
    { name:'Phrygian',       steps:[0,1,3,5,7,8,10] },
    { name:'Lydian',         steps:[0,2,4,6,7,9,11] },
    { name:'Mixolydian',     steps:[0,2,4,5,7,9,10] },
    { name:'Locrian',        steps:[0,1,3,5,6,8,10] },
    { name:'Harmonic Minor', steps:[0,2,3,5,7,8,11] },
    { name:'Pentatonic Maj', steps:[0,2,4,7,9]      },
    { name:'Pentatonic Min', steps:[0,3,5,7,10]     },
    { name:'Blues',          steps:[0,3,5,6,7,10]   },
    { name:'Whole Tone',     steps:[0,2,4,6,8,10]   },
  ];

  // ── Constants (Observatory-proven) ───────────────────────────────────────────
  const FFT              = 4096;
  const SILENCE_GATE     = 0.012;
  const PEAK_HEADROOM_DB = 18;
  const SMOOTH_DECAY     = 0.65;
  const SMOOTH_RISE      = 0.35;
  const STRENGTH_MIN     = 0.08;
  const LOCK_FRAMES      = 3;
  const BROADCAST_MS     = 80;
  const SCALE_WINDOW_MS  = 6000;
  const SCALE_MIN_NOTES  = 4;
  const ARP_MIN          = 3;

  // ── State ─────────────────────────────────────────────────────────────────────
  let audioCtx = null, analyser = null, micStream = null;
  let tdb = null, fdb = null;
  let isOn = false, raf = null;
  let _smooth = new Array(12).fill(0);
  let _lockNote = null, _lockCount = 0;
  let _lastBroadcastMs = 0, _lastBroadcastIdx = -1;
  let _noteHistory = [];
  let _lastChord = '', _lastScale = '';

  // ─────────────────────────────────────────────────────────────────────────────
  // UI BUILD
  // ─────────────────────────────────────────────────────────────────────────────
  function buildUI() {
    const anchor = document.getElementById('kcm-mic-bar');
    if (!anchor) { console.warn('[KCM-MIC] Missing #kcm-mic-bar in index.html'); return; }
    anchor.innerHTML = `
    <div id="kcm-mic-wrap" style="
      display:flex;align-items:center;gap:10px;flex-wrap:wrap;
      background:rgba(0,0,0,.50);border:1px solid rgba(0,128,128,.28);
      border-radius:10px;padding:10px 16px;margin:10px 0 14px;
      font-family:'Montserrat',sans-serif;font-size:12px;color:#b0b0cc;
    ">
      <button id="kcm-mic-btn" style="
        display:flex;align-items:center;gap:7px;
        background:linear-gradient(135deg,#008080,#005555);
        color:#fff;border:none;border-radius:7px;padding:8px 18px;
        font-family:'Cinzel',serif;font-size:11px;letter-spacing:.09em;
        cursor:pointer;white-space:nowrap;transition:background .2s;
      ">🎙 START LISTENING</button>

      <div id="kcm-mic-led" style="
        font-family:'Courier New',monospace;font-size:10px;
        letter-spacing:.12em;color:#334;padding:4px 10px;
        border-radius:4px;border:1px solid rgba(255,255,255,.06);
        background:rgba(0,0,0,.3);min-width:68px;text-align:center;
      ">STANDBY</div>

      <div id="kcm-mic-notepill" style="
        display:none;align-items:center;gap:7px;
        background:rgba(0,0,0,.35);border-radius:20px;
        padding:5px 14px;border:1px solid rgba(255,255,255,.10);
      ">
        <div id="kcm-mic-dot" style="width:10px;height:10px;border-radius:50%;background:#333;flex-shrink:0;transition:background .08s,box-shadow .08s;"></div>
        <span id="kcm-mic-name" style="font-family:'Cinzel',serif;font-size:14px;font-weight:700;letter-spacing:.05em;min-width:24px;color:#e8e8f8;">—</span>
        <span id="kcm-mic-hz" style="font-size:9px;color:#445;letter-spacing:.04em;"></span>
      </div>

      <div id="kcm-mic-chord" style="
        display:none;align-items:center;gap:6px;
        background:rgba(0,128,128,.10);border-radius:20px;
        padding:5px 14px;border:1px solid rgba(0,128,128,.22);
      ">
        <span style="font-size:9px;color:#008080;letter-spacing:.1em;">CHORD</span>
        <span id="kcm-mic-chordname" style="font-family:'Cinzel',serif;font-size:13px;font-weight:700;color:#00c0c0;letter-spacing:.04em;"></span>
      </div>

      <div id="kcm-mic-scale" style="
        display:none;align-items:center;gap:6px;
        background:rgba(244,208,63,.06);border-radius:20px;
        padding:5px 14px;border:1px solid rgba(244,208,63,.18);
      ">
        <span style="font-size:9px;color:#F4D03F;letter-spacing:.1em;">SCALE</span>
        <span id="kcm-mic-scalename" style="font-family:'Cinzel',serif;font-size:12px;font-weight:700;color:#F4D03F;letter-spacing:.04em;"></span>
      </div>

      <div id="kcm-mic-arp" style="
        display:none;align-items:center;gap:6px;
        background:rgba(139,107,163,.08);border-radius:20px;
        padding:5px 14px;border:1px solid rgba(139,107,163,.22);
      ">
        <span style="font-size:9px;color:#8B6BA3;letter-spacing:.1em;">ARP</span>
        <span id="kcm-mic-arpname" style="font-family:'Cinzel',serif;font-size:12px;font-weight:700;color:#8B6BA3;letter-spacing:.04em;"></span>
      </div>

      <label style="display:flex;align-items:center;gap:5px;color:#445;font-size:10px;letter-spacing:.06em;margin-left:4px;">
        SENS<input id="kcm-mic-gain" type="range" min="0.3" max="4" step="0.1" value="1.8"
          style="width:68px;accent-color:#008080;cursor:pointer;">
      </label>
      <label style="display:flex;align-items:center;gap:5px;color:#445;font-size:10px;letter-spacing:.06em;">
        LOCK<input id="kcm-mic-smooth" type="range" min="0" max="0.95" step="0.05" value="0.65"
          style="width:60px;accent-color:#008080;cursor:pointer;">
      </label>

      <button id="kcm-mic-clear" title="Clear scale/arpeggio history" style="
        background:none;border:1px solid rgba(255,255,255,.10);border-radius:5px;
        color:#334;font-size:10px;padding:4px 8px;cursor:pointer;letter-spacing:.06em;
        font-family:'Montserrat',sans-serif;
      ">✕ RESET</button>

      <div style="margin-left:auto;color:#334;font-size:9px;letter-spacing:.07em;text-align:right;line-height:1.6;">
        BROADCASTS TO<br><span style="color:#008080;">ALL PANELS</span>
      </div>
    </div>`;

    document.getElementById('kcm-mic-btn').addEventListener('click', toggleMic);
    document.getElementById('kcm-mic-clear').addEventListener('click', clearHistory);
    document.getElementById('kcm-mic-smooth').addEventListener('input', e => {
      if (analyser) analyser.smoothingTimeConstant = parseFloat(e.target.value);
    });
  }

  // ── UI helpers ────────────────────────────────────────────────────────────────
  function setLED(text, color) {
    const el = document.getElementById('kcm-mic-led');
    if (!el) return;
    el.textContent = text;
    el.style.color = color || '#334';
    el.style.borderColor = color ? color + '44' : 'rgba(255,255,255,.06)';
  }
  function setBtn(active) {
    const b = document.getElementById('kcm-mic-btn');
    if (!b) return;
    b.textContent = active ? '⏹ STOP' : '🎙 START LISTENING';
    b.style.background = active
      ? 'linear-gradient(135deg,#c03030,#801010)'
      : 'linear-gradient(135deg,#008080,#005555)';
  }
  function showNote(idx, hz) {
    const pill = document.getElementById('kcm-mic-notepill');
    if (!pill) return;
    if (idx === null) { pill.style.display = 'none'; return; }
    const n = NOTES[idx];
    pill.style.display = 'flex';
    const dot = document.getElementById('kcm-mic-dot');
    dot.style.background = n.color;
    dot.style.boxShadow  = `0 0 9px ${n.color}`;
    const nm = document.getElementById('kcm-mic-name');
    nm.textContent = n.name; nm.style.color = n.color;
    const hEl = document.getElementById('kcm-mic-hz');
    hEl.textContent = hz ? hz.toFixed(1) + ' Hz' : '';
  }
  function showEl(id, nameId, val) {
    const el = document.getElementById(id);
    const nm = document.getElementById(nameId);
    if (!el) return;
    if (!val) { el.style.display = 'none'; return; }
    el.style.display = 'flex';
    nm.textContent = val;
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // ANALYSIS
  // ─────────────────────────────────────────────────────────────────────────────
  function detectChord(activeNotes) {
    if (activeNotes.length < 2) return null;
    const noteSet = new Set(activeNotes);
    let best = null;
    for (const root of activeNotes) {
      for (const tmpl of CHORD_TEMPLATES) {
        const needed = tmpl.ints.map(i => (root + i) % 12);
        if (needed.every(n => noteSet.has(n))) {
          if (!best || tmpl.ints.length > best.score) {
            best = { root, name: NOTES[root].name + ' ' + tmpl.name, score: tmpl.ints.length, quality: tmpl.name };
          }
        }
      }
    }
    return best;
  }

  function detectScale(history) {
    const played = [...new Set(history.map(h => h.noteIndex))];
    if (played.length < SCALE_MIN_NOTES) return null;
    const playedSet = new Set(played);
    let best = null, bestScore = 0;
    for (let root = 0; root < 12; root++) {
      for (const tmpl of SCALE_TEMPLATES) {
        const scaleSet = new Set(tmpl.steps.map(s => (root + s) % 12));
        let hits = 0, misses = 0;
        for (const p of played) { if (scaleSet.has(p)) hits++; else misses++; }
        const score = hits - misses * 1.5;
        if (hits >= SCALE_MIN_NOTES && score > bestScore) {
          bestScore = score;
          best = { root, name: NOTES[root].name + ' ' + tmpl.name, scaleName: tmpl.name, steps: tmpl.steps };
        }
      }
    }
    return best;
  }

  function detectArpeggio(history) {
    if (history.length < ARP_MIN) return null;
    const recent = history.slice(-6);
    if (recent.length < ARP_MIN) return null;
    let ups = 0, downs = 0;
    for (let i = 1; i < recent.length; i++) {
      let diff = recent[i].noteIndex - recent[i-1].noteIndex;
      if (diff > 6) diff -= 12;
      if (diff < -6) diff += 12;
      if (diff > 0) ups++; else if (diff < 0) downs++;
    }
    const total = recent.length - 1;
    const names = recent.map(h => NOTES[h.noteIndex].name).join('→');
    if (ups >= total * 0.7)   return '↑ ' + names;
    if (downs >= total * 0.7) return '↓ ' + names;
    return null;
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // MIC
  // ─────────────────────────────────────────────────────────────────────────────
  function toggleMic() { isOn ? stop() : start(); }

  async function start() {
    setLED('INIT…', '#F4D03F'); setBtn(true);
    try {
      if (micStream) micStream.getTracks().forEach(t => t.stop());
      // Observatory-grade: raw instrument signal, NO voice processing
      micStream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation:false, noiseSuppression:false, autoGainControl:false, channelCount:1 },
        video: false,
      });
      audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      analyser = audioCtx.createAnalyser();
      analyser.fftSize = FFT;
      analyser.smoothingTimeConstant = parseFloat(document.getElementById('kcm-mic-smooth')?.value ?? '0.65');
      audioCtx.createMediaStreamSource(micStream).connect(analyser);
      tdb = new Float32Array(FFT);
      fdb = new Float32Array(analyser.frequencyBinCount);
      _smooth = new Array(12).fill(0);
      _lockNote = null; _lockCount = 0; _noteHistory = [];
      isOn = true;
      setLED('LIVE ●', '#00FF88');
      loop();
    } catch (e) {
      console.error('[KCM-MIC] getUserMedia failed:', e.name, e.message);
      isOn = false; setLED('ERROR', '#FF4444'); setBtn(false);
      alert('Mic error: ' + e.name + '\n\nmacOS → System Settings → Privacy → Microphone → Chrome ON\nThen refresh.');
    }
  }

  function stop() {
    isOn = false;
    if (raf) { cancelAnimationFrame(raf); raf = null; }
    if (micStream) micStream.getTracks().forEach(t => t.stop());
    if (audioCtx && audioCtx.state !== 'closed') audioCtx.close();
    micStream = null; audioCtx = null; analyser = null;
    _smooth = new Array(12).fill(0); _lockNote = null;
    setLED('STANDBY', '#334'); setBtn(false);
    showNote(null);
    showEl('kcm-mic-chord','kcm-mic-chordname', null);
    showEl('kcm-mic-scale','kcm-mic-scalename', null);
    showEl('kcm-mic-arp',  'kcm-mic-arpname',   null);
    send({ type:'KCM_STATE', payload:{ activeNotes:[], micActive:false, source:'kcm-mic-engine' } });
  }

  function clearHistory() {
    _noteHistory = []; _lastChord = ''; _lastScale = '';
    showEl('kcm-mic-chord','kcm-mic-chordname', null);
    showEl('kcm-mic-scale','kcm-mic-scalename', null);
    showEl('kcm-mic-arp',  'kcm-mic-arpname',   null);
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // DETECTION LOOP — Observatory algorithm
  // ─────────────────────────────────────────────────────────────────────────────
  function loop() {
    if (!isOn) return;
    raf = requestAnimationFrame(loop);
    analyser.getFloatTimeDomainData(tdb);
    analyser.getFloatFrequencyData(fdb);

    const gain  = parseFloat(document.getElementById('kcm-mic-gain')?.value ?? '1.8');
    const binHz = audioCtx.sampleRate / FFT;

    // RMS
    let sq = 0;
    for (let i = 0; i < tdb.length; i++) sq += tdb[i] ** 2;
    const rms = Math.min(1, Math.sqrt(sq / tdb.length) * gain * 3);

    // Dynamic noise floor
    let specSum = 0, specCount = 0;
    for (let i = 2; i < fdb.length - 2; i++) {
      if (fdb[i] > -120) { specSum += Math.pow(10, fdb[i]/10); specCount++; }
    }
    const specFloorDB = specCount > 0 ? 10 * Math.log10(specSum / specCount) : -90;
    const PEAK_THRESH = Math.max(-62, specFloorDB + PEAK_HEADROOM_DB);

    // Silence gate
    if (rms < SILENCE_GATE) {
      for (let i = 0; i < 12; i++) _smooth[i] *= 0.5;
      if (_lockNote !== null) { _lockNote = null; _lockCount = 0; showNote(null); }
      return;
    }

    // Peak detect per chroma
    const nE = new Array(12).fill(0), nFq = new Array(12).fill(0);
    for (let i = 3; i < fdb.length - 3; i++) {
      const freq = i * binHz;
      if (freq < 60 || freq > 5200) continue;
      const db = fdb[i];
      if (db < PEAK_THRESH) continue;
      if (db > fdb[i-1] && db > fdb[i-2] && db > fdb[i+1] && db > fdb[i+2]) {
        const mi = Math.round(freqToMidi(freq));
        const ni = ((mi % 12) + 12) % 12;
        const str = Math.max(0, (db - PEAK_THRESH) / 40);
        if (str > nE[ni]) { nE[ni] = str; nFq[ni] = freq; }
      }
    }

    // Temporal smoothing
    for (let i = 0; i < 12; i++) _smooth[i] = _smooth[i] * SMOOTH_DECAY + nE[i] * SMOOTH_RISE;

    const active = _smooth
      .map((s, i) => ({ noteIndex:i, strength:s, freq:nFq[i] }))
      .filter(n => n.strength > STRENGTH_MIN)
      .sort((a, b) => b.strength - a.strength);

    const dominant = active[0] || null;

    if (dominant) {
      if (dominant.noteIndex === _lockNote) { _lockCount++; }
      else { _lockNote = dominant.noteIndex; _lockCount = 1; }

      if (_lockCount >= LOCK_FRAMES) {
        showNote(_lockNote, dominant.freq);

        const now = Date.now();
        const lastH = _noteHistory[_noteHistory.length - 1];
        if (!lastH || lastH.noteIndex !== _lockNote || now - lastH.time > 400) {
          _noteHistory.push({ noteIndex:_lockNote, time:now, freq:dominant.freq });
        }
        _noteHistory = _noteHistory.filter(h => now - h.time < SCALE_WINDOW_MS);

        // Chord
        const activeIdx = active.map(a => a.noteIndex);
        const chord = detectChord(activeIdx);
        const chordStr = chord ? chord.name : null;
        if (chordStr !== _lastChord) { _lastChord = chordStr || ''; showEl('kcm-mic-chord','kcm-mic-chordname', chordStr); }

        // Scale
        const scale = detectScale(_noteHistory);
        const scaleStr = scale ? scale.name : null;
        if (scaleStr !== _lastScale) { _lastScale = scaleStr || ''; showEl('kcm-mic-scale','kcm-mic-scalename', scaleStr); }

        // Arpeggio
        showEl('kcm-mic-arp','kcm-mic-arpname', detectArpeggio(_noteHistory));

        // Broadcast
        if (_lockNote !== _lastBroadcastIdx || now - _lastBroadcastMs > BROADCAST_MS) {
          send({
            type: 'KCM_STATE',
            payload: {
              root:         NOTES[_lockNote].name,
              rootFlat:     NOTES[_lockNote].flat,
              rootIndex:    _lockNote,
              color:        NOTES[_lockNote].color,
              hz:           dominant.freq,
              activeNotes:  activeIdx,
              chord:        chordStr,
              chordRoot:    chord ? chord.root    : null,
              chordQuality: chord ? chord.quality : null,
              scale:        scale ? scale.scaleName : null,
              scaleFull:    scale ? scale.name      : null,
              scaleSteps:   scale ? scale.steps     : null,
              source:       'kcm-mic-engine',
              micActive:    true,
            }
          });
          _lastBroadcastIdx = _lockNote;
          _lastBroadcastMs  = now;
        }
      }
    } else {
      if (_lockNote !== null) { _lockNote = null; _lockCount = 0; showNote(null); }
    }
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // SEND
  // ─────────────────────────────────────────────────────────────────────────────
  function send(msg) {
    try { if (window.KCM?.bus?.set) window.KCM.bus.set(msg.payload); } catch(_) {}
    try { document.querySelectorAll('iframe').forEach(fr => { try { fr.contentWindow.postMessage(msg,'*'); } catch(_){} }); } catch(_) {}
    try { window.parent.postMessage(msg,'*'); } catch(_) {}
  }

  function freqToMidi(f) { return 69 + 12 * Math.log2(f / 440); }

  // ─────────────────────────────────────────────────────────────────────────────
  // INIT
  // ─────────────────────────────────────────────────────────────────────────────
  function init() {
    buildUI();
    console.log('[KCM-MIC] v2.0 ready — chord + scale + arpeggio. Click START LISTENING.');
  }
  if (document.readyState === 'loading') { document.addEventListener('DOMContentLoaded', init); } else { init(); }

  window.KCM_MIC = { start, stop, clearHistory, getHistory: () => _noteHistory };
})();
