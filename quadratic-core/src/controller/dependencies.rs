use std::{self};

use std::collections::{HashMap, HashSet};

use crate::grid::Grid;
use crate::SheetPos;

use super::GridController;

/// track code dependencies per cell -- this is built on load and does not need to be serialized
#[derive(Debug, Clone, Default)]
pub struct Dependencies {
    dependencies: HashMap<SheetPos, HashSet<SheetPos>>,
}

impl Dependencies {
    pub fn new(grid: &Grid) -> Self {
        let mut deps = Dependencies {
            dependencies: HashMap::new(),
        };
        grid.sheets().iter().for_each(|sheet| {
            sheet
                .code_cells
                .iter()
                .for_each(|(code_cell_pos, code_cell)| {
                    if let Some(output) = &code_cell.output {
                        if let Some(cells_accessed) = &output.cells_accessed() {
                            cells_accessed.iter().for_each(|cell_accessed| {
                                // cannot depend on ourselves
                                if sheet.id != cell_accessed.sheet_id
                                    || code_cell_pos.x != cell_accessed.x
                                    || code_cell_pos.y != cell_accessed.y
                                {
                                    deps.dependencies
                                        .entry(*cell_accessed)
                                        .or_default()
                                        .insert(code_cell_pos.to_sheet_pos(sheet.id));
                                }
                            });
                        }
                    }
                });
        });
        deps
    }

    pub fn get(&self, cell: SheetPos) -> Option<&HashSet<SheetPos>> {
        self.dependencies.get(&cell)
    }

    pub fn add(&mut self, cell: SheetPos, dep: SheetPos) {
        // cannot depend on ourselves
        if cell != dep {
            self.dependencies.entry(cell).or_default().insert(dep);
        }
    }

    pub fn remove(&mut self, cell: SheetPos, dep: SheetPos) {
        if let Some(deps) = self.dependencies.get_mut(&cell) {
            deps.retain(|&x| x != dep);
        }
    }

    pub fn to_debug(sheet_pos: SheetPos, dependencies: &HashSet<SheetPos>) -> String {
        let mut s = format!("[Dependent Cells] for {}: ", sheet_pos);
        for dep in dependencies {
            s.push_str(&format!("{}, ", dep));
        }
        s
    }
}

impl GridController {
    pub fn get_dependent_cells(&self, cell: SheetPos) -> Option<&HashSet<SheetPos>> {
        self.dependencies.get(cell)
    }

    pub fn update_dependent_cells(
        &mut self,
        cell: SheetPos,
        deps: Option<HashSet<SheetPos>>,
        old_deps: Option<HashSet<SheetPos>>,
    ) {
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
    use std::collections::HashSet;

    use crate::{
        grid::{CodeCellRunOutput, CodeCellRunResult, CodeCellValue, Grid},
        CellValue, Pos, SheetPos, Value,
    };

    use super::Dependencies;
    #[test]
    fn test_graph() {
        let mut cdc = Grid::new();
        let sheet_id = cdc.sheet_ids()[0];
        let sheet = cdc.sheet_mut_from_id(sheet_id);
        sheet.set_cell_value(Pos { x: 0, y: 0 }, CellValue::Number(1.into()));
        sheet.set_cell_value(Pos { x: 0, y: 1 }, CellValue::Number(2.into()));
        let mut cells_accessed = HashSet::new();
        let pos00 = SheetPos {
            sheet_id,
            x: 0,
            y: 0,
        };
        let pos01 = SheetPos {
            sheet_id,
            x: 0,
            y: 1,
        };
        cells_accessed.insert(pos00);
        cells_accessed.insert(pos01);

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
                    result: CodeCellRunResult::Ok {
                        output_value: Value::Single(CellValue::Text("test".to_string())),
                        cells_accessed,
                    },
                }),
            }),
        );
        let pos02 = SheetPos {
            sheet_id,
            x: 0,
            y: 2,
        };

        let dependencies = Dependencies::new(&cdc);

        assert_eq!(dependencies.dependencies.len(), 2);
        assert_eq!(dependencies.get(pos00).unwrap().len(), 1);
        assert_eq!(dependencies.get(pos00).unwrap().iter().next(), Some(&pos02));
        assert_eq!(dependencies.get(pos01).unwrap().iter().next(), Some(&pos02));
        assert_eq!(dependencies.get(pos02), None);
    }

    #[test]
    fn test_no_self_dependency() {
        let mut cdc = Grid::new();
        let sheet_id = cdc.sheet_ids()[0];
        let sheet = cdc.sheet_mut_from_id(sheet_id);

        sheet.set_cell_value(Pos { x: 0, y: 0 }, CellValue::Number(1.into()));
        sheet.set_cell_value(Pos { x: 0, y: 1 }, CellValue::Number(2.into()));

        let mut cells_accessed = HashSet::new();
        let pos00 = SheetPos {
            sheet_id,
            x: 0,
            y: 0,
        };
        let pos01 = SheetPos {
            sheet_id,
            x: 0,
            y: 1,
        };
        cells_accessed.insert(pos00);
        cells_accessed.insert(pos01);

        // this should not be added as it's a self dependency
        cells_accessed.insert(SheetPos {
            sheet_id,
            x: 0,
            y: 2,
        });

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
                    result: CodeCellRunResult::Ok {
                        output_value: Value::Single(CellValue::Text("test".to_string())),
                        cells_accessed,
                    },
                }),
            }),
        );
        let pos02 = SheetPos {
            sheet_id,
            x: 0,
            y: 2,
        };

        let dependencies = Dependencies::new(&cdc);

        assert_eq!(dependencies.dependencies.len(), 2);
        assert_eq!(dependencies.get(pos00).unwrap().len(), 1);
        assert_eq!(dependencies.get(pos00).unwrap().iter().next(), Some(&pos02));
        assert_eq!(dependencies.get(pos01).unwrap().iter().next(), Some(&pos02));
        assert_eq!(dependencies.get(pos02), None);
    }
}
