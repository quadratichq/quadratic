use std::{self};

use std::collections::HashSet;

use crate::{SheetPos, SheetRect};

use super::GridController;

impl GridController {
    /// Searches all data_tables in all sheets for cells that are dependent on the given sheet_rect.
    pub fn get_dependent_code_cells(&self, sheet_rect: &SheetRect) -> Option<HashSet<SheetPos>> {
        let mut dependent_cells = HashSet::new();

        let context = self.grid.a1_context();
        self.grid.sheets().iter().for_each(|sheet| {
            sheet.iter_code_runs().for_each(|(pos, code_run)| {
                if code_run.cells_accessed.intersects(sheet_rect, &context) {
                    dependent_cells.insert(pos.to_sheet_pos(sheet.id));
                }
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
    use crate::{
        controller::GridController,
        grid::{CellsAccessed, CodeCellLanguage, CodeRun, DataTable, DataTableKind},
        CellValue, Pos, SheetPos, SheetRect, Value,
    };

    #[test]
    fn test_graph() {
        let mut gc = GridController::test();
        let sheet_id = gc.sheet_ids()[0];
        let sheet = gc.sheet_mut(sheet_id);
        let _ = sheet.set_cell_value(Pos { x: 0, y: 0 }, CellValue::Number(1.into()));
        let _ = sheet.set_cell_value(Pos { x: 0, y: 1 }, CellValue::Number(2.into()));
        let mut cells_accessed = CellsAccessed::default();
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
        cells_accessed.add_sheet_rect(sheet_rect);
        let code_run = CodeRun {
            std_err: None,
            std_out: None,
            error: None,
            return_type: Some("text".into()),
            line_number: None,
            output_type: None,
            cells_accessed: cells_accessed.clone(),
        };
        sheet.set_data_table(
            Pos { x: 0, y: 2 },
            Some(DataTable::new(
                DataTableKind::CodeRun(code_run),
                "Table 1",
                Value::Single(CellValue::Text("test".to_string())),
                false,
                false,
                true,
                None,
            )),
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

    #[test]
    fn test_dependencies_near_input() {
        let mut gc = GridController::test();
        let sheet_id = gc.sheet_ids()[0];
        gc.set_cell_value(
            SheetPos {
                x: 1,
                y: 1,
                sheet_id,
            },
            "1".to_string(),
            None,
        );
        gc.set_code_cell(
            SheetPos {
                x: 2,
                y: 1,
                sheet_id,
            },
            CodeCellLanguage::Formula,
            "A1 + 5".to_string(),
            None,
        );
        assert_eq!(
            gc.get_dependent_code_cells(&SheetRect {
                min: Pos { x: 1, y: 1 },
                max: Pos { x: 1, y: 1 },
                sheet_id
            }),
            Some(
                vec![SheetPos {
                    x: 2,
                    y: 1,
                    sheet_id
                }]
                .into_iter()
                .collect()
            )
        );
    }
}
