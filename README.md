# KCM Console

The Keys, Codes & Modes Console — a visual operating system for music.

**Live URL (once deployed):** https://console.keyscodesandmodes.com
**Status:** v0.1.0 · Session 1 · Shell deployed

---

## What this is

The KCM Console wraps the existing Keys, Codes & Modes application suite (12+ apps including Music Theory Explorer Pro, Circle of Fifths, CAGED Explorer, Chladni Visualizer, Sound Observatory) inside a unified shell with a shared harmonic state bus. Change the root note in one panel — every other panel follows in real time.

v1 Console adds two capabilities none of the individual apps have:

1. **Cross-panel synchronization** — root, mode, scale, and active notes shared across panels in real time via a postMessage bridge.
2. **.gcis file export** — portable harmonic state saved to a YAML file format, ready to feed downstream AI generators.

## Build status

- **Current version:** v0.1.0
- **Current session:** 1 of ~12 to v1.0-beta
- **What's shipped:** Static shell with KCM Graphics Standards compliance and the 12-Color Chromatic Spectrum™ clock face rendered from canonical hex values.
- **Next session:** Session 2 — State bus implementation.

See `CONSOLE_BUILD_STATE.md` for full session log and handoff notes.

## Deployment

### Cloudflare Pages (recommended, matches main site)

1. Push this repo to GitHub as `BenRyan1/kcm-console`.
2. In Cloudflare Dashboard: **Pages → Create a project → Connect to Git**.
3. Select the `kcm-console` repo. Use these settings:
   - **Framework preset:** None
   - **Build command:** (leave empty)
   - **Build output directory:** `/`
   - **Environment variables:** (none needed for Session 1)
4. After initial deploy, go to **Custom domains → Set up a custom domain**.
5. Add `console.keyscodesandmodes.com`. Cloudflare will add the CNAME automatically if DNS is on Cloudflare (which KCM's is).
6. Done. Deploys automatically on every push to `main`.

### Local preview

No build step. Open `index.html` directly, or run any static server:

```bash
# Python 3
python3 -m http.server 8080

# Node (if http-server installed globally)
npx http-server -p 8080

# Then open http://localhost:8080
```

## Tech stack

- **Vanilla JS** (no framework) — matches the existing 12-app suite
- **Plain CSS** with CSS Custom Properties — full KCM Graphics Standards compliance
- **SVG** for the chromatic clock — sharp at any zoom, no image assets
- **Google Fonts** — Cinzel (display) + Montserrat (body)
- **Cloudflare Pages** for hosting
- **No build step.** Deploy is literally copying files. This is deliberate.

## Why Vanilla JS and not React/Svelte/Vue?

1. Zero build complexity. Deploy = push to GitHub.
2. Matches the existing 12 apps (all Vanilla JS).
3. The state bus is ~40 lines. Reactive frameworks are overkill here.
4. Every future Claude session is simpler without framework idioms.
5. Iframe integration is pure postMessage — no framework layer needed.

Revisit for v2 if the state graph grows complex enough to justify a framework.

## Repository structure

```
kcm-console/
├── index.html                  Entry point
├── css/
│   └── console.css             All styles. KCM Graphics Standards tokens.
├── js/
│   └── console.js              Shell JS. Bus arrives Session 2.
├── assets/                     Images, icons. Empty in Session 1.
├── CONSOLE_BUILD_STATE.md      Session handoff log. READ FIRST.
├── README.md                   This file.
└── .gitignore
```

## KCM Graphics Standards compliance

All code in this repo follows the canonical KCM Graphics Standards:

- **Dark theme only.** Background `#0a0a15`.
- **Palette:** teal `#008080`, gold `#F4D03F`, purple `#8B6BA3`, coral `#CF7A5A`.
- **Fonts:** Cinzel (display), Montserrat (body).
- **12-Color Chromatic Spectrum™:** C=Yellow `#FFFF00` at 12 o'clock, clockwise through B=Yellow-Green `#80FF00`. All 12 hex values as CSS custom properties on `:root`.
- **Text on dark:** primary `#e8e8f8`, secondary `#b0b0cc`, muted `#7878a0`. Never dark text on dark background.
- **Never a flat horizontal strip** as primary chromatic representation — always the clock-face circle.

## Trademarks and IP

- **Keys, Codes & Modes™** and **12-Color Chromatic Spectrum™** — trademarks of Benjamin Ryan.
- **FreeStyle® Musical Device** — 4 U.S. patents held by Benjamin Ryan.
- **KCM** is shorthand for Keys, Codes & Modes.

## Contact

Benjamin Ryan · ben@keyscodesandmodes.com · 805-886-4092
Santa Barbara, California

---

*Built one Claude session at a time. See `CONSOLE_BUILD_STATE.md` for how.*
