// Centralized Idle Session Guard (60-minute auto-logout)

(function () {
  const IDLE_TIMEOUT_MS = 60 * 60 * 1000; // 60 minutes
  const CHECK_INTERVAL_MS = 60 * 1000;   // Check every 1 minute

  let lastActivityTime = Date.now();

  function resetActivityTimer() {
    lastActivityTime = Date.now();
  }

  // Activity event listeners
  const activityEvents = ["mousemove", "keydown", "click", "touchstart", "scroll"];
  activityEvents.forEach((event) => {
    window.addEventListener(event, resetActivityTimer, { passive: true });
  });

  // Periodic inactivity checker
  setInterval(async () => {
    const elapsed = Date.now() - lastActivityTime;
    if (elapsed >= IDLE_TIMEOUT_MS) {
      console.warn("User session timed out due to 60 minutes of inactivity.");
      if (window.supabaseClient && window.supabaseClient.auth) {
        try {
          await window.supabaseClient.auth.signOut();
        } catch (e) {
          console.error("Auto sign-out error:", e);
        }
      }
      alert("Your session has timed out due to 60 minutes of inactivity. Please sign in again.");
      window.location.reload();
    }
  }, CHECK_INTERVAL_MS);
})();
