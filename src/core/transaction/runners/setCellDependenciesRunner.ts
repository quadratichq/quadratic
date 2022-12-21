import { Sheet } from '../../gridDB/Sheet';
import { Statement } from '../statement';

export const SetCellDependenciesRunner = (sheet: Sheet, statement: Statement): Statement => {
  if (statement.type !== 'SET_CELL_DEPENDENCIES') throw new Error('Incorrect statement type.');
  // Applies the SET_CELL statement to the sheet and returns the reverse statement

  sheet.dgraph.set_cell_dependencies(statement.data.position, statement.data.dependencies);

  // return reverse statement

  // raise error not implemented yet
  throw new Error('Not implemented yet.');

  // return {
  //   type: 'SET_CELL_DEPENDENCIES',
  //   data: {
  //     position: [1, 1],
  //     dependencies: [[1, 1]],
  //   },
  // } as Statement;
};
