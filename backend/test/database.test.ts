import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import { test } from 'node:test';
import { PGlite } from '@electric-sql/pglite';
import { settings, user } from './fixtures.js';

// Execute the migration with real PostgreSQL semantics in WASM. Only Supabase's
// auth.users table and auth.uid() JWT context are supplied by this harness.
test('migration enforces RLS, atomic revisions, tombstones and account cascades', async (t) => {
  const db = new PGlite(); t.after(() => db.close());
  const otherId = '22222222-2222-4222-8222-222222222222';
  await db.exec(`
    create role anon;
    create role authenticated;
    create role service_role bypassrls; -- as on Supabase
    create schema auth;
    create table auth.users (id uuid primary key, raw_app_meta_data jsonb not null default '{}');
    create table auth.identities (user_id uuid not null references auth.users(id) on delete cascade, provider text not null, provider_id text not null);
    create function auth.uid() returns uuid language sql stable as $$
      select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid;
    $$;
    grant usage on schema auth, public to anon, authenticated;
    grant execute on function auth.uid() to anon, authenticated;
  `);
  await db.query('insert into auth.users values ($1), ($2)', [user.id, otherId]);
  const migrations = new URL('../../supabase/migrations/', import.meta.url);
  for (const file of (await readdir(migrations)).filter((name) => name.endsWith('.sql')).sort()) {
    await db.exec(await readFile(new URL(file, migrations), 'utf8'));
  }
  const asUser = async (id: string) => {
    await db.exec('reset role; set role authenticated');
    await db.query("select set_config('request.jwt.claim.sub', $1, false)", [id]);
  };
  await asUser(user.id);
  const saved = await db.query<{ revision: number }>('select * from public.save_user_settings($1, $2::jsonb)', [0, JSON.stringify(settings)]);
  assert.equal(Number(saved.rows[0]?.revision), 1);
  await assert.rejects(db.query('select * from public.save_user_settings($1, $2::jsonb)', [0, JSON.stringify(settings)]), { code: 'PT409', message: /revision conflict/ });
  await assert.rejects(db.query('update public.user_settings set revision = 0'), /permission denied/);
  await assert.rejects(db.query('insert into public.profiles (user_id, display_name) values ($1, $2)', [otherId, 'Forged']), /row-level security/);
  await db.query('insert into public.profiles (user_id, display_name) values ($1, $2)', [user.id, 'Owner']);

  await asUser(otherId);
  assert.equal((await db.query('select * from public.user_settings')).rows.length, 0);
  assert.equal((await db.query('select * from public.profiles')).rows.length, 0);
  await db.query('select * from public.save_user_settings($1, $2::jsonb)', [0, JSON.stringify(settings)]);
  assert.equal((await db.query('select * from public.user_settings')).rows.length, 1);

  // Users cannot inspect or change shared throttle counters. Only the edge
  // server role can invoke the bounded, atomic security-definer function.
  await assert.rejects(db.query("select * from public.consume_api_rate_limit('edge:test', 10)"), /permission denied/);
  await assert.rejects(db.query('select * from api_private.rate_limits'), /permission denied/);
  await db.exec('reset role; set role service_role');
  const burst = await Promise.all(Array.from({ length: 12 }, () => db.query<{ allowed: boolean; retry_after_seconds: number }>("select * from public.consume_api_rate_limit('edge:test', 10)")));
  assert.equal(burst.filter((result) => result.rows[0]?.allowed).length, 10);
  assert.ok(burst.every((result) => Number(result.rows[0]?.retry_after_seconds) > 0));
  assert.equal((await db.query<{ allowed: boolean }>("select * from public.consume_api_rate_limit('edge:other', 10)")).rows[0]?.allowed, true);
  await assert.rejects(db.query("select * from public.consume_api_rate_limit('edge:test', 0)"), /Invalid rate limit parameters/);
  await db.exec("reset role; update api_private.rate_limits set expires_at = now() - interval '1 second' where bucket = 'edge:test'; set role service_role");
  assert.equal((await db.query<{ allowed: boolean }>("select * from public.consume_api_rate_limit('edge:test', 10)")).rows[0]?.allowed, true);

  await asUser(user.id);
  const deleted = await db.query<{ revision: number; payload: unknown }>('select * from public.save_user_settings(1, null)');
  assert.equal(Number(deleted.rows[0]?.revision), 2); assert.equal(deleted.rows[0]?.payload, null);
  await assert.rejects(db.query('select * from public.save_user_settings($1, $2::jsonb)', [1, JSON.stringify(settings)]), { code: 'PT409', message: /revision conflict/ });
  await assert.rejects(db.query('select * from public.save_user_settings($1, $2::jsonb)', [2, JSON.stringify({ schemaVersion: 1, data: 'x'.repeat(70_000) })]), /bounded_settings/);
  await assert.rejects(db.query('select * from public.save_user_settings($1, $2::jsonb)', [2, JSON.stringify({ schemaVersion: 99 })]), /bounded_settings/);

  // Support threads: users read only their own messages and never write or see Telegram ids.
  await db.exec('reset role; set role service_role');
  await db.query("insert into public.support_messages (user_id, sender, body, telegram_message_id) values ($1, 'user', 'Reels came back', 501), ($1, 'support', 'Fixed now', 502), ($2, 'user', 'Other thread', 503)", [user.id, otherId]);
  await assert.rejects(db.query("insert into public.support_messages (user_id, sender, body, telegram_message_id) values ($1, 'support', 'Retried webhook', 502)", [user.id]), { code: '23505' });
  await assert.rejects(db.query("insert into public.support_messages (user_id, sender, body) values ($1, 'team', 'x')", [user.id]), /sender_check/);
  await assert.rejects(db.query("insert into public.support_messages (user_id, sender, body) values ($1, 'user', '')", [user.id]), /body_check/);
  await asUser(user.id);
  const thread = await db.query<{ body: string }>('select id, sender, body, created_at from public.support_messages order by id');
  assert.deepEqual(thread.rows.map((row) => row.body), ['Reels came back', 'Fixed now']);
  await assert.rejects(db.query('select telegram_message_id from public.support_messages'), /permission denied/);
  await assert.rejects(db.query("insert into public.support_messages (user_id, sender, body) values ($1, 'support', 'Forged answer')", [user.id]), /permission denied/);
  await assert.rejects(db.query("update public.support_messages set body = 'Edited'"), /permission denied/);

  // Reply-notification tokens: owner-only reads, server-only writes, one owner per device, five devices per user.
  await db.exec('reset role; set role service_role');
  const token = (n: number) => `ExponentPushToken[device${n}]`;
  await db.query("insert into public.support_push_tokens (token, user_id, platform) values ($1, $2, 'ios'), ($3, $4, 'android')", [token(0), user.id, token(9), otherId]);
  await assert.rejects(db.query("insert into public.support_push_tokens (token, user_id, platform) values ('not-a-token', $1, 'ios')", [user.id]), /token_check/);
  await assert.rejects(db.query("insert into public.support_push_tokens (token, user_id, platform) values ($1, $2, 'web')", [token(1), user.id]), /platform_check/);
  for (let n = 1; n <= 6; n++) {
    await db.query("insert into public.support_push_tokens (token, user_id, platform, updated_at) values ($1, $2, 'ios', now() + make_interval(secs => $3))", [token(n), user.id, n]);
  }
  const kept = await db.query<{ token: string }>('select token from public.support_push_tokens where user_id = $1 order by token', [user.id]);
  assert.deepEqual(kept.rows.map((row) => row.token), [2, 3, 4, 5, 6].map(token));
  // Another account signs in on device 6, so its token moves to that user.
  await db.query("insert into public.support_push_tokens as existing (token, user_id, platform) values ($1, $2, 'ios') on conflict (token) do update set user_id = excluded.user_id, updated_at = now() + interval '1 hour'", [token(6), otherId]);
  assert.equal((await db.query('select * from public.support_push_tokens where user_id = $1', [otherId])).rows.length, 2);
  await asUser(user.id);
  const mine = await db.query<{ token: string }>('select token, platform, updated_at from public.support_push_tokens order by token');
  assert.deepEqual(mine.rows.map((row) => row.token), [2, 3, 4, 5].map(token));
  await assert.rejects(db.query("insert into public.support_push_tokens (token, user_id, platform) values ($1, $2, 'ios')", [token(7), user.id]), /permission denied/);
  await assert.rejects(db.query('update public.support_push_tokens set user_id = $1', [otherId]), /permission denied/);
  await assert.rejects(db.query('delete from public.support_push_tokens'), /permission denied/);

  // Telegram login: new accounts by app_metadata, older ones by their custom:telegram identity; server role only.
  await db.exec('reset role');
  await db.query(`update auth.users set raw_app_meta_data = '{"telegram_id":"1001"}' where id = $1`, [user.id]);
  await db.query("insert into auth.identities values ($1, 'custom:telegram', '2002')", [otherId]);
  const findTelegram = async (id: string | null) => (await db.query<{ id: string | null }>('select public.find_telegram_user($1) as id', [id])).rows[0]!.id;
  await db.exec('set role service_role');
  assert.equal(await findTelegram('1001'), user.id);
  assert.equal(await findTelegram('2002'), otherId);
  assert.equal(await findTelegram('3003'), null);
  assert.equal(await findTelegram("1001' or true --"), null);
  for (const role of ['authenticated', 'anon']) {
    await db.exec(`reset role; set role ${role}`);
    await assert.rejects(db.query("select public.find_telegram_user('1001')"), /permission denied/);
  }

  await db.exec('reset role; set role anon');
  assert.equal((await db.query('select user_id from public.user_settings')).rows.length, 0);
  await assert.rejects(db.query('select body from public.support_messages'), /permission denied/);
  await assert.rejects(db.query('select token from public.support_push_tokens'), /permission denied/);
  await assert.rejects(db.query('select * from public.save_user_settings(0, null)'), /permission denied/);
  await db.exec('reset role');
  await db.query('delete from auth.users where id = $1', [user.id]);
  assert.equal((await db.query('select * from public.profiles')).rows.length, 0);
  assert.equal((await db.query('select * from public.user_settings where user_id = $1', [user.id])).rows.length, 0);
  assert.equal((await db.query('select * from public.support_messages where user_id = $1', [user.id])).rows.length, 0);
  assert.equal((await db.query('select * from public.support_push_tokens where user_id = $1', [user.id])).rows.length, 0);
  assert.equal((await db.query('select * from public.support_push_tokens where user_id = $1', [otherId])).rows.length, 2);
  assert.equal((await db.query('select * from public.user_settings where user_id = $1', [otherId])).rows.length, 1);
});
