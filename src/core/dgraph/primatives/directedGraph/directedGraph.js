/**
 * datastructures-js/graph
 * @copyright 2020 Eyas Ranjous <eyas.ranjous@gmail.com>
 * @license MIT
 * Modified by David Kircos Feb 2022
 */

import Queue from "../queue/queue";

/**
 * @class
 */
export class DirectedGraph {
  constructor() {
    this._vertices = new Map();
    this._edges = new Map();
    this._edgesCount = 0;
  }

  /**
   * Adds a vertex to the graph
   * @public
   * @param {number|string} key
   * @param {object} value
   * @return {DirectedGraph}
   */
  addVertex(key, value) {
    this._vertices.set(key, value);
    if (!this._edges.has(key)) {
      this._edges.set(key, new Map());
    }
    return this;
  }

  /**
   * Checks if the graph has a vertex
   * @public
   * @param {number|string} key
   * @return {boolean}
   */
  hasVertex(key) {
    return this._vertices.has(key);
  }

  /**
   * Removes a vertex and all its edges from the graph
   * @public
   * @param {number|string} key
   * @return {boolean}
   */
  removeVertex(key) {
    if (!this.hasVertex(key)) return false;

    this.removeEdges(key);
    this._edges.delete(key);
    this._vertices.delete(key);
    return true;
  }

  /**
   * Returns the number of vertices in the graph
   * @public
   * @return {number}
   */
  getVerticesCount() {
    return this._vertices.size;
  }

  /**
   * Adds a directed edge from a source vertex to a destination
   * @public
   * @param {number|string} srcKey
   * @param {number|string} destKey
   * @param {number} [weight] - default 1
   */
  addEdge(srcKey, destKey, weight) {
    if (!this._vertices.has(srcKey)) {
      throw new Error(`addEdge: vertex "${srcKey}" not found`);
    }

    if (!this._vertices.has(destKey)) {
      throw new Error(`addEdge: vertex "${destKey}" not found`);
    }

    if (weight && Number.isNaN(+weight)) {
      throw new Error("addEdge: expects a numberic weight");
    }

    const w = Number.isNaN(+weight) ? 1 : +weight;
    this._edges.get(srcKey).set(destKey, w);
    this._edgesCount += 1;
    return this;
  }

  /**
   * Checks if there is a direction between two nodes
   * @public
   * @param {number|string} srcKey
   * @param {number|string} destKey
   * @returns {boolean}
   */
  hasEdge(srcKey, destKey) {
    return (
      this.hasVertex(srcKey) &&
      this.hasVertex(destKey) &&
      this._edges.get(srcKey).has(destKey)
    );
  }

  /**
   * Gets the weight of an edge if exists
   * @public
   * @param {number|string} srcKey
   * @param {number|string} destKey
   * @returns {number}
   */
  getWeight(srcKey, destKey) {
    if (this.hasVertex(srcKey) && srcKey === destKey) {
      return 0;
    }

    if (!this.hasEdge(srcKey, destKey)) {
      return Infinity;
    }

    return this._edges.get(srcKey).get(destKey);
  }

  /**
   * Removes the direction from source to destination
   * @public
   * @param {number|string} srcKey
   * @param {number|string} destKey
   */
  removeEdge(srcKey, destKey) {
    if (!this.hasEdge(srcKey, destKey)) {
      return false;
    }

    this._edges.get(srcKey).delete(destKey);
    this._edgesCount -= 1;
    return true;
  }

  /**
   * Removes in and out directions of a vertex
   * @public
   * @param {number|string} key
   * @return {number} number of removed edges
   */
  removeEdges(key) {
    if (!this.hasVertex(key)) {
      return 0;
    }

    let removedEdgesCount = 0;
    this._edges.forEach((destEdges, srcKey) => {
      if (destEdges.has(key)) {
        this.removeEdge(srcKey, key);
        removedEdgesCount += 1;
      }
    });

    removedEdgesCount += this._edges.get(key).size;
    this._edgesCount -= this._edges.get(key).size;
    this._edges.set(key, new Map());
    return removedEdgesCount;
  }

  /**
   * Returns the number of edges in the graph
   * @public
   * @returns {number}
   */
  getEdgesCount() {
    return this._edgesCount;
  }

  /**
   * Traverse all vertices in the graph using depth-first search
   * @public
   * @param {number|string} srcKey - starting node
   * @param {function} cb
   */
  traverseDfs(srcKey, cb) {
    const traverseDfsRecursive = (key, visited = new Set()) => {
      if (!this.hasVertex(key) || visited.has(key)) return;

      cb(key, this._vertices.get(key));
      visited.add(key);

      this._edges.get(key).forEach((weight, destKey) => {
        traverseDfsRecursive(destKey, visited);
      });
    };
    traverseDfsRecursive(srcKey);
  }

  /**
   * Traverse all vertices in the graph using breadth-first search
   * @public
   * @param {number|string} srcKey - starting node
   * @param {function} cb
   */
  traverseBfs(srcKey, cb) {
    if (!this.hasVertex(srcKey)) return;

    const queue = new Queue([srcKey]);
    const visited = new Set([srcKey]);

    while (!queue.isEmpty()) {
      const nextKey = queue.dequeue();
      cb(nextKey, this._vertices.get(nextKey));
      this._edges.get(nextKey).forEach((weight, destKey) => {
        if (!visited.has(destKey)) {
          queue.enqueue(destKey);
          visited.add(destKey);
        }
      });
    }
  }

  /**
   * Clears the graph
   * @public
   */
  clear() {
    this._vertices = new Map();
    this._edges = new Map();
    this._edgesCount = 0;
  }
}
