-- Telegram login on our own domain: the Edge API verifies Telegram's ID token itself and then needs the
-- account that belongs to a Telegram user. New accounts carry the id in app_metadata (only the server can
-- set it); accounts made by the earlier Supabase-hosted Telegram login are found by their identity row.
create function public.find_telegram_user(p_telegram_id text)
returns uuid
language plpgsql stable security definer set search_path = ''
as $$
declare
  found uuid;
begin
  if p_telegram_id is null or p_telegram_id !~ '^\d{1,20}$' then
    return null;
  end if;
  select u.id into found from auth.users u where u.raw_app_meta_data ->> 'telegram_id' = p_telegram_id limit 1;
  if found is null then
    select i.user_id into found from auth.identities i where i.provider = 'custom:telegram' and i.provider_id = p_telegram_id limit 1;
  end if;
  return found;
end;
$$;

revoke all on function public.find_telegram_user(text) from public, anon, authenticated;
grant execute on function public.find_telegram_user(text) to service_role;
