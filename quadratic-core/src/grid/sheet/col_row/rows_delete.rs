use crate::{
    CopyFormats, Pos, SheetPos,
    a1::A1Context,
    cell_values::CellValues,
    controller::{
        active_transactions::pending_transaction::PendingTransaction,
        operations::operation::Operation,
    },
    grid::Sheet,
};

use anyhow::{Result, bail};

use super::MAX_OPERATION_SIZE_COL_ROW;

impl Sheet {
    // create reverse operations for values in the row broken up by MAX_OPERATION_SIZE
    fn reverse_values_ops_for_row(&self, row: i64) -> Vec<Operation> {
        let mut reverse_operations = Vec::new();

        if let Some((min, max)) = self.row_bounds(row, true) {
            let mut current_min = min;
            while current_min <= max {
                let current_max = (current_min + MAX_OPERATION_SIZE_COL_ROW).min(max);
                let mut values = CellValues::new((current_max - current_min) as u32 + 1, 1);
                for x in current_min..=current_max {
                    if let Some(cell) = self.cell_value(Pos { x, y: row }) {
                        values.set((x - current_min) as u32, 0, cell);
                    }
                }
                reverse_operations.push(Operation::SetCellValues {
                    sheet_pos: SheetPos::new(self.id, min, row),
                    values,
                });
                current_min = current_max + 1;
            }
        }

        reverse_operations
    }

    /// Creates reverse operations for cell formatting within the row.
    fn reverse_formats_ops_for_row(&self, row: i64) -> Vec<Operation> {
        if let Some(formats) = self.formats.copy_row(row) {
            vec![Operation::SetCellFormatsA1 {
                sheet_id: self.id,
                formats,
            }]
        } else {
            vec![]
        }
    }

    /// Creates reverse operations for borders within the row.
    fn reverse_borders_ops_for_row(&self, row: i64) -> Vec<Operation> {
        if let Some(borders) = self.borders.copy_row(row) {
            if borders.is_empty() {
                return vec![];
            }
            vec![Operation::SetBordersA1 {
                sheet_id: self.id,
                borders,
            }]
        } else {
            vec![]
        }
    }

    fn delete_row_offset(&mut self, transaction: &mut PendingTransaction, row: i64) {
        let (changed, new_size) = self.offsets.delete_row(row);

        if let Some(new_size) = new_size {
            transaction.reverse_operations.push(Operation::ResizeRow {
                sheet_id: self.id,
                row,
                new_size,
                client_resized: false,
            });
        }
        if !changed.is_empty() && !transaction.is_server() {
            changed.iter().for_each(|(index, size)| {
                transaction
                    .offsets_modified
                    .entry(self.id)
                    .or_default()
                    .insert((None, Some(*index)), *size);
            });
        }
    }

    pub(crate) fn delete_row(
        &mut self,
        transaction: &mut PendingTransaction,
        row: i64,
        a1_context: &A1Context,
    ) {
        // create undo operations for the deleted row (only when needed since
        // it's a bit expensive)
        if transaction.is_user_undo_redo() {
            transaction
                .reverse_operations
                .extend(self.reverse_borders_ops_for_row(row));
            transaction
                .reverse_operations
                .extend(self.reverse_formats_ops_for_row(row));
            transaction
                .reverse_operations
                .extend(self.reverse_values_ops_for_row(row));
        }

        // mark hashes of existing rows dirty
        transaction.add_dirty_hashes_from_sheet_rows(self, row, None);

        self.delete_row_offset(transaction, row);

        // todo: this can be optimized by adding a fn that checks if there are
        // any fills beyond the deleted column

        if self.formats.has_fills() {
            transaction.add_fill_cells(self.id);
        }

        // remove the row's formats from the sheet
        self.formats.remove_row(row);

        // remove the row's borders from the sheet
        self.borders.remove_row(row);
        transaction.sheet_borders.insert(self.id);

        // update all cells that were impacted by the deletion
        self.columns.remove_row(row);

        let changed_selections = self
            .validations
            .remove_row(transaction, self.id, row, a1_context);

        transaction.add_dirty_hashes_from_selections(self, a1_context, changed_selections);

        if transaction.is_user_undo_redo() {
            // reverse operation to create the row (this will also shift all impacted rows)
            transaction.reverse_operations.push(Operation::InsertRow {
                sheet_id: self.id,
                row,
                copy_formats: CopyFormats::None,
                ignore_tables: true,
            });
        }

        self.recalculate_bounds(a1_context);

        // mark hashes of new rows dirty
        transaction.add_dirty_hashes_from_sheet_rows(self, row, None);
    }

    /// Deletes rows. Returns false if the rows contain table UI and the
    /// operation was aborted.
    #[allow(clippy::result_unit_err)]
    pub fn delete_rows(
        &mut self,
        transaction: &mut PendingTransaction,
        rows: Vec<i64>,
        ignore_tables: bool,
        _copy_formats: CopyFormats,
        a1_context: &A1Context,
    ) -> Result<()> {
        if rows.is_empty() {
            return Ok(());
        }

        let mut rows = rows.clone();
        rows.sort_unstable();
        rows.dedup();
        rows.reverse();

        if self.ensure_no_table_ui(&rows) {
            let e = "delete_rows_error".to_string();
            if transaction.is_user_undo_redo() && cfg!(target_family = "wasm") {
                let severity = crate::grid::js_types::JsSnackbarSeverity::Warning;
                crate::wasm_bindings::js::jsClientMessage(e.to_owned(), severity.to_string());
            }
            bail!(e);
        }

        if !ignore_tables {
            self.delete_tables_with_all_rows(transaction, &rows);
            self.delete_table_rows(transaction, &rows);
            self.delete_chart_rows(transaction, &rows);
            self.move_tables_upwards(transaction, &rows);
        }

        for row in rows {
            self.delete_row(transaction, row, a1_context);
        }

        Ok(())
    }
}

#[cfg(test)]
mod test {
    use crate::{
        CellValue, DEFAULT_ROW_HEIGHT, controller::execution::TransactionSource, grid::CellWrap,
    };

    use super::*;

    #[test]
    fn test_delete_row_values() {
        let mut sheet = Sheet::test();
        sheet.test_set_values(
            1,
            1,
            4,
            4,
            vec![
                "A", "B", "C", "D", "E", "F", "G", "H", "I", "J", "K", "L", "M", "N", "O", "P",
            ],
        );
        sheet.recalculate_bounds(&sheet.expensive_make_a1_context());
        sheet.columns.remove_row(1);
        assert_eq!(
            sheet.cell_value(Pos { x: 1, y: 1 }),
            Some(CellValue::Text("E".to_string()))
        );
    }

    #[test]
    fn test_delete_row() {
        // will delete row 1
        let mut sheet = Sheet::test();
        sheet.test_set_values(
            1,
            1,
            4,
            4,
            vec![
                "A", "B", "C", "D", "E", "F", "G", "H", "I", "J", "K", "L", "M", "N", "O", "P",
            ],
        );
        sheet
            .formats
            .fill_color
            .set(pos![A2], Some("red".to_string()));
        sheet.formats.wrap.set(pos![B2], Some(CellWrap::Clip));
        sheet
            .formats
            .fill_color
            .set(pos![C2], Some("blue".to_string()));
        sheet.test_set_code_run_array(1, 3, vec!["=A1", "=A2"], false);
        sheet.test_set_code_run_array(1, 4, vec!["=A1", "=A2"], false);

        sheet.formats.bold.set_rect(1, 1, Some(1), None, Some(true));
        sheet
            .formats
            .italic
            .set_rect(1, 1, Some(1), None, Some(true));

        sheet
            .formats
            .bold
            .set_rect(2, 1, Some(2), None, Some(false));
        sheet
            .formats
            .italic
            .set_rect(2, 1, Some(2), None, Some(false));

        let a1_context = sheet.expensive_make_a1_context();

        sheet.recalculate_bounds(&a1_context);

        let mut transaction = PendingTransaction {
            source: TransactionSource::User,
            ..Default::default()
        };

        let _ = sheet.delete_rows(
            &mut transaction,
            Vec::from(&[1]),
            false,
            CopyFormats::None,
            &a1_context,
        );
        assert_eq!(transaction.reverse_operations.len(), 3);

        assert_eq!(
            sheet.cell_value(Pos { x: 1, y: 1 }),
            Some(CellValue::Text("E".to_string()))
        );
        assert_eq!(
            sheet.formats.fill_color.get(pos![C1]),
            Some("blue".to_string())
        );
        assert!(sheet.data_tables.get_at(&Pos { x: 1, y: 2 }).is_some());
        assert!(sheet.data_tables.get_at(&Pos { x: 1, y: 3 }).is_some());
    }

    #[test]
    fn test_values_ops_for_column() {
        let mut sheet = Sheet::test();
        sheet.test_set_values(1, 1, 2, 2, vec!["a", "b", "c", "d"]);
        let ops = sheet.reverse_values_ops_for_row(2);
        assert_eq!(ops.len(), 1);
    }

    #[test]
    fn delete_row_offset() {
        let mut sheet = Sheet::test();
        sheet.offsets.set_row_height(1, 100.0);
        sheet.offsets.set_row_height(2, 200.0);
        sheet.offsets.set_row_height(4, 400.0);

        let a1_context = sheet.expensive_make_a1_context();

        let mut transaction = PendingTransaction::default();
        sheet.delete_row(&mut transaction, 2, &a1_context);
        assert_eq!(sheet.offsets.row_height(1), 100.0);
        assert_eq!(sheet.offsets.row_height(2), DEFAULT_ROW_HEIGHT);
        assert_eq!(sheet.offsets.row_height(3), 400.0);
    }
}
