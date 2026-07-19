// Regression test for a real bug: after the Stencil tab's wheel was
// resized from 500px down to 400px (base tier), a second element --
// #kcmStencilCircle, an always-empty, JS-never-touches-it placeholder
// div hardcoded to width:500px/height:500px via an INLINE style
// attribute -- was missed, since inline styles aren't affected by CSS
// class rule changes at all. Left at 500px inside a now-400px
// position:relative parent with no overflow:hidden, it silently
// overhung the wheel and sat on top of the shape-pill grid rendered
// right below in the document, intercepting clicks on whatever pills
// happened to fall under the overhang. Symptom reported by the user:
// "I can pick one stencil, then I can't do anything."
//
// IMPORTANT LIMITATION, stated plainly: jsdom has no real layout
// engine and does no click hit-testing against overlapping elements --
// a click via .click()/dispatchEvent always reaches its target
// regardless of what's stacked visually on top of it in a real
// browser. That means this exact class of bug (correct DOM structure
// and correct event listeners, but broken in a real browser purely
// because of overlapping boxes) could never have been caught by any
// jsdom-based test in this suite, including this one -- this test can
// only verify the STRUCTURAL fix (dead element removed, overflow
// safety net added), not the visual hit-testing behavior itself. A
// real-browser check remains the only way to fully confirm this class
// of bug is gone.
const fs = require('fs');
const path = require('path');
const html = fs.readFileSync(path.join(__dirname, '..', 'music-theory-pro.html'), 'utf8');

function fail(msg) { console.log('FAIL: ' + msg); process.exit(1); }

// 1. The dead #kcmStencilCircle placeholder must be gone entirely.
if (html.includes('id="kcmStencilCircle"')) {
  fail('#kcmStencilCircle still present in the markup -- the 500px-vs-400px overhang bug is not fixed');
}

// 2. .kcm-stencil-wrap's base rule must now clip overflow, as a safety
//    net against this exact class of bug recurring with any future
//    child element that isn't resized in lockstep.
const startIdx = html.indexOf('KCM STENCIL SYSTEM — New CSS Only');
const endIdx = html.indexOf('Stencil Overlay Mode', startIdx);
if (startIdx === -1 || endIdx === -1) fail('could not isolate the Stencil System CSS region');
const region = html.slice(startIdx, endIdx);

const baseWrapMatch = region.match(/\.kcm-stencil-wrap\s*\{[^}]*\}/);
if (!baseWrapMatch) fail('could not find base .kcm-stencil-wrap rule');
if (!/overflow:\s*hidden/.test(baseWrapMatch[0])) {
  fail('base .kcm-stencil-wrap rule does not clip overflow -- got: ' + baseWrapMatch[0]);
}

// 3. Confirm no functional reference to the removed element remains --
//    an id attribute, a JS lookup, or a CSS selector keyed off it.
//    (A plain-English mention inside this fix's own explanatory CSS
//    comment, added just above, is expected and fine -- only actual
//    code references would mean the removal is incomplete.)
if (/id=["']kcmStencilCircle["']/.test(html)) fail('id="kcmStencilCircle" attribute still present in markup');
if (/getElementById\(['"]kcmStencilCircle['"]\)/.test(html)) fail('JS still calls getElementById(\'kcmStencilCircle\')');
if (/#kcmStencilCircle\s*\{/.test(html)) fail('a CSS rule still targets #kcmStencilCircle');

console.log('PASS - dead #kcmStencilCircle overhang element removed, and .kcm-stencil-wrap now clips overflow as a safety net. (Real-browser check still recommended -- see comment header.)');
process.exit(0);
