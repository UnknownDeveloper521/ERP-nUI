-- Fix: 42P17 infinite recursion detected in policy for relation "chat_members"
-- Cause: a chat_members policy that references chat_members in its own USING clause.

begin;

-- Replace chat_members SELECT policy with a non-recursive version.
-- This allows users to read ONLY their own membership rows.
-- (Membership management remains via server/DB admin; you can expand this later.)

drop policy if exists "Chat members are readable by room members" on public.chat_members;
drop policy if exists "chat_members_select" on public.chat_members;
drop policy if exists "chat_members_select_if_member" on public.chat_members;
drop policy if exists "chat_members_select_own" on public.chat_members;

drop policy if exists "Chat members can be read by members" on public.chat_members;

drop policy if exists "Allow read to room members" on public.chat_members;

drop policy if exists "Members can view members" on public.chat_members;

drop policy if exists "Members can read membership" on public.chat_members;

create policy "chat_members_select_own"
on public.chat_members
for select
to authenticated
using (user_id = auth.uid());

commit;
