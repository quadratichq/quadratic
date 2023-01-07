import { Sheet } from '../../gridDB/Sheet';
import { Statement } from '../statement';
import { SetCellRunner } from './setCellRunner';
import { SetCellDependenciesRunner } from './setCellDependenciesRunner';
import { PixiApp } from '../../gridGL/pixiApp/PixiApp';

export const StatementRunner = (sheet: Sheet, statement: Statement, app?: PixiApp): Statement => {
  if (statement.type === 'SET_CELL') {
    return SetCellRunner(sheet, statement, app);
  } else if (statement.type === 'SET_CELL_DEPENDENCIES') {
    return SetCellDependenciesRunner(sheet, statement);
  } else {
    throw new Error('Statement type not recognized.');
  }
};
