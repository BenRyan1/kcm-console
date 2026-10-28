/* KCM Help Mode text for the Console shell (header and panel frames). Oct 27 2026. */
window.KCM_HELP = {
  version: 'console-shell-1',
  ids: {
    'kcm-session-title': { n: 'Session title', t: 'Type a name for your session. It is used as the file name when you save.' },
    'kcm-save': { n: 'Save .gcis', t: 'Saves your whole Console session (every panel) to a .gcis file on your device so you can come back to it later.' },
    'kcm-load': { n: 'Load .gcis', t: 'Opens a .gcis session file you saved earlier and puts every panel back the way it was.' },
    'kcm-mic-btn': { n: 'Start listening', t: 'Turns on your microphone. Sing or play and the Console finds the note, chord and scale and shows them on every panel. The sound stays on your device.' },
    'kcm-mic-gain': { n: 'Sensitivity', t: 'How easily the microphone picks up sound. Raise it for quiet playing, lower it in a noisy room.' },
    'kcm-mic-smooth': { n: 'Lock', t: 'How steady the note reading is. Higher holds a note longer, lower reacts faster.' },
    'kcm-mic-clear': { n: 'Reset', t: 'Clears the scales and arpeggios the microphone has gathered so far and starts over.' },
    'suno-platform-select': { n: 'Music platform', t: 'Choose Suno or Udio. The prompt is worded for the one you pick.' },
    'suno-prompt-text': { n: 'Prompt', t: 'The text describing your key and mode, ready to paste into an AI music maker. You can edit it.' },
    'suno-template-btn': { n: 'Reset template', t: 'Puts the prompt back to the standard wording for your current key and mode.' },
    'suno-copy-btn': { n: 'Copy prompt', t: 'Copies the prompt so you can paste it into the music platform.' },
    'kcm-stop-all': { n: 'Stop All', t: 'Stops all sound in every panel at once. Use it if notes hang or you want quiet.' }
  },
  rules: [
    { sel: '.kcm-panel__btn[data-panel-action="minimize"]', n: 'Minimize panel', t: 'Folds this panel down to its title bar. Touch it again to open the panel back up.' }
  ]
};
