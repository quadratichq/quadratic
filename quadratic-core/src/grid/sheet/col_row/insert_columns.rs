use crate::{
    CopyFormats, Pos,
    controller::{
        active_transactions::pending_transaction::PendingTransaction,
        operations::operation::Operation,
    },
    grid::Sheet,
};

impl Sheet {
    pub(crate) fn insert_column(
        &mut self,
        transaction: &mut PendingTransaction,
        column: i64,
        copy_formats: CopyFormats,
        send_client: bool,
    ) {
        // mark hashes of existing columns dirty
        if send_client {
            transaction.add_dirty_hashes_from_sheet_columns(self, column, None);
        }

        // update the indices of all columns impacted by the insertion
        let mut columns_to_update = Vec::new();
        for col in self.columns.keys() {
            if *col >= column {
                columns_to_update.push(*col);
            }
        }
        columns_to_update.sort_by(|a, b| b.cmp(a));
        for col in columns_to_update {
            if let Some(mut column_data) = self.columns.remove(&col) {
                column_data.x += 1;
                self.columns.insert(col + 1, column_data);
            }
        }

        // update the indices of all code_runs impacted by the insertion
        let mut code_runs_to_move = Vec::new();
        for (pos, _) in self.data_tables.iter() {
            if pos.x >= column {
                code_runs_to_move.push(*pos);
            }
        }
        code_runs_to_move.sort_by(|a, b| b.x.cmp(&a.x));
        for old_pos in code_runs_to_move {
            let new_pos = Pos {
                x: old_pos.x + 1,
                y: old_pos.y,
            };
            if let Some(code_run) = self.data_tables.shift_remove(&old_pos) {
                // signal html and image cells to update
                if send_client {
                    if code_run.is_html() {
                        transaction.add_html_cell(self.id, old_pos);
                        transaction.add_html_cell(self.id, new_pos);
                    } else if code_run.is_image() {
                        transaction.add_image_cell(self.id, old_pos);
                        transaction.add_image_cell(self.id, new_pos);
                    }
                }

                self.data_tables.insert_sorted(new_pos, code_run);

                // signal the client to updates to the code cells (to draw the code arrays)
                transaction.add_code_cell(self.id, old_pos);
                transaction.add_code_cell(self.id, new_pos);
            }
        }

        // update formatting
        self.formats.insert_column(column, copy_formats);
        if send_client {
            transaction.add_fill_cells(self.id);
        }

        // signal client ot update the borders for changed columns
        self.borders.insert_column(column, copy_formats);
        if send_client {
            transaction.sheet_borders.insert(self.id);
        }

        // mark hashes of new columns dirty
        if send_client {
            transaction.add_dirty_hashes_from_sheet_columns(self, column, None);
        }

        let changed_selections =
            self.validations
                .insert_column(transaction, self.id, column, &self.a1_context());
        if send_client {
            transaction.add_dirty_hashes_from_selections(
                self,
                &self.a1_context(),
                changed_selections,
            );
        }

        let changes = self.offsets.insert_column(column);
        if send_client && !changes.is_empty() {
            changes.iter().for_each(|(index, size)| {
                transaction.offsets_modified(self.id, Some(*index), None, Some(*size));
            });
        }

        // create undo operations for the inserted column
        if transaction.is_user_undo_redo() {
            // reverse operation to delete the column (this will also shift all impacted columns)
            transaction
                .reverse_operations
                .push(Operation::DeleteColumn {
                    sheet_id: self.id,
                    column,
                });
        }
    }
}

#[cfg(test)]
mod tests {
    use crate::{
        CellValue, DEFAULT_COLUMN_WIDTH,
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

        sheet.insert_column(&mut transaction, 1, CopyFormats::None, true);

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

        sheet.insert_column(&mut transaction, 2, CopyFormats::None, true);

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

        sheet.insert_column(&mut transaction, 3, CopyFormats::None, true);

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
        sheet.insert_column(&mut transaction, 2, CopyFormats::None, true);
        assert_eq!(sheet.offsets.column_width(1), 100.0);
        assert_eq!(sheet.offsets.column_width(2), DEFAULT_COLUMN_WIDTH);
        assert_eq!(sheet.offsets.column_width(3), 200.0);
        assert_eq!(sheet.offsets.column_width(5), 400.0);
    }
}
