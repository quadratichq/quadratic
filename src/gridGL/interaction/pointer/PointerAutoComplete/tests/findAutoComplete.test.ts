import { findAutoComplete } from '../findAutoComplete';

describe('findAutoComplete', () => {
  it('Copies a series w/wrap', () => {
    expect(findAutoComplete({ series: ['Aas', 'asdfB', 'dsas'], spaces: 7, negative: false })).toEqual([
      'Aas',
      'asdfB',
      'dsas',
      'Aas',
      'asdfB',
      'dsas',
      'Aas',
    ]);
  });

  it('Finds a series of numbers (+1)', () => {
    expect(findAutoComplete({ series: ['1', '2', '3'], spaces: 4, negative: false })).toEqual(['4', '5', '6', '7']);
  });

  it('Finds a series of numbers (+2)', () => {
    expect(findAutoComplete({ series: ['2', '4', '6'], spaces: 4, negative: false })).toEqual(['8', '10', '12', '14']);
  });

  it('Finds a series of numbers (-1)', () => {
    expect(findAutoComplete({ series: ['6', '5', '4'], spaces: 4, negative: false })).toEqual(['3', '2', '1', '0']);
  });

  it('Finds a series of numbers (-2)', () => {
    expect(findAutoComplete({ series: ['6', '4', '2'], spaces: 4, negative: false })).toEqual(['0', '-2', '-4', '-6']);
  });

  it('Finds a series of numbers (+1) negative', () => {
    expect(findAutoComplete({ series: ['1', '2', '3'], spaces: 4, negative: true })).toEqual(['-3', '-2', '-1', '0']);
  });

  it('Finds a series of numbers (+2) negative', () => {
    expect(findAutoComplete({ series: ['2', '4', '6'], spaces: 4, negative: true })).toEqual(['-6', '-4', '-2', '0']);
  });

  it('Finds a series of numbers (-1) negative', () => {
    expect(findAutoComplete({ series: ['6', '5', '4'], spaces: 4, negative: true })).toEqual(['10', '9', '8', '7']);
  });

  it('Finds a series of numbers (-2) negative', () => {
    expect(findAutoComplete({ series: ['6', '4', '2'], spaces: 4, negative: true })).toEqual(['14', '12', '10', '8']);
  });

  it('Finds a series of letters (lowercase)', () => {
    expect(findAutoComplete({ series: ['a', 'b', 'c'], spaces: 4, negative: false })).toEqual(['d', 'e', 'f', 'g']);
  });

  it('Finds a series of letters (uppercase)', () => {
    expect(findAutoComplete({ series: ['D', 'E', 'F'], spaces: 4, negative: false })).toEqual(['G', 'H', 'I', 'J']);
  });

  it('Finds a series of letters (uppercase w/wrap)', () => {
    expect(findAutoComplete({ series: ['X', 'Y', 'Z'], spaces: 4, negative: false })).toEqual(['A', 'B', 'C', 'D']);
  });

  it('Finds a series of letters (lowercase, negative, and wrap)', () => {
    expect(findAutoComplete({ series: ['a', 'b', 'c'], spaces: 4, negative: true })).toEqual(['w', 'x', 'y', 'z']);
  });

  it('Finds a series of letters (uppercase and negative)', () => {
    expect(findAutoComplete({ series: ['D', 'E', 'F'], spaces: 4, negative: true })).toEqual(['Z', 'A', 'B', 'C']);
  });

  it('Finds a series of short months', () => {
    expect(findAutoComplete({ series: ['Jan', 'Feb', 'Mar'], spaces: 4, negative: false })).toEqual([
      'Apr',
      'May',
      'Jun',
      'Jul',
    ]);
  });

  it('Finds a series of short months (negative and wrap)', () => {
    expect(findAutoComplete({ series: ['JAN', 'FEB', 'MAR'], spaces: 4, negative: true })).toEqual([
      'SEP',
      'OCT',
      'NOV',
      'DEC',
    ]);
  });

  it('Finds a series of long months', () => {
    expect(findAutoComplete({ series: ['January', 'February'], spaces: 1, negative: false })).toEqual(['March']);
  });

  it('Finds a series of long months (negative and wrap)', () => {
    expect(findAutoComplete({ series: ['FEBRUARY', 'MARCH'], spaces: 2, negative: true })).toEqual([
      'DECEMBER',
      'JANUARY',
    ]);
  });
});
