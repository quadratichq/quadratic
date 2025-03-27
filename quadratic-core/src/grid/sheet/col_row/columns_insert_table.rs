use crate::{
    CopyFormats, Pos,
    controller::{
        active_transactions::pending_transaction::PendingTransaction,
        operations::operation::Operation,
    },
    grid::Sheet,
};

impl Sheet {
    /// Insert columns in data tables that overlap the inserted column.
    pub(crate) fn check_insert_tables_columns(
        &mut self,
        transaction: &mut PendingTransaction,
        column: i64,
        copy_formats: CopyFormats,
    ) {
        let column_to_insert = if copy_formats == CopyFormats::After {
            column + 1
        } else {
            column
        };
        self.data_tables.iter_mut().for_each(|(pos, dt)| {
            if (!dt.readonly || dt.is_html_or_image())
                && column_to_insert >= pos.x
                && column_to_insert <= pos.x + dt.width() as i64
            {
                if dt.is_html_or_image() {
                    // if html or image, then we need to change the width
                    if let Some((width, height)) = dt.chart_output {
                        dt.chart_output = Some((width + 1, height));
                        transaction.add_from_code_run(self.id, *pos, dt.is_image(), dt.is_html());
                        transaction
                            .reverse_operations
                            .push(Operation::SetChartCellSize {
                                sheet_pos: pos.to_sheet_pos(self.id),
                                w: width,
                                h: height,
                            });
                    }
                } else {
                    let column = column_to_insert - pos.x;
                    // the table overlaps the inserted column
                    let display_index = dt.get_column_index_from_display_index(column as u32, true);

                    // add reverse ops for formats and borders, if necessary
                    // (note, formats and borders are 1-indexed)
                    if let Some(reverse_formats) = dt.formats.copy_column(column as i64) {
                        if !reverse_formats.is_default() {
                            if reverse_formats.has_fills() {
                                transaction.add_fill_cells(self.id);
                            }
                            transaction
                                .reverse_operations
                                .push(Operation::DataTableFormats {
                                    sheet_pos: pos.to_sheet_pos(self.id),
                                    formats: reverse_formats,
                                });
                        }
                    }
                    if let Some(reverse_borders) = dt.borders.copy_column(column) {
                        if !reverse_borders.is_empty() {
                            transaction.add_borders(self.id);
                            transaction
                                .reverse_operations
                                .push(Operation::DataTableBorders {
                                    sheet_pos: pos.to_sheet_pos(self.id),
                                    borders: reverse_borders,
                                });
                        }
                    }
                    if dt.insert_column(display_index as usize, None, None).is_ok() {
                        transaction.add_code_cell(self.id, *pos);
                    }
                }
            }
        });
    }

    /// Adjust data tables that overlap the inserted column.
    pub(crate) fn adjust_insert_tables_columns(
        &mut self,
        transaction: &mut PendingTransaction,
        column: i64,
        copy_formats: CopyFormats,
        send_client: bool,
    ) {
        let column_to_insert = if copy_formats == CopyFormats::After {
            column + 1
        } else {
            column
        };
        // update the indices of all data_tables impacted by the insertion
        let mut data_tables_to_move_right = Vec::new();
        let mut anchor_cells_to_move_left = Vec::new();
        for (pos, _) in self.data_tables.iter() {
            if pos.x > column_to_insert {
                data_tables_to_move_right.push(*pos);
            } else if copy_formats == CopyFormats::Before && pos.x == column_to_insert {
                anchor_cells_to_move_left.push(*pos);
            }
        }
        data_tables_to_move_right.sort_by(|a, b| b.x.cmp(&a.x));
        for old_pos in data_tables_to_move_right {
            let new_pos = Pos {
                x: old_pos.x,
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

        // move anchor cells (CellValue::Import) that were moved right by the
        // insertion back one cell (this is an edge case for inserting a column
        // to the left in the first column of a table)
        for pos in anchor_cells_to_move_left {
            self.move_cell_value(
                Pos {
                    x: pos.x + 1,
                    y: pos.y,
                },
                Pos { x: pos.x, y: pos.y },
            );
        }
    }
}

#[cfg(test)]
mod tests {
    use crate::{
        controller::GridController,
        test_util::{
            assert_data_table_size, assert_display_cell_value, first_sheet_id,
            test_create_data_table,
        },
    };

    #[test]
    fn test_insert_column_front_table() {
        let mut gc = GridController::test();
        let sheet_id = first_sheet_id(&gc);

        test_create_data_table(&mut gc, sheet_id, pos![B2], 3, 3);

        gc.insert_column(sheet_id, 2, true, None);
        assert_data_table_size(&gc, sheet_id, pos![B2], 4, 3, false);
        assert_display_cell_value(&gc, sheet_id, 2, 4, "0");
        assert_display_cell_value(&gc, sheet_id, 3, 4, "");

        gc.insert_column(sheet_id, 2, false, None);
        assert_data_table_size(&gc, sheet_id, pos![B2], 5, 3, false);

        gc.undo(None);
        assert_data_table_size(&gc, sheet_id, pos![B2], 4, 3, false);

        gc.undo(None);
        assert_data_table_size(&gc, sheet_id, pos![B2], 3, 3, false);
    }

    #[test]
    fn test_insert_delete_chart_columns() {
        let mut gc = GridController::test();
        let sheet_id = first_sheet_id(&gc);

        test_create_data_table(&mut gc, sheet_id, pos![A1], 3, 3);
        test_create_data_table(&mut gc, sheet_id, pos![B5], 3, 3);

        gc.insert_column(sheet_id, 3, true, None);

        let sheet = gc.sheet(sheet_id);
        assert_eq!(
            sheet.data_table(pos![A1]).unwrap().chart_output.unwrap(),
            (4, 3)
        );
        assert_eq!(
            sheet.data_table(pos![B5]).unwrap().chart_output.unwrap(),
            (4, 3)
        );

        gc.undo(None);

        let sheet = gc.sheet(sheet_id);
        let dt = sheet.data_table(pos![A1]).unwrap();
        assert_eq!(dt.chart_output.unwrap(), (3, 3));
        let dt_2 = sheet.data_table(pos![B5]).unwrap();
        assert_eq!(dt_2.chart_output.unwrap(), (3, 3));

        gc.insert_row(sheet_id, 3, true, None);

        let sheet = gc.sheet(sheet_id);
        let dt = sheet.data_table(pos![A1]).unwrap();
        assert_eq!(dt.chart_output.unwrap(), (3, 4));
        let dt_2 = sheet.data_table(pos![B6]).unwrap();
        assert_eq!(dt_2.chart_output.unwrap(), (3, 3));

        gc.undo(None);
        let sheet = gc.sheet(sheet_id);
        let dt = sheet.data_table(pos![A1]).unwrap();
        assert_eq!(dt.chart_output.unwrap(), (3, 3));

        let dt_2 = sheet.data_table(pos![B5]).unwrap();
        assert_eq!(dt_2.chart_output.unwrap(), (3, 3));
    }
}
