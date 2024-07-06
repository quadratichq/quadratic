import { describe, it, expect } from 'vitest';
import { convertNumber } from './convertNumber';

describe('convertNumber', () => {
  it('shows a normal number with no formatting', () => {
    expect(convertNumber('1234', { commas: null, decimals: null, format: null })).toBe('1234');
    expect(convertNumber('1234', { commas: true, decimals: null, format: null })).toBe('1,234');
    expect(convertNumber('1234', { commas: true, decimals: 2, format: null })).toBe('1,234.00');
    expect(convertNumber('1234', { commas: true, decimals: 2, format: { type: 'CURRENCY', symbol: '$' } })).toBe('$1,234.00');
    expect(convertNumber('1234.5678', { commas: true, decimals: 2, format: null })).toBe('1,234.57');
    expect(convertNumber('1234.5678', { commas: null, decimals: 5, format: null })).toBe('1234.56780');
    expect(convertNumber('0.01234', { commas: null, decimals: null, format: { type: 'PERCENTAGE', symbol: null } })).toBe('1.234%');
  });
});