// Supabase Client Credentials Configuration
// Replace SUPABASE_URL and SUPABASE_ANON_KEY with your project credentials.

window.SUPABASE_URL = window.SUPABASE_URL || "https://your-project.supabase.co";
window.SUPABASE_ANON_KEY = window.SUPABASE_ANON_KEY || "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.sample";

// Initialize and attach global window.supabaseClient instance
if (window.supabase && window.SUPABASE_URL && !window.SUPABASE_URL.includes("your-project")) {
  try {
    window.supabaseClient = window.supabase.createClient(window.SUPABASE_URL, window.SUPABASE_ANON_KEY);
  } catch (e) {
    console.warn("Failed to initialize Supabase client:", e);
    window.supabaseClient = null;
  }
} else {
  console.warn("Supabase SDK or valid project credentials not configured yet.");
  window.supabaseClient = null;
}
