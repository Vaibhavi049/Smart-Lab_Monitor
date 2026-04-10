const { app, BrowserWindow, nativeTheme, ipcMain, shell, desktopCapturer, session } = require('electron');
const path = require("path");
const dotenv = require("dotenv");
const { spawn, fork, exec } = require('child_process');
const http = require('http');
const os = require('os');

// Pre-computed encoded PowerShell command to get the ACTUAL foreground window via Win32 API
// This replaces the old Get-Process approach which returned windows in arbitrary PID order
const FG_PS_SCRIPT = `try{Add-Type -MemberDefinition '[DllImport("user32.dll")]public static extern IntPtr GetForegroundWindow();[DllImport("user32.dll")]public static extern uint GetWindowThreadProcessId(IntPtr hWnd,out uint processId);[DllImport("user32.dll",CharSet=CharSet.Unicode)]public static extern int GetWindowText(IntPtr hWnd,System.Text.StringBuilder text,int count);' -Name FGWin -Namespace SmartLab -EA Stop;$hwnd=[SmartLab.FGWin]::GetForegroundWindow();$title=New-Object Text.StringBuilder 512;[void][SmartLab.FGWin]::GetWindowText($hwnd,$title,512);$fpid=[uint32]0;[void][SmartLab.FGWin]::GetWindowThreadProcessId($hwnd,[ref]$fpid);$pname='';try{$pname=(Get-Process -Id $fpid -EA Stop).Name}catch{};ConvertTo-Json @(@{windowTitle=$title.ToString();processName=$pname}) -Compress}catch{Get-Process|Where-Object{$_.MainWindowTitle -ne ''}|ForEach-Object{@{windowTitle=$_.MainWindowTitle;processName=$_.Name}}|ConvertTo-Json -Compress}`;
const FG_ENCODED_CMD = Buffer.from(FG_PS_SCRIPT, 'utf16le').toString('base64');

// Load .env logic
const envPath = app.isPackaged
  ? path.join(process.resourcesPath, "backend", ".env")
  : path.join(__dirname, "..", "backend", ".env");
dotenv.config({ path: envPath });

const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET;

let serverProcess = null;
let activityInterval = null;
let mainWindow = null;

if (require('electron-squirrel-startup')) {
  app.quit();
}

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

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1210,
    height: 820,
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

  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
  });

  mainWindow.loadFile(path.join(__dirname, 'renderer', 'index.html'));

  mainWindow.webContents.on('console-message', (event, level, message, line, sourceId) => {
    console.log(`[RENDERER CONSOLE]: ${message}`);
  });
}

// ───── COMPACT READY HANDLER ─────
app.on('ready', () => {
  nativeTheme.themeSource = 'dark';

  // Set permission handlers BEFORE creating window
  session.defaultSession.setPermissionCheckHandler((webContents, permission) => {
    if (permission === 'media' || permission === 'display-capture') return true;
    return false;
  });

  session.defaultSession.setPermissionRequestHandler((webContents, permission, callback) => {
    if (permission === 'media' || permission === 'display-capture') {
      callback(true);
    } else {
      callback(false);
    }
  });

  createWindow();
});

app.on('window-all-closed', () => {
  if (serverProcess) serverProcess.kill();
  if (process.platform !== 'darwin') app.quit();
});

app.on('will-quit', () => {
  if (serverProcess) serverProcess.kill();
  if (activityInterval) clearInterval(activityInterval);
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});

// ───── IPC HANDLERS ─────

// (activityInterval is already declared at the top)

ipcMain.on('START_ACTIVITY_TRACKING', (event) => {
  if (activityInterval) return;
  console.log('Starting foreground window activity monitor (Win32 API)...');
  let execBusy = false;
  activityInterval = setInterval(() => {
    if (execBusy) return; // Prevent overlapping PowerShell calls
    execBusy = true;
    exec(`powershell.exe -NoProfile -WindowStyle Hidden -EncodedCommand ${FG_ENCODED_CMD}`, { timeout: 5000 }, (error, stdout, stderr) => {
      execBusy = false;
      if (error) {
        console.log('[ACTIVITY] PowerShell error:', error.message);
        return;
      }
      if (!stdout || stdout.trim() === '') return;
      try {
        const parsed = JSON.parse(stdout);
        const results = Array.isArray(parsed) ? parsed : [parsed];
        const data = {
          windows: results.map(r => r.windowTitle),
          processes: results.map(r => (r.processName || '').toLowerCase())
        };
        event.reply('ACTIVITY_DATA', data);
      } catch (e) {
        console.log('[ACTIVITY] JSON parse error:', e.message);
      }
    });
  }, 2000);
});

ipcMain.on('STOP_ACTIVITY_TRACKING', () => {
  if (activityInterval) {
    clearInterval(activityInterval);
    activityInterval = null;
  }
});

ipcMain.handle('START_OAUTH_LOGIN', async () => {
  return new Promise((resolve) => {
    let resolved = false;
    const safeResolve = (result) => { if (!resolved) { resolved = true; resolve(result); } };
    const oauthServer = http.createServer();
    const port = 4000;
    oauthServer.on('error', (err) => { safeResolve({ success: false, error: 'Port 4000 is occupied.' }); });
    const authTimeout = setTimeout(() => { try { oauthServer.close(); } catch (e) { } safeResolve({ success: false, error: 'Auth Timed out.' }); }, 120000);
    oauthServer.listen(port, 'localhost', () => {
      const redirectUri = `http://localhost:${port}/auth/google/callback`;
      const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?client_id=${GOOGLE_CLIENT_ID}&redirect_uri=${encodeURIComponent(redirectUri)}&response_type=code&scope=email%20profile`;
      shell.openExternal(authUrl);
      oauthServer.on('request', (req, res) => {
        if (!req.url || !req.url.includes('code=')) return;
        const urlParams = new URL(req.url, `http://localhost:${port}`);
        const code = urlParams.searchParams.get('code');
        clearTimeout(authTimeout);
        res.writeHead(200, { 'Content-Type': 'text/html', 'Connection': 'close' });
        res.end('<html><body style="font-family: sans-serif; text-align: center; padding: 50px;"><h2>Login successful!</h2><p>Return to the app.</p></body></html>');
        if (req.socket) req.socket.destroy();
        oauthServer.close(async () => {
          try {
            const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
              method: 'POST',
              headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
              body: new URLSearchParams({ code, client_id: GOOGLE_CLIENT_ID, client_secret: GOOGLE_CLIENT_SECRET, redirect_uri: redirectUri, grant_type: 'authorization_code' })
            });
            const tokenData = await tokenRes.json();
            if (tokenData.error) return safeResolve({ success: false, error: 'Token Failed.' });
            const userRes = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', { headers: { Authorization: `Bearer ${tokenData.access_token}` } });
            const userData = await userRes.json();
            if (!userData.email || !userData.email.endsWith('@rknec.edu')) return safeResolve({ success: false, error: 'rknec.edu only.' });
            safeResolve({ success: true, user: userData });
          } catch (e) { safeResolve({ success: false, error: 'Auth Error.' }); }
        });
      });
    });
  });
});

ipcMain.handle('START_HOST_SERVER', async () => {
  if (serverProcess) return { success: true, ip: getLocalIpAddress() };
  try {
    const serverJsPath = app.isPackaged ? path.join(process.resourcesPath, 'backend', 'server.js') : path.join(__dirname, '..', 'backend', 'server.js');
    serverProcess = fork(serverJsPath, [], { stdio: 'inherit', env: { ...process.env, PORT: 4000 } });
    return { success: true, ip: getLocalIpAddress() };
  } catch (e) { return { success: false, error: e.toString() }; }
});

ipcMain.handle('GET_SCREEN_SOURCE_ID', async () => {
  try {
    const sources = await desktopCapturer.getSources({ types: ['screen'] });
    return (sources && sources.length > 0) ? sources[0].id : null;
  } catch (e) { return null; }
});

// ───── NEW 100% RELIABLE CAPTURE HANDLER ─────
ipcMain.handle('CAPTURE_SCREEN_SNAPSHOT', async () => {
  try {
    // Capture at high enough resolution for the teacher to read text
    const sources = await desktopCapturer.getSources({ types: ['screen'], thumbnailSize: { width: 1280, height: 720 } });
    if (sources && sources.length > 0) {
      // Return high-quality JPEG as Base64 Data URL
      return sources[0].thumbnail.toDataURL();
    }
  } catch (e) { console.error('Capture snapshot error:', e); }
  return null;
});
