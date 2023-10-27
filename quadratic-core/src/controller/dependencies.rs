use std::{self};

use std::collections::{HashMap, HashSet};

use crate::grid::{CellRef, Grid, Sheet};

use super::GridController;

/// track code dependencies per cell -- this is built on load and does not need to be serialized
#[derive(Debug, Clone, Default)]
pub struct Dependencies {
    dependencies: HashMap<CellRef, HashSet<CellRef>>,
}

impl Dependencies {
    pub fn new(grid: &Grid) -> Self {
        let mut deps = Dependencies {
            dependencies: HashMap::new(),
        };
        grid.sheets().iter().for_each(|sheet| {
            sheet.code_cells.iter().for_each(|(cell_ref, code_cell)| {
                if let Some(output) = code_cell.output.as_ref() {
                    if let Some(cells_accessed) = output.cells_accessed() {
                        cells_accessed.iter().for_each(|cell_accessed| {
                            deps.dependencies
                                .entry(*cell_accessed)
                                .or_default()
                                .insert(*cell_ref);
                        });
                    }
                }
            });
        });
        deps
    }

    pub fn get(&self, cell: CellRef) -> Option<&HashSet<CellRef>> {
        self.dependencies.get(&cell)
    }

    pub fn add(&mut self, cell: CellRef, dep: CellRef) {
        self.dependencies
            .entry(cell)
            .or_default()
            .insert(dep);
    }

    pub fn remove(&mut self, cell: CellRef, dep: CellRef) {
        if let Some(deps) = self.dependencies.get_mut(&cell) {
            deps.retain(|&x| x != dep);
        }
    }

    pub fn to_debug(cell_ref: CellRef, dependencies: &HashSet<CellRef>, sheet: &Sheet) -> String {
        let pos = sheet.cell_ref_to_pos(cell_ref);
        let mut s = format!("[Dependent Cells] for {}: ", pos.unwrap());
        for dep in dependencies {
            s.push_str(&format!("{}, ", sheet.cell_ref_to_pos(*dep).unwrap()));
        }
        s
    }
}

impl GridController {
    pub fn get_dependent_cells(&self, cell: CellRef) -> Option<&HashSet<CellRef>> {
        self.dependencies.get(cell)
    }

    pub fn update_dependent_cells(
        &mut self,
        cell: CellRef,
        deps: Option<Vec<CellRef>>,
        old_deps: Option<Vec<CellRef>>,
    ) {
        if cfg!(feature = "show-operations") {
            crate::util::dbgjs(&format!(
                "[Dependent Cells] changing: {:?} {:?}",
                old_deps, deps
            ));
        }

        if let Some(old_deps) = old_deps {
            for old_dep in old_deps {
                self.dependencies.remove(old_dep, cell);
            }
        }
        if let Some(deps) = deps {
            for dep in deps {
                // ensure we don't add a dependency on ourselves
                if dep != cell {
                    self.dependencies.add(dep, cell);
                }
            }
        }
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
// use crate::{grid::Grid, Pos, SheetPos, SheetRect};
// #[test]
// fn test_graph() {
//     let mut cdc = Grid::new();
//     let sheet_id = cdc.sheet_ids()[0];

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
