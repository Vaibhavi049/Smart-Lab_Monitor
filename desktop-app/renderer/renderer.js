const socketAPI = window.socketAPI;

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
const studentNameInput = $('student-name');
const joinSessionBtn = $('join-session-btn');
const studentJoinError = $('student-join-error');

const studentSessionRoomCodeEl = $('student-session-room-code');
const studentMonitoringStatusEl = $('student-monitoring-status');
const studentDisplayNameEl = $('student-display-name');
const studentStatusMessageEl = $('student-status-message');
const studentSessionSubtitle = $('student-session-subtitle');

const adminBtn = $('admin-btn');
const studentBtn = $('student-btn');

let currentRole = null;
let adminRoomCode = null;
let adminMonitoringStatus = 'stopped';
let adminStudents = [];
let studentSession = {
  roomCode: null,
  name: null,
  studentId: null,
  monitoringStatus: 'stopped'
};

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

function renderAdminStudents() {
  studentsGrid.innerHTML = '';
  adminStudentCountEl.textContent = adminStudents.length.toString();

  if (adminStudents.length === 0) {
    studentsSubtitle.textContent = 'Waiting for students to join...';
    return;
  }

  studentsSubtitle.textContent = 'Live list of connected students.';

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
    card.appendChild(orb);

    studentsGrid.appendChild(card);
  });
}

function resetAdminState() {
  adminRoomCode = null;
  adminMonitoringStatus = 'stopped';
  adminStudents = [];

  adminRoomCodeEl.textContent = '—';
  setAdminMonitoringStatus('stopped');
  adminStudentCountEl.textContent = '0';
  studentsGrid.innerHTML = '';
  studentsSubtitle.textContent = 'Waiting for students to join...';

  startSessionBtn.disabled = false;
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
  studentNameInput.value = '';
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
    }
  });

  socketAPI.on('MONITORING_STOPPED', (payload) => {
    const { roomCode, monitoringStatus } = payload || {};
    if (currentRole === 'admin' && roomCode === adminRoomCode) {
      setAdminMonitoringStatus(monitoringStatus || 'stopped');
    }
    if (currentRole === 'student' && roomCode === studentSession.roomCode) {
      setStudentMonitoringStatus(monitoringStatus || 'stopped');
    }
  });
}

adminBtn.addEventListener('click', () => {
  currentRole = 'admin';
  resetAdminState();
  socketAPI.connect();
  showCard(adminDashboardCard);
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

startSessionBtn.addEventListener('click', () => {
  socketAPI.connect();

  socketAPI.emit('CREATE_SESSION', {}, (response) => {
    if (!response || !response.success) {
      alert(response?.error || 'Failed to create session.');
      return;
    }
    const { session } = response;
    adminRoomCode = session.roomCode;
    adminRoomCodeEl.textContent = adminRoomCode;

    setAdminMonitoringStatus(session.monitoringStatus || 'stopped');
    adminStudents = session.students || [];
    renderAdminStudents();

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

studentBtn.addEventListener('click', () => {
  currentRole = 'student';
  resetStudentState();
  socketAPI.connect();
  showCard(studentJoinCard);
  studentRoomCodeInput.focus();
});

studentBackBtn.addEventListener('click', () => {
  resetStudentState();
  currentRole = null;
  showCard(roleSelectionCard);
});

joinSessionBtn.addEventListener('click', () => {
  const roomCode = (studentRoomCodeInput.value || '').toUpperCase().trim();
  const name = (studentNameInput.value || '').trim();

  if (!roomCode || roomCode.length !== 6) {
    studentJoinError.textContent = 'Please enter a valid 6-character room code.';
    studentJoinError.classList.remove('hidden');
    return;
  }
  if (!name) {
    studentJoinError.textContent = 'Please enter your name.';
    studentJoinError.classList.remove('hidden');
    return;
  }

  studentJoinError.classList.add('hidden');

  socketAPI.connect();
  socketAPI.emit(
    'JOIN_SESSION',
    { roomCode, name },
    (response) => {
      if (!response || !response.success) {
        studentJoinError.textContent = response?.error || 'Failed to join session.';
        studentJoinError.classList.remove('hidden');
        return;
      }

      const { session, student } = response;
      studentSession.roomCode = session.roomCode;
      studentSession.name = student?.name || name;
      studentSession.studentId = student?.studentId || null;
      setStudentMonitoringStatus(session.monitoringStatus || 'stopped');

      studentSessionRoomCodeEl.textContent = studentSession.roomCode;
      studentDisplayNameEl.textContent = studentSession.name;
      studentSessionSubtitle.textContent = 'You are connected to the session.';

      showCard(studentSessionCard);
    }
  );
});

studentLeaveBtn.addEventListener('click', () => {
  const confirmed = confirm('Leave this session?');
  if (!confirmed) return;

  resetStudentState();
  currentRole = null;
  showCard(roleSelectionCard);
});

document.addEventListener('DOMContentLoaded', () => {
  updateConnectionStatus(socketAPI.isConnected());
  setupSocketEventHandlers();
  showCard(roleSelectionCard);
});

