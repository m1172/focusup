-- In-app support chat. Users read only their own thread through RLS; every write
-- goes through the Edge API with the server role, which takes the user from the
-- verified access token and relays messages to the team's Telegram chat.
create table public.support_messages (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  sender text not null check (sender in ('user', 'support')),
  body text not null check (char_length(body) between 1 and 2000),
  -- The Telegram message that carries this text, so a reply to it finds the thread.
  telegram_message_id bigint unique,
  created_at timestamptz not null default now()
);
create index support_messages_thread_idx on public.support_messages (user_id, id);

alter table public.support_messages enable row level security;
revoke all on public.support_messages from public, anon, authenticated;
grant select (id, sender, body, created_at, user_id) on public.support_messages to authenticated;
create policy support_messages_select on public.support_messages for select to authenticated using ((select auth.uid()) = user_id);
grant select, insert, update, delete on public.support_messages to service_role;
