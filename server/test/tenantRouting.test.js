// Which hotel does this hostname belong to?
//
// The resolver used to answer that by parsing a subdomain FIRST and returning
// the base tenant the moment it found none — so the custom-domain lookup below
// that line was unreachable for an apex domain. A hotel that registered
// hotelabc.com silently got the operator's database instead of its own.
import test from 'node:test';
import assert from 'node:assert/strict';

import { startDb, stopDb, clearDb, skipReason } from './helpers/memoryDb.js';
import { getTenantModel } from '../models/control/Tenant.js';
import { BASE_TENANT } from '../db/tenantContext.js';

// BASE_DOMAINS must be set before resolveTenant.js is imported — it reads the
// env once, at module load.
process.env.BASE_DOMAINS = 'example.com';
const ready = await startDb();
const { resolveTenantForHost, clearTenantCache, parseSubdomain } =
  await import('../middleware/resolveTenant.js');

const tenant = (over = {}) => getTenantModel().create({
  slug: 'hotelabc', name: 'Hotel ABC', subdomain: 'hotelabc',
  dbName: 'hotel_abc', status: 'active', ...over,
});

test('tenant routing', { skip: ready ? false : skipReason, timeout: 60_000 }, async (t) => {
  t.after(async () => { await stopDb(); });
  // The tenant registry lives in its own database (useDb), so clearDb() — which
  // only reaches the base connection's collections — does not touch it.
  t.beforeEach(async () => {
    await clearDb();
    await getTenantModel().deleteMany({});
    clearTenantCache();
  });

  // ── The finding ───────────────────────────────────────────────────────────
  await t.test('an apex custom domain resolves to its hotel', async () => {
    await tenant({ customDomain: 'hotelabc.com' });

    // parseSubdomain finds nothing here — that is the whole point.
    assert.equal(parseSubdomain('hotelabc.com'), null);

    const { tenant: got, error } = await resolveTenantForHost('hotelabc.com');
    assert.equal(error, undefined);
    assert.equal(got.slug, 'hotelabc', 'an apex custom domain fell through to the base tenant');
  });

  await t.test('www on a custom domain resolves to the same hotel', async () => {
    await tenant({ customDomain: 'hotelabc.com' });
    // "www" is a RESERVED subdomain, which used to take the early exit.
    const { tenant: got } = await resolveTenantForHost('www.hotelabc.com');
    assert.equal(got.slug, 'hotelabc', 'www on a custom domain fell through to the base tenant');
  });

  await t.test('a reserved prefix on a custom domain reaches the hotel, not the platform', async () => {
    await tenant({ customDomain: 'hotelabc.com' });
    const { tenant: got } = await resolveTenantForHost('admin.hotelabc.com');
    assert.equal(got.slug, 'hotelabc');
  });

  await t.test('a custom domain with a port still resolves', async () => {
    await tenant({ customDomain: 'hotelabc.com' });
    const { tenant: got } = await resolveTenantForHost('hotelabc.com:8443');
    assert.equal(got.slug, 'hotelabc');
  });

  // ── The platform's own hosts must not regress ─────────────────────────────
  await t.test('the platform apex is still the base tenant', async () => {
    await tenant({ customDomain: 'hotelabc.com' });
    const { tenant: got } = await resolveTenantForHost('example.com');
    assert.equal(got.slug, BASE_TENANT.slug);
  });

  await t.test('a reserved platform prefix is still the base tenant', async () => {
    const { tenant: got } = await resolveTenantForHost('admin.example.com');
    assert.equal(got.slug, BASE_TENANT.slug);
  });

  await t.test('localhost and bare IPs are the base tenant', async () => {
    assert.equal((await resolveTenantForHost('localhost')).tenant.slug, BASE_TENANT.slug);
    assert.equal((await resolveTenantForHost('187.127.163.51')).tenant.slug, BASE_TENANT.slug);
  });

  // ── Platform subdomains ───────────────────────────────────────────────────
  await t.test('a platform subdomain resolves to its hotel', async () => {
    await tenant();
    const { tenant: got } = await resolveTenantForHost('hotelabc.example.com');
    assert.equal(got.slug, 'hotelabc');
  });

  await t.test('an unregistered platform subdomain is refused, not given the base data', async () => {
    const { error } = await resolveTenantForHost('nosuchhotel.example.com');
    assert.equal(error, 'unknown');
  });

  await t.test('an unknown domain entirely is refused', async () => {
    const { error } = await resolveTenantForHost('some-random-domain.net');
    assert.equal(error, 'unknown', 'an unregistered domain was served the operator\'s data');
  });

  // ── The cross-match this turned up ────────────────────────────────────────
  await t.test('a tenant subdomain on someone else\'s domain does not match', async () => {
    await tenant();  // subdomain "hotelabc" on the platform
    // Point hotelabc.attacker.example at this server. The lookup used to be one
    // $or query, so the first label alone was enough to reach the tenant.
    const { tenant: got, error } = await resolveTenantForHost('hotelabc.attacker-domain.net');
    assert.equal(got, undefined, 'a foreign domain reached a tenant by its subdomain label');
    assert.equal(error, 'unknown');
  });

  // ── Lifecycle ─────────────────────────────────────────────────────────────
  await t.test('a suspended hotel is refused by custom domain too', async () => {
    await tenant({ customDomain: 'hotelabc.com', status: 'suspended' });
    assert.equal((await resolveTenantForHost('hotelabc.com')).error, 'suspended');
  });

  await t.test('a hotel still provisioning is told so', async () => {
    await tenant({ customDomain: 'hotelabc.com', status: 'provisioning' });
    assert.equal((await resolveTenantForHost('hotelabc.com')).error, 'provisioning');
  });

  await t.test('the custom domain wins over a subdomain collision', async () => {
    // One hotel owns the domain; another happens to use that first label as its
    // platform subdomain. The domain owner must win on their own domain.
    await tenant({ slug: 'owner', subdomain: 'owner', dbName: 'db_owner', customDomain: 'shared.com' });
    await tenant({ slug: 'other', subdomain: 'shared', dbName: 'db_other' });

    const { tenant: got } = await resolveTenantForHost('shared.com');
    assert.equal(got.slug, 'owner');
  });
});
