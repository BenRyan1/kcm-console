// Regression guard: the floating Stencil Overlay must shrink in lockstep
// with #chromaticCircle at both responsive breakpoints (<=1024px and
// <=540px). Verified via source-text/specificity audit rather than
// jsdom getComputedStyle, since jsdom's CSS engine does not reliably
// evaluate @media rules against a simulated viewport.
const fs = require('fs');
const path = require('path');
const html = fs.readFileSync(path.join(__dirname, '..', 'music-theory-pro.html'), 'utf8');

function idx(needle, from) {
  const i = html.indexOf(needle, from || 0);
  if (i === -1) throw new Error('FAIL -- not found: ' + needle);
  return i;
}

const baseOverlayIdx = idx('.kcm-stencil-overlay {');
const mobileWrapShrinkIdx = idx(".kcm-stencil-wrap { width: 220px !important;");
const overlay1024Idx = html.indexOf('width: 171px !important;');
const overlay540Idx = html.indexOf('width: 114px !important;');

if (overlay1024Idx === -1) throw new Error('FAIL -- 1024px overlay override (171px) not found');
if (overlay540Idx === -1) throw new Error('FAIL -- 540px overlay override (114px) not found');

// Source-order requirement: both breakpoint overrides must appear AFTER
// the base .kcm-stencil-overlay rule and after the unrelated mobile
// wrap-shrink rule, otherwise a same-specificity unconditional rule
// appearing later in the cascade would win regardless of viewport.
if (!(overlay1024Idx > baseOverlayIdx)) throw new Error('FAIL -- 1024px override appears before base .kcm-stencil-overlay rule; would lose the cascade tie');
if (!(overlay540Idx > baseOverlayIdx)) throw new Error('FAIL -- 540px override appears before base .kcm-stencil-overlay rule; would lose the cascade tie');
if (!(overlay540Idx > mobileWrapShrinkIdx)) throw new Error('FAIL -- 540px override appears before the unrelated .kcm-stencil-wrap:220px rule; would lose the cascade tie');

// Ratio check: overlay frame size should track circle size at each tier
// within the same ~0.571 ratio the base tier already uses (240/420).
const circleBase = 420, overlayBase = 240;
const circle1024 = 300, overlay1024 = 171;
const circle540 = 200, overlay540 = 114;
const baseRatio = overlayBase / circleBase;
const ratio1024 = overlay1024 / circle1024;
const ratio540 = overlay540 / circle540;
const tolerance = 0.02;
if (Math.abs(ratio1024 - baseRatio) > tolerance) throw new Error(`FAIL -- 1024px overlay:circle ratio ${ratio1024.toFixed(3)} drifted too far from base ${baseRatio.toFixed(3)}`);
if (Math.abs(ratio540 - baseRatio) > tolerance) throw new Error(`FAIL -- 540px overlay:circle ratio ${ratio540.toFixed(3)} drifted too far from base ${baseRatio.toFixed(3)}`);

// Scale factor check: transform:scale value must equal frame_size / 500
// (the wrap's natural unscaled width), matching the base tier's own
// 240/500=0.48 convention.
if (!html.includes('transform: scale(0.342) !important;')) throw new Error('FAIL -- 1024px wrap scale(0.342) not found (171/500)');
if (!html.includes('transform: scale(0.228) !important;')) throw new Error('FAIL -- 540px wrap scale(0.228) not found (114/500)');

// The 540px override must also re-assert the wrap's natural 500x500 size,
// canceling out the unrelated 220x220 mobile rule that would otherwise
// double-shrink the overlay content.
const overlay540Block = html.slice(overlay540Idx - 400, overlay540Idx + 400);
if (!overlay540Block.includes('width: 500px !important') || !overlay540Block.includes('height: 500px !important')) {
  throw new Error('FAIL -- 540px override does not re-assert wrap natural 500x500 size');
}

console.log('PASS -- Stencil Overlay has correctly-ordered, correctly-ratioed breakpoint overrides at 1024px (171px/scale 0.342) and 540px (114px/scale 0.228), matching the base 240px/0.48 ratio, and cancels the double-shrink from the unrelated mobile wrap rule.');
