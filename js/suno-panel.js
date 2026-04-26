/* ═══════════════════════════════════════════════════════════════
   KCM Console — SUNO Prompt Generator Panel
   Session 11 · 2026-04-26
   
   Listens to KCM.bus for root/mode/scale/activeNotes changes.
   Generates a structured template prompt instantly.
   "✨ Enhance" button calls Claude API for a rich version.
   One-click Copy button sends to clipboard.
═══════════════════════════════════════════════════════════════ */

(function () {

  /* ── Mode descriptions for template prompt ── */
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

  /* ── Current bus state ── */
  let _state = {
    root: 'C',
    mode: 'ionian',
    scale: [0,2,4,5,7,9,11,12],
    activeNotes: [],
    bpm: null,
  };

  /* ── Template prompt generator ── */
  function buildTemplate(s) {
    const mode = s.mode || 'ionian';
    const root = s.root || 'C';
    const feel = MODE_FEEL[mode] || 'melodic';
    const genre = MODE_GENRE[mode] || 'instrumental';
    const instr = MODE_INSTRUMENTS[mode] || 'piano, guitar';
    const modeName = mode.charAt(0).toUpperCase() + mode.slice(1);
    const bpmLine = s.bpm ? `, ${s.bpm} BPM` : '';

    return `[Genre: ${genre}]
[Key: ${root} ${modeName}]
[Feel: ${feel}]
[Instruments: ${instr}]
[Structure: intro, verse, chorus, outro]
[Mood: instrumental, expressive${bpmLine}]

An evocative instrumental piece in ${root} ${modeName}. ${feel.charAt(0).toUpperCase() + feel.slice(1)} character throughout. Features ${instr}. No lyrics.`;
  }

  /* ── Claude API enhanced prompt ── */
  async function enhanceWithClaude(s) {
    const mode = s.mode || 'ionian';
    const root = s.root || 'C';
    const modeName = mode.charAt(0).toUpperCase() + mode.slice(1);
    const feel = MODE_FEEL[mode] || 'melodic';
    const genre = MODE_GENRE[mode] || 'instrumental';

    const userPrompt = `You are an expert at writing Suno AI music generation prompts.

Given this KCM Console harmonic state:
- Root note: ${root}
- Mode: ${modeName} (${feel})
- Suggested genre: ${genre}
- Active MIDI notes: ${s.activeNotes && s.activeNotes.length ? s.activeNotes.join(', ') : 'none'}

Write a rich, evocative Suno prompt (max 120 words) that:
1. Captures the emotional character of ${root} ${modeName}
2. Suggests specific instruments, tempo feel, and production style
3. Uses vivid descriptive language that Suno responds well to
4. Ends with "No lyrics. Instrumental only."

Return ONLY the prompt text — no preamble, no explanation, no markdown.`;

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 300,
        messages: [{ role: 'user', content: userPrompt }]
      })
    });

    const data = await response.json();
    if (data.content && data.content[0] && data.content[0].text) {
      return data.content[0].text.trim();
    }
    throw new Error('No content from Claude API');
  }

  /* ── Inject panel HTML ── */
  function injectPanel() {
    const panel = document.createElement('section');
    panel.className = 'kcm-suno-panel';
    panel.id = 'suno-panel';
    panel.setAttribute('aria-label', 'SUNO Prompt Generator');
    panel.innerHTML = `
      <div class="kcm-suno__header">
        <div class="kcm-suno__title-row">
          <span class="kcm-suno__icon">♪</span>
          <h3 class="kcm-suno__title">Suno Prompt Generator</h3>
          <span class="kcm-suno__state-badge" id="suno-state-badge">C · Ionian</span>
        </div>
        <p class="kcm-suno__sub">Synced to Console bus — updates as you play</p>
      </div>

      <div class="kcm-suno__body">
        <div class="kcm-suno__prompt-wrap">
          <textarea
            class="kcm-suno__prompt"
            id="suno-prompt-text"
            readonly
            spellcheck="false"
            rows="7"
            aria-label="Generated Suno prompt"
          ></textarea>
          <div class="kcm-suno__prompt-type" id="suno-prompt-type">Template</div>
        </div>

        <div class="kcm-suno__actions">
          <button class="kcm-suno__btn kcm-suno__btn--enhance" id="suno-enhance-btn">
            ✨ Enhance with AI
          </button>
          <button class="kcm-suno__btn kcm-suno__btn--template" id="suno-template-btn">
            ↺ Reset Template
          </button>
          <button class="kcm-suno__btn kcm-suno__btn--copy" id="suno-copy-btn">
            ⎘ Copy to Suno
          </button>
        </div>

        <div class="kcm-suno__status" id="suno-status" aria-live="polite"></div>
      </div>
    `;

    /* Insert after .kcm-panels section */
    const panelsSection = document.querySelector('.kcm-panels');
    if (panelsSection && panelsSection.parentNode) {
      panelsSection.parentNode.insertBefore(panel, panelsSection.nextSibling);
    } else {
      document.querySelector('main').appendChild(panel);
    }

    bindEvents();
    renderTemplate();
  }

  /* ── Render template into textarea ── */
  function renderTemplate() {
    const ta = document.getElementById('suno-prompt-text');
    const badge = document.getElementById('suno-state-badge');
    const typeBadge = document.getElementById('suno-prompt-type');
    if (!ta) return;

    ta.value = buildTemplate(_state);
    typeBadge.textContent = 'Template';
    typeBadge.className = 'kcm-suno__prompt-type';

    const modeName = (_state.mode || 'ionian');
    badge.textContent = `${_state.root || 'C'} · ${modeName.charAt(0).toUpperCase() + modeName.slice(1)}`;
  }

  /* ── Button events ── */
  function bindEvents() {

    /* Enhance button */
    document.getElementById('suno-enhance-btn').addEventListener('click', async () => {
      const btn = document.getElementById('suno-enhance-btn');
      const status = document.getElementById('suno-status');
      const typeBadge = document.getElementById('suno-prompt-type');

      btn.disabled = true;
      btn.textContent = '✨ Enhancing…';
      setStatus('Calling Claude AI…', 'loading');

      try {
        const enhanced = await enhanceWithClaude(_state);
        document.getElementById('suno-prompt-text').value = enhanced;
        typeBadge.textContent = 'AI Enhanced';
        typeBadge.className = 'kcm-suno__prompt-type kcm-suno__prompt-type--ai';
        setStatus('Enhanced! Ready to copy.', 'success');
      } catch (e) {
        setStatus('Enhancement failed — using template.', 'error');
        renderTemplate();
      } finally {
        btn.disabled = false;
        btn.textContent = '✨ Enhance with AI';
      }
    });

    /* Reset template button */
    document.getElementById('suno-template-btn').addEventListener('click', () => {
      renderTemplate();
      setStatus('Reset to template.', 'info');
    });

    /* Copy button */
    document.getElementById('suno-copy-btn').addEventListener('click', async () => {
      const btn = document.getElementById('suno-copy-btn');
      const text = document.getElementById('suno-prompt-text').value;
      try {
        await navigator.clipboard.writeText(text);
        btn.textContent = '✓ Copied!';
        setStatus('Prompt copied — paste into Suno!', 'success');
        setTimeout(() => { btn.textContent = '⎘ Copy to Suno'; }, 2200);
      } catch (e) {
        /* Fallback for older browsers */
        document.getElementById('suno-prompt-text').select();
        document.execCommand('copy');
        btn.textContent = '✓ Copied!';
        setTimeout(() => { btn.textContent = '⎘ Copy to Suno'; }, 2200);
      }
    });
  }

  /* ── Status helper ── */
  function setStatus(msg, type) {
    const el = document.getElementById('suno-status');
    if (!el) return;
    el.textContent = msg;
    el.className = `kcm-suno__status kcm-suno__status--${type}`;
    if (type !== 'loading') {
      setTimeout(() => { el.textContent = ''; el.className = 'kcm-suno__status'; }, 3500);
    }
  }

  /* ── KCM.bus listener ── */
  function mountBusListener() {
    /* Poll for KCM.bus — it may not be ready at script load */
    const poll = setInterval(() => {
      if (window.KCM && window.KCM.bus) {
        clearInterval(poll);

        /* Subscribe to all bus state changes */
        window.KCM.bus.subscribe(function (newState) {
          let changed = false;
          if (newState.root && newState.root !== _state.root) {
            _state.root = newState.root; changed = true;
          }
          if (newState.mode && newState.mode !== _state.mode) {
            _state.mode = newState.mode; changed = true;
          }
          if (newState.scale) { _state.scale = newState.scale; changed = true; }
          if (newState.activeNotes) { _state.activeNotes = newState.activeNotes; }
          if (newState.bpm) { _state.bpm = newState.bpm; }

          /* Only re-render template if in template mode (not AI enhanced) */
          const typeBadge = document.getElementById('suno-prompt-type');
          if (changed && typeBadge && !typeBadge.classList.contains('kcm-suno__prompt-type--ai')) {
            renderTemplate();
          }

          /* Always update state badge */
          const badge = document.getElementById('suno-state-badge');
          if (badge) {
            const m = _state.mode || 'ionian';
            badge.textContent = `${_state.root} · ${m.charAt(0).toUpperCase() + m.slice(1)}`;
          }
        });

        console.log('[KCM→SUNO] bus listener mounted.');
      }
    }, 100);
  }

  /* ── Also listen for KCM_STATE postMessage (bridge fallback) ── */
  window.addEventListener('message', function (ev) {
    if (!ev.data) return;
    if (ev.data.type === 'KCM_STATE' && ev.data.payload) {
      const p = ev.data.payload;
      if (p.root) _state.root = p.root;
      if (p.mode) _state.mode = p.mode;
      if (p.scale) _state.scale = p.scale;
      if (p.activeNotes) _state.activeNotes = p.activeNotes;

      const typeBadge = document.getElementById('suno-prompt-type');
      if (typeBadge && !typeBadge.classList.contains('kcm-suno__prompt-type--ai')) {
        renderTemplate();
      }
    }
  });

  /* ── KCM_STOP support ── */
  window.addEventListener('message', function (ev) {
    if (ev.data && ev.data.type === 'KCM_STOP') {
      setStatus('All panels stopped.', 'info');
    }
  });

  /* ── Boot ── */
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
