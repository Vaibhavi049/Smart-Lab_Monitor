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

const globalActivityLog = $('global-activity-log');
const flagSummaryPanel = $('flag-summary-panel');
const flagSummaryText = $('flag-summary-text');
const adminActiveFlagsEl = $('admin-active-flags');

// Student flag notification elements
const flagToastContainer = $('flag-toast-container');
const studentFlagBanner = $('student-flag-banner');
const studentFlagBannerReason = $('student-flag-banner-reason');
const studentViolationsPanel = $('student-violations-panel');
const studentViolationsList = $('student-violations-list');
const studentViolationCount = $('student-violation-count');
let studentFlagLogs = [];

// Admin Subject elements
const subjectRadioGroup = $('subject-radio-group');
const addSubjectBtn = $('add-subject-btn');
const addSubjectModal = $('add-subject-modal');
const closeSubjectModalBtn = $('close-subject-modal-btn');
const cancelSubjectBtn = $('cancel-subject-btn');
const submitSubjectBtn = $('submit-subject-btn');
const newSubjectName = $('new-subject-name');
const newSubjectKeywords = $('new-subject-keywords');

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

function addGlobalLog(message, type = 'info') {
  if (!globalActivityLog) return;
  const time = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  const entry = document.createElement('div');
  entry.className = `log-entry ${type}`;
  entry.innerHTML = `
    <span class="log-time">${time}</span>
    <span class="log-msg">${message}</span>
  `;
  globalActivityLog.prepend(entry);
}

function updateFlagSummary() {
  if (!flagSummaryPanel || !flagSummaryText || !adminActiveFlagsEl) return;
  const flagged = adminStudents.filter(s => s.flagged);
  adminActiveFlagsEl.textContent = flagged.length.toString();
  
  if (flagged.length > 0) {
    flagSummaryPanel.classList.remove('hidden');
    const names = flagged.map(s => s.name).join(', ');
    flagSummaryText.innerHTML = `${flagged.length} student(s) have triggered alerts: <strong>${names}</strong>`;
  } else {
    flagSummaryPanel.classList.add('hidden');
  }
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
  updateFlagSummary();

  if (adminStudents.length === 0) {
    if (studentsSubtitle) studentsSubtitle.textContent = 'Waiting for students to join...';
    return;
  }
  if (studentsSubtitle) studentsSubtitle.textContent = `Live list of connected students (Subject: ${activeSubject || 'None'})`;
  
  adminStudents.forEach((student) => {
    const card = document.createElement('div');
    card.className = 'student-card';
    if (student.flagged && adminMonitoringStatus === 'active') card.classList.add('violating-status');

    // Top: Avatar + Name + Badge
    const top = document.createElement('div');
    top.className = 'student-top';
    
    const initials = student.name.split(' ').map(n => n[0]).join('').toUpperCase();
    const avatar = document.createElement('div');
    avatar.className = 'avatar';
    avatar.textContent = initials;
    
    const meta = document.createElement('div');
    meta.className = 'student-meta';
    const nameEl = document.createElement('div');
    nameEl.className = 'student-name';
    nameEl.textContent = student.name;
    const idEl = document.createElement('div');
    idEl.className = 'student-id';
    idEl.textContent = student.studentId;
    meta.appendChild(nameEl);
    meta.appendChild(idEl);

    const badge = document.createElement('span');
    badge.className = 'badge ' + (student.flagged ? 'badge-danger' : 'badge-success');
    badge.textContent = student.flagged ? 'Flagged' : 'Active';

    top.appendChild(avatar);
    top.appendChild(meta);
    top.appendChild(badge);
    card.appendChild(top);
    
    if (student.lastActivity && student.lastActivity.windowTitle) {
      const activityDiv = document.createElement('div');
      activityDiv.style.marginTop = '8px';
      activityDiv.style.fontSize = '0.75rem';
      activityDiv.style.padding = '8px';
      activityDiv.style.background = '#f8fafc';
      activityDiv.style.borderRadius = '6px';
      
      const titleSpan = document.createElement('div');
      titleSpan.textContent = student.lastActivity.windowTitle;
      titleSpan.style.fontWeight = '600';
      titleSpan.style.whiteSpace = 'nowrap';
      titleSpan.style.overflow = 'hidden';
      titleSpan.style.textOverflow = 'ellipsis';
      const procSpan = document.createElement('div');
      procSpan.textContent = student.lastActivity.processName || 'Unknown Process';
      procSpan.style.color = 'var(--text-muted)';
      activityDiv.appendChild(titleSpan);
      activityDiv.appendChild(procSpan);
      card.appendChild(activityDiv);
    }

    const btnContainer = document.createElement('div');
    btnContainer.style.display = 'grid';
    btnContainer.style.gridTemplateColumns = '1fr 1fr';
    btnContainer.style.gap = '8px';

    const streamBtn = document.createElement('button');
    streamBtn.className = 'primary-btn';
    streamBtn.style.padding = '6px';
    streamBtn.textContent = 'View';
    streamBtn.onclick = () => {
       if (webrtcModal) webrtcModal.classList.remove('hidden');
       streamer.startView(student.socketId, remoteVideo, remoteSnapshot);
    };
    
    const logsBtn = document.createElement('button');
    logsBtn.className = 'secondary-btn';
    logsBtn.style.padding = '6px';
    logsBtn.textContent = 'Logs';
    logsBtn.onclick = () => {
       if (flagLogsModal) {
          if (flagLogsStudentName) flagLogsStudentName.textContent = student.name;
          if (flagLogsContainer) {
             flagLogsContainer.innerHTML = '';
             const logs = student.flagLogs || [];
             if (logs.length === 0) {
                flagLogsContainer.innerHTML = '<p style="color: #a1a1aa; font-size: 0.8rem; text-align: center; padding: 20px;">No incidents recorded.</p>';
             } else {
                logs.forEach(log => {
                   const timeString = new Date(log.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                   const logEl = document.createElement('div');
                   logEl.style.padding = '8px 12px';
                   logEl.style.background = '#fff1f2';
                   logEl.style.borderLeft = '3px solid #ef4444';
                   logEl.style.borderRadius = '4px';
                   logEl.style.fontSize = '0.75rem';
                   logEl.textContent = `${timeString} - ${log.windowTitle}`;
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
    const { roomCode, students, message } = payload || {};
    if (currentRole === 'admin' && roomCode === adminRoomCode) { 
      if (message) addGlobalLog(message);
      adminStudents = students || []; 
      renderAdminStudents(); 
    }
    // Student: update own flag status from broadcast
    if (currentRole === 'student' && roomCode === studentSession.roomCode && students) {
      const me = students.find(s => s.name === (currentUser && currentUser.name));
      if (me) {
        // Update the banner based on current flag status
        if (me.flagged) {
          if (studentFlagBanner) studentFlagBanner.classList.remove('hidden');
        } else {
          if (studentFlagBanner) studentFlagBanner.classList.add('hidden');
        }
      }
    }
  });

  socketAPI.on('STUDENT_FLAGGED', (payload) => {
    if (currentRole !== 'admin') return;
    const { studentId, message } = payload;
    addGlobalLog(`FLAG: ${message}`, 'flagged');
  });

  // ───── Student-side: Real-time flag notification ─────
  socketAPI.on('STUDENT_FLAG_ALERT', (payload) => {
    if (currentRole !== 'student') return;
    const { message, windowTitle, processName, timestamp, flagLogs } = payload;
    console.log('[FLAG_ALERT]', message);

    // Update the stored logs
    if (flagLogs) studentFlagLogs = flagLogs;

    // Show the persistent banner with latest reason
    if (studentFlagBanner) studentFlagBanner.classList.remove('hidden');
    if (studentFlagBannerReason) {
      studentFlagBannerReason.textContent = `You opened: "${windowTitle}"`;
    }

    // Show the violations panel and render logs
    renderStudentViolations();

    // Show a toast notification
    showFlagToast(message, windowTitle, timestamp);
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

  // Dynamic Subjects
  socketAPI.on('SUBJECTS_UPDATED', (payload) => {
    if (currentRole === 'admin') {
      renderSubjects(payload.subjects);
    }
  });
}

function renderSubjects(subjects) {
  if (!subjectRadioGroup) return;
  // Preserve currently checked value
  const currentlyChecked = document.querySelector('input[name="subject"]:checked');
  const selectedValue = currentlyChecked ? currentlyChecked.value : null;

  subjectRadioGroup.innerHTML = '';
  
  subjects.forEach(subject => {
    const label = document.createElement('label');
    label.className = 'radio-item';
    
    const input = document.createElement('input');
    input.type = 'radio';
    input.name = 'subject';
    input.value = subject;
    
    // Disable if monitoring is active or session started
    if (adminRoomCode) input.disabled = true;
    
    if (selectedValue === subject) {
      input.checked = true;
    }
    
    // Reattach event listener for enabling "Init Session" button
    input.addEventListener('change', () => {
      if (!adminRoomCode && startSessionBtn) startSessionBtn.disabled = false;
    });

    label.appendChild(input);
    label.appendChild(document.createTextNode(` ${subject}`));
    subjectRadioGroup.appendChild(label);
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
  // Reset flag state
  studentFlagLogs = [];
  if (studentFlagBanner) studentFlagBanner.classList.add('hidden');
  if (studentViolationsPanel) studentViolationsPanel.classList.add('hidden');
  if (studentViolationsList) studentViolationsList.innerHTML = '<p class="violations-empty">No violations recorded yet.</p>';
  if (studentViolationCount) studentViolationCount.textContent = '0';
  if (flagToastContainer) flagToastContainer.innerHTML = '';
}

// --- Student Violation Log Rendering ---
function renderStudentViolations() {
  if (!studentViolationsPanel || !studentViolationsList || !studentViolationCount) return;
  studentViolationsPanel.classList.remove('hidden');
  studentViolationCount.textContent = studentFlagLogs.length.toString();

  if (studentFlagLogs.length === 0) {
    studentViolationsList.innerHTML = '<p class="violations-empty">No violations recorded yet.</p>';
    return;
  }

  studentViolationsList.innerHTML = '';
  // Render newest first
  [...studentFlagLogs].reverse().forEach((log) => {
    const time = new Date(log.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    const entry = document.createElement('div');
    entry.className = 'violation-entry';
    entry.innerHTML = `
      <div class="violation-time">${time}</div>
      <div class="violation-detail">
        <div class="violation-title">${log.windowTitle}</div>
        <div class="violation-process">${log.processName || 'Unknown Process'}</div>
      </div>
    `;
    studentViolationsList.appendChild(entry);
  });
}

// --- Flag Toast Notification ---
function showFlagToast(message, windowTitle, timestamp) {
  if (!flagToastContainer) return;
  const toast = document.createElement('div');
  toast.className = 'flag-toast';
  const time = new Date(timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  toast.innerHTML = `
    <div class="flag-toast-icon">
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"></path>
        <line x1="12" y1="9" x2="12" y2="13"></line>
        <line x1="12" y1="17" x2="12.01" y2="17"></line>
      </svg>
    </div>
    <div class="flag-toast-body">
      <div class="flag-toast-title">Profile Flagged</div>
      <div class="flag-toast-msg">Unauthorized window: "${windowTitle}"</div>
      <div class="flag-toast-time">${time}</div>
    </div>
    <button class="flag-toast-close" onclick="this.parentElement.remove()">&times;</button>
  `;
  flagToastContainer.prepend(toast);
  // Trigger entrance animation
  requestAnimationFrame(() => toast.classList.add('show'));
  // Auto-dismiss after 8 seconds
  setTimeout(() => {
    toast.classList.add('hiding');
    setTimeout(() => toast.remove(), 400);
  }, 8000);
}

// --- Admin Listeners ---
if (adminBtn) {
  adminBtn.addEventListener('click', async () => {
    const card = adminBtn.closest('.role-card');
    if (card) { card.classList.add('clicked'); setTimeout(() => card.classList.remove('clicked'), 400); }
    currentRole = 'admin'; const oldText = adminBtn.textContent; adminBtn.textContent = 'Authenticating...';
    try {
      const authRes = await socketAPI.loginOAuth();
      if (!authRes.success) { alert('Login Failed: ' + authRes.error); return; }
      currentUser = authRes.user;
      const hostRes = await socketAPI.startHostServer();
      if (!hostRes.success) { alert('Server failed: ' + hostRes.error); return; }
      if ($('admin-server-ip')) $('admin-server-ip').textContent = hostRes.ip;
      resetAdminState(); socketAPI.connect(hostRes.ip); showCard(adminDashboardCard);
      
      // Fetch initial subjects
      setTimeout(() => {
        socketAPI.emit('GET_SUBJECTS', {}, (res) => {
          if (res && res.success) renderSubjects(res.subjects);
        });
      }, 500);

    } finally { adminBtn.textContent = oldText; }
  });
}

if (adminBackBtn) {
  adminBackBtn.addEventListener('click', () => {
    if (adminRoomCode && confirm('End session?')) { socketAPI.emit('END_SESSION', { roomCode: adminRoomCode }, () => { resetAdminState(); currentRole = null; showCard(roleSelectionCard); }); } 
    else { resetAdminState(); currentRole = null; showCard(roleSelectionCard); }
  });
}

// Initial binding for hardcoded subjects
document.querySelectorAll('input[name="subject"]').forEach(radio => {
  radio.addEventListener('change', () => { if (!adminRoomCode && startSessionBtn) startSessionBtn.disabled = false; });
});

// --- Dynamic Subject Modal Listeners ---
if (addSubjectBtn) {
  addSubjectBtn.addEventListener('click', () => {
    if (addSubjectModal) {
      newSubjectName.value = '';
      newSubjectKeywords.value = '';
      addSubjectModal.classList.remove('hidden');
    }
  });
}

function closeSubjectModal() {
  if (addSubjectModal) addSubjectModal.classList.add('hidden');
}

if (closeSubjectModalBtn) closeSubjectModalBtn.addEventListener('click', closeSubjectModal);
if (cancelSubjectBtn) cancelSubjectBtn.addEventListener('click', closeSubjectModal);

if (submitSubjectBtn) {
  submitSubjectBtn.addEventListener('click', () => {
    const name = newSubjectName.value.trim();
    const keywordsRaw = newSubjectKeywords.value.trim();
    
    if (!name) {
      alert('Subject Name is required.');
      return;
    }
    if (!keywordsRaw) {
      alert('Allowed Keywords are required.');
      return;
    }

    const keywords = keywordsRaw.split(',').map(k => k.trim()).filter(k => k.length > 0);
    
    submitSubjectBtn.disabled = true;
    socketAPI.emit('ADD_SUBJECT', { subjectName: name, keywords }, (res) => {
      submitSubjectBtn.disabled = false;
      if (res && res.success) {
        closeSubjectModal();
        renderSubjects(res.subjects);
      } else {
        alert('Failed to add subject: ' + (res?.error || 'Unknown error'));
      }
    });
  });
}

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
    const card = studentBtn.closest('.role-card');
    if (card) { card.classList.add('clicked'); setTimeout(() => card.classList.remove('clicked'), 400); }
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

// --- Theme Toggle ---
function initThemeToggle() {
  const toggle = $('theme-toggle');
  const sunIcon = $('theme-icon-sun');
  const moonIcon = $('theme-icon-moon');
  if (!toggle) return;

  // Restore saved preference
  const saved = localStorage.getItem('smartlab-theme');
  if (saved === 'dark') applyDark();

  toggle.addEventListener('click', () => {
    const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
    if (isDark) {
      applyLight();
      localStorage.setItem('smartlab-theme', 'light');
    } else {
      applyDark();
      localStorage.setItem('smartlab-theme', 'dark');
    }
  });

  function applyDark() {
    document.documentElement.setAttribute('data-theme', 'dark');
    if (sunIcon) sunIcon.classList.add('hidden');
    if (moonIcon) moonIcon.classList.remove('hidden');
    if (studentJoinCard) studentJoinCard.style.background = 'var(--bg-card)';
  }

  function applyLight() {
    document.documentElement.removeAttribute('data-theme');
    if (sunIcon) sunIcon.classList.remove('hidden');
    if (moonIcon) moonIcon.classList.add('hidden');
    if (studentJoinCard) studentJoinCard.style.background = '#fff';
  }
}

// --- Initialization ---
document.addEventListener('DOMContentLoaded', () => {
  // Live Clock for Login Page
  setInterval(() => {
    const clockEl = document.getElementById('login-clock');
    if (clockEl) {
      clockEl.textContent = new Date().toLocaleTimeString([], { hour12: false });
    }
  }, 1000);

  // The React splash screen will call this when it completely finishes
  window.onSplashComplete = () => {
    console.log('[Splash] Splash UI complete, main app active.');
  };

  updateConnectionStatus(socketAPI.isConnected());
  setupSocketEventHandlers();
  showCard(roleSelectionCard);
  initThemeToggle();
});
