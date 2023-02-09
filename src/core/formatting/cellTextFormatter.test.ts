import { Cell, CellFormat } from '../gridDB/gridTypes';
import { CellTextFormat } from './cellTextFormat';
import { CellTextFormatter } from './cellTextFormatter';

const generateCell = (value: string) => {
  return {
    x: 0,
    y: 0,
    type: 'TEXT',
    value: value,
  } as Cell;
};

const generateFormat = (textFormat: CellTextFormat, decimals?: number) => {
  // allows tests to fit on one line below
  let format = {
    textFormat,
  } as CellFormat;
  if (decimals && format.textFormat) {
    format.textFormat.decimalPlaces = decimals;
  }
  return format;
};

test('CellTextFormatter', () => {
  // format undefined
  expect(CellTextFormatter(generateCell('$1'), undefined)).toBe('$1');
  expect(CellTextFormatter(generateCell('100%'), undefined)).toBe('100%');
  expect(CellTextFormatter(generateCell('hello'), undefined)).toBe('hello');

  // format number
  expect(CellTextFormatter(generateCell('1'), generateFormat({ type: 'NUMBER' }))).toBe('1.00');
  expect(CellTextFormatter(generateCell('1'), generateFormat({ type: 'NUMBER', decimalPlaces: 0 }))).toBe('1');
  expect(CellTextFormatter(generateCell('1'), generateFormat({ type: 'NUMBER', decimalPlaces: 1 }))).toBe('1.0');
  expect(CellTextFormatter(generateCell('1'), generateFormat({ type: 'NUMBER', decimalPlaces: 4 }))).toBe('1.0000');
  expect(CellTextFormatter(generateCell('0.009'), generateFormat({ type: 'NUMBER', decimalPlaces: 2 }))).toBe('0.01');
  expect(CellTextFormatter(generateCell('1000000'), generateFormat({ type: 'NUMBER' }))).toBe('1,000,000.00');

  // format currency
  const currencyFormat = generateFormat({ type: 'CURRENCY', display: 'CURRENCY', symbol: 'USD' });
  expect(CellTextFormatter(generateCell('1'), currencyFormat)).toBe('$1.00');
  expect(CellTextFormatter(generateCell('.01'), currencyFormat)).toBe('$0.01');
  expect(CellTextFormatter(generateCell('.009'), currencyFormat)).toBe('$0.01');
  expect(CellTextFormatter(generateCell('1000'), currencyFormat)).toBe('$1,000.00');

  // format percentage
  expect(CellTextFormatter(generateCell('1'), generateFormat({ type: 'PERCENTAGE' }))).toBe('100.00%');
  expect(CellTextFormatter(generateCell('.1'), generateFormat({ type: 'PERCENTAGE' }))).toBe('10.00%');
  expect(CellTextFormatter(generateCell('.01'), generateFormat({ type: 'PERCENTAGE' }))).toBe('1.00%');
  expect(CellTextFormatter(generateCell('.00009'), generateFormat({ type: 'PERCENTAGE' }))).toBe('0.01%');

  // format exponential
  expect(CellTextFormatter(generateCell('1'), generateFormat({ type: 'EXPONENTIAL' }))).toBe('1.00e+0');
  expect(CellTextFormatter(generateCell('1'), generateFormat({ type: 'EXPONENTIAL', decimalPlaces: 0 }))).toBe('1e+0');
  expect(CellTextFormatter(generateCell('1'), generateFormat({ type: 'EXPONENTIAL' }, 1))).toBe('1.0e+0');
  expect(CellTextFormatter(generateCell('1'), generateFormat({ type: 'EXPONENTIAL' }, 4))).toBe('1.0000e+0');
  expect(CellTextFormatter(generateCell('0.009'), generateFormat({ type: 'EXPONENTIAL' }, 2))).toBe('9.00e-3');
  expect(CellTextFormatter(generateCell('1000000'), generateFormat({ type: 'EXPONENTIAL' }))).toBe('1.00e+6');
});
