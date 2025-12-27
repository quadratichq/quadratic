use crate::{
    CopyFormats,
    a1::A1Context,
    controller::{
        active_transactions::pending_transaction::PendingTransaction,
        operations::operation::Operation,
    },
    grid::Sheet,
};

impl Sheet {
    /// Inserts a column at the given column index.
    ///
    /// send_client indicates whether this should trigger client changes
    ///
    /// todo: this can probably be removed since transaction handles all client
    /// communications now.
    ///
    /// Note: the column that insert column receives relates to where the column
    /// is being inserted. So if insert to the left of the column, then the
    /// column is the selected column, and CopyFormats::After. If inserting to
    /// the right of the column, then the column is the selected column + 1, and
    /// CopyFormats::Before.
    pub(crate) fn insert_column(
        &mut self,
        transaction: &mut PendingTransaction,
        column: i64,
        copy_formats: CopyFormats,
        ignore_tables: bool,
        a1_context: &A1Context,
    ) {
        // mark hashes of old columns dirty
        transaction.add_dirty_hashes_from_sheet_columns(self, column, None);

        self.columns.insert_column(column);

        if !ignore_tables {
            self.check_insert_tables_columns(transaction, column, copy_formats);
            self.adjust_insert_tables_columns(transaction, column, copy_formats);
        }

        // update formatting (fn has maths to find column_inserted)
        self.formats.insert_column(column, copy_formats);
        transaction.add_fill_cells_from_columns(self, column);

        // update borders(fn has maths to find column_inserted)
        self.borders.insert_column(column, copy_formats);
        transaction.sheet_borders.insert(self.id);

        // update validations
        let changed_selections =
            self.validations
                .insert_column(transaction, self.id, column, a1_context);
        transaction.add_dirty_hashes_from_selections(self, a1_context, changed_selections);

        let changes = self.offsets.insert_column(column, copy_formats);
        if !changes.is_empty() {
            changes.iter().for_each(|(index, size)| {
                transaction.offsets_modified(self.id, Some(*index), None, Some(*size));
            });
        }

        // create undo operations for the inserted column
        if transaction.is_user_ai_undo_redo() {
            // reverse operation to delete the column (this will also shift all impacted columns)
            transaction
                .reverse_operations
                .push(Operation::DeleteColumn {
                    sheet_id: self.id,
                    column,
                    copy_formats,
                    ignore_tables: true,
                });
        }

        self.recalculate_bounds(a1_context);

        // mark hashes of new columns dirty
        transaction.add_dirty_hashes_from_sheet_columns(self, column, None);
    }
}

#[cfg(test)]
mod tests {
    use crate::{
        CellValue, Pos,
        grid::sheet::borders::{BorderSide, BorderStyleCell, BorderStyleTimestamp, CellBorderLine},
    };

    use super::*;

    #[test]
    fn insert_column_start() {
        let mut sheet = Sheet::test();
        sheet.test_set_values(1, 1, 3, 1, vec!["A", "B", "C"]);
        sheet.borders.set_style_cell(
            pos![A1],
            BorderStyleCell {
                top: Some(BorderStyleTimestamp::default()),
                bottom: Some(BorderStyleTimestamp::default()),
                left: Some(BorderStyleTimestamp::default()),
                right: Some(BorderStyleTimestamp::default()),
            },
        );
        sheet.borders.set_style_cell(
            pos![B1],
            BorderStyleCell {
                top: Some(BorderStyleTimestamp::default()),
                bottom: Some(BorderStyleTimestamp::default()),
                left: Some(BorderStyleTimestamp::default()),
                right: Some(BorderStyleTimestamp::default()),
            },
        );
        sheet.borders.set_style_cell(
            pos![C1],
            BorderStyleCell {
                top: Some(BorderStyleTimestamp::default()),
                bottom: Some(BorderStyleTimestamp::default()),
                left: Some(BorderStyleTimestamp::default()),
                right: Some(BorderStyleTimestamp::default()),
            },
        );

        let mut transaction = PendingTransaction::default();

        sheet.insert_column(
            &mut transaction,
            1,
            CopyFormats::None,
            false,
            &A1Context::default(),
        );

        assert_eq!(sheet.display_value(pos![A1]), None);
        assert_eq!(
            sheet.display_value(pos![B1]),
            Some(CellValue::Text("A".to_string()))
        );
        assert_eq!(
            sheet.display_value(pos![C1]),
            Some(CellValue::Text("B".to_string()))
        );
        assert_eq!(
            sheet.display_value(pos![D1]),
            Some(CellValue::Text("C".to_string()))
        );

        assert_eq!(sheet.borders.get_side(BorderSide::Top, pos![A1]), None);
        assert_eq!(
            sheet.borders.get_style_cell(pos![B1]).top.unwrap().line,
            CellBorderLine::default()
        );
        assert_eq!(
            sheet.borders.get_style_cell(pos![C1]).top.unwrap().line,
            CellBorderLine::default()
        );
        assert_eq!(
            sheet.borders.get_style_cell(pos![D1]).top.unwrap().line,
            CellBorderLine::default()
        );
        assert_eq!(sheet.borders.get_side(BorderSide::Top, pos![E1]), None);
    }

    #[test]
    fn insert_column_middle() {
        let mut sheet = Sheet::test();
        sheet.test_set_values(1, 1, 3, 1, vec!["A", "B", "C"]);

        let mut transaction = PendingTransaction::default();

        sheet.insert_column(
            &mut transaction,
            2,
            CopyFormats::None,
            false,
            &A1Context::default(),
        );

        assert_eq!(
            sheet.display_value(Pos { x: 1, y: 1 }),
            Some(CellValue::Text("A".to_string()))
        );
        assert_eq!(sheet.display_value(Pos { x: 2, y: 1 }), None);
        assert_eq!(
            sheet.display_value(Pos { x: 3, y: 1 }),
            Some(CellValue::Text("B".to_string()))
        );
        assert_eq!(
            sheet.display_value(Pos { x: 4, y: 1 }),
            Some(CellValue::Text("C".to_string()))
        );
    }

    #[test]
    fn insert_column_end() {
        let mut sheet = Sheet::test();
        sheet.test_set_values(1, 1, 2, 1, vec!["A", "B"]);

        let mut transaction = PendingTransaction::default();

        sheet.insert_column(
            &mut transaction,
            3,
            CopyFormats::None,
            false,
            &A1Context::default(),
        );

        assert_eq!(
            sheet.display_value(Pos { x: 1, y: 1 }),
            Some(CellValue::Text("A".to_string()))
        );
        assert_eq!(
            sheet.display_value(Pos { x: 2, y: 1 }),
            Some(CellValue::Text("B".to_string()))
        );
        assert_eq!(sheet.display_value(Pos { x: 3, y: 1 }), None);
    }

    #[test]
    fn insert_column_offset() {
        let mut sheet = Sheet::test();

        sheet.offsets.set_column_width(1, 100.0);
        sheet.offsets.set_column_width(2, 200.0);
        sheet.offsets.set_column_width(4, 400.0);

        let mut transaction = PendingTransaction::default();
        sheet.insert_column(
            &mut transaction,
            2,
            CopyFormats::None,
            false,
            &A1Context::default(),
        );
        assert_eq!(sheet.offsets.column_width(1), 100.0);
        assert_eq!(sheet.offsets.column_width(2), 200.0);
        assert_eq!(sheet.offsets.column_width(3), 200.0);
        assert_eq!(sheet.offsets.column_width(5), 400.0);
    }
}
