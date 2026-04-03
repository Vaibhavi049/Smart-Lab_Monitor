const { app, BrowserWindow, nativeTheme, ipcMain, shell } = require('electron');
const path = require('path');
const { spawn, fork, exec } = require('child_process');
const http = require('http');
const os = require('os');

require('dotenv').config();

const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET;

let serverProcess = null;

function getLocalIpAddress() {
  const interfaces = os.networkInterfaces();
  for (const name of Object.keys(interfaces)) {
    for (const iface of interfaces[name]) {
      if (iface.family === 'IPv4' && !iface.internal) {
        return iface.address;
      }
    }
  }
  return '127.0.0.1';
}

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
      sandbox: false,
      devTools: true
    }
  });

  win.once('ready-to-show', () => {
    win.show();
  });

  win.loadFile(path.join(__dirname, 'renderer', 'index.html'));

  win.webContents.on('console-message', (event, level, message, line, sourceId) => {
    console.log(`[RENDERER CONSOLE]: ${message} (Line ${line})`);
  });
}

app.on('ready', () => {
  nativeTheme.themeSource = 'dark';
  createWindow();
});

app.on('window-all-closed', () => {
  if (serverProcess) serverProcess.kill();
  if (process.platform !== 'darwin') app.quit();
});

app.on('will-quit', () => {
  if (serverProcess) serverProcess.kill();
  if (activityProcess) activityProcess.kill();
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});

let activityInterval = null;

ipcMain.on('START_ACTIVITY_TRACKING', (event) => {
  if (activityInterval) return;

  console.log('Starting PowerShell activity monitor...');

  activityInterval = setInterval(() => {
    // Use single quotes inside PowerShell to avoid cmd.exe double-quote mangling
    const psScript = `Get-Process | Where-Object {$_.MainWindowTitle -ne ''} | ForEach-Object { @{windowTitle=$_.MainWindowTitle; processName=$_.Name} } | ConvertTo-Json -Compress`;

    exec(`powershell.exe -NoProfile -WindowStyle Hidden -Command "${psScript}"`, { timeout: 5000 }, (error, stdout, stderr) => {
      if (error) {
        console.error('PS Monitor error:', error.message);
        return;
      }
      try {
        if (!stdout || stdout.trim() === '') return;
        const parsed = JSON.parse(stdout);

        // The result might be a single object or an array of objects
        const results = Array.isArray(parsed) ? parsed : [parsed];

        const data = {
          windows: results.map(r => r.windowTitle),
          processes: results.map(r => (r.processName || '').toLowerCase())
        };

        console.log('[ACTIVITY] Sending data with', data.windows.length, 'windows');
        event.reply('ACTIVITY_DATA', data);
      } catch (parseErr) {
        console.error('[ACTIVITY] Parse error:', parseErr.message, 'Raw:', stdout?.substring(0, 200));
      }
    });
  }, 2000);
});

ipcMain.on('STOP_ACTIVITY_TRACKING', () => {
  if (activityInterval) {
    console.log('Stopping activity monitor...');
    clearInterval(activityInterval);
    activityInterval = null;
  }
});


ipcMain.handle('START_OAUTH_LOGIN', async () => {
  return new Promise((resolve, reject) => {
    const server = http.createServer();
    const port = 4000;

    server.on('error', (err) => {
      resolve({ success: false, error: 'Port 4000 is busy. Ensure no other server is running.' });
    });

    server.listen(port, 'localhost', () => {
      const redirectUri = `http://localhost:${port}/auth/google/callback`;

      const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?client_id=${GOOGLE_CLIENT_ID}&redirect_uri=${redirectUri}&response_type=code&scope=email%20profile`;
      shell.openExternal(authUrl);

      server.on('request', async (req, res) => {
        if (req.url.includes('code=')) {
          const urlParams = new URL(req.url, `http://localhost:${port}`);
          const code = urlParams.searchParams.get('code');

          res.end('<html><body style="font-family: sans-serif; text-align: center; margin-top: 100px;"><h2>Login successful!</h2><p>You can close this tab and return to the application.</p><script>window.close()</script></body></html>');
          server.close();

          try {
            const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
              method: 'POST',
              headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
              body: new URLSearchParams({
                code,
                client_id: GOOGLE_CLIENT_ID,
                client_secret: GOOGLE_CLIENT_SECRET,
                redirect_uri: redirectUri,
                grant_type: 'authorization_code'
              })
            });
            const tokenData = await tokenResponse.json();

            const userResponse = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
              headers: { Authorization: `Bearer ${tokenData.access_token}` }
            });
            const userData = await userResponse.json();

            if (!userData.email.endsWith('@rknec.edu')) {
              return resolve({ success: false, error: 'Only @rknec.edu accounts allowed.' });
            }

            resolve({ success: true, user: userData });
          } catch (err) {
            resolve({ success: false, error: 'Failed to fetch user profile.' });
          }
        }
      });
    });
  });
});

ipcMain.handle('START_HOST_SERVER', async () => {
  if (serverProcess) return { success: true, ip: getLocalIpAddress() };

  try {
    const serverJsPath = app.isPackaged
      ? path.join(process.resourcesPath, 'backend', 'server.js')
      : path.join(__dirname, '..', 'backend', 'server.js');

    serverProcess = fork(serverJsPath, [], {
      stdio: 'inherit',
      env: { ...process.env, PORT: 4000 }
    });

    serverProcess.on('error', (err) => {
      console.error('Failed to start local host server:', err);
    });

    return { success: true, ip: getLocalIpAddress() };
  } catch (e) {
    return { success: false, error: e.toString() };
  }
});

