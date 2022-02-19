import { DirectedGraph } from "./primatives/directedGraph";

const cell_to_string = (cell: [number, number]): string => {
  return `${cell[0]},${cell[1]}`;
};

const string_to_cell = (cell: string): [number, number] => {
  const result = cell.split(",");
  return [Number(result[0]), Number(result[1])];
};

function replacer(key: any, value: any) {
  // From https://stackoverflow.com/questions/29085197/how-do-you-json-stringify-an-es6-map
  if (value instanceof Map) {
    return {
      dataType: "Map",
      value: Array.from(value.entries()), // or with spread: value: [...value]
    };
  } else {
    return value;
  }
}

function reviver(key: any, value: any) {
  // From https://stackoverflow.com/questions/29085197/how-do-you-json-stringify-an-es6-map
  if (typeof value === "object" && value !== null) {
    if (value.dataType === "Map") {
      return new Map(value.value);
    }
  }
  return value;
}

export default class QuadraticDependencyGraph {
  _dgraph: DirectedGraph<string, undefined>;

  constructor() {
    this._dgraph = new DirectedGraph<string, undefined>();
  }

  export_to_json() {
    return JSON.stringify(this.export_to_obj(), replacer);
  }

  export_to_obj() {
    return this._dgraph.export();
  }

  human_readable_string() {
    // used for debugging
    let result = "DGraph: \n";
    for (const [key, value] of this._dgraph.getAllEdges().entries()) {
      result += `connection: ${key} updates ${[...value.keys()]}\n`;
    }
    return result;
  }

  load_from_json(directedGraphImport: string) {
    const igraph = JSON.parse(directedGraphImport, reviver);
    this._dgraph.import(igraph);
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
    console.log(
      "add_dependencies_to_graph",
      input_cells,
      JSON.stringify(dependent_cells)
    );

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

  remove_dependencies_from_graph(
    input_cells: [number, number][],
    dependent_cells: [number, number][]
  ) {
    // console.log("remove_dependencies_from_graph", input_cells, JSON.stringify(dependent_cells));
    for (const icell of input_cells) {
      for (const dcell of dependent_cells) {
        this._dgraph.removeEdge(cell_to_string(icell), cell_to_string(dcell));
      }
    }
  }

  get_children_cells(cell: [number, number]) {
    let result = new Array<[number, number]>();
    this._dgraph.traverseBfs(cell_to_string(cell), (key, value) =>
      result.push(string_to_cell(key))
    );
    return result.slice(1);
  }
}
