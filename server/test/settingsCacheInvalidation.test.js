// A changed setting has to take effect now, not in fifteen seconds.
//
// getBilling()/getOps() cache the billing and operations sections per tenant.
// Invalidation used to be a call in the controller, and there was one of them
// against nine write sites — so PUT /api/settings saved and never invalidated,
// and resetSettings wiped the document while the cache served the old values.
import test from 'node:test';
import assert from 'node:assert/strict';

import { startDb, stopDb, clearDb, skipReason } from './helpers/memoryDb.js';
import Settings from '../models/Settings.js';
import { getBilling, getOps, invalidateOperationalConfig } from '../config/operationalConfig.js';
import { updateAllSettings, updateSettingsSection } from '../controllers/settingsController.js';
import paymentService from '../services/paymentService.js';

const ready = await startDb();

const call = async (handler, { body = {}, params = {} } = {}) => {
  const res = { statusCode: 200, body: null };
  res.status = (c) => { res.statusCode = c; return res; };
  res.json = (b) => { res.body = b; return res; };
  await handler({ body, params, query: {}, user: { isSystemAdmin: true } }, res);
  return res;
};

test('operational config cache invalidation', { skip: ready ? false : skipReason, timeout: 60_000 }, async (t) => {
  t.after(async () => { await stopDb(); });
  t.beforeEach(async () => { await clearDb(); invalidateOperationalConfig({ allTenants: true }); });

  await t.test('PUT /api/settings takes effect immediately', async () => {
    await Settings.create({ hotelName: 'Test Hotel', billing: { roomGstRate: 5, invoicePrefix: 'AAA' } });
    assert.equal((await getBilling()).roomGstRate, 5);   // warms the cache

    const res = await call(updateAllSettings, {
      body: { billing: { roomGstRate: 12, invoicePrefix: 'BBB' } },
    });
    assert.equal(res.statusCode, 200, `${res.body?.message}: ${res.body?.error}`);

    const billing = await getBilling();
    assert.equal(billing.roomGstRate, 12, 'the old GST rate was still being served');
    assert.equal(billing.invoicePrefix, 'BBB', 'the old invoice prefix was still being served');
  });

  await t.test('a section update still takes effect immediately', async () => {
    await Settings.create({ hotelName: 'Test Hotel', billing: { roomGstRate: 5 } });
    await getBilling();

    await call(updateSettingsSection, { params: { section: 'billing' }, body: { roomGstRate: 18 } });
    assert.equal((await getBilling()).roomGstRate, 18);
  });

  await t.test('a reset stops serving the settings it just deleted', async () => {
    await Settings.create({ hotelName: 'Test Hotel', billing: { roomGstRate: 28, invoicePrefix: 'OLD' } });
    assert.equal((await getBilling()).roomGstRate, 28);   // warms the cache

    // resetSettings deletes the document and recreates it at defaults.
    await Settings.resetSettings();

    const billing = await getBilling();
    assert.notEqual(billing.roomGstRate, 28, 'a deleted GST rate was still being served');
    assert.notEqual(billing.invoicePrefix, 'OLD', 'a deleted invoice prefix was still being served');

    // The reset used to delete by an _id it never had, so the old document
    // survived and a second one was created beside it.
    assert.equal(await Settings.countDocuments(), 1, 'the reset left a duplicate settings document');
    assert.equal((await Settings.findOne().lean()).hotelName, 'Test Hotel', 'the reset erased the hotel name');
  });

  await t.test('front-desk operations changes take effect immediately', async () => {
    await Settings.create({
      hotelName: 'Test Hotel',
      operations: { frontDesk: { allowOverbooking: false, holdExpiryHours: 24 } },
    });
    assert.equal((await getOps()).frontDesk.allowOverbooking, false);

    await call(updateAllSettings, {
      body: { operations: { frontDesk: { allowOverbooking: true, holdExpiryHours: 2 } } },
    });

    const ops = await getOps();
    assert.equal(ops.frontDesk.allowOverbooking, true, 'overbooking stayed off after being switched on');
    assert.equal(ops.frontDesk.holdExpiryHours, 2);
  });

  // ── The payment gateway client ────────────────────────────────────────────
  // updateSettingsSection reloaded it; updateAllSettings did not. So
  // PUT /api/settings could change the Razorpay credentials while the live
  // client went on using the old ones until a restart.
  await t.test('PUT /api/settings reaches the payment gateway client', async () => {
    await Settings.create({
      hotelName: 'Test Hotel',
      payment: { razorpay: { enabled: true, environment: 'test', keyId: 'rzp_test_OLD', keySecret: 'old-secret' } },
    });
    assert.equal((await paymentService.getConfig()).keySecret, 'old-secret');   // warms the cache

    const res = await call(updateAllSettings, {
      body: { payment: { razorpay: { enabled: true, environment: 'live', keyId: 'rzp_live_NEW', keySecret: 'new-secret' } } },
    });
    assert.equal(res.statusCode, 200, `${res.body?.message}: ${res.body?.error}`);

    const cfg = await paymentService.getConfig();
    assert.equal(cfg.keySecret, 'new-secret', 'the gateway client kept the old credentials');
    assert.equal(cfg.environment, 'live', 'the gateway client kept the old environment');
  });

  await t.test('a section update still reaches the payment client', async () => {
    await Settings.create({
      hotelName: 'Test Hotel',
      payment: { razorpay: { enabled: true, environment: 'test', keyId: 'rzp_test_OLD', keySecret: 'old-secret' } },
    });
    await paymentService.getConfig();

    await call(updateSettingsSection, {
      params: { section: 'payment' },
      body: { razorpay: { enabled: true, environment: 'test', keyId: 'rzp_test_NEW', keySecret: 'newer-secret' } },
    });
    assert.equal((await paymentService.getConfig()).keySecret, 'newer-secret');
  });

  await t.test('disabling the gateway takes effect immediately', async () => {
    await Settings.create({
      hotelName: 'Test Hotel',
      payment: { razorpay: { enabled: true, environment: 'test', keyId: 'rzp_test_X', keySecret: 'a-secret' } },
    });
    assert.equal((await paymentService.getConfig()).enabled, true);

    await call(updateAllSettings, { body: { payment: { razorpay: { enabled: false } } } });
    assert.equal((await paymentService.getConfig()).enabled, false, 'a disabled gateway kept accepting payments');
  });

  // The write surface is bigger than the controllers: scripts/updateGstPan.js
  // and scripts/setupPayment.js write settings and never invalidated anything.
  await t.test('a write query invalidates too, not only a document save', async () => {
    await Settings.create({ hotelName: 'Test Hotel', billing: { roomGstRate: 5 } });
    await getBilling();

    await Settings.updateOne({}, { $set: { 'billing.roomGstRate': 9 } });
    assert.equal((await getBilling()).roomGstRate, 9, 'an updateOne left the cache stale');

    // scripts/setupPayment.js writes keys this way and never reloaded anything.
    await Settings.updateOne({}, { $set: { 'payment.razorpay': { enabled: true, environment: 'test', keyId: 'rzp_test_S', keySecret: 'script-secret' } } });
    assert.equal((await paymentService.getConfig()).keySecret, 'script-secret',
      'a direct write left the gateway client on its old credentials');
  });

  await t.test('a raw findOneAndUpdate invalidates too', async () => {
    await Settings.create({ hotelName: 'Test Hotel', billing: { invoicePrefix: 'AAA' } });
    await getBilling();

    await Settings.findOneAndUpdate({}, { $set: { 'billing.invoicePrefix': 'ZZZ' } });
    assert.equal((await getBilling()).invoicePrefix, 'ZZZ', 'a findOneAndUpdate left the cache stale');
  });

  await t.test('a deleteMany invalidates too', async () => {
    await Settings.create({ hotelName: 'Test Hotel', billing: { invoicePrefix: 'GONE' } });
    assert.equal((await getBilling()).invoicePrefix, 'GONE');

    await Settings.deleteMany({});
    assert.notEqual((await getBilling()).invoicePrefix, 'GONE', 'a deleted prefix was still being served');
  });
});
