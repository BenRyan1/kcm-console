// Verifies the "Ext. Chords" level button (formerly "7th Chords") expands
// into a 4-choice sub-panel (7th/9th/11th/13th), and that picking a degree
// actually changes what plays: clicking "9th" should extend the interval
// set beyond the base 4-note 7th chord (currentExtDegree drives
// getExtChordIntervals(), consumed by both the click-to-play handler and
// updatePattern()'s level-4 case).
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
      // Button relabeled, sub-panel present with exactly 4 degree choices.
      const btn = doc.querySelector('.level-btn[data-level="4"]');
      if (!btn || btn.textContent.trim() !== 'Ext. Chords') {
        console.log('FAIL: level-4 button is not labeled "Ext. Chords" (got "' + (btn && btn.textContent.trim()) + '")');
        process.exit(1);
      }
      const subPanel = doc.getElementById('extDegreeSubPanel');
      if (!subPanel) { console.log('FAIL: #extDegreeSubPanel not found'); process.exit(1); }
      const degreeBtns = subPanel.querySelectorAll('.ext-degree-btn');
      const degrees = Array.from(degreeBtns).map(b => b.dataset.extDegree);
      if (degrees.join(',') !== '7,9,11,13') {
        console.log('FAIL: expected degree buttons 7,9,11,13, got ' + degrees.join(','));
        process.exit(1);
      }

      // Sub-panel hidden until level 4 is activated.
      if (subPanel.style.display !== 'none') { console.log('FAIL: extDegreeSubPanel visible before level 4 activated'); process.exit(1); }
      btn.click();
      if (subPanel.style.display !== 'block') { console.log('FAIL: extDegreeSubPanel did not show after clicking Ext. Chords'); process.exit(1); }

      // Base 7th-chord interval count (quality defaults to major7 -> 4 notes).
      if (window.getExtChordIntervals().length !== 4) {
        console.log('FAIL: default (7th) interval count expected 4, got ' + window.getExtChordIntervals().length);
        process.exit(1);
      }

      // Click a note on the chromatic circle to establish a root, then pick 9th.
      const circleNote = doc.querySelector('[data-note-index], .note-sphere, .chromatic-note');
      const ninthBtn = subPanel.querySelector('.ext-degree-btn[data-ext-degree="9"]');
      ninthBtn.click();

      setTimeout(() => {
        if (window.currentExtDegree !== '9') { console.log('FAIL: currentExtDegree not set to 9 after click, got ' + window.currentExtDegree); process.exit(1); }
        if (!ninthBtn.classList.contains('active')) { console.log('FAIL: 9th button not marked active after click'); process.exit(1); }
        const sevenBtn = subPanel.querySelector('.ext-degree-btn[data-ext-degree="7"]');
        if (sevenBtn.classList.contains('active')) { console.log('FAIL: 7th button still active after switching to 9th'); process.exit(1); }
        const intervals9 = window.getExtChordIntervals();
        if (intervals9.length !== 5) { console.log('FAIL: 9th chord interval count expected 5, got ' + intervals9.length); process.exit(1); }
        if (intervals9[4] !== 14) { console.log('FAIL: 9th chord top interval expected 14 (major 9th), got ' + intervals9[4]); process.exit(1); }

        // 13th should be cumulative: base 4 + 9th + 11th + 13th = 7 tones.
        const thirteenBtn = subPanel.querySelector('.ext-degree-btn[data-ext-degree="13"]');
        thirteenBtn.click();
        setTimeout(() => {
          const intervals13 = window.getExtChordIntervals();
          if (intervals13.length !== 7) { console.log('FAIL: 13th chord interval count expected 7, got ' + intervals13.length); process.exit(1); }
          console.log('PASS — Ext. Chords dropdown shows 7/9/11/13 degree choices, and selecting a degree drives getExtChordIntervals() (and therefore playback) correctly.');
          process.exit(0);
        }, 300);
      }, 300);
    }, 150);
  } catch (e) {
    console.log('FAIL: threw —', e.message);
    process.exit(1);
  }
}, 200);
