// A real MongoDB for the tests that cannot be written without one.
//
// Most of this suite is pure and runs in milliseconds. The concurrency tests
// are different: a check-then-insert race only exists because two callers reach
// the database at the same moment, so proving it is closed needs a database
// that actually enforces the writes.
//
// Preference order:
//   MONGODB_TEST_URI   — an explicit scratch database, used as-is
//   mongodb-memory-server — a throwaway mongod, the default locally
//
// If neither is available the caller skips rather than fails: a machine without
// the mongod binary (a locked-down VPS, CI with no network) should not turn a
// green suite red. `describeSkip()` reports WHY, so a permanently skipped test
// cannot hide silently.
import mongoose from 'mongoose';

let memoryServer = null;
export let skipReason = null;

export const startDb = async () => {
  if (process.env.MONGODB_TEST_URI) {
    await mongoose.connect(process.env.MONGODB_TEST_URI, { serverSelectionTimeoutMS: 8000 });
    return true;
  }
  try {
    const { MongoMemoryServer } = await import('mongodb-memory-server');
    memoryServer = await MongoMemoryServer.create();
    await mongoose.connect(memoryServer.getUri('pms_test'));
    return true;
  } catch (err) {
    skipReason = `no test database available (${err.message.split('\n')[0]})`;
    return false;
  }
};

export const stopDb = async () => {
  // Only ever drops the database the tests themselves connected to.
  if (mongoose.connection.readyState === 1) await mongoose.connection.dropDatabase();
  await mongoose.disconnect();
  await memoryServer?.stop();
};

export const clearDb = async () => {
  const { collections } = mongoose.connection;
  await Promise.all(Object.values(collections).map((c) => c.deleteMany({})));
};

/**
 * Cut every outbound channel before a test touches a controller.
 *
 * Controllers pull in dotenv, so a developer's real SMTP and SMS credentials
 * are loaded by the time a test runs. Exercising a booking path then sends
 * actual mail and actual SMS from a test run -- which is exactly what happened
 * the first time this file's tests were run.
 *
 * Called from the test body, never at import time: dotenv loads while the
 * modules above are being imported and would simply put the values back.
 */
export const silenceOutbound = () => {
  const channels = [
    /^SMTP_/, /^EMAIL_(USER|PASSWORD)$/, /^SMS_PROVIDER$/, /^WA_PROVIDER$/,
    /^TWILIO_/, /^FAST2SMS_/, /^MSG91_/, /^WHATSAPP_/, /^RAZORPAY_/, /^SUREPASS_/,
  ];
  for (const key of Object.keys(process.env)) {
    if (channels.some((re) => re.test(key))) delete process.env[key];
  }
};
