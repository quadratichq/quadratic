import { describe, expect, it } from 'vitest';
import { getColumnA1Notation, getRowA1Notation } from '../getA1Notation';

describe('A1 notation translation', () => {
  it('gets column (based on tests in quadratic-core)', () => {
    // Test near 0
    expect(getColumnA1Notation(0)).toBe('A');
    expect(getColumnA1Notation(1)).toBe('B');
    expect(getColumnA1Notation(2)).toBe('C');
    expect(getColumnA1Notation(3)).toBe('D');
    expect(getColumnA1Notation(4)).toBe('E');
    expect(getColumnA1Notation(5)).toBe('F');

    expect(getColumnA1Notation(-1)).toBe('nA');
    expect(getColumnA1Notation(-2)).toBe('nB');
    expect(getColumnA1Notation(-3)).toBe('nC');
    expect(getColumnA1Notation(-4)).toBe('nD');
    expect(getColumnA1Notation(-5)).toBe('nE');
    expect(getColumnA1Notation(-6)).toBe('nF');

    // Test near ±26
    expect(getColumnA1Notation(24)).toBe('Y');
    expect(getColumnA1Notation(25)).toBe('Z');
    expect(getColumnA1Notation(26)).toBe('AA');
    expect(getColumnA1Notation(27)).toBe('AB');
    expect(getColumnA1Notation(-25)).toBe('nY');
    expect(getColumnA1Notation(-26)).toBe('nZ');
    expect(getColumnA1Notation(-27)).toBe('nAA');
    expect(getColumnA1Notation(-28)).toBe('nAB');

    // Test near ±52
    expect(getColumnA1Notation(50)).toBe('AY');
    expect(getColumnA1Notation(51)).toBe('AZ');
    expect(getColumnA1Notation(52)).toBe('BA');
    expect(getColumnA1Notation(53)).toBe('BB');
    expect(getColumnA1Notation(-51)).toBe('nAY');
    expect(getColumnA1Notation(-52)).toBe('nAZ');
    expect(getColumnA1Notation(-53)).toBe('nBA');
    expect(getColumnA1Notation(-54)).toBe('nBB');

    // Test near ±702
    expect(getColumnA1Notation(700)).toBe('ZY');
    expect(getColumnA1Notation(701)).toBe('ZZ');
    expect(getColumnA1Notation(702)).toBe('AAA');
    expect(getColumnA1Notation(703)).toBe('AAB');
    expect(getColumnA1Notation(-701)).toBe('nZY');
    expect(getColumnA1Notation(-702)).toBe('nZZ');
    expect(getColumnA1Notation(-703)).toBe('nAAA');
    expect(getColumnA1Notation(-704)).toBe('nAAB');

    // tests too big to be stored as integers are skipped

    // // Test 64 bit integer limits (±9,223,372,036,854,775,807)
    // expect(getColumnA1Notation(9223372036854775807n)).toBe('CRPXNLSKVLJFHH');
    // expect(getColumnA1Notation(-9223372036854775808n)).toBe('nCRPXNLSKVLJFHH');

    // test fun stuff
    expect(getColumnA1Notation(3719092809668)).toBe('QUADRATIC');
    expect(getColumnA1Notation(-3719092809669)).toBe('nQUADRATIC');
    // expect(getColumnA1Notation(1700658608758053877)).toBe('QUICKBROWNFOX');
  });

  it('gets row (positive)', () => {
    expect(getRowA1Notation(0)).toBe('0');
    expect(getRowA1Notation(1)).toBe('1');
    expect(getRowA1Notation(100)).toBe('100');
  });

  it('gets row (negative)', () => {
    expect(getRowA1Notation(-1)).toBe('n1');
    expect(getRowA1Notation(-100)).toBe('n100');
  });
});
