use std::{self};

use std::collections::HashSet;

use crate::grid::{CellRef, RegionRef};

use super::GridController;

impl GridController {
    pub fn get_dependent_cells(&self, cell: CellRef) -> Option<HashSet<CellRef>> {
        let mut dependent_cells = HashSet::new();

        self.grid.sheets().iter().for_each(|sheet| {
            sheet.code_cells.iter().for_each(|(cell_ref, code_cell)| {
                if let Some(output) = code_cell.output.as_ref() {
                    if let Some(cells_accessed) = output.cells_accessed() {
                        cells_accessed.iter().for_each(|cell_accessed| {
                            if *cell_accessed == cell {
                                dependent_cells.insert(*cell_ref);
                            }
                        });
                    }
                }
            });
        });

        if dependent_cells.is_empty() {
            return None;
        }

        Some(dependent_cells)
    }

    pub fn get_dependent_cells_for_region(&self, region: RegionRef) -> Option<HashSet<CellRef>> {
        let mut dependent_cells = HashSet::new();

        self.grid.sheets().iter().for_each(|sheet| {
            sheet.code_cells.iter().for_each(|(cell_ref, code_cell)| {
                if let Some(output) = code_cell.output.as_ref() {
                    if let Some(cells_accessed) = output.cells_accessed() {
                        cells_accessed.iter().for_each(|cell_accessed| {
                            if region.contains(cell_accessed) {
                                dependent_cells.insert(*cell_ref);
                            }
                        });
                    }
                }
            });
        });

        if dependent_cells.is_empty() {
            return None;
        }

        Some(dependent_cells)
    }
}

#[cfg(test)]
mod test {
    use crate::{
        controller::GridController,
        grid::{CodeCellRunOutput, CodeCellValue},
        CellValue, Pos, Value,
    };

    #[test]
    fn test_graph() {
        let mut gc = GridController::new();
        let cdc = gc.grid_mut();
        let sheet_id = cdc.sheet_ids()[0];
        let sheet = cdc.sheet_mut_from_id(sheet_id);
        let _ = sheet.set_cell_value(Pos { x: 0, y: 0 }, CellValue::Number(1.into()));
        let _ = sheet.set_cell_value(Pos { x: 0, y: 1 }, CellValue::Number(2.into()));
        let mut cells_accessed = vec![];
        let (cell_ref00, _) = sheet.get_or_create_cell_ref(Pos { x: 0, y: 0 });
        let (cell_ref01, _) = sheet.get_or_create_cell_ref(Pos { x: 0, y: 1 });
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
                    spill: false,
                }),
            }),
        );
        let (cell_ref02, _) = sheet.get_or_create_cell_ref(Pos { x: 0, y: 2 });

        assert_eq!(gc.get_dependent_cells(cell_ref00).unwrap().len(), 1);
        assert_eq!(
            gc.get_dependent_cells(cell_ref00).unwrap().iter().next(),
            Some(&cell_ref02)
        );
        assert_eq!(
            gc.get_dependent_cells(cell_ref01).unwrap().iter().next(),
            Some(&cell_ref02)
        );
        assert_eq!(gc.get_dependent_cells(cell_ref02), None);
    }
}
