/**
 * AudioCapturer - Handles multi-source audio recording (Laptop/Bluetooth Speaker Mic, System Audio, File Upload)
 * and provides extensible AudioStreamAdapter sockets for Teams/Zoom integrations.
 */

class AudioStreamAdapter {
  async initialize() {
    throw new Error("AudioStreamAdapter.initialize() must be implemented");
  }
  async getMediaStream() {
    throw new Error("AudioStreamAdapter.getMediaStream() must be implemented");
  }
  async stop() {
    throw new Error("AudioStreamAdapter.stop() must be implemented");
  }
}

class MicSpeakerAdapter extends AudioStreamAdapter {
  constructor(options = {}) {
    super();
    this.options = options;
    this.stream = null;
  }

  async initialize() {
    try {
      this.stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
          sampleRate: 44100
        },
        video: false
      });
      return this.stream;
    } catch (err) {
      console.error("MicSpeakerAdapter failed to access microphone:", err);
      throw new Error("Could not access microphone/speaker acoustics. Please check browser permissions.");
    }
  }

  async getMediaStream() {
    if (!this.stream) await this.initialize();
    return this.stream;
  }

  async stop() {
    if (this.stream) {
      this.stream.getTracks().forEach(track => track.stop());
      this.stream = null;
    }
  }
}

class SystemAudioAdapter extends AudioStreamAdapter {
  constructor() {
    super();
    this.stream = null;
  }

  async initialize() {
    try {
      // getDisplayMedia captures system audio stream in Edge/Chrome/Firefox
      const displayStream = await navigator.mediaDevices.getDisplayMedia({
        video: { displaySurface: "browser" },
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: false
        }
      });

      const audioTracks = displayStream.getAudioTracks();
      if (!audioTracks || audioTracks.length === 0) {
        // Stop video tracks immediately
        displayStream.getTracks().forEach(track => track.stop());
        throw new Error("No system audio track selected. Make sure to check 'Share audio' when picking screen/tab.");
      }

      // Create audio-only media stream
      this.stream = new MediaStream([audioTracks[0]]);

      // Automatically stop video track to save resources
      displayStream.getVideoTracks().forEach(track => track.stop());

      return this.stream;
    } catch (err) {
      console.error("SystemAudioAdapter error:", err);
      throw new Error(err.message || "Failed to capture laptop/speaker system audio.");
    }
  }

  async getMediaStream() {
    if (!this.stream) await this.initialize();
    return this.stream;
  }

  async stop() {
    if (this.stream) {
      this.stream.getTracks().forEach(track => track.stop());
      this.stream = null;
    }
  }
}

class TeamsZoomAdapter extends AudioStreamAdapter {
  constructor(config = {}) {
    super();
    this.config = config;
    this.stream = null;
  }

  async initialize() {
    console.log("Teams/Zoom Adapter Initializing with config:", this.config);
    // Future expansion point: connect to Teams Webhook / Bot WebRTC stream
    // Fallback to room acoustics mic capture
    const mic = new MicSpeakerAdapter();
    this.stream = await mic.initialize();
    return this.stream;
  }

  async getMediaStream() {
    return this.stream;
  }

  async stop() {
    if (this.stream) {
      this.stream.getTracks().forEach(track => track.stop());
      this.stream = null;
    }
  }
}

class AudioCapturer {
  constructor() {
    this.mediaRecorder = null;
    this.audioChunks = [];
    this.currentAdapter = null;
    this.mediaStream = null;
    this.audioContext = null;
    this.analyser = null;
    this.isRecording = false;
    this.isPaused = false;
    this.recordingStartTime = 0;
    this.pausedDuration = 0;
    this.timerInterval = null;
    this.onTickCallback = null;
    this.onWaveformCallback = null;
  }

  async startRecording(sourceType = 'speaker_mic', callbacks = {}) {
    this.onTickCallback = callbacks.onTick || null;
    this.onWaveformCallback = callbacks.onWaveform || null;
    this.audioChunks = [];

    // Select adapter based on source
    switch (sourceType) {
      case 'system_audio':
        this.currentAdapter = new SystemAudioAdapter();
        break;
      case 'teams_zoom':
        this.currentAdapter = new TeamsZoomAdapter();
        break;
      case 'speaker_mic':
      default:
        this.currentAdapter = new MicSpeakerAdapter();
        break;
    }

    this.mediaStream = await this.currentAdapter.getMediaStream();

    // Determine supported mimeType
    let mimeType = 'audio/webm;codecs=opus';
    if (!MediaRecorder.isTypeSupported(mimeType)) {
      mimeType = 'audio/webm';
      if (!MediaRecorder.isTypeSupported(mimeType)) {
        mimeType = 'audio/mp4';
        if (!MediaRecorder.isTypeSupported(mimeType)) {
          mimeType = ''; // Let browser choose default
        }
      }
    }

    const options = mimeType ? { mimeType } : {};
    this.mediaRecorder = new MediaRecorder(this.mediaStream, options);

    this.mediaRecorder.ondataavailable = (event) => {
      if (event.data && event.data.size > 0) {
        this.audioChunks.push(event.data);
      }
    };

    // Setup Web Audio API Analyser for Visualizer
    try {
      this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
      const sourceNode = this.audioContext.createMediaStreamSource(this.mediaStream);
      this.analyser = this.audioContext.createAnalyser();
      this.analyser.fftSize = 64;
      sourceNode.connect(this.analyser);
      this.startWaveformVisualizer();
    } catch (e) {
      console.warn("AudioContext visualizer setup failed:", e);
    }

    this.mediaRecorder.start(1000); // 1-second timeslices
    this.isRecording = true;
    this.isPaused = false;
    this.recordingStartTime = Date.now();

    this.startTimer();
  }

  pauseRecording() {
    if (this.mediaRecorder && this.isRecording && !this.isPaused) {
      this.mediaRecorder.pause();
      this.isPaused = true;
      clearInterval(this.timerInterval);
    }
  }

  resumeRecording() {
    if (this.mediaRecorder && this.isRecording && this.isPaused) {
      this.mediaRecorder.resume();
      this.isPaused = false;
      this.startTimer();
    }
  }

  async stopRecording() {
    return new Promise((resolve, reject) => {
      if (!this.mediaRecorder || !this.isRecording) {
        return reject(new Error("No active recording session"));
      }

      this.mediaRecorder.onstop = async () => {
        this.isRecording = false;
        this.isPaused = false;
        clearInterval(this.timerInterval);

        if (this.audioContext) {
          try { await this.audioContext.close(); } catch (e) {}
        }

        if (this.currentAdapter) {
          await this.currentAdapter.stop();
        }

        const mimeType = this.mediaRecorder.mimeType || 'audio/webm';
        const audioBlob = new Blob(this.audioChunks, { type: mimeType });

        const durationSeconds = Math.round((Date.now() - this.recordingStartTime) / 1000);

        resolve({
          blob: audioBlob,
          mimeType: mimeType,
          durationSeconds: durationSeconds,
        });
      };

      this.mediaRecorder.stop();
    });
  }

  startTimer() {
    clearInterval(this.timerInterval);
    this.timerInterval = setInterval(() => {
      const elapsed = Math.round((Date.now() - this.recordingStartTime) / 1000);
      if (this.onTickCallback) {
        this.onTickCallback(elapsed);
      }
    }, 1000);
  }

  startWaveformVisualizer() {
    if (!this.analyser || !this.onWaveformCallback) return;
    const dataArray = new Uint8Array(this.analyser.frequencyBinCount);

    const updateWaveform = () => {
      if (!this.isRecording) return;
      this.analyser.getByteFrequencyData(dataArray);
      
      // Distribute frequency bins evenly across the 10 visualizer bars
      const binCount = this.analyser.frequencyBinCount;
      const step = Math.max(1, Math.floor(binCount / 10));
      const frequencies = [];
      for (let i = 0; i < 10; i++) {
        frequencies.push(dataArray[i * step] || 0);
      }
      
      this.onWaveformCallback(frequencies);

      if (this.isRecording && !this.isPaused) {
        requestAnimationFrame(updateWaveform);
      }
    };

    updateWaveform();
  }

  static async readFileAsBase64(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = error => reject(error);
      reader.readAsDataURL(file);
    });
  }
}

window.AudioCapturer = AudioCapturer;
