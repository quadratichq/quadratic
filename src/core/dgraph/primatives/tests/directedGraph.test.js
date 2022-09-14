import { DirectedGraph } from '../directedGraph';

describe('DirectedGraph unit tests', () => {
  const directedGraph = new DirectedGraph();

  describe('.addVertex(key, value)', () => {
    it('add vertices the graph', () => {
      expect(directedGraph.addVertex('v1', 1)).toBeInstanceOf(DirectedGraph);
      expect(directedGraph.addVertex('v1', 1)).toBeInstanceOf(DirectedGraph);
      expect(directedGraph.addVertex('v2', 2)).toBeInstanceOf(DirectedGraph);
      expect(directedGraph.addVertex('v3', 3)).toBeInstanceOf(DirectedGraph);
      expect(directedGraph.addVertex('v4', 4)).toBeInstanceOf(DirectedGraph);
      expect(directedGraph.addVertex('v5', 5)).toBeInstanceOf(DirectedGraph);
    });
  });

  describe('.addEdge(srcKey, destKey, weight)', () => {
    it('add unidirectional edge between two vertices', () => {
      directedGraph.addEdge('v1', 'v2', 2);
      directedGraph.addEdge('v1', 'v3', 3);
      directedGraph.addEdge('v1', 'v4', 1);
      directedGraph.addEdge('v2', 'v4');
      directedGraph.addEdge('v3', 'v5', 2);
      directedGraph.addEdge('v4', 'v3');
      directedGraph.addEdge('v4', 'v5', 4);
    });
  });

  describe('.hasVertex(key)', () => {
    it('has the added vertices', () => {
      expect(directedGraph.hasVertex('v1')).toEqual(true);
      expect(directedGraph.hasVertex('v2')).toEqual(true);
      expect(directedGraph.hasVertex('v3')).toEqual(true);
      expect(directedGraph.hasVertex('v4')).toEqual(true);
      expect(directedGraph.hasVertex('v5')).toEqual(true);
    });
  });

  describe('.hasEdge(srcKey, destKey)', () => {
    it('throws error if source vertex does not exist', () => {
      expect(() => directedGraph.addEdge('n1', 'v2')).toThrow(Error);
      // .and.to.have.property("message", 'addEdge: vertex "n1" not found');
    });

    it('throws error if destination vertex does not exist', () => {
      expect(() => directedGraph.addEdge('v1', 'n2')).toThrow(Error);
      // .and.to.have.property("message", 'addEdge: vertex "n2" not found');
    });

    it('has the added edges as one-way direction', () => {
      expect(directedGraph.hasEdge('v1', 'v2')).toEqual(true);
      expect(directedGraph.hasEdge('v1', 'v3')).toEqual(true);
      expect(directedGraph.hasEdge('v1', 'v4')).toEqual(true);
      expect(directedGraph.hasEdge('v2', 'v4')).toEqual(true);
      expect(directedGraph.hasEdge('v3', 'v5')).toEqual(true);
      expect(directedGraph.hasEdge('v4', 'v3')).toEqual(true);
      expect(directedGraph.hasEdge('v4', 'v5')).toEqual(true);

      expect(directedGraph.hasEdge('v2', 'v1')).toEqual(false);
      expect(directedGraph.hasEdge('v3', 'v1')).toEqual(false);
      expect(directedGraph.hasEdge('v4', 'v1')).toEqual(false);
      expect(directedGraph.hasEdge('v4', 'v2')).toEqual(false);
      expect(directedGraph.hasEdge('v5', 'v3')).toEqual(false);
      expect(directedGraph.hasEdge('v3', 'v4')).toEqual(false);
      expect(directedGraph.hasEdge('v5', 'v4')).toEqual(false);
    });
  });

  describe('.getVerticesCount()', () => {
    it('get the vertices count', () => {
      expect(directedGraph.getVerticesCount()).toEqual(5);
    });
  });

  describe('getEdgesCount()', () => {
    it('get the edges count', () => {
      expect(directedGraph.getEdgesCount()).toEqual(7);
    });
  });

  describe('.getWeight(srcKey, destKey)', () => {
    it('get the edge weight between two vertices', () => {
      expect(directedGraph.getWeight('v1', 'v2')).toEqual(2);
      expect(directedGraph.getWeight('v1', 'v3')).toEqual(3);
      expect(directedGraph.getWeight('v1', 'v4')).toEqual(1);
      expect(directedGraph.getWeight('v3', 'v5')).toEqual(2);
      expect(directedGraph.getWeight('v4', 'v5')).toEqual(4);
    });

    it('has a default weight of 1', () => {
      expect(directedGraph.getWeight('v2', 'v4')).toEqual(1);
      expect(directedGraph.getWeight('v4', 'v3')).toEqual(1);
    });
  });

  describe('.traverseDfs(srcKey, cb)', () => {
    it('traverse the graph from a starting vertex using DFS', () => {
      const vertices = [];
      directedGraph.traverseDfs('v1', (k) => vertices.push(k));
      expect(vertices).toEqual(['v1', 'v2', 'v4', 'v3', 'v5']);
    });
  });

  describe('.traverseBfs(srcKey, cb)', () => {
    // it("does nothing when vertex does not exist", () => {
    //   const cb = sinon.spy();
    //   directedGraph.traverseBfs("n1", cb);
    //   expect(cb.calledOnce).toEqual(false);
    // });

    it('traverse the graph from a starting vertex using BFS', () => {
      const keys = [];
      const values = [];
      directedGraph.traverseBfs('v1', (k, v) => {
        keys.push(k);
        values.push(v);
      });
      expect(keys).toEqual(['v1', 'v2', 'v3', 'v4', 'v5']);
      expect(values).toEqual([1, 2, 3, 4, 5]);
    });
  });

  describe('.removeVertex(key)', () => {
    it('does nothing when vertex does not exist', () => {
      expect(directedGraph.removeVertex('n1')).toEqual(false);
      expect(directedGraph.getVerticesCount()).toEqual(5);
      expect(directedGraph.getEdgesCount()).toEqual(7);
    });

    it('remove a vertex from the graph', () => {
      expect(directedGraph.removeVertex('v5')).toEqual(true);
      expect(directedGraph.hasVertex('v5')).toEqual(false);
      expect(directedGraph.hasEdge('v3', 'v5')).toEqual(false);
      expect(directedGraph.hasEdge('v4', 'v5')).toEqual(false);
      expect(directedGraph.getVerticesCount()).toEqual(4);
      expect(directedGraph.getEdgesCount()).toEqual(5);

      expect(directedGraph.removeVertex('v3')).toEqual(true);
      expect(directedGraph.hasVertex('v3')).toEqual(false);
      expect(directedGraph.hasEdge('v1', 'v3')).toEqual(false);
      expect(directedGraph.hasEdge('v4', 'v3')).toEqual(false);
      expect(directedGraph.getVerticesCount()).toEqual(3);
      expect(directedGraph.getEdgesCount()).toEqual(3);
    });
  });

  describe('.removeEdge(srcKey, destKey)', () => {
    it('does nothing when vertex does not exist', () => {
      expect(directedGraph.removeEdge('n1', 'n2')).toEqual(false);
      expect(directedGraph.getVerticesCount()).toEqual(3);
      expect(directedGraph.getEdgesCount()).toEqual(3);
    });

    it('remove the edge between two vertices', () => {
      expect(directedGraph.removeEdge('v2', 'v4')).toEqual(true);
      expect(directedGraph.hasEdge('v2', 'v4')).toEqual(false);
    });
  });

  describe('.removeEdges(key)', () => {
    it('does nothing when vertex does not exist', () => {
      expect(directedGraph.removeEdges('n1')).toEqual(0);
      expect(directedGraph.getEdgesCount()).toEqual(2);
    });

    it('returns the number of removed edges', () => {
      const g = new DirectedGraph();
      g.addVertex('v1');
      g.addVertex('v2');
      g.addVertex('v3');
      g.addEdge('v1', 'v2');
      g.addEdge('v2', 'v1');
      g.addEdge('v1', 'v3');
      expect(g.removeEdges('v1')).toEqual(3);
    });
  });

  describe('.clear()', () => {
    it('clear the graph', () => {
      directedGraph.clear();
      expect(directedGraph.getVerticesCount()).toEqual(0);
      expect(directedGraph.getEdgesCount()).toEqual(0);
    });
  });
});
