import { Sheet } from '../../gridDB/Sheet';
import { Statement } from '../statement';

export const SetCellDependenciesRunner = (sheet: Sheet, statement: Statement): Statement => {
  if (statement.type !== 'SET_CELL_DEPENDENCIES') throw new Error('Incorrect statement type.');
  // Applies the SET_CELL_DEPENDENCIES statement to the sheet and returns the reverse statement

  if (statement.data.dependencies === null) {
    sheet.dgraph.delete(statement.data.position);
    return {
      type: 'SET_CELL_DEPENDENCIES',
      data: {
        position: statement.data.position,
        dependencies: sheet.dgraph.get(statement.data.position),
      },
    } as Statement;
  } else {
    sheet.dgraph.set(statement.data.position, statement.data.dependencies);
    return {
      type: 'SET_CELL_DEPENDENCIES',
      data: {
        position: statement.data.position,
        dependencies: sheet.dgraph.get(statement.data.position),
      },
    } as Statement;
  }
};
