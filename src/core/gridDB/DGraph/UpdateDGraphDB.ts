// import { qdb } from '../gridTypes';
import QuadraticDependencyGraph from '../../dgraph/QuadraticDependencyGraph';

export const UpdateDGraphDB = async (qdg: QuadraticDependencyGraph) => {
  // qdb.qgrid.put({
  //   id: 1,
  //   dgraph_json: qdg.export_to_json(),
  // });

  return qdg;
};
