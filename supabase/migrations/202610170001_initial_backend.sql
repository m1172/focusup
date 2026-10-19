begin;

create table public.profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null default '' check (char_length(display_name) <= 80),
  updated_at timestamptz not null default now()
);

-- One bounded snapshot per account keeps storage predictable on the free plan.
-- A null payload is a deletion tombstone; revision remains monotonic.
create table public.user_settings (
  user_id uuid primary key references auth.users(id) on delete cascade,
  revision bigint not null default 0 check (revision between 0 and 9007199254740991),
  payload jsonb,
  updated_at timestamptz not null default now(),
  constraint bounded_settings check (payload is null or (jsonb_typeof(payload) = 'object' and octet_length(payload::text) <= 65536 and payload @> '{"schemaVersion": 1}'::jsonb))
);

alter table public.profiles enable row level security;
alter table public.user_settings enable row level security;
revoke all on public.profiles, public.user_settings from anon, authenticated;
grant select, insert, update, delete on public.profiles to authenticated;
grant select on public.user_settings to authenticated;
-- Allow anonymous HEAD requests for readiness without exposing any rows.
grant select (user_id) on public.user_settings to anon;

create policy profiles_select on public.profiles for select to authenticated using ((select auth.uid()) = user_id);
create policy profiles_insert on public.profiles for insert to authenticated with check ((select auth.uid()) = user_id);
create policy profiles_update on public.profiles for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy profiles_delete on public.profiles for delete to authenticated using ((select auth.uid()) = user_id);
create policy settings_select on public.user_settings for select to authenticated using ((select auth.uid()) = user_id);

create function public.touch_profile() returns trigger language plpgsql set search_path = '' as $$
begin
  new.updated_at := now();
  return new;
end;
$$;
create trigger touch_profile before update on public.profiles for each row execute function public.touch_profile();

-- The narrow definer function is the only authenticated write path. It derives
-- ownership from the verified JWT and performs compare-and-swap in one transaction.
create function public.save_user_settings(expected_revision bigint, new_payload jsonb)
returns setof public.user_settings
language plpgsql security definer set search_path = '' as $$
declare
  account_id uuid := auth.uid();
begin
  if account_id is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;
  if expected_revision is null or expected_revision < 0 or expected_revision >= 9007199254740991 then
    raise exception 'Invalid revision' using errcode = '22023';
  end if;
  insert into public.user_settings (user_id) values (account_id) on conflict (user_id) do nothing;
  return query
    update public.user_settings
    set payload = new_payload, revision = revision + 1, updated_at = now()
    where user_id = account_id and revision = expected_revision
    returning *;
  if not found then
    raise exception 'Settings revision conflict' using errcode = '40001';
  end if;
end;
$$;
revoke all on function public.save_user_settings(bigint, jsonb) from public, anon;
grant execute on function public.save_user_settings(bigint, jsonb) to authenticated;
revoke all on function public.touch_profile() from public, anon, authenticated;

commit;
