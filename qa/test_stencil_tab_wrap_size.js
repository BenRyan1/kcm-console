// Verifies the standalone Stencil tab's wheel (.kcm-stencil-wrap /
// #kcmStencilSVG / .kcm-stencil-circle-bg) is sized to actually fit
// inside .kcm-center-col at each of the 3-column grid's breakpoint
// tiers, instead of the old fixed 500px carried over from a pre-grid,
// single-column layout where #kcmStencilPanel's own max-width:900px
// meant something. .kcm-center-col is 440px (base) / 320px (<=1024px)
// / ~216px (<=540px) per the same grid tiers the Chromatic Circle
// itself already respects -- this asserts the Stencil wheel now tracks
// those same tiers instead of overflowing its column at every
// non-mobile width.
//
// jsdom has no real layout engine (no @media matching, no computed
// box sizes), so -- consistent with how the earlier Stencil Overlay
// and Interval popup responsive fixes were verified in this suite --
// this is a source-text/cascade audit: confirms the base rule shrank
// from 500px, a new <=1024px tier exists with a smaller size, the
// existing <=540px !important tier is untouched and still wins at
// that width regardless of source order, and every rule appears in
// the file in an order that doesn't accidentally defeat itself.
const fs = require('fs');
const path = require('path');
const html = fs.readFileSync(path.join(__dirname, '..', 'music-theory-pro.html'), 'utf8');

function fail(msg) { console.log('FAIL: ' + msg); process.exit(1); }

// Isolate just the Stencil System CSS region so matches below can't
// accidentally pick up unrelated rules elsewhere in a 12000+ line file.
const startIdx = html.indexOf('KCM STENCIL SYSTEM — New CSS Only');
const endIdx = html.indexOf('Stencil Overlay Mode', startIdx);
if (startIdx === -1 || endIdx === -1) fail('could not isolate the Stencil System CSS region');
const region = html.slice(startIdx, endIdx);

// 1. Base (unconditional) .kcm-stencil-wrap rule must no longer be 500px.
const baseWrapMatch = region.match(/\.kcm-stencil-wrap\s*\{[^}]*\}/);
if (!baseWrapMatch) fail('could not find base .kcm-stencil-wrap rule');
if (/width:\s*500px/.test(baseWrapMatch[0])) {
  fail('base .kcm-stencil-wrap is still 500px -- does not fit the 440px .kcm-center-col at the base tier');
}
if (!/width:\s*400px/.test(baseWrapMatch[0])) {
  fail('base .kcm-stencil-wrap is not the expected 400px, got: ' + baseWrapMatch[0]);
}

// 2. A <=1024px tier must now exist for the bare (non-overlay) wrap,
//    sized smaller than the base 400px and larger than the <=540px 220px.
const has1024Tier = /@media \(max-width:\s*1024px\)\s*\{\s*\.kcm-stencil-wrap\s*\{\s*width:\s*280px/.test(region);
if (!has1024Tier) fail('missing a <=1024px breakpoint tier for .kcm-stencil-wrap');

// 3. The existing <=540px !important tier must be untouched (220px, !important).
const has540Important = /@media \(max-width:\s*540px\)\s*\{\s*\.kcm-stencil-wrap\s*\{\s*width:\s*220px\s*!important/.test(region);
if (!has540Important) fail('the existing <=540px !important tier for .kcm-stencil-wrap is missing or was altered');

// 4. Source order: base rule, then the 1024px tier, then (eventually) the
//    540px !important tier -- doesn't strictly matter for correctness
//    given !important always wins at <=540px regardless of order, but
//    confirming order keeps the cascade easy to reason about for the
//    next person reading this file top to bottom.
const baseIdx = region.indexOf(baseWrapMatch[0]);
const idx1024 = region.search(/@media \(max-width:\s*1024px\)/);
const idx540  = region.search(/@media \(max-width:\s*540px\)/);
if (!(baseIdx < idx1024 && idx1024 < idx540)) {
  fail('expected source order: base rule, then <=1024px tier, then <=540px tier');
}

// 5. #kcmStencilSVG and .kcm-stencil-circle-bg tracked the same resize
//    (both are part of the same wheel graphic and must scale together).
if (!/#kcmStencilSVG\s*\{[^}]*width:\s*400px/.test(region)) fail('#kcmStencilSVG base rule not resized to 400px alongside .kcm-stencil-wrap');
if (!/\.kcm-stencil-circle-bg\s*\{[^}]*width:\s*400px/.test(region)) fail('.kcm-stencil-circle-bg base rule not resized to 400px alongside .kcm-stencil-wrap');

console.log('PASS - Stencil tab wheel (.kcm-stencil-wrap/#kcmStencilSVG/.kcm-stencil-circle-bg) is sized to fit .kcm-center-col at the base and <=1024px tiers, with the existing <=540px !important tier intact.');
process.exit(0);
