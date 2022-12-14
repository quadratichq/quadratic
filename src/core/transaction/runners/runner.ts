import { Sheet } from '../../gridDB/Sheet';
import { Statement } from '../statement';
import { SetCellRunner } from './setCellRunner';

export const StatementRunner = (sheet: Sheet, statement: Statement): Statement => {
  if (statement.type === 'SET_CELL') {
    return SetCellRunner(sheet, statement);
  } else {
    throw new Error('Statement type not recognized.');
  }
};
