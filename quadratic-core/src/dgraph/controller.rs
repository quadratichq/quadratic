use serde::{Deserialize, Serialize};
use std;
use std::collections::HashMap;
use std::collections::HashSet;
use std::fmt;

use crate::Pos;
use crate::Rect;

#[derive(Default, Clone, Debug, PartialEq, Deserialize, Serialize)]
pub struct ComputationDependencyController {
    graph: HashMap<Pos, Vec<Rect>>,
}

impl fmt::Display for ComputationDependencyController {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        // print graph
        for (pos, rects) in self.graph.iter() {
            for rect in rects.iter() {
                writeln!(f, "cell: {} dependencies: {}", pos, rect,)?;
            }
        }
        Ok(())
    }
}

impl ComputationDependencyController {
    /// Constructs a new empty dgraph.
    pub fn new() -> Self {
        Self::default()
    }

    /// Given `cell` and `dependencies` adds a new node to the graph.
    /// Returns the old dependencies of the node.
    pub fn set_dependencies(
        &mut self,
        cell: Pos,
        dependencies: Option<Vec<Rect>>,
    ) -> Option<Vec<Rect>> {
        // make sure cell is not in dependencies
        if let Some(dependencies) = &dependencies {
            if dependencies.iter().any(|rect| rect.contains(cell)) {
                panic!("cell cannot depend on itself");
            }
        }

        // update graph and return old dependencies
        match dependencies {
            Some(areas) => self.graph.insert(cell, areas),
            None => self.graph.remove(&cell),
        }
    }

    /// Returns cells that _directly_ depend on `area`.
    /// Does not continue to traverse the graph.
    pub fn get_dependent_cells(&self, area: Rect) -> HashSet<Pos> {
        let mut seen = HashSet::new();

        for node in self.graph.iter() {
            for rect in node.1.iter() {
                if rect.intersects(area) {
                    seen.insert(*node.0);
                }
            }
        }

        seen
    }
}
