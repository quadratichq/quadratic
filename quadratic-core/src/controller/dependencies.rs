use std::{self};

use std::collections::HashSet;

use crate::{CellValue, SheetPos, SheetRect, Value, grid::CodeCellLocation};

use super::GridController;

impl GridController {
    /// Searches all data_tables and CellValue::Code in sheets for cells that are dependent on the given sheet_rect.
    /// Returns CodeCellLocation which can be either a sheet-level code cell or an embedded code cell in a DataTable.
    pub fn get_dependent_code_cells(
        &self,
        sheet_rect: SheetRect,
    ) -> Option<HashSet<CodeCellLocation>> {
        let all_dependent_locs = self
            .cells_accessed()
            .get_locations_associated_with_region(sheet_rect.to_region());

        let mut dependent_cells = HashSet::new();

        for loc in all_dependent_locs {
            match loc {
                CodeCellLocation::Sheet(sheet_pos) => {
                    if let Some(loc) = self.validate_sheet_code_cell(sheet_pos) {
                        dependent_cells.insert(loc);
                    }
                }
                CodeCellLocation::Embedded { table_pos, x, y } => {
                    if let Some(loc) = self.validate_embedded_code_cell(table_pos, x, y) {
                        dependent_cells.insert(loc);
                    }
                }
            }
        }

        if dependent_cells.is_empty() {
            None
        } else {
            Some(dependent_cells)
        }
    }

    /// Validates a sheet-level code cell exists and doesn't have self-reference.
    /// Returns the CodeCellLocation if valid, None otherwise.
    fn validate_sheet_code_cell(&self, sheet_pos: SheetPos) -> Option<CodeCellLocation> {
        let sheet = self.try_sheet(sheet_pos.sheet_id)?;
        let pos = sheet_pos.into();

        // First check for CellValue::Code in columns
        if let Some(CellValue::Code(code_cell)) = sheet.cell_value_ref(pos) {
            // ignore code cells that have self reference
            if !code_cell
                .code_run
                .cells_accessed
                .contains(sheet_pos, self.a1_context())
            {
                return Some(CodeCellLocation::Sheet(sheet_pos));
            }
            return None;
        }

        // Otherwise check data_tables (code_run-based tables)
        let data_table = sheet.data_table_at(&pos)?;
        let code_run = data_table.code_run()?;

        // ignore code cells that have self reference
        if !code_run
            .cells_accessed
            .contains(sheet_pos, self.a1_context())
        {
            return Some(CodeCellLocation::Sheet(sheet_pos));
        }
        None
    }

    /// Validates an embedded code cell exists in a DataTable and doesn't have self-reference.
    /// Returns the CodeCellLocation if valid, None otherwise.
    fn validate_embedded_code_cell(
        &self,
        table_pos: SheetPos,
        x: u32,
        y: u32,
    ) -> Option<CodeCellLocation> {
        let sheet = self.try_sheet(table_pos.sheet_id)?;
        let data_table = sheet.data_table_at(&table_pos.into())?;

        // Get the embedded code cell from the array
        let Value::Array(array) = &data_table.value else {
            return None;
        };

        let CellValue::Code(code_cell) = array.get(x, y).ok()? else {
            return None;
        };

        // ignore code cells that have self reference
        // For embedded cells, we check if the cells_accessed contains the table position
        // (since the embedded cell doesn't have its own sheet position)
        if !code_cell
            .code_run
            .cells_accessed
            .contains(table_pos, self.a1_context())
        {
            return Some(CodeCellLocation::embedded(table_pos, x, y));
        }
        None
    }
}

#[cfg(test)]
mod test {
    use crate::{
        CellValue, Pos, SheetPos, SheetRect, Value,
        controller::{
            GridController, active_transactions::pending_transaction::PendingTransaction,
        },
        grid::{CellsAccessed, CodeCellLanguage, CodeCellLocation, CodeRun, DataTable, DataTableKind},
    };

    #[test]
    fn test_graph() {
        let mut gc = GridController::test();
        let sheet_id = gc.sheet_ids()[0];
        let sheet_pos_11 = pos![sheet_id!1, 1];
        let sheet_pos_12 = pos![sheet_id!1, 2];
        gc.set_cell_value(sheet_pos_11, "1".to_string(), None, false);
        gc.set_cell_value(sheet_pos_12, "2".to_string(), None, false);
        let mut cells_accessed = CellsAccessed::default();

        let sheet_rect = SheetRect {
            min: sheet_pos_11.into(),
            max: sheet_pos_12.into(),
            sheet_id,
        };
        cells_accessed.add_sheet_rect(sheet_rect);
        let code_run = CodeRun {
            language: CodeCellLanguage::Python,
            code: r#"test"#.to_string(),
            formula_ast: None,
            std_err: None,
            std_out: None,
            error: None,
            return_type: Some("text".into()),
            line_number: None,
            output_type: None,
            cells_accessed: cells_accessed.clone(),
        };

        let sheet_pos_13 = pos![sheet_id!1, 3];

        let mut transaction = PendingTransaction::default();
        gc.finalize_data_table(
            &mut transaction,
            sheet_pos_13,
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
            false,
        );

        let deps = gc.get_dependent_code_cells(sheet_pos_11.into()).unwrap();
        assert_eq!(deps.len(), 1);
        assert!(deps.contains(&CodeCellLocation::Sheet(sheet_pos_13)));

        let deps = gc.get_dependent_code_cells(sheet_pos_12.into()).unwrap();
        assert!(deps.contains(&CodeCellLocation::Sheet(sheet_pos_13)));

        assert_eq!(gc.get_dependent_code_cells(sheet_pos_13.into()), None);
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
            SheetPos {
                x: 2,
                y: 1,
                sheet_id,
            },
            CodeCellLanguage::Formula,
            "A1 + 5".to_string(),
            None,
            None,
            false,
        );
        assert_eq!(
            gc.get_dependent_code_cells(SheetRect {
                min: Pos { x: 1, y: 1 },
                max: Pos { x: 1, y: 1 },
                sheet_id
            }),
            Some(
                vec![CodeCellLocation::Sheet(SheetPos {
                    x: 2,
                    y: 1,
                    sheet_id
                })]
                .into_iter()
                .collect()
            )
        );
    }
}
