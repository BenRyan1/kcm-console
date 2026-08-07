// Regression test for: "sound goes down, dots go up" in the Pentatonic
// Timeline. Root cause: playSelection() (the engine behind the KCM Control
// Dock's Desc button and the sidebar's Descending button) had no way to
// tell the Timeline widget which direction it was about to play — Timeline
// always redrew its own separately-recomputed, hardcoded-ascending layout
// regardless. Fixed by having playSelection() broadcast the exact
// pc/octave sequence it's about to play via a 'kcm:playNotes' event, which
// the Timeline now uses directly instead of guessing.
//
// This test verifies two things: (1) playSelection('down') broadcasts a
// descending phase whose pc sequence matches downSeq (high to low), and
// (2) the Timeline SVG, once it finishes animating that broadcast, ends up
// with its note-head dots laid out in that same descending order (cy
// increasing left-to-right = pitch going DOWN), not the old fixed-ascending
// layout.
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
    // jsdom doesn't implement requestAnimationFrame by default in all
    // versions — polyfill with a fast setTimeout-based version so the
    // Timeline's animate() loop actually progresses to completion quickly.
    window.requestAnimationFrame = (cb) => setTimeout(() => cb(performance.now()), 4);
    window.cancelAnimationFrame = (id) => clearTimeout(id);
  }
});
const { window } = dom;

setTimeout(() => {
  const doc = window.document;
  try {
    doc.getElementById('startAudio').click();
    setTimeout(() => {
      // Switch to Pentatonic, root C, major.
      doc.querySelector('.level-btn[data-level="5"]').click();
      setTimeout(() => {
        // Open the Timeline tab so its listener is live and the SVG visible.
        window.switchStaffTab('timeline');

        // Capture the broadcast directly.
        let capturedPhases = null;
        window.addEventListener('kcm:playNotes', (e) => { capturedPhases = e.detail.phases; });

        if (typeof window.playSelection !== 'function') {
          console.log('FAIL: window.playSelection not found');
          process.exit(1);
        }
        window.playSelection('down');

        setTimeout(() => {
          if (!capturedPhases) {
            console.log('FAIL: kcm:playNotes event was never dispatched for playSelection(\'down\')');
            process.exit(1);
          }
          const seq = capturedPhases[0].seq.map(n => n.pc);
          const expectedDown = [9, 7, 4, 2, 0]; // C major pentatonic, descending from A
          if (JSON.stringify(seq) !== JSON.stringify(expectedDown)) {
            console.log('FAIL: broadcast phase pc sequence =', seq, 'expected', expectedDown);
            process.exit(1);
          }

          // Now let the Timeline's own animation run to completion and check
          // the actual rendered dots reflect a descending contour. Checked
          // right after the animation finishes (5 notes * 500ms beat =
          // 2500ms) but before the post-playback revert-to-static timer
          // (fires 300ms after completion) resets the SVG back to the
          // default ascending resting view — same revert pattern the
          // original ascending-only tlPlay() already used, so catching the
          // display in that in-between window is the correct way to check
          // what it showed *during/immediately after* the descending run.
          setTimeout(() => {
            const svg = doc.getElementById('timelineSVG');
            const dots = Array.from(svg.querySelectorAll('.tl-note-head'))
              .map(d => ({ pc: parseInt(d.dataset.pc, 10), cy: parseFloat(d.getAttribute('cy')) }))
              .sort((a, b) => a.pc === b.pc ? 0 : 0); // keep DOM order (left-to-right = time order)
            if (dots.length !== 5) {
              console.log('FAIL: expected 5 note-head dots after descending playback, got', dots.length, dots);
              process.exit(1);
            }
            const pcOrder = dots.map(d => d.pc);
            if (JSON.stringify(pcOrder) !== JSON.stringify(expectedDown)) {
              console.log('FAIL: rendered dot pc order =', pcOrder, 'expected', expectedDown, '(descending)');
              process.exit(1);
            }
            // cy should be non-decreasing left-to-right (pitch going DOWN
            // means the note sits lower on the staff = larger cy).
            for (let i = 1; i < dots.length; i++) {
              if (dots[i].cy < dots[i - 1].cy - 0.001) {
                console.log('FAIL: dot', i, 'cy went up (' + dots[i].cy + ' < ' + dots[i-1].cy + ') during what should be a descending run');
                process.exit(1);
              }
            }
            console.log('PASS — Timeline mirrors playSelection(\'down\') exactly: broadcast + rendered dots both descend, matching the audio.');
            process.exit(0);
          }, 2650);
        }, 100);
      }, 200);
    }, 150);
  } catch (e) {
    console.log('FAIL: threw —', e.message, e.stack);
    process.exit(1);
  }
}, 200);
