/* ═══════════════════════════════════════════════════════════════
   KCM Console — SUNO Prompt Generator Panel
   Session 11 · Updated 2026-05-01 — 4-panel build (v1.0)

   PANELS IN CONSOLE (4 total):
     Panel 1 — Music Theory Pro        (music-theory-pro.html)
     Panel 2 — Circle of Fifths        (circle-of-fifths.html)
     Panel 3 — Modal Stencil Player    (modal-stencil-player.html)
     Panel 4 — Chromatic Universe      (kcm-chromatic-universe.html)

   This panel sits BELOW all four. It:
     1. Subscribes to window.KCM.bus for live root/mode/scale changes
     2. Also listens to postMessage KCM_STATE (bridge fallback)
     3. Builds a template Suno prompt instantly — no API call
     4. "✨ Enhance" button calls Claude API for a richer version
     5. "⎘ Copy to Suno" copies prompt to clipboard
     6. "↺ Reset" returns to template after AI enhancement
     7. State badge always shows live root + mode from bus
     8. Source badge shows which panel last sent a change
═══════════════════════════════════════════════════════════════ */

(function () {
  'use strict';

  /* ── Mode descriptions ─────────────────────────────────────────── */
  const MODE_FEEL = {
    ionian:     'bright, uplifting, major key',
    dorian:     'minor with a soulful, jazz-inflected feel',
    phrygian:   'dark, exotic, Spanish or flamenco flavour',
    lydian:     'dreamy, floating, ethereal major',
    mixolydian: 'bluesy, rock-inflected dominant feel',
    aeolian:    'natural minor, melancholic and introspective',
    locrian:    'tense, dissonant, unstable',
  };

  const MODE_GENRE = {
    ionian:     'pop, folk, classical',
    dorian:     'jazz, soul, funk, blues',
    phrygian:   'flamenco, metal, Middle Eastern',
    lydian:     'film score, ambient, new age',
    mixolydian: 'rock, blues, country, jam band',
    aeolian:    'minor rock, indie, cinematic',
    locrian:    'avant-garde, experimental, horror soundtrack',
  };

  const MODE_INSTRUMENTS = {
    ionian:     'acoustic guitar, piano, strings',
    dorian:     'Rhodes piano, bass guitar, jazz drums',
    phrygian:   'nylon guitar, oud, hand percussion',
    lydian:     'synth pads, electric piano, reverb guitar',
    mixolydian: 'electric guitar, Hammond organ, drums',
    aeolian:    'electric guitar, cello, ambient synth',
    locrian:    'prepared piano, dissonant strings, electronics',
  };

  const MODE_BPM = {
    ionian:     '100–120',
    dorian:     '80–100',
    phrygian:   '90–110',
    lydian:     '70–90',
    mixolydian: '110–130',
    aeolian:    '70–95',
    locrian:    '60–80',
  };

  /* ── Panel name map (for source badge) ────────────────────────── */
  const PANEL_NAMES = {
    'music-theory-pro':     'Music Theory Pro',
    'circle-of-fifths':     'Circle of Fifths',
    'modal-stencil-player': 'Modal Stencil Player',
    'chromatic-universe':   'Chromatic Universe',
  };

  /* ── Live bus state ────────────────────────────────────────────── */
  let _state = {
    root:        'C',
    mode:        'ionian',
    scale:       [0,2,4,5,7,9,11],
    activeNotes: [],
    bpm:         null,
  };
  let _lastSource = null; // which panel last triggered a change

  /* ── Template prompt ───────────────────────────────────────────── */
  function buildTemplate(s) {
    const mode     = s.mode || 'ionian';
    const root     = s.root || 'C';
    const feel     = MODE_FEEL[mode]        || 'melodic';
    const genre    = MODE_GENRE[mode]       || 'instrumental';
    const instr    = MODE_INSTRUMENTS[mode] || 'piano, guitar';
    const bpm      = MODE_BPM[mode]         || '90–110';
    const modeName = mode.charAt(0).toUpperCase() + mode.slice(1);

    return `[Genre: ${genre}]
[Key: ${root} ${modeName}]
[Feel: ${feel}]
[Instruments: ${instr}]
[Tempo: ${bpm} BPM]
[Structure: intro, verse, chorus, bridge, outro]
[Mood: instrumental, expressive, no lyrics]

An evocative instrumental piece in ${root} ${modeName}. ${feel.charAt(0).toUpperCase() + feel.slice(1)} character throughout. Features ${instr}. No lyrics. No vocals.`;
  }

  /* ── Claude API enhanced prompt ────────────────────────────────── */
  async function enhanceWithClaude(s) {
    const mode     = s.mode || 'ionian';
    const root     = s.root || 'C';
    const modeName = mode.charAt(0).toUpperCase() + mode.slice(1);
    const feel     = MODE_FEEL[mode]  || 'melodic';
    const genre    = MODE_GENRE[mode] || 'instrumental';

    const userPrompt =
`You are an expert at writing Suno AI music generation prompts.

Given this harmonic state from the KCM Console (Keys, Codes & Modes™):
- Root note: ${root}
- Mode: ${modeName} (feel: ${feel})
- Suggested genre: ${genre}
- Active MIDI notes: ${s.activeNotes && s.activeNotes.length ? s.activeNotes.join(', ') : 'none set'}

Write a rich, evocative Suno prompt (max 130 words) that:
1. Captures the precise emotional character of ${root} ${modeName}
2. Specifies tempo range, key instruments, and production style
3. Uses vivid language that Suno responds well to
4. Includes structural tags like [intro], [verse], [chorus] if appropriate
5. Ends with: "No lyrics. Instrumental only."

Return ONLY the prompt text — no preamble, no explanation, no markdown.`;

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model:      'claude-sonnet-4-20250514',
        max_tokens: 350,
        messages:   [{ role: 'user', content: userPrompt }]
      })
    });

    const data = await response.json();
    if (data.content && data.content[0] && data.content[0].text) {
      return data.content[0].text.trim();
    }
    throw new Error('No content from Claude API');
  }

  /* ── Inject panel HTML ─────────────────────────────────────────── */
  function injectPanel() {
    const panel = document.createElement('section');
    panel.className = 'kcm-suno-panel';
    panel.id        = 'suno-panel';
    panel.setAttribute('aria-label', 'SUNO Prompt Generator');

    panel.innerHTML = `
<div class="kcm-suno__header">
  <div class="kcm-suno__title-row">
    <span class="kcm-suno__icon" aria-hidden="true">♪</span>
    <h3 class="kcm-suno__title">Suno Prompt Generator</h3>
    <span class="kcm-suno__state-badge" id="suno-state-badge">C · Ionian</span>
  </div>
  <div class="kcm-suno__meta-row">
    <p class="kcm-suno__sub">Synced to all 4 Console panels — updates live as you play</p>
    <span class="kcm-suno__source-badge" id="suno-source-badge" style="display:none"></span>
  </div>
</div>

<div class="kcm-suno__body">
  <div class="kcm-suno__prompt-wrap">
    <textarea
      class="kcm-suno__prompt"
      id="suno-prompt-text"
      readonly
      spellcheck="false"
      rows="8"
      aria-label="Generated Suno prompt — copy and paste into suno.com"
    ></textarea>
    <div class="kcm-suno__prompt-type" id="suno-prompt-type">Template</div>
  </div>

  <div class="kcm-suno__actions">
    <button class="kcm-suno__btn kcm-suno__btn--enhance"  id="suno-enhance-btn">
      ✨ Enhance with AI
    </button>
    <button class="kcm-suno__btn kcm-suno__btn--template" id="suno-template-btn">
      ↺ Reset Template
    </button>
    <button class="kcm-suno__btn kcm-suno__btn--copy"     id="suno-copy-btn">
      ⎘ Copy to Suno
    </button>
    <a
      class="kcm-suno__btn kcm-suno__btn--open"
      href="https://suno.com"
      target="_blank"
      rel="noopener noreferrer"
      aria-label="Open Suno in a new tab"
    >↗ Open Suno</a>
  </div>

  <div class="kcm-suno__how">
    <strong>How to use:</strong>
    1 · Choose root + mode in any of the 4 panels above &nbsp;
    2 · Prompt updates instantly &nbsp;
    3 · Hit <em>Enhance</em> for a richer AI version &nbsp;
    4 · <em>Copy</em> → paste into suno.com → Generate
  </div>

  <div class="kcm-suno__status" id="suno-status" aria-live="polite"></div>
</div>`;

    /* Insert after .kcm-panels, or fall back to end of <main> */
    const panelsSection = document.querySelector('.kcm-panels');
    if (panelsSection && panelsSection.parentNode) {
      panelsSection.parentNode.insertBefore(panel, panelsSection.nextSibling);
    } else {
      const main = document.querySelector('main') || document.body;
      main.appendChild(panel);
    }

    bindEvents();
    renderTemplate();
  }

  /* ── Render template into textarea ─────────────────────────────── */
  function renderTemplate() {
    const ta        = document.getElementById('suno-prompt-text');
    const badge     = document.getElementById('suno-state-badge');
    const typeBadge = document.getElementById('suno-prompt-type');
    if (!ta) return;

    ta.value           = buildTemplate(_state);
    typeBadge.textContent = 'Template';
    typeBadge.className   = 'kcm-suno__prompt-type';

    const m = _state.mode || 'ionian';
    if (badge) badge.textContent = `${_state.root} · ${m.charAt(0).toUpperCase() + m.slice(1)}`;
  }

  /* ── Update state + source badges ──────────────────────────────── */
  function updateBadges(source) {
    const stateBadge  = document.getElementById('suno-state-badge');
    const sourceBadge = document.getElementById('suno-source-badge');
    const m = _state.mode || 'ionian';

    if (stateBadge) {
      stateBadge.textContent = `${_state.root} · ${m.charAt(0).toUpperCase() + m.slice(1)}`;
    }
    if (sourceBadge && source) {
      const name = PANEL_NAMES[source] || source;
      sourceBadge.textContent = `↑ from ${name}`;
      sourceBadge.style.display = 'inline-block';
    }
  }

  /* ── Button events ──────────────────────────────────────────────── */
  function bindEvents() {

    /* Enhance */
    document.getElementById('suno-enhance-btn').addEventListener('click', async () => {
      const btn       = document.getElementById('suno-enhance-btn');
      const typeBadge = document.getElementById('suno-prompt-type');

      btn.disabled    = true;
      btn.textContent = '✨ Enhancing…';
      setStatus('Calling Claude AI — crafting your Suno prompt…', 'loading');

      try {
        const enhanced = await enhanceWithClaude(_state);
        document.getElementById('suno-prompt-text').value = enhanced;
        typeBadge.textContent = 'AI Enhanced';
        typeBadge.className   = 'kcm-suno__prompt-type kcm-suno__prompt-type--ai';
        setStatus('AI enhanced! Ready to copy → paste into Suno.', 'success');
      } catch (e) {
        setStatus('Enhancement failed — using template prompt.', 'error');
        renderTemplate();
      } finally {
        btn.disabled    = false;
        btn.textContent = '✨ Enhance with AI';
      }
    });

    /* Reset template */
    document.getElementById('suno-template-btn').addEventListener('click', () => {
      renderTemplate();
      setStatus('Reset to template prompt.', 'info');
    });

    /* Copy */
    document.getElementById('suno-copy-btn').addEventListener('click', async () => {
      const btn  = document.getElementById('suno-copy-btn');
      const text = document.getElementById('suno-prompt-text').value;
      try {
        await navigator.clipboard.writeText(text);
      } catch (e) {
        /* Fallback */
        const ta = document.getElementById('suno-prompt-text');
        ta.removeAttribute('readonly');
        ta.select();
        document.execCommand('copy');
        ta.setAttribute('readonly', true);
      }
      btn.textContent = '✓ Copied!';
      setStatus('Copied! Go to suno.com → paste → Generate.', 'success');
      setTimeout(() => { btn.textContent = '⎘ Copy to Suno'; }, 2500);
    });
  }

  /* ── Status helper ──────────────────────────────────────────────── */
  function setStatus(msg, type) {
    const el = document.getElementById('suno-status');
    if (!el) return;
    el.textContent  = msg;
    el.className    = `kcm-suno__status kcm-suno__status--${type}`;
    if (type !== 'loading') {
      setTimeout(() => {
        el.textContent = '';
        el.className   = 'kcm-suno__status';
      }, 4000);
    }
  }

  /* ── KCM.bus subscriber ─────────────────────────────────────────── */
  function mountBusListener() {
    const poll = setInterval(() => {
      if (window.KCM && window.KCM.bus) {
        clearInterval(poll);

        window.KCM.bus.subscribe(function (newState) {
          let changed = false;

          if (newState.root && newState.root !== _state.root) {
            _state.root = newState.root; changed = true;
          }
          if (newState.mode && newState.mode !== _state.mode) {
            _state.mode  = newState.mode;
            _state.scale = newState.scale || _state.scale;
            changed = true;
          }
          if (newState.scale)       _state.scale       = newState.scale;
          if (newState.activeNotes) _state.activeNotes = Array.from(newState.activeNotes || []);
          if (newState.bpm)         _state.bpm         = newState.bpm;

          updateBadges(null);

          /* Only re-render template when NOT in AI-enhanced mode */
          const typeBadge = document.getElementById('suno-prompt-type');
          if (changed && typeBadge && !typeBadge.classList.contains('kcm-suno__prompt-type--ai')) {
            renderTemplate();
          }
        });

        console.log('[KCM→SUNO] bus listener mounted. Watching all 4 panels.');
      }
    }, 100);
  }

  /* ── postMessage bridge fallback ────────────────────────────────── */
  /* Handles KCM_STATE messages relayed from any of the 4 iframes    */
  window.addEventListener('message', function (ev) {
    if (!ev.data) return;

    /* State update from any panel via bridge */
    if (ev.data.type === 'KCM_STATE' && ev.data.payload) {
      const p = ev.data.payload;
      let changed = false;

      if (p.root && p.root !== _state.root) { _state.root = p.root; changed = true; }
      if (p.mode && p.mode !== _state.mode) { _state.mode = p.mode; changed = true; }
      if (p.scale)       _state.scale       = p.scale;
      if (p.activeNotes) _state.activeNotes = p.activeNotes;

      /* Try to identify source panel from origin or payload */
      const src = p._panelId || null;
      if (src) _lastSource = src;

      updateBadges(_lastSource);

      const typeBadge = document.getElementById('suno-prompt-type');
      if (changed && typeBadge && !typeBadge.classList.contains('kcm-suno__prompt-type--ai')) {
        renderTemplate();
      }
    }

    /* KCM_STATE_PATCH (panel → bus → re-broadcast) */
    if (ev.data.type === 'KCM_STATE_PATCH' && ev.data.payload) {
      const p = ev.data.payload;
      if (p.root) _state.root = p.root;
      if (p.mode) _state.mode = p.mode;
      if (p.scale) _state.scale = p.scale;
      updateBadges(null);
      const typeBadge = document.getElementById('suno-prompt-type');
      if (typeBadge && !typeBadge.classList.contains('kcm-suno__prompt-type--ai')) {
        renderTemplate();
      }
    }

    /* Stop All */
    if (ev.data.type === 'KCM_STOP') {
      setStatus('All panels stopped.', 'info');
    }
  });

  /* ── Boot ───────────────────────────────────────────────────────── */
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () {
      injectPanel();
      mountBusListener();
    });
  } else {
    injectPanel();
    mountBusListener();
  }

})();
