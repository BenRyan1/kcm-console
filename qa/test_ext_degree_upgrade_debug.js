// Confirms the underlying data model (selectedNotes/currentExtDegree)
// updates correctly every time as you step through Ext. Chords degrees
// 7 -> 9 -> 13 -> 7, one at a time with plenty of settle time between
// clicks (the companion test test_ext_degree_rapid_switch.js covers the
// rapid-click / mid-arpeggio-interrupt case that was the actual reported
// bug). This rules the pattern-computation layer (getExtChordIntervals /
// updatePattern) in or out as a suspect independently of the display
// layer.
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

function setEqual(got, expected) {
  const a = Array.from(got).map(Number).sort((x,y)=>x-y);
  const b = expected.slice().sort((x,y)=>x-y);
  return a.length === b.length && a.every((v,i) => v === b[i]);
}

function check(label, degree, notes) {
  if (window.currentExtDegree !== degree) {
    console.log(`FAIL: after switching to ${label}, currentExtDegree = ${window.currentExtDegree}, expected ${degree}`);
    process.exit(1);
  }
  if (!setEqual(window.selectedNotes, notes)) {
    console.log(`FAIL: after switching to ${label}, selectedNotes = ${Array.from(window.selectedNotes).sort((a,b)=>a-b)}, expected ${notes}`);
    process.exit(1);
  }
}

setTimeout(() => {
  const doc = window.document;
  try {
    doc.getElementById('startAudio').click();
    setTimeout(() => {
      doc.querySelector('.level-btn[data-level="4"]').click();
      setTimeout(() => {
        check('7th (initial)', '7', [0, 4, 7, 11]);
        window.switchExtDegree('9');
        setTimeout(() => {
          check('9th', '9', [0, 2, 4, 7, 11]);
          window.switchExtDegree('13');
          setTimeout(() => {
            check('13th', '13', [0, 2, 4, 5, 7, 9, 11]);
            const btn13 = doc.querySelector('.ext-degree-btn[data-ext-degree="13"]');
            if (!btn13 || btn13.getAttribute('onclick') !== "switchExtDegree('13')") {
              console.log('FAIL: 13th degree button missing or wired to the wrong handler');
              process.exit(1);
            }
            window.switchExtDegree('7');
            setTimeout(() => {
              check('7th (again)', '7', [0, 4, 7, 11]);
              console.log('PASS — Ext. Chords data model (currentExtDegree/selectedNotes) updates correctly across 7 -> 9 -> 13 -> 7.');
              process.exit(0);
            }, 300);
          }, 300);
        }, 300);
      }, 200);
    }, 200);
  } catch (e) {
    console.log('FAIL: threw —', e.message);
    process.exit(1);
  }
}, 200);
