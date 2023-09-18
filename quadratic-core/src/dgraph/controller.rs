use serde::{Deserialize, Serialize};
use std;
use std::collections::HashSet;
use std::fmt;

use crate::Pos;
use crate::Rect;

#[derive(Debug, PartialEq)]
pub struct DependencyCycleError {
    pub source: Pos,
}

impl fmt::Display for DependencyCycleError {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        write!(f, "Dependency cycle detected at {:?}", self.source)
    }
}

#[derive(Default, Clone, Debug, PartialEq, Deserialize, Serialize)]
pub struct ComputationDependency {
    pub area: Rect,
    pub updates: Pos,
}

impl fmt::Display for ComputationDependency {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        write!(
            f,
            "ComputationDependency {{ area: {}, updates: {} }}",
            self.area, self.updates
        )
    }
}

#[derive(Default, Clone, Debug, PartialEq, Deserialize, Serialize)]
pub struct ComputationDependencyController {
    graph: Vec<ComputationDependency>,
}

impl fmt::Display for ComputationDependencyController {
    /// easy way to visualize the dgraph.
    /// paste into <http://viz-js.com/> to visualize
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        // iterate through vec self.graph and print each node

        for (i, node) in self.graph.iter().enumerate() {
            write!(f, "node{}[label=\"{}\"]\n", i, node)?;
        }
        Ok(())
    }
}

impl ComputationDependencyController {
    /// Constructs a new empty dgraph.
    pub fn new() -> Self {
        Self::default()
    }

    /// Given `area` and `updates` adds a new node to the graph.
    pub fn add_dependencies(&mut self, areas: Vec<Rect>, updates: Pos) {
        // remove entry from Vec with the same updates pos
        self.remove_dependencies(updates);

        for area in areas.iter() {
            // don't allow a node to depend on itself
            if area.contains(updates) {
                continue;
            }

            // add new node
            self.graph.push(ComputationDependency {
                area: *area,
                updates,
            });
        }
    }

    /// Given `area` and `updates` removes a node from the graph.
    pub fn remove_dependencies(&mut self, cell: Pos) {
        // search vec
        let mut index = None;
        for (i, node) in self.graph.iter().enumerate() {
            if node.updates == cell {
                index = Some(i);
                break;
            }
        }

        // if found, remove it
        if let Some(i) = index {
            self.graph.remove(i);
        }
    }

    /// Returns a vector of cells that _directly_ depend on `cell`.
    /// Does not traverse the graph.
    pub fn get_dependent_cells(&self, area: Rect) -> HashSet<Pos> {
        let mut seen = HashSet::new();

        for node in self.graph.iter() {
            if node.area.contains(area.min) {
                seen.insert(node.updates);
            }
        }

        seen
    }
}
