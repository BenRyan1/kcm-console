/* KCM Help Mode text for the Sound Observatory. DRAFT Oct 27 2026, for Ben to review. */
window.KCM_HELP = {
  version: 'obs-draft-1',
  targets: '.kb-white, .kb-black, .fb-cell, #c-wheel, #c-staff',
  ids: {
    listenBtn: { n: 'Activate', t: 'Turns on your microphone so the Observatory can show the sound you make or play. Nothing is recorded or sent anywhere.' },
    stopBtn: { n: 'Stop', t: 'Stops all sound and turns the microphone off.' },
    gainSlider: { n: 'Input gain', t: 'How strongly the microphone signal is boosted. Raise it for quiet sounds, lower it if the display is overloaded.' },
    smoothSlider: { n: 'Smoothing', t: 'How calmly the display moves. Higher is steadier, lower reacts faster.' },
    clearBtn: { n: 'Clear', t: 'Lets go of every note you are holding on the keys, wheel or guitar.' },
    micRetryBtn: { n: 'Try again', t: 'Asks for the microphone again.' },
    micFlagBtn: { n: 'Copy Chrome flag address', t: 'Copies a settings address to paste in Chrome if the microphone is blocked.' },
    micDismissBtn: { n: 'Play manually', t: 'Closes this message. You can still play with the piano keys, the wheel or the guitar neck.' },
    'c-wheel': { n: 'Chromatic wheel', t: 'Touch a color to play that note. Touch again to let it go.' },
    'c-staff': { n: 'Staff', t: 'Touch a line or space to play that note. Shift makes it sharp and Alt makes it flat.' }
  },
  rules: [
    { sel: 'button[data-mode="spectrum"]', n: 'Spectrum', t: 'Shows the sound as colors by pitch, scrolling across time.' },
    { sel: 'button[data-mode="ridge"]', n: '3D view', t: 'The same sound drawn as rolling ridges, so loud pitches stand up like hills.' },
    { sel: 'button[data-mode="chroma"]', n: 'Chroma', t: 'Shows the twelve notes as rows in the KCM colors, scrolling across time.' },
    { sel: 'button[data-mode="overtones"]', n: 'Overtones', t: 'Shows the harmonic series: the quiet higher notes that ring inside every sound.' },
    { sel: 'button', x: '^(3D|2D)$', n: '3D or 2D', t: 'Switches this display between a flat 2D picture and a 3D view.' },
    { sel: 'button', x: '^PLATE$', n: 'Plate', t: 'Cymatics on a metal plate: sand gathers in the still lines where the plate does not move.' },
    { sel: 'button', x: '^WATER$', n: 'Water', t: 'Cymatics on a water surface: the sound makes ripples.' },
    { sel: 'button', x: '^BOTH$', n: 'Both', t: 'Shows the plate and the water together.' },
    { sel: 'button', x: '^4 FRETS$', n: '4 frets', t: 'Shows the first four frets of the guitar neck, a close-up.' },
    { sel: 'button', x: '^5 FRETS$', n: '5 frets', t: 'Shows the first five frets of the guitar neck.' },
    { sel: 'button', x: '^12 FRETS$', n: '12 frets', t: 'Shows the whole neck up to the 12th fret.' },
    { sel: 'input[type="range"][title="Cymatics zoom"]', n: 'Cymatics zoom', t: 'Zooms the cymatics picture in or out.' },
    { sel: '.fb-str-label', n: 'String', t: 'Touch to play this open string.' },
    { sel: '.card-expand', n: 'Expand', t: 'Makes this display fill the screen. Touch it again to shrink it back.' },
    { sel: '.kb-white, .kb-black', n: 'Piano key', t: 'Touch to play this note. Touch again to let it go.' },
    { sel: '.fb-cell', n: 'Guitar neck', t: 'Touch to play the note at this string and fret.' }
  ]
};
