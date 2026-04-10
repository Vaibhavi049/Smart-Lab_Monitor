// renderer.js - Senior Engineer Hybrid Monitor Refactor
// Uses the HybridStreamer module for 100% reliable monitoring.

const $ = (id) => document.getElementById(id);

// --- UI Elements ---
const roleSelectionCard = $('role-selection');
const adminDashboardCard = $('admin-dashboard');
const studentJoinCard = $('student-join');
const studentSessionCard = $('student-session');

const connectionDot = $('connection-dot');
const connectionText = $('connection-text');

const adminBackBtn = $('admin-back-btn');
const startSessionBtn = $('start-session-btn');
const startMonitoringBtn = $('start-monitoring-btn');
const stopMonitoringBtn = $('stop-monitoring-btn');
const endSessionBtn = $('end-session-btn');

const adminRoomCodeEl = $('admin-room-code');
const adminMonitoringStatusEl = $('admin-monitoring-status');
const adminStudentCountEl = $('admin-student-count');
const studentsGrid = $('students-grid');
const studentsSubtitle = $('students-subtitle');

const studentBackBtn = $('student-back-btn');
const studentLeaveBtn = $('student-leave-btn');
const studentRoomCodeInput = $('student-room-code');
const studentServerIpInput = $('student-server-ip');
const joinSessionBtn = $('join-session-btn');
const studentJoinError = $('student-join-error');

const studentSessionRoomCodeEl = $('student-session-room-code');
const studentMonitoringStatusEl = $('student-monitoring-status');
const studentDisplayNameEl = $('student-display-name');
const studentStatusMessageEl = $('student-status-message');
const studentSessionSubtitle = $('student-session-subtitle');

const adminBtn = $('admin-btn');
const studentBtn = $('student-btn');

const webrtcModal = $('webrtc-modal');
const remoteVideo = $('remoteVideo');
const remoteSnapshot = $('remoteSnapshot');
const monitorModeEl = $('monitor-mode');
const closeStreamBtn = $('close-stream-btn');

const flagLogsModal = $('flag-logs-modal');
const closeLogsBtn = $('close-logs-btn');
const flagLogsContainer = $('flag-logs-container');
const flagLogsStudentName = $('flag-logs-student-name');

// --- Global Config & State ---
let currentRole = null;
let adminRoomCode = null;
let adminMonitoringStatus = 'stopped';
let adminStudents = [];
let activeSubject = null;
let currentUser = null;
let studentSession = { roomCode: null, name: null, studentId: null, monitoringStatus: 'stopped' };

const rtcConfig = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' }
  ]
};

// --- Instantiate the Modular Streamer ---
const streamer = new HybridStreamer(socketAPI, rtcConfig);

streamer.onModeChange = (message, mode) => {
  if (monitorModeEl) {
    monitorModeEl.textContent = message;
    // Visually distinguish modes
    if (mode === 'video') {
      monitorModeEl.style.background = 'rgba(34, 197, 94, 0.15)'; // Green
      monitorModeEl.style.color = '#4ade80';
    } else if (mode === 'fallback') {
      monitorModeEl.style.background = 'rgba(239, 68, 68, 0.15)'; // Red
      monitorModeEl.style.color = '#f87171';
    } else {
      monitorModeEl.style.background = 'rgba(56, 189, 248, 0.15)'; // Blue
      monitorModeEl.style.color = 'var(--accent-color)';
    }
  }
};

// --- UI Helpers ---
function showCard(card) {
  const all = [roleSelectionCard, adminDashboardCard, studentJoinCard, studentSessionCard];
  all.forEach((c) => {
    if (c) {
      if (c === card) {
        c.classList.remove('hidden');
        c.classList.add('active');
      } else {
        c.classList.remove('active');
        c.classList.add('hidden');
      }
    }
  });
}

function updateConnectionStatus(connected) {
  if (connectionDot) connected ? connectionDot.classList.add('connected') : connectionDot.classList.remove('connected');
  if (connectionText) connectionText.textContent = connected ? 'Connected' : 'Disconnected';
}

function setAdminMonitoringStatus(status) {
  adminMonitoringStatus = status;
  if (adminMonitoringStatusEl) {
    adminMonitoringStatusEl.textContent = status === 'active' ? 'Active' : 'Stopped';
    adminMonitoringStatusEl.classList.remove('active', 'stopped');
    adminMonitoringStatusEl.classList.add(status);
  }
  if (startMonitoringBtn) startMonitoringBtn.disabled = status === 'active';
  if (stopMonitoringBtn) stopMonitoringBtn.disabled = status === 'stopped';
}

function setStudentMonitoringStatus(status) {
  studentSession.monitoringStatus = status;
  if (studentMonitoringStatusEl) {
    studentMonitoringStatusEl.textContent = status === 'active' ? 'Active' : 'Stopped';
    studentMonitoringStatusEl.classList.remove('active', 'stopped');
    studentMonitoringStatusEl.classList.add(status);
  }
  if (studentStatusMessageEl) studentStatusMessageEl.textContent = status === 'active' ? 'Monitoring is active.' : 'Waiting for monitoring to start...';
}

// --- Student Cards Rendering ---
function renderAdminStudents() {
  if (!studentsGrid) return;
  studentsGrid.innerHTML = '';
  if (adminStudentCountEl) adminStudentCountEl.textContent = adminStudents.length.toString();
  if (adminStudents.length === 0) {
    if (studentsSubtitle) studentsSubtitle.textContent = 'Waiting for students to join...';
    return;
  }
  if (studentsSubtitle) studentsSubtitle.textContent = `Live list of connected students (Subject: ${activeSubject || 'None'})`;
  
  adminStudents.forEach((student) => {
    const card = document.createElement('div');
    card.className = 'student-card';
    const orb = document.createElement('div');
    orb.className = 'student-card-orb';
    const header = document.createElement('div');
    header.className = 'student-card-header';
    const nameEl = document.createElement('div');
    nameEl.className = 'student-card-name';
    nameEl.textContent = student.name;
    const idEl = document.createElement('div');
    idEl.className = 'student-card-id';
    idEl.textContent = `ID: ${student.studentId}`;
    header.appendChild(nameEl);
    header.appendChild(idEl);
    card.appendChild(header);
    
    if (student.lastActivity && student.lastActivity.windowTitle) {
      const activityDiv = document.createElement('div');
      activityDiv.className = 'student-activity-detail';
      activityDiv.style.marginTop = '12px';
      activityDiv.style.fontSize = '0.85rem';
      const titleSpan = document.createElement('div');
      titleSpan.textContent = `Window: ${student.lastActivity.windowTitle}`;
      titleSpan.style.whiteSpace = 'nowrap';
      titleSpan.style.overflow = 'hidden';
      titleSpan.style.textOverflow = 'ellipsis';
      const procSpan = document.createElement('div');
      procSpan.textContent = `Process: ${student.lastActivity.processName || 'Unknown'}`;
      procSpan.style.opacity = '0.7';
      activityDiv.appendChild(titleSpan);
      activityDiv.appendChild(procSpan);
      card.appendChild(activityDiv);
    }
    const btnContainer = document.createElement('div');
    btnContainer.style.display = 'flex';
    btnContainer.style.gap = '8px';
    btnContainer.style.marginTop = '12px';

    const streamBtn = document.createElement('button');
    streamBtn.className = 'primary-btn small';
    streamBtn.textContent = 'View Screen';
    streamBtn.onclick = () => {
       if (webrtcModal) webrtcModal.classList.remove('hidden');
       streamer.startView(student.socketId, remoteVideo, remoteSnapshot);
    };
    
    const logsBtn = document.createElement('button');
    logsBtn.className = 'secondary-btn small';
    logsBtn.textContent = 'View Logs';
    logsBtn.onclick = () => {
       if (flagLogsModal) {
          if (flagLogsStudentName) flagLogsStudentName.textContent = student.name;
          if (flagLogsContainer) {
             flagLogsContainer.innerHTML = '';
             const logs = student.flagLogs || [];
             if (logs.length === 0) {
                flagLogsContainer.innerHTML = '<p style="color: #a1a1aa; font-size: 0.9rem;">No unauthorized activity recorded.</p>';
             } else {
                logs.forEach(log => {
                   const timeString = new Date(log.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                   const logEl = document.createElement('div');
                   logEl.style.padding = '8px 12px';
                   logEl.style.background = 'rgba(239, 68, 68, 0.1)';
                   logEl.style.borderLeft = '3px solid #ef4444';
                   logEl.style.borderRadius = '4px';
                   logEl.style.fontSize = '0.85rem';
                   logEl.textContent = `${timeString} - Unauthorized Window: ${log.windowTitle}`;
                   flagLogsContainer.appendChild(logEl);
                });
             }
          }
          flagLogsModal.classList.remove('hidden');
       }
    };

    btnContainer.appendChild(streamBtn);
    btnContainer.appendChild(logsBtn);
    card.appendChild(btnContainer);
    if (student.flagged && adminMonitoringStatus === 'active') card.classList.add('violating-status');
    card.appendChild(orb);
    studentsGrid.appendChild(card);
  });
}

// --- Socket Handlers ---
function setupSocketEventHandlers() {
  socketAPI.onConnectionEvents({
    onConnect: () => updateConnectionStatus(true),
    onDisconnect: () => updateConnectionStatus(false),
    onReconnect: () => updateConnectionStatus(true)
  });

  socketAPI.on('SESSION_ENDED', (payload) => {
    const { roomCode } = payload || {};
    if (currentRole === 'admin' && roomCode === adminRoomCode) {
      alert('Session ended.'); resetAdminState(); showCard(roleSelectionCard); currentRole = null;
    } else if (currentRole === 'student' && roomCode === studentSession.roomCode) {
      alert('Session ended by admin.'); socketAPI.stopTracking(); resetStudentState(); showCard(roleSelectionCard); currentRole = null;
    }
  });

  socketAPI.on('STUDENT_LIST_UPDATED', (payload) => {
    if (currentRole !== 'admin') return;
    const { roomCode, students } = payload || {};
    if (roomCode === adminRoomCode) { adminStudents = students || []; renderAdminStudents(); }
  });

  socketAPI.on('MONITORING_STARTED', (payload) => {
    const { roomCode, monitoringStatus } = payload || {};
    if (currentRole === 'admin' && roomCode === adminRoomCode) setAdminMonitoringStatus(monitoringStatus || 'active');
    if (currentRole === 'student' && roomCode === studentSession.roomCode) {
      setStudentMonitoringStatus(monitoringStatus || 'active');
      socketAPI.startTracking();
    }
  });

  socketAPI.on('MONITORING_STOPPED', (payload) => {
    const { roomCode, monitoringStatus } = payload || {};
    if (currentRole === 'admin' && roomCode === adminRoomCode) setAdminMonitoringStatus(monitoringStatus || 'stopped');
    if (currentRole === 'student' && roomCode === studentSession.roomCode) {
      setStudentMonitoringStatus(monitoringStatus || 'stopped');
      socketAPI.stopTracking();
    }
  });

  let updateCounter = 0;
  socketAPI.onActivityData((data) => {
    if (studentSession.monitoringStatus === 'active') {
      socketAPI.emit('ACTIVITY_UPDATE', data);
      updateCounter++;
      if (updateCounter % 10 === 0) {
        console.log(`[PULSE] Sent ${updateCounter} activity updates to server...`);
      }
    }
  });

  // ───── NEW MODULAR HYBRID HANDLERS ─────

  socketAPI.on('START_LIVE_VIEW', (payload) => {
    if (currentRole === 'student') streamer.initiateCapture(payload.adminSocketId);
  });

  socketAPI.on('LIVE_OFFER', (payload) => {
    if (currentRole === 'admin') streamer.handleOffer(payload, payload.studentSocketId, remoteVideo, remoteSnapshot);
  });

  socketAPI.on('LIVE_ANSWER', (payload) => {
    if (currentRole === 'student') streamer.peerConnection?.setRemoteDescription(new RTCSessionDescription(payload.answer)).then(() => streamer.flushIceCandidates());
  });

  socketAPI.on('LIVE_ICE', (payload) => {
    streamer.handleIceCandidate(payload.candidate);
  });

  socketAPI.on('LIVE_SNAPSHOT', (payload) => {
    if (currentRole === 'admin') streamer.handleSnapshot(payload, remoteSnapshot, remoteVideo);
  });

  socketAPI.on('STOP_LIVE_VIEW', () => {
    if (currentRole === 'student') streamer.cleanup();
  });
}

// --- Flow Resets ---
function resetAdminState() {
  adminRoomCode = null; adminMonitoringStatus = 'stopped'; adminStudents = []; activeSubject = null;
  if (adminRoomCodeEl) adminRoomCodeEl.textContent = '—';
  setAdminMonitoringStatus('stopped');
  if (adminStudentCountEl) adminStudentCountEl.textContent = '0';
  if (studentsGrid) studentsGrid.innerHTML = '';
  document.querySelectorAll('input[name="subject"]').forEach(radio => { radio.disabled = false; radio.checked = false; });
  if (startSessionBtn) startSessionBtn.disabled = true;
  if (startMonitoringBtn) startMonitoringBtn.disabled = true;
  if (stopMonitoringBtn) stopMonitoringBtn.disabled = true;
  if (endSessionBtn) endSessionBtn.disabled = true;
}

function resetStudentState() {
  studentSession = { roomCode: null, name: null, studentId: null, monitoringStatus: 'stopped' };
  if (studentRoomCodeInput) studentRoomCodeInput.value = '';
  if (studentServerIpInput) studentServerIpInput.value = '';
  if (studentJoinError) { studentJoinError.textContent = ''; studentJoinError.classList.add('hidden'); }
  setStudentMonitoringStatus('stopped');
}

// --- Admin Listeners ---
if (adminBtn) {
  adminBtn.addEventListener('click', async () => {
    currentRole = 'admin'; const oldText = adminBtn.textContent; adminBtn.textContent = 'Authenticating...';
    try {
      const authRes = await socketAPI.loginOAuth();
      if (!authRes.success) { alert('Login Failed: ' + authRes.error); return; }
      currentUser = authRes.user;
      const hostRes = await socketAPI.startHostServer();
      if (!hostRes.success) { alert('Server failed: ' + hostRes.error); return; }
      if ($('admin-server-ip')) $('admin-server-ip').textContent = hostRes.ip;
      resetAdminState(); socketAPI.connect(hostRes.ip); showCard(adminDashboardCard);
    } finally { adminBtn.textContent = oldText; }
  });
}

if (adminBackBtn) {
  adminBackBtn.addEventListener('click', () => {
    if (adminRoomCode && confirm('End session?')) { socketAPI.emit('END_SESSION', { roomCode: adminRoomCode }, () => { resetAdminState(); currentRole = null; showCard(roleSelectionCard); }); } 
    else { resetAdminState(); currentRole = null; showCard(roleSelectionCard); }
  });
}

document.querySelectorAll('input[name="subject"]').forEach(radio => {
  radio.addEventListener('change', () => { if (!adminRoomCode && startSessionBtn) startSessionBtn.disabled = false; });
});

if (startSessionBtn) {
  startSessionBtn.addEventListener('click', () => {
    const selectedRadio = document.querySelector('input[name="subject"]:checked'); if (!selectedRadio) return; activeSubject = selectedRadio.value;
    socketAPI.emit('CREATE_SESSION', { subject: selectedRadio.value }, (res) => {
      if (res && res.success) { adminRoomCode = res.session.roomCode; if (adminRoomCodeEl) adminRoomCodeEl.textContent = adminRoomCode; setAdminMonitoringStatus('stopped'); document.querySelectorAll('input[name="subject"]').forEach(r => r.disabled = true); startSessionBtn.disabled = true; if (startMonitoringBtn) startMonitoringBtn.disabled = false; if (endSessionBtn) endSessionBtn.disabled = false; }
    });
  });
}

if (startMonitoringBtn) {
  startMonitoringBtn.addEventListener('click', () => { if (adminRoomCode) socketAPI.emit('START_MONITORING', { roomCode: adminRoomCode }); });
}

if (stopMonitoringBtn) {
  stopMonitoringBtn.addEventListener('click', () => { if (adminRoomCode) socketAPI.emit('STOP_MONITORING', { roomCode: adminRoomCode }); });
}

if (endSessionBtn) {
  endSessionBtn.addEventListener('click', () => {
    if (adminRoomCode && confirm('End session?')) { socketAPI.emit('END_SESSION', { roomCode: adminRoomCode }, (res) => { if (res && res.success) { resetAdminState(); currentRole = null; showCard(roleSelectionCard); } }); }
  });
}

// --- Student Listeners ---
if (studentBtn) {
  studentBtn.addEventListener('click', async () => {
    currentRole = 'student'; const oldText = studentBtn.textContent; studentBtn.textContent = 'Authenticating...';
    try {
      const authRes = await socketAPI.loginOAuth();
      if (!authRes.success) { alert('Login Failed: ' + authRes.error); return; }
      currentUser = authRes.user; resetStudentState(); showCard(studentJoinCard);
    } finally { studentBtn.textContent = oldText; }
  });
}

if (studentBackBtn) {
  studentBackBtn.addEventListener('click', () => {
    resetStudentState();
    currentRole = null;
    showCard(roleSelectionCard);
  });
}

if (joinSessionBtn) {
  joinSessionBtn.addEventListener('click', () => {
    const roomCode = (studentRoomCodeInput.value || '').trim().toUpperCase();
    const serverIp = (studentServerIpInput.value || '').trim();

    if (!roomCode || roomCode.length !== 6 || !serverIp) {
      alert('Please enter both the Room Code (6 chars) and the Teacher\'s IP Address.');
      return;
    }

    // UI Feedback
    const oldText = joinSessionBtn.textContent;
    joinSessionBtn.textContent = 'Connecting...';
    joinSessionBtn.disabled = true;

    if (studentJoinError) {
      studentJoinError.textContent = '';
      studentJoinError.classList.add('hidden');
    }

    console.log(`[JOIN] Attempting connection to ${serverIp}...`);
    socketAPI.connect(serverIp);

    // Instead of a blind setTimeout, we'll wait for the 'connect' event or a timeout
    const joinTimeout = setTimeout(() => {
      console.error('[JOIN] Connection timed out after 5s');
      joinSessionBtn.textContent = oldText;
      joinSessionBtn.disabled = false;
      alert('Connection timed out. Please check if the Teacher\'s IP is correct and your firewall is not blocking port 4000.');
    }, 5000);

    const onConnectHandler = () => {
      clearTimeout(joinTimeout);
      console.log('[JOIN] Socket connected! Emitting JOIN_SESSION...');
      
      socketAPI.emit('JOIN_SESSION', { roomCode, name: currentUser.name }, (res) => {
        joinSessionBtn.textContent = oldText;
        joinSessionBtn.disabled = false;

        if (res && res.success) {
          console.log('[JOIN] Success!');
          studentSession = { ...res.student, roomCode, monitoringStatus: res.session.monitoringStatus };
          setStudentMonitoringStatus(res.session.monitoringStatus);
          if (res.session.monitoringStatus === 'active') socketAPI.startTracking();
          if (studentSessionRoomCodeEl) studentSessionRoomCodeEl.textContent = roomCode;
          if (studentDisplayNameEl) studentDisplayNameEl.textContent = currentUser.name;
          showCard(studentSessionCard);
        } else {
          console.error('[JOIN] Failed:', res?.error);
          alert(res?.error || 'Failed to join session. Please check the room code.');
        }
      });
      // Clean up the listener so it doesn't fire again
      socketAPI.off('connect', onConnectHandler);
    };

    // Listen for the connection to be established
    socketAPI.on('connect', onConnectHandler);
  });
}

if (closeStreamBtn) {
    closeStreamBtn.addEventListener('click', () => {
        if (webrtcModal) webrtcModal.classList.add('hidden');
        socketAPI.emit('STOP_LIVE_VIEW', { roomCode: adminRoomCode });
        streamer.cleanup();
    });
}

if (closeLogsBtn) {
    closeLogsBtn.addEventListener('click', () => {
        if (flagLogsModal) flagLogsModal.classList.add('hidden');
    });
}

// --- Initialization ---
document.addEventListener('DOMContentLoaded', () => {
  updateConnectionStatus(socketAPI.isConnected());
  setupSocketEventHandlers();
  showCard(roleSelectionCard);
});
