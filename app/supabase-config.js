// ================================================================
// MeetingAssistant - Supabase Runtime Configuration
// ================================================================
// Credentials are loaded from:
//   1. Browser localStorage (set via the Settings tab in the app UI)
//   2. Fallback: these hardcoded defaults below (if not yet saved)
// You do NOT need to edit this file manually.
// Instead, open the app → Settings tab → enter your credentials → Save.
// ================================================================

(function initSupabase() {
  // Try to load saved credentials from browser localStorage first
  const savedUrl = localStorage.getItem("ma_supabase_url") || "";
  const savedKey = localStorage.getItem("ma_supabase_anon_key") || "";

  window.SUPABASE_URL = savedUrl || "";
  window.SUPABASE_ANON_KEY = savedKey || "";

  if (window.supabase && window.SUPABASE_URL && window.SUPABASE_URL.startsWith("https://")) {
    try {
      window.supabaseClient = window.supabase.createClient(window.SUPABASE_URL, window.SUPABASE_ANON_KEY);
      console.log("Supabase client initialized successfully.");
    } catch (e) {
      console.warn("Failed to initialize Supabase client:", e);
      window.supabaseClient = null;
    }
  } else {
    console.warn("Supabase credentials not configured. Use the Settings tab to enter your Project URL and Anon Key.");
    window.supabaseClient = null;
  }
})();
