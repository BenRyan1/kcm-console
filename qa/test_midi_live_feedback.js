// Verifies the live-MIDI feature added on top of the old bare-bones
// initMIDI(): (1) a single incoming note gets a distinct "outside the
// current scale" red-ring overlay when it doesn't belong to whatever
// pattern is active, and no such overlay when it does; (2) a strummed
// chord (several near-simultaneous note-ons) is correctly recognized
// and named via the debounced evaluateMidiChord()/midiChordSymbol()
// pipeline. Bypasses the real Web MIDI API (unavailable in jsdom) by
// calling window.handleMidiMessage() directly with fake MIDIMessageEvent
// -shaped objects, which is exactly what a real MIDI input's
// onmidimessage callback would receive.
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

function noteOn(n, vel) { window.handleMidiMessage({ data: [0x90, n, vel === undefined ? 100 : vel] }); }
function noteOff(n) { window.handleMidiMessage({ data: [0x80, n, 0] }); }

setTimeout(() => {
  const doc = window.document;
  try {
    doc.getElementById('startAudio').click();
    setTimeout(() => {
      if (typeof window.handleMidiMessage !== 'function') { console.log('FAIL: window.handleMidiMessage not exposed'); process.exit(1); }

      // Activate Scales -> Major (Ionian) so a pattern is live to test against.
      const scalesBtn = doc.querySelector('.level-btn[data-level="scales"]');
      if (!scalesBtn) { console.log('FAIL: could not find Scales level button'); process.exit(1); }
      scalesBtn.click();
      const majorBtn = doc.querySelector('.scale-type-btn[data-scale-type="major"]');
      if (!majorBtn) { console.log('FAIL: could not find Major scale-type button'); process.exit(1); }
      majorBtn.click();

      setTimeout(() => {
        const pattern = window.currentPatternIntervals;
        if (!pattern || !pattern.length) { console.log('FAIL: no active pattern after activating Major Scale'); process.exit(1); }

        // Root defaults to C (pc 0). C major scale contains pc 1? No (C# is not
        // in C major) -- use that as the "outside" note, and pc 0 (root) as "inside".
        noteOn(60); // C4 -- in C major
        setTimeout(() => {
          const sphereC = doc.querySelector('.sphere[data-note="0"]');
          if (sphereC.style.border && sphereC.style.border.indexOf('255, 85, 85') !== -1) {
            console.log('FAIL: in-scale note (C) incorrectly marked as outside-scale (red)');
            process.exit(1);
          }
          noteOff(60);

          noteOn(61); // C#4 -- NOT in C major
          setTimeout(() => {
            const sphereCs = doc.querySelector('.sphere[data-note="1"]');
            if (!sphereCs.style.border || sphereCs.style.border.indexOf('255, 85, 85') === -1) {
              console.log('FAIL: out-of-scale note (C#) not marked with the red outside-scale ring, got border="' + sphereCs.style.border + '"');
              process.exit(1);
            }
            noteOff(61);

            // ── Chord recognition: strum a C major triad (C4 E4 G4) ──
            noteOn(60); noteOn(64); noteOn(67);
            setTimeout(() => {
              const readout = doc.getElementById('midiNowPlaying');
              if (!readout || readout.textContent.trim() !== 'C') {
                console.log('FAIL: strummed C-E-G expected chord readout "C", got "' + (readout && readout.textContent) + '"');
                process.exit(1);
              }
              noteOff(60); noteOff(64); noteOff(67);

              // ── Chord recognition: Cmaj7 (C4 E4 G4 B4) ──
              noteOn(60); noteOn(64); noteOn(67); noteOn(71);
              setTimeout(() => {
                const readout2 = doc.getElementById('midiNowPlaying');
                if (!readout2 || readout2.textContent.trim() !== 'Cmaj7') {
                  console.log('FAIL: strummed C-E-G-B expected chord readout "Cmaj7", got "' + (readout2 && readout2.textContent) + '"');
                  process.exit(1);
                }
                noteOff(60); noteOff(64); noteOff(67); noteOff(71);

                setTimeout(() => {
                  const readout3 = doc.getElementById('midiNowPlaying');
                  if (!readout3 || readout3.textContent.trim() !== '—') {
                    console.log('FAIL: readout did not clear back to "—" after releasing all notes, got "' + (readout3 && readout3.textContent) + '"');
                    process.exit(1);
                  }
                  console.log('PASS — live MIDI single-note scale feedback and chord recognition (triad + 7th) both work correctly.');
                  process.exit(0);
                }, 150);
              }, 150);
            }, 150);
          }, 50);
        }, 50);
      }, 150);
    }, 150);
  } catch (e) {
    console.log('FAIL: threw —', e.message);
    process.exit(1);
  }
}, 200);
