/* KCM Help Mode text for the Circle of Fifths panel. DRAFT Oct 27 2026, for Ben to review.
   n = bold name, t = what it does, m = optional extra line. First matching rule wins. */
(function () {
  var ids = {}, rules = [];
  function both(suffix, spec) { ['maj', 'min'].forEach(function (s) { ids[s + suffix] = spec(s === 'maj' ? 'major' : 'minor', s); }); }

  both('Prev', function (w) { return { n: 'Previous ' + w + ' key', t: 'Moves the ' + w + ' key one step counterclockwise on the circle (a fifth lower).' }; });
  both('Next', function (w) { return { n: 'Next ' + w + ' key', t: 'Moves the ' + w + ' key one step clockwise on the circle (a fifth higher).' }; });
  both('Select', function (w) { return { n: 'Pick a ' + w + ' key', t: 'Choose any ' + w + ' key from the list. The circle and the buttons below follow your choice.' }; });
  both('ArpUp', function (w) { return { n: 'Arpeggio up', t: 'Plays the three notes of this ' + w + ' chord one at a time, going up.' }; });
  both('ArpDn', function (w) { return { n: 'Arpeggio down', t: 'Plays the three notes of this ' + w + ' chord one at a time, going down.' }; });
  both('SubDom', function (w) { return { n: 'Subdominant chord', t: 'Plays the chord one step counterclockwise from your key (the IV chord). It often leads away from home.' }; });
  both('Dom', function (w) { return { n: 'Dominant chord', t: 'Plays the chord one step clockwise from your key (the V chord). It pulls strongly back toward home.' }; });
  both('Tonic', function (w) { return { n: 'Home chord', t: 'Plays the ' + w + ' chord of the key you picked. The label shows its name.' }; });
  both('CW', function (w) { return { n: 'Clockwise run', t: 'Plays the ' + w + ' chords in order, walking clockwise around the circle from your key.' }; });
  both('CCW', function (w) { return { n: 'Counterclockwise run', t: 'Plays the ' + w + ' chords in order, walking counterclockwise around the circle from your key.' }; });
  both('Stop', function () { return { n: 'Stop', t: 'Stops the sound that is playing right now.' }; });
  both('ProgTrigger', function (w) { return { n: 'Choose a progression', t: 'Opens a list of common ' + w + ' chord progressions for this key. Pick one to hear it and watch each chord light up.' }; });

  ids.extPlayBtnTop = { n: 'Play', t: 'Plays all of the extension tones you have switched on in the rings, together as one chord.' };
  ids.extStopBtnTop = { n: 'Stop', t: 'Stops the extension chord, arpeggio or comparison that is playing.' };
  ids.extPlayBtn = { n: 'Play Chord', t: 'Plays the chosen extension tones together as one chord.' };
  ids.extArpeggioBtn = { n: 'Arpeggio', t: 'Plays the chosen extension tones one after another so you can hear each color.' };
  ids.extCompareBtn = { n: 'Compare', t: 'Plays two chosen rings back to back so you can hear the difference. It turns on when exactly two are picked.' };
  ids.extClearBtn = { n: 'Clear rings', t: 'Switches off every extension ring you turned on and starts fresh.' };
  ids.cofRecordBtn = { n: 'Record', t: 'Starts recording what you play on this circle. Press it again to stop. Then you can save the recording.' };
  ids.cofWavBtn = { n: 'Save WAV', t: 'Saves your recording as a sound file (.wav) you can play anywhere. It turns on after a recording.' };
  ids.cofMidiBtn = { n: 'Save MIDI', t: 'Saves your recording as a MIDI file you can open in music software. It turns on after a recording.' };
  ids.cofClearBtn = { n: 'Clear recording', t: 'Throws away the current recording so you can record again.' };
  ids.loopPlayBtn = { n: 'Play Loop', t: 'Plays the circle around and around in the direction you chose above, until you stop it.' };
  ids.centerStop = { n: 'Stop Loop', t: 'Stops the loop that is playing.' };
  ids.loopToggle = { n: 'Loop status', t: 'Shows whether the loop is running. Touch it while the loop plays to stop it.' };

  rules.push(
    { sel: '.cof-variant-btn', x: '^Standard$', n: 'Standard', t: 'The regular Circle of Fifths: major keys on the outside, their relative minors inside.' },
    { sel: '.cof-variant-btn', x: '^Extended$', n: 'Extended', t: 'Switches to the Extended Circle, which adds rings of 7th, 9th, 11th and 13th chord tones.' },
    { sel: '.cof-variant-btn', x: '^Note$', n: 'Note', t: 'Touching a key on the circle plays just that one note.' },
    { sel: '.cof-variant-btn', x: '^Triad$', n: 'Triad', t: 'Touching a key on the circle plays the whole three-note chord.' },
    { sel: '.ext-level-btn', x: '^Triads$', n: 'Triads', t: 'Progression chords play as plain three-note chords.' },
    { sel: '.ext-level-btn', x: '^7ths$', n: '7ths', t: 'Progression chords play as four-note seventh chords, richer and jazzier.' },
    { sel: '.ext-level-btn', x: '^Auto', n: 'Auto', t: 'Lets Keys, Codes & Modes pick triads or sevenths chord by chord, the way each progression usually sounds best.' },
    { sel: '.prog-btn', own: true, t: 'Plays this chord progression in your key. Each chord lights up as it sounds.' },
    { sel: '.cpill', own: true, t: 'One chord from the progression. Touch it to cycle it between Triad, 7th and Auto.' },
    { sel: '.ext-mode-btn', x: '^Natural', n: 'Natural Minor', t: 'Extension tones are chosen from the natural minor scale, the plain minor sound.' },
    { sel: '.ext-mode-btn', x: '^Dorian', n: 'Dorian (Jazz)', t: 'Extension tones are chosen from Dorian, a brighter minor sound that jazz players love.' },
    { sel: '.ext-mode-btn', x: '^Harmonic', n: 'Harmonic Minor', t: 'Extension tones are chosen from harmonic minor, with a raised 7th and a dramatic edge.' },
    { sel: '.ext-mode-btn', x: '^Dominant', n: 'Dominant V7 to 13', t: 'Extension tones are chosen to build a dominant chord, the one that pulls hardest toward home.' },
    { sel: '.ext-preset-btn', own: true, t: 'A ready-made extension chord. It sets the rings and the scale for you. Then press Play Chord to hear it.' },
    { sel: '.explorer-tab', x: 'Keyboard', n: 'Keyboard', t: 'Shows the chord or key you picked on piano keys.' },
    { sel: '.explorer-tab', x: 'Fretboard', n: 'Fretboard', t: 'Shows the chord or key you picked on a guitar neck.' },
    { sel: '.explorer-tab', x: 'Staff', n: 'Staff', t: 'Shows the chord or key you picked as written notes on a music staff.' },
    { sel: '.explorer-tab', x: 'Chromatic', n: 'Chromatic Circle', t: 'Shows the chord or key you picked on the twelve-note chromatic circle.' },
    { sel: '.expl-fret-btn', x: '^4', n: '4 Frets', t: 'Shows only the first four frets of the neck, a close-up for beginners.' },
    { sel: '.expl-fret-btn', x: '^5', n: '5 Frets', t: 'Shows the first five frets of the neck.' },
    { sel: '.expl-fret-btn', x: '^12', n: '12 Frets (Full)', t: 'Shows the whole neck up to the 12th fret, where the notes start over.' },
    { sel: '.loop-dir-btn', own: true, t: 'Sets which way the loop travels around the circle. Press Play Loop to hear it.' },
    { sel: 'circle[role="button"][aria-label$=" major"]', own: false, n: 'Major key', t: 'Touch to hear this major key and make it your home key. Its relative minor sits just inside.' },
    { sel: 'circle[role="button"][aria-label$=" minor"]:not(.extdot)', n: 'Relative minor', t: 'Touch to hear this minor key. It shares every note with the major key just outside it.' },
    { sel: '.extdot', n: 'Extension ring', t: 'Touch to switch this chord tone on or off. The numbers 7, 9, 11 and 13 are extra notes stacked above the chord for richer color.' }
  );

  window.KCM_HELP = { version: 'cof-draft-1', ids: ids, rules: rules };
})();
