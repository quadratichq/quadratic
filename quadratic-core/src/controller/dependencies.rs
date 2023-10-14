use std;

use std::collections::HashSet;

use crate::grid::Grid;
use crate::SheetPos;

// todo: this probably should be CellRef instead of SheetPos (formally SheetRect)

impl Grid {
    /// Given `cell` and `dependencies` adds a new node to the graph.
    /// Returns the old dependencies of the node.
    pub fn set_dependencies(
        &mut self,
        cell: SheetPos,
        dependencies: Option<Vec<SheetPos>>,
    ) -> Option<Vec<SheetPos>> {
        // make sure cell is not in dependencies
        if let Some(dependencies) = &dependencies {
            if dependencies.iter().any(|sheet_pos| *sheet_pos == cell) {
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
    pub fn get_dependent_cells(&mut self, cell: SheetPos) -> HashSet<SheetPos> {
        let mut seen = HashSet::new();

        for node in self.dependencies_mut().iter() {
            for pos in node.1.iter() {
                if *pos == cell {
                    seen.insert(*node.0);
                }
            }
        }

        seen
    }
}

#[cfg(test)]
mod test {
    use std::collections::HashSet;

    use crate::{grid::Grid, Pos, SheetPos, SheetRect};
    #[test]
    fn test_graph() {
        let mut cdc = Grid::new();
        let sheet_id = cdc.sheet_ids()[0];

        cdc.set_dependencies(
            SheetPos {
                sheet_id,
                x: 3,
                y: 3,
            },
            Some(
                SheetRect {
                    sheet_id,
                    min: Pos { x: 0, y: 0 },
                    max: Pos { x: 1, y: 1 },
                }
                .into(),
            ),
        );

        assert_eq!(
            cdc.get_dependent_cells(SheetPos {
                sheet_id,
                x: 0,
                y: 0
            }),
            std::iter::once(SheetPos {
                sheet_id,
                x: 3,
                y: 3
            })
            .collect()
        );

        cdc.set_dependencies(
            SheetPos {
                sheet_id,
                x: 4,
                y: 4,
            },
            Some(
                SheetRect {
                    sheet_id,
                    min: Pos { x: 0, y: 0 },
                    max: Pos { x: 1, y: 1 },
                }
                .into(),
            ),
        );

        assert_eq!(
            cdc.get_dependent_cells(SheetPos {
                sheet_id,
                x: 0,
                y: 0
            }),
            [
                SheetPos {
                    sheet_id,
                    x: 3,
                    y: 3
                },
                SheetPos {
                    sheet_id,
                    x: 4,
                    y: 4
                }
            ]
            .iter()
            .cloned()
            .collect()
        );

        cdc.set_dependencies(
            SheetPos {
                sheet_id,
                x: 3,
                y: 3,
            },
            None,
        );

        assert_eq!(
            cdc.get_dependent_cells(SheetPos {
                sheet_id,
                x: 0,
                y: 0
            }),
            std::iter::once(SheetPos {
                sheet_id,
                x: 4,
                y: 4
            })
            .collect()
        );

        cdc.set_dependencies(
            SheetPos {
                sheet_id,
                x: 4,
                y: 4,
            },
            None,
        );

        assert_eq!(
            cdc.get_dependent_cells(SheetPos {
                sheet_id,
                x: 0,
                y: 0
            }),
            HashSet::new()
        );

        cdc.set_dependencies(
            SheetPos {
                sheet_id,
                x: 11,
                y: 11,
            },
            Some(vec![SheetPos {
                sheet_id,
                x: 10,
                y: 10,
            }]),
        );

        assert_eq!(
            cdc.get_dependent_cells(SheetPos {
                sheet_id,
                x: 10,
                y: 10
            }),
            std::iter::once(SheetPos {
                sheet_id,
                x: 11,
                y: 11
            })
            .collect()
        );
    }
}
