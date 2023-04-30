import { Cell } from '../../../../../schemas';
import { findAutoComplete } from '../findAutoComplete';

const stringToSeries = (s: string[]): Cell[] => {
  return s.map((value) => {
    return { type: 'TEXT', value } as Cell;
  });
};

describe('findAutoComplete', () => {
  it('Copies a series w/wrap', () => {
    expect(findAutoComplete({ series: stringToSeries(['Aas', 'asdfB', 'das']), spaces: 7, negative: false })).toEqual(
      stringToSeries(['Aas', 'asdfB', 'das', 'Aas', 'asdfB', 'das', 'Aas'])
    );
  });

  it('Finds a series of numbers (+1)', () => {
    expect(findAutoComplete({ series: stringToSeries(['1', '2', '3']), spaces: 4, negative: false })).toEqual(
      stringToSeries(['4', '5', '6', '7'])
    );
  });

  it('Finds a series of numbers (+2)', () => {
    expect(findAutoComplete({ series: stringToSeries(['2', '4', '6']), spaces: 4, negative: false })).toEqual(
      stringToSeries(['8', '10', '12', '14'])
    );
  });

  it('Finds a series of numbers (-1)', () => {
    expect(findAutoComplete({ series: stringToSeries(['6', '5', '4']), spaces: 4, negative: false })).toEqual(
      stringToSeries(['3', '2', '1', '0'])
    );
  });

  it('Finds a series of numbers (-2)', () => {
    expect(findAutoComplete({ series: stringToSeries(['6', '4', '2']), spaces: 4, negative: false })).toEqual(
      stringToSeries(['0', '-2', '-4', '-6'])
    );
  });

  it('Finds a series of numbers (+1) negative', () => {
    expect(findAutoComplete({ series: stringToSeries(['1', '2', '3']), spaces: 4, negative: true })).toEqual(
      stringToSeries(['-3', '-2', '-1', '0'])
    );
  });

  it('Finds a series of numbers (+2) negative', () => {
    expect(findAutoComplete({ series: stringToSeries(['2', '4', '6']), spaces: 4, negative: true })).toEqual(
      stringToSeries(['-6', '-4', '-2', '0'])
    );
  });

  it('Finds a series of numbers (-1) negative', () => {
    expect(findAutoComplete({ series: stringToSeries(['6', '5', '4']), spaces: 4, negative: true })).toEqual(
      stringToSeries(['10', '9', '8', '7'])
    );
  });

  it('Finds a series of numbers (-2) negative', () => {
    expect(findAutoComplete({ series: stringToSeries(['6', '4', '2']), spaces: 4, negative: true })).toEqual(
      stringToSeries(['14', '12', '10', '8'])
    );
  });

  it('Finds a series of letters (lowercase)', () => {
    expect(findAutoComplete({ series: stringToSeries(['a', 'b', 'c']), spaces: 4, negative: false })).toEqual(
      stringToSeries(['d', 'e', 'f', 'g'])
    );
  });

  it('Finds a series of letters (uppercase)', () => {
    expect(findAutoComplete({ series: stringToSeries(['D', 'E', 'F']), spaces: 4, negative: false })).toEqual(
      stringToSeries(['G', 'H', 'I', 'J'])
    );
  });

  it('Finds a series of letters (uppercase w/wrap)', () => {
    expect(findAutoComplete({ series: stringToSeries(['X', 'Y', 'Z']), spaces: 4, negative: false })).toEqual(
      stringToSeries(['A', 'B', 'C', 'D'])
    );
  });

  it('Finds a series of letters (lowercase, negative, and wrap)', () => {
    expect(findAutoComplete({ series: stringToSeries(['a', 'b', 'c']), spaces: 4, negative: true })).toEqual(
      stringToSeries(['w', 'x', 'y', 'z'])
    );
  });

  it('Finds a series of letters (uppercase and negative)', () => {
    expect(findAutoComplete({ series: stringToSeries(['D', 'E', 'F']), spaces: 4, negative: true })).toEqual(
      stringToSeries(['Z', 'A', 'B', 'C'])
    );
  });

  it('Finds a series of short months', () => {
    expect(findAutoComplete({ series: stringToSeries(['Jan', 'Feb', 'Mar']), spaces: 4, negative: false })).toEqual(
      stringToSeries(['Apr', 'May', 'Jun', 'Jul'])
    );
  });

  it('Finds a series of short months (negative and wrap)', () => {
    expect(findAutoComplete({ series: stringToSeries(['JAN', 'FEB', 'MAR']), spaces: 4, negative: true })).toEqual(
      stringToSeries(['SEP', 'OCT', 'NOV', 'DEC'])
    );
  });

  it('Finds a series of long months', () => {
    expect(findAutoComplete({ series: stringToSeries(['January', 'February']), spaces: 1, negative: false })).toEqual(
      stringToSeries(['March'])
    );
  });

  it('Finds a series of long months (negative and wrap)', () => {
    expect(findAutoComplete({ series: stringToSeries(['FEBRUARY', 'MARCH']), spaces: 2, negative: true })).toEqual(
      stringToSeries(['DECEMBER', 'JANUARY'])
    );
  });

  it('Continues a series', () => {
    expect(findAutoComplete({ series: stringToSeries(['c', 'd', 'e']), spaces: 4, negative: false })).toEqual(
      stringToSeries(['f', 'g', 'h', 'i'])
    );
  });

  it('Continues a series after a wrap', () => {
    expect(findAutoComplete({ series: stringToSeries(['Dec', 'Jan', 'Feb']), spaces: 4, negative: false })).toEqual(
      stringToSeries(['Mar', 'Apr', 'May', 'Jun'])
    );
  });

  it('Copies non-text cells w/formula', () => {
    const series: Cell[] = [];
    for (let i = 0; i < 5; i++) {
      series.push({ type: 'FORMULA', value: `1+${i}` } as Cell);
    }
    const results: Cell[] = [];
    for (let i = 0; i < 4; i++) {
      results.push({ type: 'FORMULA', value: `1+${i}` } as Cell);
    }
    expect(findAutoComplete({ series, spaces: 4, negative: false })).toEqual(results);
  });

  it('Copies a mix of text and empty cells', () => {
    const series: (Cell | undefined)[] = [
      { type: 'TEXT', value: 'a' } as Cell,
      undefined,
      { type: 'TEXT', value: 'c' } as Cell,
    ];
    const results = [...series, ...series];
    expect(findAutoComplete({ series, spaces: 6, negative: false })).toEqual(results);
  });
});
