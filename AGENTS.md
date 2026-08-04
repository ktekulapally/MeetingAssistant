# MeetingAssistant Architectural Blueprint & Memory Reference

This repository is built following the **Personal-Ledger** zero-build-step cloud architecture. Refer to the master blueprint guide for design standards and stack requirements.

## Core Stack & Principles

1. **Zero Build Step Frontend**:
   - Plain HTML5, Vanilla CSS3 (CSS variables for multi-theme support), and Vanilla JS (ES6+ async/await).
   - No React/Vue/Vite/Webpack required — loads instantly and deploys directly to GitHub Pages.

2. **Database & Security**:
   - Supabase (Postgres) + Supabase Auth.
   - Database-enforced **Row Level Security (RLS)** on `public.meetings` (`auth.uid() = user_id`). Security logic is NEVER trusted to client-side JS alone.

3. **Serverless Compute & AI**:
   - Supabase Edge Functions (Deno / TS) keep secrets (`GROQ_API_KEY`, `RESEND_API_KEY`) secure.
   - Groq Whisper (`whisper-large-v3`) speech-to-text transcription.
   - Groq API (`llama-3.3-70b-versatile`) structured AI meeting summarization (Executive Summary, Key Takeaways, Action Points with Assignees & Deadlines).

4. **Document Generation & Email Delivery**:
   - Microsoft Word (`.docx`) export via `docx.js` and PDF (`.pdf`) export via `jsPDF`.
   - Transactional email dispatch of meeting minutes and document attachments via Resend API Edge Function.

5. **PWA & Mobile Ready**:
   - Web App Manifest (`manifest.json`) + Service Worker (`service-worker.js`) for native-like home screen installation.

6. **Idle Session Guard**:
   - Centralized `session-guard.js` enforcing 60-minute auto-logout on inactive browser tabs.
