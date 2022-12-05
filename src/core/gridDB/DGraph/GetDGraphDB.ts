import { qdb } from '../db';
import QuadraticDependencyGraph from '../../dgraph/QuadraticDependencyGraph';

export const GetDGraphDB = (): QuadraticDependencyGraph => {
  return qdb.graph.dgraph;
};
