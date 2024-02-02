import { test } from 'vitest';
import { CellDependencyManager } from './CellDependencyManager';

test('QuadraticDependencyGraph', () => {
  let dg = new CellDependencyManager();

  dg.addDependency([1, 3], [1, 2]);
});

//   dg.add_dependency_to_graph([1, 4], [[1, 3]]);
//   expect(dg.get_children_cells([1, 4])).toStrictEqual([
//     [1, 3],
//     [1, 2],
//     [1, 1],
//   ]);

//   dg.add_dependency_to_graph(
//     [2, 3],
//     [
//       [1, 2],
//       [1, 1],
//     ]
//   );
//   expect(dg.get_children_cells([2, 3])).toStrictEqual([
//     [1, 2],
//     [1, 1],
//   ]);

//   dg.add_dependency_to_graph(
//     [3, 3],
//     [
//       [2, 3],
//       [1, 4],
//     ]
//   );
//   expect(dg.get_children_cells([3, 3])).toStrictEqual([
//     [2, 3],
//     [1, 4],
//     [1, 2],
//     [1, 1],
//     [1, 3],
//   ]);

//   dg.add_dependency_to_graph(
//     [10, 8],
//     [
//       [10, 9],
//       [10, 10],
//     ]
//   );
//   expect(dg.get_children_cells([10, 8])).toStrictEqual([
//     [10, 9],
//     [10, 10],
//   ]);

//   dg.add_dependency_to_graph([10, 8], [[3, 3]]);
//   expect(dg.get_children_cells([10, 8])).toStrictEqual([
//     [10, 9],
//     [10, 10],
//     [3, 3],
//     [2, 3],
//     [1, 4],
//     [1, 2],
//     [1, 1],
//     [1, 3],
//   ]);

//   // test non existant nodes
//   expect(dg.get_children_cells([50, 50])).toStrictEqual([]);

//   // Test Export and Import
//   let export_json_1 = dg.export_to_json();
//   expect(export_json_1).toEqual(
//     '{"vertices":{"dataType":"Map","value":[["1,3",null],["1,2",null],["1,1",null],["1,4",null],["2,3",null],["3,3",null],["10,8",null],["10,9",null],["10,10",null]]},"edges":{"dataType":"Map","value":[["1,3",{"dataType":"Map","value":[["1,2",1],["1,1",1]]}],["1,2",{"dataType":"Map","value":[]}],["1,1",{"dataType":"Map","value":[]}],["1,4",{"dataType":"Map","value":[["1,3",1]]}],["2,3",{"dataType":"Map","value":[["1,2",1],["1,1",1]]}],["3,3",{"dataType":"Map","value":[["2,3",1],["1,4",1]]}],["10,8",{"dataType":"Map","value":[["10,9",1],["10,10",1],["3,3",1]]}],["10,9",{"dataType":"Map","value":[]}],["10,10",{"dataType":"Map","value":[]}]]},"edgesCount":10}'
//   );

//   let dg2 = new QuadraticDependencyGraph();
//   dg2.load_from_json(export_json_1);
//   let export_json_2 = dg2.export_to_json();
//   expect(dg2.get_children_cells([10, 8])).toStrictEqual([
//     [10, 9],
//     [10, 10],
//     [3, 3],
//     [2, 3],
//     [1, 4],
//     [1, 2],
//     [1, 1],
//     [1, 3],
//   ]);

//   expect(export_json_1).toEqual(export_json_2);

//   // Test remove_dependency_from_graph
//   dg.remove_dependency_from_graph([10, 8], [[3, 3]]);
//   expect(dg.get_children_cells([10, 8])).toStrictEqual([
//     [10, 9],
//     [10, 10],
//   ]);

//   dg.remove_dependency_from_graph(
//     [10, 8],
//     [
//       [10, 9],
//       [10, 10],
//     ]
//   );

//   dg.remove_dependency_from_graph(
//     [3, 3],
//     [
//       [2, 3],
//       [1, 4],
//     ]
//   );

//   dg.remove_dependency_from_graph(
//     [2, 3],
//     [
//       [1, 2],
//       [1, 1],
//     ]
//   );
//   dg.remove_dependency_from_graph([1, 4], [[1, 3]]);

//   dg.remove_dependency_from_graph(
//     [1, 3],
//     [
//       [1, 2],
//       [1, 1],
//     ]
//   );

//   expect(dg._dgraph.getEdgesCount()).toEqual(0);

//   // TODO clean up isolate nodes, this should be 0.
//   expect(dg._dgraph.getVerticesCount()).toEqual(9);

//   // Test CircularReferenceException, should throw error
//   // dg.add_dependency_to_graph([1, 2], [[3, 3]]);
// });

// test('QuadraticDependencyGraph.add_dependencies_to_graph', () => {
//   let dg = new QuadraticDependencyGraph();

//   dg.add_dependencies_to_graph(
//     [
//       [0, 0],
//       [0, 1],
//     ],
//     [
//       [1, 0],
//       [1, 1],
//     ]
//   );

//   expect(dg.get_children_cells([0, 0])).toStrictEqual([
//     [1, 0],
//     [1, 1],
//   ]);

//   expect(dg.get_children_cells([0, 1])).toStrictEqual([
//     [1, 0],
//     [1, 1],
//   ]);
// });
