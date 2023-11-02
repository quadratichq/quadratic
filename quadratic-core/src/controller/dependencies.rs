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
                            // cannot depend on ourselves
                            if cell_ref != cell_accessed {
                                deps.dependencies
                                    .entry(*cell_accessed)
                                    .or_default()
                                    .insert(*cell_ref);
                            }
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
        // cannot depend on ourselves
        if cell != dep {
            self.dependencies.entry(cell).or_default().insert(dep);
        }
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
        crate::util::dbgjs("deps****");
        crate::util::dbgjs(deps.clone());
        crate::util::dbgjs(old_deps.clone());
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

#[cfg(test)]
mod test {
    use crate::{
        grid::{CodeCellRunOutput, CodeCellValue, Grid},
        CellValue, Pos, Value,
    };

    use super::Dependencies;
    #[test]
    fn test_graph() {
        let mut cdc = Grid::new();
        let sheet_id = cdc.sheet_ids()[0];
        let sheet = cdc.sheet_mut_from_id(sheet_id);
        sheet.set_cell_value(Pos { x: 0, y: 0 }, CellValue::Number(1.into()));
        sheet.set_cell_value(Pos { x: 0, y: 1 }, CellValue::Number(2.into()));
        let mut cells_accessed = vec![];
        let cell_ref00 = sheet.get_or_create_cell_ref(Pos { x: 0, y: 0 });
        let cell_ref01 = sheet.get_or_create_cell_ref(Pos { x: 0, y: 1 });
        cells_accessed.push(cell_ref00);
        cells_accessed.push(cell_ref01);
        sheet.set_code_cell_value(
            Pos { x: 0, y: 2 },
            Some(CodeCellValue {
                code_string: "1".to_string(),
                language: crate::grid::CodeCellLanguage::Python,
                formatted_code_string: None,
                last_modified: String::default(),
                output: Some(CodeCellRunOutput {
                    std_err: None,
                    std_out: None,
                    result: crate::grid::CodeCellRunResult::Ok {
                        output_value: Value::Single(CellValue::Text("test".to_string())),
                        cells_accessed: cells_accessed.clone(),
                    },
                }),
            }),
        );
        let cell_ref02 = sheet.get_or_create_cell_ref(Pos { x: 0, y: 2 });

        let dependencies = Dependencies::new(&cdc);

        assert_eq!(dependencies.dependencies.len(), 2);
        assert_eq!(dependencies.get(cell_ref00).unwrap().len(), 1);
        assert_eq!(
            dependencies.get(cell_ref00).unwrap().iter().next(),
            Some(&cell_ref02)
        );
        assert_eq!(
            dependencies.get(cell_ref01).unwrap().iter().next(),
            Some(&cell_ref02)
        );
        assert_eq!(dependencies.get(cell_ref02), None);
    }
}
