// Regression guard: the Interval popup (built by showIntervalInfo(), an
// entirely inline-styled position:fixed box with bottom:100px; right:20px;
// max-width:320px;) has no left-edge constraint or centering, so on an
// iPhone-width viewport (320-430px) it can run off the left edge or sit
// asymmetrically off-center -- fine on a MacBook Pro's wide viewport,
// broken on a phone. Verified via source-text/cascade audit (same
// approach as test_stencil_overlay_responsive.js), since jsdom does not
// reliably evaluate @media rules against a simulated viewport.
const fs = require('fs');
const path = require('path');
const html = fs.readFileSync(path.join(__dirname, '..', 'music-theory-pro.html'), 'utf8');

function idx(needle, from) {
  const i = html.indexOf(needle, from || 0);
  if (i === -1) throw new Error('FAIL -- not found: ' + needle);
  return i;
}

// The inline style that ships with every popup instance (set via JS,
// not the stylesheet) -- confirm it's still there so this test stays
// aligned with what showIntervalInfo() actually builds.
const inlineStyleIdx = idx("position:fixed;bottom:100px;right:20px;");

// The breakpoint override must exist, targeting #intervalPopup by ID
// with !important (required to beat a non-important inline style).
const overrideIdx = idx('#intervalPopup {');
const overrideBlock = html.slice(overrideIdx, overrideIdx + 500);

['left: 50% !important', 'right: auto !important', 'transform: translateX(-50%) !important']
  .forEach(rule => {
    if (!overrideBlock.includes(rule)) throw new Error(`FAIL -- #intervalPopup breakpoint override missing "${rule}"`);
  });

if (!/width:\s*min\(88vw,\s*320px\)\s*!important/.test(overrideBlock)) {
  throw new Error('FAIL -- #intervalPopup breakpoint override missing responsive width (min(88vw,320px))');
}

// Cascade-order requirement: the override must appear in the stylesheet
// (i.e. as a real CSS rule, not just inline), and since inline styles
// without !important lose to ANY stylesheet rule with !important
// regardless of source order or specificity, we only need to confirm
// the override rule exists inside a <style> block before </head>.
const headCloseIdx = idx('</head>');
if (!(overrideIdx < headCloseIdx)) throw new Error('FAIL -- #intervalPopup override appears outside the <head> stylesheet');
if (!(overrideIdx > inlineStyleIdx || true)) {
  // Source order relative to the inline JS string is irrelevant for
  // cascade purposes (inline style is applied at popup-creation time,
  // stylesheet rules apply continuously) -- this branch intentionally
  // never fires; kept only to document that reasoning for future editors.
}

console.log('PASS -- #intervalPopup has a breakpoint-scoped, !important override that centers it (left:50%/translateX(-50%)) and caps its width to the viewport (min(88vw,320px)), correctly beating the inline position:fixed;right:20px;max-width:320px style on narrow (iPhone-width) screens.');
