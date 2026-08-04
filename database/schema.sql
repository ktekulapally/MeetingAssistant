-- ========================================================
-- MeetingAssistant Postgres Database Schema & RLS Policies
-- ========================================================

-- Enable UUID extension if not already enabled
create extension if not exists "uuid-ossp";

-- 1. Create meetings table
create table if not exists public.meetings (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  title text not null,
  source text not null default 'speaker_mic', -- 'speaker_mic', 'system_audio', 'file_upload', 'teams_zoom'
  status text not null default 'completed',  -- 'recording', 'transcribing', 'summarizing', 'completed', 'failed'
  duration_seconds integer not null default 0,
  raw_transcript text,
  formatted_transcript jsonb not null default '[]'::jsonb,
  summary text,
  key_takeaways jsonb not null default '[]'::jsonb,
  action_points jsonb not null default '[]'::jsonb, -- array of { task, assignee, due_date, status }
  attendees jsonb not null default '[]'::jsonb,      -- array of string names
  recipient_email text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- 2. Enable Row Level Security (RLS)
alter table public.meetings enable row level security;

-- 3. Create RLS policy enforcing database-level user isolation
drop policy if exists "Users manage own meetings" on public.meetings;
create policy "Users manage own meetings"
  on public.meetings
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- 4. Create trigger to update updated_at timestamp
create or replace function public.handle_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql security definer;

drop trigger if exists set_meetings_updated_at on public.meetings;
create trigger set_meetings_updated_at
  before update on public.meetings
  for each row execute function public.handle_updated_at();

-- 5. Create index for fast listing ordered by date
create index if not exists idx_meetings_user_id_created_at 
  on public.meetings (user_id, created_at desc);
