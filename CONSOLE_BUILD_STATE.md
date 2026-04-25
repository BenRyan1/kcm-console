# KCM Console — Build State

**Last session:** 3
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
- Static shell at `index.html`, deployed to Cloudflare Pages
- KCM Graphics Standards compliance: header, hero, status, footer
- 12-Color Chromatic Spectrum™ clock — C wedge **centered** at 12 o'clock
- Favicon at `assets/favicon.svg`
- Cinzel + Montserrat fonts via Google Fonts
- `window.KCM.build`, `window.KCM.MODES`, `window.KCM.PITCH_CLASSES` exposed globally
- **`window.KCM.bus`** — reactive state bus (Session 2)
- **Dev panel** — gated behind `?dev=1` (Session 2)
- **`window.KCM.bridge`** — iframe postMessage adapter (Session 3)
  - `KCM.bridge.register(iframeEl)` — adds to broadcast list; immediately posts current state
  - `KCM.bridge.unregister(iframeEl)` — removes from broadcast list
  - `KCM.bridge.registeredCount()` — number of registered iframes
  - `KCM.bridge.allowedOrigins()` — copy of origin allowlist
  - Outbound: every bus change posts `{ type: 'KCM_STATE', payload }` to all iframes
  - Inbound: listens for `{ type: 'KCM_STATE_PATCH', payload }`, validates origin, calls `KCM.bus.set()`
  - `activeNotes` serialised as sorted Array; deserialised back to Set on receipt
- **Bridge-test harness** — gated behind `?bridge-test=1` (Session 3)
  - Stub srcdoc iframe auto-registers on load; displays received state live
  - Stub sends patches: root→F, mode→dorian, toggle note 65
  - Diagnostics: register/unregister buttons, origin log, count log
- Responsive layout; accessibility: semantic HTML, focus-visible, reduced-motion

### Origin allowlist (v0.3.0)
```
PROD: https://keyscodesandmodes.com
      https://console.keyscodesandmodes.com
DEV:  http://localhost            ← strip at Session 10
      http://localhost:3000
      http://localhost:8080
      http://127.0.0.1
      http://127.0.0.1:3000
      http://127.0.0.1:8080
```

### What's mocked / not yet built
- No real app panels. Session 4 adds Music Theory Pro.
- Analytics (GA4 + Clarity). Session 12.

### What's broken
- **srcdoc null-origin:** Browsers report `null` as origin for srcdoc iframes. The current allowlist drops `null`, so stub iframe patches don't reach `KCM.bus.set()`. The stub's receive path (Console→iframe) works fine. Fix: add `'null'` to DEV_ORIGINS at Session 4 start.

---

## Next session target

### Session 4 — Music Theory Pro as iframe panel

**Goal:** Mount Music Theory Pro as the first real iframe panel. Wire it through the bridge. Root change in dev panel must update MTP in real time.

**Input artifacts to read FIRST:**
- `index.html` — add panel layout section
- `js/bridge.js` — fix null-origin issue first (add `'null'` to DEV_ORIGINS)
- `css/console.css` — add `.kcm-panels` and `.kcm-panel` styles
- This file — update at session end

**Steps:**

1. **Fix null-origin** in `bridge.js` DEV_ORIGINS — add `'null'` string.

2. **Inspect Music Theory Pro** — fetch/read `https://keyscodesandmodes.com/music-theory-pro.html` to find what JS API or DOM hooks exist for setting root/mode. Document findings in this file before writing the adapter. (Do NOT modify MTP — Option B.)

3. **Panel layout** — add `.kcm-panels` grid between hero and status in `index.html`. Desktop: 2-column. Mobile: 1-column.

4. **Music Theory Pro panel card** — `.kcm-panel` with header (title + minimize stub), `<iframe src="https://keyscodesandmodes.com/music-theory-pro.html">`, `KCM.bridge.register()` on iframe load.

5. **Inbound adapter** — on receiving `KCM_STATE` in the Console, push root/mode into MTP via its JS API or DOM inputs. Since we can't modify MTP's source, this may require `iframe.contentWindow` access (same-origin only) or injecting a relay script. Determine approach after Step 2 inspection.

**Success criterion:**
1. Console loads with Music Theory Pro visible in a panel card
2. Set root to D in dev panel → MTP updates to D root within 500ms
3. `KCM.bridge.registeredCount()` returns 1 in console
4. No regressions on bridge-test harness or public page

---

## Open questions for Ben

- **Q4 (Session 4):** Does Music Theory Pro expose a JS API for setting root/mode? Answer via inspection at Session 4 start.

---

## Decisions log

### Session 3 — 2026-04-25
- **bridge.js:** IIFE, vanilla JS, no build step.
- **Broadcast:** subscribe to bus once; only broadcast when `iframes.size > 0`.
- **Origin validation:** silent drop on unknown origins.
- **srcdoc null-origin:** documented, deferred to Session 4.
- **Harness:** embedded in `index.html` behind `?bridge-test=1`; `body.bridge-test-mode` gates CSS.
- **localhost in DEV_ORIGINS:** included with strip-at-Session-10 comment.

### Session 2 — 2026-04-25
- Bus `createBus()` factory. Offerings nav link removed. Dev panel event delegation.

### Session 1.1 — 2026-04-23
- C wedge centered at 12 o'clock. Favicon. Cloudflare Pages confirmed.

### Session 1 — 2026-04-23
- Vanilla JS + HTML + CSS. No build step. `window.KCM.bus` global. Option B iframe strategy. Repo: `BenRyan1/kcm-console`.

---

## Session index

| # | Title | Status |
|---|-------|--------|
| 1 | Repo scaffold and shell | ✅ Complete |
| 1.1 | Hotfix: C centered at 12, favicon, nav fix | ✅ Complete |
| 2 | State bus + dev panel | ✅ Complete |
| 3 | Iframe bridge (postMessage) | ✅ Complete |
| 4 | Music Theory Pro as iframe panel | ⏳ Next |
| 5 | Circle of Fifths Tone.js refactor | — |
| 6 | Circle of Fifths as iframe panel | — |
| 7 | Third panel + v1 test passes | — |
| 8 | .gcis serializer | — |
| 9 | Save/Load UI | — |
| 10 | Auth gate | — |
| 11 | Professional Console Stripe tier | — |
| 12 | Launch checklist | — |

*v1.0-alpha ships at end of Session 7. v1.0-beta ships at end of Session 12.*

---

## File inventory (v0.3.0)

```
kcm-console/
├── index.html
├── css/
│   └── console.css
├── js/
│   ├── console.js
│   └── bridge.js                ← new in Session 3
├── assets/
│   └── favicon.svg
├── CONSOLE_BUILD_STATE.md       (this file)
├── README.md
└── .gitignore
```
