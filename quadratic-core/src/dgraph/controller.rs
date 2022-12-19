use petgraph::algo::is_cyclic_directed;
use petgraph::dot::Dot;
use petgraph::graphmap::DiGraphMap;
use petgraph::visit::Bfs;
use std;
use std::fmt;

use crate::grid::Pos;

#[derive(Debug, PartialEq)]
pub struct DependencyCycleError {
    pub source: Pos,
}
impl fmt::Display for DependencyCycleError {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        write!(f, "Dependency cycle detected at {:?}", self.source)
    }
}

#[derive(Debug, Default, Copy, Clone, PartialEq, Eq, Hash, PartialOrd, Ord)]
pub struct NoEdgeWeight;
impl fmt::Display for NoEdgeWeight {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        write!(f, "")
    }
}

#[derive(Default, Clone, Debug)]
pub struct DGraph {
    // The Quadratic Dependency Graph stores the cells that depend on other cells.
    // The children of a cell are the cells that depend on it.
    graph: DiGraphMap<Pos, NoEdgeWeight>,
}

impl fmt::Display for DGraph {
    /// easy way to visualize the dgraph.
    /// paste into <http://viz-js.com/> to visualize
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        write!(f, "{}", Dot::new(&self.graph))
    }
}

impl DGraph {
    /// Constructs a new empty dgraph.
    pub fn new() -> Self {
        Self::default()
    }

    /// Returns a immutable reference to the underlying graph.
    pub fn graph(&self) -> &DiGraphMap<Pos, NoEdgeWeight> {
        &self.graph
    }

    /// Given `cell` adds `dependencies` to the graph.
    /// Checks for cycles and returns an error if one is found.
    pub fn add_dependencies(
        &mut self,
        cell: Pos,
        dependencies: &[Pos],
    ) -> Result<(), DependencyCycleError> {
        // add new dependencies
        for &dcell in dependencies {
            // add_edge automatically adds nodes if they don't exist
            self.graph.add_edge(dcell, cell, NoEdgeWeight);
        }

        // check for cycles
        if is_cyclic_directed(&self.graph) {
            Err(DependencyCycleError { source: cell })
        } else {
            Ok(())
        }
    }

    /// Given `cell` removes `dependencies` to the graph.
    /// Checks for isolated nodes and removes them from the graph.
    pub fn remove_dependencies(&mut self, cell: Pos, dependencies: &[Pos]) {
        // remove old dependencies
        for &dependency in dependencies.iter() {
            self.graph.remove_edge(dependency, cell);

            // remove nodes that are not connected to any other nodes
            if self.graph.neighbors(dependency).count() == 0 {
                self.graph.remove_node(dependency);
            }
        }

        // remove cell node if not connected to any other nodes
        if self.graph.neighbors(cell).count() == 0 {
            self.graph.remove_node(cell);
        }
    }

    /// Returns a vector of cells that depend on `cell`.
    /// Does not return input `cell` as a dependent.
    pub fn get_dependent_cells(&self, cell: Pos) -> Vec<Pos> {
        let mut result = Vec::<Pos>::new();
        let mut bfs = Bfs::new(&self.graph, cell);
        while let Some(visited) = bfs.next(&self.graph) {
            result.push(visited);
        }
        // return result except `cell` in pos 0
        result[1..].to_vec()
    }
}
