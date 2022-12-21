import { Sheet } from '../../gridDB/Sheet';
import { Statement } from '../statement';
import { SetCellRunner } from './setCellRunner';
import { SetCellDependenciesRunner } from './setCellDependenciesRunner';

export const StatementRunner = (sheet: Sheet, statement: Statement): Statement => {
  if (statement.type === 'SET_CELL') {
    return SetCellRunner(sheet, statement);
  } else if (statement.type === 'SET_CELL_DEPENDENCIES') {
    return SetCellDependenciesRunner(sheet, statement);
  } else {
    throw new Error('Statement type not recognized.');
  }
};
