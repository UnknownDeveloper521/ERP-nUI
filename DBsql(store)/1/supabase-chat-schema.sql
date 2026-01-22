-- Internal Chat Module schema (run in Supabase SQL editor)

-- Extensions
create extension if not exists pgcrypto;

-- =========================================================
-- 1) Users profile (ERP-specific metadata for auth.users)
-- =========================================================
create table if not exists public.users_profile (
  id uuid primary key references auth.users(id) on delete cascade,
  name text not null,
  department text,
  role text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_users_profile_department on public.users_profile(department);
create index if not exists idx_users_profile_role on public.users_profile(role);

-- Keep updated_at fresh
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_users_profile_updated_at on public.users_profile;
create trigger trg_users_profile_updated_at
before update on public.users_profile
for each row
execute function public.set_updated_at();

-- =========================================================
-- 2) Chat rooms + members
-- =========================================================
create table if not exists public.chat_rooms (
  id uuid primary key default gen_random_uuid(),
  type text not null check (type in ('private','group')),
  title text,
  created_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now()
);

create index if not exists idx_chat_rooms_created_at on public.chat_rooms(created_at desc);
create index if not exists idx_chat_rooms_created_by on public.chat_rooms(created_by);

create table if not exists public.chat_members (
  room_id uuid not null references public.chat_rooms(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  joined_at timestamptz not null default now(),
  last_seen_at timestamptz,
  primary key (room_id, user_id)
);

create index if not exists idx_chat_members_user_id on public.chat_members(user_id);
create index if not exists idx_chat_members_room_id on public.chat_members(room_id);

-- =========================================================
-- 3) Messages
-- =========================================================
create table if not exists public.messages (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references public.chat_rooms(id) on delete cascade,
  sender_id uuid not null references auth.users(id) on delete restrict,
  content text,
  file_url text,
  created_at timestamptz not null default now(),

  -- "seen" is kept for compatibility with the requirement.
  -- The server can set it true when all members have seen the message.
  seen boolean not null default false,
  seen_at timestamptz
);

create index if not exists idx_messages_room_created_at on public.messages(room_id, created_at desc);
create index if not exists idx_messages_sender_created_at on public.messages(sender_id, created_at desc);

-- Optional: per-user read receipts (recommended for enterprise scale)
create table if not exists public.message_reads (
  message_id uuid not null references public.messages(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  read_at timestamptz not null default now(),
  primary key (message_id, user_id)
);

create index if not exists idx_message_reads_user_id on public.message_reads(user_id);
create index if not exists idx_message_reads_message_id on public.message_reads(message_id);

-- =========================================================
-- RLS (Row Level Security)
-- =========================================================
alter table public.users_profile enable row level security;
alter table public.chat_rooms enable row level security;
alter table public.chat_members enable row level security;
alter table public.messages enable row level security;
alter table public.message_reads enable row level security;

-- USERS_PROFILE policies

drop policy if exists "users_profile_select_all" on public.users_profile;
create policy "users_profile_select_all"
on public.users_profile
for select
to authenticated
using (true);

drop policy if exists "users_profile_insert_own" on public.users_profile;
create policy "users_profile_insert_own"
on public.users_profile
for insert
to authenticated
with check (id = auth.uid());

drop policy if exists "users_profile_update_own" on public.users_profile;
create policy "users_profile_update_own"
on public.users_profile
for update
to authenticated
using (id = auth.uid())
with check (id = auth.uid());

-- CHAT_ROOMS policies

drop policy if exists "chat_rooms_select_if_member" on public.chat_rooms;
create policy "chat_rooms_select_if_member"
on public.chat_rooms
for select
to authenticated
using (
  exists (
    select 1
    from public.chat_members m
    where m.room_id = chat_rooms.id
      and m.user_id = auth.uid()
  )
);

drop policy if exists "chat_rooms_insert_authenticated" on public.chat_rooms;
create policy "chat_rooms_insert_authenticated"
on public.chat_rooms
for insert
to authenticated
with check (created_by = auth.uid());

-- CHAT_MEMBERS policies

drop policy if exists "chat_members_select_if_member" on public.chat_members;
create policy "chat_members_select_if_member"
on public.chat_members
for select
to authenticated
using (
  exists (
    select 1
    from public.chat_members m
    where m.room_id = chat_members.room_id
      and m.user_id = auth.uid()
  )
);

drop policy if exists "chat_members_insert_self" on public.chat_members;
create policy "chat_members_insert_self"
on public.chat_members
for insert
to authenticated
with check (user_id = auth.uid());

drop policy if exists "chat_members_update_self_seen" on public.chat_members;
create policy "chat_members_update_self_seen"
on public.chat_members
for update
to authenticated
using (user_id = auth.uid())
with check (user_id = auth.uid());

-- MESSAGES policies

drop policy if exists "messages_select_if_member" on public.messages;
create policy "messages_select_if_member"
on public.messages
for select
to authenticated
using (
  exists (
    select 1
    from public.chat_members m
    where m.room_id = messages.room_id
      and m.user_id = auth.uid()
  )
);

drop policy if exists "messages_insert_if_member" on public.messages;
create policy "messages_insert_if_member"
on public.messages
for insert
to authenticated
with check (
  sender_id = auth.uid()
  and exists (
    select 1
    from public.chat_members m
    where m.room_id = messages.room_id
      and m.user_id = auth.uid()
  )
);

-- MESSAGE_READS policies

drop policy if exists "message_reads_select_if_member" on public.message_reads;
create policy "message_reads_select_if_member"
on public.message_reads
for select
to authenticated
using (
  user_id = auth.uid()
  or exists (
    select 1
    from public.messages msg
    join public.chat_members m
      on m.room_id = msg.room_id
    where msg.id = message_reads.message_id
      and m.user_id = auth.uid()
  )
);

drop policy if exists "message_reads_insert_self_if_member" on public.message_reads;
create policy "message_reads_insert_self_if_member"
on public.message_reads
for insert
to authenticated
with check (
  user_id = auth.uid()
  and exists (
    select 1
    from public.messages msg
    join public.chat_members m
      on m.room_id = msg.room_id
    where msg.id = message_reads.message_id
      and m.user_id = auth.uid()
  )
);
