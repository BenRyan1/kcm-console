/* ─────────────────────────────────────────────────────────────────────────
   KCM CONSOLE — bridge.js  (v0.3.0)
   Session 3: iframe postMessage adapter.

   Responsibilities:
     1. Outbound — broadcast KCM_STATE to all registered iframes on every
        bus change.
     2. Inbound  — accept KCM_STATE_PATCH from iframes; call KCM.bus.set().
     3. Security — validate event.origin against ALLOWED_ORIGINS before
        accepting any inbound message.
     4. Registration — KCM.bridge.register(iframeEl) / unregister(iframeEl).

   Message envelope (locked in Session 3, do not drift):
     Console → iframe : { type: 'KCM_STATE',       payload: {root,mode,scale,activeNotes:[...]} }
     iframe → Console : { type: 'KCM_STATE_PATCH',  payload: {root?,mode?,scale?,activeNotes?:[...]} }

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
  function broadcast(state) {
    var msg = { type: 'KCM_STATE', payload: serialiseState(state) };
    iframes.forEach(function (iframe) {
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
    if (!data || data.type !== 'KCM_STATE_PATCH') return;
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

  // ── Public API ───────────────────────────────────────────────────────
  var bridge = {
    register: function (iframeEl) {
      if (!iframeEl || iframeEl.tagName !== 'IFRAME') {
        console.warn('[KCM.bridge] register() requires an <iframe> element.');
        return;
      }
      iframes.add(iframeEl);
      // Immediately send current state to the newly registered iframe.
      if (window.KCM && window.KCM.bus) {
        try {
          iframeEl.contentWindow.postMessage(
            { type: 'KCM_STATE', payload: serialiseState(window.KCM.bus.get()) },
            '*'
          );
        } catch (e) { /* iframe may not be loaded yet — bus subscriber will catch next change */ }
      }
      console.log('[KCM.bridge] iframe registered. Total:', iframes.size);
    },

    unregister: function (iframeEl) {
      iframes.delete(iframeEl);
      console.log('[KCM.bridge] iframe unregistered. Total:', iframes.size);
    },

    registeredCount: function () { return iframes.size; },

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

    // ── Stop All button ──────────────────────────────────────────────
    var stopBtn = document.getElementById('kcm-stop-all');
    if (stopBtn) {
      stopBtn.addEventListener('click', function () {
        var msg = { type: 'KCM_STOP' };
        iframes.forEach(function (iframe) {
          try {
            if (iframe.contentWindow) iframe.contentWindow.postMessage(msg, '*');
          } catch (e) { /* silent */ }
        });
        console.log('[KCM.bridge] KCM_STOP broadcast to', iframes.size, 'panels.');
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

  console.log('[KCM.bridge] v0.3.0 ready. Allowed origins:', ALLOWED_ORIGINS);
})();
