-- Vaqtim Family: one managing parent, several children, one supervised phone per child.
-- Additive only. Nothing here touches personal settings backups (public.user_settings).
-- Every table is private: no anon or authenticated access. The Edge API calls the
-- functions below with the server role after it has verified the parent's token or the
-- child phone's credential. Secrets are stored only as hashes.
begin;

create table public.families (
  id uuid primary key default gen_random_uuid(),
  parent_user_id uuid not null unique references auth.users(id) on delete cascade,
  country text not null check (country ~ '^[A-Z]{2}$'),
  created_at timestamptz not null default now()
);

-- What the parent agreed to and when. Kept for as long as the family exists.
create table public.family_consents (
  id bigint generated always as identity primary key,
  family_id uuid not null references public.families(id) on delete cascade,
  kind text not null check (kind in ('family_setup', 'child_enrollment')),
  child_id uuid,
  consent_version text not null check (consent_version ~ '^[a-z0-9.-]{1,32}$'),
  accepted_at timestamptz not null default now()
);
create index family_consents_family_idx on public.family_consents (family_id);

create table public.family_children (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references public.families(id) on delete cascade,
  nickname text not null check (char_length(btrim(nickname)) between 1 and 40),
  birth_date date not null check (birth_date >= date '1990-01-01'),
  -- Set while the parent removed supervision but the child's phone has not confirmed the release yet.
  removal_requested_at timestamptz,
  created_at timestamptz not null default now()
);
create index family_children_family_idx on public.family_children (family_id);

-- The rules the parent wants. What the phone actually applied lives on family_devices.
create table public.family_policies (
  child_id uuid primary key references public.family_children(id) on delete cascade,
  revision bigint not null default 1 check (revision between 1 and 9007199254740991),
  policy jsonb not null check (jsonb_typeof(policy) = 'object' and octet_length(policy::text) <= 16384 and policy @> '{"schemaVersion": 1}'::jsonb),
  updated_at timestamptz not null default now()
);

-- One pairing at a time per child. The code is single use and short-lived; the parent
-- must then type the confirmation code shown on the child's phone.
create table public.family_pairings (
  id uuid primary key default gen_random_uuid(),
  child_id uuid not null unique references public.family_children(id) on delete cascade,
  code_hash text not null unique check (code_hash ~ '^[a-f0-9]{64}$'),
  expires_at timestamptz not null,
  device_secret_hash text unique check (device_secret_hash ~ '^[a-f0-9]{64}$'),
  confirmation_hash text check (confirmation_hash ~ '^[a-f0-9]{64}$'),
  device_platform text check (device_platform in ('ios', 'android')),
  claimed_at timestamptz,
  failed_attempts integer not null default 0 check (failed_attempts between 0 and 10),
  created_at timestamptz not null default now()
);

create table public.family_devices (
  id uuid primary key default gen_random_uuid(),
  child_id uuid not null references public.family_children(id) on delete cascade,
  secret_hash text not null unique check (secret_hash ~ '^[a-f0-9]{64}$'),
  platform text not null check (platform in ('ios', 'android')),
  state text not null default 'active' check (state in ('active', 'revoked')),
  enrolled_at timestamptz not null default now(),
  revoked_at timestamptz,
  last_seen_at timestamptz,
  applied_revision bigint check (applied_revision is null or applied_revision >= 0),
  -- What the phone last reported: permissions, blocked apps, timezone. No browsing data.
  report jsonb check (report is null or (jsonb_typeof(report) = 'object' and octet_length(report::text) <= 4096)),
  push_token text check (push_token ~ '^(Exponent|Expo)PushToken\[[A-Za-z0-9_-]{1,200}\]$')
);
create unique index family_devices_one_active on public.family_devices (child_id) where state = 'active';
create index family_devices_push_idx on public.family_devices (push_token) where push_token is not null;

alter table public.families enable row level security;
alter table public.family_consents enable row level security;
alter table public.family_children enable row level security;
alter table public.family_policies enable row level security;
alter table public.family_pairings enable row level security;
alter table public.family_devices enable row level security;
revoke all on public.families, public.family_consents, public.family_children, public.family_policies, public.family_pairings, public.family_devices from public, anon, authenticated;

create function api_private.family_age(birth date) returns integer
language sql stable set search_path = '' as $$
  select extract(year from age(current_date, birth))::integer;
$$;

-- The parent's view of one child: rules, phone and pairing. Never includes hashes or tokens.
create function api_private.family_child_json(child public.family_children) returns jsonb
language sql stable security definer set search_path = '' as $$
  select jsonb_build_object(
    'id', child.id, 'nickname', child.nickname, 'birthDate', child.birth_date,
    'removalPending', child.removal_requested_at is not null,
    'policy', (select jsonb_build_object('revision', p.revision, 'policy', p.policy, 'updatedAt', p.updated_at) from public.family_policies p where p.child_id = child.id),
    'device', (select jsonb_build_object('platform', d.platform, 'enrolledAt', d.enrolled_at, 'lastSeenAt', d.last_seen_at, 'appliedRevision', d.applied_revision, 'report', d.report)
      from public.family_devices d where d.child_id = child.id and d.state = 'active'),
    'pairing', (select jsonb_build_object('expiresAt', g.expires_at, 'claimed', g.claimed_at is not null, 'platform', g.device_platform)
      from public.family_pairings g where g.child_id = child.id and g.expires_at > now())
  );
$$;

create function public.family_overview(p_parent uuid) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare
  family public.families;
begin
  select * into family from public.families where parent_user_id = p_parent;
  if not found then return jsonb_build_object('family', null, 'children', '[]'::jsonb); end if;
  return jsonb_build_object(
    'family', jsonb_build_object('id', family.id, 'country', family.country, 'createdAt', family.created_at),
    'children', coalesce((select jsonb_agg(api_private.family_child_json(c) order by c.created_at, c.id) from public.family_children c where c.family_id = family.id), '[]'::jsonb)
  );
end;
$$;

create function public.family_setup(p_parent uuid, p_country text, p_consent_version text) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  family_id uuid;
begin
  insert into public.families (parent_user_id, country) values (p_parent, p_country)
    on conflict (parent_user_id) do update set country = excluded.country
    returning id into family_id;
  insert into public.family_consents (family_id, kind, consent_version) values (family_id, 'family_setup', p_consent_version);
  return public.family_overview(p_parent);
end;
$$;

create function public.family_add_child(p_parent uuid, p_nickname text, p_birth_date date, p_policy jsonb, p_consent_version text) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  family public.families;
  child public.family_children;
begin
  select * into family from public.families where parent_user_id = p_parent for update;
  if not found then raise exception 'FAMILY_REQUIRED' using errcode = 'P0001'; end if;
  if (select count(*) from public.family_children where family_id = family.id) >= 8 then raise exception 'FAMILY_CHILD_LIMIT' using errcode = 'P0001'; end if;
  if p_birth_date > current_date or api_private.family_age(p_birth_date) >= 18 then raise exception 'FAMILY_AGE_INVALID' using errcode = 'P0001'; end if;
  insert into public.family_children (family_id, nickname, birth_date) values (family.id, btrim(p_nickname), p_birth_date) returning * into child;
  insert into public.family_policies (child_id, policy) values (child.id, p_policy);
  insert into public.family_consents (family_id, kind, child_id, consent_version) values (family.id, 'child_enrollment', child.id, p_consent_version);
  return api_private.family_child_json(child);
end;
$$;

-- Finds a child of this parent's family, locked for the rest of the transaction.
create function api_private.family_owned_child(p_parent uuid, p_child uuid) returns public.family_children
language plpgsql security definer set search_path = '' as $$
declare
  child public.family_children;
begin
  select c.* into child from public.family_children c join public.families f on f.id = c.family_id
    where c.id = p_child and f.parent_user_id = p_parent for update of c;
  if not found then raise exception 'FAMILY_CHILD_NOT_FOUND' using errcode = 'P0001'; end if;
  return child;
end;
$$;

-- Under-13 profiles get blocking only: no clean social browsers.
create function api_private.family_check_policy(child public.family_children, p_policy jsonb) returns void
language plpgsql stable set search_path = '' as $$
begin
  if api_private.family_age(child.birth_date) < 13 and exists (
    select 1 from jsonb_each(coalesce(p_policy -> 'browsers', '{}'::jsonb)) as entry(app, rule)
    where jsonb_typeof(rule) = 'object' and rule ->> 'enabled' = 'true'
  ) then raise exception 'FAMILY_UNDER_13_BROWSING' using errcode = 'P0001'; end if;
end;
$$;

create function public.family_save_policy(p_parent uuid, p_child uuid, p_expected_revision bigint, p_policy jsonb) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  child public.family_children := api_private.family_owned_child(p_parent, p_child);
  saved public.family_policies;
begin
  if child.removal_requested_at is not null then raise exception 'FAMILY_REMOVAL_PENDING' using errcode = 'P0001'; end if;
  perform api_private.family_check_policy(child, p_policy);
  update public.family_policies set policy = p_policy, revision = revision + 1, updated_at = now()
    where child_id = child.id and revision = p_expected_revision returning * into saved;
  if not found then raise exception 'FAMILY_REVISION_CONFLICT' using errcode = 'P0001'; end if;
  return jsonb_build_object('revision', saved.revision, 'policy', saved.policy, 'updatedAt', saved.updated_at,
    'pushTokens', coalesce((select jsonb_agg(d.push_token) from public.family_devices d where d.child_id = child.id and d.state = 'active' and d.push_token is not null), '[]'::jsonb));
end;
$$;

create function public.family_start_pairing(p_parent uuid, p_child uuid, p_code_hash text, p_ttl_seconds integer) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  child public.family_children := api_private.family_owned_child(p_parent, p_child);
  pairing public.family_pairings;
begin
  if child.removal_requested_at is not null then raise exception 'FAMILY_REMOVAL_PENDING' using errcode = 'P0001'; end if;
  if p_ttl_seconds is null or p_ttl_seconds < 60 or p_ttl_seconds > 1800 then raise exception 'Invalid pairing lifetime' using errcode = '22023'; end if;
  delete from public.family_pairings where child_id = child.id;
  insert into public.family_pairings (child_id, code_hash, expires_at) values (child.id, p_code_hash, now() + make_interval(secs => p_ttl_seconds)) returning * into pairing;
  return jsonb_build_object('expiresAt', pairing.expires_at);
end;
$$;

create function public.family_cancel_pairing(p_parent uuid, p_child uuid) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  child public.family_children := api_private.family_owned_child(p_parent, p_child);
begin
  delete from public.family_pairings where child_id = child.id;
  return jsonb_build_object('ok', true);
end;
$$;

-- The child's phone redeems the code once. The parent then has ten minutes to confirm.
create function public.family_claim_pairing(p_code_hash text, p_secret_hash text, p_confirmation_hash text, p_platform text) returns jsonb
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
  select * into child from public.family_children where id = pairing.child_id;
  return jsonb_build_object('childNickname', child.nickname, 'expiresAt', pairing.expires_at,
    'parentName', coalesce((select nullif(btrim(p.display_name), '') from public.families f join public.profiles p on p.user_id = f.parent_user_id where f.id = child.family_id), ''));
end;
$$;

-- A wrong confirmation code is counted (not rolled back), and five wrong codes end the pairing.
create function public.family_approve_pairing(p_parent uuid, p_child uuid, p_confirmation_hash text) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  child public.family_children := api_private.family_owned_child(p_parent, p_child);
  pairing public.family_pairings;
  replaced boolean;
begin
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

-- Without a phone the child's records go at once. Otherwise the phone is told to lift
-- the family rules on its next contact, and the records go when it confirms.
create function public.family_remove_child(p_parent uuid, p_child uuid) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  child public.family_children := api_private.family_owned_child(p_parent, p_child);
begin
  delete from public.family_pairings where child_id = child.id;
  if exists (select 1 from public.family_devices where child_id = child.id and state = 'active') then
    update public.family_children set removal_requested_at = coalesce(removal_requested_at, now()) where id = child.id;
    return jsonb_build_object('state', 'pending');
  end if;
  delete from public.family_children where id = child.id;
  return jsonb_build_object('state', 'removed');
end;
$$;

create function public.family_delete(p_parent uuid) returns jsonb
language plpgsql security definer set search_path = '' as $$
begin
  delete from public.families where parent_user_id = p_parent;
  return jsonb_build_object('deleted', found);
end;
$$;

-- The child's phone checks in. It only ever learns its own child's rules.
create function public.family_device_sync(p_secret_hash text, p_applied_revision bigint, p_report jsonb, p_push_token text) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  device public.family_devices;
  child public.family_children;
  pairing public.family_pairings;
  policy public.family_policies;
begin
  select * into device from public.family_devices where secret_hash = p_secret_hash for update;
  if found then
    if device.state = 'revoked' then return jsonb_build_object('state', 'revoked'); end if;
    select * into child from public.family_children where id = device.child_id;
    if child.removal_requested_at is not null then return jsonb_build_object('state', 'released'); end if;
    select * into policy from public.family_policies where child_id = child.id;
    if p_push_token is not null then
      update public.family_devices set push_token = null where push_token = p_push_token and id <> device.id;
    end if;
    update public.family_devices set last_seen_at = now(),
        report = coalesce(p_report, report),
        applied_revision = case when p_applied_revision is not null and p_applied_revision <= policy.revision then p_applied_revision else applied_revision end,
        push_token = coalesce(p_push_token, push_token)
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

-- The phone confirms it lifted the family rules: removal or replacement is complete.
create function public.family_release_ack(p_secret_hash text) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  device public.family_devices;
begin
  select * into device from public.family_devices where secret_hash = p_secret_hash for update;
  if not found then return jsonb_build_object('ok', true); end if;
  if device.state = 'revoked' then delete from public.family_devices where id = device.id; return jsonb_build_object('ok', true); end if;
  if exists (select 1 from public.family_children where id = device.child_id and removal_requested_at is not null) then
    delete from public.family_children where id = device.child_id;
    return jsonb_build_object('ok', true);
  end if;
  raise exception 'FAMILY_NOT_RELEASED' using errcode = 'P0001';
end;
$$;

-- At 18 the supervised person may end supervision themselves.
create function public.family_end_supervision(p_secret_hash text) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  device public.family_devices;
  child public.family_children;
begin
  select * into device from public.family_devices where secret_hash = p_secret_hash and state = 'active';
  if not found then raise exception 'FAMILY_DEVICE_REVOKED' using errcode = 'P0001'; end if;
  select * into child from public.family_children where id = device.child_id for update;
  if api_private.family_age(child.birth_date) < 18 then raise exception 'FAMILY_NOT_ADULT' using errcode = 'P0001'; end if;
  delete from public.family_children where id = child.id;
  return jsonb_build_object('state', 'released');
end;
$$;

-- Everything Vaqtim keeps about this parent's family, for the account export. No hashes or tokens.
create function public.family_export(p_parent uuid) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare
  family public.families;
begin
  select * into family from public.families where parent_user_id = p_parent;
  if not found then return null; end if;
  return public.family_overview(p_parent) || jsonb_build_object('consents', coalesce((select jsonb_agg(jsonb_build_object('kind', kind, 'childId', child_id, 'consentVersion', consent_version, 'acceptedAt', accepted_at) order by id) from public.family_consents where family_id = family.id), '[]'::jsonb));
end;
$$;

do $$
declare
  fn text;
begin
  foreach fn in array array[
    'public.family_overview(uuid)', 'public.family_setup(uuid, text, text)', 'public.family_add_child(uuid, text, date, jsonb, text)',
    'public.family_save_policy(uuid, uuid, bigint, jsonb)', 'public.family_start_pairing(uuid, uuid, text, integer)', 'public.family_cancel_pairing(uuid, uuid)',
    'public.family_claim_pairing(text, text, text, text)', 'public.family_approve_pairing(uuid, uuid, text)', 'public.family_remove_child(uuid, uuid)',
    'public.family_delete(uuid)', 'public.family_device_sync(text, bigint, jsonb, text)', 'public.family_release_ack(text)',
    'public.family_end_supervision(text)', 'public.family_export(uuid)'
  ] loop
    execute format('revoke all on function %s from public, anon, authenticated', fn);
    execute format('grant execute on function %s to service_role', fn);
  end loop;
  foreach fn in array array['api_private.family_age(date)', 'api_private.family_child_json(public.family_children)', 'api_private.family_owned_child(uuid, uuid)', 'api_private.family_check_policy(public.family_children, jsonb)'] loop
    execute format('revoke all on function %s from public, anon, authenticated', fn);
  end loop;
end;
$$;

commit;
