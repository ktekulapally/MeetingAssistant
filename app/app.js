/**
 * MeetingAssistant App Controller
 * Manages UI events, Supabase Auth, Audio Capturer, Edge Function AI calls, and Document Exporter.
 */

document.addEventListener("DOMContentLoaded", () => {
  // Global State
  let currentUser = null;
  let currentMeeting = null;
  let selectedAudioSource = "speaker_mic";
  let activeAudioCapturer = null;
  let currentRecordingDuration = 0;
  let userMeetingsList = [];

  // Background recording wake lock and silent audio player variables
  let silentAudioElement = null;
  let wakeLock = null;

  function startSilentAudio() {
    try {
      if (!silentAudioElement) {
        // Base64 WAV silence block (1 second loop)
        silentAudioElement = new Audio("data:audio/wav;base64,UklGRigAAABXQVZFZm10IBIAAAABAAEARKwAAIhYAQACABAAAABkYXRhAgAAAAAA");
        silentAudioElement.loop = true;
      }
      silentAudioElement.play().catch((err) => {
        console.warn("Silent audio background playback was blocked by browser:", err);
      });
    } catch (e) {
      console.warn("Could not create silent audio playback:", e);
    }
  }

  function stopSilentAudio() {
    if (silentAudioElement) {
      try {
        silentAudioElement.pause();
      } catch (e) {}
    }
  }

  async function requestWakeLock() {
    try {
      if ('wakeLock' in navigator) {
        wakeLock = await navigator.wakeLock.request('screen');
        console.log("Wake Lock acquired successfully.");
      }
    } catch (err) {
      console.warn("Failed to acquire Screen Wake Lock:", err);
    }
  }

  function releaseWakeLock() {
    if (wakeLock) {
      try {
        wakeLock.release();
        wakeLock = null;
        console.log("Wake Lock released.");
      } catch (e) {}
    }
  }

  // DOM Elements
  const mainNavTabs = document.getElementById("mainNavTabs");
  const tabPanes = document.querySelectorAll(".tab-pane");
  const userProfileArea = document.getElementById("userProfileArea");
  const userEmailDisplay = document.getElementById("userEmailDisplay");
  const authActionButton = document.getElementById("authActionButton");

  // Studio Elements
  const sourceMicCard = document.getElementById("sourceMicCard");
  const sourceDropdownCard = document.getElementById("sourceDropdownCard");
  const audioSourceDropdown = document.getElementById("audioSourceDropdown");
  const fileUploadPanel = document.getElementById("fileUploadPanel");
  const audioFileInput = document.getElementById("audioFileInput");

  const timerDisplay = document.getElementById("timerDisplay");
  const waveformBars = document.querySelectorAll(".waveform-bar");
  const captureStatusBadge = document.getElementById("captureStatusBadge");
  const btnStartRecord = document.getElementById("btnStartRecord");
  const btnPauseRecord = document.getElementById("btnPauseRecord");
  const btnStopRecord = document.getElementById("btnStopRecord");

  const inputMeetingTitle = document.getElementById("inputMeetingTitle");
  const inputMeetingAttendees = document.getElementById("inputMeetingAttendees");
  const inputRecipientEmail = document.getElementById("inputRecipientEmail");
  const aiStatusBox = document.getElementById("aiStatusBox");

  // History & Modal Elements
  const btnRefreshHistory = document.getElementById("btnRefreshHistory");
  const meetingHistoryTableBody = document.getElementById("meetingHistoryTableBody");
  const meetingDetailModal = document.getElementById("meetingDetailModal");
  const btnCloseDetailModal = document.getElementById("btnCloseDetailModal");

  const modalMeetingTitle = document.getElementById("modalMeetingTitle");
  const modalMeetingDate = document.getElementById("modalMeetingDate");
  const modalSummaryBox = document.getElementById("modalSummaryBox");
  const modalTakeawaysBox = document.getElementById("modalTakeawaysBox");
  const modalActionPointsBox = document.getElementById("modalActionPointsBox");
  const modalTranscriptBox = document.getElementById("modalTranscriptBox");

  const btnExportWord = document.getElementById("btnExportWord");
  const btnExportPdf = document.getElementById("btnExportPdf");
  const btnSendEmailReport = document.getElementById("btnSendEmailReport");

  // Auth Modal Elements
  const authModal = document.getElementById("authModal");
  const btnCloseAuthModal = document.getElementById("btnCloseAuthModal");
  const authForm = document.getElementById("authForm");
  const authEmail = document.getElementById("authEmail");
  const authPassword = document.getElementById("authPassword");

  // Toast Container
  const toastContainer = document.getElementById("toastContainer");

  // ==========================================
  // 1. NAVIGATION & TAB SWITCHING
  // ==========================================
  if (mainNavTabs) {
    mainNavTabs.addEventListener("click", (e) => {
      // 1. Handle clicking a standard tab or settings icon tab
      const tabBtn = e.target.closest(".tab-btn:not(.dropdown-toggle)");
      if (tabBtn) {
        const targetTabId = tabBtn.getAttribute("data-tab");

        // Clear all active states
        document.querySelectorAll(".tab-btn").forEach((btn) => btn.classList.remove("active"));
        document.querySelectorAll(".tab-dropdown-item").forEach((item) => item.classList.remove("active"));
        tabPanes.forEach((pane) => pane.classList.remove("active"));

        // Activate clicked tab
        tabBtn.classList.add("active");
        const targetPane = document.getElementById(targetTabId);
        if (targetPane) targetPane.classList.add("active");

        if (targetTabId === "tab-history") {
          fetchMeetingHistory();
        }
        return;
      }

      // 2. Handle clicking a dropdown menu item under Live Studio
      const dropdownItem = e.target.closest(".tab-dropdown-item");
      if (dropdownItem) {
        const targetTabId = dropdownItem.getAttribute("data-tab");
        const labelText = dropdownItem.getAttribute("data-label");
        const iconSpan = dropdownItem.querySelector("span").cloneNode(true);

        // Clear all active states
        document.querySelectorAll(".tab-btn").forEach((btn) => btn.classList.remove("active"));
        document.querySelectorAll(".tab-dropdown-item").forEach((item) => item.classList.remove("active"));
        tabPanes.forEach((pane) => pane.classList.remove("active"));

        // Activate dropdown item and parent toggle button
        dropdownItem.classList.add("active");
        const studioDropdownToggle = document.getElementById("studioDropdownToggle");
        const studioTabLabel = document.getElementById("studioTabLabel");
        if (studioDropdownToggle) studioDropdownToggle.classList.add("active");
        
        if (studioTabLabel && studioDropdownToggle) {
          studioTabLabel.textContent = labelText;
          const toggleIcon = studioDropdownToggle.querySelector("span");
          if (toggleIcon) studioDropdownToggle.replaceChild(iconSpan, toggleIcon);
        }

        const targetPane = document.getElementById(targetTabId);
        if (targetPane) targetPane.classList.add("active");

        // Close dropdown menu manually on click
        const studioDropdownContainer = document.getElementById("studioDropdownContainer");
        if (studioDropdownContainer) studioDropdownContainer.classList.remove("open");
      }
    });
  }

  // Toggle open class on clicking the dropdown button
  const studioDropdownToggle = document.getElementById("studioDropdownToggle");
  const studioDropdownContainer = document.getElementById("studioDropdownContainer");
  if (studioDropdownToggle && studioDropdownContainer) {
    studioDropdownToggle.addEventListener("click", (e) => {
      e.stopPropagation();
      studioDropdownContainer.classList.toggle("open");
    });
  }

  // Dismiss dropdown when clicking elsewhere
  window.addEventListener("click", () => {
    if (studioDropdownContainer) {
      studioDropdownContainer.classList.remove("open");
    }
  });

  // Restore saved email setting
  const savedDefaultEmail = localStorage.getItem("meetingassistant_default_email");
  if (savedDefaultEmail && inputRecipientEmail) {
    inputRecipientEmail.value = savedDefaultEmail;
    const settingDefaultEmail = document.getElementById("settingDefaultEmail");
    if (settingDefaultEmail) settingDefaultEmail.value = savedDefaultEmail;
  }

  // ==========================================
  // 2. SUPABASE AUTH & SESSION MANAGEMENT
  // ==========================================
  async function initAuth() {
    if (!window.supabaseClient || !window.supabaseClient.auth) {
      console.warn("Supabase client is not initialized.");
      updateUserUI();
      return;
    }

    try {
      const { data: sessionData } = await window.supabaseClient.auth.getSession();
      if (sessionData?.session?.user) {
        currentUser = sessionData.session.user;
        updateUserUI();
        fetchMeetingHistory();
      } else {
        updateUserUI();
      }

      window.supabaseClient.auth.onAuthStateChange((event, session) => {
        currentUser = session?.user || null;
        updateUserUI();
        if (currentUser) fetchMeetingHistory();
      });
    } catch (e) {
      console.error("Auth init error:", e);
    }
  }

  async function getAuthToken() {
    if (window.supabaseClient && window.supabaseClient.auth) {
      try {
        const session = (await window.supabaseClient.auth.getSession())?.data?.session;
        if (session?.access_token) return session.access_token;
      } catch (e) {
        console.warn("Could not retrieve session token:", e);
      }
    }
    // Fallback to project anon key so guest users can execute edge functions
    return window.SUPABASE_ANON_KEY || "";
  }

  function updateUserUI() {
    if (currentUser) {
      if (userEmailDisplay) userEmailDisplay.textContent = currentUser.email;
      if (authActionButton) authActionButton.textContent = "Sign Out";
      if (!inputRecipientEmail.value) inputRecipientEmail.value = currentUser.email;
    } else {
      if (userEmailDisplay) userEmailDisplay.textContent = "Guest User";
      if (authActionButton) authActionButton.textContent = "Sign In";
    }
  }

  if (authActionButton) {
    authActionButton.addEventListener("click", () => {
      if (currentUser && window.supabaseClient?.auth) {
        window.supabaseClient.auth.signOut();
        showToast("Signed out successfully", "success");
      } else {
        openAuthModal();
      }
    });
  }

  function openAuthModal() {
    if (authModal) authModal.classList.add("open");
  }
  function closeAuthModal() {
    if (authModal) authModal.classList.remove("open");
  }
  if (btnCloseAuthModal) btnCloseAuthModal.addEventListener("click", closeAuthModal);

  if (authForm) {
    authForm.addEventListener("submit", async (e) => {
      e.preventDefault();
      const email = authEmail.value.trim();
      const password = authPassword.value.trim();

      if (!window.supabaseClient || !window.supabaseClient.auth) {
        showToast("Supabase client is not initialized. Check app/supabase-config.js credentials.", "error");
        return;
      }

      try {
        let { data, error } = await window.supabaseClient.auth.signInWithPassword({ email, password });
        if (error) {
          // Try signing up if account does not exist
          const signupRes = await window.supabaseClient.auth.signUp({ email, password });
          if (signupRes.error) throw signupRes.error;
          showToast("Account created! Logged in.", "success");
        } else {
          showToast("Signed in successfully!", "success");
        }
        closeAuthModal();
      } catch (err) {
        showToast(err.message || "Authentication failed", "error");
      }
    });
  }

  // ==========================================
  // 3. AUDIO SOURCE SELECTION
  // ==========================================
  // Handle card select for Speaker / Mic
  if (sourceMicCard) {
    sourceMicCard.addEventListener("click", () => {
      sourceMicCard.classList.add("selected");
      if (sourceDropdownCard) sourceDropdownCard.classList.remove("selected");
      selectedAudioSource = "speaker_mic";
      if (audioSourceDropdown) audioSourceDropdown.value = "";
      if (fileUploadPanel) fileUploadPanel.style.display = "none";
    });
  }

  // Handle dropdown selection for System Audio / File Upload
  if (audioSourceDropdown) {
    audioSourceDropdown.addEventListener("change", (e) => {
      const val = e.target.value;
      if (!val) return;
      selectedAudioSource = val;
      if (sourceMicCard) sourceMicCard.classList.remove("selected");
      if (sourceDropdownCard) sourceDropdownCard.classList.add("selected");
      if (fileUploadPanel) {
        fileUploadPanel.style.display = selectedAudioSource === "file_upload" ? "block" : "none";
      }
    });

    // Handle clicking the dropdown card wrapper to trigger select box focus
    if (sourceDropdownCard) {
      sourceDropdownCard.addEventListener("click", (e) => {
        if (e.target !== audioSourceDropdown) {
          audioSourceDropdown.focus();
        }
      });
    }
  }

  // ==========================================
  // 4. RECORDING & AUDIO CAPTURE CONTROLLER
  // ==========================================
  if (btnStartRecord) {
    btnStartRecord.addEventListener("click", async () => {
      if (!inputMeetingTitle.value.trim()) {
        showToast("Please enter a Meeting Title before recording", "error");
        inputMeetingTitle.focus();
        return;
      }

      if (selectedAudioSource === "file_upload") {
        const file = audioFileInput.files[0];
        if (!file) {
          showToast("Please choose an audio file to upload", "error");
          return;
        }
        await processAudioFile(file);
        return;
      }

      try {
        activeAudioCapturer = new window.AudioCapturer();
        updateCaptureStatus("recording", "Recording...");

        btnStartRecord.style.display = "none";
        btnPauseRecord.style.display = "inline-flex";
        btnStopRecord.style.display = "inline-flex";

        // Trigger silent audio loop and request wake lock to run in background on mobile
        startSilentAudio();
        await requestWakeLock();

        await activeAudioCapturer.startRecording(selectedAudioSource, {
          onTick: (elapsedSeconds) => {
            currentRecordingDuration = elapsedSeconds;
            if (timerDisplay) timerDisplay.textContent = formatDuration(elapsedSeconds);
          },
          onWaveform: (level) => {
            animateWaveformBars(level);
          }
        });

        showToast("Meeting recording started!", "success");
      } catch (err) {
        console.error("Recording error:", err);
        stopSilentAudio();
        releaseWakeLock();
        updateCaptureStatus("completed", "Ready");
        showToast(err.message || "Failed to start recording", "error");
        resetRecordButtons();
      }
    });
  }

  if (btnPauseRecord) {
    btnPauseRecord.addEventListener("click", () => {
      if (!activeAudioCapturer) return;

      if (activeAudioCapturer.isPaused) {
        activeAudioCapturer.resumeRecording();
        btnPauseRecord.innerHTML = "<span>⏸️</span> Pause";
        updateCaptureStatus("recording", "Recording...");
      } else {
        activeAudioCapturer.pauseRecording();
        btnPauseRecord.innerHTML = "<span>▶️</span> Resume";
        updateCaptureStatus("transcribing", "Paused");
      }
    });
  }

  if (btnStopRecord) {
    btnStopRecord.addEventListener("click", async () => {
      if (!activeAudioCapturer) return;

      try {
        updateCaptureStatus("transcribing", "Finalizing Recording...");
        // Stop background silent playback and wake lock
        stopSilentAudio();
        releaseWakeLock();
        const result = await activeAudioCapturer.stopRecording();
        resetRecordButtons();

        await processAudioBlob(result.blob, result.durationSeconds);
      } catch (err) {
        console.error("Stop recording error:", err);
        stopSilentAudio();
        releaseWakeLock();
        showToast(err.message || "Failed to stop recording", "error");
        resetRecordButtons();
        updateCaptureStatus("completed", "Ready");
      }
    });
  }

  function resetRecordButtons() {
    if (btnStartRecord) btnStartRecord.style.display = "inline-flex";
    if (btnPauseRecord) btnPauseRecord.style.display = "none";
    if (btnStopRecord) btnStopRecord.style.display = "none";
  }

  function updateCaptureStatus(statusClass, labelText) {
    if (captureStatusBadge) {
      captureStatusBadge.className = `status-badge status-${statusClass}`;
      captureStatusBadge.textContent = labelText;
    }
  }

  function formatDuration(totalSeconds) {
    const hrs = Math.floor(totalSeconds / 3600);
    const mins = Math.floor((totalSeconds % 3600) / 60);
    const secs = totalSeconds % 60;
    return [hrs, mins, secs].map(v => v < 10 ? `0${v}` : v).join(":");
  }

  function animateWaveformBars(frequencies) {
    waveformBars.forEach((bar, idx) => {
      let val = 0;
      if (Array.isArray(frequencies)) {
        val = frequencies[idx] || 0; // Value from 0 to 255
      } else {
        val = frequencies || 0; // Fallback to single level number
      }
      
      // Scale frequency value (0-255) to bar height (8px to 48px)
      const height = Math.max(8, Math.min(48, Math.round((val / 255) * 40) + 8));
      bar.style.height = `${height}px`;
      if (val > 10) {
        bar.classList.add("active");
      } else {
        bar.classList.remove("active");
      }
    });
  }

  // ==========================================
  // 5. AI TRANSCRIPTION & SUMMARIZATION PIPELINE
  // ==========================================
  async function processAudioBlob(audioBlob, durationSeconds) {
    updateAIStatus("🚀 Uploading audio to Groq Whisper Speech-to-Text API...");
    updateCaptureStatus("transcribing", "Transcribing...");

    try {
      const accessToken = await getAuthToken();
      const supabaseUrl = window.SUPABASE_URL || "";

      if (!supabaseUrl || !supabaseUrl.startsWith("https://")) {
        throw new Error("Supabase not configured. Go to ⚙️ Settings tab → enter your Project URL and Anon Key → Save.");
      }

      // Determine file extension from mimeType
      const mimeType = audioBlob.type || "audio/webm";
      let ext = "webm";
      if (mimeType.includes("mp4") || mimeType.includes("m4a")) ext = "mp4";
      else if (mimeType.includes("ogg")) ext = "ogg";
      else if (mimeType.includes("wav")) ext = "wav";
      else if (mimeType.includes("mpeg") || mimeType.includes("mp3")) ext = "mp3";

      // Step 1: Send audio as multipart FormData (avoids base64 issues)
      const formData = new FormData();
      formData.append("file", audioBlob, `meeting_audio.${ext}`);

      updateAIStatus(`🚀 Uploading ${(audioBlob.size / (1024*1024)).toFixed(1)} MB audio file to transcription API...`);

      const transcribeRes = await fetch(`${supabaseUrl}/functions/v1/transcribe-audio`, {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${accessToken}`
          // Do NOT set Content-Type — browser sets it automatically with boundary for FormData
        },
        body: formData
      });

      if (!transcribeRes.ok) {
        let errMsg = "Transcription failed";
        try { 
          const errJson = await transcribeRes.json(); 
          errMsg = errJson.error || errJson.message || errMsg; 
        } catch {}
        throw new Error(errMsg);
      }

      const transcribeData = await transcribeRes.json();
      const rawTranscript = transcribeData.transcript || "";

      updateAIStatus(`✅ Transcription Complete (${rawTranscript.length} characters).\n\n🤖 Generating AI Meeting Summary via Groq Llama 3.3...`);
      updateCaptureStatus("transcribing", "Summarizing...");

      // Step 2: Summarize via Edge Function
      const title = inputMeetingTitle.value.trim() || "Meeting";
      const attendees = inputMeetingAttendees.value.split(",").map(a => a.trim()).filter(Boolean);

      const summarizeRes = await fetch(`${supabaseUrl}/functions/v1/summarize-meeting`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${accessToken}`
        },
        body: JSON.stringify({
          title,
          transcript: rawTranscript,
          attendees
        })
      });

      if (!summarizeRes.ok) {
        let errMsg = "Summarization failed";
        try { 
          const errJson = await summarizeRes.json(); 
          errMsg = errJson.error || errJson.message || errMsg; 
        } catch {}
        throw new Error(errMsg);
      }

      const summaryData = await summarizeRes.json();

      updateAIStatus(`🎉 AI Summary Generated Successfully!\n\n📌 Executive Summary: ${summaryData.summary}`);
      updateCaptureStatus("completed", "Completed");

      // Step 3: Save to Supabase Database
      const recipientEmail = inputRecipientEmail.value.trim();

      const newMeetingRecord = {
        title: title,
        source: selectedAudioSource,
        status: "completed",
        duration_seconds: durationSeconds || Math.round(audioBlob.size / 16000),
        raw_transcript: rawTranscript,
        summary: summaryData.summary,
        key_takeaways: summaryData.key_takeaways || [],
        action_points: summaryData.action_points || [],
        attendees: attendees,
        recipient_email: recipientEmail,
      };

      if (currentUser && window.supabaseClient) {
        const { data: dbData, error: dbErr } = await window.supabaseClient
          .from("meetings")
          .insert([{ ...newMeetingRecord, user_id: currentUser.id }])
          .select();

        if (dbErr) console.error("Database insert error:", dbErr);
        if (dbData && dbData.length > 0) {
          currentMeeting = dbData[0];
        } else {
          currentMeeting = newMeetingRecord;
        }
      } else {
        currentMeeting = newMeetingRecord;
      }

      showToast("Meeting transcribed and summarized!", "success");

      // Automatically open detail modal
      openMeetingDetailModal(currentMeeting);

    } catch (err) {
      console.error("AI Pipeline error:", err);
      updateAIStatus(`❌ Error in AI Pipeline: ${err.message}`);
      updateCaptureStatus("completed", "Error");
      showToast(err.message || "Failed to process meeting audio", "error");
    }
  }

  async function processAudioFile(file) {
    updateAIStatus(`📁 Processing uploaded file: ${file.name}...`);
    updateCaptureStatus("transcribing", "Transcribing File...");
    const durationEstimate = Math.round(file.size / (128 * 1024 / 8));
    await processAudioBlob(file, durationEstimate);
  }

  function updateAIStatus(text) {
    if (aiStatusBox) aiStatusBox.textContent = text;
  }

  // ==========================================
  // 6. MEETING HISTORY & DATABASE FETCHING
  // ==========================================
  async function fetchMeetingHistory() {
    if (!meetingHistoryTableBody) return;
    meetingHistoryTableBody.innerHTML = `<tr><td colspan="6" style="text-align: center; color: var(--text-muted); padding: 30px;">Loading meeting records...</td></tr>`;

    if (!currentUser || !window.supabaseClient) {
      meetingHistoryTableBody.innerHTML = `<tr><td colspan="6" style="text-align: center; color: var(--text-muted); padding: 30px;">Sign in to view saved meetings history.</td></tr>`;
      return;
    }

    try {
      const { data, error } = await window.supabaseClient
        .from("meetings")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) throw error;

      userMeetingsList = data || [];

      if (userMeetingsList.length === 0) {
        meetingHistoryTableBody.innerHTML = `<tr><td colspan="6" style="text-align: center; color: var(--text-muted); padding: 30px;">No saved meetings yet. Record your first meeting in the Live Studio tab.</td></tr>`;
        return;
      }

      meetingHistoryTableBody.innerHTML = userMeetingsList.map((m) => {
        const dateStr = new Date(m.created_at).toLocaleDateString();
        const durationMins = Math.round((m.duration_seconds || 0) / 60);

        return `
          <tr>
            <td><strong>${escapeHtml(m.title)}</strong></td>
            <td style="font-size: 13px; color: var(--text-muted);">${dateStr}</td>
            <td><span class="status-badge" style="background: rgba(255,255,255,0.05);">${escapeHtml(m.source || 'speaker_mic')}</span></td>
            <td>${durationMins} mins</td>
            <td><span class="status-badge status-completed">${escapeHtml(m.status)}</span></td>
            <td style="text-align: right;">
              <button class="btn-secondary btn-sm" onclick="window.viewMeetingDetail('${m.id}')" style="padding: 4px 10px; font-size: 12px;">View Minutes</button>
            </td>
          </tr>
        `;
      }).join("");
    } catch (err) {
      console.error("Fetch history error:", err);
      meetingHistoryTableBody.innerHTML = `<tr><td colspan="6" style="text-align: center; color: var(--accent-rose); padding: 20px;">Failed to load meeting history: ${err.message}</td></tr>`;
    }
  }

  if (btnRefreshHistory) {
    btnRefreshHistory.addEventListener("click", fetchMeetingHistory);
  }

  window.viewMeetingDetail = (meetingId) => {
    const target = userMeetingsList.find(m => m.id === meetingId);
    if (target) {
      openMeetingDetailModal(target);
    }
  };

  // ==========================================
  // 7. MEETING MINUTES DETAIL MODAL & EXPORTS
  // ==========================================
  function openMeetingDetailModal(meeting) {
    currentMeeting = meeting;
    if (!meetingDetailModal) return;

    modalMeetingTitle.textContent = meeting.title || "Meeting Summary";
    const dateStr = meeting.created_at ? new Date(meeting.created_at).toLocaleString() : new Date().toLocaleString();
    modalMeetingDate.textContent = `Captured on ${dateStr} • Duration: ${Math.round((meeting.duration_seconds || 0) / 60)} mins`;

    modalSummaryBox.textContent = meeting.summary || "No executive summary available.";

    // Render Takeaways
    if (meeting.key_takeaways && Array.isArray(meeting.key_takeaways) && meeting.key_takeaways.length > 0) {
      modalTakeawaysBox.innerHTML = `<ul style="padding-left: 20px; color: var(--text-main); font-size: 14px;">` +
        meeting.key_takeaways.map(t => `<li style="margin-bottom: 6px;">${escapeHtml(t)}</li>`).join("") +
        `</ul>`;
    } else {
      modalTakeawaysBox.textContent = "No key takeaways captured.";
    }

    // Render Action Points
    if (meeting.action_points && Array.isArray(meeting.action_points) && meeting.action_points.length > 0) {
      modalActionPointsBox.innerHTML = `
        <table style="width: 100%; border-collapse: collapse; font-size: 13px;">
          <thead>
            <tr style="border-bottom: 1px solid var(--border-subtle); color: var(--text-muted); text-align: left;">
              <th style="padding: 8px;">Task</th>
              <th style="padding: 8px;">Assignee</th>
              <th style="padding: 8px;">Due Date</th>
            </tr>
          </thead>
          <tbody>
            ${meeting.action_points.map(ap => `
              <tr style="border-bottom: 1px solid var(--border-subtle);">
                <td style="padding: 8px;">${escapeHtml(ap.task || ap)}</td>
                <td style="padding: 8px; color: var(--accent-cyan);">${escapeHtml(ap.assignee || 'Unassigned')}</td>
                <td style="padding: 8px; color: var(--text-muted);">${escapeHtml(ap.due_date || 'TBD')}</td>
              </tr>
            `).join("")}
          </tbody>
        </table>
      `;
    } else {
      modalActionPointsBox.textContent = "No action items generated.";
    }

    modalTranscriptBox.textContent = meeting.raw_transcript || "No transcript text.";

    meetingDetailModal.classList.add("open");
  }

  function closeMeetingDetailModal() {
    if (meetingDetailModal) meetingDetailModal.classList.remove("open");
  }
  if (btnCloseDetailModal) btnCloseDetailModal.addEventListener("click", closeMeetingDetailModal);

  // Word Export
  if (btnExportWord) {
    btnExportWord.addEventListener("click", async () => {
      if (!currentMeeting) return;
      try {
        showToast("Generating Word Document (.docx)...", "success");
        const docBlob = await window.DocExporter.generateWordDoc(currentMeeting);
        const fileName = `${(currentMeeting.title || "Meeting").replace(/[^a-zA-Z0-9]/g, "_")}_Minutes.docx`;
        window.DocExporter.downloadBlob(docBlob, fileName);
      } catch (err) {
        showToast(`Failed to export Word doc: ${err.message}`, "error");
      }
    });
  }

  // PDF Export
  if (btnExportPdf) {
    btnExportPdf.addEventListener("click", async () => {
      if (!currentMeeting) return;
      try {
        showToast("Generating PDF Document (.pdf)...", "success");
        const pdfBlob = await window.DocExporter.generatePdfDoc(currentMeeting);
        const fileName = `${(currentMeeting.title || "Meeting").replace(/[^a-zA-Z0-9]/g, "_")}_Minutes.pdf`;
        window.DocExporter.downloadBlob(pdfBlob, fileName);
      } catch (err) {
        showToast(`Failed to export PDF: ${err.message}`, "error");
      }
    });
  }

  // Email Report Dispatch
  if (btnSendEmailReport) {
    btnSendEmailReport.addEventListener("click", async () => {
      if (!currentMeeting) return;

      const recipient = prompt("Enter email address to send report to:", currentMeeting.recipient_email || (currentUser ? currentUser.email : ""));
      if (!recipient) return;

      await sendEmailReport(currentMeeting, recipient);
    });
  }

  async function sendEmailReport(meeting, recipientEmail) {
    showToast(`Sending email meeting report to ${recipientEmail}...`, "success");

    try {
      // Generate DOCX attachment base64
      const docBlob = await window.DocExporter.generateWordDoc(meeting);
      const docBase64 = await window.DocExporter.blobToBase64(docBlob);

      const accessToken = await getAuthToken();
      const supabaseUrl = window.SUPABASE_URL || "";

      if (!supabaseUrl || supabaseUrl.includes("your-project")) {
        throw new Error("Supabase Project URL is not configured. Please update app/supabase-config.js with your project credentials.");
      }

      const emailRes = await fetch(`${supabaseUrl}/functions/v1/send-meeting-report`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${accessToken}`
        },
        body: JSON.stringify({
          recipientEmail: recipientEmail,
          meeting: meeting,
          attachments: [
            {
              filename: `${(meeting.title || "Meeting").replace(/[^a-zA-Z0-9]/g, "_")}_Minutes.docx`,
              contentBase64: docBase64
            }
          ]
        })
      });

      if (!emailRes.ok) {
        let errMsg = "Email dispatch failed";
        try {
          const errJson = await emailRes.json();
          errMsg = errJson.error || errJson.message || errMsg;
        } catch {}
        throw new Error(errMsg);
      }

      showToast(`Email report delivered to ${recipientEmail}!`, "success");
    } catch (err) {
      console.error("Send email error:", err);
      showToast(`Failed to send email report: ${err.message}`, "error");
    }
  }

  // ==========================================
  // 8. SETTINGS FORM HANDLER
  // ==========================================

  function updateConnectionBadge() {
    const badge = document.getElementById("supabaseConnectionBadge");
    if (!badge) return;
    if (window.supabaseClient) {
      badge.style.background = "rgba(16,185,129,0.15)";
      badge.style.color = "#10b981";
      badge.style.border = "1px solid rgba(16,185,129,0.3)";
      badge.textContent = "✅ Connected";
    } else {
      badge.style.background = "rgba(244,63,94,0.15)";
      badge.style.color = "#f43f5e";
      badge.style.border = "1px solid rgba(244,63,94,0.3)";
      badge.textContent = "⚡ Not Connected";
    }
  }

  function loadSettingsIntoForm() {
    const savedEmail = localStorage.getItem("meetingassistant_default_email") || "";
    const emailInput = document.getElementById("settingDefaultEmail");
    if (emailInput) emailInput.value = savedEmail;

    const savedProvider = localStorage.getItem("ma_ai_provider") || "groq";
    const savedKey = localStorage.getItem("ma_ai_api_key") || "";
    const savedModel = localStorage.getItem("ma_ai_model") || "llama-3.3-70b-versatile";

    const providerSelect = document.getElementById("settingActiveProvider");
    const keyInput = document.getElementById("settingCustomApiKey");
    const keyGroup = document.getElementById("customApiKeyGroup");
    const modelSelect = document.getElementById("settingActiveModel");

    if (providerSelect) {
      providerSelect.value = savedProvider;
      providerSelect.addEventListener("change", () => {
        const provider = providerSelect.value;
        if (keyGroup) {
          keyGroup.style.display = provider === "groq" ? "none" : "block";
        }
        
        // Populate appropriate model options
        if (modelSelect) {
          modelSelect.innerHTML = "";
          if (provider === "groq") {
            modelSelect.innerHTML = `<option value="llama-3.3-70b-versatile" selected>Llama 3.3 70B (Groq)</option>`;
          } else if (provider === "openai") {
            modelSelect.innerHTML = `
              <option value="gpt-4o" selected>GPT-4o (OpenAI)</option>
              <option value="gpt-4-turbo">GPT-4 Turbo</option>
            `;
          } else if (provider === "anthropic") {
            modelSelect.innerHTML = `
              <option value="claude-3-5-sonnet-20241022" selected>Claude 3.5 Sonnet (Anthropic)</option>
              <option value="claude-3-haiku-20240307">Claude 3 Haiku</option>
            `;
          }
        }
      });
      // Trigger toggle logic once on load
      providerSelect.dispatchEvent(new Event("change"));
    }

    if (keyInput) keyInput.value = savedKey;
    if (modelSelect) modelSelect.value = savedModel;
  }

  const appSettingsForm = document.getElementById("appSettingsForm");
  if (appSettingsForm) {
    appSettingsForm.addEventListener("submit", (e) => {
      e.preventDefault();

      const emailInput = document.getElementById("settingDefaultEmail");
      const defaultEmail = emailInput ? emailInput.value.trim() : "";

      const providerSelect = document.getElementById("settingActiveProvider");
      const keyInput = document.getElementById("settingCustomApiKey");
      const modelSelect = document.getElementById("settingActiveModel");

      const provider = providerSelect ? providerSelect.value : "groq";
      const customKey = keyInput ? keyInput.value.trim() : "";
      const model = modelSelect ? modelSelect.value : "llama-3.3-70b-versatile";

      localStorage.setItem("ma_ai_provider", provider);
      localStorage.setItem("ma_ai_api_key", customKey);
      localStorage.setItem("ma_ai_model", model);

      if (defaultEmail) {
        localStorage.setItem("meetingassistant_default_email", defaultEmail);
        if (inputRecipientEmail) inputRecipientEmail.value = defaultEmail;
      }
      
      showToast("Settings and AI connections saved successfully!", "success");
    });
  }

  // Populate settings form from saved values on startup
  loadSettingsIntoForm();
  updateConnectionBadge();

  // Helper Utility
  function showToast(message, type = "success") {
    if (!toastContainer) return;
    const toast = document.createElement("div");
    toast.className = `toast ${type}`;
    toast.innerHTML = `<span>${type === 'success' ? '✅' : '⚠️'}</span> <div>${escapeHtml(message)}</div>`;
    toastContainer.appendChild(toast);
    setTimeout(() => {
      toast.remove();
    }, 4000);
  }

  function escapeHtml(str) {
    if (typeof str !== "string") return str;
    return str.replace(/[&<>"']/g, function (m) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' }[m];
    });
  }

  // Initialize Auth
  initAuth();
});
