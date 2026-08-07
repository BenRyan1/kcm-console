// Regression test for: "still did not get it to populate the correct
// views.. make the stencil populate the CIRCLE FRETBOARD AND KEYBOARD!!"
//
// Root cause (found after the first Stencil Overlay fix still didn't work
// for the user's actual workflow): updatePattern() unconditionally
// re-synced currentStencil to whatever the main app's CURRENT level/root
// happened to be, EVERY time it ran -- including on every view switch
// (updateDisplay() re-runs updatePattern() ~80ms after any .view-btn
// click, even though nothing about the actual note selection changed).
// So the sequence "browse the Stencil library, pick Major scale, turn on
// Stencil Overlay, click Guitar" silently stomped the manually-picked
// Major scale back to whatever the untouched default level was (Single
// Note) the instant the view switched -- the real fretboard then lit up
// with just the root note, not the picked stencil.
//
// Fixed with a pin: selectStencil() (and loadChordAsStencil(), and the key
// ring / drag-rotate root changes) now mark currentStencil as manually
// pinned with a snapshot of (currentLevel, rootNote) at pin time.
// updatePattern()'s auto-sync only overwrites currentStencil when that
// snapshot no longer matches live state -- i.e. only when the user made an
// ACTUAL pattern change (a note click, a level pick), not just switched
// which view is showing.
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

function setEqual(gotSet, expectedArr) {
  const a = Array.from(gotSet).map(Number).sort((x,y)=>x-y);
  const b = expectedArr.slice().sort((x,y)=>x-y);
  return a.length === b.length && a.every((v,i) => v === b[i]);
}

setTimeout(() => {
  const doc = window.document;
  try {
    doc.getElementById('startAudio').click();
    setTimeout(() => {
      // Exact reported sequence: Stencil tab -> pick Major scale (grid) ->
      // Stencil Overlay ON -> Guitar -> Keyboard -> Circle.
      doc.querySelector('.view-btn[data-view="stencil"]')?.click();

      setTimeout(() => {
        const majorBtn = doc.querySelector('.kcm-stencil-shape-btn[data-stencil-id="major"]');
        if (!majorBtn) { console.log('FAIL: Major scale button not found in Stencil grid'); process.exit(1); }
        majorBtn.click();

        const expectedPcs = window.currentStencil.intervals.map(iv => ((window.currentStencilRoot || 0) + iv) % 12);
        if (expectedPcs.length !== 7) { console.log('FAIL: expected the 7-note Major scale, got', expectedPcs); process.exit(1); }

        doc.getElementById('stencilOverlayBtn')?.click(); // overlay ON
        doc.querySelector('.view-btn[data-view="guitar"]')?.click();

        setTimeout(() => {
          if (!window._stencilManuallyPinned) {
            console.log('FAIL: stencil pin was lost after switching to Guitar (currentStencil =', JSON.stringify(window.currentStencil), ')');
            process.exit(1);
          }
          const guitarPcs = new Set(Array.from(doc.querySelectorAll('.fb-cell.fb-on')).map(c => parseInt(c.dataset.note, 10)));
          if (!setEqual(guitarPcs, expectedPcs)) {
            console.log('FAIL: Guitar fb-on notes after switching views =', Array.from(guitarPcs).sort((a,b)=>a-b),
                        'expected the pinned Major scale', expectedPcs.slice().sort((a,b)=>a-b));
            process.exit(1);
          }

          doc.querySelector('.view-btn[data-view="keyboard"]')?.click();
          setTimeout(() => {
            const keyPcs = new Set(
              Array.from(doc.querySelectorAll('.white-key,.black-key'))
                .filter(k => k.style.borderColor && k.style.borderColor !== '')
                .map(k => parseInt(k.dataset.note, 10))
            );
            if (!setEqual(keyPcs, expectedPcs)) {
              console.log('FAIL: Keyboard highlighted notes after switching views =', Array.from(keyPcs).sort((a,b)=>a-b),
                          'expected the pinned Major scale', expectedPcs.slice().sort((a,b)=>a-b));
              process.exit(1);
            }

            // Now prove the pin correctly releases on a REAL pattern change:
            // clicking a Triad level should override the manually pinned
            // Major scale, not fight it forever.
            doc.querySelector('.level-btn[data-level="3"]')?.click();
            setTimeout(() => {
              if (window._stencilManuallyPinned) {
                console.log('FAIL: pin should have released after a real level change (Triads), but is still pinned');
                process.exit(1);
              }
              if (!window.currentStencil || window.currentStencil.intervals.length === 7) {
                console.log('FAIL: currentStencil should have resynced to the Triad, still shows the old 7-note scale:', JSON.stringify(window.currentStencil));
                process.exit(1);
              }
              console.log('PASS — manually-picked stencil survives Guitar/Keyboard view switches, and correctly releases on a real pattern change.');
              process.exit(0);
            }, 200);
          }, 150);
        }, 150);
      }, 150);
    }, 150);
  } catch (e) {
    console.log('FAIL: threw —', e.message, e.stack);
    process.exit(1);
  }
}, 200);
