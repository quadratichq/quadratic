use std;

use std::collections::HashSet;

use crate::grid::{CellRef, CodeCellRunResult, Grid};

impl Grid {
    /// Returns cells that _directly_ depend on `area`.
    /// Does not continue to traverse the graph.
    pub fn get_dependent_cells(&self, cell: CellRef) -> HashSet<CellRef> {
        let mut seen = HashSet::new();

        self.sheets().iter().for_each(|sheet| {
            for (cell_ref, code_cell_value) in sheet.code_cells.iter() {
                if let Some(output) = code_cell_value.output.clone() {
                    match output.result {
                        CodeCellRunResult::Ok { cells_accessed, .. } => {
                            if cells_accessed.contains(&cell) {
                                seen.insert(*cell_ref);
                            }
                        }
                        _ => (),
                    }
                }
            }
        });
        seen
    }
}

// #[cfg(test)]
// mod test {
//     use std::collections::HashSet;

//     use crate::{grid::Grid, Pos, SheetPos, SheetRect};
//     #[test]
//     fn test_graph() {
//         let mut cdc = Grid::new();
//         let sheet_id = cdc.sheet_ids()[0];

//         cdc.set_dependencies(
//             SheetPos {
//                 sheet_id,
//                 x: 3,
//                 y: 3,
//             },
//             Some(vec![SheetRect {
//                 sheet_id,
//                 min: Pos { x: 0, y: 0 },
//                 max: Pos { x: 1, y: 1 },
//             }]),
//         );

//         assert_eq!(
//             cdc.get_dependent_cells(SheetPos {
//                 sheet_id,
//                 x: 0,
//                 y: 0
//             }),
//             std::iter::once(SheetPos {
//                 sheet_id,
//                 x: 3,
//                 y: 3
//             })
//             .collect()
//         );

//         cdc.set_dependencies(
//             SheetPos {
//                 sheet_id,
//                 x: 4,
//                 y: 4,
//             },
//             Some(vec![SheetRect {
//                 sheet_id,
//                 min: Pos { x: 0, y: 0 },
//                 max: Pos { x: 1, y: 1 },
//             }]),
//         );

//         assert_eq!(
//             cdc.get_dependent_cells(SheetPos {
//                 sheet_id,
//                 x: 0,
//                 y: 0
//             }),
//             [
//                 SheetPos {
//                     sheet_id,
//                     x: 3,
//                     y: 3
//                 },
//                 SheetPos {
//                     sheet_id,
//                     x: 4,
//                     y: 4
//                 }
//             ]
//             .iter()
//             .cloned()
//             .collect()
//         );

//         cdc.set_dependencies(
//             SheetPos {
//                 sheet_id,
//                 x: 3,
//                 y: 3,
//             },
//             None,
//         );

//         assert_eq!(
//             cdc.get_dependent_cells(SheetPos {
//                 sheet_id,
//                 x: 0,
//                 y: 0
//             }),
//             std::iter::once(SheetPos {
//                 sheet_id,
//                 x: 4,
//                 y: 4
//             })
//             .collect()
//         );

//         cdc.set_dependencies(
//             SheetPos {
//                 sheet_id,
//                 x: 4,
//                 y: 4,
//             },
//             None,
//         );

//         assert_eq!(
//             cdc.get_dependent_cells(SheetPos {
//                 sheet_id,
//                 x: 0,
//                 y: 0
//             }),
//             HashSet::new()
//         );

//         cdc.set_dependencies(
//             SheetPos {
//                 sheet_id,
//                 x: 11,
//                 y: 11,
//             },
//             Some(vec![SheetRect::single_pos(SheetPos {
//                 sheet_id,
//                 x: 10,
//                 y: 10,
//             })]),
//         );

//         assert_eq!(
//             cdc.get_dependent_cells(SheetPos {
//                 sheet_id,
//                 x: 10,
//                 y: 10
//             }),
//             std::iter::once(SheetPos {
//                 sheet_id,
//                 x: 11,
//                 y: 11
//             })
//             .collect()
//         );
//     }
// }
