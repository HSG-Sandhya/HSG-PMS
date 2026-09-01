import test from 'node:test';
import assert from 'node:assert/strict';
import { roundMoney, balanceOf } from '../utils/money.js';

// Rupee amounts are JS numbers, so decimal rates drift. The drift is harmless
// until something COMPARES the result — the invoice templates decide paid-status
// with `balance <= 0`, so a crumb of 1e-13 prints a settled bill as "partial".
test('a fully-settled booking has a zero balance, not a floating-point crumb', () => {
  const total = 1099.9 * 7;          // 7699.300000000001
  assert.notEqual(total - 7699.3, 0, 'precondition: raw subtraction drifts');
  assert.equal(balanceOf(total, 7699.3), 0);
});

test('balanceOf never returns a negative (overpayment reads as settled)', () => {
  assert.equal(balanceOf(100, 150), 0);
  assert.equal(balanceOf(0, 0), 0);
});

test('balanceOf keeps genuine outstanding amounts', () => {
  assert.equal(balanceOf(5000, 2000), 3000);
  assert.equal(balanceOf(2499.5, 1000), 1499.5);
  assert.equal(balanceOf(100.55, 0.55), 100);
});

test('repeated addition and multiplication agree once normalised', () => {
  const rate = 1099.9, nights = 7;
  const byMultiply = rate * nights;
  const byAdd = Array.from({ length: nights }).reduce((s) => s + rate, 0);
  assert.notEqual(byMultiply, byAdd, 'precondition: the two disagree raw');
  assert.equal(roundMoney(byMultiply), roundMoney(byAdd));
});

test('roundMoney is paise-accurate and safe on junk input', () => {
  assert.equal(roundMoney(0.1 + 0.2), 0.3);
  assert.equal(roundMoney(2.005), 2.01);
  assert.equal(roundMoney(1234.5678), 1234.57);
  for (const junk of [NaN, undefined, null, 'abc', Infinity]) {
    assert.equal(roundMoney(junk), 0, `${junk} must not poison a total`);
  }
});
