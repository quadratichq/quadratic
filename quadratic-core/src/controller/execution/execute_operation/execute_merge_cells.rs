use crate::{
    Rect,
    controller::{
        GridController, active_transactions::pending_transaction::PendingTransaction,
        operations::operation::Operation,
    },
};

impl GridController {
    pub fn execute_set_merge_cells(&mut self, transaction: &mut PendingTransaction, op: Operation) {
        unwrap_op!(let SetMergeCells { sheet_id, merge_cells_updates } = op);

        let Some(sheet) = self.grid.try_sheet_mut(sheet_id) else {
            return;
        };

        // find updates for client to re-render
        if cfg!(target_family = "wasm") || cfg!(test) {
            let rects = merge_cells_updates.to_rects().collect::<Vec<_>>();
            for (x1, y1, x2, y2, _) in rects {
                if let (Some(x2), Some(y2)) = (x2, y2) {
                    let rect = Rect::new(x1, y1, x2, y2);
                    transaction.add_dirty_hashes_from_sheet_rect(rect.to_sheet_rect(sheet_id));
                }
            }
        }

        transaction
            .forward_operations
            .push(Operation::SetMergeCells {
                sheet_id,
                merge_cells_updates: merge_cells_updates.clone(),
            });

        let merge_cells_updates_reverse = sheet
            .merge_cells
            .merge_cells_update(merge_cells_updates.clone());
        transaction
            .reverse_operations
            .push(Operation::SetMergeCells {
                sheet_id,
                merge_cells_updates: merge_cells_updates_reverse,
            });

        transaction.merge_cells_updates.insert(sheet_id);

        // Clear all cells except the one we want to keep after setting merge metadata
        let rects = merge_cells_updates.to_rects().collect::<Vec<_>>();
        for (x1, y1, x2, y2, _) in rects {
            if let (Some(x2), Some(y2)) = (x2, y2) {
                let rect = Rect::new(x1, y1, x2, y2);

                // Find all cells with content in the merge range
                let mut cells_with_content = Vec::new();
                for y in rect.y_range() {
                    for x in rect.x_range() {
                        let pos = crate::Pos { x, y };
                        if let Some(value) = sheet.display_value(pos) {
                            // Only consider non-blank values as content
                            if value != crate::CellValue::Blank {
                                cells_with_content.push((pos, value));
                            }
                        }
                    }
                }

                // Determine which cell value to keep
                let value_to_keep = if cells_with_content.is_empty() {
                    // No content, nothing to keep
                    None
                } else if cells_with_content.len() == 1 {
                    // Only one cell has content, use it regardless of position
                    Some(cells_with_content[0].1.clone())
                } else {
                    // Multiple cells have content, keep the one closest to top-left
                    // Sort by (y, x) to get the top-left-most cell
                    cells_with_content.sort_by_key(|(pos, _)| (pos.y, pos.x));
                    Some(cells_with_content[0].1.clone())
                };

                // Delete all values in the rect
                sheet.delete_values(rect);

                // Restore the chosen cell value to the top-left position
                if let Some(value) = value_to_keep {
                    let mut values = crate::cell_values::CellValues::new(1, 1);
                    values.set(0, 0, value);
                    sheet.merge_cell_values(rect.min, &values);
                }
            }
        }
    }
}
