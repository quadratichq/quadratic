import { format as formatNumber } from 'numerable';
import { Cell, CellFormat } from '../gridDB/gridTypes';
import { CellTextFormat, DEFAULT_NUMBER_OF_DECIMAL_PLACES } from './cellTextFormat';

// function that checks if a string is a number
const IsNumeric = (num: string) => /^-{0,1}\d*\.{0,1}\d+$/.test(num);

const getDecimalPlacesString = (format: CellTextFormat, number_of_decimals: number) => {
  // returns a string of the format '.00' for the number of decimal places
  if (number_of_decimals === 0) return '';
  let decimalString = '.';
  for (let i = 0; i < number_of_decimals; i++) {
    decimalString += '0';
  }
  return decimalString;
};

export const CellTextFormatter = (cell: Cell, format: CellFormat | undefined) => {
  if (!format || !format.textFormat) return cell.value;

  const number_of_decimals = format.textFormat.decimalPlaces ?? DEFAULT_NUMBER_OF_DECIMAL_PLACES;
  const decimal_string = getDecimalPlacesString(format.textFormat, number_of_decimals);

  try {
    if (format.textFormat.type === 'CURRENCY' && IsNumeric(cell.value)) {
      return formatNumber(cell.value, `$0,0${decimal_string}`, { currency: format.textFormat.symbol });
    } else if (format.textFormat.type === 'PERCENTAGE' && IsNumeric(cell.value)) {
      return formatNumber(Number(cell.value), `0,0${decimal_string}%`);
    } else if (format.textFormat.type === 'NUMBER' && IsNumeric(cell.value)) {
      return formatNumber(cell.value, `0,0${decimal_string}`);
    } else if (format.textFormat.type === 'EXPONENTIAL' && IsNumeric(cell.value)) {
      return Number(cell.value).toExponential(number_of_decimals);
    }
  } catch (e) {
    console.error('Caught error in CellTextFormatter: ', e);
  }

  return cell.value;
};
