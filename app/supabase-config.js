// Supabase Client Credentials Configuration
// Replace SUPABASE_URL and SUPABASE_ANON_KEY with your project credentials.

const SUPABASE_URL = window.SUPABASE_URL || "https://your-project.supabase.co";
const SUPABASE_ANON_KEY = window.SUPABASE_ANON_KEY || "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.sample";

// Initialize and attach global window.supabaseClient instance
if (window.supabase) {
  window.supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
} else {
  console.warn("Supabase SDK script not loaded yet.");
  window.supabaseClient = null;
}
