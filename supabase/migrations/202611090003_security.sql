create table public.login_result_redemptions (
  result_hash text primary key check (length(result_hash) = 43),
  expires_at timestamptz not null
);
alter table public.login_result_redemptions enable row level security;
revoke all on public.login_result_redemptions from public, anon, authenticated;
create function public.consume_login_result(p_hash text, p_expires_at timestamptz)
returns boolean language plpgsql security definer set search_path = '' as $$
declare inserted integer;
begin
  if p_expires_at <= clock_timestamp() or p_expires_at > clock_timestamp() + interval '3 minutes' then return false; end if;
  delete from public.login_result_redemptions where expires_at < clock_timestamp();
  insert into public.login_result_redemptions values (p_hash, p_expires_at) on conflict do nothing;
  get diagnostics inserted = row_count;
  return inserted = 1;
end;
$$;
revoke all on function public.consume_login_result(text, timestamptz) from public, anon, authenticated;
grant execute on function public.consume_login_result(text, timestamptz) to service_role;

create function public.family_rate_identity(p_secret_hash text)
returns text language sql stable security definer set search_path = '' as $$
  select 'device:' || id::text from public.family_devices where secret_hash = p_secret_hash
  union all
  select 'pairing:' || id::text from public.family_pairings where device_secret_hash = p_secret_hash and expires_at > now()
  limit 1;
$$;
revoke all on function public.family_rate_identity(text) from public, anon, authenticated;
grant execute on function public.family_rate_identity(text) to service_role;
