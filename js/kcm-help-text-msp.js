/* KCM Help Mode text for the Modal Stencil Player. DRAFT Oct 27 2026, for Ben to review. */
window.KCM_HELP = {
  version: 'msp-draft-1',
  ids: {
    tonicSelect: { n: 'Tonic', t: 'Choose the home note. All seven modes move to start from it.' },
    speedSelect: { n: 'Speed', t: 'Sets how fast the scale plays when you press Start.' },
    waveSelect: { n: 'Sound', t: 'Choose the tone color the notes are played in: Sine, Triangle, Organ or Bell.' },
    'record-button': { n: 'Record', t: 'Starts recording the notes you touch. Touch it again to stop.' },
    'play-recording-button': { n: 'Play recording', t: 'Plays back the notes you recorded. It turns on after a recording.' },
    'clear-recording-button': { n: 'Clear recording', t: 'Throws away the recording so you can start again.' },
    'midi-download-button': { n: 'Save MIDI', t: 'Downloads your recording as a MIDI file for music software. It turns on after a recording.' },
    'loop-button': { n: 'Loop', t: 'When On, the scale plays around and around until you press Stop.' },
    compareSelect: { n: 'Compare', t: 'Pick a second mode. Notes that differ from your current mode are highlighted so you can see exactly what changes.' },
    'play-button': { n: 'Start', t: 'Plays the chosen mode note by note. Choose a mode on the left first.' },
    'stop-button': { n: 'Stop', t: 'Stops the scale that is playing.' },
    'seq-reset-btn': { n: 'Reset order', t: 'Puts the sequence back in normal scale order, 1 to 8.' }
  },
  rules: [
    { sel: '.seq-reorder-btns button', x: '^\\u25B2$', n: 'Move earlier', t: 'Moves this note one place earlier in the sequence.' },
    { sel: '.seq-reorder-btns button', x: '^\\u25BC$', n: 'Move later', t: 'Moves this note one place later in the sequence.' }
  ]
};
