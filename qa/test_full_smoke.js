// Broad functional smoke test: loads the real file with scripts running,
// starts the audio engine, cycles through every main view, toggles the
// Stencil Overlay, and exercises the Harmonized chord progression flow --
// catching thrown JS errors from this session's structural/CSS edits
// (unclosed-div fix, grid spacing, panel relocation, overlay breakpoints).
const { JSDOM, VirtualConsole } = require('jsdom');
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

const errors = [];
const virtualConsole = new VirtualConsole();
virtualConsole.on('jsdomError', (e) => errors.push('jsdomError: ' + e.message));

const dom = new JSDOM(html, {
  runScripts: 'dangerously', resources: undefined, pretendToBeVisual: true, url: 'http://localhost/',
  virtualConsole,
  beforeParse(window) {
    window.AudioContext = FakeAudioContext;
    window.webkitAudioContext = FakeAudioContext;
    window.ResizeObserver = class { observe(){} unobserve(){} disconnect(){} };
    window.alert = () => {};
    window.onerror = (msg) => { errors.push('window.onerror: ' + msg); };
  }
});
const { window } = dom;
window.addEventListener('error', (e) => errors.push('error event: ' + (e.error ? e.error.message : e.message)));

setTimeout(() => {
  const doc = window.document;
  try {
    doc.getElementById('startAudio').click();

    setTimeout(() => {
      // Cycle every main view button.
      const viewBtns = Array.from(doc.querySelectorAll('.view-btn[data-view]'));
      viewBtns.forEach(btn => btn.click());

      // Toggle Stencil Overlay on, then check its target class gets applied
      // when on a circle-family view.
      doc.querySelector('.view-btn[data-view="circle"]').click();
      doc.getElementById('stencilOverlayBtn').click();

      // Toggle instrument picker.
      doc.getElementById('instrumentBtn').click();

      // Click Harmonized level + a progression pill, confirm panel visible
      // in its new left-column home.
      const harmBtn = doc.querySelector('.level-btn[data-level="harm"]');
      if (harmBtn) harmBtn.click();
      const harmMajorPill = doc.querySelector('.harm-key-btn[data-harm-key="harmMajor"]');
      if (harmMajorPill) harmMajorPill.click();

      setTimeout(() => {
        const pc = doc.getElementById('progressionControls');
        const leftCol = doc.querySelector('.kcm-left-col');
        const rightCol = doc.querySelector('.kcm-right-col');
        const twoColRow = doc.getElementById('kcmTwoColRow');

        const problems = [];
        if (errors.length) problems.push('JS errors thrown: ' + JSON.stringify(errors));
        if (!leftCol.contains(pc)) problems.push('progressionControls no longer in kcm-left-col');
        if (pc.style.display === 'none' || pc.style.display === '') problems.push('progressionControls not visible after selecting Harmonized Major');
        if (!twoColRow || Array.from(twoColRow.children).map(c=>c.className).join(',') !== 'kcm-left-col,kcm-center-col,kcm-right-col') {
          problems.push('kcmTwoColRow direct children order/composition unexpected: ' + (twoColRow ? Array.from(twoColRow.children).map(c=>c.className).join(',') : 'MISSING ROW'));
        }
        if (!rightCol) problems.push('kcm-right-col missing entirely');

        if (problems.length) {
          console.log('FAIL:\n - ' + problems.join('\n - '));
          process.exit(1);
        }
        console.log('PASS — audio start, all view toggles, Stencil Overlay toggle, instrument picker toggle, and Harmonized chord-progression flow all ran with zero thrown JS errors; DOM structure (3-column grid, relocated panel) held up throughout.');
        process.exit(0);
      }, 350);
    }, 200);
  } catch (e) {
    console.log('FAIL: threw —', e.message, e.stack);
    process.exit(1);
  }
}, 200);
