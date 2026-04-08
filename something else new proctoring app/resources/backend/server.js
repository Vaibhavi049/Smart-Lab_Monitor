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
      req.logout(() => {});
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
  ML: ['colab', 'classroom', 'explorer', 'file browser', 'code', 'visual studio',
       'python', 'jupyter', 'anaconda', 'terminal', 'cmd', 'powershell',
       'notepad', 'sublime', 'pycharm', 'spyder', 'idle'],
  DBMS: ['classroom', 'sql plus', 'sqlplus', 'sqldeveloper', 'oracle', 'gmail',
         'sql developer', 'mysql', 'workbench', 'dbeaver', 'terminal', 'cmd',
         'powershell', 'notepad', 'toad', 'navicat', 'pgadmin', 'postgres']
};

// Window TITLES to always skip (case-insensitive partial match)
const SYSTEM_TITLE_SKIP = [
  'task manager', 'program manager', 'settings', 'smartlab',
  'smartlab assist', 'smartlab_assist', 'monitoring app',
  'desktop', 'shell_traywnd', 'notification', 'action center',
  'cortana', 'search', 'start menu', 'lock screen',
  'input', 'keyboard', 'runtime broker', 'application frame',
  'system tray', 'systray', 'windows security',
  'microsoft store', 'your phone', 'phone link',
  'widget', 'news and interests', 'weather', 'clock',
  'snipping tool', 'screen sketch', 'calculator',
  'default ime', 'msctfime', 'nvidia',
  'windows default lock screen', 'ccc.exe',
  'electron', 'devtools'
];

// Process NAMES to always skip (case-insensitive partial match)
const SYSTEM_PROCESS_SKIP = [
  'textinputhost', 'shellexperiencehost', 'applicationframehost',
  'searchapp', 'searchhost', 'startmenuexperiencehost',
  'runtimebroker', 'lockapp', 'systemsettings',
  'widgethost', 'widgets', 'gamebar', 'gamebarftserver',
  'explorer', 'dwm', 'csrss', 'winlogon', 'ctfmon',
  'securityhealthsystray', 'securityhealthservice',
  'taskhostw', 'sihost', 'fontdrvhost',
  'smartlab', 'electron', 'monitoring',
  'nvidia', 'igfx', 'realtek', 'logitech'
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

    const alreadyIn = session.students.some((s) => s.socketId === socket.id);
    if (!alreadyIn) {
      const studentId = generateStudentId();
      const student = {
        socketId: socket.id,
        studentId,
        name: name.trim(),
        flagged: false
      };
      session.students.push(student);

      socket.join(roomCode);

      console.log(`Student joined: roomCode=${roomCode}, name=${student.name}, socketId=${socket.id}`);

      io.to(roomCode).emit('STUDENT_JOINED', { roomCode, student });
      io.to(roomCode).emit('STUDENT_LIST_UPDATED', {
        roomCode,
        students: session.students.map((s) => ({ socketId: s.socketId, studentId: s.studentId, name: s.name, flagged: s.flagged, lastActivity: s.lastActivity || null }))
      });

      if (callback) {
        callback({
          success: true,
          session: { roomCode, monitoringStatus: session.monitoringStatus },
          student: { studentId: student.studentId, name: student.name }
        });
      }
    } else {
      if (callback) callback({ success: true, session: { roomCode, monitoringStatus: session.monitoringStatus } });
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

    // Determine the "active" window title (first non-system window)
    const activeWindow = (windows || []).find(w => {
      const lw = w.toLowerCase();
      return !SYSTEM_TITLE_SKIP.some(skip => lw.includes(skip));
    }) || (windows && windows[0]) || 'N/A';

    // Determine the active process
    const activeProcess = (processes || [])[0] || 'Unknown';

    let isFlagged = false;

    // Check each window title + its corresponding process
    for (let i = 0; i < (windows || []).length; i++) {
      const windowTitle = (windows[i] || '').toLowerCase();
      const processName = ((processes || [])[i] || '').toLowerCase();

      // Skip empty titles
      if (!windowTitle || windowTitle.trim() === '') continue;

      // Skip system windows (by title)
      if (SYSTEM_TITLE_SKIP.some(skip => windowTitle.includes(skip))) continue;

      // Skip system processes (by process name)
      if (SYSTEM_PROCESS_SKIP.some(skip => processName.includes(skip))) continue;

      // Check if this window/process is allowed by the subject rules
      let isAllowed = false;
      for (const keyword of allowedKeywords) {
        if (windowTitle.includes(keyword) || processName.includes(keyword)) {
          isAllowed = true;
          break;
        }
      }

      if (!isAllowed) {
        console.log(`[FLAG] Student ${session.students[studentIndex].name} - Unauthorized: "${windows[i]}" (process: ${processName})`);
        isFlagged = true;
        break;
      }
    }

    const student = session.students[studentIndex];
    student.flagged = isFlagged;
    student.lastActivity = { windowTitle: activeWindow, processName: activeProcess };

    // Always emit so teacher sees live activity updates
    io.to(roomCode).emit('STUDENT_LIST_UPDATED', {
      roomCode,
      students: session.students.map((s) => ({
        socketId: s.socketId,
        studentId: s.studentId,
        name: s.name,
        flagged: s.flagged,
        lastActivity: s.lastActivity || null
      }))
    });
  });

  // ─── WebRTC Signaling ─────────────────────────────────────────────
  socket.on('REQUEST_STREAM', (payload) => {
    const { targetSocketId, adminSocketId } = payload || {};
    if (targetSocketId) {
      io.to(targetSocketId).emit('REQUEST_STREAM', { adminSocketId });
    }
  });

  socket.on('WEBRTC_OFFER', (payload) => {
    const { targetSocketId, offer } = payload || {};
    if (targetSocketId) {
      io.to(targetSocketId).emit('WEBRTC_OFFER', { offer, studentSocketId: socket.id });
    }
  });

  socket.on('WEBRTC_ANSWER', (payload) => {
    const { targetSocketId, answer } = payload || {};
    if (targetSocketId) {
      io.to(targetSocketId).emit('WEBRTC_ANSWER', { answer });
    }
  });

  socket.on('WEBRTC_ICE_CANDIDATE', (payload) => {
    const { targetSocketId, candidate } = payload || {};
    if (targetSocketId) {
      io.to(targetSocketId).emit('WEBRTC_ICE_CANDIDATE', { candidate });
    }
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
      const [removed] = session.students.splice(studentIndex, 1);

      console.log(`Student disconnected: roomCode=${roomCode}, studentId=${removed.studentId}, name=${removed.name}`);

      io.to(roomCode).emit('STUDENT_LIST_UPDATED', {
        roomCode,
        students: session.students.map((s) => ({
          socketId: s.socketId,
          studentId: s.studentId,
          name: s.name,
          flagged: s.flagged,
          lastActivity: s.lastActivity || null
        }))
      });
    }
  });
});

const PORT = process.env.PORT || 4000;
server.listen(PORT, '0.0.0.0', () => {
  console.log(`SmartLab server listening on http://0.0.0.0:${PORT}`);
});