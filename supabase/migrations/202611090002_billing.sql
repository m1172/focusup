begin;

create table public.billing_subscriptions (
  user_id uuid not null references auth.users(id) on delete cascade,
  environment text not null check (environment in ('PRODUCTION', 'SANDBOX')),
  snapshot jsonb not null,
  verified_at bigint not null,
  primary key (user_id, environment)
);
create table public.billing_webhook_events (
  environment text not null check (environment in ('PRODUCTION', 'SANDBOX')),
  event_id text not null,
  processed_at timestamptz not null default now(),
  primary key (environment, event_id)
);
alter table public.billing_subscriptions enable row level security;
alter table public.billing_webhook_events enable row level security;
revoke all on public.billing_subscriptions, public.billing_webhook_events from public, anon, authenticated;

create function public.billing_get(p_user uuid, p_environment text) returns jsonb
language sql stable security definer set search_path = '' as $$
  select coalesce((
    select (snapshot - 'verifiedAt') || jsonb_build_object('familyChildAllowance', case when snapshot ->> 'tier' = 'family' then 3 else 0 end)
      from public.billing_subscriptions where user_id = p_user and environment = p_environment
      and (snapshot ->> 'expiresAt')::timestamptz > now()
  ), jsonb_build_object('tier', 'free', 'store', null, 'productId', null, 'expiresAt', null, 'familyChildAllowance', 0));
$$;

create function public.billing_save(p_user uuid, p_environment text, p_snapshot jsonb) returns jsonb
language plpgsql security definer set search_path = '' as $$
begin
  -- Ignore events for deleted accounts. Lock the user against deletion until this write completes.
  perform 1 from auth.users where id = p_user for key share;
  if found then
    insert into public.billing_subscriptions as existing (user_id, environment, snapshot, verified_at)
    values (p_user, p_environment, p_snapshot, (p_snapshot ->> 'verifiedAt')::bigint)
    on conflict (user_id, environment) do update
      set snapshot = excluded.snapshot, verified_at = excluded.verified_at
      where existing.verified_at < excluded.verified_at;
  end if;
  return public.billing_get(p_user, p_environment);
end;
$$;

create function public.billing_event_seen(p_environment text, p_event text) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists(select 1 from public.billing_webhook_events where environment = p_environment and event_id = p_event);
$$;

create function public.billing_event_mark(p_environment text, p_event text) returns void
language sql security definer set search_path = '' as $$
  insert into public.billing_webhook_events(environment, event_id) values (p_environment, p_event)
  on conflict do nothing;
$$;

revoke all on function public.billing_get(uuid, text), public.billing_save(uuid, text, jsonb),
  public.billing_event_seen(text, text), public.billing_event_mark(text, text) from public, anon, authenticated;
grant execute on function public.billing_get(uuid, text), public.billing_save(uuid, text, jsonb),
  public.billing_event_seen(text, text), public.billing_event_mark(text, text) to service_role;

-- Sandbox billing runs against a separate staging database. Only the server can write either environment.
create function api_private.family_is_paid(p_parent uuid) returns boolean
language sql stable set search_path = '' as $$
  select exists(select 1 from public.billing_subscriptions where user_id = p_parent
    and snapshot ->> 'tier' = 'family' and (snapshot ->> 'expiresAt')::timestamptz > now());
$$;

create function api_private.require_family_paid(p_parent uuid) returns void
language plpgsql stable set search_path = '' as $$
begin
  if not api_private.family_is_paid(p_parent) then raise exception 'FAMILY_SUBSCRIPTION_REQUIRED' using errcode = 'P0001'; end if;
end;
$$;

create or replace function public.family_setup(p_parent uuid, p_country text, p_consent_version text) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  family_id uuid;
begin
  perform api_private.require_family_paid(p_parent);
  insert into public.families (parent_user_id, country) values (p_parent, p_country)
    on conflict (parent_user_id) do update set country = excluded.country
    returning id into family_id;
  insert into public.family_consents (family_id, kind, consent_version) values (family_id, 'family_setup', p_consent_version);
  return public.family_overview(p_parent);
end;
$$;

create or replace function public.family_add_child(p_parent uuid, p_nickname text, p_birth_date date, p_policy jsonb, p_consent_version text) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  family public.families;
  child public.family_children;
begin
  perform api_private.require_family_paid(p_parent);
  select * into family from public.families where parent_user_id = p_parent for update;
  if not found then raise exception 'FAMILY_REQUIRED' using errcode = 'P0001'; end if;
  if (select count(*) from public.family_children where family_id = family.id) >= 3 then raise exception 'FAMILY_CHILD_LIMIT' using errcode = 'P0001'; end if;
  if p_birth_date > current_date or api_private.family_age(p_birth_date) >= 18 then raise exception 'FAMILY_AGE_INVALID' using errcode = 'P0001'; end if;
  insert into public.family_children (family_id, nickname, birth_date) values (family.id, btrim(p_nickname), p_birth_date) returning * into child;
  insert into public.family_policies (child_id, policy) values (child.id, p_policy);
  insert into public.family_consents (family_id, kind, child_id, consent_version) values (family.id, 'child_enrollment', child.id, p_consent_version);
  return api_private.family_child_json(child);
end;
$$;

create or replace function public.family_save_policy(p_parent uuid, p_child uuid, p_expected_revision bigint, p_policy jsonb) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  child public.family_children := api_private.family_owned_child(p_parent, p_child);
  saved public.family_policies;
begin
  if child.removal_requested_at is not null then raise exception 'FAMILY_REMOVAL_PENDING' using errcode = 'P0001'; end if;
  -- Without paid access, only clear existing blocks, downtime and limits. Browser permissions stay as saved.
  if not api_private.family_is_paid(p_parent) and not exists (
    select 1 from public.family_policies p where p.child_id = child.id
      and p_policy = jsonb_build_object('schemaVersion', 1, 'protectedApps', '[]'::jsonb,
        'browsers', p.policy -> 'browsers', 'downtime', '[]'::jsonb)
  ) then raise exception 'FAMILY_SUBSCRIPTION_REQUIRED' using errcode = 'P0001'; end if;
  perform api_private.family_check_policy(child, p_policy);
  update public.family_policies set policy = p_policy, revision = revision + 1, updated_at = now()
    where child_id = child.id and revision = p_expected_revision returning * into saved;
  if not found then raise exception 'FAMILY_REVISION_CONFLICT' using errcode = 'P0001'; end if;
  return jsonb_build_object('revision', saved.revision, 'policy', saved.policy, 'updatedAt', saved.updated_at,
    'pushTokens', coalesce((select jsonb_agg(d.push_token) from public.family_devices d where d.child_id = child.id and d.state = 'active' and d.push_token is not null), '[]'::jsonb));
end;
$$;

create or replace function public.family_start_pairing(p_parent uuid, p_child uuid, p_code_hash text, p_ttl_seconds integer) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  child public.family_children := api_private.family_owned_child(p_parent, p_child);
  pairing public.family_pairings;
begin
  perform api_private.require_family_paid(p_parent);
  if child.removal_requested_at is not null then raise exception 'FAMILY_REMOVAL_PENDING' using errcode = 'P0001'; end if;
  if p_ttl_seconds is null or p_ttl_seconds < 60 or p_ttl_seconds > 1800 then raise exception 'Invalid pairing lifetime' using errcode = '22023'; end if;
  delete from public.family_pairings where child_id = child.id;
  insert into public.family_pairings (child_id, code_hash, expires_at) values (child.id, p_code_hash, now() + make_interval(secs => p_ttl_seconds)) returning * into pairing;
  return jsonb_build_object('expiresAt', pairing.expires_at);
end;
$$;

create or replace function public.family_claim_pairing(p_code_hash text, p_secret_hash text, p_confirmation_hash text, p_platform text) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  pairing public.family_pairings;
  child public.family_children;
begin
  update public.family_pairings set claimed_at = now(), expires_at = now() + interval '10 minutes',
      device_secret_hash = p_secret_hash, confirmation_hash = p_confirmation_hash, device_platform = p_platform
    where code_hash = p_code_hash and claimed_at is null and expires_at > now()
    returning * into pairing;
  if not found then raise exception 'FAMILY_PAIRING_INVALID' using errcode = 'P0001'; end if;
  perform api_private.require_family_paid((select f.parent_user_id from public.families f
    join public.family_children c on c.family_id = f.id where c.id = pairing.child_id));
  select * into child from public.family_children where id = pairing.child_id;
  return jsonb_build_object('childNickname', child.nickname, 'expiresAt', pairing.expires_at,
    'parentName', coalesce((select nullif(btrim(p.display_name), '') from public.families f join public.profiles p on p.user_id = f.parent_user_id where f.id = child.family_id), ''));
end;
$$;

create or replace function public.family_approve_pairing(p_parent uuid, p_child uuid, p_confirmation_hash text) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  child public.family_children := api_private.family_owned_child(p_parent, p_child);
  pairing public.family_pairings;
  replaced boolean;
begin
  perform api_private.require_family_paid(p_parent);
  select * into pairing from public.family_pairings where child_id = child.id and claimed_at is not null and expires_at > now() for update;
  if not found then raise exception 'FAMILY_PAIRING_NOT_READY' using errcode = 'P0001'; end if;
  if pairing.confirmation_hash is distinct from p_confirmation_hash then
    if pairing.failed_attempts + 1 >= 5 then
      delete from public.family_pairings where id = pairing.id;
      return jsonb_build_object('ok', false, 'attemptsLeft', 0);
    end if;
    update public.family_pairings set failed_attempts = failed_attempts + 1 where id = pairing.id;
    return jsonb_build_object('ok', false, 'attemptsLeft', 4 - pairing.failed_attempts);
  end if;
  -- A new phone replaces the old one, which loses access on its next contact.
  update public.family_devices set state = 'revoked', revoked_at = now(), push_token = null where child_id = child.id and state = 'active';
  replaced := found;
  delete from public.family_devices where child_id = child.id and state = 'revoked' and revoked_at < now() - interval '30 days';
  insert into public.family_devices (child_id, secret_hash, platform) values (child.id, pairing.device_secret_hash, pairing.device_platform);
  delete from public.family_pairings where id = pairing.id;
  return jsonb_build_object('ok', true, 'replaced', replaced);
end;
$$;

-- Account export includes stored data even when the paid dashboard is unavailable.
create function api_private.billing_family_usage(p_child uuid) returns jsonb
language sql stable set search_path = '' as $$
  select coalesce(jsonb_agg(jsonb_build_object('day', u.day, 'platform', u.platform,
    'foregroundMs', u.foreground_ms, 'updatedAt', u.updated_at) order by u.day, u.platform), '[]'::jsonb)
  from public.family_usage u where u.child_id = p_child and u.day >= current_date - 7;
$$;
revoke all on function api_private.billing_family_usage(uuid) from public, anon, authenticated;

create or replace function api_private.family_child_json(child public.family_children) returns jsonb
language sql stable security definer set search_path = '' as $$
  select jsonb_build_object(
    'id', child.id, 'nickname', child.nickname, 'birthDate', child.birth_date,
    'removalPending', child.removal_requested_at is not null,
    'policy', (select jsonb_build_object('revision', p.revision, 'policy', p.policy, 'updatedAt', p.updated_at) from public.family_policies p where p.child_id = child.id),
    'device', (select jsonb_build_object('platform', d.platform, 'enrolledAt', d.enrolled_at, 'lastSeenAt', d.last_seen_at, 'appliedRevision', d.applied_revision, 'report', d.report)
      from public.family_devices d where d.child_id = child.id and d.state = 'active'),
    'pairing', (select jsonb_build_object('expiresAt', g.expires_at, 'claimed', g.claimed_at is not null, 'platform', g.device_platform)
      from public.family_pairings g where g.child_id = child.id and g.expires_at > now()),
    'usage', case when api_private.family_is_paid((select f.parent_user_id from public.families f where f.id = child.family_id))
      then api_private.billing_family_usage(child.id) else '[]'::jsonb end
  );
$$;

create or replace function public.family_device_sync(p_secret_hash text, p_applied_revision bigint, p_report jsonb, p_push_token text, p_usage jsonb default null) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  device public.family_devices;
  child public.family_children;
  pairing public.family_pairings;
  policy public.family_policies;
  v_sequence bigint;
begin
  -- Usage older than 7 days expires for every family, whether or not its phone still syncs.
  delete from public.family_usage where day < current_date - 7;
  select * into device from public.family_devices where secret_hash = p_secret_hash for update;
  if found then
    if device.state = 'revoked' then return jsonb_build_object('state', 'revoked'); end if;
    select * into child from public.family_children where id = device.child_id;
    if child.removal_requested_at is not null then return jsonb_build_object('state', 'released'); end if;
    select * into policy from public.family_policies where child_id = child.id;
    if p_push_token is not null then
      update public.family_devices set push_token = null where push_token = p_push_token and id <> device.id;
    end if;
    if not api_private.family_is_paid((select f.parent_user_id from public.families f where f.id = child.family_id)) then
      p_usage := null;
    end if;
    v_sequence := (p_usage ->> 'sequence')::bigint;
    if p_usage is not null and v_sequence > device.usage_sequence then
      -- Totals replace what was stored, so a retried report never counts twice. The phone's local day
      -- can be a day ahead of the server's; anything outside that window is ignored.
      insert into public.family_usage (child_id, day, platform, foreground_ms)
        select child.id, (d ->> 'day')::date, a.key, least(greatest(a.value::text::integer, 0), 86400000)
        from jsonb_array_elements(p_usage -> 'days') d, jsonb_each(d -> 'apps') a
        where (d ->> 'day')::date between current_date - 7 and current_date + 1 and a.key in ('instagram', 'youtube', 'tiktok')
        on conflict (child_id, day, platform) do update set foreground_ms = excluded.foreground_ms, updated_at = now();
    end if;
    update public.family_devices set last_seen_at = now(),
        report = coalesce(p_report, report),
        applied_revision = case when p_applied_revision is not null and p_applied_revision <= policy.revision then p_applied_revision else applied_revision end,
        push_token = coalesce(p_push_token, push_token),
        usage_sequence = case when v_sequence is not null and v_sequence > usage_sequence then v_sequence else usage_sequence end
      where id = device.id;
    return jsonb_build_object('state', 'active', 'child', jsonb_build_object('nickname', child.nickname, 'birthDate', child.birth_date),
      'parentName', coalesce((select nullif(btrim(p.display_name), '') from public.families f join public.profiles p on p.user_id = f.parent_user_id where f.id = child.family_id), ''),
      'revision', policy.revision, 'policy', policy.policy);
  end if;
  select * into pairing from public.family_pairings where device_secret_hash = p_secret_hash;
  if found and pairing.expires_at > now() then
    return jsonb_build_object('state', 'pending', 'childNickname', (select nickname from public.family_children where id = pairing.child_id));
  end if;
  if found then delete from public.family_pairings where id = pairing.id; end if;
  return jsonb_build_object('state', 'unknown');
end;
$$;

create or replace function public.family_overview(p_parent uuid) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare
  family public.families;
begin
  select * into family from public.families where parent_user_id = p_parent;
  if not found then return jsonb_build_object('familyPaid', api_private.family_is_paid(p_parent), 'family', null, 'children', '[]'::jsonb); end if;
  return jsonb_build_object(
    'familyPaid', api_private.family_is_paid(p_parent),
    'family', jsonb_build_object('id', family.id, 'country', family.country, 'createdAt', family.created_at),
    'children', coalesce((select jsonb_agg(api_private.family_child_json(c) order by c.created_at, c.id) from public.family_children c where c.family_id = family.id), '[]'::jsonb)
  );
end;
$$;

create or replace function public.family_export(p_parent uuid) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare
  family public.families;
begin
  select * into family from public.families where parent_user_id = p_parent;
  if not found then return null; end if;
  return public.family_overview(p_parent) || jsonb_build_object(
    'children', coalesce((select jsonb_agg(api_private.family_child_json(c)
      || jsonb_build_object('usage', api_private.billing_family_usage(c.id)) order by c.created_at, c.id)
      from public.family_children c where c.family_id = family.id), '[]'::jsonb),
    'consents', coalesce((select jsonb_agg(jsonb_build_object('kind', kind, 'childId', child_id,
      'consentVersion', consent_version, 'acceptedAt', accepted_at) order by id)
      from public.family_consents where family_id = family.id), '[]'::jsonb));
end;
$$;

commit;
