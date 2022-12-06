import { Cell } from '../gridDB/db';
import { format } from 'numerable';

const IsNumeric = (num: string) => /^-{0,1}\d*\.{0,1}\d+$/.test(num);

export const CellTextFormatter = (cell: Cell) => {
  if (!cell.number_formatting_pattern) return cell.value;

  if (!IsNumeric(cell.value)) return cell.value;

  return format(cell.value, cell.number_formatting_pattern, { currency: 'USD' });
};
