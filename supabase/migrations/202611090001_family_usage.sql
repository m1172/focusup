-- Vaqtim Family: time in Vaqtim's clean browsers, for the parent's dashboard.
-- Only foreground minutes per local day and app (instagram, youtube, tiktok). No URLs, searches,
-- accounts or messages, and nothing about other apps on the phone. Kept for 7 days.
begin;

create table public.family_usage (
  child_id uuid not null references public.family_children(id) on delete cascade,
  day date not null,
  platform text not null check (platform in ('instagram', 'youtube', 'tiktok')),
  foreground_ms integer not null check (foreground_ms between 0 and 86400000),
  updated_at timestamptz not null default now(),
  primary key (child_id, day, platform)
);
create index family_usage_day_idx on public.family_usage (day);
alter table public.family_usage enable row level security;
revoke all on public.family_usage from public, anon, authenticated;

-- The newest usage report a phone has sent; older ones that arrive late are ignored.
alter table public.family_devices add column usage_sequence bigint not null default 0 check (usage_sequence >= 0);

-- The parent's view of one child now includes the last 7 days of usage.
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
    'usage', coalesce((select jsonb_agg(jsonb_build_object('day', u.day, 'platform', u.platform, 'foregroundMs', u.foreground_ms, 'updatedAt', u.updated_at) order by u.day, u.platform)
      from public.family_usage u where u.child_id = child.id and u.day >= current_date - 7), '[]'::jsonb)
  );
$$;

drop function public.family_device_sync(text, bigint, jsonb, text);

create function public.family_device_sync(p_secret_hash text, p_applied_revision bigint, p_report jsonb, p_push_token text, p_usage jsonb default null) returns jsonb
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

revoke all on function public.family_device_sync(text, bigint, jsonb, text, jsonb) from public, anon, authenticated;
grant execute on function public.family_device_sync(text, bigint, jsonb, text, jsonb) to service_role;
revoke all on function api_private.family_child_json(public.family_children) from public, anon, authenticated;

commit;
