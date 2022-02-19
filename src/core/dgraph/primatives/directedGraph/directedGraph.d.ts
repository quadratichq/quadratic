interface DirectedGraphExport {
  vertices: Map;
  edges: Map;
  edgesCount: number;
}

export class DirectedGraph<T extends number | string, U = undefined> {
  export(): DirectedGraphExport;
  import(directedGraphImport: DirectedGraphExport): void;
  getAllEdges(): Map;
  addVertex(key: T, value: U): DirectedGraph<T, U>;
  hasVertex(key: T): boolean;
  removeVertex(key: T): boolean;
  getVerticesCount(): number;
  addEdge(srcKey: T, destKey: T, weight?: number): DirectedGraph<T, U>;
  hasEdge(srcKey: T, destKey: T): boolean;
  getWeight(srcKey: T, destKey: T): number;
  removeEdge(srcKey: T, destKey: T): boolean;
  removeEdges(key: T): number;
  getEdgesCount(): number;
  traverseDfs(srcKey: T, cb: (key: T, value: U) => void): void;
  traverseBfs(srcKey: T, cb: (key: T, value: U) => void): void;
  clear(): void;
}
