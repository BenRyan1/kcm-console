/* KCM Help Mode text for the Melody Library panel. DRAFT Oct 27 2026, for Ben to review. */
window.KCM_HELP = {
  version: 'lib-draft-1',
  ids: {
    playBtn: { n: 'Play with sound', t: 'Plays the loaded melody with sound. The notes light up on the circle, piano and guitar as they play.' },
    pauseBtn: { n: 'Pause', t: 'Pauses the melody where it is. Touch Play to carry on.' },
    stopBtn: { n: 'Stop', t: 'Stops the melody and clears the lights.' },
    restartBtn: { n: 'Restart', t: 'Starts the melody again from the beginning.' },
    tempoSlider: { n: 'Tempo', t: 'Slide to change how fast the melody plays. Left is faster, right is slower.' },
    loopToggle: { n: 'Loop', t: 'When checked, the melody starts over by itself when it ends.' },
    pdSearch: { n: 'Search public-domain songs', t: 'Type a title, style, key or idea to narrow the list below.' },
    pdSelect: { n: 'Public-domain songs', t: 'The list of songs. Touch one, then press Load Selected Song.' },
    pdLoadBtn: { n: 'Load selected song', t: 'Loads the song you picked so you can play it and watch the notes.' },
    pdKey: { n: 'Play in key', t: 'Moves the song to the key you choose. The notes and colors change to match.' },
    builtinSearch: { n: 'Search built-in songs', t: 'Type a title, artist or year to narrow the list below.' },
    builtinSelect: { n: 'Built-in songs', t: 'The list of songs. Touch one, then press Load Selected Song.' },
    loadBuiltinBtn: { n: 'Load selected song', t: 'Loads the song you picked so you can play it and watch the notes.' },
    repoSearch: { n: 'Search the full library', t: 'Type a title, artist, year or version to narrow the list below.' },
    repoKind: { n: 'What to show', t: 'Choose whether the list shows whole songs or sections of songs.' },
    librarySelect: { n: 'Full library songs', t: 'The list of songs from the online library. Browse first, then pick one.' },
    loadLibBtn: { n: 'Load selected song', t: 'Loads the song you picked. It turns on after you Browse and pick one.' },
    repoInput: { n: 'Library address', t: 'The online folder the library comes from. Leave it as it is unless you have your own.' },
    browseLibBtn: { n: 'Browse', t: 'Fetches the list of songs from the online library. It needs an internet connection.' },
    midiFileInput: { n: 'Upload a MIDI file', t: 'Choose a MIDI file from your device to play and see on the circle, piano and guitar.' }
  },
  rules: [
    { sel: '.white-key, .black-key', n: 'Piano key', t: 'Touch to hear this note.' },
    { sel: 'summary', n: 'Use a different library', t: 'Opens a box where you can point to another online song library.' },
    { sel: '.file-btn', n: 'Upload any MIDI file', t: 'Choose a MIDI file from your device to play and see on the circle, piano and guitar.' },
    { sel: '.pd-link', own: true, t: 'Touch to load this song.' }
  ]
};
