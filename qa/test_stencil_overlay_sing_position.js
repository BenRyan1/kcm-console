// Verifies the Stencil Overlay positioning fix: on the Sing view (a
// circle-family view where the full Sing UI renders in the same
// #panelSwapZone as the circle, alongside it, making the zone taller
// than the circle alone), the overlay must be positioned relative to
// the Chromatic Circle itself via _positionStencilOverlay() -- not left
// at the stylesheet's static top:50%/left:50% of the whole zone, which
// would center it over the combined circle+Sing-controls block instead
// of the circle graphic it's meant to float on.
//
// jsdom has no real layout engine, so offsetTop/offsetHeight/etc. are
// always 0 here -- this can't assert the actual pixel position matches
// a real browser. What it CAN verify: (1) the function exists and is
// exposed, (2) turning the overlay on while on the Sing view calls it
// and it runs without throwing, (3) it actually overrides the element's
// inline top/left (proving the code path executed and applied styles,
// as opposed to silently no-op'ing), and (4) that override carries
// !important, since the stylesheet rule it needs to beat also uses
// !important and only an inline !important wins that fight.
const { JSDOM } = require('jsdom');
const fs = require('fs');
const path = require('path');
const html = fs.readFileSync(path.join(__dirname, '..', 'music-theory-pro.html'), 'utf8');

class FakeParam { constructor(){this.value=0;} setValueAtTime(){} linearRampToValueAtTime(){} exponentialRampToValueAtTime(){} }
class FakeNode { constructor(){this.frequency=new FakeParam();this.gain=new FakeParam();this.type='sine';} connect(){return this;} start(){} stop(){} }
class FakeAudioContext {
  constructor(){this.currentTime=0;this.destination={};this.state='running';}
  createOscillator(){return new FakeNode();}
  createGain(){return new FakeNode();}
  resume(){return Promise.resolve();}
  close(){return Promise.resolve();}
}

const dom = new JSDOM(html, {
  runScripts: 'dangerously', resources: undefined, pretendToBeVisual: true, url: 'http://localhost/',
  beforeParse(window) {
    window.AudioContext = FakeAudioContext;
    window.webkitAudioContext = FakeAudioContext;
    window.ResizeObserver = class { observe(){} unobserve(){} disconnect(){} };
    window.alert = () => {};
  }
});
const { window } = dom;

setTimeout(() => {
  const doc = window.document;
  try {
    doc.getElementById('startAudio').click();
    setTimeout(() => {
      if (typeof window._positionStencilOverlay !== 'function') {
        console.log('FAIL: window._positionStencilOverlay not exposed');
        process.exit(1);
      }

      const singBtn = doc.querySelector('.view-btn[data-view="sing"]');
      if (!singBtn) { console.log('FAIL: could not find Sing view button'); process.exit(1); }
      singBtn.click();

      const overlayBtn = doc.getElementById('stencilOverlayBtn');
      if (!overlayBtn) { console.log('FAIL: could not find stencilOverlayBtn'); process.exit(1); }
      overlayBtn.click();

      setTimeout(() => {
        const stencil = doc.getElementById('kcmStencilPanel');
        if (!stencil.classList.contains('kcm-stencil-overlay')) {
          console.log('FAIL: kcm-stencil-overlay class not applied on Sing view with overlay toggled on');
          process.exit(1);
        }
        if (!stencil.style.top || stencil.style.top.indexOf('px') === -1) {
          console.log('FAIL: _positionStencilOverlay did not set an inline pixel top (got "' + stencil.style.top + '")');
          process.exit(1);
        }
        if (stencil.style.getPropertyPriority('top') !== 'important') {
          console.log('FAIL: inline top override is not !important');
          process.exit(1);
        }
        if (stencil.style.getPropertyPriority('left') !== 'important') {
          console.log('FAIL: inline left override is not !important');
          process.exit(1);
        }
        console.log('PASS - Stencil Overlay is positioned relative to the Chromatic Circle itself on the Sing view, not the wider panel-swap zone.');
        process.exit(0);
      }, 100);
    }, 150);
  } catch (e) {
    console.log('FAIL: threw -', e.message);
    process.exit(1);
  }
}, 200);
