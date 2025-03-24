use crate::{
    Pos,
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
    ) {
        self.data_tables.iter_mut().for_each(|(pos, dt)| {
            if (!dt.readonly || dt.is_html_or_image())
                && column >= pos.x
                && column <= pos.x + dt.width() as i64
            {
                if dt.is_html_or_image() {
                    // if html or image, then we need to change the width
                    if let Some((width, height)) = dt.chart_output {
                        dt.chart_output = Some((width + 1, height));
                        transaction
                            .reverse_operations
                            .push(Operation::SetChartCellSize {
                                sheet_pos: pos.to_sheet_pos(self.id),
                                w: width,
                                h: height,
                            });
                    }
                } else {
                    // the table overlaps the inserted column

                    let table_column = (column - pos.x) as u32;
                    let display_index = dt.get_column_index_from_display_index(table_column, true);

                    // add reverse ops for formats and borders, if necessary
                    // (note, formats and borders are 1-indexed)
                    if let Some(reverse_formats) = dt.formats.copy_column(table_column as i64 + 1) {
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
                    if let Some(reverse_borders) = dt.borders.copy_column(table_column as i64 + 1) {
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
        send_client: bool,
    ) {
        // update the indices of all data_tables impacted by the insertion
        let mut data_tables_to_move = Vec::new();
        for (pos, _) in self.data_tables.iter() {
            if pos.x >= column {
                data_tables_to_move.push(*pos);
            }
        }
        data_tables_to_move.sort_by(|a, b| b.x.cmp(&a.x));
        for old_pos in data_tables_to_move {
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
    }
}
