// Verifies #progressionControls/#chordVoicingPanel still show correctly
// after being relocated to the TOP of the right column (this panel has
// moved twice now -- center column, then left column, now right column
// top -- so this test asserts wherever the current explicit request put
// it, not a hardcoded assumption). The JS that toggles visibility
// (updateView()) only does getElementById lookups, so location
// shouldn't matter functionally, but confirming both the DOM location
// and the functional show/hide behavior together.
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
      // Confirm both elements exist inside kcm-right-col (current
      // expected home), not left/center, and that progressionControls
      // sits at the very TOP of the column (first element child) per
      // the explicit 'upper right corner' request.
      const leftCol = doc.querySelector('.kcm-left-col');
      const centerCol = doc.querySelector('.kcm-center-col');
      const rightCol = doc.querySelector('.kcm-right-col');
      const pc = doc.getElementById('progressionControls');
      const cvp = doc.getElementById('chordVoicingPanel');
      if (!rightCol.contains(pc)) { console.log('FAIL: progressionControls not inside kcm-right-col'); process.exit(1); }
      if (!rightCol.contains(cvp)) { console.log('FAIL: chordVoicingPanel not inside kcm-right-col'); process.exit(1); }
      if (leftCol.contains(pc) || leftCol.contains(cvp)) { console.log('FAIL: still (also) inside kcm-left-col'); process.exit(1); }
      if (centerCol.contains(pc) || centerCol.contains(cvp)) { console.log('FAIL: still (also) inside kcm-center-col'); process.exit(1); }
      if (rightCol.firstElementChild !== pc) { console.log('FAIL: progressionControls is not the first child of kcm-right-col (not at the top)'); process.exit(1); }

      // Click Harmonized level button and confirm the panel becomes visible.
      const harmBtn = doc.querySelector('.level-btn[data-level="harm"]');
      harmBtn.click();
      const harmMajorPill = doc.querySelector('.harm-key-btn[data-harm-key="harmMajor"]');
      harmMajorPill.click();

      setTimeout(() => {
        const display = pc.style.display;
        if (display === 'none' || display === '') {
          console.log('FAIL: progressionControls still hidden after switching to Harmonized Major, display=' + display);
          process.exit(1);
        }
        console.log('PASS \u2014 panels relocated to the top of the right column and still correctly show/hide via updateView() when Harmonized is selected.');
        process.exit(0);
      }, 300);
    }, 150);
  } catch (e) {
    console.log('FAIL: threw —', e.message);
    process.exit(1);
  }
}, 200);
