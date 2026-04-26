# KCM Console — Build State

**Last session:** 8
**Last updated:** 2026-04-25
**Live URL:** https://console.keyscodesandmodes.com

---

## Current state

### What works
- Shell + KCM Graphics Standards
- 12-Color Chromatic Spectrum™ clock — C centered at 12 o'clock
- `window.KCM.bus` — reactive state bus (Session 2)
- Dev panel — gated behind `?dev=1` (Session 2)
- `window.KCM.bridge` — iframe postMessage adapter (Session 3)
- Bridge-test harness — gated behind `?bridge-test=1` (Session 3)
- **3 live panels** (Sessions 4–7):
  - Music Theory Pro (`music-theory-pro.html`)
  - Circle of Fifths (`circle-of-fifths.html`)
  - Modal Stencil Player (`modal-stencil-player.html`)
- **⏹ Stop All** button — broadcasts `KCM_STOP` to all panels
- **`.gcis` format — Session 8** (`js/gcis.js`)
  - `KCM.gcis.saveToDisk(state, meta)` — downloads `.gcis` file
  - `KCM.gcis.loadFromDisk(onSuccess, onError)` — file picker → restores bus
  - `KCM.gcis.serialise(state, meta)` — returns JSON string
  - `KCM.gcis.deserialise(jsonString)` — returns `{ok, state, meta, error}`
  - Validation: checks gcis version, root pitch class, mode, array types
- **Session title input** — editable inline in header, saved into .gcis metadata
- **⬇ Save .gcis** button — saves current bus state + title to file
- **⬆ Load .gcis** button — opens file picker, restores state to bus, all panels update

### .gcis file format (v1.0 — LOCKED)
```json
{
  "gcis":    "1.0",
  "created": "2026-04-25T...",
  "title":   "My Session",
  "author":  "Benjamin Ryan",
  "app": {
    "name":    "KCM Console",
    "version": "0.8.0",
    "url":     "https://console.keyscodesandmodes.com"
  },
  "state": {
    "root":        "G",
    "mode":        "dorian",
    "scale":       [0,2,3,5,7,9,10],
    "activeNotes": [62,65,67]
  },
  "history": []
}
```

### File inventory (v0.8.0)
```
kcm-console/
├── index.html
├── music-theory-pro.html
├── music-theory-pro-live-integrated.html
├── circle-of-fifths.html
├── modal-stencil-player.html
├── css/
│   └── console.css
├── js/
│   ├── console.js
│   ├── bridge.js
│   └── gcis.js                  ← new in Session 8
├── assets/
│   └── favicon.svg
├── CONSOLE_BUILD_STATE.md
├── README.md
└── .gitignore
```

## Next session target

### Session 9 — Auth gate planning / Session 10 — Stripe tier

**Or:** Deploy to Cloudflare Pages first — the Console is feature-complete for v1.0-alpha. Commit, tag v1.0-alpha, push.

## Session index

| # | Title | Status |
|---|-------|--------|
| 1 | Repo scaffold and shell | ✅ |
| 1.1 | Hotfix | ✅ |
| 2 | State bus + dev panel | ✅ |
| 3 | Iframe bridge | ✅ |
| 4 | Music Theory Pro panel | ✅ |
| 5+6 | Circle of Fifths | ✅ |
| 7 | Modal Stencil + v1.0-alpha | ✅ |
| 8 | .gcis format + Save/Load | ✅ |
| 9 | Auth gate | ⏳ Next |
| 10 | Stripe tier | — |
| 11 | SUNO prompt generator | — |
| 12 | Launch checklist | — |
