// SmartLab Web Client - Socket.IO based
const socket = io();
const $ = (id) => document.getElementById(id);

// Card elements
const roleSelectionCard = $('role-selection');
const adminLoginCard = $('admin-login');
const adminDashboardCard = $('admin-dashboard');
const studentJoinCard = $('student-join');
const studentDashboardCard = $('student-dashboard');
const studentSessionCard = $('student-session');

// Connection indicator
const connectionDot = $('connection-dot');
const connectionText = $('connection-text');

// Button references
const adminBtn = $('admin-btn');
const studentBtn = $('student-btn');
const adminLoginBtn = $('admin-login-btn');
const studentLoginBtn = $('student-login-btn');
const startSessionBtn = $('start-session-btn');
const startMonitoringBtn = $('start-monitoring-btn');
const stopMonitoringBtn = $('stop-monitoring-btn');
const endSessionBtn = $('end-session-btn');
const joinSessionBtn = $('join-session-btn');

// Display elements
const adminRoomCodeEl = $('admin-room-code');
const adminSubjectDisplayEl = $('admin-subject-display');
const adminMonitoringStatusEl = $('admin-monitoring-status');
const adminStudentCountEl = $('admin-student-count');
const studentsGrid = $('students-grid');
const studentRoomCodeInput = $('student-room-code');
const studentJoinError = $('student-join-error');

// State
let currentUser = null;
let currentRole = null;
let adminRoomCode = null;
let adminMonitoringStatus = 'stopped';
let adminStudents = [];
let activeSubject = null;
let studentSession = {
  roomCode: null,
  name: null,
  studentId: null,
  monitoringStatus: 'stopped'
};

let peerConnection = null;
let remoteCandidateQueue = [];
const rtcConfig = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
    { urls: 'stun:stun2.l.google.com:19302' }
  ]
};

const webrtcModal = $('webrtc-modal');
const remoteVideo = $('remoteVideo');
const closeStreamBtn = $('close-stream-btn');

function requestStudentStream(studentSocketId) {
  console.log('[VIEW SCREEN] Requesting stream from student:', studentSocketId);
  if (peerConnection) {
    peerConnection.close();
    peerConnection = null;
  }
  if (remoteVideo && remoteVideo.srcObject) {
    remoteVideo.srcObject.getTracks().forEach(t => t.stop());
    remoteVideo.srcObject = null;
  }
  if (webrtcModal) webrtcModal.classList.remove('hidden');
  socket.emit('REQUEST_STREAM', { targetSocketId: studentSocketId, adminSocketId: socket.id });
}

if (closeStreamBtn) {
  closeStreamBtn.addEventListener('click', () => {
    if (webrtcModal) webrtcModal.classList.add('hidden');
    if (peerConnection) peerConnection.close();
    peerConnection = null;
    if (remoteVideo && remoteVideo.srcObject) {
      remoteVideo.srcObject.getTracks().forEach(t => t.stop());
    }
    if (remoteVideo) remoteVideo.srcObject = null;
  });
}

const flagsModal = $('flags-modal');
const closeFlagsBtn = $('close-flags-btn');
const flagsTableContainer = $('flags-table-container');

if (closeFlagsBtn) {
  closeFlagsBtn.addEventListener('click', () => {
    if (flagsModal) flagsModal.classList.add('hidden');
  });
}

function showFlagsModal(student) {
  if (!flagsModal || !flagsTableContainer) return;

  const logs = student.flagLogs || [];
  if (logs.length === 0) {
    flagsTableContainer.innerHTML = '<p style="text-align: center; color: #666; padding: 20px;">No flags recorded for this student.</p>';
  } else {
    let html = `
      <table style="width: 100%; border-collapse: collapse; text-align: left; font-size: 0.9rem;">
        <thead>
          <tr style="border-bottom: 2px solid rgba(0,0,0,0.1); background: rgba(0,0,0,0.02);">
            <th style="padding: 12px; font-weight: 600; color: #333;">Time</th>
            <th style="padding: 12px; font-weight: 600; color: #333;">Window Title</th>
            <th style="padding: 12px; font-weight: 600; color: #333;">Process Name</th>
          </tr>
        </thead>
        <tbody>
    `;
    logs.forEach(log => {
      const date = new Date(log.timestamp);
      const timeString = date.toLocaleTimeString();
      html += `
        <tr style="border-bottom: 1px solid rgba(0,0,0,0.05);">
          <td style="padding: 12px; color: #555;">${timeString}</td>
          <td style="padding: 12px; color: #d32f2f; font-weight: 500; word-break: break-all;">${log.windowTitle || 'Unknown'}</td>
          <td style="padding: 12px; color: #555; font-family: monospace;">${log.processName || 'Unknown'}</td>
        </tr>
      `;
    });
    html += `</tbody></table>`;
    flagsTableContainer.innerHTML = html;
  }

  flagsModal.classList.remove('hidden');
}

// ─── Red Flag Alert (Student-side notification) ───────────────────
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

  const alert = document.createElement('div');
  alert.className = 'sl-flag-alert';
  alert.innerHTML = `
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

  document.body.appendChild(alert);

  function dismiss() {
    alert.classList.add('dismissing');
    setTimeout(() => alert.remove(), 300);
  }

  const closeBtn = alert.querySelector('#sl-alert-close-btn');
  if (closeBtn) closeBtn.addEventListener('click', dismiss);

  // Auto-dismiss after 6 seconds
  setTimeout(dismiss, 6000);
}

socket.on('FLAGGED_ALERT', (payload) => {
  if (currentRole !== 'student') return;
  showRedFlagAlert(payload);
});

// ─── Copy Invite Button (Admin Web Client) ────────────────────────
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
        padding: 6px 13px;
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
    const roomCode = (adminRoomCodeEl ? adminRoomCodeEl.textContent : '—').trim();
    const subject  = activeSubject || '—';
    const serverUrl = window.location.origin;

    const text =
      `📋 SmartLab Session Invite\n` +
      `──────────────────────────\n` +
      `🔑 Room Code : ${roomCode}\n` +
      `📚 Subject   : ${subject}\n` +
      `🌐 Server URL: ${serverUrl}\n` +
      `──────────────────────────\n` +
      `Open SmartLab → Login as Student → Enter the above Room Code to join.`;

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
      alert(`Copy manually:\n\nRoom Code: ${roomCode}\nSubject: ${subject}\nServer: ${serverUrl}`);
    });
  });

  // Attach inside the Room Code info-pill
  const roomCodePill = adminRoomCodeEl ? adminRoomCodeEl.closest('.info-pill') : null;
  if (roomCodePill) {
    roomCodePill.appendChild(btn);
  } else {
    const infoRow = document.querySelector('.admin-info-row');
    if (infoRow) infoRow.appendChild(btn);
  }
}

// ─── Helpers ────────────────────────────────────────────────────────
function showCard(card) {
  const all = [
    roleSelectionCard, adminLoginCard, adminDashboardCard,
    studentJoinCard, studentDashboardCard, studentSessionCard
  ];
  all.forEach((c) => {
    if (!c) return;
    if (c === card) {
      c.classList.remove('hidden');
      c.classList.add('active');
    } else {
      c.classList.remove('active');
      c.classList.add('hidden');
    }
  });
}

function updateConnectionStatus(connected) {
  if (connectionDot) {
    if (connected) {
      connectionDot.classList.add('connected');
    } else {
      connectionDot.classList.remove('connected');
    }
  }
  if (connectionText) {
    connectionText.textContent = connected ? 'Connected' : 'Disconnected';
  }
  
  // Disable join button if not connected
  if (joinSessionBtn) {
    joinSessionBtn.disabled = !connected;
    joinSessionBtn.title = connected ? '' : 'Waiting for connection to server...';
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
  const el = $('student-monitoring-status');
  if (el) {
    el.textContent = status === 'active' ? 'Active' : 'Stopped';
    el.classList.remove('active', 'stopped');
    el.classList.add(status);
  }
  const msgEl = $('student-status-message');
  if (msgEl) {
    msgEl.textContent = status === 'active' ? 'Monitoring is active.' : 'Waiting for monitoring to start...';
  }
}

function renderAdminStudents() {
  if (!studentsGrid) return;
  studentsGrid.innerHTML = '';
  if (adminStudentCountEl) adminStudentCountEl.textContent = adminStudents.length.toString();

  const subtitle = $('students-subtitle');
  if (adminStudents.length === 0) {
    if (subtitle) subtitle.textContent = 'Waiting for students to join...';
    return;
  }

  if (subtitle) subtitle.textContent = `Live list of connected students (Subject: ${activeSubject || 'N/A'})`;

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

    // Show activity details
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

    // Flag card if student is violating
    if (student.flagged && adminMonitoringStatus === 'active') {
      card.classList.add('flagged');
    }

    const btnContainer = document.createElement('div');
    btnContainer.style.display = 'flex';
    btnContainer.style.gap = '8px';
    btnContainer.style.marginTop = '12px';

    const streamBtn = document.createElement('button');
    streamBtn.className = 'primary-btn small';
    streamBtn.textContent = 'View Screen';
    streamBtn.onclick = () => requestStudentStream(student.socketId);

    const flagsBtn = document.createElement('button');
    flagsBtn.className = 'secondary-btn small';
    flagsBtn.textContent = 'View Flags';
    flagsBtn.onclick = () => showFlagsModal(student);

    btnContainer.appendChild(streamBtn);
    btnContainer.appendChild(flagsBtn);
    card.appendChild(btnContainer);

    card.appendChild(orb);
    studentsGrid.appendChild(card);
  });
}

function resetAdminState() {
  adminRoomCode = null;
  adminMonitoringStatus = 'stopped';
  adminStudents = [];
  activeSubject = null;

  if (adminRoomCodeEl) adminRoomCodeEl.textContent = '—';
  if (adminSubjectDisplayEl) adminSubjectDisplayEl.textContent = '—';
  setAdminMonitoringStatus('stopped');
  if (adminStudentCountEl) adminStudentCountEl.textContent = '0';
  if (studentsGrid) studentsGrid.innerHTML = '';
  // Remove copy button on reset
  const existingCopyBtn = document.getElementById('sl-copy-invite-btn');
  if (existingCopyBtn) existingCopyBtn.remove();

  const subtitle = $('students-subtitle');
  if (subtitle) subtitle.textContent = 'Waiting for students to join...';

  // Re-enable subject selection
  document.querySelectorAll('input[name="subject"]').forEach(radio => {
    radio.disabled = false;
    radio.checked = false;
  });

  if (startSessionBtn) startSessionBtn.disabled = true;
  if (startMonitoringBtn) startMonitoringBtn.disabled = true;
  if (stopMonitoringBtn) stopMonitoringBtn.disabled = true;
  if (endSessionBtn) endSessionBtn.disabled = true;
}

function resetStudentState() {
  studentSession = { roomCode: null, name: null, studentId: null, monitoringStatus: 'stopped' };
  if (studentRoomCodeInput) studentRoomCodeInput.value = '';
  if (studentJoinError) {
    studentJoinError.textContent = '';
    studentJoinError.classList.add('hidden');
  }
  const roomEl = $('student-session-room-code');
  if (roomEl) roomEl.textContent = '—';
  const nameEl = $('student-display-name');
  if (nameEl) nameEl.textContent = '—';
  setStudentMonitoringStatus('stopped');
}

// ─── Socket Events ──────────────────────────────────────────────────
socket.on('connect', () => {
  updateConnectionStatus(true);
  
  // Auto-rejoin logic for students
  if (currentRole === 'student' && studentSession.roomCode && studentSession.name) {
    console.log('[AUTO-REJOIN] Attempting to restore session:', studentSession.roomCode);
    socket.emit('JOIN_SESSION', { 
      roomCode: studentSession.roomCode, 
      name: studentSession.name 
    }, (response) => {
      if (response && response.success) {
        console.log('[AUTO-REJOIN] Successfully restored session.');
      } else {
        console.warn('[AUTO-REJOIN] Failed to restore session:', response?.error);
      }
    });
  }
});

socket.on('disconnect', () => updateConnectionStatus(false));

socket.on('SESSION_ENDED', (payload) => {
  const { roomCode } = payload || {};
  if (currentRole === 'admin' && roomCode === adminRoomCode) {
    alert('Session ended.');
    resetAdminState();
    showCard(roleSelectionCard);
    currentRole = null;
  } else if (currentRole === 'student' && roomCode === studentSession.roomCode) {
    alert('Session ended by admin.');
    resetStudentState();
    showCard(roleSelectionCard);
    currentRole = null;
  }
});

socket.on('STUDENT_JOINED', (payload) => {
  if (currentRole !== 'admin') return;
  const { roomCode, student } = payload || {};
  if (!roomCode || roomCode !== adminRoomCode || !student) return;
  const exists = adminStudents.some((s) => s.studentId === student.studentId);
  if (!exists) {
    adminStudents.push(student);
    renderAdminStudents();
  }
});

socket.on('STUDENT_LIST_UPDATED', (payload) => {
  if (currentRole !== 'admin') return;
  const { roomCode, students } = payload || {};
  if (!roomCode || roomCode !== adminRoomCode) return;
  adminStudents = students || [];
  renderAdminStudents();
});

socket.on('MONITORING_STARTED', (payload) => {
  const { roomCode, monitoringStatus } = payload || {};
  if (currentRole === 'admin' && roomCode === adminRoomCode) {
    setAdminMonitoringStatus(monitoringStatus || 'active');
  }
  if (currentRole === 'student' && roomCode === studentSession.roomCode) {
    setStudentMonitoringStatus(monitoringStatus || 'active');
  }
});

socket.on('MONITORING_STOPPED', (payload) => {
  const { roomCode, monitoringStatus } = payload || {};
  if (currentRole === 'admin' && roomCode === adminRoomCode) {
    setAdminMonitoringStatus(monitoringStatus || 'stopped');
  }
  if (currentRole === 'student' && roomCode === studentSession.roomCode) {
    setStudentMonitoringStatus(monitoringStatus || 'stopped');
  }
});

// WebRTC Signaling
socket.on('WEBRTC_OFFER', async (payload) => {
  if (currentRole !== 'admin') return;
  const { offer, studentSocketId } = payload || {};
  console.log('[ADMIN WEBRTC] Received offer from student:', studentSocketId);

  if (peerConnection) {
    peerConnection.close();
    peerConnection = null;
  }
  
  remoteCandidateQueue = [];
  peerConnection = new RTCPeerConnection(rtcConfig);

  peerConnection.onicecandidate = (event) => {
    if (event.candidate) {
      console.log('[ADMIN WEBRTC] Sending ICE candidate to student');
      socket.emit('WEBRTC_ICE_CANDIDATE', { targetSocketId: studentSocketId, candidate: event.candidate });
    }
  };

  peerConnection.ontrack = (event) => {
    console.log('[ADMIN WEBRTC] ontrack fired');
    if (remoteVideo) {
      if (event.streams && event.streams[0]) {
        remoteVideo.srcObject = event.streams[0];
      } else {
        remoteVideo.srcObject = new MediaStream([event.track]);
      }
      remoteVideo.muted = true;
      remoteVideo.play()
        .then(() => { remoteVideo.muted = false; })
        .catch(e => console.error('[ADMIN WEBRTC] Video play error:', e));
    }
  };

  try {
    await peerConnection.setRemoteDescription(new RTCSessionDescription(offer));
    const answer = await peerConnection.createAnswer();
    await peerConnection.setLocalDescription(answer);
    console.log('[ADMIN WEBRTC] Sending answer to student');
    socket.emit('WEBRTC_ANSWER', { targetSocketId: studentSocketId, answer });

    while (remoteCandidateQueue.length > 0) {
      const cand = remoteCandidateQueue.shift();
      await peerConnection.addIceCandidate(new RTCIceCandidate(cand));
    }
  } catch (err) {
    console.error('[ADMIN WEBRTC] Error handling offer:', err);
  }
});

socket.on('WEBRTC_ICE_CANDIDATE', async (payload) => {
  const { candidate } = payload || {};
  if (!candidate) return;

  if (peerConnection && peerConnection.remoteDescription && peerConnection.remoteDescription.type) {
    try {
      await peerConnection.addIceCandidate(new RTCIceCandidate(candidate));
    } catch (err) {
      console.error('[WEBRTC] Error adding ICE candidate:', err);
    }
  } else {
    remoteCandidateQueue.push(candidate);
  }
});

// ─── Admin Flow ─────────────────────────────────────────────────────
if (adminBtn) {
  adminBtn.addEventListener('click', () => {
    currentRole = 'admin';
    showCard(adminLoginCard);
  });
}

const adminLoginBackBtn = $('admin-login-back-btn');
if (adminLoginBackBtn) {
  adminLoginBackBtn.addEventListener('click', () => {
    currentRole = null;
    showCard(roleSelectionCard);
  });
}

if (adminLoginBtn) {
  adminLoginBtn.addEventListener('click', () => {
    window.location.href = '/auth/google?role=admin';
  });
}

const adminBackBtn = $('admin-back-btn');
if (adminBackBtn) {
  adminBackBtn.addEventListener('click', () => {
    if (adminRoomCode) {
      const confirmLeave = confirm('Leaving will end the current session for all students. Continue?');
      if (!confirmLeave) return;
      socket.emit('END_SESSION', { roomCode: adminRoomCode }, () => {
        resetAdminState();
        currentRole = null;
        showCard(roleSelectionCard);
      });
    } else {
      resetAdminState();
      currentRole = null;
      showCard(roleSelectionCard);
    }
  });
}

// Subject radio enables session start
document.querySelectorAll('input[name="subject"]').forEach(radio => {
  radio.addEventListener('change', () => {
    if (!adminRoomCode && startSessionBtn) {
      startSessionBtn.disabled = false;
    }
  });
});

if (startSessionBtn) {
  startSessionBtn.addEventListener('click', () => {
    const selectedRadio = document.querySelector('input[name="subject"]:checked');
    if (!selectedRadio) {
      alert('Please select a subject (ML or DBMS) before starting the session.');
      return;
    }

    socket.emit('CREATE_SESSION', { subject: selectedRadio.value }, (response) => {
      if (!response || !response.success) {
        alert(response?.error || 'Failed to create session.');
        return;
      }
      const { session } = response;
      activeSubject = selectedRadio.value;
      adminRoomCode = session.roomCode;
      if (adminRoomCodeEl) adminRoomCodeEl.textContent = adminRoomCode;
      if (adminSubjectDisplayEl) adminSubjectDisplayEl.textContent = session.subject || activeSubject;
      showCopyInviteBtn();

      setAdminMonitoringStatus(session.monitoringStatus || 'stopped');
      adminStudents = session.students || [];
      renderAdminStudents();

      // Lock subject selection
      document.querySelectorAll('input[name="subject"]').forEach(r => r.disabled = true);

      if (startSessionBtn) startSessionBtn.disabled = true;
      if (startMonitoringBtn) startMonitoringBtn.disabled = false;
      if (stopMonitoringBtn) stopMonitoringBtn.disabled = true;
      if (endSessionBtn) endSessionBtn.disabled = false;
    });
  });
}

if (startMonitoringBtn) {
  startMonitoringBtn.addEventListener('click', () => {
    if (!adminRoomCode) return;
    socket.emit('START_MONITORING', { roomCode: adminRoomCode }, (response) => {
      if (!response || !response.success) {
        alert(response?.error || 'Could not start monitoring.');
      }
    });
  });
}

if (stopMonitoringBtn) {
  stopMonitoringBtn.addEventListener('click', () => {
    if (!adminRoomCode) return;
    socket.emit('STOP_MONITORING', { roomCode: adminRoomCode }, (response) => {
      if (!response || !response.success) {
        alert(response?.error || 'Could not stop monitoring.');
      }
    });
  });
}

if (endSessionBtn) {
  endSessionBtn.addEventListener('click', () => {
    if (!adminRoomCode) return;
    const confirmEnd = confirm('End session for all students? This cannot be undone.');
    if (!confirmEnd) return;
    socket.emit('END_SESSION', { roomCode: adminRoomCode }, (response) => {
      if (!response || !response.success) {
        alert(response?.error || 'Failed to end session.');
        return;
      }
      resetAdminState();
      currentRole = null;
      showCard(roleSelectionCard);
    });
  });
}

// ─── Student Flow ───────────────────────────────────────────────────
if (studentBtn) {
  studentBtn.addEventListener('click', () => {
    currentRole = 'student';
    showCard(studentJoinCard);
  });
}

const studentBackBtn = $('student-back-btn');
if (studentBackBtn) {
  studentBackBtn.addEventListener('click', () => {
    resetStudentState();
    currentRole = null;
    showCard(roleSelectionCard);
  });
}

const studentDashboardBackBtn = $('student-dashboard-back-btn');
if (studentDashboardBackBtn) {
  studentDashboardBackBtn.addEventListener('click', () => {
    resetStudentState();
    currentRole = null;
    showCard(roleSelectionCard);
  });
}

if (studentLoginBtn) {
  studentLoginBtn.addEventListener('click', () => {
    window.location.href = '/auth/google?role=student';
  });
}

if (joinSessionBtn) {
  joinSessionBtn.addEventListener('click', () => {
    const roomCode = (studentRoomCodeInput.value || '').toUpperCase().trim();
    const defaultName = `Student-${Math.floor(1000 + Math.random() * 9000)}`;
    const name = currentUser ? currentUser.name : defaultName;

    if (!roomCode || roomCode.length !== 6) {
      if (studentJoinError) {
        studentJoinError.textContent = 'Please enter a valid 6-character room code.';
        studentJoinError.classList.remove('hidden');
      }
      return;
    }

    if (studentJoinError) studentJoinError.classList.add('hidden');

    socket.emit('JOIN_SESSION', { roomCode, name }, (response) => {
      if (!response || !response.success) {
        if (studentJoinError) {
          studentJoinError.textContent = response?.error || 'Failed to join session.';
          studentJoinError.classList.remove('hidden');
        }
        return;
      }

      const { session, student } = response;
      studentSession.roomCode = session.roomCode;
      studentSession.name = student?.name || name;
      studentSession.studentId = student?.studentId || null;
      setStudentMonitoringStatus(session.monitoringStatus || 'stopped');

      const roomEl = $('student-session-room-code');
      if (roomEl) roomEl.textContent = studentSession.roomCode;
      const nameEl = $('student-display-name');
      if (nameEl) nameEl.textContent = studentSession.name;
      const subEl = $('student-session-subtitle');
      if (subEl) subEl.textContent = 'You are connected to the session.';

      showCard(studentSessionCard);
    });
  });
}

const studentLeaveBtn = $('student-leave-btn');
if (studentLeaveBtn) {
  studentLeaveBtn.addEventListener('click', () => {
    const confirmed = confirm('Leave this session?');
    if (!confirmed) return;
    resetStudentState();
    currentRole = null;
    showCard(roleSelectionCard);
  });
}

// ─── Initialization ─────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', async () => {
  updateConnectionStatus(socket.connected);

  // Check for auth errors in URL
  const urlParams = new URLSearchParams(window.location.search);
  if (urlParams.get('error') === 'domain') {
    alert('Only @rknec.edu email accounts are allowed.');
  }

  // Fetch current user from server session
  try {
    const res = await fetch('/api/user');
    if (res.ok) {
      currentUser = await res.json();
    }
  } catch (err) {
    console.error('Failed to fetch user', err);
  }

  // Route based on pathname (after Google OAuth redirect)
  if (window.location.pathname === '/admin-dashboard') {
    currentRole = 'admin';
    const greetingEl = $('admin-greeting');
    if (currentUser && greetingEl) {
      greetingEl.textContent = `Hello ${currentUser.name}`;
    }
    showCard(adminDashboardCard);
  } else if (window.location.pathname === '/student-dashboard') {
    currentRole = 'student';
    const greetingEl = $('student-greeting');
    if (currentUser && greetingEl) {
      greetingEl.textContent = `Hello ${currentUser.name}`;
    }
    showCard(studentDashboardCard);
  } else {
    showCard(roleSelectionCard);
  }
});
