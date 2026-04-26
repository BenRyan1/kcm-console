/* ─────────────────────────────────────────────────────────────────────────
   KCM CONSOLE — console.js  (v0.2.0)
   Session 2 scope: state bus + dev panel (gated by ?dev=1).

   v0.1.1: rotated chromatic wheel -15° so C is CENTERED at 12 o'clock.
   v0.1.2: typography fix — uniform label centering via dominant-baseline,
           adaptive ink color per wedge luminance, font 16→18.
   v0.2.0: state bus (window.KCM.bus) with get/set/subscribe API.
           Dev panel mounted when URL has ?dev=1.
   ───────────────────────────────────────────────────────────────────────── */

(function () {
  'use strict';

  // ── 12-Color Chromatic Spectrum™ ─────────────────────────────────────
  // Canonical order starting at C = 12 o'clock, clockwise.
  // Hex values must match css/console.css :root tokens.
  const CHROMATIC = [
    { pc: 'C',  hex: '#FFFF00' },
    { pc: 'C#', hex: '#FFC400' },
    { pc: 'D',  hex: '#FF8000' },
    { pc: 'D#', hex: '#FF4000' },
    { pc: 'E',  hex: '#FF0000' },
    { pc: 'F',  hex: '#C4007F' },
    { pc: 'F#', hex: '#8000FF' },
    { pc: 'G',  hex: '#4000FF' },
    { pc: 'G#', hex: '#0000FF' },
    { pc: 'A',  hex: '#007FFF' },
    { pc: 'A#', hex: '#00FF80' },
    { pc: 'B',  hex: '#80FF00' }
  ];

  // ── Canonical scales/modes ───────────────────────────────────────────
  // Extracted from Music Theory Pro lines 1271–1310.
  // The shared vocabulary every panel and the bus speak.
  const MODES = {
    ionian:     [0, 2, 4, 5, 7, 9, 11],
    dorian:     [0, 2, 3, 5, 7, 9, 10],
    phrygian:   [0, 1, 3, 5, 7, 8, 10],
    lydian:     [0, 2, 4, 6, 7, 9, 11],
    mixolydian: [0, 2, 4, 5, 7, 9, 10],
    aeolian:    [0, 2, 3, 5, 7, 8, 10],
    locrian:    [0, 1, 3, 5, 6, 8, 10]
  };

  const PITCH_CLASSES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];

  // ── SVG chromatic clock renderer ─────────────────────────────────────
  // Produces 12 pie-slice wedges. C wedge is CENTERED at 12 o'clock.
  // Each wedge spans 30°. Outer radius 180, inner radius 62.
  //
  // Rotation baked into geometry:
  //   -90° : put 0° at 12 o'clock (SVG math has 0° at 3 o'clock)
  //   -15° : shift whole wheel half a wedge CCW so C straddles 12
  //   Net  : -105° applied per wedge
  //
  // Labels use dominant-baseline="central" + text-anchor="middle" for
  // true 2D centering. Adaptive ink: dark on bright wedges, light on
  // dark wedges. Labels stay upright (no text rotation).
  function renderChromaticClock(groupEl) {
    if (!groupEl) return;

    const cx = 200;
    const cy = 200;
    const rOuter = 180;
    const rInner = 62;
    const wedgeDeg = 30;
    const halfWedge = 15;
    const svgNS = 'http://www.w3.org/2000/svg';

    while (groupEl.firstChild) groupEl.removeChild(groupEl.firstChild);

    CHROMATIC.forEach((note, i) => {
      const startDeg = i * wedgeDeg - 90 - halfWedge;
      const endDeg   = (i + 1) * wedgeDeg - 90 - halfWedge;

      const startRad = (startDeg * Math.PI) / 180;
      const endRad   = (endDeg   * Math.PI) / 180;

      const xOuterStart = cx + rOuter * Math.cos(startRad);
      const yOuterStart = cy + rOuter * Math.sin(startRad);
      const xOuterEnd   = cx + rOuter * Math.cos(endRad);
      const yOuterEnd   = cy + rOuter * Math.sin(endRad);

      const xInnerStart = cx + rInner * Math.cos(startRad);
      const yInnerStart = cy + rInner * Math.sin(startRad);
      const xInnerEnd   = cx + rInner * Math.cos(endRad);
      const yInnerEnd   = cy + rInner * Math.sin(endRad);

      const d = [
        'M ' + xInnerStart + ' ' + yInnerStart,
        'L ' + xOuterStart + ' ' + yOuterStart,
        'A ' + rOuter + ' ' + rOuter + ' 0 0 1 ' + xOuterEnd + ' ' + yOuterEnd,
        'L ' + xInnerEnd + ' ' + yInnerEnd,
        'A ' + rInner + ' ' + rInner + ' 0 0 0 ' + xInnerStart + ' ' + yInnerStart,
        'Z'
      ].join(' ');

      const path = document.createElementNS(svgNS, 'path');
      path.setAttribute('d', d);
      path.setAttribute('fill', note.hex);
      path.setAttribute('stroke', '#0a0a15');
      path.setAttribute('stroke-width', '1.5');
      path.setAttribute('opacity', '0.95');
      path.setAttribute('data-pc', note.pc);
      groupEl.appendChild(path);

      // Label at wedge midpoint, upright, centered via dominant-baseline.
      const midDeg = (startDeg + endDeg) / 2;
      const midRad = (midDeg * Math.PI) / 180;
      const rLabel = (rOuter + rInner) / 2;
      const xLabel = cx + rLabel * Math.cos(midRad);
      const yLabel = cy + rLabel * Math.sin(midRad);

      // Adaptive ink color via perceptual luminance.
      const hex = note.hex;
      const r = parseInt(hex.slice(1, 3), 16);
      const g = parseInt(hex.slice(3, 5), 16);
      const b = parseInt(hex.slice(5, 7), 16);
      const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
      const inkColor = luminance > 0.55 ? '#0a0a15' : '#e8e8f8';

      const text = document.createElementNS(svgNS, 'text');
      text.setAttribute('x', xLabel);
      text.setAttribute('y', yLabel);
      text.setAttribute('text-anchor', 'middle');
      text.setAttribute('dominant-baseline', 'central');
      text.setAttribute('font-family', 'Cinzel, Georgia, serif');
      text.setAttribute('font-size', '18');
      text.setAttribute('font-weight', '600');
      text.setAttribute('fill', inkColor);
      text.setAttribute('letter-spacing', '0.5');
      text.setAttribute('pointer-events', 'none');
      text.textContent = note.pc;
      groupEl.appendChild(text);
    });
  }

  // ── Build version stamp ──────────────────────────────────────────────
  const BUILD = {
    version: '0.8.0',
    session: 8,
    built:   '2026-04-25',
    notes:   '.gcis format + Save/Load. KCM standard established.'
  };

  function stampBuildVersion() {
    const el = document.getElementById('build-version');
    if (el) {
      el.textContent = 'Build ' + BUILD.version + ' · Session ' + BUILD.session + ' · ' + BUILD.built;
    }
  }

  // ── State bus ────────────────────────────────────────────────────────
  // Minimal reactive store. Holds the canonical harmonic state.
  // Panels subscribe to updates and publish patches. Single source of truth.
  //
  // API (locked in v0.2 foundation review, do not drift):
  //   KCM.bus.get()            → snapshot
  //   KCM.bus.set(patch)       → shallow-merge, notify subscribers
  //   KCM.bus.subscribe(fn)    → fn called on every change; returns unsubscribe()
  //
  // State shape (v1 locked): {root, mode, scale, activeNotes:Set<midi>}
  function createBus(initial) {
    const state = Object.assign({}, initial);
    const subscribers = new Set();

    function snapshot() {
      return {
        root:        state.root,
        mode:        state.mode,
        scale:       state.scale.slice(),
        activeNotes: new Set(state.activeNotes)
      };
    }

    function notify() {
      const snap = snapshot();
      subscribers.forEach(function (fn) {
        try { fn(snap); } catch (err) {
          console.error('[KCM.bus] subscriber error:', err);
        }
      });
    }

    return {
      get: snapshot,
      set: function (patch) {
        if (!patch || typeof patch !== 'object') return;
        var changed = false;
        for (var key in patch) {
          if (!Object.prototype.hasOwnProperty.call(patch, key)) continue;
          if (!(key in state)) continue;
          state[key] = patch[key];
          changed = true;
        }
        if (changed) notify();
      },
      subscribe: function (fn) {
        if (typeof fn !== 'function') return function () {};
        subscribers.add(fn);
        try { fn(snapshot()); } catch (err) {
          console.error('[KCM.bus] initial call error:', err);
        }
        return function unsubscribe() { subscribers.delete(fn); };
      },
      get state() { return state; },
      _subscriberCount: function () { return subscribers.size; }
    };
  }

  window.KCM = window.KCM || {};
  window.KCM.build = BUILD;
  window.KCM.MODES = MODES;
  window.KCM.PITCH_CLASSES = PITCH_CLASSES;
  window.KCM.bus = createBus({
    root:        'C',
    mode:        'ionian',
    scale:       MODES.ionian.slice(),
    activeNotes: new Set()
  });

  // ── Dev panel (gated by ?dev=1) ──────────────────────────────────────
  function isDevMode() {
    try {
      var params = new URLSearchParams(window.location.search);
      return params.get('dev') === '1';
    } catch (e) { return false; }
  }

  function buildDevPanel() {
    var panel = document.createElement('section');
    panel.className = 'kcm-dev';
    panel.setAttribute('aria-label', 'Developer panel');
    panel.innerHTML = [
      '<div class="kcm-dev__header">',
        '<h3>Dev Panel — State Bus Inspector</h3>',
        '<span class="kcm-dev__tag">Session 2 · v0.2 contract</span>',
      '</div>',
      '<div class="kcm-dev__grid">',
        '<div class="kcm-dev__col">',
          '<h4>Current bus state</h4>',
          '<pre class="kcm-dev__readout" id="dev-readout">{}</pre>',
          '<p class="kcm-dev__meta" id="dev-meta"></p>',
        '</div>',
        '<div class="kcm-dev__col">',
          '<h4>Write to bus</h4>',
          '<div class="kcm-dev__group">',
            '<label>root</label>',
            '<div class="kcm-dev__btns" id="dev-root-btns"></div>',
          '</div>',
          '<div class="kcm-dev__group">',
            '<label>mode</label>',
            '<div class="kcm-dev__btns" id="dev-mode-btns"></div>',
          '</div>',
          '<div class="kcm-dev__group">',
            '<label>activeNotes (MIDI)</label>',
            '<div class="kcm-dev__btns">',
              '<button data-action="toggle-note" data-midi="60">toggle 60 (C4)</button>',
              '<button data-action="toggle-note" data-midi="64">toggle 64 (E4)</button>',
              '<button data-action="toggle-note" data-midi="67">toggle 67 (G4)</button>',
              '<button data-action="clear-notes">clear</button>',
            '</div>',
          '</div>',
          '<div class="kcm-dev__group">',
            '<label>diagnostics</label>',
            '<div class="kcm-dev__btns">',
              '<button data-action="log-state">console.log state</button>',
              '<button data-action="count-subs">count subscribers</button>',
            '</div>',
          '</div>',
        '</div>',
      '</div>'
    ].join('');
    return panel;
  }

  function wireDevPanel(panel) {
    var readout = panel.querySelector('#dev-readout');
    var meta    = panel.querySelector('#dev-meta');
    var rootBox = panel.querySelector('#dev-root-btns');
    var modeBox = panel.querySelector('#dev-mode-btns');

    PITCH_CLASSES.forEach(function (pc) {
      var b = document.createElement('button');
      b.textContent = pc;
      b.dataset.action = 'set-root';
      b.dataset.value = pc;
      rootBox.appendChild(b);
    });

    Object.keys(MODES).forEach(function (modeName) {
      var b = document.createElement('button');
      b.textContent = modeName;
      b.dataset.action = 'set-mode';
      b.dataset.value = modeName;
      modeBox.appendChild(b);
    });

    panel.addEventListener('click', function (ev) {
      var btn = ev.target.closest('button[data-action]');
      if (!btn) return;
      var action = btn.dataset.action;
      var value  = btn.dataset.value;
      var bus    = window.KCM.bus;

      switch (action) {
        case 'set-root':
          bus.set({ root: value });
          break;
        case 'set-mode':
          bus.set({ mode: value, scale: MODES[value].slice() });
          break;
        case 'toggle-note':
          var midi = parseInt(btn.dataset.midi, 10);
          var current = bus.get().activeNotes;
          if (current.has(midi)) current.delete(midi);
          else current.add(midi);
          bus.set({ activeNotes: current });
          break;
        case 'clear-notes':
          bus.set({ activeNotes: new Set() });
          break;
        case 'log-state':
          console.log('[KCM.bus] current state:', bus.get());
          break;
        case 'count-subs':
          console.log('[KCM.bus] subscribers:', bus._subscriberCount());
          break;
      }

      if (action === 'set-root' || action === 'set-mode') {
        var siblings = btn.parentElement.querySelectorAll('button');
        siblings.forEach(function (b) { b.classList.toggle('is-active', b === btn); });
      }
    });

    function render(state) {
      var view = {
        root: state.root,
        mode: state.mode,
        scale: state.scale,
        activeNotes: Array.from(state.activeNotes).sort(function (a, b) { return a - b; })
      };
      readout.textContent = JSON.stringify(view, null, 2);
      var now = new Date().toISOString().split('T')[1].replace('Z', '');
      meta.textContent = 'last update ' + now + ' · subscribers: ' + window.KCM.bus._subscriberCount();
    }
    window.KCM.bus.subscribe(render);

    var initial = window.KCM.bus.get();
    var initialRootBtn = rootBox.querySelector('button[data-value="' + initial.root + '"]');
    if (initialRootBtn) initialRootBtn.classList.add('is-active');
    var initialModeBtn = modeBox.querySelector('button[data-value="' + initial.mode + '"]');
    if (initialModeBtn) initialModeBtn.classList.add('is-active');
  }

  function mountDevPanel() {
    if (!isDevMode()) return;
    document.body.classList.add('dev-mode');
    var panel = buildDevPanel();
    var main = document.getElementById('main') || document.body;
    main.appendChild(panel);
    wireDevPanel(panel);
  }

  // ── Init ─────────────────────────────────────────────────────────────
  function init() {
    var group = document.getElementById('chromatic-wedges');
    renderChromaticClock(group);
    stampBuildVersion();
    mountDevPanel();

    console.log(
      '%cKCM Console %cv' + BUILD.version,
      'font-family:Cinzel,serif;font-size:18px;color:#00c0c0;font-weight:600;',
      'font-family:Montserrat,sans-serif;font-size:14px;color:#F4D03F;'
    );
    console.log('Session ' + BUILD.session + ' — ' + BUILD.notes);
    console.log('Bus ready. Try: KCM.bus.get() · KCM.bus.set({root:"F"}) · KCM.bus.subscribe(fn)');
    if (isDevMode()) console.log('Dev panel mounted (URL has ?dev=1).');
    else console.log('Dev panel hidden. Append ?dev=1 to the URL to show it.');
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
