import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
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
    create schema auth;
    create table auth.users (id uuid primary key);
    create function auth.uid() returns uuid language sql stable as $$
      select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid;
    $$;
    grant usage on schema auth, public to anon, authenticated;
    grant execute on function auth.uid() to anon, authenticated;
  `);
  await db.query('insert into auth.users values ($1), ($2)', [user.id, otherId]);
  await db.exec(await readFile(new URL('../../supabase/migrations/202610170001_initial_backend.sql', import.meta.url), 'utf8'));
  const asUser = async (id: string) => {
    await db.exec('reset role; set role authenticated');
    await db.query("select set_config('request.jwt.claim.sub', $1, false)", [id]);
  };
  await asUser(user.id);
  const saved = await db.query<{ revision: number }>('select * from public.save_user_settings($1, $2::jsonb)', [0, JSON.stringify(settings)]);
  assert.equal(Number(saved.rows[0]?.revision), 1);
  await assert.rejects(db.query('select * from public.save_user_settings($1, $2::jsonb)', [0, JSON.stringify(settings)]), /revision conflict/);
  await assert.rejects(db.query('update public.user_settings set revision = 0'), /permission denied/);
  await assert.rejects(db.query('insert into public.profiles (user_id, display_name) values ($1, $2)', [otherId, 'Forged']), /row-level security/);
  await db.query('insert into public.profiles (user_id, display_name) values ($1, $2)', [user.id, 'Owner']);

  await asUser(otherId);
  assert.equal((await db.query('select * from public.user_settings')).rows.length, 0);
  assert.equal((await db.query('select * from public.profiles')).rows.length, 0);
  await db.query('select * from public.save_user_settings($1, $2::jsonb)', [0, JSON.stringify(settings)]);
  assert.equal((await db.query('select * from public.user_settings')).rows.length, 1);

  await asUser(user.id);
  const deleted = await db.query<{ revision: number; payload: unknown }>('select * from public.save_user_settings(1, null)');
  assert.equal(Number(deleted.rows[0]?.revision), 2); assert.equal(deleted.rows[0]?.payload, null);
  await assert.rejects(db.query('select * from public.save_user_settings($1, $2::jsonb)', [1, JSON.stringify(settings)]), /revision conflict/);
  await assert.rejects(db.query('select * from public.save_user_settings($1, $2::jsonb)', [2, JSON.stringify({ schemaVersion: 1, data: 'x'.repeat(70_000) })]), /bounded_settings/);
  await assert.rejects(db.query('select * from public.save_user_settings($1, $2::jsonb)', [2, JSON.stringify({ schemaVersion: 99 })]), /bounded_settings/);

  await db.exec('reset role; set role anon');
  assert.equal((await db.query('select user_id from public.user_settings')).rows.length, 0);
  await assert.rejects(db.query('select * from public.save_user_settings(0, null)'), /permission denied/);
  await db.exec('reset role');
  await db.query('delete from auth.users where id = $1', [user.id]);
  assert.equal((await db.query('select * from public.profiles')).rows.length, 0);
  assert.equal((await db.query('select * from public.user_settings where user_id = $1', [user.id])).rows.length, 0);
  assert.equal((await db.query('select * from public.user_settings where user_id = $1', [otherId])).rows.length, 1);
});
