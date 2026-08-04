// Supabase Client Credentials Configuration
// Replace SUPABASE_URL and SUPABASE_ANON_KEY with your project credentials.

const SUPABASE_URL = window.SUPABASE_URL || "https://zmklfmlppceiulaybjga.supabase.co";
const SUPABASE_ANON_KEY = window.SUPABASE_ANON_KEY || "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inpta2xmbWxwcGNlaXVsYXliamdhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODMwMDE3MTQsImV4cCI6MjA5ODU3NzcxNH0.XIQPpuEE1QeEcdbubDxd28hfB4dhMbmNy0QIYWkzrGg";

// Initialize global supabase client
let supabaseClient = null;

if (window.supabase) {
  supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
} else {
  console.warn("Supabase SDK not loaded yet. Make sure to include supabase-js script tag before this file.");
}
