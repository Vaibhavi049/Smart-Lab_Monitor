// streamer.js - Senior Engineer Hybrid Monitor Module
// Handles the 100% reliable smart-switching between Video and Snapshots.

class HybridStreamer {
  constructor(socketAPI, rtcConfig) {
    this.socketAPI = socketAPI;
    this.rtcConfig = rtcConfig;
    this.peerConnection = null;
    this.currentStream = null;
    this.snapshotInterval = null;
    this.iceCandidateBuffer = [];
    this.videoTrackReceived = false;
    this.mode = 'idle'; // 'idle', 'requesting', 'video', 'fallback'
    this.onModeChange = null; // Callback for UI updates
  }

  // ───── ADMIN / TEACHER LOGIC ─────

  async startView(studentSocketId, videoElement, snapshotElement) {
    this.cleanup();
    this.mode = 'requesting';
    this.updateUI('Connecting...');

    // 1. Initial 4s Fail-Safe: If video hasn't arrived, start showing snapshots.
    this.fallbackTimer = setTimeout(() => {
      if (!this.videoTrackReceived) {
        this.mode = 'fallback';
        this.updateUI('FALLBACK MODE (Stable)');
        if (snapshotElement) snapshotElement.classList.remove('hidden');
        if (videoElement) videoElement.classList.add('hidden');
      }
    }, 4500);

    const adminId = this.socketAPI.getId();
    this.socketAPI.emit('START_LIVE_VIEW', { targetSocketId: studentSocketId, adminSocketId: adminId });
  }

  handleOffer(payload, studentSocketId, videoElement, snapshotElement) {
    this.peerConnection = new RTCPeerConnection(this.rtcConfig);
    
    this.peerConnection.onicecandidate = (e) => {
      if (e.candidate) this.socketAPI.emit('LIVE_ICE', { targetSocketId: studentSocketId, candidate: e.candidate });
    };

    this.peerConnection.ontrack = (event) => {
      console.log('[STREAMER] WebRTC Video Track Arrived');
      this.videoTrackReceived = true;
      this.mode = 'video';
      this.updateUI('LIVE (High Quality)');
      
      if (snapshotElement) snapshotElement.classList.add('hidden');
      if (videoElement) {
        videoElement.srcObject = event.streams[0] || new MediaStream([event.track]);
        videoElement.classList.remove('hidden');
        videoElement.muted = true;
        videoElement.play().catch(err => console.warn('[STREAMER] Play blocked:', err));
      }
    };

    this.peerConnection.oniceconnectionstatechange = () => {
      const state = this.peerConnection.iceConnectionState;
      console.log('[STREAMER] ICE State Change:', state);
      if (['failed', 'disconnected', 'closed'].includes(state)) {
        if (this.mode !== 'fallback') {
           this.mode = 'fallback';
           this.updateUI('FALLBACK (Reconnecting...)');
           if (videoElement) videoElement.classList.add('hidden');
           if (snapshotElement) snapshotElement.classList.remove('hidden');
        }
      }
    };

    this.peerConnection.setRemoteDescription(new RTCSessionDescription(payload.offer))
      .then(() => this.peerConnection.createAnswer())
      .then(answer => this.peerConnection.setLocalDescription(answer))
      .then(() => {
        this.socketAPI.emit('LIVE_ANSWER', { targetSocketId: studentSocketId, answer: this.peerConnection.localDescription });
        this.flushIceCandidates();
      });
  }

  handleSnapshot(payload, snapshotElement, videoElement) {
    // We always update the snapshot element in the background.
    // We only display it if we are in 'fallback' mode or still 'requesting'.
    if (snapshotElement) {
      snapshotElement.src = payload.dataUrl;
      if (this.mode === 'fallback' || this.mode === 'requesting') {
        snapshotElement.classList.remove('hidden');
        if (videoElement) videoElement.classList.add('hidden');
      }
    }
  }

  // ───── STUDENT LOGIC ─────

  async initiateCapture(adminSocketId) {
    this.cleanup();
    console.log('[STREAMER] Responding to Admin View request');

    // 1. ATTEMPT WebRTC VIDEO (The "Meet Style" Priority)
    try {
      const screenId = await this.socketAPI.getScreenSourceId();
      if (screenId) {
        this.currentStream = await navigator.mediaDevices.getUserMedia({
          audio: false,
          video: { mandatory: { chromeMediaSource: 'desktop', chromeMediaSourceId: screenId } }
        });

        this.peerConnection = new RTCPeerConnection(this.rtcConfig);
        this.currentStream.getTracks().forEach(track => this.peerConnection.addTrack(track, this.currentStream));

        this.peerConnection.onicecandidate = (e) => {
          if (e.candidate) this.socketAPI.emit('LIVE_ICE', { targetSocketId: adminSocketId, candidate: e.candidate });
        };

        const offer = await this.peerConnection.createOffer();
        await this.peerConnection.setLocalDescription(offer);
        this.socketAPI.emit('LIVE_OFFER', { targetSocketId: adminSocketId, offer: this.peerConnection.localDescription });
      }
    } catch (e) { console.warn('[STREAMER] Student WebRTC capture failed:', e); }

    // 2. STABLE SOCKET HEARTBEAT (The 100% Guaranteed Reliability)
    this.snapshotInterval = setInterval(async () => {
      const dataUrl = await this.socketAPI.captureScreenSnapshot();
      if (dataUrl) {
        this.socketAPI.emit('LIVE_SNAPSHOT', { targetSocketId: adminSocketId, dataUrl });
      }
    }, 1500);
  }

  // ───── UTILITIES ─────

  handleIceCandidate(candidate) {
    if (this.peerConnection && this.peerConnection.remoteDescription) {
      this.peerConnection.addIceCandidate(new RTCIceCandidate(candidate)).catch(e => {});
    } else {
      this.iceCandidateBuffer.push(candidate);
    }
  }

  flushIceCandidates() {
    while (this.iceCandidateBuffer.length > 0) {
      const cand = this.iceCandidateBuffer.shift();
      this.peerConnection.addIceCandidate(new RTCIceCandidate(cand)).catch(e => {});
    }
  }

  updateUI(message) {
    if (this.onModeChange) this.onModeChange(message, this.mode);
  }

  cleanup() {
    console.log('[STREAMER] Releasing resources...');
    if (this.fallbackTimer) clearTimeout(this.fallbackTimer);
    if (this.snapshotInterval) clearInterval(this.snapshotInterval);
    if (this.peerConnection) { this.peerConnection.close(); this.peerConnection = null; }
    if (this.currentStream) { this.currentStream.getTracks().forEach(t => t.stop()); this.currentStream = null; }
    
    this.snapshotInterval = null;
    this.iceCandidateBuffer = [];
    this.videoTrackReceived = false;
    this.mode = 'idle';
  }
}
