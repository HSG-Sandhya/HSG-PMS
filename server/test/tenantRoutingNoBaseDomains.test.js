// The same resolver, with BASE_DOMAINS unset — which is how production runs
// today. The resolution order changed, so the hosts this deployment actually
// serves have to be proved unchanged, not assumed.
//
// A separate file because resolveTenant.js reads BASE_DOMAINS once at import,
// and node's test runner gives each file its own process.
import test from 'node:test';
import assert from 'node:assert/strict';

import { startDb, stopDb, clearDb, skipReason } from './helpers/memoryDb.js';
import { getTenantModel } from '../models/control/Tenant.js';
import { BASE_TENANT } from '../db/tenantContext.js';

delete process.env.BASE_DOMAINS;
const ready = await startDb();
const { resolveTenantForHost, clearTenantCache } = await import('../middleware/resolveTenant.js');

test('tenant routing without BASE_DOMAINS', { skip: ready ? false : skipReason, timeout: 60_000 }, async (t) => {
  t.after(async () => { await stopDb(); });
  t.beforeEach(async () => {
    await clearDb();
    await getTenantModel().deleteMany({});
    clearTenantCache();
  });

  // The four hosts this deployment is reached on today.
  await t.test('the live hosts all still resolve to the base tenant', async () => {
    for (const host of ['sandhyagrand.in', 'www.sandhyagrand.in', 'admin.sandhyagrand.in', '187.127.163.51', 'localhost']) {
      const { tenant, error } = await resolveTenantForHost(host);
      assert.equal(error, undefined, `${host} was refused`);
      assert.equal(tenant.slug, BASE_TENANT.slug, `${host} stopped resolving to the base tenant`);
    }
  });

  await t.test('an apex custom domain resolves even without BASE_DOMAINS', async () => {
    await getTenantModel().create({
      slug: 'hotelabc', name: 'Hotel ABC', subdomain: 'hotelabc',
      dbName: 'hotel_abc', status: 'active', customDomain: 'hotelabc.com',
    });
    const { tenant } = await resolveTenantForHost('hotelabc.com');
    assert.equal(tenant.slug, 'hotelabc');
  });

  await t.test('an unregistered non-reserved subdomain is still refused', async () => {
    assert.equal((await resolveTenantForHost('taj.sandhyagrand.in')).error, 'unknown');
  });

  await t.test('an unknown apex is served the base tenant — the documented cost of leaving BASE_DOMAINS unset', async () => {
    // Without knowing which domains are ours, an apex host cannot be told apart
    // from the operator's own. This is the pre-existing permissive behaviour,
    // pinned so that setting BASE_DOMAINS is a deliberate, visible change.
    const { tenant } = await resolveTenantForHost('someone-elses-domain.net');
    assert.equal(tenant.slug, BASE_TENANT.slug);
  });
});
