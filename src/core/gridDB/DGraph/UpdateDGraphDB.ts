import { qdb } from '../db';
import QuadraticDependencyGraph from '../../dgraph/QuadraticDependencyGraph';

export const UpdateDGraphDB = async (qdg: QuadraticDependencyGraph) => {
  qdb.graph.dgraph = qdg;

  return qdg;
};
