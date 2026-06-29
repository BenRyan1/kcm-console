/* ─────────────────────────────────────────────────────────────────────────
   KCM CONSOLE — gcis.js  (v1.1)
   Session 8: .gcis — Global Chromatic Identity State
   v1.1 (Claim C-5 fix, 2026-06-29): the "history" field below was a
   reserved, unused placeholder. It's now wired to the bus's real
   pushEvent()/history mechanism (see console.js) and exported as a
   top-level "events" array — onset time and duration in milliseconds,
   true 0-11 pitch class plus the full MIDI note number, per event.

   THE FORMAT
   ──────────
   .gcis is a plain JSON file with a versioned envelope. It captures a
   complete snapshot of the KCM Console harmonic state — root, mode, scale,
   active notes — plus metadata (title, author, timestamp, app version).

   Any KCM-compatible app can read a .gcis file and restore the harmonic
   context exactly. This is the interoperability standard.

   FILE STRUCTURE
   ──────────────
   {
     "gcis":    "1.0",           ← format version (semver, never changes for v1)
     "created": "2026-04-25T...",← ISO timestamp
     "title":   "My Session",    ← user-editable
     "author":  "Benjamin Ryan", ← user-editable
     "app": {
       "name":    "KCM Console",
       "version": "0.8.0",
       "url":     "https://console.keyscodesandmodes.com"
     },
     "state": {
       "root":        "G",       ← pitch class string (sharp notation canonical)
       "mode":        "dorian",  ← modal identifier string
       "scale":       [0,2,3,5,7,9,10], ← interval array
       "activeNotes": [62,65,67] ← MIDI note numbers (Set serialised as sorted array)
     },
     "events": [                 ← recorded note event sequence (Claim C-5)
       { "t": 0,    "pc": 7, "midi": 67, "duration": 500, "root": "G", "mode": "dorian" },
       { "t": 500,  "pc": 9, "midi": 69, "duration": 250, "root": "G", "mode": "dorian" }
     ]                           ← t and duration in milliseconds; [] if nothing recorded
   }

   PATENT NOTE
   ───────────
   The .gcis format and the KCM harmonic state bus are proprietary to
   Keys, Codes & Modes™ / Benjamin Ryan. All rights reserved.
   FreeStyle® Musical Device (4 US patents).
   ───────────────────────────────────────────────────────────────────────── */

(function () {
  'use strict';

  var GCIS_VERSION = '1.0';
  var APP_VERSION  = '0.8.0';

  // ── Serialise ──────────────────────────────────────────────────────────
  // Takes a KCM.bus state snapshot and returns a .gcis JSON string.
  // title and author are optional — defaults used if omitted.
  function serialise(state, meta) {
    meta = meta || {};
    var doc = {
      gcis:    GCIS_VERSION,
      created: new Date().toISOString(),
      title:   meta.title  || 'KCM Session',
      author:  meta.author || 'Benjamin Ryan',
      app: {
        name:    'KCM Console',
        version: APP_VERSION,
        url:     'https://console.keyscodesandmodes.com'
      },
      state: {
        root:        state.root,
        mode:        state.mode,
        scale:       (state.scale || []).slice(),
        activeNotes: Array.from(state.activeNotes || []).sort(function (a, b) { return a - b; })
      },
      events: Array.isArray(state.history) ? state.history.slice() : []  // Claim C-5: onset/duration in ms, true pitch class
    };
    return JSON.stringify(doc, null, 2);
  }

  // ── Validate ───────────────────────────────────────────────────────────
  // Returns null if valid, or an error string.
  var VALID_PITCH_CLASSES = ['C','C#','D','D#','E','F','F#','G','G#','A','A#','B'];
  var VALID_MODES = ['ionian','dorian','phrygian','lydian','mixolydian','aeolian','locrian'];

  function validate(doc) {
    if (!doc || typeof doc !== 'object')        return 'Not a valid JSON object';
    if (!doc.gcis)                              return 'Missing gcis version field';
    if (!doc.state)                             return 'Missing state field';
    var s = doc.state;
    if (!s.root)                                return 'Missing state.root';
    if (VALID_PITCH_CLASSES.indexOf(s.root) === -1)
                                                return 'Invalid root: ' + s.root;
    if (!s.mode)                                return 'Missing state.mode';
    if (VALID_MODES.indexOf(s.mode) === -1)     return 'Invalid mode: ' + s.mode;
    if (!Array.isArray(s.scale))                return 'state.scale must be an array';
    if (!Array.isArray(s.activeNotes))          return 'state.activeNotes must be an array';
    return null;  // valid
  }

  // ── Deserialise ────────────────────────────────────────────────────────
  // Parses a .gcis JSON string and returns { ok, state, meta, error }.
  // state is ready to pass directly to KCM.bus.set().
  function deserialise(jsonString) {
    var doc;
    try {
      doc = JSON.parse(jsonString);
    } catch (e) {
      return { ok: false, error: 'JSON parse error: ' + e.message };
    }

    var err = validate(doc);
    if (err) return { ok: false, error: err };

    var s = doc.state;
    return {
      ok: true,
      meta: {
        title:   doc.title   || 'Untitled',
        author:  doc.author  || '',
        created: doc.created || '',
        gcis:    doc.gcis
      },
      state: {
        root:        s.root,
        mode:        s.mode,
        scale:       s.scale.slice(),
        activeNotes: new Set(s.activeNotes),
        history:     Array.isArray(doc.events) ? doc.events.slice() : []
      }
    };
  }

  // ── Save to disk ───────────────────────────────────────────────────────
  // Triggers a browser download of the .gcis file.
  function saveToDisk(state, meta) {
    var json     = serialise(state, meta);
    var blob     = new Blob([json], { type: 'application/json' });
    var url      = URL.createObjectURL(blob);
    var a        = document.createElement('a');
    var title    = (meta && meta.title) ? meta.title : 'kcm-session';
    var filename = title.toLowerCase().replace(/[^a-z0-9]+/g, '-') + '.gcis';
    a.href       = url;
    a.download   = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(function () { URL.revokeObjectURL(url); }, 1000);
    console.log('[KCM.gcis] Saved: ' + filename);
    return filename;
  }

  // ── Load from disk ─────────────────────────────────────────────────────
  // Opens a file picker, reads the .gcis file, deserialises it,
  // and calls onSuccess({ state, meta }) or onError(errorString).
  function loadFromDisk(onSuccess, onError) {
    var input = document.createElement('input');
    input.type   = 'file';
    input.accept = '.gcis,application/json';
    input.style.display = 'none';
    document.body.appendChild(input);

    input.addEventListener('change', function () {
      var file = input.files[0];
      if (!file) { document.body.removeChild(input); return; }

      var reader = new FileReader();
      reader.onload = function (e) {
        document.body.removeChild(input);
        var result = deserialise(e.target.result);
        if (result.ok) {
          console.log('[KCM.gcis] Loaded: ' + file.name + ' — root=' + result.state.root + ' mode=' + result.state.mode);
          onSuccess(result);
        } else {
          console.error('[KCM.gcis] Load error:', result.error);
          if (onError) onError(result.error);
        }
      };
      reader.onerror = function () {
        document.body.removeChild(input);
        if (onError) onError('File read error');
      };
      reader.readAsText(file);
    });

    input.click();
  }

  // ── Expose globally ────────────────────────────────────────────────────
  window.KCM        = window.KCM || {};
  window.KCM.gcis   = {
    serialise:    serialise,
    deserialise:  deserialise,
    saveToDisk:   saveToDisk,
    loadFromDisk: loadFromDisk,
    VERSION:      GCIS_VERSION
  };

  console.log('[KCM.gcis] v' + GCIS_VERSION + ' ready — .gcis format initialised.');
})();
