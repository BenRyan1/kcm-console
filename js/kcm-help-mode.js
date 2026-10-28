/* KCM Help Mode v2 (Keys, Codes & Modes), Console edition. Oct 27 2026.
   v2 adds panel sync: the Console shell owns the one Help button and tells every embedded
   panel (same-origin iframes) to switch on or off. A panel never shows its own button. Pressing ?
   inside a panel also toggles Help and the shell relays it to the other panels.
   v1 notes follow.
   Press ? (or tap the ? button) to turn Help Mode on. While it is on, hovering or tapping
   a control shows a help cloud instead of using the control. Press ? or Esc to leave.
   Text lives in js/kcm-help-text.js (window.KCM_HELP). Stores nothing in the browser. */
(function () {
  'use strict';
  if (window.KCMHelp) return;

  var TARGET = 'button, select, input, textarea, summary, [role="button"], [data-help], .sphere, .white-key, .black-key';
  /* A page's text file may add its own clickable things: KCM_HELP.targets = 'selector, selector' */
  function allTargets() { var x = window.KCM_HELP && window.KCM_HELP.targets; return x ? TARGET + ', ' + x : TARGET; }
  var S = { voice: false, vbtn: null, spoke: { el: null, t: 0 }, on: false, cloud: null, btn: null, live: null, cur: null, pinned: false };
  var EMBED = false;
  try { EMBED = !!window.parent && window.parent !== window; } catch (e) { EMBED = false; }
  var ORIGIN = location.origin;
  function post(msg) { try { if (EMBED) window.parent.postMessage(msg, ORIGIN); } catch (e) {} }
  function broadcast(on) {
    Array.prototype.forEach.call(document.querySelectorAll('iframe'), function (f) {
      try { f.contentWindow.postMessage({ type: 'KCM_HELP_SET', on: !!on }, ORIGIN); } catch (e) {}
    });
  }

  /* ---------- text lookup ---------- */
  function clean(s) { return (s || '').replace(/\s+/g, ' ').trim(); }

  function lookup(el) {
    var d = el.getAttribute('data-help');
    if (d) return { n: el.getAttribute('data-help-name') || clean(el.textContent), t: d };
    var H = window.KCM_HELP || {};
    if (el.id && H.ids && H.ids[el.id]) return H.ids[el.id];
    var rules = H.rules || [];
    for (var i = 0; i < rules.length; i++) {
      var r = rules[i];
      try {
        if (!el.matches(r.sel)) continue;
        if (r.x && !new RegExp(r.x).test(clean(el.textContent))) continue;
        if (r.own) return { n: clean(el.innerText || el.textContent), t: r.t, m: r.m };
        return r;
      } catch (e) { /* bad selector in data file: skip it */ }
    }
    var ti = el.getAttribute('title');
    if (ti) return { n: clean(el.textContent), t: ti, fallback: true };
    var al = el.getAttribute('aria-label');
    if (al) return { n: al, t: al, fallback: true };
    return null;
  }

  function targetOf(node) {
    if (!node || !node.closest) return null;
    if (node.closest('#kcmHelpBtn, #kcmHelpCloud')) return null;
    var t = node.closest(allTargets());
    if (t) return t;
    /* Big invisible tap areas (SVG ellipses) sit on top of dots. Help for them = the dot beside them. */
    if (node.tagName && node.tagName.toLowerCase() === 'ellipse' && node.getAttribute('aria-hidden') === 'true') {
      var p = node.previousElementSibling, n = node.nextElementSibling;
      if (p && p.matches && p.matches('[role="button"]')) return p;
      if (n && n.matches && n.matches('[role="button"]')) return n;
    }
    return null;
  }

  /* ---------- cloud ---------- */
  function build() {
    var css = document.createElement('style');
    css.textContent =
      '#kcmHelpBtn{position:fixed;left:14px;bottom:14px;z-index:100001;min-width:44px;height:44px;padding:0 14px;' +
      'border-radius:22px;border:2px solid rgba(255,210,74,.9);background:#12122a;color:#ffd24a;font:800 20px/1 var(--font-display,system-ui),sans-serif;' +
      'cursor:pointer;box-shadow:0 4px 18px rgba(0,0,0,.6);touch-action:manipulation}' +
      '#kcmHelpBtn:hover{background:#1d1d40}' +
      '#kcmHelpBtn.inline{position:static;display:inline-block;left:auto;bottom:auto;font-size:15px;letter-spacing:.3px}' +
      '#kcmHelpBtn.inline.float{position:fixed;left:14px;bottom:14px}' +
      '#kcmHelpBtn.on{background:#ffd24a;color:#12122a;font-size:14px;letter-spacing:.3px}' +
      '#kcmVoiceBtn{display:none;margin-left:8px;min-width:44px;height:44px;padding:0 14px;border-radius:22px;border:2px solid rgba(255,210,74,.9);background:#12122a;color:#ffd24a;font:700 14px/1 system-ui,sans-serif;cursor:pointer;touch-action:manipulation;vertical-align:top}' +
      '#kcmVoiceBtn.show{display:inline-block}#kcmVoiceBtn.on{background:#ffd24a;color:#12122a}' +
      '#kcmHelpCloud{position:fixed;z-index:100000;max-width:300px;padding:12px 15px;border-radius:16px;' +
      'background:linear-gradient(135deg,#1a1a2e,#0a0a15);border:2px solid #ffd24a;color:#f0f0ff;' +
      'font:500 14px/1.5 var(--font-body,system-ui),sans-serif;text-align:left;box-shadow:0 10px 32px rgba(0,0,0,.75);' +
      'pointer-events:none;opacity:0;transition:opacity .12s}' +
      '#kcmHelpCloud.show{opacity:1}' +
      '#kcmHelpCloud .kh-n{font-weight:800;color:#ffd24a;margin-bottom:3px}' +
      '#kcmHelpCloud .kh-m{margin-top:6px;padding-top:6px;border-top:1px solid rgba(255,255,255,.18);color:#bfe9e9;font-size:13px}' +
      '#kcmHelpCloud::after{content:"";position:absolute;left:var(--kh-ax,50%);transform:translateX(-50%);border:9px solid transparent}' +
      '#kcmHelpCloud.up::after{top:100%;border-top-color:#ffd24a}' +
      '#kcmHelpCloud.down::after{bottom:100%;border-bottom-color:#ffd24a}' +
      '.kcm-help-target{outline:2px dashed #ffd24a!important;outline-offset:2px!important}' +
      'body.kcm-help-on .kcm-tooltip{display:none!important}' +
      '#kcmHelpLive{position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0);white-space:nowrap}' +
      '@media print{#kcmHelpBtn,#kcmVoiceBtn,#kcmHelpCloud{display:none!important}}';
    document.head.appendChild(css);

    var c = document.createElement('div');
    c.id = 'kcmHelpCloud';
    c.setAttribute('role', 'tooltip');
    c.innerHTML = '<div class="kh-n"></div><div class="kh-t"></div><div class="kh-m" hidden></div>';
    document.body.appendChild(c);
    S.cloud = c;

    var l = document.createElement('div');
    l.id = 'kcmHelpLive';
    l.setAttribute('aria-live', 'polite');
    document.body.appendChild(l);
    S.live = l;

    if (EMBED) return; /* panels have no button: the Console header button controls them */
    var b = document.createElement('button');
    b.id = 'kcmHelpBtn';
    b.type = 'button';
    b.setAttribute('aria-pressed', 'false');
    b.title = 'Help Mode: touch to turn on, touch again to turn off. While on, hover or touch any control to see what it does. Controls still work. (shortcut: ?)';
    b.textContent = '?';
    b.addEventListener('click', function () { toggle(); });
    var mount = document.getElementById('kcmHelpMount');
    S.inline = !!mount;
    if (mount) {
      b.classList.add('inline'); b.textContent = '? Help Mode';
      mount.appendChild(b);
      mount.style.minHeight = b.offsetHeight + 'px';
      /* Stays right where it is. Only if you scroll it out of sight while Help is on does a copy
         float at the bottom left, so there is always a way to switch it off. */
      if (window.IntersectionObserver) {
        new IntersectionObserver(function (en) {
          S.btn.classList.toggle('float', S.on && !en[0].isIntersecting);
        }).observe(mount);
      }
    } else document.body.appendChild(b);
    S.btn = b;
    if (CAN_SPEAK) {
      var v = document.createElement('button');
      v.id = 'kcmVoiceBtn'; v.type = 'button';
      v.title = 'Read aloud: speaks each help cloud with your device voice. Touch to turn on or off.';
      v.setAttribute('aria-pressed', 'false'); v.textContent = 'Read aloud: OFF';
      v.addEventListener('click', function () { setVoice(!S.voice); });
      if (mount) mount.appendChild(v); else document.body.appendChild(v);
      S.vbtn = v;
    }
  }

  function place(el) {
    var c = S.cloud, r = el.getBoundingClientRect();
    var w = c.offsetWidth, h = c.offsetHeight;
    var left = r.left + r.width / 2 - w / 2;
    left = Math.max(8, Math.min(left, window.innerWidth - w - 8));
    var up = r.top - h - 16 >= 8;
    var top = up ? r.top - h - 16 : Math.min(r.bottom + 16, window.innerHeight - h - 8);
    c.className = (c.classList.contains('show') ? 'show ' : '') + (up ? 'up' : 'down');
    c.style.left = left + 'px';
    c.style.top = top + 'px';
    var ax = Math.max(18, Math.min(r.left + r.width / 2 - left, w - 18));
    c.style.setProperty('--kh-ax', ax + 'px');
  }

  /* ---------- optional read aloud (device voice, off by default, nothing stored) ---------- */
  var CAN_SPEAK = !!(window.speechSynthesis && window.SpeechSynthesisUtterance);
  function stopSpeech() { try { if (CAN_SPEAK) window.speechSynthesis.cancel(); } catch (e) {} }
  function speak(el, text) {
    if (!S.voice || !CAN_SPEAK) return;
    var now = Date.now();
    if (S.spoke.el === el && now - S.spoke.t < 900) return; /* press then focus fire close together */
    S.spoke.el = el; S.spoke.t = now;
    try {
      window.speechSynthesis.cancel();
      var u = new SpeechSynthesisUtterance(text);
      u.lang = document.documentElement.lang || 'en-US';
      window.speechSynthesis.speak(u);
    } catch (e) {}
  }
  function setVoice(on, fromSync) {
    S.voice = !!on;
    if (S.vbtn) {
      S.vbtn.classList.toggle('on', S.voice);
      S.vbtn.setAttribute('aria-pressed', S.voice ? 'true' : 'false');
      S.vbtn.textContent = S.voice ? 'Read aloud: ON' : 'Read aloud: OFF';
    }
    if (!S.voice) stopSpeech();
    if (!fromSync) { post({ type: 'KCM_HELP_VOICE_USER', on: S.voice }); broadcastVoice(S.voice); }
  }

  function show(el, pin) {
    var info = lookup(el);
    clearTarget();
    if (!info) { hide(); return; }
    S.cur = el; S.pinned = !!pin;
    clearTimeout(S.timer);
    if (pin) S.timer = setTimeout(function () { if (S.cur === el) hide(); }, 5000);
    el.classList.add('kcm-help-target');
    var c = S.cloud;
    c.querySelector('.kh-n').textContent = info.n || clean(el.textContent) || 'Control';
    c.querySelector('.kh-t').textContent = info.t || '';
    var m = c.querySelector('.kh-m');
    m.hidden = !info.m; m.textContent = info.m || '';
    c.classList.add('show');
    place(el);
    speak(el, (info.n || '') + '. ' + (info.t || ''));
    S.live.textContent = (info.n || '') + '. ' + (info.t || '');
  }

  function clearTarget() {
    if (S.cur) S.cur.classList.remove('kcm-help-target');
    document.querySelectorAll('.kcm-help-target').forEach(function (n) { n.classList.remove('kcm-help-target'); });
  }

  function hide() {
    clearTimeout(S.timer);
    clearTarget();
    S.cur = null; S.pinned = false;
    if (S.cloud) S.cloud.classList.remove('show');
    stopSpeech();
  }

  /* ---------- on / off ---------- */
  function set(on, fromSync) {
    S.on = !!on;
    document.body.classList.toggle('kcm-help-on', S.on);
    if (S.btn) { S.btn.classList.toggle('on', S.on);
    S.btn.setAttribute('aria-pressed', S.on ? 'true' : 'false'); }
    if (S.btn) S.btn.textContent = S.on ? 'Help ON \u2022 touch again to turn off' : (S.inline ? '? Help Mode' : '?');
    if (S.vbtn) S.vbtn.classList.toggle('show', S.on);
    if (!S.on) { hide(); if (S.btn) S.btn.classList.remove('float'); }
    else if (S.inline && S.btn) { var mr = document.getElementById('kcmHelpMount').getBoundingClientRect(); S.btn.classList.toggle('float', mr.bottom < 0 || mr.top > window.innerHeight); }
    if (!fromSync) { post({ type: 'KCM_HELP_USER', on: S.on }); broadcast(S.on); }
    if (S.live) S.live.textContent = S.on ? 'Help Mode on. Hover or touch any control to hear what it does. Controls still work. Press the Help button again, question mark or Escape to turn it off.' : 'Help Mode off.';
  }
  function broadcastVoice(on) {
    Array.prototype.forEach.call(document.querySelectorAll('iframe'), function (f) {
      try { f.contentWindow.postMessage({ type: 'KCM_HELP_VOICE', on: !!on }, ORIGIN); } catch (e) {}
    });
  }
  function toggle() { set(!S.on); }

  /* ---------- panel sync (same-origin messages only) ---------- */
  window.addEventListener('message', function (e) {
    if (e.origin !== ORIGIN) return;
    var d = e.data;
    if (!d || typeof d !== 'object') return;
    if (d.type === 'KCM_HELP_VOICE' && EMBED) setVoice(!!d.on, true);
    else if (d.type === 'KCM_HELP_VOICE_USER' && !EMBED) { setVoice(!!d.on, true); broadcastVoice(!!d.on); }
    else if (d.type === 'KCM_HELP_SET' && EMBED) set(!!d.on, true);
    else if (d.type === 'KCM_HELP_USER' && !EMBED) { set(!!d.on, true); broadcast(!!d.on); }
    else if (d.type === 'KCM_HELP_READY' && !EMBED && e.source) {
      try { e.source.postMessage({ type: 'KCM_HELP_SET', on: S.on }, ORIGIN); e.source.postMessage({ type: 'KCM_HELP_VOICE', on: S.voice }, ORIGIN); } catch (x) {}
    }
  });

  function typing(e) {
    var t = e.target, tag = t && t.tagName;
    return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || (t && t.isContentEditable);
  }

  /* ---------- events (capture phase, registered early so Help Mode sees them first) ---------- */
  function swallow(e) { e.preventDefault(); e.stopPropagation(); }
  var opt = { capture: true, passive: false };

  document.addEventListener('keydown', function (e) {
    if ((e.key === '?' || (e.key === '/' && e.shiftKey && e.code === 'Slash')) && !e.ctrlKey && !e.metaKey && !e.altKey && !typing(e)) { swallow(e); toggle(); return; }
    if (!S.on) return;
    if (e.key === 'Escape') { swallow(e); set(false); return; }
  }, opt);

  ['pointerdown'].forEach(function (type) {
    document.addEventListener(type, function (e) {
      if (!S.on) return;
      if (e.target.closest && e.target.closest('#kcmHelpBtn')) return;
      var t = targetOf(e.target);
      if (t) {
        show(t, e.pointerType !== 'mouse'); /* the control still gets its click */
        setTimeout(function () { if (S.cur && !S.cur.isConnected) hide(); }, 450);
      } else { hide(); }
    }, opt);
  });

  document.addEventListener('mouseover', function (e) {
    if (!S.on) return;
    var t = targetOf(e.target);
    if (t && t !== S.cur) show(t, false);
  });
  document.addEventListener('mouseout', function (e) {
    if (!S.on || S.pinned) return;
    var t = targetOf(e.target);
    if (t && t === S.cur && !t.contains(e.relatedTarget)) hide();
  });
  document.addEventListener('focusin', function (e) {
    if (!S.on) return;
    var t = targetOf(e.target);
    if (t) show(t, true);
  });
  function reflow() {
    if (!S.on || !S.cur) return;
    if (!S.cur.isConnected) { hide(); return; }
    place(S.cur);
  }
  window.addEventListener('scroll', reflow, true);
  window.addEventListener('resize', reflow);

  /* ---------- coverage check: KCMHelp.audit() in the browser console ---------- */
  function describe(el) {
    var s = el.tagName.toLowerCase();
    if (el.id) s += '#' + el.id;
    if (el.className && typeof el.className === 'string') s += '.' + el.className.trim().split(/\s+/).join('.');
    Array.prototype.forEach.call(el.attributes, function (a) { if (a.name.indexOf('data-') === 0) s += '[' + a.name + '="' + a.value + '"]'; });
    return s;
  }
  function audit() {
    var missing = [], fallback = [], ok = 0;
    document.querySelectorAll(allTargets()).forEach(function (el) {
      if (el.closest('#kcmHelpBtn, #kcmHelpCloud')) return;
      if (!el.getClientRects().length) return; // hidden controls do not need help text
      var i = lookup(el);
      if (!i) missing.push({ control: describe(el), label: clean(el.textContent).slice(0, 40) });
      else if (i.fallback) fallback.push({ control: describe(el), label: clean(el.textContent).slice(0, 40), using: 'title/aria-label' });
      else ok++;
    });
    console.log('KCM Help coverage: ' + ok + ' with written help, ' + fallback.length + ' using title only, ' + missing.length + ' with nothing.');
    if (missing.length) { console.log('NO HELP TEXT:'); console.table(missing); }
    if (fallback.length) { console.log('TITLE ONLY:'); console.table(fallback); }
    return { ok: ok, titleOnly: fallback, missing: missing };
  }

  window.KCMHelp = { on: function () { set(true); }, off: function () { set(false); }, toggle: toggle, audit: audit, lookup: lookup };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', build);
  else build();
  post({ type: 'KCM_HELP_READY' });
})();
