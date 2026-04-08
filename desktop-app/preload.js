const { contextBridge, ipcRenderer } = require('electron');
const { io } = require('socket.io-client');

let socket = null;

function ensureSocket(ipAddress = 'localhost') {
  if (!socket) {
    socket = io(`http://${ipAddress}:4000`, {
      autoConnect: false,
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionAttempts: Infinity,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000
    });
  }
  return socket;
}

contextBridge.exposeInMainWorld('socketAPI', {
  connect(ipAddress = 'localhost') {
    const s = ensureSocket(ipAddress);
    if (s.io && s.io.uri !== `http://${ipAddress}:4000`) {
      s.disconnect();
      s.io.uri = `http://${ipAddress}:4000`;
    }
    if (!s.connected && !s.connecting) {
      s.connect();
    }
  },
  disconnect() {
    if (socket) {
      socket.disconnect();
    }
  },
  emit(event, data, callback) {
    const s = ensureSocket();
    if (callback && typeof callback === 'function') {
      s.emit(event, data, (response) => {
        callback(response);
      });
    } else {
      s.emit(event, data);
    }
  },
  on(event, handler) {
    const s = ensureSocket();
    s.on(event, handler);
  },
  off(event, handler) {
    if (!socket) return;
    socket.off(event, handler);
  },
  onConnectionEvents({ onConnect, onDisconnect, onReconnect }) {
    const s = ensureSocket();
    if (typeof onConnect === 'function') s.on('connect', onConnect);
    if (typeof onDisconnect === 'function') s.on('disconnect', onDisconnect);
    if (typeof onReconnect === 'function') s.on('reconnect', onReconnect);
  },
  isConnected() {
    return socket ? socket.connected : false;
  },
  getId() {
    return socket ? socket.id : null;
  },
  startTracking() {
    ipcRenderer.send('START_ACTIVITY_TRACKING');
  },
  stopTracking() {
    ipcRenderer.send('STOP_ACTIVITY_TRACKING');
  },
  onActivityData(callback) {
    ipcRenderer.on('ACTIVITY_DATA', (event, data) => callback(data));
  },
  loginOAuth() {
    return ipcRenderer.invoke('START_OAUTH_LOGIN');
  },
  startHostServer() {
    return ipcRenderer.invoke('START_HOST_SERVER');
  },
  getScreenSourceId() {
    return ipcRenderer.invoke('GET_SCREEN_SOURCE_ID');
  },
  captureScreenSnapshot() {
    return ipcRenderer.invoke('CAPTURE_SCREEN_SNAPSHOT');
  }
});

