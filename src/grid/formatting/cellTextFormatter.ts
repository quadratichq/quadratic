import { format as formatNumber } from 'numerable';
import { CellRust } from '../../gridGL/cells/CellsTypes';
import { isStringANumber } from '../../helpers/isStringANumber';
import { Cell, CellFormat } from '../../schemas';
import { DEFAULT_NUMBER_OF_DECIMAL_PLACES } from './cellTextFormat';

const getDecimalPlacesString = (number_of_decimals: number) => {
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
  const decimal_string = getDecimalPlacesString(number_of_decimals);

  try {
    if (format.textFormat.type === 'CURRENCY' && isStringANumber(cell.value)) {
      return formatNumber(cell.value, `$0,0${decimal_string}`, { currency: format.textFormat.symbol });
    } else if (format.textFormat.type === 'PERCENTAGE' && isStringANumber(cell.value)) {
      return formatNumber(Number(cell.value), `0,0${decimal_string}%`);
    } else if (format.textFormat.type === 'NUMBER' && isStringANumber(cell.value)) {
      return formatNumber(cell.value, `0,0${decimal_string}`);
    } else if (format.textFormat.type === 'EXPONENTIAL' && isStringANumber(cell.value)) {
      return Number(cell.value).toExponential(number_of_decimals);
    }
  } catch (e) {
    console.error('Caught error in CellTextFormatter: ', e);
  }

  return cell.value;
};

export const cellTextFormatterRust = (cell: CellRust) => {
  if (!cell.textFormat) return cell.value.value;
  const number_of_decimals = cell.textFormat.decimalPlaces ?? DEFAULT_NUMBER_OF_DECIMAL_PLACES;
  const decimal_string = getDecimalPlacesString(number_of_decimals);

  try {
    const value = cell.value.value.toString();
    if (cell.textFormat.type === 'CURRENCY' && isStringANumber(value)) {
      return formatNumber(value, `$0,0${decimal_string}`, { currency: cell.textFormat.symbol });
    } else if (cell.textFormat.type === 'PERCENTAGE' && isStringANumber(value)) {
      return formatNumber(Number(value), `0,0${decimal_string}%`);
    } else if (cell.textFormat.type === 'NUMBER' && isStringANumber(value)) {
      return formatNumber(value, `0,0${decimal_string}`);
    } else if (cell.textFormat.type === 'EXPONENTIAL' && isStringANumber(value)) {
      return Number(value).toExponential(number_of_decimals);
    }
  } catch (e) {
    console.log(cell);
    console.error('Caught error in CellTextFormatter: ', e);
  }

  return cell.value.value;
};
