# MeetingAssistant 🎙️🤖

> **AI-Powered Meeting Capture, Live Transcription, Automated Summarization, Word/PDF Document Generation & Email Distribution Tool**

Built on the **Personal-Ledger** zero-build-step cloud architecture (Vanilla HTML5/CSS3/JS + Supabase Postgres/Auth + Supabase Deno Edge Functions + Groq AI + Resend API).

---

## 🌟 Key Features

1. **Flexible Meeting Audio Capture**:
   - **Laptop & Bluetooth Speaker Capture**: Microphone room acoustics capture.
   - **Direct Laptop / Speaker Audio Stream**: System loopback capture (`getDisplayMedia` with system audio).
   - **Audio File Upload**: Upload `.mp3`, `.wav`, `.m4a`, or `.webm` files for offline processing.
   - **Extensible Stream Architecture**: `AudioStreamAdapter` foundation ready for Microsoft Teams and Zoom call integration.

2. **AI Speech Transcription & Summarization**:
   - **Whisper Transcription**: High-accuracy speech-to-text powered by Groq `whisper-large-v3`.
   - **Structured AI Insights**: Powered by Groq `llama-3.3-70b-versatile` producing:
     - 📌 **Executive Summary**
     - 💡 **Key Takeaways**
     - ✅ **Action Points** with Assignees & Due Dates
     - 🗣️ **Discussion Topic Breakdown**

3. **Document Export & Emailing**:
   - **Microsoft Word (`.docx`) Export**: Cleanly styled Word document.
   - **PDF (`.pdf`) Export**: Beautifully formatted PDF meeting minutes.
   - **Automated Email Sharing**: Direct email delivery to configured recipient address via Resend API.

4. **Security & Deployment**:
   - **Zero-Trust Security**: Postgres Row Level Security (RLS) guarantees users can only access their own meetings.
   - **Zero Build Pipeline**: Plain HTML5/CSS3/JS, deploys directly to GitHub Pages.
   - **Session Security**: Centralized 60-minute idle auto-logout guard (`session-guard.js`).

---

## 🚀 Quick Setup & Deployment Guide

### 1. Database Setup (Supabase)
Run the SQL script located in [`database/schema.sql`](file:///d:/MeetingAssistant/database/schema.sql) in your Supabase SQL Editor:
- Creates `public.meetings` table.
- Enables Row Level Security (RLS).
- Creates RLS policies enforcing `auth.uid() = user_id`.

### 2. Configure Credentials
Update [`app/supabase-config.js`](file:///d:/MeetingAssistant/app/supabase-config.js) with your project credentials:
```javascript
const SUPABASE_URL = "https://your-project.supabase.co";
const SUPABASE_ANON_KEY = "your-anon-key";
```

### 3. Deploy Supabase Edge Functions & Set Secrets
Deploy the Deno edge functions using the Supabase CLI:

```bash
# Set API Key Secrets
supabase secrets set GROQ_API_KEY=gsk_your_groq_api_key
supabase secrets set RESEND_API_KEY=re_your_resend_api_key

# Deploy Functions
supabase functions deploy transcribe-audio
supabase functions deploy summarize-meeting
supabase functions deploy send-meeting-report
```

---

## 📁 Repository Layout

```
MeetingAssistant/
├── app/
│   ├── index.html           # Single-page UI
│   ├── styles.css           # Vanilla CSS design system
│   ├── app.js               # Main application controller
│   ├── audio-capturer.js    # Audio stream & recording manager
│   ├── doc-exporter.js      # Word (.docx) & PDF (.pdf) generator
│   ├── supabase-config.js   # Supabase client setup
│   ├── session-guard.js     # Idle auto-logout guard
│   ├── manifest.json        # PWA Web App Manifest
│   └── service-worker.js    # Offline PWA service worker
├── database/
│   └── schema.sql           # Database table & RLS policies
├── supabase/
│   └── functions/
│       ├── transcribe-audio/    # Groq Whisper Edge Function
│       ├── summarize-meeting/   # Groq Llama 3.3 Edge Function
│       └── send-meeting-report/ # Resend Email Edge Function
├── docs/
│   └── ARCHITECTURE.md      # Architecture documentation
├── README.md
└── AGENTS.md
```
