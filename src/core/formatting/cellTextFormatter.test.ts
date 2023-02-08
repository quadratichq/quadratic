import { Cell } from '../gridDB/gridTypes';
import { CellTextFormatter } from './cellTextFormatter';

const generateCell = (value: string, number_formatting_pattern?: string, date_formatting_pattern?: string) => {
  return {
    x: 0,
    y: 0,
    type: 'TEXT',
    value: value,
    number_formatting_pattern: number_formatting_pattern,
    date_formatting_pattern: date_formatting_pattern,
  } as Cell;
};

// test('CellTextFormatter', () => {
//   // doesn't format
//   expect(CellTextFormatter(generateCell('$1', '0.00'))).toBe('$1');
//   expect(CellTextFormatter(generateCell('100%', '0.00'))).toBe('100%');
//   expect(CellTextFormatter(generateCell('hello', '0.00'))).toBe('hello');

//   // formats
//   expect(CellTextFormatter(generateCell('1', '0.00'))).toBe('1.00');
//   expect(CellTextFormatter(generateCell('1', '0.00%'))).toBe('100.00%');
//   expect(CellTextFormatter(generateCell('15.999', '$0.00'))).toBe('$16.00');

//   // formats with decimals
//   expect(CellTextFormatter(generateCell('1.1', '0.00'))).toBe('1.10');
//   expect(CellTextFormatter(generateCell('1.1', '0.00%'))).toBe('110.00%');
//   expect(CellTextFormatter(generateCell('1', '0.000000'))).toBe('1.000000');

//   // formats with commas
//   expect(CellTextFormatter(generateCell('1000', '0,0'))).toBe('1,000');

//   // formats with currency
//   expect(CellTextFormatter(generateCell('1', '$0.00'))).toBe('$1.00');
//   expect(CellTextFormatter(generateCell('1', '0.00$'))).toBe('1.00$');
//   expect(CellTextFormatter(generateCell('1', '0.00 $'))).toBe('1.00 $');
//   expect(CellTextFormatter(generateCell('1', '$ 0.00'))).toBe('$ 1.00');
//   expect(CellTextFormatter(generateCell('1', '0.00 $'))).toBe('1.00 $');
//   expect(CellTextFormatter(generateCell('1', '0.00 $'))).toBe('1.00 $');
//   expect(CellTextFormatter(generateCell('1', '0.00 $'))).toBe('1.00 $');

//   // formats with currency and decimals
//   expect(CellTextFormatter(generateCell('1.1', '$0.00'))).toBe('$1.10');
//   expect(CellTextFormatter(generateCell('1.1', '0.00$'))).toBe('1.10$');

//   // formats with currency and commas
//   expect(CellTextFormatter(generateCell('1000', '$0,0'))).toBe('$1,000');

//   // formats with currency and decimals and commas
//   expect(CellTextFormatter(generateCell('1000.1', '$0,0.00'))).toBe('$1,000.10');

//   // formats with dates
//   expect(CellTextFormatter(generateCell('1/2/2022', undefined, 'MM/dd/yyyy'))).toBe('01/02/2022');
// });
