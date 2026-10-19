begin;

-- A stale settings revision is an application conflict, not a serialization
-- failure. PT409 lets PostgREST return it without retrying the transaction.
create or replace function public.save_user_settings(expected_revision bigint, new_payload jsonb)
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
    raise exception 'Settings revision conflict' using errcode = 'PT409';
  end if;
end;
$$;

commit;
