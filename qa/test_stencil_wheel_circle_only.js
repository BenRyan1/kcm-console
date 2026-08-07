// Regression test for: "artifact on next windows after interval..
// leftovers.. not supposed to interfere with fretboard keyboard" -- the
// small floating decorative Stencil wheel graphic (kcmStencilPanel with
// the .kcm-stencil-overlay class: a circular star/polygon SVG with
// numbered points and connector lines) was briefly extended to also float
// over Guitar/Keyboard, which put a circular diagram crossing over the
// rectangular fretboard/keyboard images -- confirmed visually as an
// unwanted artifact. Reverted so the wheel graphic only appears over the
// Circle (same round shape, same context); the real fretboard-cell/
// piano-key/circle-sphere highlighting (a separate mechanism) still shows
// the stencil's actual notes on every view.
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
      // Reproduce: pick Triads level (auto-syncs a stencil), turn overlay
      // on, then check the wheel panel on Circle (should float), Guitar,
      // and Keyboard (should NOT float / should not even be shown).
      doc.querySelector('.level-btn[data-level="3"]')?.click();
      setTimeout(() => {
        doc.getElementById('stencilOverlayBtn')?.click(); // overlay ON
        const stencil = doc.getElementById('kcmStencilPanel');

        // Circle (default view) -- the wheel SHOULD float here.
        if (!stencil.classList.contains('kcm-stencil-overlay')) {
          console.log('FAIL: expected the floating wheel on Circle view, kcm-stencil-overlay class missing. classes=', stencil.className);
          process.exit(1);
        }

        doc.querySelector('.view-btn[data-view="guitar"]')?.click();
        setTimeout(() => {
          if (stencil.classList.contains('kcm-stencil-overlay') || stencil.style.display === 'block') {
            console.log('FAIL: floating wheel is showing over Guitar view (classes=' + stencil.className + ', display=' + stencil.style.display + ') -- this is the reported artifact.');
            process.exit(1);
          }
          // Real fretboard highlighting should still work though.
          const litPcs = new Set(Array.from(doc.querySelectorAll('.fb-cell.fb-on')).map(c => parseInt(c.dataset.note, 10)));
          if (litPcs.size === 0) {
            console.log('FAIL: no fretboard cells lit on Guitar view -- real highlighting broke along with removing the wheel.');
            process.exit(1);
          }

          doc.querySelector('.view-btn[data-view="keyboard"]')?.click();
          setTimeout(() => {
            if (stencil.classList.contains('kcm-stencil-overlay') || stencil.style.display === 'block') {
              console.log('FAIL: floating wheel is showing over Keyboard view (classes=' + stencil.className + ', display=' + stencil.style.display + ') -- this is the reported artifact.');
              process.exit(1);
            }
            const litKeys = Array.from(doc.querySelectorAll('.white-key,.black-key')).filter(k => k.style.borderColor && k.style.borderColor !== '');
            if (litKeys.length === 0) {
              console.log('FAIL: no piano keys lit on Keyboard view -- real highlighting broke along with removing the wheel.');
              process.exit(1);
            }
            console.log('PASS — floating Stencil wheel only shows over the Circle, not Guitar/Keyboard; real fretboard/keyboard highlighting still works on both.');
            process.exit(0);
          }, 150);
        }, 150);
      }, 150);
    }, 150);
  } catch (e) {
    console.log('FAIL: threw —', e.message, e.stack);
    process.exit(1);
  }
}, 200);
