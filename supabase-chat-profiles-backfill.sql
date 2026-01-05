-- Backfill + auto-provision users_profile for Supabase Auth users

-- 1) Backfill existing users (e.g. the 2 accounts you already registered)
insert into public.users_profile (id, name)
select
  u.id,
  coalesce(nullif(u.raw_user_meta_data->>'name',''), split_part(u.email, '@', 1), 'User') as name
from auth.users u
on conflict (id) do nothing;

-- 2) Auto-create a profile row on future signups
create or replace function public.handle_new_auth_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.users_profile (id, name)
  values (
    new.id,
    coalesce(nullif(new.raw_user_meta_data->>'name',''), split_part(new.email, '@', 1), 'User')
  )
  on conflict (id) do nothing;

  return new;
end;
$$;

-- Trigger on auth.users
-- (Supabase supports triggers here; run as owner in SQL editor)
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute procedure public.handle_new_auth_user();
