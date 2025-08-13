use std::collections::HashSet;

use crate::{MultiSheetPos, SheetRect};

use super::GridController;

impl GridController {
    /// Searches all data_tables in all sheets for cells that are dependent on the given sheet_rect.
    pub fn get_dependent_code_cells(
        &self,
        sheet_rect: &SheetRect,
    ) -> Option<HashSet<MultiSheetPos>> {
        let all_dependent_cells = self
            .cells_accessed()
            .get_positions_associated_with_region(sheet_rect.to_region());

        let mut dependent_cells = HashSet::new();

        for dependent_cell in all_dependent_cells {
            let sheet_id = dependent_cell.sheet_id;

            let Some(sheet) = self.try_sheet(sheet_id) else {
                continue;
            };

            let Some(data_table_sheet_pos) = dependent_cell.to_sheet_pos(sheet) else {
                continue;
            };

            let Some(data_table) = sheet.data_table_at(&dependent_cell.multi_pos) else {
                continue;
            };

            let Some(code_run) = data_table.code_run() else {
                continue;
            };

            // ignore code cells that have self reference
            if !code_run
                .cells_accessed
                .contains(data_table_sheet_pos, self.a1_context())
            {
                dependent_cells.insert(dependent_cell);
            }
        }

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
        CellValue, Pos, SheetPos, SheetRect, Value,
        controller::{
            GridController, active_transactions::pending_transaction::PendingTransaction,
        },
        grid::{CellsAccessed, CodeCellLanguage, CodeRun, DataTable, DataTableKind},
    };

    #[test]
    fn test_graph() {
        let mut gc = GridController::test();
        let sheet_id = gc.sheet_ids()[0];
        let sheet = gc.sheet_mut(sheet_id);
        let _ = sheet.set_cell_value(Pos { x: 0, y: 0 }, CellValue::Number(1.into()));
        let _ = sheet.set_cell_value(Pos { x: 0, y: 1 }, CellValue::Number(2.into()));
        let mut cells_accessed = CellsAccessed::default();
        let sheet_pos_00 = pos![sheet_id!A1];
        let sheet_pos_01 = pos![sheet_id!A2];
        let sheet_rect = SheetRect {
            min: sheet_pos_00.into(),
            max: sheet_pos_01.into(),
            sheet_id,
        };
        cells_accessed.add_sheet_rect(sheet_rect);
        let code_run = CodeRun {
            language: CodeCellLanguage::Python,
            code: r#"test"#.to_string(),
            std_err: None,
            std_out: None,
            error: None,
            return_type: Some("text".into()),
            line_number: None,
            output_type: None,
            cells_accessed: cells_accessed.clone(),
        };

        let sheet_pos_02 = pos![sheet_id!A3];

        let mut transaction = PendingTransaction::default();
        gc.finalize_data_table(
            &mut transaction,
            sheet_pos_02.into(),
            Some(DataTable::new(
                DataTableKind::CodeRun(code_run),
                "Table 1",
                Value::Single(CellValue::Text("test".to_string())),
                false,
                Some(true),
                Some(true),
                None,
            )),
            None,
        )
        .unwrap();

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
            Some(&sheet_pos_02.into())
        );
        assert_eq!(
            gc.get_dependent_code_cells(&sheet_pos_01.into())
                .unwrap()
                .iter()
                .next(),
            Some(&sheet_pos_02.into())
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
            false,
        );
        gc.set_code_cell(
            SheetPos::new(sheet_id, 2, 1),
            CodeCellLanguage::Formula,
            "A1 + 5".to_string(),
            None,
            None,
            false,
        );
        assert_eq!(
            gc.get_dependent_code_cells(&SheetRect {
                min: Pos { x: 1, y: 1 },
                max: Pos { x: 1, y: 1 },
                sheet_id
            }),
            Some(
                vec![
                    SheetPos {
                        x: 2,
                        y: 1,
                        sheet_id
                    }
                    .into()
                ]
                .into_iter()
                .collect()
            )
        );
    }
}
