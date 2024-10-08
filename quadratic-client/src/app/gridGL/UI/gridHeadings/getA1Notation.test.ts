import { describe, expect, it } from 'vitest';
import { getA1Notation, getColumnA1Notation, getRowA1Notation } from './getA1Notation';

describe('A1 notation translation', () => {
  it('gets column (based on tests in quadratic-core)', () => {
    // Test near 0
    expect(getColumnA1Notation(1)).toBe('A');
    expect(getColumnA1Notation(2)).toBe('B');
    expect(getColumnA1Notation(3)).toBe('C');
    expect(getColumnA1Notation(4)).toBe('D');
    expect(getColumnA1Notation(5)).toBe('E');
    expect(getColumnA1Notation(6)).toBe('F');

    // Test near ±26
    expect(getColumnA1Notation(25)).toBe('Y');
    expect(getColumnA1Notation(26)).toBe('Z');
    expect(getColumnA1Notation(27)).toBe('AA');
    expect(getColumnA1Notation(28)).toBe('AB');

    // Test near ±52
    expect(getColumnA1Notation(51)).toBe('AY');
    expect(getColumnA1Notation(52)).toBe('AZ');
    expect(getColumnA1Notation(53)).toBe('BA');
    expect(getColumnA1Notation(54)).toBe('BB');

    // Test near ±702
    expect(getColumnA1Notation(701)).toBe('ZY');
    expect(getColumnA1Notation(702)).toBe('ZZ');
    expect(getColumnA1Notation(703)).toBe('AAA');
    expect(getColumnA1Notation(704)).toBe('AAB');

    // tests too big to be stored as integers are skipped

    // Test 64 bit integer limits (±9,223,372,036,854,775,807)
    // expect(getColumnA1Notation(9223372036854775807n)).toBe('CRPXNLSKVLJFHH');

    // test fun stuff
    expect(getColumnA1Notation(3719092809669)).toBe('QUADRATIC');
  });

  it('gets row (positive)', () => {
    expect(getRowA1Notation(1)).toBe('1');
    expect(getRowA1Notation(100)).toBe('100');
  });

  it('gets both column and row', () => {
    expect(getA1Notation(1, 1)).toBe('A1');
    expect(getA1Notation(2, 2)).toBe('B2');
  });
});
