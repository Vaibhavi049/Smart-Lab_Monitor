// Simple browser client using Socket.IO

const socket = io();

const $ = (id) => document.getElementById(id);

const roleSelectionCard = $('role-selection');
const adminLoginCard = $('admin-login');
const adminDashboardCard = $('admin-dashboard');
const studentJoinCard = $('student-join');
const studentDashboardCard = $('student-dashboard');
const studentSessionCard = $('student-session');

const connectionDot = $('connection-dot');
const connectionText = $('connection-text');

const adminLoginBackBtn = () => $('admin-login-back-btn');
const adminBackBtn = () => $('admin-back-btn');
const startSessionBtn = $('start-session-btn');
const startMonitoringBtn = $('start-monitoring-btn');
const stopMonitoringBtn = $('stop-monitoring-btn');
const endSessionBtn = $('end-session-btn');

const adminRoomCodeEl = $('admin-room-code');
const adminMonitoringStatusEl = $('admin-monitoring-status');
const adminStudentCountEl = $('admin-student-count');
const studentsGrid = $('students-grid');
const studentsSubtitle = () => $('students-subtitle');
const studentBackBtn = $('student-back-btn');
const studentLeaveBtn = $('student-leave-btn');
const studentRoomCodeInput = $('student-room-code');
const joinSessionBtn = $('join-session-btn');
const studentJoinError = $('student-join-error');

const studentSessionRoomCodeEl = () => $('student-session-room-code');
const studentMonitoringStatusEl = () => $('student-monitoring-status');
const studentDisplayNameEl = () => $('student-display-name');
const studentStatusMessageEl = () => $('student-status-message');
const studentSessionSubtitle = () => $('student-session-subtitle');

const adminBtn = $('admin-btn');
const studentBtn = $('student-btn');

const adminLoginBtn = $('admin-login-btn');
const studentLoginBtn = $('student-login-btn');
let currentUser = null;

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
    adminLoginCard,
    adminDashboardCard,
    studentJoinCard,
    studentDashboardCard,
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

  startMonitoringBtn.disabled = status === 'active';
  stopMonitoringBtn.disabled = status === 'stopped';
}

function setStudentMonitoringStatus(status) {
  studentSession.monitoringStatus = status;
  if(studentMonitoringStatusEl()) {
     studentMonitoringStatusEl().textContent = status === 'active' ? 'Active' : 'Stopped';
     studentMonitoringStatusEl().classList.remove('active', 'stopped');
     studentMonitoringStatusEl().classList.add(status);
  }

  if (status === 'active') {
    if (studentStatusMessageEl()) studentStatusMessageEl().textContent = 'Monitoring is active.';
  } else {
    if (studentStatusMessageEl()) studentStatusMessageEl().textContent = 'Waiting for monitoring to start...';
  }
}

function renderAdminStudents() {
  studentsGrid.innerHTML = '';
  adminStudentCountEl.textContent = adminStudents.length.toString();

  if (adminStudents.length === 0) {
    if (studentsSubtitle()) studentsSubtitle().textContent = 'Waiting for students to join...';
    return;
  }

  if (studentsSubtitle()) studentsSubtitle().textContent = 'Live list of connected students.';

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
  if (studentsSubtitle()) studentsSubtitle().textContent = 'Waiting for students to join...';

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
  if (studentRoomCodeInput) studentRoomCodeInput.value = '';
  if (studentJoinError) {
    studentJoinError.textContent = '';
    studentJoinError.classList.add('hidden');
  }

  if(studentSessionRoomCodeEl()) studentSessionRoomCodeEl().textContent = '—';
  if(studentDisplayNameEl()) studentDisplayNameEl().textContent = '—';
  setStudentMonitoringStatus('stopped');
  if(studentStatusMessageEl()) studentStatusMessageEl().textContent = 'Waiting for monitoring to start...';
}

// Socket events
socket.on('connect', () => updateConnectionStatus(true));
socket.on('disconnect', () => updateConnectionStatus(false));

socket.on('SESSION_ENDED', (payload) => {
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

// Admin flow
if (adminBtn) {
  adminBtn.addEventListener('click', () => {
    currentRole = 'admin';
    showCard(adminLoginCard);
  });
}

if (adminLoginBackBtn()) {
  adminLoginBackBtn().addEventListener('click', () => {
    currentRole = null;
    showCard(roleSelectionCard);
  });
}

if (adminLoginBtn) {
  adminLoginBtn.addEventListener('click', () => {
    window.location.href = '/auth/google?role=admin';
  });
}

if (adminBackBtn()) {
  adminBackBtn().addEventListener('click', () => {
    if (adminRoomCode) {
      const confirmLeave = confirm(
        'Leaving will end the current session for all students. Continue?'
      );
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

// When admin backs from dashboard without a session, go to role selection (not login)
// When admin backs and has session, confirm then end session and go to role selection

if (startSessionBtn) {
  startSessionBtn.addEventListener('click', () => {
    const subjectEl = $('admin-subject');
    const subject = subjectEl ? subjectEl.value : 'General';
    socket.emit('CREATE_SESSION', { subject }, (response) => {
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
}

if (startMonitoringBtn) {
  startMonitoringBtn.addEventListener('click', () => {
    if (!adminRoomCode) return;
    socket.emit(
      'START_MONITORING',
      { roomCode: adminRoomCode },
      (response) => {
        if (!response || !response.success) {
          alert(response?.error || 'Could not start monitoring.');
        }
      }
    );
  });
}

if (stopMonitoringBtn) {
  stopMonitoringBtn.addEventListener('click', () => {
    if (!adminRoomCode) return;
    socket.emit(
      'STOP_MONITORING',
      { roomCode: adminRoomCode },
      (response) => {
        if (!response || !response.success) {
          alert(response?.error || 'Could not stop monitoring.');
        }
      }
    );
  });
}

if (endSessionBtn) {
  endSessionBtn.addEventListener('click', () => {
    if (!adminRoomCode) return;
    const confirmEnd = confirm(
      'End session for all students? This cannot be undone.'
    );
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

// Student flow
if (studentBtn) {
  studentBtn.addEventListener('click', () => {
    currentRole = 'student';
    showCard(studentJoinCard);
  });
}

if (studentBackBtn) {
  studentBackBtn.addEventListener('click', () => {
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
    const name = currentUser ? currentUser.name : 'Unknown Student';

    if (!roomCode || roomCode.length !== 6) {
      studentJoinError.textContent = 'Please enter a valid 6-character room code.';
      studentJoinError.classList.remove('hidden');
      return;
    }

    studentJoinError.classList.add('hidden');

    socket.emit(
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

        const roomEl = studentSessionRoomCodeEl();
        if (roomEl) roomEl.textContent = studentSession.roomCode;
        const nameEl = studentDisplayNameEl();
        if (nameEl) nameEl.textContent = studentSession.name;
        const subEl = studentSessionSubtitle();
        if (subEl) subEl.textContent = 'You are connected to the session.';

        showCard(studentSessionCard);
      }
    );
  });
}

  if (studentLeaveBtn) {
    studentLeaveBtn.addEventListener('click', () => {
      const confirmed = confirm('Leave this session?');
      if (!confirmed) return;

      resetStudentState();
      currentRole = null;
      showCard(roleSelectionCard);
    });
  }

document.addEventListener('DOMContentLoaded', async () => {
  updateConnectionStatus(socket.connected);
  
  try {
    const res = await fetch('/api/user');
    if (res.ok) {
      currentUser = await res.json();
    }
  } catch (err) {
    console.error('Failed to fetch user', err);
  }

  if (window.location.pathname === '/admin-dashboard') {
    currentRole = 'admin';
    if (currentUser && $('admin-greeting')) {
       $('admin-greeting').textContent = `Hello ${currentUser.name}`;
    }
    showCard(adminDashboardCard);
  } else if (window.location.pathname === '/student-dashboard') {
    currentRole = 'student';
    if (currentUser && $('student-greeting')) {
       $('student-greeting').textContent = `Hello ${currentUser.name}`;
    }
    showCard(studentDashboardCard);
  } else {
    showCard(roleSelectionCard);
  }
});

