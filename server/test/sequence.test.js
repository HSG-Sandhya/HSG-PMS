import test from 'node:test';
import assert from 'node:assert/strict';
import { isDuplicateKeyError, withDuplicateRetry } from '../services/sequence.js';

// Numbering used read-latest-then-add-one, so two requests in the same moment
// chose the same number and the second died on the unique index. The counter
// prevents that; this retry covers numbers that predate it or were typed by hand.
const duplicate = () => Object.assign(new Error('E11000 duplicate key'), { code: 11000 });

test('a duplicate-key error is recognised, other failures are not', () => {
  assert.equal(isDuplicateKeyError(duplicate()), true);
  assert.equal(isDuplicateKeyError(new Error('connection reset')), false);
  assert.equal(isDuplicateKeyError({ code: 121 }), false);
  assert.equal(isDuplicateKeyError(null), false);
});

test('a duplicate is retried until it succeeds', async () => {
  let calls = 0;
  const result = await withDuplicateRetry(async () => {
    calls += 1;
    if (calls < 3) throw duplicate();
    return `ORD-${calls}`;
  });
  assert.equal(result, 'ORD-3');
  assert.equal(calls, 3);
});

test('the attempt number is passed through, so a caller can vary its candidate', async () => {
  const seen = [];
  await withDuplicateRetry(async (i) => {
    seen.push(i);
    if (i < 2) throw duplicate();
    return 'ok';
  });
  assert.deepEqual(seen, [0, 1, 2]);
});

test('a non-duplicate failure is thrown immediately, not retried', async () => {
  let calls = 0;
  await assert.rejects(
    withDuplicateRetry(async () => { calls += 1; throw new Error('database is down'); }),
    /database is down/,
  );
  assert.equal(calls, 1, 'must not retry a failure it cannot fix');
});

test('retries are bounded', async () => {
  let calls = 0;
  await assert.rejects(
    withDuplicateRetry(async () => { calls += 1; throw duplicate(); }, 2),
    /E11000/,
  );
  assert.equal(calls, 3, 'initial attempt plus 2 retries');
});
