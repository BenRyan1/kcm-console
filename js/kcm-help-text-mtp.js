/* KCM Help Mode text for Music Theory Pro. DRAFT Oct 26 2026, for Ben to review and edit.
   Each entry: n = name shown in bold, t = what it does, m = optional "why it matters" line.
   sel = CSS selector for the control. x = optional pattern the button's text must match.
   First matching entry wins, so put specific entries before general ones.
   Anything not listed here falls back to the control's title tip, and KCMHelp.audit() lists the gaps. */
(function () {
  var ids = {
    startAudio: { n: 'Start Audio', t: 'Browsers keep sound off until you tap once. Press this first so you can hear every note.' },
    dockAudioBtn: { n: 'Start Audio', t: 'Browsers keep sound off until you tap once. Press this first so you can hear every note.' },
    instrumentBtn: { n: 'Instrument', t: 'Choose the sound you hear: synth, piano, guitar, marimba or strings. The notes stay the same, only the tone changes.' },
    midiStatusBtn: { n: 'MIDI input', t: 'Connect a MIDI keyboard or a guitar-to-MIDI controller so the notes you play show up live on the circle.' },
    createMidiBtn: { n: 'Create MIDI File', t: 'Saves the notes you recorded as a real .mid file that opens in any music program.' },
    stencilOverlayBtn: { n: 'Stencil Overlay', t: 'Keeps a small Stencil wheel on screen over any view, synced live with the Harmonized progression panel.' },
    globalPlayBtn: { n: 'Play', t: 'Plays what is currently selected.' },
    globalStopBtn: { n: 'Stop', t: 'Stops the sound.' },
    waveformSelect: { n: 'Waveform', t: 'Sets the shape of the synth tone. Sine is pure and soft, square is hollow, sawtooth is bright and buzzy.' },
    arcadeFxBtn: { n: 'Sound FX', t: 'Turns the arcade sound effects on or off.' },
    closeEarBtn: { n: 'Close', t: 'Closes the Arcade panel.' },
    playQuizBtn: { n: 'Replay Sound', t: 'Plays the question sound again.' },
    newQuizBtn: { n: 'New Question', t: 'Skips to a fresh question.' },
    rushStartBtn: { n: 'RUSH', t: 'A 60 second speed round. Answer as many as you can before time runs out.' },
    pibHearBtn: { n: 'Hear It', t: 'Plays the pattern you will sing or play back.' },
    pibStartBtn: { n: 'Start Listening', t: 'Turns on your microphone so the app can hear you sing or play the pattern back.' },
    pibHintBtn: { n: 'Hint', t: 'Gives you a clue about the pattern.' },
    pibNewBtn: { n: 'New Sequence', t: 'Gives you a different pattern to try.' },
    fret4Btn: { n: 'Fretboard size', t: 'Sets how many frets the guitar shows. 4 is the simplest view.', m: 'The 12th fret is one full octave up from the open string.' },
    fret5Btn: { n: 'Fretboard size', t: 'Sets how many frets the guitar shows. 5 frets is a good size for most scale shapes.', m: 'The 12th fret is one full octave up from the open string.' },
    fret12Btn: { n: 'Fretboard size', t: 'Shows 12 frets, one full octave of the guitar neck.' },
    singDeviceSelect: { n: 'Microphone', t: 'Choose which microphone or audio input the app listens to.' },
    singStartBtn: { n: 'Sing or play a note', t: 'Starts listening through your microphone. The note you hit lights up on the circle, piano and fretboard.', m: 'Your browser will ask for permission to use the microphone.' },
    singRecordBtn: { n: 'Record', t: 'Records the notes you sing or play.' },
    singPlaybackBtn: { n: 'Play Back', t: 'Plays your recording back.' },
    singClearBtn: { n: 'Clear', t: 'Erases the recording so you can start over.' },
    singMidiBtn: { n: 'Download MIDI', t: 'Saves your recorded notes as a .mid file.' },
    singWavBtn: { n: 'Record WAV', t: 'Captures the sound of your recording as a .wav audio file.' },
    kcmStencilAscend: { n: 'Ascend', t: 'Plays the Stencil notes going up.' },
    kcmStencilDescend: { n: 'Descend', t: 'Plays the Stencil notes going down.' },
    kcmStencilSimul: { n: 'Simul', t: 'Plays all the Stencil notes at once, as a chord.' },
    kcmSongPlayBtn: { n: 'Play Progression', t: "Plays the song's chord progression." },
    kcmSongMelodyBtn: { n: 'Play Melody', t: "Plays the song's melody line, not just its chords." },
    kcmStencilStop: { n: 'Stop', t: 'Stops the Stencil playback.' },
    staffPlayBtn: { n: 'Play', t: 'Plays the notes shown here, up and down.' },
    playUpBtn: { n: 'Ascending', t: 'Plays the selected notes from low to high.' },
    playDownBtn: { n: 'Descending', t: 'Plays the selected notes from high to low.' },
    playScaleBtn: { n: 'Full Scale', t: 'Plays the whole scale.' },
    playChordBtn: { n: 'Play Chord', t: 'Plays the selected notes together, as a chord.' },
    octaveBtn: { n: 'Octave', t: 'Sets which octave the notes play in. Higher numbers sound higher.' },
    tempoBtn: { n: 'Speed', t: 'Sets how fast things play, in beats per minute (BPM). Bigger is faster.' },
    octaveDown: { n: 'Lower', t: 'Moves everything one octave lower.', m: 'The Down Arrow key does the same.' },
    octaveUp: { n: 'Higher', t: 'Moves everything one octave higher.', m: 'The Up Arrow key does the same.' },
    transportPlayBtn: { n: 'Play', t: 'Plays the current selection.' },
    stopPlayBtn: { n: 'Stop', t: 'Stops playback.' },
    recordBtn: { n: 'Record', t: 'Records the notes you play so you can play them back or save them.', m: 'Keyboard shortcut: R.' },
    playRecBtn: { n: 'Playback', t: 'Plays your recording back.', m: 'Keyboard shortcut: P.' },
    clearRecBtn: { n: 'Clear', t: 'Erases your recording.' },
    downloadRecBtn: { n: 'MIDI', t: 'Saves your recording as a .mid file.' },
    downloadWAVBtn: { n: 'WAV', t: 'Saves your recording as a real .wav audio file. Click Record, play some notes, click Stop, then click this.' },
    playAllChordsBtn: { n: 'Play All Scale Chords', t: 'Plays the chord built on each note of the scale, one after another.' },
    playChromaticBtn: { n: 'Chromatic Scale', t: 'Plays all 12 notes in order, one half step at a time.' },
    scaleLibraryToggleBtn: { n: 'More Scales', t: 'Opens the full library of extra scales.' },
    dockKeyBtn: { n: 'Key', t: 'Shows the key you are in. Open it to choose a different key (root note).' },
    dockPlayAllBtn: { n: 'Play', t: 'Plays the current selection.' },
    dockAscBtn: { n: 'Ascending', t: 'Plays the selected notes going up.' },
    dockDescBtn: { n: 'Descending', t: 'Plays the selected notes going down.' },
    dockChordBtn2: { n: 'Chord', t: 'Plays the selected notes together, as a chord.' },
    dockHarmMajorBtn: { n: 'Major', t: 'Shows the chords of the major key.' },
    dockHarmMinorBtn: { n: 'Minor', t: 'Shows the chords of the minor key.' },
    dockTriadBtn: { n: 'Triads', t: 'Build each chord from 3 notes.' },
    dock7thBtn: { n: '7ths', t: 'Build each chord from 4 notes, adding the 7th.' },
    dockPlayChordBtn: { n: 'Chord', t: 'Plays the selected chord.' },
    dockPlayArpBtn: { n: 'Arpeggio', t: 'Plays the chord one note at a time, going up.' },
    dockPlayAllChordsBtn: { n: 'All', t: 'Plays every chord of the key, in order.' },
    keyPickerSelect: { n: 'Key', t: 'Choose the key (root note) you want to work in.' }
  };

  var LV = {
    '1': ['Single Note', 'One note at a time. The simplest place to start: see its color and hear it.'],
    '2': ['Intervals', 'Two notes. An interval is the distance between them, and every distance has its own sound and shape.'],
    '3': ['Triads', 'Three notes stacked to make a basic chord, such as major or minor.'],
    '4': ['Extended Chords', 'Chords with extra notes added: 7ths, 9ths, 11ths and 13ths. Pick the size with the buttons that appear.'],
    '5': ['Pentatonic', 'A five-note scale used all over folk, rock and blues.'],
    '6': ['Whole Tone', 'A six-note scale built only from whole steps. It sounds floating and dreamy.'],
    'scales': ['Scales', 'Seven-note scales such as major and minor. Pick a type below.'],
    'modes': ['Modes', 'Seven modes. Each one uses the same notes but starts from a different one, which gives it its own mood.'],
    'harm': ['Harmonized', 'Builds a chord on every note of the key, so you can see the chords (I, ii, iii and so on) a key is made of.'],
    'freeplay': ['Free Play', 'Choose notes yourself and hear what they make together.']
  };

  var rules = [];
  function add(sel, n, t, m, x) { var r = { sel: sel, n: n, t: t }; if (m) r.m = m; if (x) r.x = x; rules.push(r); }

  /* Levels: main panel buttons and dock buttons share the same text */
  Object.keys(LV).forEach(function (k) {
    add('.level-btn[data-level="' + k + '"]', LV[k][0], LV[k][1]);
    add('.dock-level-btn[data-dock-level="' + k + '"]', LV[k][0], LV[k][1]);
  });

  /* Views */
  [['circle', 'Circle view', 'The 12 notes as a color wheel. Every note keeps its own color. Click a note to hear it and see how it relates to the others.', 'Seeing the same colors and shapes again and again is how the patterns start to feel familiar.'],
   ['guitar', 'Guitar view', 'A fretboard with the same notes in the same colors. Click a spot to play it and see where a scale or chord sits on the neck.'],
   ['keyboard', 'Piano view', 'A piano keyboard with every key colored by its note. Click keys, or type on your computer keyboard to play.'],
   ['stencil', 'Stencil view', 'Lays a Stencil pattern over the color circle for a scale, mode, chord or song, so you see its shape instead of memorizing it.'],
   ['ear', 'Arcade', 'Ear training games. Name intervals and chords by sound, or sing or play a pattern back.'],
   ['sing', 'Sing view', 'Sing or play into your microphone and the note you hit lights up on the circle, piano and fretboard as you go.'],
   ['circleType', 'Type-to-Play', 'The circle, with your computer keyboard as a piano. A S D F G H J play the white keys (C D E F G A B). W E T Y U play the black keys.']
  ].forEach(function (v) {
    add('.view-btn[data-view="' + v[0] + '"]', v[1], v[2], v[3]);
    add('.dock-view-btn[data-dock-view="' + v[0] + '"]', v[1], v[2], v[3]);
  });

  /* Instruments, arcade, stencil tabs, notation tabs */
  add('.inst-btn[data-inst]', 'Instrument sound', 'Switches the playback sound to this instrument. The notes stay the same, only the tone changes.');
  add('.arcade-mode-btn[data-mode="interval"]', 'Ear ID', 'Hear two notes and name the interval between them.');
  add('.arcade-mode-btn[data-mode="chord"]', 'Chord ID', 'Hear a chord and name what type it is.');
  add('.arcade-mode-btn[data-mode="playback"]', 'Play It Back', 'Hear a short pattern, then sing or play it back.');
  add('.kcm-stencil-tab[data-cat]', 'Stencil category', 'Choose what kind of Stencil to browse: scales, modes, chords, 13th chords or songs.');
  add('.staff-tab-btn[data-stafftab="staff"]', 'Staff', 'Shows the notes in standard music notation.');
  add('.staff-tab-btn[data-stafftab="fretboard"]', 'Fretboard', 'Shows the notes on a guitar fretboard.');
  add('.staff-tab-btn[data-stafftab="keyboard"]', 'Keyboard', 'Shows the notes on a piano keyboard.');
  add('.staff-tab-btn[data-stafftab="tab"]', 'Tab', 'Shows the notes as guitar tablature: which string and fret to play.');
  add('.staff-tab-btn[data-stafftab="timeline"]', 'Timeline', 'Shows the notes laid out in time.');

  /* Chord size and scales */
  add('.ext-degree-btn[data-ext-degree]', 'Chord size', '7th, 9th, 11th or 13th. A bigger number stacks more notes on the chord for a richer, more colorful sound.');
  var SC = {
    major: ['Major (Ionian)', 'Bright and happy. The do-re-mi scale.'],
    naturalMinor: ['Natural Minor (Aeolian)', 'The standard minor scale. Darker and more serious than major.'],
    harmonicMinor: ['Harmonic Minor', 'Minor with a raised 7th note. It gives a dramatic pull back to the home note.'],
    melodicMinor: ['Melodic Minor', 'Minor with a raised 6th and 7th. Used a lot in jazz.'],
    majorPentatonic: ['Major Pentatonic', 'Five notes of the major scale. Open and sweet, and hard to play wrong.'],
    minorPentatonic: ['Minor Pentatonic', 'Five notes of the minor scale. The backbone of rock and blues solos.'],
    blues: ['Blues', 'Minor pentatonic plus one extra "blue note" (the flat 5th) for that bluesy bite.'],
    wholeTone: ['Whole Tone', 'Six notes, all a whole step apart. Floating and dreamy.'],
    dimWH: ['Diminished (Whole-Half)', 'Eight notes alternating a whole step and a half step. Tense and jazzy.'],
    dimHW: ['Diminished (Half-Whole)', 'Eight notes alternating a half step and a whole step. Often used over dominant 7th chords.']
  };
  Object.keys(SC).forEach(function (k) {
    add('.scale-type-btn[data-scale-type="' + k + '"]', SC[k][0], SC[k][1]);
    add('.dock-scale-btn[data-scale="' + k + '"]', SC[k][0], SC[k][1]);
  });
  add('.harm-key-btn[data-harm-key]', 'Major or Minor', 'Choose whether to build the chords from the major key or the minor key.');

  /* Modes */
  var MD = {
    ionian: ['Ionian', 'Same as the major scale. Bright and settled.'],
    dorian: ['Dorian', 'A minor sound with a lift. Common in folk, funk and jazz.'],
    phrygian: ['Phrygian', 'Dark minor with a Spanish flavor.'],
    lydian: ['Lydian', 'A major sound that floats. Dreamy and bright.'],
    mixolydian: ['Mixolydian', 'A major sound with a bluesy edge. Common in rock and folk.'],
    aeolian: ['Aeolian', 'Same as natural minor. Sad and serious.'],
    locrian: ['Locrian', 'Unstable and tense. Rarely used as a home key.']
  };
  Object.keys(MD).forEach(function (k) {
    add('.dock-mode-btn[data-dock-mode="' + k + '"]', MD[k][0], MD[k][1], 'Every mode uses the same notes as its parent scale, just starting from a different one.');
  });

  /* Dock: key, scale degrees, transport */
  add('.dock-key-pill[data-dock-pc]', 'Pick a key', 'Chooses the key (root note). The number and the sharp or flat sign show how many sharps or flats that key has.', 'The keys are in circle-of-fifths order, so neighbors share almost all their notes.');
  add('.dock-deg-btn[data-deg]', 'Scale degree', 'The chord built on this step of the scale. The Roman numeral names its job. I is home. V is the tension that wants to return home.', 'Capital numerals are major chords, small ones are minor, and a small circle means diminished.');
  add('.dock-play-btn', 'Stop', 'Stops the sound.', '', '^\\u25A0');
  add('.dock-play-btn', 'Chromatic', 'Plays all 12 notes in order, one half step at a time.', '', 'Chromatic');
  add('.dock-play-btn', 'Play', 'Plays the current selection.', '', '^\\u25B6');

  /* Circle, piano, guitar */
  add('.sphere', 'Note', 'One of the 12 notes. Click to hear it and light it up. Its color stays the same everywhere in the app.');
  add('.white-key, .black-key', 'Piano key', 'Click to play this note. Its color matches the same note on the circle.');

  /* ---- Batch 2 (Oct 27 2026): Song Builder, Arcade results, dock arrows, Theory Tutor, melody filters ---- */
  ids.tabTutor = { n: 'Theory Tutor', t: 'Switches to the Theory Tutor, where you can ask questions about what you are looking at.' };
  ids.tabSong = { n: 'Song Builder', t: 'Switches to the Song Builder, which makes a short song idea from the key, mode, feel and tempo you choose.' };
  ids.kcmAutoSpeakBtn = { n: 'Auto read aloud', t: 'When on, answers are read out loud to you automatically.' };
  ids.aiCustomInput = { n: 'Ask a question', t: 'Type any music theory question here, then press Enter or Ask.' };
  ids.kcmStencilSpeed = { n: 'Stencil speed', t: 'Slide left to play the Stencil slower, right to play it faster.' };
  ids.wheelRotateSlider = { n: 'Rotate the wheel', t: 'Turns the color wheel so you can look at it from a different starting note.' };
  ids.sbKey = { n: 'Song key', t: 'The home note of your song. Everything the Song Builder makes will be built around it.' };
  ids.sbMode = { n: 'Song mode', t: 'The mood of your scale. Ionian is the plain major sound, Dorian and Mixolydian are bluesy, Aeolian is minor and sad, and so on.' };
  ids.sbMelodyScale = { n: 'Melody scale', t: 'The set of notes the melody is allowed to use. Pentatonic is the easiest to make sound good.' };
  ids.sbTempo = { n: 'Song tempo', t: 'How fast the song plays, from slow and gentle to quick and driving.' };
  ids.sbFeel = { n: 'Song feel', t: 'The emotion you want the song to have, such as uplifting or mysterious.' };
  ids.sbGenerateBtn = { n: 'Generate My Song', t: 'Builds a song idea from your choices. Press it again for a different one.' };
  ids.sbPlayBtn = { n: 'Play Section', t: 'Plays the section you have selected, such as the verse or the chorus.' };
  ids.sbMelodyBtn = { n: 'Play Melody', t: 'Plays just the melody line.' };
  ids.sbFullBtn = { n: 'Play Full Song', t: 'Plays the whole song from start to finish.' };
  ['verse','chorus','bridge','intro','outro','solo'].forEach(function (k) {
    ids['struct-' + k] = { n: k.charAt(0).toUpperCase() + k.slice(1), t: 'Adds or removes the ' + k + ' in your song layout. Highlighted sections are included.' };
  });
  add('.melody-decade-btn[data-decade]', 'Decade filter', 'Shows only melodies from this decade. "All" shows every decade.');
  add('.ai-quick-btn', 'Quick question', 'Asks the Theory Tutor this ready-made question about what you currently have selected.', '', '^(?!.*(Verse|Chorus|Bridge|Intro|Outro|Solo))');
  rules.push({ sel: 'button', x: 'Play Again', n: 'Play Again', t: 'Starts another RUSH round.' });
  rules.push({ sel: 'button', x: 'Practice', n: 'Practice', t: 'Practice the same kind of questions with no timer and no pressure.' });
  rules.push({ sel: 'button', x: 'Ask', n: 'Ask', t: 'Sends your question to the Theory Tutor.' });
  rules.push({ sel: 'button', x: 'Download Song as MIDI', n: 'Download Song as MIDI', t: 'Saves your song as a .mid file you can open in any music program.' });
  rules.push({ sel: '.dock-mini-btn', x: '^◀$', n: 'Lower octave', t: 'Moves everything one octave lower.' });
  rules.push({ sel: '.dock-mini-btn', x: '^▶$', n: 'Higher octave', t: 'Moves everything one octave higher.' });
  rules.push({ sel: '.dock-mini-btn', x: '^−$', n: 'Slower', t: 'Lowers the speed by 10 beats per minute.' });
  rules.push({ sel: '.dock-mini-btn', x: '^\\+$', n: 'Faster', t: 'Raises the speed by 10 beats per minute.' });
  rules.push({ sel: 'button', x: '^⏹$|^■ STOP$', n: 'Stop', t: 'Stops the sound.' });
  rules.push({ sel: 'select', x: 'dropdown', n: 'Key', t: 'Choose the key (root note) you want to work in.' });

  /* ---- Batch 3 (Oct 27 2026): Harmonized, Modes, Stencil shapes, Arcade, dropdowns ---- */
  ids.harmKeyMajor = { n: 'Major key', t: 'Build the chords from the major key.' };
  ids.harmKeyMinor = { n: 'Minor key', t: 'Build the chords from the minor key.' };
  ids.triadSelect = { n: 'Triad type', t: 'Choose the kind of three-note chord: major, minor, diminished or augmented.' };
  ids.extendedSelect = { n: 'Chord type', t: 'Choose the kind of extended chord, such as major 7th, dominant 7th or minor 7th.' };
  ids.harmTypeSelect = { n: 'Chord size', t: 'Choose triads (3 notes) or seventh chords (4 notes) for the chords of the key.' };
  add('.deg-btn[data-deg]', 'Scale degree', 'The chord built on this step of the scale. The Roman numeral names its job. I is home. V is the tension that wants to return home.', 'Capital numerals are major chords, small ones are minor, and a small circle means diminished.');
  add('.level-btn', 'Chord progression', 'Four chords that songs use again and again. I-IV-V-I is the classic rock and blues pattern.', '', 'Classic Rock');
  add('.level-btn', 'Chord progression', 'I, IV, vi, V. A gentle, heartfelt pattern.', '', 'Sensitive');
  add('.level-btn', 'Chord progression', 'I, V, vi, IV. The four chords behind a huge number of pop hits.', '', 'Pop Anthem');
  add('.level-btn', 'Harmonized Major', 'Plays every chord of the major key in order, from I to vii and back home.', '', 'Harmonized Major');
  add('.level-btn', 'Chord progression', 'I, vi, IV, V. The sound of 1950s doo-wop.', '', '50s Doo-Wop');
  add('.level-btn', 'Chord progression', 'ii, V, I. The most common chord move in jazz.', '', 'Jazz Cadence');
  add('.level-btn', 'Chord progression', 'vi, IV, I, V. Starts on the minor chord for an emotional feel.', '', 'Emotional');
  add('.mode-pill-btn[data-mode]', 'Choose a mode', 'Shows this mode on the circle. Each mode uses the same notes as its parent major scale, starting from a different one.');
  add('.mode-play-btn[data-play-mode]', 'Play this mode', 'Plays this mode so you can hear its mood.');
  add('.kcm-key-pill[data-pc]', 'Pick a key', 'Chooses the key (root note) for the Stencil.');
  add('.kcm-stencil-shape-btn[data-stencil-id]', 'Stencil shape', 'Lays this scale or chord pattern over the color circle so you can see its shape and which notes it uses.');
  add('.quiz-btn', 'Answer', 'Tap the answer you think is right. Listen again with Replay Sound if you need to.');

  /* ---- Batch 4 (Oct 27 2026): wiring audit. Corrections, Timeline tab, per-item text. ---- */
  ids.wheelRotateSlider = { n: 'Rotate the wheel', t: 'Turns the color wheel one note at a time so you can start from a different note.' };
  ids.kcmAutoSpeakBtn = { n: 'Auto read aloud', t: "When on, the Tutor's answers are read out loud, starting right away." };
  ids.tlModeSeq = { n: 'Sequential', t: 'Plays the notes one at a time, like an arpeggio.' };
  ids.tlModeSim = { n: 'Simultaneous', t: 'Plays the notes stacked together, like a chord.' };
  ids.tlPlayBtn = { n: 'Play', t: 'Plays the notes on the timeline.' };
  ids.tlStopBtn = { n: 'Stop', t: 'Stops the timeline playback.' };
  var fixes = {
    freeplay: ['Free Play', 'Click several notes to select them, then play them together as a chord or one by one as a sequence.']
  };
  rules.forEach(function (r) {
    if (r.sel === '.level-btn[data-level="freeplay"]' || r.sel === '.dock-level-btn[data-dock-level="freeplay"]') { r.n = fixes.freeplay[0]; r.t = fixes.freeplay[1]; }
    if (r.sel === '.staff-tab-btn[data-stafftab="timeline"]') { r.t = 'Shows the selected notes on a timeline, played one by one or stacked together.'; }
    if (r.x === 'Practice') { r.t = 'Leaves the timed round and goes back to regular questions with no clock.'; }
  });
  var DEG = [
    ['Tonic', 'Home base. Everything feels settled here.'],
    ['Supertonic', 'A gentle step away from home. It often leads on to the dominant (V).'],
    ['Mediant', 'A soft in-between chord that shares notes with both the tonic and the dominant.'],
    ['Subdominant', 'Moves away from home. It often goes to the dominant or straight back to the tonic.'],
    ['Dominant', 'The strongest pull back to the tonic. Tension that wants to resolve home.'],
    ['Submediant', 'A close cousin of the tonic: the relative minor in a major key, the relative major in a minor key.'],
    ['Leading tone / Subtonic', 'The seventh step. In a major key it is the leading tone and pulls up to home. In a minor key it is the subtonic.']
  ];
  var specific = [];
  DEG.forEach(function (d, i) {
    specific.push({ sel: '.deg-btn[data-deg="' + i + '"]', n: d[0], t: d[1], m: 'The Roman numeral is the step of the scale. Capitals are major chords, small letters are minor, a small circle is diminished.' });
    specific.push({ sel: '.dock-deg-btn[data-deg="' + i + '"]', n: d[0], t: d[1], m: 'The Roman numeral is the step of the scale. Capitals are major chords, small letters are minor, a small circle is diminished.' });
  });
  Object.keys(MD).forEach(function (k) {
    specific.push({ sel: '.mode-pill-btn[data-mode="' + k + '"]', n: MD[k][0], t: MD[k][1], m: 'Every mode uses the same notes as its parent scale, just starting from a different one.' });
    specific.push({ sel: '.mode-play-btn[data-play-mode="' + k + '"]', n: 'Play ' + MD[k][0], t: 'Plays ' + MD[k][0] + ' so you can hear its mood. ' + MD[k][1] });
  });
  Array.prototype.unshift.apply(rules, specific);
  rules.forEach(function (r) {
    if (/kcm-stencil-shape-btn|\.quiz-btn|kcm-key-pill|dock-key-pill/.test(r.sel) || r.n === 'Chord progression') r.own = true;
  });

  window.KCM_HELP = { version: 'mtp-draft-1', ids: ids, rules: rules };
})();
