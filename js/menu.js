'use strict';

const app = require('electron').app;

function sendCommand(window, command) {
  if (window) {
    window.webContents.send('command', command);
  }
}

let template = [
  {
    label: 'File',
    submenu: [
      {
        label: 'New Tab',
        accelerator: 'CmdOrCtrl+T',
        click(item, focusedWindow) {
          sendCommand(focusedWindow, 'new-tab');
        }
      },
      {
        label: 'New Window',
        accelerator: 'CmdOrCtrl+N',
        click() {
          app.emit('new-window');
        }
      },
      {
        type: 'separator'
      },
      {
        label: 'Close Tab',
        accelerator: 'CmdOrCtrl+W',
        click(item, focusedWindow) {
          sendCommand(focusedWindow, 'close-tab');
        }
      },
      {
        label: 'Close Window',
        accelerator: 'CmdOrCtrl+Shift+W',
        role: 'close'
      }
    ]
  },
  {
    label: 'Edit',
    submenu: [
      {
        label: 'Undo',
        accelerator: 'CmdOrCtrl+Z',
        role: 'undo'
      },
      {
        label: 'Redo',
        accelerator: 'Shift+CmdOrCtrl+Z',
        role: 'redo'
      },
      {
        type: 'separator'
      },
      {
        label: 'Cut',
        accelerator: 'CmdOrCtrl+X',
        role: 'cut'
      },
      {
        label: 'Copy',
        accelerator: 'CmdOrCtrl+C',
        role: 'copy'
      },
      {
        label: 'Paste',
        accelerator: 'CmdOrCtrl+V',
        role: 'paste'
      },
      {
        label: 'Select All',
        accelerator: 'CmdOrCtrl+A',
        role: 'selectall'
      }
    ]
  },
  {
    label: 'View',
    submenu: [
      {
        label: 'Toggle Full Screen',
        accelerator: (function () {
          if (process.platform == 'darwin')
            return 'Ctrl+Command+F';
          else
            return 'F11';
        })(),
        click(item, focusedWindow) {
          if (focusedWindow)
            focusedWindow.setFullScreen(!focusedWindow.isFullScreen());
        }
      }
    ]
  },
  {
    label: 'Window',
    role: 'window',
    submenu: [
      {
        label: 'Minimize',
        accelerator: 'CmdOrCtrl+M',
        role: 'minimize'
      },
      {
        type: 'separator'
      },
      {
        label: 'Select Next Tab',
        accelerator: 'CmdOrCtrl+Shift+]',
        click(item, focusedWindow) {
          sendCommand(focusedWindow, 'next-tab');
        }
      },
      {
        label: 'Select Previous Tab',
        accelerator: 'CmdOrCtrl+Shift+[',
        click(item, focusedWindow) {
          sendCommand(focusedWindow, 'previous-tab');
        }
      }
    ]
  },
  {
    label: 'Developer',
    submenu: [
      {
        label: 'Reload',
        accelerator: 'CmdOrCtrl+R',
        click(item, focusedWindow) {
          if (focusedWindow)
            focusedWindow.reload();
        }
      },
      {
        label: 'Toggle Developer Tools',
        accelerator: (function () {
          if (process.platform == 'darwin')
            return 'Alt+Command+I';
          else
            return 'Ctrl+Shift+I';
        })(),
        click(item, focusedWindow) {
          if (focusedWindow)
            focusedWindow.toggleDevTools();
        }
      }
    ]
  },
  {
    label: 'Help',
    role: 'help',
    submenu: [
      {
        label: 'Learn More',
        click() {
          require('electron').shell.openExternal('http://github.com/saul/gamevis')
        }
      }
    ]
  },
];

if (process.platform == 'darwin') {
  let name = app.getName();

  template.unshift({
    label: name,
    submenu: [
      {
        label: 'About ' + name,
        role: 'about'
      },
      {
        type: 'separator'
      },
      {
        label: 'Services',
        role: 'services',
        submenu: []
      },
      {
        type: 'separator'
      },
      {
        label: 'Hide ' + name,
        accelerator: 'Command+H',
        role: 'hide'
      },
      {
        label: 'Hide Others',
        accelerator: 'Command+Alt+H',
        role: 'hideothers'
      },
      {
        label: 'Show All',
        role: 'unhide'
      },
      {
        type: 'separator'
      },
      {
        label: 'Quit',
        accelerator: 'Command+Q',
        click() {
          app.quit();
        }
      },
    ]
  });

  template[4].submenu.push(
    {
      type: 'separator'
    },
    {
      label: 'Bring All to Front',
      role: 'front'
    }
  );
}

module.exports = template;
