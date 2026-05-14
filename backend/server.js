require('dotenv').config();
const express = require('express');
const http = require('http');
const cors = require('cors');
const path = require('path');
const { Server } = require('socket.io');
const crypto = require('crypto');
const session = require('express-session');
const passport = require('passport');
const GoogleStrategy = require('passport-google-oauth20').Strategy;

const app = express();
const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST']
  }
});

app.use(cors());
app.use(express.json());

// ─── Session & Passport for web client ────────────────────────────────
app.use(session({
  secret: process.env.SESSION_SECRET || 'smartlab-secret-key-2024',
  resave: false,
  saveUninitialized: false,
  cookie: { secure: false, maxAge: 24 * 60 * 60 * 1000 }
}));

passport.serializeUser((user, done) => done(null, user));
passport.deserializeUser((user, done) => done(null, user));

const GOOGLE_CLIENT_ID = (process.env.GOOGLE_CLIENT_ID || '').trim();
const GOOGLE_CLIENT_SECRET = (process.env.GOOGLE_CLIENT_SECRET || '').trim();

if (GOOGLE_CLIENT_ID && GOOGLE_CLIENT_SECRET) {
  passport.use(new GoogleStrategy({
    clientID: GOOGLE_CLIENT_ID,
    clientSecret: GOOGLE_CLIENT_SECRET,
    callbackURL: '/auth/google/callback'
  }, (accessToken, refreshToken, profile, done) => {
    const email = profile.emails && profile.emails[0] ? profile.emails[0].value : '';
    const user = {
      id: profile.id,
      name: profile.displayName,
      email: email,
      picture: profile.photos && profile.photos[0] ? profile.photos[0].value : ''
    };
    done(null, user);
  }));
}

app.use(passport.initialize());
app.use(passport.session());

// ─── Auth routes for web client ───────────────────────────────────────
app.get('/auth/google', (req, res, next) => {
  // Store the intended role in session
  req.session.pendingRole = req.query.role || 'student';
  passport.authenticate('google', { scope: ['profile', 'email'] })(req, res, next);
});

app.get('/auth/google/callback',
  passport.authenticate('google', { failureRedirect: '/' }),
  (req, res) => {
    const role = req.session.pendingRole || 'student';
    // Check domain restriction
    if (req.user && req.user.email && !req.user.email.endsWith('@rknec.edu')) {
      req.logout(() => { });
      return res.redirect('/?error=domain');
    }
    if (role === 'admin') {
      res.redirect('/admin-dashboard');
    } else {
      res.redirect('/student-dashboard');
    }
  }
);

app.get('/api/user', (req, res) => {
  if (req.user) {
    res.json(req.user);
  } else {
    res.status(401).json({ error: 'Not authenticated' });
  }
});

app.get('/admin-dashboard', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.get('/student-dashboard', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.get('/logout', (req, res) => {
  req.logout(() => {
    res.redirect('/');
  });
});

// ─── Static files ─────────────────────────────────────────────────────
const publicDir = path.join(__dirname, 'public');
app.use(express.static(publicDir));

app.get('/health', (req, res) => {
  res.json({ status: 'ok' });
});

// ─── Session management ───────────────────────────────────────────────
const sessions = {};

function generateRoomCode() {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let code;
  do {
    code = Array.from({ length: 6 }, () =>
      chars.charAt(Math.floor(Math.random() * chars.length))
    ).join('');
  } while (sessions[code]);
  return code;
}

function generateStudentId() {
  return crypto.randomBytes(3).toString('hex');
}

function findSessionByStudentSocket(socketId) {
  for (const roomCode of Object.keys(sessions)) {
    const session = sessions[roomCode];
    const studentIndex = session.students.findIndex(
      (s) => s.socketId === socketId
    );
    if (studentIndex !== -1) {
      return { session, roomCode, studentIndex };
    }
  }
  return null;
}

function findSessionByAdminSocket(socketId) {
  for (const roomCode of Object.keys(sessions)) {
    const session = sessions[roomCode];
    if (session.adminSocketId === socketId) {
      return { session, roomCode };
    }
  }
  return null;
}

// ─── Smart Environment Blocking Rules ─────────────────────────────────
// Allowed window title keywords per subject
const RULES = {
  ML: ['colab', 'google colab', 'colaboratory', 'google-colab', 'classroom', 'explorer', 'file browser', 'code', 'visual studio',
    'python', 'jupyter', 'anaconda', 'terminal', 'cmd', 'powershell',
    'notepad', 'sublime', 'pycharm', 'spyder', 'idle', 'antigravity'],
  DBMS: ['classroom', 'sql plus', 'sqlplus', 'sqldeveloper', 'oracle', 'gmail',
    'sql developer', 'mysql', 'workbench', 'dbeaver', 'terminal', 'cmd',
    'powershell', 'notepad', 'toad', 'navicat', 'pgadmin', 'postgres', 'antigravity']
};

// Window TITLES to always skip (case-insensitive partial match)
const SYSTEM_TITLE_SKIP = [
  'task manager', 'program manager', 'settings', 'smartlab',
  'smartlab assist', 'smartlab_assist', 'monitoring app', 'smart-lab', 'assist', 'monitor',
  'desktop', 'shell_traywnd', 'notification', 'action center',
  'cortana', 'search', 'start menu', 'lock screen',
  'input', 'keyboard', 'runtime broker', 'application frame',
  'system tray', 'systray', 'windows security',
  'microsoft store', 'your phone', 'phone link',
  'widget', 'news and interests', 'weather', 'clock',
  'snipping tool', 'screen sketch', 'calculator',
  'default ime', 'msctfime', 'nvidia',
  'windows default lock screen', 'ccc.exe',
  'electron', 'devtools', 'antigravity',
  'new tab', 'browser helper', 'extension:', 'about:'
];

// Process NAMES to always skip (case-insensitive partial match)
const SYSTEM_PROCESS_SKIP = [
  'textinputhost', 'shellexperiencehost', 'applicationframehost',
  'searchapp', 'searchhost', 'startmenuexperiencehost',
  'runtimebroker', 'lockapp', 'systemsettings',
  'widgethost', 'widgets', 'gamebar', 'gamebarftserver',
  'dwm', 'ctfmon',
  'securityhealthsystray', 'securityhealthservice',
  'sihost', 'fontdrvhost',
  'smartlab', 'smartlab_assist', 'electron', 'monitoring', 'smartlab-assist',
  'nvidia', 'igfx', 'realtek', 'logitech', 'antigravity'
];

// ─── Socket.IO Events ─────────────────────────────────────────────────
io.on('connection', (socket) => {
  console.log(`Socket connected: ${socket.id}`);

  socket.on('CREATE_SESSION', (payload, callback) => {
    const { subject } = payload || {};
    try {
      const existing = findSessionByAdminSocket(socket.id);
      if (existing) {
        if (callback) return callback({ success: false, error: 'Admin already has an active session.' });
        return;
      }

      const roomCode = generateRoomCode();
      const sessionId = crypto.randomUUID();
      const session = {
        sessionId,
        roomCode,
        subject: subject || 'ML',
        adminSocketId: socket.id,
        students: [],
        monitoringStatus: 'stopped'
      };

      sessions[roomCode] = session;
      socket.join(roomCode);

      console.log(`Session created: roomCode=${roomCode}, subject=${session.subject}, adminSocketId=${socket.id}`);

      if (callback) {
        callback({
          success: true,
          session: {
            sessionId,
            roomCode,
            subject: session.subject,
            monitoringStatus: session.monitoringStatus,
            students: session.students
          }
        });
      }
    } catch (err) {
      console.error('Error in CREATE_SESSION:', err);
      if (callback) callback({ success: false, error: 'Internal server error.' });
    }
  });

  socket.on('START_MONITORING', (payload, callback) => {
    const { roomCode } = payload || {};
    const session = sessions[roomCode];

    if (!session) {
      if (callback) callback({ success: false, error: 'Session not found.' });
      return;
    }
    if (session.adminSocketId !== socket.id) {
      if (callback) callback({ success: false, error: 'Not authorized.' });
      return;
    }

    session.monitoringStatus = 'active';
    io.to(roomCode).emit('MONITORING_STARTED', { roomCode, monitoringStatus: session.monitoringStatus });
    if (callback) callback({ success: true });
  });

  socket.on('STOP_MONITORING', (payload, callback) => {
    const { roomCode } = payload || {};
    const session = sessions[roomCode];

    if (!session) {
      if (callback) callback({ success: false, error: 'Session not found.' });
      return;
    }
    if (session.adminSocketId !== socket.id) {
      if (callback) callback({ success: false, error: 'Not authorized.' });
      return;
    }

    session.monitoringStatus = 'stopped';
    io.to(roomCode).emit('MONITORING_STOPPED', { roomCode, monitoringStatus: session.monitoringStatus });
    if (callback) callback({ success: true });
  });

  socket.on('END_SESSION', (payload, callback) => {
    const { roomCode } = payload || {};
    const session = sessions[roomCode];

    if (!session || session.adminSocketId !== socket.id) {
      if (callback) callback({ success: false, error: 'Not authorized or not found.' });
      return;
    }

    io.to(roomCode).emit('SESSION_ENDED', { roomCode });

    for (const student of session.students) {
      const studentSocket = io.sockets.sockets.get(student.socketId);
      if (studentSocket) studentSocket.leave(roomCode);
    }
    socket.leave(roomCode);

    delete sessions[roomCode];
    console.log(`Session ended: roomCode=${roomCode}`);

    if (callback) callback({ success: true });
  });

  socket.on('JOIN_SESSION', (payload, callback) => {
    const { roomCode: rawCode, name } = payload || {};
    const roomCode = (rawCode || '').toUpperCase().trim();

    if (!roomCode || !name || !name.trim()) {
      if (callback) callback({ success: false, error: 'Room code and name are required.' });
      return;
    }

    const session = sessions[roomCode];
    if (!session) {
      if (callback) callback({ success: false, error: 'Session not found. Check the room code.' });
      return;
    }

    const studentName = name.trim();
    // Check if student IS ALREADY in the list (re-claiming/re-joining)
    const existingStudent = session.students.find(s => s.name === studentName);

    if (existingStudent) {
      // Re-claim the slot
      existingStudent.socketId = socket.id;
      existingStudent.connected = true;
      delete existingStudent.disconnectTime;

      socket.join(roomCode);
      console.log(`Student RE-JOINED: roomCode=${roomCode}, name=${studentName}, socketId=${socket.id}`);

      io.to(roomCode).emit('STUDENT_LIST_UPDATED', {
        roomCode,
        students: session.students.map(s => ({ ...s }))
      });

      if (callback) {
        callback({
          success: true,
          session: { roomCode, monitoringStatus: session.monitoringStatus },
          student: { studentId: existingStudent.studentId, name: existingStudent.name }
        });
      }
    } else {
      // NEW student join
      const studentId = generateStudentId();
      const newStudent = {
        socketId: socket.id,
        studentId,
        name: studentName,
        flagged: false,
        flagLogs: [],
        connected: true
      };

      session.students.push(newStudent);
      socket.join(roomCode);

      console.log(`NEW student joined: roomCode=${roomCode}, name=${studentName}, socketId=${socket.id}`);

      io.to(roomCode).emit('STUDENT_JOINED', { roomCode, student: newStudent });
      io.to(roomCode).emit('STUDENT_LIST_UPDATED', {
        roomCode,
        students: session.students.map(s => ({ ...s }))
      });

      if (callback) {
        callback({
          success: true,
          session: { roomCode, monitoringStatus: session.monitoringStatus },
          student: { studentId: newStudent.studentId, name: newStudent.name }
        });
      }
    }
  });

  // ─── Activity Update & Smart Blocking ─────────────────────────────
  socket.on('ACTIVITY_UPDATE', (payload) => {
    const sessionInfo = findSessionByStudentSocket(socket.id);
    if (!sessionInfo) return;

    const { session, roomCode, studentIndex } = sessionInfo;
    if (session.monitoringStatus !== 'active') return;

    const { windows, processes } = payload || {};
    const allowedKeywords = RULES[session.subject] || [];

    // FIND THE ACTIVE/MAIN WINDOW (Identify the first non-system window)
    let activeWindowTitle = 'N/A';
    let activeProcessName = 'Unknown';
    let targetIndex = -1;
    let allWindowsAreSystem = true; // Track if every window is a system/self window

    for (let i = 0; i < (windows || []).length; i++) {
      const title = (windows[i] || '').toLowerCase();
      const proc = (processes && processes[i] || '').toLowerCase();

      // Check if this window is a system/self window (title OR process matches skip lists)
      const titleIsSystem = SYSTEM_TITLE_SKIP.some(skip => title.includes(skip));
      const procIsSystem = SYSTEM_PROCESS_SKIP.some(skip => proc.includes(skip));

      if (!titleIsSystem && !procIsSystem) {
        // Found a real, non-system window — this is the one to evaluate
        activeWindowTitle = windows[i];
        activeProcessName = (processes && processes[i]) || 'Unknown';
        targetIndex = i;
        allWindowsAreSystem = false;
        break;
      }
    }

    // If ALL windows are system/self windows (e.g. SmartLab app itself, desktop, etc.)
    // then this is a SAFE state — the student is looking at the monitoring app or the OS.
    // Do NOT flag this and just record the activity as-is.
    if (allWindowsAreSystem) {
      activeWindowTitle = (windows && windows.length > 0) ? windows[0] : 'SmartLab Monitor';
      activeProcessName = (processes && processes.length > 0) ? processes[0] : 'smartlab';
      targetIndex = 0;
    }

    let isFlagged = false;

    // ONLY evaluate against subject rules if the active window is a REAL app (not system/self)
    if (!allWindowsAreSystem && targetIndex !== -1) {
      const windowTitle = activeWindowTitle.toLowerCase();
      const processName = activeProcessName.toLowerCase();

      let isAllowed = false;
      for (const keyword of allowedKeywords) {
        if (windowTitle.includes(keyword) || processName.includes(keyword)) {
          isAllowed = true;
          break;
        }
      }

      if (!isAllowed) {
        console.log(`[FLAG] Student ${session.students[studentIndex].name} - Unauthorized Active Window: "${activeWindowTitle}"`);
        isFlagged = true;
      }
    }

    const student = session.students[studentIndex];
    let isNewFlagEvent = false;
    if (isFlagged) {
      if (!student.flagLogs) student.flagLogs = [];
      const lastLog = student.flagLogs[student.flagLogs.length - 1];
      if (!lastLog || lastLog.windowTitle !== activeWindowTitle) {
        student.flagLogs.push({
          timestamp: Date.now(),
          windowTitle: activeWindowTitle,
          processName: activeProcessName
        });
        isNewFlagEvent = true;
      }
    }
    student.flagged = isFlagged;
    student.lastActivity = { windowTitle: activeWindowTitle, processName: activeProcessName };

    // Notify the specific student in real-time when they get flagged
    if (isFlagged && isNewFlagEvent) {
      const studentSocket = io.sockets.sockets.get(student.socketId);
      if (studentSocket) {
        studentSocket.emit('STUDENT_FLAG_ALERT', {
          message: `Your profile has been flagged because you opened: "${activeWindowTitle}"`,
          windowTitle: activeWindowTitle,
          processName: activeProcessName,
          timestamp: Date.now(),
          flagLogs: student.flagLogs
        });
      }
    }

    // Always emit so teacher sees live activity updates
    io.to(roomCode).emit('STUDENT_LIST_UPDATED', {
      roomCode,
      students: session.students.map((s) => ({
        socketId: s.socketId,
        studentId: s.studentId,
        name: s.name,
        flagged: s.flagged,
        flagLogs: s.flagLogs || [],
        lastActivity: s.lastActivity || null
      }))
    });
  });

  // ─── Hybrid Signaling Relays (Video + Snapshot) ───────────────────
  socket.on('START_LIVE_VIEW', (payload) => {
    if (payload.targetSocketId) io.to(payload.targetSocketId).emit('START_LIVE_VIEW', { adminSocketId: payload.adminSocketId });
  });

  socket.on('STOP_LIVE_VIEW', (payload) => {
    if (payload.roomCode) io.to(payload.roomCode).emit('STOP_LIVE_VIEW');
  });

  socket.on('LIVE_OFFER', (payload) => {
    if (payload.targetSocketId) io.to(payload.targetSocketId).emit('LIVE_OFFER', { offer: payload.offer, studentSocketId: socket.id });
  });

  socket.on('LIVE_ANSWER', (payload) => {
    if (payload.targetSocketId) io.to(payload.targetSocketId).emit('LIVE_ANSWER', { answer: payload.answer });
  });

  socket.on('LIVE_ICE', (payload) => {
    if (payload.targetSocketId) io.to(payload.targetSocketId).emit('LIVE_ICE', { candidate: payload.candidate });
  });

  socket.on('LIVE_SNAPSHOT', (payload) => {
    if (payload.targetSocketId) io.to(payload.targetSocketId).emit('LIVE_SNAPSHOT', { dataUrl: payload.dataUrl });
  });

  // ─── Disconnect handling ──────────────────────────────────────────
  socket.on('disconnect', () => {
    console.log(`Socket disconnected: ${socket.id}`);

    const adminSessionInfo = findSessionByAdminSocket(socket.id);
    if (adminSessionInfo) {
      const { roomCode } = adminSessionInfo;
      const session = sessions[roomCode];
      if (session) {
        io.to(roomCode).emit('SESSION_ENDED', { roomCode });
        for (const student of session.students) {
          const studentSocket = io.sockets.sockets.get(student.socketId);
          if (studentSocket) studentSocket.leave(roomCode);
        }
        delete sessions[roomCode];
        console.log(`Session auto-ended due to admin disconnect: roomCode=${roomCode}`);
      }
      return;
    }

    const studentSessionInfo = findSessionByStudentSocket(socket.id);
    if (studentSessionInfo) {
      const { session, roomCode, studentIndex } = studentSessionInfo;
      const student = session.students[studentIndex];

      // Mark as disconnected but don't remove yet (Grace Period)
      student.connected = false;
      student.disconnectTime = Date.now();

      console.log(`Student disconnected (Grace Period): roomCode=${roomCode}, name=${student.name}`);

      io.to(roomCode).emit('STUDENT_LIST_UPDATED', {
        roomCode,
        students: session.students.map(s => ({ ...s }))
      });
    }
  });
});

// ─── Cleanup Interval (Grace Period) ──────────────────────────────────
setInterval(() => {
  const now = Date.now();
  const GRACE_PERIOD_MS = 120000; // 2 minutes

  for (const roomCode in sessions) {
    const session = sessions[roomCode];
    const initialCount = session.students.length;

    // Filter out students who have been disconnected for too long
    session.students = session.students.filter(s => {
      if (s.connected) return true;
      const disconnectedFor = now - (s.disconnectTime || 0);
      return disconnectedFor < GRACE_PERIOD_MS;
    });

    if (session.students.length !== initialCount) {
      console.log(`Cleaned up disconnected students in room ${roomCode}`);
      io.to(roomCode).emit('STUDENT_LIST_UPDATED', {
        roomCode,
        students: session.students.map(s => ({ ...s }))
      });
    }
  }
}, 15000); // Check every 15 seconds

const PORT = process.env.PORT || 4000;
server.listen(PORT, '0.0.0.0', () => {
  console.log(`SmartLab server listening on http://0.0.0.0:${PORT}`);
});