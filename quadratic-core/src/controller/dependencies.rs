use std;

use std::collections::HashSet;

use crate::grid::Grid;
use crate::Pos;
use crate::Rect;

impl Grid {
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
            Some(areas) => self.dependencies_mut().insert(cell, areas),
            None => self.dependencies_mut().remove(&cell),
        }
    }

    /// Returns cells that _directly_ depend on `area`.
    /// Does not continue to traverse the graph.
    pub fn get_dependent_cells(&mut self, area: Rect) -> HashSet<Pos> {
        let mut seen = HashSet::new();

        for node in self.dependencies_mut().iter() {
            for rect in node.1.iter() {
                if rect.intersects(area) {
                    seen.insert(*node.0);
                }
            }
        }

        seen
    }
}

#[test]
fn test_graph() {
    let mut cdc = Grid::new();

    cdc.set_dependencies(
        Pos { x: 3, y: 3 },
        Some(vec![Rect {
            min: Pos { x: 0, y: 0 },
            max: Pos { x: 1, y: 1 },
        }]),
    );

    assert_eq!(
        cdc.get_dependent_cells(Rect::single_pos(Pos { x: 0, y: 0 })),
        std::iter::once(Pos { x: 3, y: 3 }).collect()
    );

    cdc.set_dependencies(
        Pos { x: 4, y: 4 },
        Some(vec![Rect {
            min: Pos { x: 0, y: 0 },
            max: Pos { x: 1, y: 1 },
        }]),
    );

    assert_eq!(
        cdc.get_dependent_cells(Rect::single_pos(Pos { x: 0, y: 0 })),
        [Pos { x: 3, y: 3 }, Pos { x: 4, y: 4 }]
            .iter()
            .cloned()
            .collect()
    );

    cdc.set_dependencies(Pos { x: 3, y: 3 }, None);

    assert_eq!(
        cdc.get_dependent_cells(Rect::single_pos(Pos { x: 0, y: 0 })),
        std::iter::once(Pos { x: 4, y: 4 }).collect()
    );

    cdc.set_dependencies(Pos { x: 4, y: 4 }, None);

    assert_eq!(
        cdc.get_dependent_cells(Rect::single_pos(Pos { x: 0, y: 0 })),
        HashSet::new()
    );

    cdc.set_dependencies(
        Pos { x: 11, y: 11 },
        Some(vec![Rect::single_pos(Pos { x: 10, y: 10 })]),
    );

    assert_eq!(
        cdc.get_dependent_cells(Rect::single_pos(Pos { x: 10, y: 10 })),
        std::iter::once(Pos { x: 11, y: 11 }).collect()
    );
}
