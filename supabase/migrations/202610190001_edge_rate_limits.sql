-- Counters are private and shared by every Edge Function instance. They never
-- store emails, access/refresh tokens, or IP addresses.
create schema if not exists api_private;
revoke all on schema api_private from public, anon, authenticated;

create table api_private.rate_limits (
  bucket text primary key,
  hits integer not null check (hits > 0),
  expires_at timestamptz not null
);
create index rate_limits_expiry_idx on api_private.rate_limits (expires_at);
alter table api_private.rate_limits enable row level security;
revoke all on api_private.rate_limits from public, anon, authenticated;

create function public.consume_api_rate_limit(bucket_key text, request_limit integer)
returns table (allowed boolean, retry_after_seconds integer)
language plpgsql security definer set search_path = ''
as $$
declare
  window_now timestamptz := clock_timestamp();
  counter api_private.rate_limits;
begin
  if bucket_key is null or bucket_key !~ '^[a-z0-9:-]{1,160}$'
     or request_limit is null or request_limit < 1 or request_limit > 1200 then
    raise exception 'Invalid rate limit parameters' using errcode = '22023';
  end if;

  -- Bound maintenance per invocation, using the expiry index.
  delete from api_private.rate_limits where expires_at <= window_now and bucket in (
    select bucket from api_private.rate_limits
    where expires_at <= window_now order by expires_at limit 100
  );

  insert into api_private.rate_limits as existing (bucket, hits, expires_at)
  values (bucket_key, 1, window_now + interval '1 minute')
  on conflict (bucket) do update set
    hits = case when existing.expires_at <= window_now then 1
      else least(existing.hits + 1, request_limit + 1) end,
    expires_at = case when existing.expires_at <= window_now
      then window_now + interval '1 minute' else existing.expires_at end
  returning * into counter;

  return query select counter.hits <= request_limit,
    greatest(1, ceil(extract(epoch from counter.expires_at - window_now))::integer);
end;
$$;
revoke all on function public.consume_api_rate_limit(text, integer) from public, anon, authenticated;
grant execute on function public.consume_api_rate_limit(text, integer) to service_role;
