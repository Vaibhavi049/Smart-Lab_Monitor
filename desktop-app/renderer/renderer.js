// socketAPI is exposed globally via preload.js


const $ = (id) => document.getElementById(id);


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
const closeStreamBtn = $('close-stream-btn');

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
let currentStream = null;
const rtcConfig = { iceServers: [{ urls: 'stun:stun.l.google.com:19302' }] };

function requestStudentStream(studentSocketId) {
  if (peerConnection) peerConnection.close();
  webrtcModal.classList.remove('hidden');
  socketAPI.emit('REQUEST_STREAM', { targetSocketId: studentSocketId, adminSocketId: socketAPI.getId() });
}

if (closeStreamBtn) {
  closeStreamBtn.addEventListener('click', () => {
    webrtcModal.classList.add('hidden');
    if (peerConnection) peerConnection.close();
    peerConnection = null;
    if (remoteVideo.srcObject) {
      remoteVideo.srcObject.getTracks().forEach(t => t.stop());
    }
    remoteVideo.srcObject = null;
  });
}

function showCard(card) {
  const all = [
    roleSelectionCard,
    adminDashboardCard,
    studentJoinCard,
    studentSessionCard
  ];
  all.forEach((c) => {
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
  if (connected) {
    connectionDot.classList.add('connected');
    connectionText.textContent = 'Connected';
  } else {
    connectionDot.classList.remove('connected');
    connectionText.textContent = 'Disconnected';
  }
}

function setAdminMonitoringStatus(status) {
  adminMonitoringStatus = status;
  adminMonitoringStatusEl.textContent =
    status === 'active' ? 'Active' : 'Stopped';

  adminMonitoringStatusEl.classList.remove('active', 'stopped');
  adminMonitoringStatusEl.classList.add(status);

  if (startMonitoringBtn) startMonitoringBtn.disabled = status === 'active';
  if (stopMonitoringBtn) stopMonitoringBtn.disabled = status === 'stopped';
}

function setStudentMonitoringStatus(status) {
  studentSession.monitoringStatus = status;
  studentMonitoringStatusEl.textContent =
    status === 'active' ? 'Active' : 'Stopped';
  studentMonitoringStatusEl.classList.remove('active', 'stopped');
  studentMonitoringStatusEl.classList.add(status);

  if (status === 'active') {
    studentStatusMessageEl.textContent = 'Monitoring is active.';
  } else {
    studentStatusMessageEl.textContent = 'Waiting for monitoring to start...';
  }
}

function evaluateActivity(activity, subject) {
  if (!activity || !activity.windowTitle || activity.windowTitle === 'N/A') return true;
  
  const title = activity.windowTitle.toLowerCase();
  const process = (activity.processName || '').toLowerCase();
  
  // System windows are always OK
  if (title.includes('task manager') || title.includes('program manager') || title.includes('settings') || title.includes('smartlab')) return true;

  const rules = {
    'ML': ['classroom', 'colab', 'explorer', 'file browser', 'code', 'visual studio'],
    'DBMS': ['sql plus', 'sqlplus', 'sqldeveloper', 'oracle', 'classroom', 'gmail']
  };

  const allowedKeywords = rules[subject];
  if (!allowedKeywords) return true; // Fail-safe fallback

  for (const keyword of allowedKeywords) {
    if (title.includes(keyword) || process.includes(keyword)) {
      return true; // Authorized
    }
  }
  return false; // Unauthorized!
}

function renderAdminStudents() {
  studentsGrid.innerHTML = '';
  adminStudentCountEl.textContent = adminStudents.length.toString();

  if (adminStudents.length === 0) {
    studentsSubtitle.textContent = 'Waiting for students to join...';
    return;
  }

  studentsSubtitle.textContent = `Live list of connected students (Subject: ${activeSubject || 'None'})`;

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

    // Render Activity Details
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

    const streamBtn = document.createElement('button');
    streamBtn.className = 'primary-btn small';
    streamBtn.style.marginTop = '12px';
    streamBtn.textContent = 'View Screen';
    streamBtn.onclick = () => requestStudentStream(student.socketId);
    card.appendChild(streamBtn);

    // Use the server's flagged status directly (the server runs the rule engine)
    if (student.flagged && adminMonitoringStatus === 'active') {
      card.classList.add('violating-status');
    }

    card.appendChild(orb);
    studentsGrid.appendChild(card);
  });
}

function resetAdminState() {
  adminRoomCode = null;
  adminMonitoringStatus = 'stopped';
  adminStudents = [];
  activeSubject = null;

  adminRoomCodeEl.textContent = '—';
  setAdminMonitoringStatus('stopped');
  adminStudentCountEl.textContent = '0';
  studentsGrid.innerHTML = '';
  studentsSubtitle.textContent = 'Waiting for students to join...';

  // Reactivate subject radios
  document.querySelectorAll('input[name="subject"]').forEach(radio => {
    radio.disabled = false;
    radio.checked = false;
  });

  startSessionBtn.disabled = true; // Disabled initially until subject chosen
  startMonitoringBtn.disabled = true;
  stopMonitoringBtn.disabled = true;
  endSessionBtn.disabled = true;
}

function resetStudentState() {
  studentSession = {
    roomCode: null,
    name: null,
    studentId: null,
    monitoringStatus: 'stopped'
  };
  studentRoomCodeInput.value = '';
  studentServerIpInput.value = '';
  studentJoinError.textContent = '';
  studentJoinError.classList.add('hidden');

  studentSessionRoomCodeEl.textContent = '—';
  studentDisplayNameEl.textContent = '—';
  setStudentMonitoringStatus('stopped');
  studentStatusMessageEl.textContent = 'Waiting for monitoring to start...';
}

function setupSocketEventHandlers() {
  socketAPI.onConnectionEvents({
    onConnect: () => {
      updateConnectionStatus(true);
    },
    onDisconnect: () => {
      updateConnectionStatus(false);
    },
    onReconnect: () => {
      updateConnectionStatus(true);
    }
  });

  socketAPI.on('SESSION_ENDED', (payload) => {
    const { roomCode } = payload || {};
    if (currentRole === 'admin' && roomCode === adminRoomCode) {
      alert('Session ended.');
      resetAdminState();
      showCard(roleSelectionCard);
      currentRole = null;
    } else if (
      currentRole === 'student' &&
      roomCode === studentSession.roomCode
    ) {
      alert('Session ended by admin.');
      socketAPI.stopTracking();
      resetStudentState();
      showCard(roleSelectionCard);
      currentRole = null;
    }
  });

  socketAPI.on('STUDENT_JOINED', (payload) => {
    if (currentRole !== 'admin') return;
    const { roomCode, student } = payload || {};
    if (!roomCode || roomCode !== adminRoomCode || !student) return;

    const exists = adminStudents.some((s) => s.studentId === student.studentId);
    if (!exists) {
      adminStudents.push(student);
      renderAdminStudents();
    }
  });

  socketAPI.on('STUDENT_LIST_UPDATED', (payload) => {
    if (currentRole !== 'admin') return;
    const { roomCode, students } = payload || {};
    if (!roomCode || roomCode !== adminRoomCode) return;

    console.log('[DEBUG] STUDENT_LIST_UPDATED received:', JSON.stringify(students));
    adminStudents = students || [];
    renderAdminStudents();
  });

  socketAPI.on('MONITORING_STARTED', (payload) => {
    const { roomCode, monitoringStatus } = payload || {};
    if (currentRole === 'admin' && roomCode === adminRoomCode) {
      setAdminMonitoringStatus(monitoringStatus || 'active');
    }
    if (currentRole === 'student' && roomCode === studentSession.roomCode) {
      setStudentMonitoringStatus(monitoringStatus || 'active');
      socketAPI.startTracking();
    }
  });

  socketAPI.on('MONITORING_STOPPED', (payload) => {
    const { roomCode, monitoringStatus } = payload || {};
    if (currentRole === 'admin' && roomCode === adminRoomCode) {
      setAdminMonitoringStatus(monitoringStatus || 'stopped');
    }
    if (currentRole === 'student' && roomCode === studentSession.roomCode) {
      setStudentMonitoringStatus(monitoringStatus || 'stopped');
      socketAPI.stopTracking();
    }
  });

  socketAPI.onActivityData((data) => {
    if (studentSession.monitoringStatus === 'active') {
      socketAPI.emit('ACTIVITY_UPDATE', data);
    }
  });

  // WebRTC events
  socketAPI.on('REQUEST_STREAM', async (payload) => {
    if (currentRole !== 'student') return;
    const { adminSocketId } = payload || {};
    
    try {
      const screenId = await socketAPI.getScreenSourceId();
      if (!screenId) {
        console.error('No screen source found');
        return;
      }

      currentStream = await navigator.mediaDevices.getUserMedia({
        audio: false,
        video: {
          mandatory: {
            chromeMediaSource: 'desktop',
            chromeMediaSourceId: screenId
          }
        }
      });

      if (peerConnection) peerConnection.close();
      peerConnection = new RTCPeerConnection(rtcConfig);

      peerConnection.onicecandidate = (event) => {
        if (event.candidate) {
          socketAPI.emit('WEBRTC_ICE_CANDIDATE', { targetSocketId: adminSocketId, candidate: event.candidate });
        }
      };

      currentStream.getTracks().forEach(track => {
        peerConnection.addTrack(track, currentStream);
      });

      const offer = await peerConnection.createOffer();
      await peerConnection.setLocalDescription(offer);

      socketAPI.emit('WEBRTC_OFFER', { targetSocketId: adminSocketId, offer });

    } catch (err) {
      console.error('Error starting screen share', err);
    }
  });

  socketAPI.on('WEBRTC_OFFER', async (payload) => {
    if (currentRole !== 'admin') return;
    const { offer, studentSocketId } = payload || {};
    
    if (peerConnection) peerConnection.close();
    peerConnection = new RTCPeerConnection(rtcConfig);

    peerConnection.onicecandidate = (event) => {
      if (event.candidate) {
        socketAPI.emit('WEBRTC_ICE_CANDIDATE', { targetSocketId: studentSocketId, candidate: event.candidate });
      }
    };

    peerConnection.ontrack = (event) => {
      remoteVideo.srcObject = event.streams[0];
    };

    await peerConnection.setRemoteDescription(new RTCSessionDescription(offer));
    const answer = await peerConnection.createAnswer();
    await peerConnection.setLocalDescription(answer);

    socketAPI.emit('WEBRTC_ANSWER', { targetSocketId: studentSocketId, answer });
  });

  socketAPI.on('WEBRTC_ANSWER', async (payload) => {
    if (currentRole !== 'student') return;
    const { answer } = payload || {};
    if (peerConnection) {
      await peerConnection.setRemoteDescription(new RTCSessionDescription(answer));
    }
  });

  socketAPI.on('WEBRTC_ICE_CANDIDATE', async (payload) => {
    const { candidate } = payload || {};
    if (peerConnection) {
      await peerConnection.addIceCandidate(new RTCIceCandidate(candidate));
    }
  });
}

let currentUser = null;

adminBtn.addEventListener('click', async () => {
  currentRole = 'admin';
  const oldText = adminBtn.textContent;
  adminBtn.textContent = 'Authenticating in browser...';
  
  try {
    const authRes = await socketAPI.loginOAuth();
    if(!authRes.success) {
      alert('Login Failed: ' + authRes.error);
      return;
    }
    currentUser = authRes.user;

    const hostRes = await socketAPI.startHostServer();
    if(!hostRes.success) {
      alert('Failed to start server locally: ' + hostRes.error);
      return;
    }
    
    $('admin-server-ip').textContent = hostRes.ip;
    
    resetAdminState();
    socketAPI.connect(hostRes.ip);
    showCard(adminDashboardCard);
  } finally {
    adminBtn.textContent = oldText;
  }
});

adminBackBtn.addEventListener('click', () => {
  if (adminRoomCode) {
    const confirmLeave = confirm(
      'Leaving will end the current session for all students. Continue?'
    );
    if (!confirmLeave) return;

    socketAPI.emit('END_SESSION', { roomCode: adminRoomCode }, () => {
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

// Unblock session start when radio is clicked
document.querySelectorAll('input[name="subject"]').forEach(radio => {
  radio.addEventListener('change', () => {
    if (!adminRoomCode) {
      startSessionBtn.disabled = false; // Allow session creation
    }
  });
});

startSessionBtn.addEventListener('click', () => {
  const selectedRadio = document.querySelector('input[name="subject"]:checked');
  if (!selectedRadio) {
    alert('Please select a subject (ML or DBMS) before starting the session.');
    return;
  }
  
  console.log('Starting session for subject:', selectedRadio.value);

  socketAPI.emit('CREATE_SESSION', { subject: selectedRadio.value }, (response) => {
    if (!response || !response.success) {
      alert(response?.error || 'Failed to create session.');
      return;
    }
    const { session } = response;
    activeSubject = selectedRadio.value;
    adminRoomCode = session.roomCode;
    adminRoomCodeEl.textContent = adminRoomCode;

    setAdminMonitoringStatus(session.monitoringStatus || 'stopped');
    adminStudents = session.students || [];
    renderAdminStudents();

    // Lock subject
    document.querySelectorAll('input[name="subject"]').forEach(r => r.disabled = true);

    startSessionBtn.disabled = true;
    startMonitoringBtn.disabled = false;
    stopMonitoringBtn.disabled = true;
    endSessionBtn.disabled = false;
  });
});

startMonitoringBtn.addEventListener('click', () => {
  if (!adminRoomCode) return;
  socketAPI.emit(
    'START_MONITORING',
    { roomCode: adminRoomCode },
    (response) => {
      if (!response || !response.success) {
        alert(response?.error || 'Could not start monitoring.');
      }
    }
  );
});

stopMonitoringBtn.addEventListener('click', () => {
  if (!adminRoomCode) return;
  socketAPI.emit(
    'STOP_MONITORING',
    { roomCode: adminRoomCode },
    (response) => {
      if (!response || !response.success) {
        alert(response?.error || 'Could not stop monitoring.');
      }
    }
  );
});

endSessionBtn.addEventListener('click', () => {
  if (!adminRoomCode) return;
  const confirmEnd = confirm(
    'End session for all students? This cannot be undone.'
  );
  if (!confirmEnd) return;

  socketAPI.emit('END_SESSION', { roomCode: adminRoomCode }, (response) => {
    if (!response || !response.success) {
      alert(response?.error || 'Failed to end session.');
      return;
    }
    resetAdminState();
    currentRole = null;
    showCard(roleSelectionCard);
  });
});

studentBtn.addEventListener('click', async () => {
  currentRole = 'student';
  const oldText = studentBtn.textContent;
  studentBtn.textContent = 'Authenticating in browser...';
  
  try {
    const authRes = await socketAPI.loginOAuth();
    if(!authRes.success) {
      alert('Login Failed: ' + authRes.error);
      return;
    }
    currentUser = authRes.user;
    
    resetStudentState();
    showCard(studentJoinCard);
    studentRoomCodeInput.focus();
  } finally {
    studentBtn.textContent = oldText;
  }
});

studentBackBtn.addEventListener('click', () => {
  resetStudentState();
  currentRole = null;
  showCard(roleSelectionCard);
});

joinSessionBtn.addEventListener('click', () => {
  const roomCode = (studentRoomCodeInput.value || '').toUpperCase().trim();
  const serverIp = (studentServerIpInput.value || '').trim();
  const name = currentUser ? currentUser.name : 'Unknown Student';

  if (!roomCode || roomCode.length !== 6) {
    studentJoinError.textContent = 'Please enter a valid 6-character room code.';
    studentJoinError.classList.remove('hidden');
    return;
  }
  if (!serverIp) {
    studentJoinError.textContent = 'Please enter the Teacher\'s Server IP Address.';
    studentJoinError.classList.remove('hidden');
    return;
  }

  studentJoinError.classList.add('hidden');

  socketAPI.connect(serverIp);
  
  // Need to wait slightly for socket to connect before emitting join info
  setTimeout(() => {
    socketAPI.emit(
      'JOIN_SESSION',
      { roomCode, name },
      (response) => {
        if (!response || !response.success) {
          studentJoinError.textContent = response?.error || 'Failed to join session.';
          studentJoinError.classList.remove('hidden');
          socketAPI.disconnect();
          return;
        }

        const { session, student } = response;
        studentSession.roomCode = session.roomCode;
        studentSession.name = student?.name || name;
        studentSession.studentId = student?.studentId || null;
        setStudentMonitoringStatus(session.monitoringStatus || 'stopped');
        if (session.monitoringStatus === 'active') {
          socketAPI.startTracking();
        }

        studentSessionRoomCodeEl.textContent = studentSession.roomCode;
        studentDisplayNameEl.textContent = studentSession.name;
        studentSessionSubtitle.textContent = 'You are connected to the session.';

        showCard(studentSessionCard);
      }
    );
  }, 300); // 300ms buffer for connect stream
});

studentLeaveBtn.addEventListener('click', () => {
  const confirmed = confirm('Leave this session?');
  if (!confirmed) return;

  socketAPI.stopTracking();
  socketAPI.disconnect();
  resetStudentState();
  currentRole = null;
  showCard(roleSelectionCard);
});

document.addEventListener('DOMContentLoaded', () => {
  updateConnectionStatus(socketAPI.isConnected());
  setupSocketEventHandlers();
  showCard(roleSelectionCard);
});

