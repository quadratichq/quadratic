use crate::{
    CopyFormats,
    a1::A1Context,
    controller::{
        active_transactions::pending_transaction::PendingTransaction,
        operations::operation::Operation,
    },
    grid::{GridBounds, Sheet},
};

impl Sheet {
    /// Removes any value at row and shifts the remaining values up by 1.
    fn insert_and_shift_values(&mut self, row: i64) {
        // use the sheet bounds to determine the approximate bounds for the impacted range
        if let GridBounds::NonEmpty(bounds) = self.bounds(true) {
            for x in bounds.min.x..=bounds.max.x {
                if let Some(column) = self.columns.get_mut(&x) {
                    let mut keys_to_move: Vec<i64> = column
                        .values
                        .keys()
                        .filter(|&key| *key >= row)
                        .cloned()
                        .collect();

                    keys_to_move.sort_unstable_by(|a, b| b.cmp(a));

                    // Move down values
                    for key in keys_to_move {
                        if let Some(value) = column.values.remove(&key) {
                            column.values.insert(key + 1, value);
                        }
                    }
                }
            }
        }
    }

    pub(crate) fn insert_row(
        &mut self,
        transaction: &mut PendingTransaction,
        row: i64,
        copy_formats: CopyFormats,
        a1_context: &A1Context,
    ) {
        self.insert_and_shift_values(row);

        // update formatting
        self.formats.insert_row(row, copy_formats);
        transaction.add_fill_cells(self.id);

        // signal client to update the borders for changed columns
        self.borders.insert_row(row, copy_formats);
        transaction.sheet_borders.insert(self.id);

        self.check_insert_tables_rows(transaction, row);
        self.adjust_insert_tables_rows(transaction, row);

        // mark hashes of new rows dirty
        transaction.add_dirty_hashes_from_sheet_rows(self, row, None);

        let changed_selections = self
            .validations
            .insert_row(transaction, self.id, row, a1_context);
        transaction.add_dirty_hashes_from_selections(self, a1_context, changed_selections);

        let changes = self.offsets.insert_row(row);
        changes.iter().for_each(|(index, size)| {
            transaction.offsets_modified(self.id, None, Some(*index), Some(*size));
        });

        // create undo operations for the inserted column
        if transaction.is_user_undo_redo() {
            // reverse operation to delete the row (this will also shift all impacted rows)
            transaction.reverse_operations.push(Operation::DeleteRow {
                sheet_id: self.id,
                row,
                copy_formats,
            });
        }
    }
}

#[cfg(test)]
mod test {
    use crate::{
        CellValue, DEFAULT_ROW_HEIGHT, Pos,
        a1::A1Context,
        grid::sheet::borders::{BorderSide, BorderStyleCell, BorderStyleTimestamp, CellBorderLine},
    };

    use super::*;

    #[test]
    fn insert_row_start() {
        let mut sheet = Sheet::test();
        sheet.test_set_values(1, 1, 1, 3, vec!["A", "B", "C"]);
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
            pos![A2],
            BorderStyleCell {
                top: Some(BorderStyleTimestamp::default()),
                bottom: Some(BorderStyleTimestamp::default()),
                left: Some(BorderStyleTimestamp::default()),
                right: Some(BorderStyleTimestamp::default()),
            },
        );
        sheet.borders.set_style_cell(
            pos![A3],
            BorderStyleCell {
                top: Some(BorderStyleTimestamp::default()),
                bottom: Some(BorderStyleTimestamp::default()),
                left: Some(BorderStyleTimestamp::default()),
                right: Some(BorderStyleTimestamp::default()),
            },
        );
        sheet.test_set_code_run_array(4, 1, vec!["A", "B"], false);

        sheet.recalculate_bounds(&A1Context::default());

        let mut transaction = PendingTransaction::default();

        sheet.insert_row(
            &mut transaction,
            1,
            CopyFormats::None,
            &A1Context::default(),
        );

        assert_eq!(sheet.display_value(pos![A1]), None);
        assert_eq!(
            sheet.display_value(pos![A2]),
            Some(CellValue::Text("A".to_string()))
        );
        assert_eq!(
            sheet.display_value(pos![A3]),
            Some(CellValue::Text("B".to_string()))
        );
        assert_eq!(
            sheet.display_value(pos![A4]),
            Some(CellValue::Text("C".to_string()))
        );

        assert_eq!(sheet.borders.get_side(BorderSide::Top, pos![A1]), None);
        assert_eq!(
            sheet
                .borders
                .get_side(BorderSide::Top, pos![A2])
                .unwrap()
                .line,
            CellBorderLine::default()
        );
        assert_eq!(
            sheet.borders.get_style_cell(pos![A3]).top.unwrap().line,
            CellBorderLine::default()
        );
        assert_eq!(
            sheet.borders.get_style_cell(pos![A4]).top.unwrap().line,
            CellBorderLine::default()
        );
        assert_eq!(sheet.borders.get_side(BorderSide::Top, pos![E1]), None);

        assert!(sheet.data_tables.get(&pos![D1]).is_none());
        assert!(sheet.data_tables.get(&pos![D2]).is_some());

        assert_eq!(
            sheet.display_value(pos![D2]),
            Some(CellValue::Text("A".to_string()))
        );
    }

    #[test]
    fn insert_row_middle() {
        let mut sheet = Sheet::test();
        sheet.test_set_values(1, 1, 1, 3, vec!["A", "B", "C"]);

        let mut transaction = PendingTransaction::default();

        sheet.insert_row(
            &mut transaction,
            2,
            CopyFormats::None,
            &A1Context::default(),
        );

        assert_eq!(
            sheet.display_value(Pos { x: 1, y: 1 }),
            Some(CellValue::Text("A".to_string()))
        );
        assert_eq!(sheet.display_value(Pos { x: 1, y: 2 }), None);
        assert_eq!(
            sheet.display_value(Pos { x: 1, y: 3 }),
            Some(CellValue::Text("B".to_string()))
        );
        assert_eq!(
            sheet.display_value(Pos { x: 1, y: 4 }),
            Some(CellValue::Text("C".to_string()))
        );
    }

    #[test]
    fn insert_row_end() {
        let mut sheet = Sheet::test();
        sheet.test_set_values(1, 1, 1, 2, vec!["A", "B"]);

        let mut transaction = PendingTransaction::default();
        let context = A1Context::default();

        sheet.insert_row(&mut transaction, 3, CopyFormats::None, &context);

        assert_eq!(
            sheet.display_value(Pos { x: 1, y: 1 }),
            Some(CellValue::Text("A".to_string()))
        );
        assert_eq!(
            sheet.display_value(Pos { x: 1, y: 2 }),
            Some(CellValue::Text("B".to_string()))
        );
        assert_eq!(sheet.display_value(Pos { x: 1, y: 3 }), None);
    }

    #[test]
    fn insert_row_offset() {
        let mut sheet = Sheet::test();
        sheet.offsets.set_row_height(1, 100.0);
        sheet.offsets.set_row_height(2, 200.0);
        sheet.offsets.set_row_height(4, 400.0);

        let mut transaction = PendingTransaction::default();
        let context = A1Context::default();

        sheet.insert_row(&mut transaction, 2, CopyFormats::None, &context);
        assert_eq!(sheet.offsets.row_height(1), 100.0);
        assert_eq!(sheet.offsets.row_height(2), DEFAULT_ROW_HEIGHT);
        assert_eq!(sheet.offsets.row_height(3), 200.0);
        assert_eq!(sheet.offsets.row_height(5), 400.0);
    }
}
