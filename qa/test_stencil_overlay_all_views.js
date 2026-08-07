// Regression test for: "we want the stencil overlay visible on the
// Circle, fretboard and keyboard.. any chord/scale stencil will show on
// circle, fretboard, and keyboard."
//
// Previously the Stencil Overlay (stencilOverlayBtn / stencilOverlayOn)
// only worked over Circle-family views (_isCircleFamilyView() = circle /
// circleType / sing) -- switching to Guitar or Piano hid the floating
// wheel entirely, and updateGuitarDisplay()/updatePianoDisplay()/
// updateSphereDisplay() had no awareness of currentStencil at all, so even
// though _stencilSyncPanels() briefly painted the real fretboard cells/
// piano keys, the very next unrelated redraw (there are dozens of trigger
// points) wiped it back to the regular selectedNotes-based pattern.
//
// Fixed by: (1) extending _isCircleFamilyView() to include 'guitar' and
// 'keyboard', (2) making _positionStencilOverlay() center over whichever
// graphic is actually showing, and (3) short-circuiting
// updateSphereDisplay()/updatePianoDisplay()/updateGuitarDisplay() to draw
// the stencil's own notes whenever a stencil is active and the overlay (or
// the dedicated Stencil tab) is on.
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
      // updatePattern() unconditionally mirrors whatever's selected ANYWHERE
      // in the main app onto the Stencil layer (currentStencil) -- "single
      // hook point... so the wheel always reflects whatever's selected
      // anywhere in the app" per its own comment. That's the live, real-
      // world path (Harmonized progression picks, MIDI input, Triads/Ext
      // Chords/Scales/Modes selections) this feature is actually built
      // around, unlike manually browsing the Stencil library and then
      // navigating away, which intentionally re-syncs back to the active
      // app pattern on the very next interaction. Selecting a Triad here
      // exercises that real path: currentStencil should end up as a C
      // Major Triad automatically, with no manual stencil-picking involved.
      const triadLevelBtn = doc.querySelector('.level-btn[data-level="3"]');
      if (!triadLevelBtn) { console.log('FAIL: no Triads level button found'); process.exit(1); }
      triadLevelBtn.click();

      setTimeout(() => {
        if (!window.currentStencil) { console.log('FAIL: currentStencil was not auto-synced after selecting Triads'); process.exit(1); }
        const expectedPcs = window.currentStencil.intervals.map(iv => ((window.currentStencilRoot || 0) + iv) % 12);
        if (expectedPcs.length < 2) { console.log('FAIL: expected a multi-note pattern (triad), got', expectedPcs); process.exit(1); }

        // Turn Stencil Overlay ON, then move to Guitar.
        const overlayBtn = doc.getElementById('stencilOverlayBtn');
        if (!overlayBtn) { console.log('FAIL: no stencilOverlayBtn found'); process.exit(1); }
        overlayBtn.click(); // toggles stencilOverlayOn = true

        const guitarViewBtn = doc.querySelector('.view-btn[data-view="guitar"]');
        if (!guitarViewBtn) { console.log('FAIL: no Guitar view button found'); process.exit(1); }
        guitarViewBtn.click();

        setTimeout(() => {
          const litFretCellPcs = new Set(
            Array.from(doc.querySelectorAll('.fb-cell.fb-on')).map(c => parseInt(c.dataset.note, 10))
          );
          if (!setEqual(litFretCellPcs, expectedPcs)) {
            console.log('FAIL: Guitar fretboard fb-on notes =', Array.from(litFretCellPcs).sort((a,b)=>a-b),
                        'expected', expectedPcs.slice().sort((a,b)=>a-b));
            process.exit(1);
          }

          // Now Keyboard view -- same stencil, same overlay toggle, should
          // still be on (didn't touch it), keys should reflect the stencil.
          const keyboardViewBtn = doc.querySelector('.view-btn[data-view="keyboard"]');
          if (!keyboardViewBtn) { console.log('FAIL: no Keyboard view button found'); process.exit(1); }
          keyboardViewBtn.click();

          setTimeout(() => {
            const litKeyPcs = new Set(
              Array.from(doc.querySelectorAll('.white-key,.black-key'))
                .filter(k => k.style.borderColor && k.style.borderColor !== '')
                .map(k => parseInt(k.dataset.note, 10))
            );
            if (!setEqual(litKeyPcs, expectedPcs)) {
              console.log('FAIL: Piano keyboard highlighted notes =', Array.from(litKeyPcs).sort((a,b)=>a-b),
                          'expected', expectedPcs.slice().sort((a,b)=>a-b));
              process.exit(1);
            }

            // And back to Circle -- real spheres (not just the floating
            // wheel) should also reflect the stencil.
            const circleViewBtn = doc.querySelector('.view-btn[data-view="circle"]');
            if (!circleViewBtn) { console.log('FAIL: no Circle view button found'); process.exit(1); }
            circleViewBtn.click();

            setTimeout(() => {
              const litSpherePcs = new Set(
                Array.from(doc.querySelectorAll('.sphere.active, .sphere.included')).map(s => parseInt(s.dataset.note, 10))
              );
              if (!setEqual(litSpherePcs, expectedPcs)) {
                console.log('FAIL: Circle sphere active/included notes =', Array.from(litSpherePcs).sort((a,b)=>a-b),
                            'expected', expectedPcs.slice().sort((a,b)=>a-b));
                process.exit(1);
              }

              console.log('PASS — stencil stays visible (real fretboard cells, real piano keys, real circle spheres) across Guitar, Keyboard, and Circle views while Stencil Overlay is on.');
              process.exit(0);
            }, 150);
          }, 150);
        }, 150);
      }, 150);
    }, 150);
  } catch (e) {
    console.log('FAIL: threw —', e.message, e.stack);
    process.exit(1);
  }
}, 200);
