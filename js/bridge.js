/* ─────────────────────────────────────────────────────────────────────────
   KCM CONSOLE — bridge.js  (v0.4.1)
   Session 3: iframe postMessage adapter.
   v0.4.0: panel-readiness handshake (Claim B-4 fix, 2026-06-29).
           Panels announce { type:'KCM_PANEL_READY', panel:<name> } once
           their own message listener is mounted. register() no longer
           fires KCM_STATE immediately on iframe load — it waits for the
           handshake (with a FALLBACK_MS safety-net timer) so no message
           is ever sent before the panel can hear it. Ongoing bus-driven
           broadcasts go only to panels confirmed ready. Also wires up
           the two panels (Chromatic Universe, Modal Neck) that existed
           in index.html but were never registered with the bridge.

   Responsibilities:
     1. Outbound — broadcast KCM_STATE to all READY iframes on every
        bus change (deferred for any registered-but-not-yet-ready panel).
     2. Inbound  — accept KCM_STATE_PATCH from iframes; call KCM.bus.set().
     3. Security — validate event.origin against ALLOWED_ORIGINS before
        accepting any inbound message.
     4. Registration — KCM.bridge.register(iframeEl) / unregister(iframeEl).
     5. Readiness    — KCM_PANEL_READY handshake gates first delivery.

   Message envelope (locked in Session 3, do not drift):
     Console → iframe : { type: 'KCM_STATE',       payload: {root,mode,scale,activeNotes:[...]} }
     iframe → Console : { type: 'KCM_STATE_PATCH',  payload: {root?,mode?,scale?,activeNotes?:[...]} }
     iframe → Console : { type: 'KCM_PANEL_READY',  panel: <string> }

   Note: activeNotes is always serialised as Array (Sets are not
   JSON-serialisable) and deserialised back to Set on receipt.

   ─────────────────────────────────────────────────────────────────────────
   ORIGIN ALLOWLIST
   ─────────────────────────────────────────────────────────────────────────
   DEV_ORIGINS are included for local development convenience.
   REMOVE OR COMMENT OUT DEV_ORIGINS before any production hardening pass.
   Session 10 (auth gate) is the scheduled cleanup point.
   ───────────────────────────────────────────────────────────────────────── */

(function () {
  'use strict';

  // ── Origin allowlist ─────────────────────────────────────────────────
  var PROD_ORIGINS = [
    'https://keyscodesandmodes.com',
    'https://console.keyscodesandmodes.com'
  ];

  // DEV only — strip at Session 10. ──────────────────────────────────────
  var DEV_ORIGINS = [
    'http://localhost',
    'http://localhost:3000',
    'http://localhost:8080',
    'http://127.0.0.1',
    'http://127.0.0.1:3000',
    'http://127.0.0.1:8080',
    'null'   // srcdoc iframes report origin as string 'null' — dev harness only
  ];
  // ──────────────────────────────────────────────────────────────────────

  var ALLOWED_ORIGINS = PROD_ORIGINS.concat(DEV_ORIGINS);

  function isAllowedOrigin(origin) {
    return ALLOWED_ORIGINS.indexOf(origin) !== -1;
  }

  // ── Registered iframe set ────────────────────────────────────────────
  var iframes = new Set();

  // ── Panel-readiness tracking (Claim B-4) ─────────────────────────────
  // An iframe is "registered" the moment its element exists in the DOM
  // (register() below), but it isn't safe to postMessage state to it
  // until ITS OWN message listener has actually mounted — otherwise the
  // KCM_STATE message is sent into the void before the panel can hear it.
  // Panels announce { type:'KCM_PANEL_READY', panel:<name> } once their
  // listener is live. readyPanels holds the iframe elements we've heard
  // from. fallbackTimers holds a per-iframe safety-net timeout in case an
  // older/third-party panel never sends KCM_PANEL_READY at all.
  var readyPanels   = new Set();
  var fallbackTimers = new Map();
  var FALLBACK_MS = 2000;

  function markReady(iframeEl) {
    if (!iframeEl || readyPanels.has(iframeEl)) return;
    readyPanels.add(iframeEl);
    var t = fallbackTimers.get(iframeEl);
    if (t) { clearTimeout(t); fallbackTimers.delete(iframeEl); }
    // Catch the panel up to current state the moment it's actually ready.
    if (window.KCM && window.KCM.bus) {
      try {
        iframeEl.contentWindow.postMessage(
          { type: 'KCM_STATE', payload: serialiseState(window.KCM.bus.get()) },
          '*'
        );
      } catch (e) { /* ignore */ }
    }
  }

  // ── Serialise state for postMessage ──────────────────────────────────
  // activeNotes (Set<midi>) → sorted Array so JSON.stringify works.
  function serialiseState(state) {
    return {
      root:        state.root,
      mode:        state.mode,
      scale:       state.scale.slice(),
      activeNotes: Array.from(state.activeNotes).sort(function (a, b) { return a - b; })
    };
  }

  // ── Deserialise inbound patch ────────────────────────────────────────
  // Converts activeNotes array back to Set if present.
  function deserialisePatch(payload) {
    var patch = {};
    if (payload.root  !== undefined) patch.root  = payload.root;
    if (payload.mode  !== undefined) patch.mode  = payload.mode;
    if (payload.scale !== undefined) patch.scale = payload.scale.slice();
    if (payload.activeNotes !== undefined) {
      patch.activeNotes = new Set(payload.activeNotes);
    }
    return patch;
  }

  // ── Broadcast to all registered iframes ─────────────────────────────
  // Only panels that have confirmed readiness receive the live broadcast.
  // A registered-but-not-yet-ready panel is caught up automatically by
  // markReady() the instant its KCM_PANEL_READY arrives, so no message
  // is ever lost — it's just deferred rather than fired into the void.
  function broadcast(state) {
    var msg = { type: 'KCM_STATE', payload: serialiseState(state) };
    readyPanels.forEach(function (iframe) {
      try {
        if (iframe.contentWindow) {
          iframe.contentWindow.postMessage(msg, '*');
        }
      } catch (err) {
        console.warn('[KCM.bridge] postMessage failed for iframe:', iframe, err);
      }
    });
  }

  // ── Inbound message handler ──────────────────────────────────────────
  function onMessage(ev) {
    if (!isAllowedOrigin(ev.origin)) {
      // Silent drop — don't log in production to avoid console noise from
      // browser extensions and third-party iframes.
      return;
    }
    var data = ev.data;
    if (!data) return;

    // ── Panel readiness handshake (Claim B-4) ────────────────────────
    if (data.type === 'KCM_PANEL_READY') {
      var sourceIframe = null;
      iframes.forEach(function (ifr) {
        if (ifr.contentWindow === ev.source) sourceIframe = ifr;
      });
      if (!sourceIframe) {
        var allIframes = document.querySelectorAll('iframe');
        for (var i = 0; i < allIframes.length; i++) {
          if (allIframes[i].contentWindow === ev.source) { sourceIframe = allIframes[i]; break; }
        }
        if (sourceIframe) {
          iframes.add(sourceIframe);
          console.log('[KCM.bridge] auto-registered on early readiness ping:', data.panel || '(unnamed)');
        }
      }
      if (sourceIframe) {
        markReady(sourceIframe);
        console.log('[KCM.bridge] panel ready:', data.panel || '(unnamed)');
      } else {
        console.warn('[KCM.bridge] KCM_PANEL_READY from a source not found in any iframe on the page:', data.panel || '(unnamed)');
      }
      return;
    }

    // ── Clock control messages from panels ───────────────────────────
    if (data.type === 'KCM_CLOCK_START') {
      var p = data.payload || {};
      startClock(p.modeKey, p.root, p.beatMs);
      return;
    }
    if (data.type === 'KCM_CLOCK_STOP') {
      stopClock();
      return;
    }

    if (data.type !== 'KCM_STATE_PATCH') return;
    if (!data.payload || typeof data.payload !== 'object') return;

    try {
      var patch = deserialisePatch(data.payload);
      if (window.KCM && window.KCM.bus) {
        window.KCM.bus.set(patch);
        console.log('[KCM.bridge] inbound patch from ' + ev.origin + ':', patch);
      }
    } catch (err) {
      console.error('[KCM.bridge] error processing inbound patch:', err);
    }
  }

  window.addEventListener('message', onMessage);

  // ── Master Sync Clock ────────────────────────────────────────────────
  // Single setInterval drives ALL panels in perfect sync.
  // Broadcasts KCM_TICK to every registered iframe on each beat.
  // Panels listen for KCM_TICK and kill their own timers.
  var clockInterval  = null;
  var clockStep      = 0;
  var clockDirection = 1;
  var clockBeatMs    = 500;
  var clockRunning   = false;
  var clockModeKey   = null;
  var clockRoot      = 'C';

  var MIDI_BASE  = 60;
  var NOTE_NAMES = ['C','C#','D','D#','E','F','F#','G','G#','A','A#','B'];

  var CLOCK_MODES = {
    ionian:     [0,2,4,5,7,9,11,12],
    dorian:     [0,2,3,5,7,9,10,12],
    phrygian:   [0,1,3,5,7,8,10,12],
    lydian:     [0,2,4,6,7,9,11,12],
    mixolydian: [0,2,4,5,7,9,10,12],
    aeolian:    [0,2,3,5,7,8,10,12],
    locrian:    [0,1,3,5,6,8,10,12]
  };

  function broadcastTick() {
    if (!clockModeKey) return;
    var intervals = CLOCK_MODES[clockModeKey];
    if (!intervals) return;

    var stepCount = 8;
    if (clockStep >= stepCount) { clockDirection = -1; clockStep = stepCount - 2; }
    if (clockStep < 0)          { clockDirection =  1; clockStep = 1; }

    var rootIdx  = NOTE_NAMES.indexOf(clockRoot);
    var semis    = intervals[clockStep];
    var midiNote = MIDI_BASE + (rootIdx < 0 ? 0 : rootIdx) + semis;
    var notePC   = midiNote % 12;
    var noteName = NOTE_NAMES[notePC];

    var tick = {
      type: 'KCM_TICK',
      payload: {
        step: clockStep, direction: clockDirection,
        midiNote: midiNote, noteName: noteName, notePC: notePC,
        modeKey: clockModeKey, root: clockRoot,
        beatMs: clockBeatMs, ts: Date.now()
      }
    };

    iframes.forEach(function (iframe) {
      try { if (iframe.contentWindow) iframe.contentWindow.postMessage(tick, '*'); } catch(e) {}
    });

    clockStep += clockDirection;
  }

  function startClock(modeKey, root, beatMs) {
    clockModeKey   = modeKey  || clockModeKey;
    clockRoot      = root     || clockRoot;
    clockBeatMs    = beatMs   || clockBeatMs;
    clockStep      = 0;
    clockDirection = 1;
    clockRunning   = true;
    if (clockInterval) clearInterval(clockInterval);
    clockInterval  = setInterval(broadcastTick, clockBeatMs);
    console.log('[KCM.bridge] clock started — mode:', clockModeKey, 'root:', clockRoot, 'beatMs:', clockBeatMs);
  }

  function stopClock() {
    if (clockInterval) clearInterval(clockInterval);
    clockInterval = null;
    clockRunning  = false;
    clockStep     = 0;
    var msg = { type: 'KCM_TICK_STOP' };
    iframes.forEach(function (iframe) {
      try { if (iframe.contentWindow) iframe.contentWindow.postMessage(msg, '*'); } catch(e) {}
    });
    console.log('[KCM.bridge] clock stopped.');
  }

  // ── Public API ───────────────────────────────────────────────────────
  var bridge = {
    clockStart: function(modeKey, root, beatMs) { startClock(modeKey, root, beatMs); },
    clockStop:  function() { stopClock(); },
    clockRunning: function() { return clockRunning; },

    register: function (iframeEl) {
      if (!iframeEl || iframeEl.tagName !== 'IFRAME') {
        console.warn('[KCM.bridge] register() requires an <iframe> element.');
        return;
      }
      iframes.add(iframeEl);
      // Don't fire KCM_STATE yet — the panel's own message listener may
      // not be mounted yet, and the message would be lost (the original
      // v0.3 behavior). Wait for the panel's KCM_PANEL_READY handshake;
      // markReady() sends the catch-up state the instant it arrives.
      // Fallback: if a panel never announces readiness (older panel,
      // load error, etc.), send anyway after FALLBACK_MS so it isn't
      // stranded forever.
      var fallback = setTimeout(function () {
        fallbackTimers.delete(iframeEl);
        if (readyPanels.has(iframeEl)) return; // already caught up properly
        console.warn('[KCM.bridge] no KCM_PANEL_READY received — falling back to immediate send.');
        markReady(iframeEl);
      }, FALLBACK_MS);
      fallbackTimers.set(iframeEl, fallback);
      console.log('[KCM.bridge] iframe registered. Total:', iframes.size);
    },

    unregister: function (iframeEl) {
      iframes.delete(iframeEl);
      readyPanels.delete(iframeEl);
      var t = fallbackTimers.get(iframeEl);
      if (t) { clearTimeout(t); fallbackTimers.delete(iframeEl); }
      console.log('[KCM.bridge] iframe unregistered. Total:', iframes.size);
    },

    registeredCount: function () { return iframes.size; },
    readyCount:      function () { return readyPanels.size; },

    allowedOrigins: function () { return ALLOWED_ORIGINS.slice(); }
  };

  // ── Subscribe bridge to bus ──────────────────────────────────────────
  // Every bus state change triggers a broadcast to all registered iframes.
  // Guard: bus must exist (console.js loads first via <script> order).
  if (window.KCM && window.KCM.bus) {
    window.KCM.bus.subscribe(function (state) {
      if (iframes.size > 0) broadcast(state);
    });
  } else {
    console.error('[KCM.bridge] KCM.bus not found — load console.js before bridge.js.');
  }

  // ── Panel registration (Session 4+) ─────────────────────────────────
  // Registers real app iframes with the bridge on load.
  // Wires minimize toggle on panel header buttons.
  function initPanels() {
    // Music Theory Pro (Classic)
    var mtpIframe = document.getElementById('iframe-mtp');
    if (mtpIframe) {
      mtpIframe.addEventListener('load', function () {
        bridge.register(mtpIframe);
        console.log('[KCM.bridge] Music Theory Pro panel registered.');
      });
    }

    // Circle of Fifths
    var cofIframe = document.getElementById('iframe-cof');
    if (cofIframe) {
      cofIframe.addEventListener('load', function () {
        bridge.register(cofIframe);
        console.log('[KCM.bridge] Circle of Fifths panel registered.');
      });
    }

    // Modal Stencil Player
    var mspIframe = document.getElementById('iframe-msp');
    if (mspIframe) {
      mspIframe.addEventListener('load', function () {
        bridge.register(mspIframe);
        console.log('[KCM.bridge] Modal Stencil Player panel registered.');
      });
    }

    // Chromatic Universe (was missing — panel sent KCM_PANEL_READY into
    // the void with no registration to catch it; see Claim B-4 fix)
    var cuIframe = document.getElementById('iframe-cu');
    if (cuIframe) {
      cuIframe.addEventListener('load', function () {
        bridge.register(cuIframe);
        console.log('[KCM.bridge] Chromatic Universe panel registered.');
      });
    }

    // Modal Neck (Panel 5 — added after initPanels() was last touched)
    var neckIframe = document.getElementById('iframe-neck');
    if (neckIframe) {
      neckIframe.addEventListener('load', function () {
        bridge.register(neckIframe);
        console.log('[KCM.bridge] Modal Neck panel registered.');
      });
    }

    // ── Save .gcis button ──────────────────────────────────────────────
    var saveBtn = document.getElementById('kcm-save');
    if (saveBtn) {
      saveBtn.addEventListener('click', function () {
        if (!window.KCM || !window.KCM.bus || !window.KCM.gcis) {
          alert('KCM not fully loaded — try again in a moment.'); return;
        }
        var titleEl  = document.getElementById('kcm-session-title');
        var title    = titleEl ? titleEl.value.trim() || 'KCM Session' : 'KCM Session';
        var filename = window.KCM.gcis.saveToDisk(window.KCM.bus.get(), {
          title: title, author: 'Benjamin Ryan'
        });
        saveBtn.textContent = '✓ Saved!';
        saveBtn.classList.add('kcm-gcis-btn--flash');
        setTimeout(function () {
          saveBtn.textContent = '⬇ Save .gcis';
          saveBtn.classList.remove('kcm-gcis-btn--flash');
        }, 2000);
      });
    }

    // ── Load .gcis button ──────────────────────────────────────────────
    var loadBtn = document.getElementById('kcm-load');
    if (loadBtn) {
      loadBtn.addEventListener('click', function () {
        if (!window.KCM || !window.KCM.bus || !window.KCM.gcis) {
          alert('KCM not fully loaded — try again in a moment.'); return;
        }
        window.KCM.gcis.loadFromDisk(
          function (result) {
            window.KCM.bus.set(result.state);
            var titleEl = document.getElementById('kcm-session-title');
            if (titleEl && result.meta.title) titleEl.value = result.meta.title;
            loadBtn.textContent = '✓ ' + result.meta.title;
            loadBtn.classList.add('kcm-gcis-btn--flash-gold');
            setTimeout(function () {
              loadBtn.textContent = '⬆ Load .gcis';
              loadBtn.classList.remove('kcm-gcis-btn--flash-gold');
            }, 3000);
          },
          function (err) { alert('Could not load .gcis: ' + err); }
        );
      });
    }

    // ── Stop All button ──────────────────────────────────────────────
    var stopBtn = document.getElementById('kcm-stop-all');
    if (stopBtn) {
      stopBtn.addEventListener('click', function () {
        stopClock();
        var msg = { type: 'KCM_STOP' };
        iframes.forEach(function (iframe) {
          try {
            if (iframe.contentWindow) iframe.contentWindow.postMessage(msg, '*');
          } catch (e) { /* silent */ }
        });
        console.log('[KCM.bridge] KCM_STOP + clock stop broadcast to', iframes.size, 'panels.');
      });
    }
    document.querySelectorAll('[data-panel-action="minimize"]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var panel = btn.closest('.kcm-panel');
        if (!panel) return;
        var minimized = panel.classList.toggle('is-minimized');
        btn.textContent = minimized ? '+' : '−';
        btn.setAttribute('aria-label', minimized ? 'Restore panel' : 'Minimize panel');
      });
    });
  }

  // ── Bridge-test harness (gated by ?bridge-test=1) ───────────────────
  function isBridgeTestMode() {
    try {
      return new URLSearchParams(window.location.search).get('bridge-test') === '1';
    } catch (e) { return false; }
  }

  function mountBridgeTestHarness() {
    if (!isBridgeTestMode()) {
      // Hide the panel entirely so it takes no space in normal use.
      var panel = document.getElementById('bridge-test-panel');
      if (panel) panel.style.display = 'none';
      return;
    }

    document.body.classList.add('bridge-test-mode');

    var iframe = document.getElementById('bridge-test-iframe');
    var diag   = document.getElementById('bridge-diag');

    if (!iframe || !diag) return;

    // Auto-register the stub iframe on load.
    iframe.addEventListener('load', function () {
      bridge.register(iframe);
      updateDiag();
    });

    function updateDiag() {
      diag.textContent = [
        'registered iframes : ' + bridge.registeredCount(),
        'ready iframes      : ' + bridge.readyCount(),
        'allowed origins    : ' + bridge.allowedOrigins().length,
        '',
        bridge.allowedOrigins().join('\n')
      ].join('\n');
    }

    // Wire diagnostic buttons.
    var btnContainer = document.querySelector('.kcm-bridge-test [data-bridge-action]');
    var testPanel    = document.getElementById('bridge-test-panel');
    if (testPanel) {
      testPanel.addEventListener('click', function (ev) {
        var btn = ev.target.closest('[data-bridge-action]');
        if (!btn) return;
        var action = btn.dataset.bridgeAction;
        switch (action) {
          case 'register':
            bridge.register(iframe);
            break;
          case 'unregister':
            bridge.unregister(iframe);
            break;
          case 'origins':
            console.log('[KCM.bridge] allowed origins:', bridge.allowedOrigins());
            break;
          case 'count':
            console.log('[KCM.bridge] registered iframes:', bridge.registeredCount());
            break;
        }
        updateDiag();
      });
    }

    updateDiag();
    console.log('[KCM.bridge] Bridge-test harness mounted (URL has ?bridge-test=1).');
  }

  // ── Init ─────────────────────────────────────────────────────────────
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () {
      initPanels();
      mountBridgeTestHarness();
    });
  } else {
    initPanels();
    mountBridgeTestHarness();
  }


  window.KCM = window.KCM || {};
  window.KCM.bridge = bridge;

  console.log('[KCM.bridge] v0.4.1 ready. Allowed origins:', ALLOWED_ORIGINS);
})();
