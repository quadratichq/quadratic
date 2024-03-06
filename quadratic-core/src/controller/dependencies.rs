use std::{self};

use std::collections::HashSet;

use crate::{SheetPos, SheetRect};

use super::GridController;

impl GridController {
    /// Searches all code_runs in all sheets for cells that are dependent on the given sheet_rect.
    pub fn get_dependent_code_cells(&self, sheet_rect: &SheetRect) -> Option<HashSet<SheetPos>> {
        let mut dependent_cells = HashSet::new();

        self.grid.sheets().iter().for_each(|sheet| {
            sheet.code_runs.iter().for_each(|(pos, code_run)| {
                code_run.cells_accessed.iter().for_each(|cell_accessed| {
                    if sheet_rect.intersects(*cell_accessed) {
                        dependent_cells.insert(pos.to_sheet_pos(sheet.id));
                    }
                });
            });
        });

        if dependent_cells.is_empty() {
            None
        } else {
            Some(dependent_cells)
        }
    }
}

#[cfg(test)]
mod test {
    use std::collections::HashSet;

    use chrono::Utc;

    use crate::{
        controller::GridController,
        grid::{CodeRun, CodeRunResult},
        CellValue, Pos, SheetPos, SheetRect, Value,
    };

    #[test]
    fn test_graph() {
        let mut gc = GridController::test();
        let sheet_id = gc.sheet_ids()[0];
        let sheet = gc.sheet_mut(sheet_id);
        let _ = sheet.set_cell_value(Pos { x: 0, y: 0 }, CellValue::Number(1.into()));
        let _ = sheet.set_cell_value(Pos { x: 0, y: 1 }, CellValue::Number(2.into()));
        let mut cells_accessed = HashSet::new();
        let sheet_pos_00 = SheetPos {
            x: 0,
            y: 0,
            sheet_id,
        };
        let sheet_pos_01 = SheetPos {
            x: 0,
            y: 1,
            sheet_id,
        };
        let sheet_rect = SheetRect {
            min: sheet_pos_00.into(),
            max: sheet_pos_01.into(),
            sheet_id,
        };
        cells_accessed.insert(sheet_rect);
        sheet.set_code_run(
            Pos { x: 0, y: 2 },
            Some(CodeRun {
                formatted_code_string: None,
                last_modified: Utc::now(),
                std_err: None,
                std_out: None,
                spill_error: false,
                result: CodeRunResult::Ok(Value::Single(CellValue::Text("test".to_string()))),
                cells_accessed: cells_accessed.clone(),
            }),
        );
        let sheet_pos_02 = SheetPos {
            x: 0,
            y: 2,
            sheet_id,
        };

        assert_eq!(
            gc.get_dependent_code_cells(&sheet_pos_00.into())
                .unwrap()
                .len(),
            1
        );
        assert_eq!(
            gc.get_dependent_code_cells(&sheet_pos_00.into())
                .unwrap()
                .iter()
                .next(),
            Some(&sheet_pos_02)
        );
        assert_eq!(
            gc.get_dependent_code_cells(&sheet_pos_01.into())
                .unwrap()
                .iter()
                .next(),
            Some(&sheet_pos_02)
        );
        assert_eq!(gc.get_dependent_code_cells(&sheet_pos_02.into()), None);
    }
}
