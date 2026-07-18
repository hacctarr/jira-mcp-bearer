/**
 * Unit tests for priority normalization.
 *
 * Jira accepts a priority as either { name: "High" } or { id: "2" }.
 * normalizePriority turns a friendly string (or an already-shaped object) into
 * the object Jira expects, so the create/update tools can take "High" directly.
 */

import { normalizePriority } from '../lib/utils.js';

describe('normalizePriority', () => {
  test('treats a non-numeric string as a priority name', () => {
    expect(normalizePriority('High')).toEqual({ name: 'High' });
  });

  test('treats a numeric string as a priority id', () => {
    expect(normalizePriority('2')).toEqual({ id: '2' });
  });

  test('treats a number as a priority id', () => {
    expect(normalizePriority(3)).toEqual({ id: '3' });
  });

  test('trims surrounding whitespace on names', () => {
    expect(normalizePriority('  Critical  ')).toEqual({ name: 'Critical' });
  });

  test('passes an already-shaped object through unchanged', () => {
    expect(normalizePriority({ id: '1' })).toEqual({ id: '1' });
    expect(normalizePriority({ name: 'Low' })).toEqual({ name: 'Low' });
  });

  test('returns undefined for null/undefined/empty', () => {
    expect(normalizePriority(undefined)).toBeUndefined();
    expect(normalizePriority(null)).toBeUndefined();
    expect(normalizePriority('')).toBeUndefined();
    expect(normalizePriority('   ')).toBeUndefined();
  });
});
