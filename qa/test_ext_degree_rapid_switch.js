// Regression test for: "when we play the extended chords, the notes are
// not consistent -- if I play 7th, then try to play the 9th, [display]
// stays on the old, doesn't upgrade correctly."
//
// Root cause: playExtChordAscending() (and the analogous Triads/7th-chord
// note-click handler blocks) staggered each arpeggio note with a raw,
// uncancelable setTimeout, and never scheduled a final "restore full
// chord" step after the last note. Rapidly switching degrees left old
// callbacks from the previous, still-in-flight arpeggio free to fire
// later and stomp the newer chord's staff display with a stale single
// note. Fixed by routing every scheduled callback through the app's
// _schedPlay()/_cancelAllPlay() cancelable-timer system and adding a
// final restore-the-full-chord step.
//
// This test simulates the exact rapid-click scenario: switch to 7th,
// then immediately (before its ~4-note arpeggio finishes) switch to 9th,
// then wait for everything to settle, and confirms the FINAL displayed
// state matches the 9th chord -- not a leftover note from the 7th.
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

function pcSetEqual(a, b) {
  const sa = Array.from(a).map(Number).sort((x,y)=>x-y);
  const sb = Array.from(b).map(Number).sort((x,y)=>x-y);
  return sa.length === sb.length && sa.every((v,i) => v === sb[i]);
}

setTimeout(() => {
  const doc = window.document;
  try {
    doc.getElementById('startAudio').click();
    setTimeout(() => {
      doc.querySelector('.level-btn[data-level="4"]').click();
      setTimeout(() => {
        // Fire 7th, then immediately (mid-arpeggio) fire 9th -- rapid switch.
        window.switchExtDegree('7');
        setTimeout(() => {
          window.switchExtDegree('9');
          // Wait well past both arpeggios' full duration + restore delay.
          setTimeout(() => {
            const expected9th = [0, 2, 4, 7, 11]; // major7 [0,4,7,11] + 9th add [14]->pc2
            const got = Array.from(window.selectedNotes).map(Number);
            if (!pcSetEqual(got, expected9th)) {
              console.log('FAIL: selectedNotes after rapid 7th->9th switch =', got.sort((a,b)=>a-b), 'expected', expected9th);
              process.exit(1);
            }
            console.log('PASS — rapid 7th -> 9th degree switch settles on the correct 9th-chord note set, no stale leftover from the 7th arpeggio.');
            process.exit(0);
          }, 2000);
        }, 50); // fire the 9th switch while the 7th's arpeggio timers are still pending
      }, 200);
    }, 150);
  } catch (e) {
    console.log('FAIL: threw —', e.message);
    process.exit(1);
  }
}, 200);
