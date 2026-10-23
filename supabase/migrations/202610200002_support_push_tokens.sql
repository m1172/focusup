-- Expo push tokens that tell a user when the team answers in the support chat.
-- A token names one device, so it belongs to whoever signed in there last. Users
-- read only their own rows through RLS; every write goes through the Edge API with
-- the server role, which takes the user from the verified access token.
create table public.support_push_tokens (
  token text primary key check (token ~ '^(Exponent|Expo)PushToken\[[A-Za-z0-9_-]{1,200}\]$'),
  user_id uuid not null references auth.users(id) on delete cascade,
  platform text not null check (platform in ('ios', 'android')),
  updated_at timestamptz not null default now()
);
create index support_push_tokens_user_idx on public.support_push_tokens (user_id, updated_at desc);

alter table public.support_push_tokens enable row level security;
revoke all on public.support_push_tokens from public, anon, authenticated;
grant select (token, platform, updated_at, user_id) on public.support_push_tokens to authenticated;
create policy support_push_tokens_select on public.support_push_tokens for select to authenticated using ((select auth.uid()) = user_id);
grant select, insert, update, delete on public.support_push_tokens to service_role;

-- A user keeps at most five devices: registering a sixth drops the oldest.
create function api_private.prune_support_push_tokens()
returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  delete from public.support_push_tokens where user_id = new.user_id and token not in (
    select token from public.support_push_tokens where user_id = new.user_id
    order by updated_at desc, token limit 5
  );
  return null;
end;
$$;
revoke all on function api_private.prune_support_push_tokens() from public, anon, authenticated;
create trigger support_push_tokens_prune after insert or update of user_id, updated_at on public.support_push_tokens
  for each row execute function api_private.prune_support_push_tokens();
