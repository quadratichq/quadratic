import { format as formatNumber } from 'numerable';
import { format as formatDate } from 'date-fns';
import { Cell, CellFormat } from '../gridDB/gridTypes';
import { CellTextFormat, DEFAULT_NUMBER_OF_DECIMAL_PLACES } from './cellTextFormat';

// function that checks if a string is a number
const IsNumeric = (num: string) => /^-{0,1}\d*\.{0,1}\d+$/.test(num);

// function that checks if a string is a date
const IsDate = (date: string) => {
  //regex to check for date format with - or / as separator
  const date_regex = /^(\d{1,2})[-/](\d{1,2})[-/](\d{4})$/;
  if (!date_regex.test(date)) return false;
};

const GenerateDecimalPlaces = (format: CellTextFormat) => {
  // returns a string of the format '.00' for the number of decimal places
  const number_of_decimals = format.decimalPlaces ?? DEFAULT_NUMBER_OF_DECIMAL_PLACES;
  if (number_of_decimals === 0) return '';
  let decimalString = '.';
  for (let i = 0; i < number_of_decimals; i++) {
    decimalString += '0';
  }
  return decimalString;
};

export const CellTextFormatter = (cell: Cell, format: CellFormat | undefined) => {
  if (!format || !format.textFormat) return cell.value;

  const decimal_string = GenerateDecimalPlaces(format.textFormat);

  if (format.textFormat.type === 'CURRENCY' && IsNumeric(cell.value)) {
    return formatNumber(cell.value, '$0,0' + decimal_string, { currency: format.textFormat.symbol });
  } else if (format.textFormat.type === 'PERCENTAGE' && IsNumeric(cell.value)) {
    return cell.value + '%';
  } else if (format.textFormat.type === 'NUMBER' && IsNumeric(cell.value)) {
    return formatNumber(cell.value, '0,0' + decimal_string);
  } else if (format.textFormat.type === 'EXPONENTIAL' && IsNumeric(cell.value)) {
    return cell.value + 'e';
  } else if (format.textFormat.type === 'DATE' && IsDate(cell.value)) {
    return formatDate(new Date(cell.value), format.textFormat.format);
  }

  return cell.value;
};
