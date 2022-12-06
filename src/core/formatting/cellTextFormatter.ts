import { Cell } from '../gridDB/db';
import { format as formatNumber } from 'numerable';
import { format as formatDate } from 'date-fns';

// function that checks if a string is a number
const IsNumeric = (num: string) => /^-{0,1}\d*\.{0,1}\d+$/.test(num);

// function that checks if a string is a date
const IsDate = (date: string) => {
  const parsedDate = Date.parse(date);
  return !isNaN(parsedDate);
};

export const CellTextFormatter = (cell: Cell) => {
  if (cell.number_formatting_pattern && IsNumeric(cell.value))
    return formatNumber(cell.value, cell.number_formatting_pattern, { currency: 'USD' }); // TODO: currency should be dynamic

  if (cell.date_formatting_pattern && IsDate(cell.value))
    return formatDate(new Date(cell.value), cell.date_formatting_pattern);

  return cell.value;
};
