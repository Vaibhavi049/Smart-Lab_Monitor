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

app.use(session({
  secret: 'smartlab-secret-key',
  resave: false,
  saveUninitialized: false
}));

app.use(passport.initialize());
app.use(passport.session());

passport.serializeUser((user, done) => {
  done(null, user);
});

passport.deserializeUser((user, done) => {
  done(null, user);
});

passport.use(new GoogleStrategy({
    clientID: process.env.GOOGLE_CLIENT_ID || 'mock-client-id',
    clientSecret: process.env.GOOGLE_CLIENT_SECRET || 'mock-client-secret',
    callbackURL: "/auth/google/callback"
  },
  function(accessToken, refreshToken, profile, cb) {
    const email = (profile.emails && profile.emails.length > 0) ? profile.emails[0].value : '';
    if (!email.endsWith('@rknec.edu')) {
       return cb(null, false, { message: 'Unauthorized domain' });
    }
    const user = {
      name: profile.displayName,
      email: email,
      id: profile.id
    };
    return cb(null, user);
  }
));

const publicDir = path.join(__dirname, 'public');
app.use(express.static(publicDir));

app.get('/auth/google', (req, res, next) => {
  const role = req.query.role || 'student';
  const state = Buffer.from(JSON.stringify({ role })).toString('base64');
  passport.authenticate('google', { scope: ['profile', 'email'], state })(req, res, next);
});

app.get('/auth/google/callback',
  passport.authenticate('google', { failureRedirect: '/unauthorized' }),
  function(req, res) {
    let target = '/student-dashboard';
    if (req.query.state) {
      try {
        const decoded = JSON.parse(Buffer.from(req.query.state, 'base64').toString('ascii'));
        if (decoded.role === 'admin') target = '/admin-dashboard';
      } catch (e) {
        console.error("Error decoding state", e);
      }
    }
    res.redirect(target);
  }
);

app.get('/admin-dashboard', (req, res) => {
  if (!req.isAuthenticated()) return res.redirect('/');
  res.sendFile(path.join(publicDir, 'index.html'));
});

app.get('/student-dashboard', (req, res) => {
  if (!req.isAuthenticated()) return res.redirect('/');
  res.sendFile(path.join(publicDir, 'index.html'));
});

app.get('/api/user', (req, res) => {
  if (req.isAuthenticated()) {
    res.json(req.user);
  } else {
    res.status(401).json({ error: 'Not authenticated' });
  }
});

app.get('/unauthorized', (req, res) => {
  res.send(`
    <div style="font-family: sans-serif; text-align: center; margin-top: 50px;">
      <h1>Unauthorized Access</h1>
      <p>Only @rknec.edu accounts are allowed.</p>
      <a href="/">Go Back</a>
    </div>
  `);
});

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

app.get('/health', (req, res) => {
  res.json({ status: 'ok' });
});

io.on('connection', (socket) => {
  console.log(`Socket connected: ${socket.id}`);

  socket.on('CREATE_SESSION', (payload, callback) => {
    const { subject } = payload || {};
    try {
      const existing = findSessionByAdminSocket(socket.id);
      if (existing) {
        if (callback) {
          return callback({
            success: false,
            error: 'Admin already has an active session.'
          });
        }
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

      console.log(`Session created: roomCode=${roomCode}, adminSocketId=${socket.id}`);

      if (callback) {
        callback({
          success: true,
          session: {
            sessionId,
            roomCode,
            monitoringStatus: session.monitoringStatus,
            students: session.students
          }
        });
      }
    } catch (err) {
      console.error('Error in CREATE_SESSION:', err);
      if (callback) {
        callback({
          success: false,
          error: 'Internal server error.'
        });
      }
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
    io.to(roomCode).emit('MONITORING_STARTED', {
      roomCode,
      monitoringStatus: session.monitoringStatus
    });

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
    io.to(roomCode).emit('MONITORING_STOPPED', {
      roomCode,
      monitoringStatus: session.monitoringStatus
    });

    if (callback) callback({ success: true });
  });

  socket.on('END_SESSION', (payload, callback) => {
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

    io.to(roomCode).emit('SESSION_ENDED', { roomCode });

    for (const student of session.students) {
      const studentSocket = io.sockets.sockets.get(student.socketId);
      if (studentSocket) {
        studentSocket.leave(roomCode);
      }
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
      if (callback) {
        callback({
          success: false,
          error: 'Room code and name are required.'
        });
      }
      return;
    }

    const session = sessions[roomCode];
    if (!session) {
      if (callback) {
        callback({
          success: false,
          error: 'Session not found. Check the room code.'
        });
      }
      return;
    }

    const alreadyIn = session.students.some((s) => s.socketId === socket.id);
    if (!alreadyIn) {
      const studentId = generateStudentId();
      const student = {
        socketId: socket.id,
        studentId,
        name: name.trim()
      };
      session.students.push(student);

      socket.join(roomCode);

      console.log(
        `Student joined: roomCode=${roomCode}, name=${student.name}, socketId=${socket.id}`
      );

      io.to(roomCode).emit('STUDENT_JOINED', {
        roomCode,
        student
      });
      io.to(roomCode).emit('STUDENT_LIST_UPDATED', {
        roomCode,
        students: session.students.map((s) => ({
          studentId: s.studentId,
          name: s.name
        }))
      });

      if (callback) {
        callback({
          success: true,
          session: {
            roomCode,
            monitoringStatus: session.monitoringStatus
          },
          student: {
            studentId: student.studentId,
            name: student.name
          }
        });
      }
    } else {
      if (callback) {
        callback({
          success: true,
          session: {
            roomCode,
            monitoringStatus: session.monitoringStatus
          }
        });
      }
    }
  });

  // Rule engine configurations
  const RULES = {
    ML: ['colab', 'classroom', 'gmail'],
    DBMS: ['classroom', 'sql plus', 'sqlplus']
  };

  socket.on('ACTIVITY_UPDATE', (payload) => {
    const sessionInfo = findSessionByStudentSocket(socket.id);
    if (!sessionInfo) return;

    const { session, roomCode, studentIndex } = sessionInfo;
    if (session.monitoringStatus !== 'active') return;

    const { windows, processes } = payload || {};
    const allowedKeywords = RULES[session.subject] || [];

    let isFlagged = false;

    // Strict whitelisting: if ANY active WINDOW doesn't match ALLOWED keywords, flag them.
    for (const item of (windows || [])) {
      const lowerItem = item.toLowerCase();
      
      // Skip generic OS items that shouldn't trigger flags automatically
      if (lowerItem.includes('explorer') || lowerItem.includes('task manager') || lowerItem.includes('program manager')) continue;

      let isAllowed = false;
      for (const keyword of allowedKeywords) {
        if (lowerItem.includes(keyword)) {
          isAllowed = true;
          break;
        }
      }
      
      if (!isAllowed) {
        isFlagged = true;
        break;
      }
    }

    const student = session.students[studentIndex];
    if (student.flagged !== isFlagged) {
      student.flagged = isFlagged;
      
      // Broadcast updated student list including the flag state
      io.to(roomCode).emit('STUDENT_LIST_UPDATED', {
        roomCode,
        students: session.students.map((s) => ({
          studentId: s.studentId,
          name: s.name,
          flagged: s.flagged
        }))
      });
    }
  });

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
          if (studentSocket) {
            studentSocket.leave(roomCode);
          }
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

      console.log(
        `Student disconnected: roomCode=${roomCode}, studentId=${removed.studentId}, name=${removed.name}`
      );

      io.to(roomCode).emit('STUDENT_LIST_UPDATED', {
        roomCode,
        students: session.students.map((s) => ({
          studentId: s.studentId,
          name: s.name
        }))
      });
    }
  });
});

const PORT = process.env.PORT || 4000;
server.listen(PORT, '0.0.0.0', () => {
  console.log(`Server listening on http://10.64.101.40:${PORT}`);
});
