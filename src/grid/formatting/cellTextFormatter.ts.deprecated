import { format as formatNumber } from 'numerable';
import { isStringANumber } from '../../helpers/isStringANumber';
import { JsRenderCell } from '../../quadratic-core/types';
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

export const cellTextFormatterRust = (cell: JsRenderCell): string => {
  let value: string;
  if (cell.value.type === 'blank') {
    throw new Error('Should not create a CellLabel from value.type = blank');
  } else if (cell.value.type === 'text') {
    value = cell.value.value;
  } else if (cell.value.type === 'number') {
    value = cell.value.value.toString();
  } else {
    throw new Error(`Unhandled value type ${cell.value.type} in cellTextFormatter`);
  }
  if (!cell.textFormat) return value;
  const number_of_decimals = cell.textFormat.decimalPlaces ?? DEFAULT_NUMBER_OF_DECIMAL_PLACES;
  const decimal_string = getDecimalPlacesString(number_of_decimals);

  try {
    if (cell.textFormat.type === 'CURRENCY' && isStringANumber(value)) {
      return formatNumber(value, `$0,0${decimal_string}`, { currency: cell.textFormat.symbol ?? '$' });
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

  return value;
};
