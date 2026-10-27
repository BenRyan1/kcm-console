/* KCM Help Mode text for the Console shell (header and panel frames). Oct 27 2026. */
window.KCM_HELP = {
  version: 'console-shell-1',
  ids: {
    'kcm-session-title': { n: 'Session title', t: 'Type a name for your session. It is used as the file name when you save.' },
    'kcm-save': { n: 'Save .gcis', t: 'Saves your whole Console session (every panel) to a .gcis file on your device so you can come back to it later.' },
    'kcm-load': { n: 'Load .gcis', t: 'Opens a .gcis session file you saved earlier and puts every panel back the way it was.' },
    'kcm-stop-all': { n: 'Stop All', t: 'Stops all sound in every panel at once. Use it if notes hang or you want quiet.' }
  },
  rules: [
    { sel: '.kcm-panel__btn[data-panel-action="minimize"]', n: 'Minimize panel', t: 'Folds this panel down to its title bar. Touch it again to open the panel back up.' }
  ]
};
