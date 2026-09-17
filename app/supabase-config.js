// ================================================================
// MeetingAssistant - Supabase Runtime Configuration
// ================================================================
// Hardcode your actual Supabase URL and Anon Key here to share them
// across all your devices automatically (similar to Expense-tracker):
// ================================================================
const HARDCODED_URL = "https://zmklfmlppceiulaybjga.supabase.co";
const HARDCODED_KEY = "";

(function initSupabase() {
  // Use saved credentials from browser localStorage, or fallback to the hardcoded credentials
  const savedUrl = localStorage.getItem("ma_supabase_url") || HARDCODED_URL;
  const savedKey = localStorage.getItem("ma_supabase_anon_key") || HARDCODED_KEY;

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
