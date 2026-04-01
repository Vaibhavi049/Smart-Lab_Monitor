const { app, BrowserWindow, nativeTheme, ipcMain } = require('electron');
const path = require('path');
const { spawn } = require('child_process');

let activityProcess = null;

if (require('electron-squirrel-startup')) {
  app.quit();
}

function createWindow() {
  const win = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 900,
    minHeight: 600,
    backgroundColor: '#050816',
    show: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true,
      devTools: true
    }
  });

  win.once('ready-to-show', () => {
    win.show();
  });

  win.loadFile(path.join(__dirname, 'renderer', 'index.html'));
}

app.on('ready', () => {
  nativeTheme.themeSource = 'dark';
  createWindow();
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});

ipcMain.on('START_ACTIVITY_TRACKING', (event) => {
  if (activityProcess) return;
  
  // Need to handle development vs built path for the exe
  let exePath = path.join(__dirname, 'activity_monitor.exe');
  if (process.resourcesPath) {
    // Attempt fallback for production build
    const fs = require('fs');
    if (!fs.existsSync(exePath)) {
      exePath = path.join(process.resourcesPath, 'activity_monitor.exe');
    }
  }

  activityProcess = spawn(exePath);

  activityProcess.stdout.on('data', (data) => {
    try {
      // Data might contain multiple lines if buffered together
      const strData = data.toString().trim();
      const lines = strData.split('\n');
      for (const line of lines) {
        if (!line) continue;
        const parsed = JSON.parse(line);
        event.reply('ACTIVITY_DATA', parsed);
      }
    } catch (e) {
      console.error('Failed to parse activity data', e);
    }
  });

  activityProcess.on('close', () => {
    activityProcess = null;
  });
});

ipcMain.on('STOP_ACTIVITY_TRACKING', () => {
  if (activityProcess) {
    activityProcess.kill();
    activityProcess = null;
  }
});

