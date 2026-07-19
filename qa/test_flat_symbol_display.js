// Verifies flat note names shown to the user use the proper Unicode flat
// symbol (♭, U+266D) instead of a plain lowercase "b" -- e.g. "D♭" not
// "Db". Covers every array that actually drives visible text (aria-labels,
// getNoteName()'s flat-key path, piano key labels, the Stencil System's
// note-name display, and the AI tutor prompt), while deliberately leaving
// _NOTE_NAMES_MIDI untouched: that array builds real audio-sample fetch
// URLs (e.g. ".../Eb4.mp3"), and the hosted files are plain-ASCII named --
// swapping in a Unicode character there would 404 every flat-key sample
// instead of fixing a label.
const fs = require('fs');
const path = require('path');
const html = fs.readFileSync(path.join(__dirname, '..', 'music-theory-pro.html'), 'utf8');

function fail(msg) { console.log('FAIL: ' + msg); process.exit(1); }

const mustContain = [
  ["const noteNames      = ['C','C#/D♭','D','D#/E♭','E','F','F#/G♭','G','G#/A♭','A','A#/B♭','B'];", 'noteNames'],
  ["const noteNamesFlat  = ['C','D♭','D','E♭','E','F','G♭','G','A♭','A','B♭','B'];", 'noteNamesFlat (drives getNoteName())'],
  ["const keyLabel = ['C','C#','D','E♭','E','F','F#','G','A♭','A','B♭','B'];", 'keyLabel (piano key text content)'],
  ["const NOTE_FLAT  = ['C','D♭','D','E♭','E','F','G♭','G','A♭','A','B♭','B'];", 'NOTE_FLAT (Stencil System label display)'],
];
for (const [needle, label] of mustContain) {
  if (!html.includes(needle)) fail('missing expected ♭ fix for ' + label);
}

// The MIDI sample filename builder must be untouched -- still plain ASCII.
if (!html.includes("const _NOTE_NAMES_MIDI = ['C','Db','D','Eb','E','F','Gb','G','Ab','A','Bb','B'];")) {
  fail('_NOTE_NAMES_MIDI was changed -- this builds real audio-sample URLs and must stay plain ASCII to match the hosted filenames');
}

// No plain-ASCII flat letters should remain in any DISPLAY-facing array/name.
// (Word-boundary check across the whole file, then explicitly allow only
// the two known, deliberate exceptions: the MIDI filename array itself and
// the comment describing which notes it preloads.)
const matches = [...html.matchAll(/\b[A-G]b\b/g)];
const allowedLines = new Set();
{
  const lines = html.split('\n');
  lines.forEach((line, i) => {
    if (line.includes("_NOTE_NAMES_MIDI") || line.includes('We load: C, Eb, F#, A')) allowedLines.add(i);
  });
}
for (const m of matches) {
  const upToMatch = html.slice(0, m.index);
  const lineNum = upToMatch.split('\n').length - 1;
  if (!allowedLines.has(lineNum)) {
    fail('unexpected plain-ASCII flat letter "' + m[0] + '" remains outside the two known exceptions, at line ' + (lineNum + 1));
  }
}

console.log('PASS - all display-facing flat note names use the proper ♭ symbol; the MIDI sample-filename array (real fetch URLs) was correctly left as plain ASCII.');
process.exit(0);
