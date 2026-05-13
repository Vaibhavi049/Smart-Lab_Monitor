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
    if (currentRole !== 'admin') return;
    const { roomCode, students, message } = payload || {};
    if (roomCode === adminRoomCode) { 
      if (message) addGlobalLog(message);
      adminStudents = students || []; 
      renderAdminStudents(); 
    }
  });

  socketAPI.on('STUDENT_FLAGGED', (payload) => {
    if (currentRole !== 'admin') return;
    const { studentId, message } = payload;
    addGlobalLog(`FLAG: ${message}`, 'flagged');
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

  // ─── Red Flag Alert (Student-side notification) ──────────────────
  socketAPI.on('FLAGGED_ALERT', (payload) => {
    if (currentRole !== 'student') return;
    showRedFlagAlert(payload);
  });
}

// ─── Red Flag Alert UI ────────────────────────────────────────────
function showRedFlagAlert(payload) {
  // Inject keyframe styles once
  if (!document.getElementById('smartlab-alert-style')) {
    const style = document.createElement('style');
    style.id = 'smartlab-alert-style';
    style.textContent = `
      @keyframes sl-slide-in {
        from { opacity: 0; transform: translateY(-30px) scale(0.95); }
        to   { opacity: 1; transform: translateY(0)    scale(1);    }
      }
      @keyframes sl-slide-out {
        from { opacity: 1; transform: translateY(0)    scale(1);    }
        to   { opacity: 0; transform: translateY(-30px) scale(0.95); }
      }
      @keyframes sl-countdown {
        from { width: 100%; }
        to   { width: 0%;   }
      }
      .sl-flag-alert {
        position: fixed;
        top: 24px;
        left: 50%;
        transform: translateX(-50%);
        z-index: 999999;
        min-width: 340px;
        max-width: 480px;
        background: linear-gradient(135deg, #1a0000 0%, #3d0000 60%, #5c1a00 100%);
        border: 1.5px solid rgba(255, 80, 60, 0.55);
        border-radius: 16px;
        box-shadow: 0 8px 40px rgba(220, 38, 38, 0.45), 0 2px 8px rgba(0,0,0,0.5);
        padding: 20px 22px 16px 22px;
        color: #fff;
        font-family: 'Inter', 'Segoe UI', sans-serif;
        animation: sl-slide-in 0.35s cubic-bezier(.22,1,.36,1) forwards;
      }
      .sl-flag-alert.dismissing {
        animation: sl-slide-out 0.3s ease forwards;
      }
      .sl-flag-header {
        display: flex;
        align-items: flex-start;
        gap: 12px;
      }
      .sl-flag-icon {
        font-size: 2rem;
        line-height: 1;
        flex-shrink: 0;
        filter: drop-shadow(0 0 8px rgba(255,120,80,0.8));
      }
      .sl-flag-body { flex: 1; }
      .sl-flag-title {
        font-size: 1rem;
        font-weight: 700;
        color: #ff6b6b;
        letter-spacing: 0.01em;
        margin: 0 0 4px 0;
        text-transform: uppercase;
      }
      .sl-flag-sub {
        font-size: 0.8rem;
        color: rgba(255,255,255,0.75);
        margin: 0 0 6px 0;
        line-height: 1.4;
      }
      .sl-flag-window {
        font-size: 0.78rem;
        color: rgba(255, 160, 120, 0.9);
        background: rgba(255,255,255,0.07);
        border-radius: 6px;
        padding: 5px 9px;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
        margin-top: 4px;
        font-family: monospace;
      }
      .sl-flag-close {
        background: rgba(255,255,255,0.12);
        border: none;
        color: #fff;
        cursor: pointer;
        border-radius: 50%;
        width: 26px;
        height: 26px;
        font-size: 1rem;
        line-height: 26px;
        text-align: center;
        flex-shrink: 0;
        transition: background 0.2s;
      }
      .sl-flag-close:hover { background: rgba(255,80,60,0.45); }
      .sl-flag-bar-wrap {
        margin-top: 14px;
        height: 3px;
        background: rgba(255,255,255,0.1);
        border-radius: 2px;
        overflow: hidden;
      }
      .sl-flag-bar {
        height: 100%;
        background: linear-gradient(90deg, #ff4444, #ff9900);
        border-radius: 2px;
        animation: sl-countdown 6s linear forwards;
      }
    `;
    document.head.appendChild(style);
  }

  // Throttle: don't stack more than 1 alert at a time
  const existing = document.querySelector('.sl-flag-alert');
  if (existing) existing.remove();

  const alertEl = document.createElement('div');
  alertEl.className = 'sl-flag-alert';
  alertEl.innerHTML = `
    <div class="sl-flag-header">
      <span class="sl-flag-icon">⛔</span>
      <div class="sl-flag-body">
        <p class="sl-flag-title">Unauthorized Activity Detected!</p>
        <p class="sl-flag-sub">You have been flagged by your instructor. Immediately switch to the allowed application.</p>
        ${payload && payload.windowTitle ? `<div class="sl-flag-window">🪟 ${payload.windowTitle}</div>` : ''}
      </div>
      <button class="sl-flag-close" id="sl-alert-close-btn" title="Dismiss">✕</button>
    </div>
    <div class="sl-flag-bar-wrap"><div class="sl-flag-bar"></div></div>
  `;

  document.body.appendChild(alertEl);

  function dismiss() {
    alertEl.classList.add('dismissing');
    setTimeout(() => alertEl.remove(), 300);
  }

  const closeBtn = alertEl.querySelector('#sl-alert-close-btn');
  if (closeBtn) closeBtn.addEventListener('click', dismiss);

  // Auto-dismiss after 6 seconds
  setTimeout(dismiss, 6000);
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
  // Remove copy button on reset
  const existing = document.getElementById('sl-copy-invite-btn');
  if (existing) existing.remove();
}

// ─── Copy Invite Button ───────────────────────────────────────────
function showCopyInviteBtn() {
  // Inject style once
  if (!document.getElementById('sl-copy-btn-style')) {
    const style = document.createElement('style');
    style.id = 'sl-copy-btn-style';
    style.textContent = `
      #sl-copy-invite-btn {
        display: inline-flex;
        align-items: center;
        gap: 7px;
        background: linear-gradient(135deg, #1d4ed8, #2563eb);
        color: #fff;
        border: none;
        border-radius: 8px;
        padding: 7px 14px;
        font-size: 0.78rem;
        font-weight: 600;
        cursor: pointer;
        letter-spacing: 0.02em;
        transition: background 0.2s, transform 0.15s, box-shadow 0.2s;
        box-shadow: 0 2px 8px rgba(37,99,235,0.25);
        margin-top: 6px;
        white-space: nowrap;
      }
      #sl-copy-invite-btn:hover {
        background: linear-gradient(135deg, #1e40af, #1d4ed8);
        box-shadow: 0 4px 16px rgba(37,99,235,0.4);
        transform: translateY(-1px);
      }
      #sl-copy-invite-btn:active { transform: scale(0.97); }
      #sl-copy-invite-btn.copied {
        background: linear-gradient(135deg, #15803d, #16a34a);
        box-shadow: 0 4px 16px rgba(22,163,74,0.35);
      }
      .sl-copy-icon { width: 14px; height: 14px; flex-shrink: 0; }
    `;
    document.head.appendChild(style);
  }

  // Don't add twice
  if (document.getElementById('sl-copy-invite-btn')) return;

  const btn = document.createElement('button');
  btn.id = 'sl-copy-invite-btn';
  btn.title = 'Copy student connection details to clipboard';
  btn.innerHTML = `
    <svg class="sl-copy-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
      <rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
    </svg>
    Copy Invite
  `;

  btn.addEventListener('click', () => {
    const roomCode  = (adminRoomCodeEl  ? adminRoomCodeEl.textContent  : '—').trim();
    const serverIP  = ($('admin-server-ip') ? $('admin-server-ip').textContent : '0.0.0.0').trim();
    const subject   = activeSubject || '—';

    const text =
      `📋 SmartLab Session Invite\n` +
      `──────────────────────────\n` +
      `🔑 Room Code : ${roomCode}\n` +
      `🌐 Server IP : ${serverIP}\n` +
      `📚 Subject   : ${subject}\n` +
      `──────────────────────────\n` +
      `Open SmartLab → Login as Student → Enter the above Room Code & Server IP to join.`;

    navigator.clipboard.writeText(text).then(() => {
      btn.classList.add('copied');
      btn.innerHTML = `
        <svg class="sl-copy-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
          <polyline points="20 6 9 17 4 12"/>
        </svg>
        Copied!
      `;
      setTimeout(() => {
        btn.classList.remove('copied');
        btn.innerHTML = `
          <svg class="sl-copy-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
            <rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
          </svg>
          Copy Invite
        `;
      }, 2200);
    }).catch(() => {
      alert(`Copy manually:\n\nRoom Code: ${roomCode}\nServer IP: ${serverIP}\nSubject: ${subject}`);
    });
  });

  // Attach next to the Room Code stat tile
  const roomCodeTile = adminRoomCodeEl ? adminRoomCodeEl.closest('.stat-tile') : null;
  if (roomCodeTile) {
    roomCodeTile.appendChild(btn);
  } else {
    // Fallback: append to stat-grid
    const statGrid = document.querySelector('.stat-grid');
    if (statGrid) statGrid.appendChild(btn);
  }
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
      if (res && res.success) { adminRoomCode = res.session.roomCode; if (adminRoomCodeEl) adminRoomCodeEl.textContent = adminRoomCode; setAdminMonitoringStatus('stopped'); document.querySelectorAll('input[name="subject"]').forEach(r => r.disabled = true); startSessionBtn.disabled = true; if (startMonitoringBtn) startMonitoringBtn.disabled = false; if (endSessionBtn) endSessionBtn.disabled = false;
        showCopyInviteBtn();
      }
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
