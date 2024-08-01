import { describe, it, expect } from 'vitest';
import { convertNumber, reduceDecimals } from './convertNumber';

describe('convertNumber', () => {
  it('using various number formatting', () => {
    expect(convertNumber('1234', { commas: null, decimals: null, format: null })).toBe('1234');
    expect(convertNumber('1234', { commas: true, decimals: null, format: null })).toBe('1,234');
    expect(convertNumber('1234', { commas: true, decimals: 2, format: null })).toBe('1,234.00');
    expect(convertNumber('1234', { commas: true, decimals: 2, format: { type: 'CURRENCY', symbol: '$' } })).toBe(
      '$1,234.00'
    );
    expect(convertNumber('1234.5678', { commas: true, decimals: 2, format: null })).toBe('1,234.57');
    expect(convertNumber('1234.5678', { commas: null, decimals: 5, format: null })).toBe('1234.56780');
    expect(
      convertNumber('0.01234', { commas: null, decimals: null, format: { type: 'PERCENTAGE', symbol: null } })
    ).toBe('1.234%');
    expect(
      convertNumber('123123222', { format: { type: 'EXPONENTIAL', symbol: null }, commas: null, decimals: null })
    ).toBe('1.23123222e+8');
    expect(
      convertNumber('123123222', { format: { type: 'EXPONENTIAL', symbol: null }, commas: null, decimals: 2 })
    ).toBe('1.23e+8');
    expect(
      convertNumber('0.0000001', { commas: null, decimals: null, format: { type: 'EXPONENTIAL', symbol: null } })
    ).toBe('1e-7');
  });

  it('reduceDecimals', () => {
    expect(reduceDecimals('1234.5678', '1234.5678', { commas: null, decimals: null, format: null })).toEqual({
      number: '1234.568',
      currentFractionDigits: 3,
    });
    expect(reduceDecimals('1234.5678', '1234.5678', { commas: null, decimals: null, format: null }, 2)).toEqual({
      number: '1234.57',
      currentFractionDigits: 2,
    });
    expect(
      reduceDecimals('$1234.5678', '1234.5678', {
        commas: null,
        decimals: null,
        format: { type: 'CURRENCY', symbol: '$' },
      })
    ).toEqual({ number: '$1,234.568', currentFractionDigits: 3 });
    expect(
      reduceDecimals(
        '$1234.5678',
        '1234.5678',
        {
          commas: null,
          decimals: null,
          format: { type: 'CURRENCY', symbol: '$' },
        },
        2
      )
    ).toEqual({ number: '$1,234.57', currentFractionDigits: 2 });
  });
});