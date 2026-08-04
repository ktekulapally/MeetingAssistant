# MeetingAssistant Technical Architecture

This document describes the architectural flow, component interaction, security model, and extensibility patterns of the **MeetingAssistant** application.

---

## 1. System Context & Flow Diagram

```
+-----------------------------------------------------------------------------------+
|                                  BROWSER CLIENT                                   |
|                                                                                   |
|  +--------------------+   +-----------------------+   +------------------------+  |
|  |   AudioCapturer    |   |     DocExporter       |   |      Session Guard     |  |
|  |  - Speaker/Mic     |   |  - docx.js (.docx)    |   |  - 60-min Auto Logout  |  |
|  |  - System Audio    |   |  - jsPDF (.pdf)       |   +------------------------+  |
|  |  - File Upload     |   +-----------------------+                               |
|  +---------+----------+                                                           |
|            | MediaRecorder (WebM / WAV blob)                                      |
+------------|----------------------------------------------------------------------+
             |
             | POST /functions/v1/transcribe-audio (JWT Token)
             v
+-----------------------------------------------------------------------------------+
|                            SUPABASE EDGE FUNCTIONS                                |
|                                                                                   |
|  +---------------------------+   +--------------------------+   +--------------+  |
|  |    transcribe-audio       |   |    summarize-meeting     |   | send-report  |  |
|  | - Calls Groq Whisper API  |   | - Calls Groq Llama 3.3   |   | - Resend API |  |
|  +-------------+-------------+   +------------+-------------+   +-------+------+  |
+----------------|------------------------------|-------------------------|---------+
                 |                              |                         |
                 v                              v                         v
          +--------------+              +---------------+         +---------------+
          |  Groq Speech |              | Groq LLM API  |         |   Resend API  |
          | (Whisper v3) |              | (Llama 3.3)   |         |   (Email)     |
          +--------------+              +---------------+         +---------------+
```

---

## 2. Database & RLS Enforcement

The database uses PostgreSQL Row Level Security (RLS) policies enforcing `auth.uid() = user_id`.

```sql
create table public.meetings (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  title text not null,
  source text not null default 'speaker_mic',
  status text not null default 'completed',
  duration_seconds integer default 0,
  raw_transcript text,
  formatted_transcript jsonb default '[]'::jsonb,
  summary text,
  key_takeaways jsonb default '[]'::jsonb,
  action_points jsonb default '[]'::jsonb,
  attendees jsonb default '[]'::jsonb,
  recipient_email text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.meetings enable row level security;

create policy "Users manage own meetings"
  on public.meetings
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
```

---

## 3. Extensibility Architecture (Microsoft Teams & Zoom)

`MeetingAssistant` is designed with an extensible `AudioStreamAdapter` contract:

```javascript
class AudioStreamAdapter {
  async initialize() { /* set up stream */ }
  async getMediaStream() { /* return MediaStream */ }
  async stop() { /* cleanup */ }
}
```

Future integrations implement this interface:
1. **TeamsStreamAdapter**: Connects to Microsoft Teams Web SDK / Graph API Communications Call Bot.
2. **ZoomStreamAdapter**: Connects to Zoom Web SDK / Real-time Audio Stream Webhooks.
