# KCM Console — Build State

**Last session:** 1 (+ hotfix 1.1)
**Last updated:** 2026-04-23
**Live URL (once deployed):** https://console.keyscodesandmodes.com

---

## How to read this file

Every Claude session working on the Console reads this file FIRST, before touching any code. The next session does three things:

1. Read the **"Next session target"** block below.
2. Read the **"Input artifacts"** listed there.
3. Execute the single goal. Update this file at session end.

If this file disagrees with code, the code wins — but then this file gets corrected immediately.

---

## Current state

### What works
- Static shell deployed (or ready to deploy) at `index.html`
- KCM Graphics Standards compliance across header, hero, status, footer
- 12-Color Chromatic Spectrum™ clock renders correctly, with **C wedge CENTERED at 12 o'clock** (per Ben's canonical refinement in Session 1.1)
- Favicon (small chromatic wheel, same rotation) at `assets/favicon.svg`
- Cinzel (display) + Montserrat (body) font loading from Google Fonts
- `window.KCM.build` object exposed with version metadata
- `window.KCM.bus` stub reserved for Session 2
- Responsive layout at mobile / tablet / desktop breakpoints
- Accessibility: semantic HTML, focus-visible outlines, reduced-motion support

### What's mocked
- State bus: the `window.KCM.bus` property is `null`. Session 2 replaces it with a working implementation.
- Iframe adapter protocol: not implemented. Session 3.
- No panels yet. Panels arrive in Session 4 (Music Theory Pro) and Session 6 (Circle of Fifths).
- Analytics tags not added yet. Session 12 wires GA4 (G-6EGC5ZNZPF) and Clarity (vhyrbjp63x).

### What's broken
- Nothing known.

### Known limitations (intentional for v1)
- Mobile support is "looks fine" not "fully tested." Desktop is the v1 target.
- No service worker / PWA. Not in v1 scope.
- No dark/light mode toggle — KCM is dark-theme only per Graphics Standards.

---

## Next session target

### Session 2 — State bus implementation

**Goal:** Replace `window.KCM.bus` with a working reactive bus. Add a dev panel to the UI that visualizes current bus state. No panels yet; the test harness is buttons in the dev panel that write to the bus and subscribers that read from it.

**Input artifacts to read FIRST:**
- `index.html` — you'll add a dev panel section (behind `?dev=1` query param so it doesn't show in production)
- `js/console.js` — you'll replace the `window.KCM.bus = null` line with the real implementation
- `css/console.css` — add styles for the dev panel (gated behind a `.dev-mode` class on body)
- This file — update at session end

**Input artifacts to reference (do not modify):**
- KCM Console Foundation Review v0.2 — specifically Part II §2.4 Component 2 (the v1 bus shape) and Part IV §4.4 (Harmonic Identity spec)

**Success criterion:**
1. Navigate to `console.keyscodesandmodes.com/?dev=1`
2. A dev panel appears showing live bus state: `{root, mode, scale, activeNotes}`
3. Click "Set root to F" in the dev panel — display updates immediately
4. Click "Set mode to dorian" — display updates immediately
5. Open browser console: `KCM.bus.get()` returns current state, `KCM.bus.subscribe(fn)` works
6. No regressions on the public-facing page (without `?dev=1`)

**Bus API contract (locked — do not drift in Session 2):**
```js
window.KCM.bus.get()                    // returns current state snapshot
window.KCM.bus.set(patch)               // shallow-merges patch into state, notifies subscribers
window.KCM.bus.subscribe(fn)            // fn receives state on every change; returns unsubscribe()
window.KCM.bus.state                    // live reference to current state (read-only by convention)
```

**State shape (v1 locked):**
```js
{
  root: 'C',                     // pitch class string
  mode: 'ionian',                // modal identifier string
  scale: [0,2,4,5,7,9,11],       // interval array
  activeNotes: new Set()         // Set<midiNumber>
}
```

Do NOT add `tempo`, `chord`, `tensionProfile`, `operatorChain`, or anything else. Those are v1.1+.

---

## Open questions for Ben

- **Q1 (Session 1, resolved):** ~~Cloudflare Pages vs GitHub Pages?~~ → Cloudflare Pages. (Initial deployment via Workers was a misconfiguration corrected in the v0.1.1 deploy.)
- **Q2 (Session 1.1, resolved):** ~~Favicon?~~ → Yes, chromatic wheel. Shipped in v0.1.1.
- **Q3 (Session 1, deferred to v1.2):** Privacy Policy / Terms link — currently links only to main site. Revisit when auth gate lands (Session 10).

---

## Decisions log

### Session 1.1 — 2026-04-23 (hotfix)
- **Canonical refinement:** The C wedge is **centered** at 12 o'clock, not starting at 12 o'clock. Applied via a -15° rotation (half a wedge) to the whole chromatic clock. This matches how a normal clock face reads. All future visualizations of the 12-Color Chromatic Spectrum™ follow this rule.
- **Favicon added** at `assets/favicon.svg` — small version of the same wheel.
- **Offerings link REMOVED from Console nav.** Initial Session 1 advice was wrong. `offerings.html` on the main site is the gateway to the paid apps via the access code system — not just a marketing page. Linking to it from the Console nav risks bypassing the access gate. Correct nav is: Main Site, About. A proper "Pricing" or "Get Access" link will be added in Session 11 (Professional Console Stripe tier) once the Console has its own auth flow.
- **Deployment target clarified:** Cloudflare Pages (not Workers). Session 1 was initially deployed as a Worker by mistake; Pages is the correct tool for static HTML/CSS/JS.

### Session 1 — 2026-04-23
- **Tech stack: Vanilla JS + HTML + CSS.** No build step. No framework. Decided by Claude per Ben's "you decide."
- **v1 shipping shape: v1.0-alpha (2 panels, no save/load) then v1.0-beta (3 panels + save/load).** Decided by Claude per Ben's "you decide." Rationale: ~7 sessions to live demo instead of ~15.
- **Repo: separate repo `BenRyan1/kcm-console`.** Per Ben.
- **Shell visual language: KCM Graphics Standards compliant from day one.** No token drift allowed.
- **State bus is window.KCM.bus (global).** Not a module export. Keeps the iframe adapter story simple — cross-frame postMessage doesn't need module resolution.

### Prior decisions carried forward (from v0.2)
- Option B iframe strategy: wrap existing apps externally, do not modify the 12 apps
- Tone.js consolidates to Web Audio (Circle of Fifths refactor in Session 5)
- Console URL: console.keyscodesandmodes.com
- Login: public browse, auth-gated save/load (Session 10)
- Professional Console Stripe tier (Session 11)
- v1 success bar: root change in one panel propagates to 2+ other panels in real time

---

## Session index

| # | Title | Status |
|---|-------|--------|
| 1 | Repo scaffold and shell | ✅ Complete |
| 1.1 | Hotfix: C centered at 12, favicon, deployment target clarified | ✅ Complete |
| 2 | State bus implementation | ⏳ Next |
| 3 | Iframe bridge (postMessage) | — |
| 4 | Music Theory Pro as iframe panel | — |
| 5 | Circle of Fifths Tone.js refactor | — |
| 6 | Circle of Fifths as iframe panel | — |
| 7 | Third panel + v1 test passes | — |
| 8 | .gcis serializer | — |
| 9 | Save/Load UI | — |
| 10 | Auth gate | — |
| 11 | Professional Console Stripe tier | — |
| 12 | Launch checklist | — |

*v1.0-alpha ships at end of Session 7. v1.0-beta (save/load + third panel) ships at end of Session 12.*

---

## File inventory (v0.1.1)

```
kcm-console/
├── index.html
├── css/
│   └── console.css
├── js/
│   └── console.js
├── assets/
│   └── favicon.svg              ← new in v0.1.1
├── CONSOLE_BUILD_STATE.md       (this file)
├── README.md
└── .gitignore
```
