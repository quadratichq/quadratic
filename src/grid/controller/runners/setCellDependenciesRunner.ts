import { SheetController } from '../SheetController';
import { Statement } from '../statement';

export const AddCellDependenciesRunner = (sheetController: SheetController, statement: Statement): Statement => {
  if (statement.type !== 'ADD_CELL_DEPENDENCY') throw new Error('Incorrect statement type.');
  // Applies the ADD_CELL_DEPENDENCY statement to the sheet and returns the reverse statement
  const sheet = sheetController.sheet;

  sheet.cell_dependency.addDependency(statement.data.position, statement.data.updates);
  return {
    type: 'REMOVE_CELL_DEPENDENCY',
    data: {
      position: statement.data.position,
      updates: statement.data.updates,
    },
  } as Statement;
};

export const RemoveCellDependenciesRunner = (sheetController: SheetController, statement: Statement): Statement => {
  if (statement.type !== 'REMOVE_CELL_DEPENDENCY') throw new Error('Incorrect statement type.');
  // Applies the REMOVE_CELL_DEPENDENCY statement to the sheet and returns the reverse statement

  sheetController.sheet.cell_dependency.removeDependency(statement.data.position, statement.data.updates);
  return {
    type: 'ADD_CELL_DEPENDENCY',
    data: {
      position: statement.data.position,
      updates: statement.data.updates,
    },
  } as Statement;
};
