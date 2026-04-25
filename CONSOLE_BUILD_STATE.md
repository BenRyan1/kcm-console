# KCM Console — Build State

**Last session:** 2
**Last updated:** 2026-04-25
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
- Static shell deployed at `index.html`
- KCM Graphics Standards compliance across header, hero, status, footer
- 12-Color Chromatic Spectrum™ clock renders correctly, with **C wedge CENTERED at 12 o'clock**
- Favicon at `assets/favicon.svg` (small chromatic wheel, same rotation)
- Cinzel (display) + Montserrat (body) font loading from Google Fonts
- `window.KCM.build` object exposed with version metadata
- `window.KCM.MODES` and `window.KCM.PITCH_CLASSES` exposed globally
- **`window.KCM.bus` — fully implemented reactive state bus (Session 2)**
  - `KCM.bus.get()` returns a deep-snapshot of current state
  - `KCM.bus.set(patch)` shallow-merges and notifies all subscribers
  - `KCM.bus.subscribe(fn)` calls fn immediately with current state; returns unsubscribe()
  - `KCM.bus.state` live reference (read-only by convention)
- **Dev panel — fully implemented (Session 2)**
  - Gated behind `?dev=1` query param; `body.dev-mode` class added when active
  - Live readout of `{root, mode, scale, activeNotes}` with update timestamp + subscriber count
  - Root buttons (all 12 pitch classes) with `is-active` highlight
  - Mode buttons (all 7 modes) with `is-active` highlight; setting mode also updates scale
  - activeNotes toggle buttons (C4/E4/G4) + clear
  - Diagnostics: `console.log state`, `count subscribers`
- Responsive layout at mobile / tablet / desktop breakpoints
- Accessibility: semantic HTML, focus-visible outlines, reduced-motion support

### What's mocked
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

## Session 2 verification checklist (all pass)

1. ✅ Navigate to `console.keyscodesandmodes.com/?dev=1` → dev panel appears
2. ✅ Dev panel shows live bus state: `{root, mode, scale, activeNotes}`
3. ✅ Click "F" in root buttons → readout updates immediately, F button highlights
4. ✅ Click "dorian" in mode buttons → readout updates immediately with correct interval array
5. ✅ Browser console: `KCM.bus.get()` returns current state snapshot
6. ✅ Browser console: `KCM.bus.subscribe(fn)` works; fn called immediately + on every change
7. ✅ Public page (no `?dev=1`) shows no dev panel; no regressions

---

## Next session target

### Session 3 — Iframe bridge (postMessage)

**Goal:** Implement the cross-frame adapter so the Console can host existing KCM apps as iframes and synchronize state bidirectionally via `postMessage`. No panel UI yet (that's Session 4). The deliverable is a tested adapter module and a minimal harness page that proves the protocol works.

**Input artifacts to read FIRST:**
- `index.html` — understand current shell structure
- `js/console.js` — the bus is `window.KCM.bus`; the adapter attaches to it
- This file — update at session end

**New file to create:**
- `js/bridge.js` — the iframe adapter module

**What the bridge must do:**
1. **Outbound:** When `KCM.bus` state changes, post a `KCM_STATE` message to all registered iframe `contentWindow`s
2. **Inbound:** Listen for `KCM_STATE_PATCH` messages from iframes; call `KCM.bus.set(patch)` when received
3. **Registration:** `KCM.bridge.register(iframeEl)` adds an iframe to the broadcast list; `KCM.bridge.unregister(iframeEl)` removes it
4. **Security:** Validate `event.origin` against an allowlist before accepting inbound messages. Allowlist for v1: `['https://keyscodesandmodes.com', 'https://console.keyscodesandmodes.com']`
5. **Harness:** A `?bridge-test=1` URL flag mounts a test iframe pointing to a stub page (can be inline `srcdoc`) that echoes received state and sends a patch back

**Message envelope (locked):**
```js
// Console → iframe
{ type: 'KCM_STATE', payload: { root, mode, scale, activeNotes: [...] } }

// iframe → Console
{ type: 'KCM_STATE_PATCH', payload: { root?, mode?, scale?, activeNotes?: [...] } }
```

Note: `activeNotes` must be serialized as an Array (Sets are not JSON-serializable) and deserialized back to a Set on receipt.

**Success criterion:**
1. `KCM.bridge.register(iframeEl)` — works without error
2. Set root to G in dev panel → stub iframe receives `KCM_STATE` message with `root: 'G'`
3. Stub iframe posts `KCM_STATE_PATCH {root:'Bb'}` → `KCM.bus.get().root === 'A#'` (enharmonic mapping optional in v1; exact string match acceptable)
4. Messages from unknown origins are silently dropped (verify in console)
5. No regressions on public page

---

## Open questions for Ben

- **Q1 (Session 1, resolved):** ~~Cloudflare Pages vs GitHub Pages?~~ → Cloudflare Pages.
- **Q2 (Session 1.1, resolved):** ~~Favicon?~~ → Yes, chromatic wheel. Shipped in v0.1.1.
- **Q3 (Session 1, deferred to v1.2):** Privacy Policy / Terms link — currently links only to main site. Revisit when auth gate lands (Session 10).

---

## Decisions log

### Session 2 — 2026-04-25
- **Bus implementation:** `createBus()` factory pattern. State is a plain object held in closure. `get()` returns a deep snapshot (slice on array, new Set on activeNotes). `subscribe()` calls fn immediately with current state on registration. `_subscriberCount()` exposed for diagnostics.
- **Dev panel wiring:** Event delegation on panel root (single listener). `is-active` class on root/mode buttons tracks selected value visually. `activeNotes` toggle works on the snapshot copy — correct behavior since `bus.set()` replaces the reference.
- **Nav fix:** Offerings link removed from `index.html` nav (was erroneously present from Session 1 template; Session 1.1 decision log required its removal).
- **No build step added.** Vanilla JS IIFE pattern continues. `js/bridge.js` in Session 3 will follow the same pattern.

### Session 1.1 — 2026-04-23 (hotfix)
- C wedge **centered** at 12 o'clock (−15° rotation). All future clock visualizations follow this.
- Favicon added at `assets/favicon.svg`.
- Offerings link REMOVED from Console nav (access gate risk).
- Deployment target clarified: Cloudflare Pages.

### Session 1 — 2026-04-23
- Tech stack: Vanilla JS + HTML + CSS. No build step. No framework.
- v1 shipping shape: v1.0-alpha (2 panels) then v1.0-beta (3 panels + save/load).
- Repo: `BenRyan1/kcm-console`.
- Shell visual language: KCM Graphics Standards compliant from day one.
- State bus: `window.KCM.bus` (global). Keeps postMessage/iframe story simple.

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
| 2 | State bus implementation + dev panel | ✅ Complete |
| 3 | Iframe bridge (postMessage) | ⏳ Next |
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

## File inventory (v0.2.0)

```
kcm-console/
├── index.html
├── css/
│   └── console.css
├── js/
│   └── console.js
│   └── bridge.js                ← new in Session 3
├── assets/
│   └── favicon.svg
├── CONSOLE_BUILD_STATE.md       (this file)
├── README.md
└── .gitignore
```
