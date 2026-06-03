const { app, BrowserWindow, shell } = require('electron');
const path = require('path');

// ✅ Server automatically start karo
require('./server.js');

let mainWindow;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    icon: path.join(__dirname, 'assets/logo.png'),
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true
    },
    titleBarStyle: 'default',
    title: 'MEVTENCIA HRMS'
  });

  // ✅ 2 second wait karo server start hone ke liye
  setTimeout(() => {
    mainWindow.loadURL('http://localhost:4000');
  }, 2000);

  // ✅ External links browser mein kholo
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: 'deny' };
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
    app.quit();
  });
}

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
  app.quit();
});