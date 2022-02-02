import QuadraticDependencyGraph from "./QuadraticDependencyGraph";

test("test QuadraticDependencyGraph", () => {
  let dg = new QuadraticDependencyGraph();

  dg.add_dependency_to_graph(
    [1, 3],
    [
      [1, 2],
      [1, 1],
    ]
  );
  expect(dg.get_children_cells([1, 3])).toStrictEqual([
    [1, 2],
    [1, 1],
  ]);

  dg.add_dependency_to_graph([1, 4], [[1, 3]]);
  expect(dg.get_children_cells([1, 4])).toStrictEqual([
    [1, 3],
    [1, 2],
    [1, 1],
  ]);

  dg.add_dependency_to_graph(
    [2, 3],
    [
      [1, 2],
      [1, 1],
    ]
  );
  expect(dg.get_children_cells([2, 3])).toStrictEqual([
    [1, 2],
    [1, 1],
  ]);

  dg.add_dependency_to_graph(
    [3, 3],
    [
      [2, 3],
      [1, 4],
    ]
  );
  expect(dg.get_children_cells([3, 3])).toStrictEqual([
    [2, 3],
    [1, 4],
    [1, 2],
    [1, 1],
    [1, 3],
  ]);

  dg.add_dependency_to_graph(
    [10, 8],
    [
      [10, 9],
      [10, 10],
    ]
  );
  expect(dg.get_children_cells([10, 8])).toStrictEqual([
    [10, 9],
    [10, 10],
  ]);

  dg.add_dependency_to_graph([10, 8], [[3, 3]]);
  expect(dg.get_children_cells([10, 8])).toStrictEqual([
    [10, 9],
    [10, 10],
    [3, 3],
    [2, 3],
    [1, 4],
    [1, 2],
    [1, 1],
    [1, 3],
  ]);

  // test non existant nodes
  expect(dg.get_children_cells([50, 50])).toStrictEqual([]);

  // Test remove_dependency_from_graph
  dg.remove_dependency_from_graph([10, 8], [[3, 3]]);
  expect(dg.get_children_cells([10, 8])).toStrictEqual([
    [10, 9],
    [10, 10],
  ]);

  dg.remove_dependency_from_graph(
    [10, 8],
    [
      [10, 9],
      [10, 10],
    ]
  );

  dg.remove_dependency_from_graph(
    [3, 3],
    [
      [2, 3],
      [1, 4],
    ]
  );

  dg.remove_dependency_from_graph(
    [2, 3],
    [
      [1, 2],
      [1, 1],
    ]
  );
  dg.remove_dependency_from_graph([1, 4], [[1, 3]]);

  dg.remove_dependency_from_graph(
    [1, 3],
    [
      [1, 2],
      [1, 1],
    ]
  );

  expect(dg._dgraph.getEdgesCount()).toEqual(0);
  // TODO clean up isolate nodes, this should be 0.
  expect(dg._dgraph.getVerticesCount()).toEqual(0);

  expect(dg.export_to_json()).toEqual({});
  expect(dg.load_from_json()).toEqual({});

  // Test CircularReferenceException, should throw error
  // dg.add_dependency_to_graph([1, 2], [[3, 3]]);
  expect(false).toStrictEqual(true);
});
