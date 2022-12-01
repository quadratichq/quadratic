use petgraph::algo::is_cyclic_directed;
use petgraph::dot::Dot;
use petgraph::graphmap::DiGraphMap;
use petgraph::visit::Bfs;
use std;
use std::fmt;

use crate::grid::Pos;

#[derive(Debug)]
pub struct DependencyCycleError {
    pub source: Pos,
}

impl fmt::Display for DependencyCycleError {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        write!(f, "Dependency cycle detected at {:?}", self.source)
    }
}

#[derive(Default, Clone, Debug)]
pub struct DGraphController {
    // The Quadratic Dependency Graph stores the cells that depend on other cells.
    // The children of a cell are the cells that depend on it.
    // All edges have a weight of 1 (weights don't matter for this implementation)
    graph: DiGraphMap<Pos, usize>,
}

impl fmt::Display for DGraphController {
    /// easy way to visualize the dgraph.
    /// paste into <http://viz-js.com/> to visualize
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        write!(f, "{}", Dot::new(&self.graph))
    }
}

impl DGraphController {
    /// Constructs a new empty dgraph.
    pub fn new() -> Self {
        Self::default()
    }

    /// Returns a immutable reference to the underlying graph.
    pub fn graph(&self) -> &DiGraphMap<Pos, usize> {
        &self.graph
    }

    pub fn add_dependencies(
        &mut self,
        cell: Pos,
        dependencies: &[Pos],
    ) -> Result<(), DependencyCycleError> {
        // add new dependencies
        for &dcell in dependencies {
            // add_edge automatically adds nodes if they don't exist
            self.graph.add_edge(dcell, cell, 1);
        }

        // check for cycles
        if is_cyclic_directed(&self.graph) {
            Err(DependencyCycleError { source: cell })
        } else {
            // return previous state for cell
            Ok(())
        }
    }

    pub fn remove_dependencies(&mut self, cell: Pos, dependencies: &[Pos]) {
        // remove old dependencies
        for &dependency in dependencies.iter() {
            self.graph.remove_edge(dependency, cell);

            // remove nodes that are not connected to any other nodes (isolate nodes)
            if self.graph.neighbors(dependency).count() == 0 {
                self.graph.remove_node(dependency);
            }
        }
    }

    pub fn get_dependent_cells(&self, cell: Pos) -> Vec<Pos> {
        let mut result = Vec::<Pos>::new();
        let mut bfs = Bfs::new(&self.graph, cell);
        while let Some(visited) = bfs.next(&self.graph) {
            result.push(visited);
        }
        // return result except the first element (will always be input cell position)
        result[1..].to_vec()
    }
}
