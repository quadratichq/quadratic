import { describe, expect, it } from 'vitest';
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
      convertNumber('123456789', { commas: null, decimals: null, format: { type: 'EXPONENTIAL', symbol: null } })
    ).toBe('1.23e+8');
    expect(
      convertNumber('123456789', { commas: null, decimals: 3, format: { type: 'EXPONENTIAL', symbol: null } })
    ).toBe('1.235e+8');
    expect(
      convertNumber('123456789', { commas: null, decimals: 0, format: { type: 'EXPONENTIAL', symbol: null } })
    ).toBe('1e+8');
    expect(
      convertNumber('0.0000001', { commas: null, decimals: null, format: { type: 'EXPONENTIAL', symbol: null } })
    ).toBe('1.00e-7');
    expect(
      convertNumber('123456789', { commas: null, decimals: null, format: { type: 'EXPONENTIAL', symbol: null } })
    ).toBe('1.23e+8');
    expect(
      convertNumber('-123456789', { commas: null, decimals: null, format: { type: 'EXPONENTIAL', symbol: null } })
    ).toBe('-1.23e+8');
    expect(
      convertNumber('100200100.1234', { commas: null, decimals: null, format: { type: 'CURRENCY', symbol: '$' } })
    ).toBe('$100,200,100.12');
    expect(
      convertNumber('-100200100.1234', { commas: null, decimals: null, format: { type: 'CURRENCY', symbol: '$' } })
    ).toBe('-$100,200,100.12');
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
      reduceDecimals('1234.5678', '1234.5678', {
        commas: null,
        decimals: null,
        format: { type: 'CURRENCY', symbol: '$' },
      })
    ).toEqual({ number: '$1,234.568', currentFractionDigits: 3 });
    expect(
      reduceDecimals(
        '1234.5678',
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
  expect(
    reduceDecimals(
      '123456789',
      '1.23456789e+8',
      {
        commas: null,
        decimals: null,
        format: { type: 'EXPONENTIAL', symbol: null },
      },
      undefined
    )
  ).toEqual({ number: '1.2345679e+8', currentFractionDigits: 7 });
  expect(
    reduceDecimals(
      '123456789',
      '1e+8',
      { commas: null, decimals: null, format: { type: 'EXPONENTIAL', symbol: null } },
      0
    )
  ).toEqual(undefined);
  expect(
    reduceDecimals(
      '0.3333333333333333',
      '33.33333333333333%',
      { commas: null, decimals: null, format: { type: 'PERCENTAGE', symbol: null } },
      4
    )
  ).toEqual({ number: '33.3333%', currentFractionDigits: 4 });
});
