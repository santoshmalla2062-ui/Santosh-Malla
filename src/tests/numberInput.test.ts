import test from 'node:test';
import assert from 'node:assert/strict';
import {
  formatNumericValue,
  parseNumericDraft,
  sanitizeNumericDraft
} from '../utils/numberInput';

test('Numeric Input Sanitizer: Clearing 100 stays empty, 01000 strips leading zero, and decimals work cleanly', () => {
  // User deletes 100 -> "" must remain "" (never snapped back to "0")
  assert.strictEqual(sanitizeNumericDraft(''), '');

  // Typing "1000" after a leftover "0" must produce "1000", never "01000"
  assert.strictEqual(sanitizeNumericDraft('01'), '1');
  assert.strictEqual(sanitizeNumericDraft('01000'), '1000');
  assert.strictEqual(sanitizeNumericDraft('000250'), '250');

  // Typing "0" intentionally keeps "0", and "00" collapses to "0"
  assert.strictEqual(sanitizeNumericDraft('0'), '0');
  assert.strictEqual(sanitizeNumericDraft('00'), '0');

  // Decimals like 0., 0.5, 00.75, 125.50 work naturally
  assert.strictEqual(sanitizeNumericDraft('0.'), '0.');
  assert.strictEqual(sanitizeNumericDraft('0.5'), '0.5');
  assert.strictEqual(sanitizeNumericDraft('00.75'), '0.75');
  assert.strictEqual(sanitizeNumericDraft('125.50'), '125.50');
  assert.strictEqual(sanitizeNumericDraft('12.3.4'), '12.34');

  // Non-numeric characters and letters stripped cleanly
  assert.strictEqual(sanitizeNumericDraft('Rs1,250.5a'), '1250.5');

  // Integer mode disallows decimal points
  assert.strictEqual(sanitizeNumericDraft('12.5', { allowDecimal: false }), '125');

  // Negative handling
  assert.strictEqual(sanitizeNumericDraft('-0100', { allowNegative: true }), '-100');
  assert.strictEqual(sanitizeNumericDraft('-100', { allowNegative: false }), '100');
});

test('Numeric Input Parser & Formatter: Safe parsing, bounds clamping, and blankWhenZero formatting', () => {
  assert.strictEqual(parseNumericDraft(''), 0);
  assert.strictEqual(parseNumericDraft('', { emptyValue: 1 }), 1);
  assert.strictEqual(parseNumericDraft('.'), 0);
  assert.strictEqual(parseNumericDraft('1000'), 1000);
  assert.strictEqual(parseNumericDraft('0.5'), 0.5);
  assert.strictEqual(parseNumericDraft('.5'), 0.5);
  assert.strictEqual(parseNumericDraft('150', { max: 100 }), 100);
  assert.strictEqual(parseNumericDraft('0', { min: 1 }), 1);
  assert.strictEqual(parseNumericDraft('12.9', { integer: true }), 12);

  assert.strictEqual(formatNumericValue(0, false), '0');
  assert.strictEqual(formatNumericValue(0, true), '');
  assert.strictEqual(formatNumericValue(1000, true), '1000');
  assert.strictEqual(formatNumericValue(null, false), '');
});
