use crate::{
    CopyFormats, SheetPos,
    a1::A1Context,
    cell_values::CellValues,
    controller::{
        active_transactions::pending_transaction::PendingTransaction,
        operations::operation::Operation,
    },
    grid::Sheet,
};

use super::MAX_OPERATION_SIZE_COL_ROW;

impl Sheet {
    // create reverse operations for values in the column broken up by MAX_OPERATION_SIZE
    pub(crate) fn reverse_values_ops_for_column(&self, column: i64) -> Vec<Operation> {
        let mut reverse_operations = Vec::new();

        if let Some((min, max)) = self.column_bounds(column, true) {
            let mut current_min = min;
            while current_min <= max {
                let current_max = (current_min + MAX_OPERATION_SIZE_COL_ROW).min(max);
                let mut values = CellValues::new(1, (current_max - current_min) as u32 + 1);

                if let Some(col) = self.columns.get_column(column) {
                    for y in current_min..=current_max {
                        if let Some(cell_value) = col.values.get(&y) {
                            values.set(0, (y - current_min) as u32, cell_value.clone());
                        }
                    }
                }
                reverse_operations.push(Operation::SetCellValues {
                    sheet_pos: SheetPos::new(self.id, column, min),
                    values,
                });
                current_min = current_max + 1;
            }
        }

        reverse_operations
    }

    /// Creates reverse operations for cell formatting within the column.
    fn reverse_formats_ops_for_column(&self, column: i64) -> Vec<Operation> {
        if let Some(formats) = self.formats.copy_column(column) {
            vec![Operation::SetCellFormatsA1 {
                sheet_id: self.id,
                formats,
            }]
        } else {
            vec![]
        }
    }

    /// Creates reverse operations for borders within the column.
    fn reverse_borders_ops_for_column(&self, column: i64) -> Vec<Operation> {
        if let Some(borders) = self.borders.copy_column(column) {
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

    fn delete_column_offset(&mut self, transaction: &mut PendingTransaction, column: i64) {
        let (changed, new_size) = self.offsets.delete_column(column);
        if let Some(new_size) = new_size {
            transaction
                .reverse_operations
                .push(Operation::ResizeColumn {
                    sheet_id: self.id,
                    column,
                    new_size,
                    client_resized: false,
                });
        }
        if !changed.is_empty() && !transaction.is_server() {
            changed.iter().for_each(|(index, size)| {
                transaction.offsets_modified(self.id, Some(*index), None, Some(*size));
            });
        }
    }

    /// Deletes columns and returns the operations to undo the deletion.
    pub(crate) fn delete_column(
        &mut self,
        transaction: &mut PendingTransaction,
        column: i64,
        copy_formats: CopyFormats,
        a1_context: &A1Context,
    ) {
        // create undo operations for the deleted column (only when needed since
        // it's a bit expensive)
        if transaction.is_user_ai_undo_redo() {
            transaction
                .reverse_operations
                .extend(self.reverse_borders_ops_for_column(column));
            transaction
                .reverse_operations
                .extend(self.reverse_formats_ops_for_column(column));
            transaction
                .reverse_operations
                .extend(self.reverse_values_ops_for_column(column));
        }

        // mark hashes of existing columns dirty
        transaction.add_dirty_hashes_from_sheet_columns(self, column, None);

        self.delete_column_offset(transaction, column);

        // todo: this can be optimized by adding a fn that checks if there are
        // any fills beyond the deleted column

        // remove the column's data from the sheet
        if self.formats.has_fills() {
            transaction.add_fill_cells(self.id);
        }

        // remove the column's formats from the sheet
        self.formats.remove_column(column);

        // remove the column's borders from the sheet
        self.borders.remove_column(column);
        transaction.sheet_borders.insert(self.id);

        self.columns.remove_column(column);

        let changed_selections =
            self.validations
                .remove_column(transaction, self.id, column, a1_context);

        transaction.add_dirty_hashes_from_selections(self, a1_context, changed_selections);

        if transaction.is_user_ai_undo_redo() {
            // reverse operation to create the column (this will also shift all impacted columns)
            transaction
                .reverse_operations
                .push(Operation::InsertColumn {
                    sheet_id: self.id,
                    column,
                    copy_formats,
                });
        }

        self.recalculate_bounds(a1_context);

        // mark hashes of new columns dirty
        transaction.add_dirty_hashes_from_sheet_columns(self, column, None);
    }

    /// Deletes columns. Columns is a vec of all columns to be deleted. This fn
    /// will dedup and sort the columns.
    pub fn delete_columns(
        &mut self,
        transaction: &mut PendingTransaction,
        columns: Vec<i64>,
        copy_formats: CopyFormats,
        a1_context: &A1Context,
    ) {
        if columns.is_empty() {
            return;
        }

        let mut columns = columns.clone();
        columns.sort_unstable();
        columns.dedup();
        columns.reverse();

        self.delete_tables_with_all_columns(transaction, &columns);
        self.delete_tables_columns(transaction, &columns);
        self.delete_chart_columns(transaction, &columns);
        self.move_tables_leftwards(transaction, &columns);

        for column in columns {
            self.delete_column(transaction, column, copy_formats, a1_context);
        }
    }
}

#[cfg(test)]
mod tests {
    use crate::{
        DEFAULT_COLUMN_WIDTH,
        a1::A1Selection,
        assert_cell_format_fill_color, assert_display_cell_value,
        controller::GridController,
        grid::{CellWrap, CodeCellLanguage},
        test_util::{first_sheet_id, test_set_values},
    };

    use super::*;

    #[test]
    fn test_delete_column() {
        let mut gc = GridController::test();
        let sheet_id = first_sheet_id(&gc);
        test_set_values(&mut gc, sheet_id, pos![A1], 4, 4);

        gc.set_fill_color(
            &A1Selection::test_a1("A1"),
            Some("red".to_string()),
            None,
            false,
        )
        .unwrap();
        gc.set_cell_wrap(&A1Selection::test_a1("A1"), CellWrap::Clip, None, false)
            .unwrap();
        gc.set_fill_color(
            &A1Selection::test_a1("D4"),
            Some("blue".to_string()),
            None,
            false,
        )
        .unwrap();

        gc.set_code_cell(
            pos![sheet_id!B5],
            CodeCellLanguage::Formula,
            "{A1, B1}".to_string(),
            None,
            None,
            false,
        );
        gc.set_code_cell(
            pos![sheet_id!D5],
            CodeCellLanguage::Formula,
            "{A1, B1}".to_string(),
            None,
            None,
            false,
        );

        gc.set_bold(&A1Selection::test_a1("A1:A"), Some(true), None, false)
            .unwrap();
        gc.set_italic(&A1Selection::test_a1("D1:D"), Some(true), None, false)
            .unwrap();

        gc.delete_columns(sheet_id, vec![1], None, false);

        assert_display_cell_value(&gc, sheet_id, 1, 1, "1");
        assert_cell_format_fill_color(&gc, sheet_id, 3, 4, "blue");
        assert_display_cell_value(&gc, sheet_id, 3, 4, "15");
        assert_display_cell_value(&gc, sheet_id, 2, 5, "1");
    }

    #[test]
    fn values_ops_for_column() {
        let mut sheet = Sheet::test();
        sheet.test_set_values(1, 1, 2, 2, vec!["a", "b", "c", "d"]);
        let ops = sheet.reverse_values_ops_for_column(2);
        assert_eq!(ops.len(), 1);
    }

    #[test]
    fn delete_column_offset() {
        let mut sheet = Sheet::test();

        sheet.offsets.set_column_width(1, 100.0);
        sheet.offsets.set_column_width(2, 200.0);
        sheet.offsets.set_column_width(4, 400.0);

        let mut transaction = PendingTransaction::default();
        let a1_context = sheet.expensive_make_a1_context();
        sheet.delete_column(&mut transaction, 2, CopyFormats::None, &a1_context);
        assert_eq!(sheet.offsets.column_width(1), 100.0);
        assert_eq!(sheet.offsets.column_width(2), DEFAULT_COLUMN_WIDTH);
        assert_eq!(sheet.offsets.column_width(3), 400.0);
    }
}
