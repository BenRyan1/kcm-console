# KCM Console QA

Regression tests for `music-theory-pro.html`. These live in the repo (not a
scratch folder) specifically so they survive across sessions and machines —
an earlier version of this suite lived only in a temporary sandbox directory
and was lost when that sandbox got recycled. Don't repeat that mistake:
any new verification script written while working on this app should be
added here and committed, not left in a temp folder.

## Running

```
cd qa
npm install      # once, installs jsdom + css-tree
node run-all.js   # runs every check
```

`run-all.js` runs, in order: a JS syntax check on the app's inline
`<script>` blocks, a CSS validity check on its `<style>` blocks, a
whole-file `<div>` tag balance check, and every `test_*.js` file in this
folder.

## What's covered right now

- `test_rightcol_direct_child.js` — guards against the 3-column grid
  layout silently breaking because `.kcm-right-col` got nested inside
  `.kcm-center-col` by an unclosed `<div>` (this exact bug shipped once
  and took a long time to diagnose — see git log around "Fix root cause
  of missing 3rd column").
- `test_progression_panel_move.js` — end-to-end: starts the audio engine,
  clicks the Harmonized level button and a key pill, confirms the chord
  progression panel is in `.kcm-left-col` and becomes visible.
- `test_stencil_overlay_responsive.js` — confirms the floating Stencil
  Overlay has correctly-ordered, correctly-ratioed breakpoint CSS at
  1024px and 540px so it shrinks in step with the chromatic circle
  instead of overflowing it on narrow screens.
- `test_full_smoke.js` — broad end-to-end pass: audio start, every view
  toggle, Stencil Overlay toggle, instrument picker, full Harmonized
  flow, asserting zero thrown JS errors and correct final DOM shape.

## What's NOT covered (known gap)

A larger, more specific regression suite existed across many earlier
sessions (~30+ targeted tests covering things like sphere positioning,
melody-line sync, Timeline layout, badge playback, hover states, scale
library wiring) plus 8 broader "run_qa" suites. That suite lived only in
a temp sandbox folder, was never committed here, and was lost when the
sandbox was recycled. It has not been reconstructed — only the 4 tests
above (covering the most recent, still-fresh bugs) survived/were rebuilt.
If you're about to touch an area of the app and want tighter regression
coverage than what's here, it's worth writing a fresh targeted test into
this folder first.
