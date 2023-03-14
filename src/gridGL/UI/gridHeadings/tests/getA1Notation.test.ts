import { getColumnA1Notation, getRowA1Notation } from '../getA1Notation';

describe('A1 notation translation', () => {
  it('gets column (positive)', () => {
    expect(getColumnA1Notation(0)).toBe('A');
    expect(getColumnA1Notation(1)).toBe('B');
    expect(getColumnA1Notation(25)).toBe('Z');
    expect(getColumnA1Notation(26)).toBe('AA');
    expect(getColumnA1Notation(100)).toBe('CW');
  });

  it('gets column name (negative)', () => {
    expect(getColumnA1Notation(-1)).toBe('nA');
    expect(getColumnA1Notation(-26)).toBe('nZ');
    expect(getColumnA1Notation(-27)).toBe('nAA');
    expect(getColumnA1Notation(-100)).toBe('nCV');
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
