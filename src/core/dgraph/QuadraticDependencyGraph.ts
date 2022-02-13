import { DirectedGraph } from "./primatives/directedGraph";

const cell_to_string = (cell: [number, number]): string => {
  return `${cell[0]},${cell[1]}`;
};

const string_to_cell = (cell: string): [number, number] => {
  const result = cell.split(",");
  return [Number(result[0]), Number(result[1])];
};

export default class QuadraticDependencyGraph {
  _dgraph: DirectedGraph<string, undefined>;

  constructor() {
    this._dgraph = new DirectedGraph<string, undefined>();
  }

  export_to_json() {
    return {
      //@ts-ignore
      vertices: this._dgraph._vertices,
      //@ts-ignore
      edges: this._dgraph._edges,
      //@ts-ignore
      edgesCount: this._dgraph._edgesCount,
    };
  }

  load_from_json() {
    return {};
  }

  add_dependency_to_graph(
    cell: [number, number],
    dependent_cells: [number, number][]
  ) {
    this._dgraph.addVertex(cell_to_string(cell), undefined);

    for (const dcell of dependent_cells) {
      this._dgraph.addVertex(cell_to_string(dcell), undefined);
      this._dgraph.addEdge(cell_to_string(cell), cell_to_string(dcell));
    }

    // TODO detect circular reference
  }

  add_dependencies_to_graph(
    input_cells: [number, number][],
    dependent_cells: [number, number][]
  ) {
    // TODO: untested

    for (const icell of input_cells) {
      this._dgraph.addVertex(cell_to_string(icell), undefined);
      for (const dcell of dependent_cells) {
        this._dgraph.addVertex(cell_to_string(dcell), undefined);
        this._dgraph.addEdge(cell_to_string(icell), cell_to_string(dcell));
      }
    }

    // TODO detect circular reference
  }

  remove_dependency_from_graph(
    cell: [number, number],
    dependent_cells: [number, number][]
  ) {
    for (const dcell of dependent_cells) {
      this._dgraph.removeEdge(cell_to_string(cell), cell_to_string(dcell));
    }

    // TODO remove any orphans from the graph
  }
  get_children_cells(cell: [number, number]) {
    let result = new Array<[number, number]>();
    this._dgraph.traverseBfs(cell_to_string(cell), (key, value) =>
      result.push(string_to_cell(key))
    );
    return result.slice(1);
  }
}
