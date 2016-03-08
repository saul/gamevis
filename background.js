'use strict';

const assert = require('assert');
const electron = require('electron');
const template = require('./js/menu');
const argv = require('minimist')(process.argv.slice(2), {'boolean': true});

const app = electron.app;
const Menu = electron.Menu;
const BrowserWindow = electron.BrowserWindow;

// Keep a global reference of the window object, if you don't, the window will
// be closed automatically when the JavaScript object is garbage collected.
var windows = {};

app.on('window-all-closed', () => {
  // On OS X it is common for applications and their menu bar
  // to stay active until the user quits explicitly with Cmd + Q
  if (process.platform != 'darwin') {
    app.quit();
  }
});

app.on('ready', () => {
  var menu = Menu.buildFromTemplate(template);
  Menu.setApplicationMenu(menu);

  app.emit('new-window');
});

app.on('new-window', () => {
  let size = electron.screen.getPrimaryDisplay().workAreaSize;

  let window = new BrowserWindow({width: size.width, height: size.height, icon: 'logo.png'});
  window.loadURL('file://' + __dirname + '/index.html');

  if (argv.dev) {
    window.webContents.openDevTools();
  }

  const id = window.id;
  windows[id] = window;

  window.on('closed', () => {
    // Dereference the window object, usually you would store windows
    // in an array if your app supports multi windows, this is the time
    // when you should delete the corresponding element.
    delete windows[id];
  });
});
