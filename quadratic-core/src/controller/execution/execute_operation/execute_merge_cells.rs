use crate::{
    CellValue, Pos, Rect, SheetPos,
    cell_values::CellValues,
    controller::{
        GridController, active_transactions::pending_transaction::PendingTransaction,
        operations::operation::Operation,
    },
};

impl GridController {
    pub fn execute_set_merge_cells(&mut self, transaction: &mut PendingTransaction, op: Operation) {
        unwrap_op!(let SetMergeCells { sheet_id, merge_cells_updates } = op);

        // Collect rects for spill checking before we borrow sheet mutably
        let rects_for_spill_check = merge_cells_updates.to_rects().collect::<Vec<_>>();

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

        transaction.merge_cells_updates.insert(sheet_id);

        // Check if any cells within the merge range have borders set
        // Only signal border update if borders exist (since merging/unmerging affects border rendering)
        let has_borders_in_range = rects_for_spill_check.iter().any(|(x1, y1, x2, y2, _)| {
            if let (Some(x2), Some(y2)) = (x2, y2) {
                let rect = Rect::new(*x1, *y1, *x2, *y2);
                // Expand rect slightly to check borders on edges (borders are between cells)
                let expanded_rect = Rect::new(
                    rect.min.x.saturating_sub(1),
                    rect.min.y.saturating_sub(1),
                    rect.max.x.saturating_add(1),
                    rect.max.y.saturating_add(1),
                );
                sheet.borders.top.intersects(expanded_rect)
                    || sheet.borders.bottom.intersects(expanded_rect)
                    || sheet.borders.left.intersects(expanded_rect)
                    || sheet.borders.right.intersects(expanded_rect)
            } else {
                false
            }
        });

        if has_borders_in_range {
            transaction.add_borders(sheet_id);
        }

        // Check for spills after merge/unmerge operations
        // Find all data table positions whose output intersects with the merged/unmerged rects
        // and check spills for those data tables
        for (x1, y1, x2, y2, _) in &rects_for_spill_check {
            if let (Some(x2), Some(y2)) = (x2, y2) {
                let merged_rect = Rect::new(*x1, *y1, *x2, *y2);

                // Get all data table positions whose output intersects with the merged rect
                // Use ignore_spill_error: true to include tables that currently have spills
                let Some(sheet) = self.grid.try_sheet(sheet_id) else {
                    return;
                };
                let affected_positions: Vec<Pos> = sheet
                    .data_tables_pos_intersect_rect(merged_rect, true)
                    .collect();

                // Update spills for each affected data table
                // We check a rect around each data table position to capture its full output
                for pos in affected_positions {
                    let check_rect = Rect::single_pos(pos);
                    self.update_spills_in_sheet_rect(
                        transaction,
                        &check_rect.to_sheet_rect(sheet_id),
                    );
                }
            }
        }

        // Get sheet again for clearing cell values
        let Some(sheet) = self.grid.try_sheet_mut(sheet_id) else {
            return;
        };

        // Clear all cells except the one we want to keep after setting merge metadata
        // First, collect all cell values that will be restored on undo
        let mut cell_values_to_restore = Vec::new();
        let rects = merge_cells_updates.to_rects().collect::<Vec<_>>();
        for (x1, y1, x2, y2, _) in rects {
            if let (Some(x2), Some(y2)) = (x2, y2) {
                let rect = Rect::new(x1, y1, x2, y2);

                // Capture all cell values BEFORE deleting them (for undo)
                let width = (rect.max.x - rect.min.x + 1) as u32;
                let height = (rect.max.y - rect.min.y + 1) as u32;
                let mut original_values = CellValues::new(width, height);

                for y in rect.y_range() {
                    for x in rect.x_range() {
                        let pos = Pos { x, y };
                        let rel_x = (x - rect.min.x) as u32;
                        let rel_y = (y - rect.min.y) as u32;

                        // Capture the original value (including blanks)
                        let value = sheet.display_value(pos).unwrap_or(CellValue::Blank);
                        original_values.set(rel_x, rel_y, value);
                    }
                }

                // Store the reverse operation to restore cell values
                cell_values_to_restore.push(Operation::SetCellValues {
                    sheet_pos: SheetPos {
                        x: rect.min.x,
                        y: rect.min.y,
                        sheet_id,
                    },
                    values: original_values,
                });

                // Find all cells with content in the merge range
                let mut cells_with_content = Vec::new();
                for y in rect.y_range() {
                    for x in rect.x_range() {
                        let pos = Pos { x, y };
                        if let Some(value) = sheet.display_value(pos) {
                            // Only consider non-blank values as content
                            if value != CellValue::Blank {
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
                    let mut values = CellValues::new(1, 1);
                    values.set(0, 0, value);
                    sheet.merge_cell_values(rect.min, &values);
                }
            }
        }

        // Add reverse operations in the correct order:
        // 1. First add SetCellValues operations (to restore cell values)
        // 2. Then add SetMergeCells operation (to unmerge)
        // When reversed during undo, SetMergeCells will execute first (unmerge),
        // then SetCellValues will execute (restore values)
        for op in cell_values_to_restore {
            transaction.reverse_operations.push(op);
        }
        transaction
            .reverse_operations
            .push(Operation::SetMergeCells {
                sheet_id,
                merge_cells_updates: merge_cells_updates_reverse,
            });
    }
}

#[cfg(test)]
mod tests {
    use crate::{CellValue, Pos, SheetPos, a1::A1Selection, controller::GridController};

    #[test]
    fn test_merge_cells_undo_restores_all_values() {
        let mut gc = GridController::test();
        let sheet_id = gc.sheet_ids()[0];

        // Set up a 2x2 grid with different values
        // A1="1", B1="2", A2="3", B2="4"
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
        gc.set_cell_value(
            SheetPos {
                x: 2,
                y: 1,
                sheet_id,
            },
            "2".to_string(),
            None,
            false,
        );
        gc.set_cell_value(
            SheetPos {
                x: 1,
                y: 2,
                sheet_id,
            },
            "3".to_string(),
            None,
            false,
        );
        gc.set_cell_value(
            SheetPos {
                x: 2,
                y: 2,
                sheet_id,
            },
            "4".to_string(),
            None,
            false,
        );

        // Verify all values are set
        assert_eq!(
            gc.sheet(sheet_id).display_value(Pos { x: 1, y: 1 }),
            Some(CellValue::Number(1.into()))
        );
        assert_eq!(
            gc.sheet(sheet_id).display_value(Pos { x: 2, y: 1 }),
            Some(CellValue::Number(2.into()))
        );
        assert_eq!(
            gc.sheet(sheet_id).display_value(Pos { x: 1, y: 2 }),
            Some(CellValue::Number(3.into()))
        );
        assert_eq!(
            gc.sheet(sheet_id).display_value(Pos { x: 2, y: 2 }),
            Some(CellValue::Number(4.into()))
        );

        // Merge cells for A1:B2
        let selection = A1Selection::test_a1_sheet_id("A1:B2", sheet_id);
        gc.merge_cells(selection, None, false);

        // Verify that after merge, only the top-left value (A1="1") remains
        assert_eq!(
            gc.sheet(sheet_id).display_value(Pos { x: 1, y: 1 }),
            Some(CellValue::Number(1.into()))
        );
        assert_eq!(gc.sheet(sheet_id).display_value(Pos { x: 2, y: 1 }), None);
        assert_eq!(gc.sheet(sheet_id).display_value(Pos { x: 1, y: 2 }), None);
        assert_eq!(gc.sheet(sheet_id).display_value(Pos { x: 2, y: 2 }), None);

        // Verify that the cells are merged
        assert!(
            gc.sheet(sheet_id)
                .merge_cells
                .is_merge_cell(Pos { x: 1, y: 1 })
        );
        assert!(
            gc.sheet(sheet_id)
                .merge_cells
                .is_merge_cell(Pos { x: 2, y: 1 })
        );
        assert!(
            gc.sheet(sheet_id)
                .merge_cells
                .is_merge_cell(Pos { x: 1, y: 2 })
        );
        assert!(
            gc.sheet(sheet_id)
                .merge_cells
                .is_merge_cell(Pos { x: 2, y: 2 })
        );

        // Undo the merge
        gc.undo(1, None, false);

        // Verify that all original values are restored after undo
        assert_eq!(
            gc.sheet(sheet_id).display_value(Pos { x: 1, y: 1 }),
            Some(CellValue::Number(1.into()))
        );
        assert_eq!(
            gc.sheet(sheet_id).display_value(Pos { x: 2, y: 1 }),
            Some(CellValue::Number(2.into()))
        );
        assert_eq!(
            gc.sheet(sheet_id).display_value(Pos { x: 1, y: 2 }),
            Some(CellValue::Number(3.into()))
        );
        assert_eq!(
            gc.sheet(sheet_id).display_value(Pos { x: 2, y: 2 }),
            Some(CellValue::Number(4.into()))
        );

        // Verify that the cells are no longer merged
        assert!(
            !gc.sheet(sheet_id)
                .merge_cells
                .is_merge_cell(Pos { x: 1, y: 1 })
        );
        assert!(
            !gc.sheet(sheet_id)
                .merge_cells
                .is_merge_cell(Pos { x: 2, y: 1 })
        );
        assert!(
            !gc.sheet(sheet_id)
                .merge_cells
                .is_merge_cell(Pos { x: 1, y: 2 })
        );
        assert!(
            !gc.sheet(sheet_id)
                .merge_cells
                .is_merge_cell(Pos { x: 2, y: 2 })
        );
    }

    #[test]
    fn test_merge_cells_undo_with_blanks() {
        let mut gc = GridController::test();
        let sheet_id = gc.sheet_ids()[0];

        // Set up a 2x2 grid where only some cells have values
        // A1="1", B1=blank, A2=blank, B2="4"
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
        gc.set_cell_value(
            SheetPos {
                x: 2,
                y: 2,
                sheet_id,
            },
            "4".to_string(),
            None,
            false,
        );

        // Verify initial state
        assert_eq!(
            gc.sheet(sheet_id).display_value(Pos { x: 1, y: 1 }),
            Some(CellValue::Number(1.into()))
        );
        assert_eq!(gc.sheet(sheet_id).display_value(Pos { x: 2, y: 1 }), None);
        assert_eq!(gc.sheet(sheet_id).display_value(Pos { x: 1, y: 2 }), None);
        assert_eq!(
            gc.sheet(sheet_id).display_value(Pos { x: 2, y: 2 }),
            Some(CellValue::Number(4.into()))
        );

        // Merge cells for A1:B2
        let selection = A1Selection::test_a1_sheet_id("A1:B2", sheet_id);
        gc.merge_cells(selection, None, false);

        // After merge, only top-left value (A1="1") should remain
        assert_eq!(
            gc.sheet(sheet_id).display_value(Pos { x: 1, y: 1 }),
            Some(CellValue::Number(1.into()))
        );
        assert_eq!(gc.sheet(sheet_id).display_value(Pos { x: 2, y: 1 }), None);
        assert_eq!(gc.sheet(sheet_id).display_value(Pos { x: 1, y: 2 }), None);
        assert_eq!(gc.sheet(sheet_id).display_value(Pos { x: 2, y: 2 }), None);

        // Undo the merge
        gc.undo(1, None, false);

        // Verify that original state is restored (including blanks)
        assert_eq!(
            gc.sheet(sheet_id).display_value(Pos { x: 1, y: 1 }),
            Some(CellValue::Number(1.into()))
        );
        assert_eq!(gc.sheet(sheet_id).display_value(Pos { x: 2, y: 1 }), None);
        assert_eq!(gc.sheet(sheet_id).display_value(Pos { x: 1, y: 2 }), None);
        assert_eq!(
            gc.sheet(sheet_id).display_value(Pos { x: 2, y: 2 }),
            Some(CellValue::Number(4.into()))
        );
    }
}
