use crate::{
    CellValue, Pos, Rect, SheetPos, SheetRect,
    cell_values::CellValues,
    clear_option::ClearOption,
    controller::{
        GridController, active_transactions::pending_transaction::PendingTransaction,
        operations::operation::Operation,
    },
    grid::{Contiguous2D, formats::SheetFormatUpdates},
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
            for (x1, y1, x2, y2, _) in &rects_for_spill_check {
                if let (Some(x2), Some(y2)) = (x2, y2) {
                    let rect = Rect::new(*x1, *y1, *x2, *y2);
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

        // Track affected hash positions so the render worker only invalidates
        // the specific hashes that overlap with the merge change.
        let merge_hashes = transaction.merge_cells_updates.entry(sheet_id).or_default();
        for (x1, y1, x2, y2, _) in &rects_for_spill_check {
            if let (Some(x2), Some(y2)) = (x2, y2) {
                let rect = Rect::new(*x1, *y1, *x2, *y2);
                merge_hashes.extend(rect.to_hashes());
            }
        }

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
        for (x1, y1, x2, y2, _) in &rects_for_spill_check {
            if let (Some(x2), Some(y2)) = (x2, y2) {
                let rect = Rect::new(*x1, *y1, *x2, *y2);

                // Capture all cell values BEFORE deleting them (for undo)
                // and find cells with content
                let width = (rect.max.x - rect.min.x + 1) as u32;
                let height = (rect.max.y - rect.min.y + 1) as u32;
                let mut original_values = CellValues::new(width, height);
                let mut cells_with_content = Vec::new();

                for y in rect.y_range() {
                    for x in rect.x_range() {
                        let pos = Pos { x, y };
                        let rel_x = (x - rect.min.x) as u32;
                        let rel_y = (y - rect.min.y) as u32;

                        // Capture the original value (including blanks)
                        let value = sheet.display_value(pos).unwrap_or(CellValue::Blank);
                        original_values.set(rel_x, rel_y, value.clone());

                        // Track non-blank values for determining which value to keep
                        if value != CellValue::Blank {
                            cells_with_content.push((pos, value));
                        }
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

        // Consolidate formats: find the first format of each type in each merge rect and apply it to the entire rect
        let mut formats_to_restore = Vec::new();
        let mut formats_to_apply = SheetFormatUpdates::default();

        for (x1, y1, x2, y2, value) in &rects_for_spill_check {
            if let (Some(x2), Some(y2)) = (x2, y2) {
                let rect = Rect::new(*x1, *y1, *x2, *y2);

                // Only consolidate formats when merging (value is Some(...)), not when unmerging (value is Clear)
                let is_merging = matches!(value, ClearOption::Some(_));

                if is_merging {
                    // Capture original formats for undo
                    let original_formats =
                        SheetFormatUpdates::from_sheet_formatting_rect(rect, &sheet.formats, true);
                    if !original_formats.is_default() {
                        formats_to_restore.push(original_formats);
                    }

                    // Find the first format of each type in the range (row-major order: top to bottom, left to right)
                    // Helper macro to find first format and set it for the entire rect
                    macro_rules! find_and_set_first_format {
                        ($format_field:ident) => {
                            let mut first_value = None;
                            'outer: for y in rect.y_range() {
                                for x in rect.x_range() {
                                    let pos = Pos { x, y };
                                    if let Some(value) = sheet.formats.$format_field.get(pos) {
                                        first_value = Some(value);
                                        break 'outer;
                                    }
                                }
                            }
                            if let Some(value) = first_value {
                                let mut format_data = Contiguous2D::new();
                                format_data.set_rect(
                                    rect.min.x,
                                    rect.min.y,
                                    Some(rect.max.x),
                                    Some(rect.max.y),
                                    Some(ClearOption::Some(value)),
                                );
                                formats_to_apply.$format_field = Some(format_data);
                            }
                        };
                    }

                    find_and_set_first_format!(align);
                    find_and_set_first_format!(vertical_align);
                    find_and_set_first_format!(wrap);
                    find_and_set_first_format!(numeric_format);
                    find_and_set_first_format!(numeric_decimals);
                    find_and_set_first_format!(numeric_commas);
                    find_and_set_first_format!(bold);
                    find_and_set_first_format!(italic);
                    find_and_set_first_format!(text_color);
                    find_and_set_first_format!(fill_color);
                    find_and_set_first_format!(date_time);
                    find_and_set_first_format!(underline);
                    find_and_set_first_format!(strike_through);
                    find_and_set_first_format!(font_size);
                }
            }
        }

        // Apply the consolidated formats
        if !formats_to_apply.is_default() {
            let (reverse_ops, hashes, _rows, fill_bounds, has_meta_fills) =
                sheet.set_formats_a1(&formats_to_apply);

            // Add dirty hashes for re-rendering
            if cfg!(target_family = "wasm") || cfg!(test) {
                if !hashes.is_empty() {
                    let dirty_hashes = transaction.dirty_hashes.entry(sheet_id).or_default();
                    dirty_hashes.extend(hashes);
                }
                if let Some(fill_bounds) = fill_bounds {
                    transaction.add_fill_cells(sheet_id, fill_bounds);
                }
                if has_meta_fills {
                    transaction.add_sheet_meta_fills(sheet_id);
                }
            }

            // Store the format reverse operations for undo
            for op in reverse_ops {
                formats_to_restore.push(match op {
                    Operation::SetCellFormatsA1 { formats, .. } => formats,
                    _ => continue,
                });
            }
        }

        // Check validations for the affected merge cell rects
        // This ensures that:
        // - When merging: warnings are removed from non-anchor cells, only anchor retains warning
        // - When unmerging: warnings are rechecked for all cells that were part of the merge
        for (x1, y1, x2, y2, _) in &rects_for_spill_check {
            if let (Some(x2), Some(y2)) = (x2, y2) {
                let sheet_rect = SheetRect::new(*x1, *y1, *x2, *y2, sheet_id);
                self.check_validations(transaction, sheet_rect);
            }
        }

        // Add reverse operations in the correct order:
        // 1. First add SetCellFormatsA1 operations (to restore fills)
        // 2. Then add SetCellValues operations (to restore cell values)
        // 3. Then add SetMergeCells operation (to unmerge)
        // When reversed during undo, SetMergeCells will execute first (unmerge),
        // then SetCellValues will execute (restore values),
        // then SetCellFormatsA1 will execute (restore fills)
        for formats in formats_to_restore {
            transaction
                .reverse_operations
                .push(Operation::SetCellFormatsA1 { sheet_id, formats });
        }
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
    fn test_merge_cells_consolidates_fills() {
        let mut gc = GridController::test();
        let sheet_id = gc.sheet_ids()[0];

        // Set different fill colors on cells in a 2x2 grid
        // A1=red, B1=blue, A2=green, B2=yellow
        gc.set_fill_color(
            &A1Selection::test_a1_sheet_id("A1", sheet_id),
            Some("red".to_string()),
            None,
            false,
        )
        .unwrap();
        gc.set_fill_color(
            &A1Selection::test_a1_sheet_id("B1", sheet_id),
            Some("blue".to_string()),
            None,
            false,
        )
        .unwrap();
        gc.set_fill_color(
            &A1Selection::test_a1_sheet_id("A2", sheet_id),
            Some("green".to_string()),
            None,
            false,
        )
        .unwrap();
        gc.set_fill_color(
            &A1Selection::test_a1_sheet_id("B2", sheet_id),
            Some("yellow".to_string()),
            None,
            false,
        )
        .unwrap();

        // Verify initial fills
        assert_eq!(
            gc.sheet(sheet_id).formats.fill_color.get(pos![A1]),
            Some("red".to_string())
        );
        assert_eq!(
            gc.sheet(sheet_id).formats.fill_color.get(pos![B1]),
            Some("blue".to_string())
        );

        // Merge cells A1:B2
        let selection = A1Selection::test_a1_sheet_id("A1:B2", sheet_id);
        gc.merge_cells(selection, None, false);

        // All cells should now have the first fill (red from A1, which is top-left)
        let sheet = gc.sheet(sheet_id);
        assert_eq!(
            sheet.formats.fill_color.get(pos![A1]),
            Some("red".to_string()),
            "A1 should have red fill"
        );
        assert_eq!(
            sheet.formats.fill_color.get(pos![B1]),
            Some("red".to_string()),
            "B1 should have red fill (consolidated from A1)"
        );
        assert_eq!(
            sheet.formats.fill_color.get(pos![A2]),
            Some("red".to_string()),
            "A2 should have red fill (consolidated from A1)"
        );
        assert_eq!(
            sheet.formats.fill_color.get(pos![B2]),
            Some("red".to_string()),
            "B2 should have red fill (consolidated from A1)"
        );
    }

    #[test]
    fn test_merge_cells_fills_uses_first_fill_in_row_major_order() {
        let mut gc = GridController::test();
        let sheet_id = gc.sheet_ids()[0];

        // Only set fill on B2 (not top-left)
        gc.set_fill_color(
            &A1Selection::test_a1_sheet_id("B2", sheet_id),
            Some("blue".to_string()),
            None,
            false,
        )
        .unwrap();

        // Merge cells A1:B2
        let selection = A1Selection::test_a1_sheet_id("A1:B2", sheet_id);
        gc.merge_cells(selection, None, false);

        // All cells should have the first fill found (blue from B2)
        let sheet = gc.sheet(sheet_id);
        assert_eq!(
            sheet.formats.fill_color.get(pos![A1]),
            Some("blue".to_string()),
            "A1 should have blue fill"
        );
        assert_eq!(
            sheet.formats.fill_color.get(pos![B1]),
            Some("blue".to_string()),
            "B1 should have blue fill"
        );
        assert_eq!(
            sheet.formats.fill_color.get(pos![A2]),
            Some("blue".to_string()),
            "A2 should have blue fill"
        );
        assert_eq!(
            sheet.formats.fill_color.get(pos![B2]),
            Some("blue".to_string()),
            "B2 should have blue fill"
        );
    }

    #[test]
    fn test_merge_cells_undo_restores_fills() {
        let mut gc = GridController::test();
        let sheet_id = gc.sheet_ids()[0];

        // Set different fill colors on cells
        gc.set_fill_color(
            &A1Selection::test_a1_sheet_id("A1", sheet_id),
            Some("red".to_string()),
            None,
            false,
        )
        .unwrap();
        gc.set_fill_color(
            &A1Selection::test_a1_sheet_id("B1", sheet_id),
            Some("blue".to_string()),
            None,
            false,
        )
        .unwrap();

        // Merge cells A1:B2
        let selection = A1Selection::test_a1_sheet_id("A1:B2", sheet_id);
        gc.merge_cells(selection, None, false);

        // Verify all cells have the consolidated fill
        assert_eq!(
            gc.sheet(sheet_id).formats.fill_color.get(pos![B1]),
            Some("red".to_string())
        );

        // Undo the merge
        gc.undo(1, None, false);

        // Verify original fills are restored
        let sheet = gc.sheet(sheet_id);
        assert_eq!(
            sheet.formats.fill_color.get(pos![A1]),
            Some("red".to_string()),
            "A1 should have red fill restored"
        );
        assert_eq!(
            sheet.formats.fill_color.get(pos![B1]),
            Some("blue".to_string()),
            "B1 should have blue fill restored"
        );
        assert_eq!(
            sheet.formats.fill_color.get(pos![A2]),
            None,
            "A2 should have no fill restored"
        );
        assert_eq!(
            sheet.formats.fill_color.get(pos![B2]),
            None,
            "B2 should have no fill restored"
        );
    }

    #[test]
    fn test_merge_cells_no_fills() {
        let mut gc = GridController::test();
        let sheet_id = gc.sheet_ids()[0];

        // Set values but no fills
        gc.set_cell_value(
            SheetPos {
                x: 1,
                y: 1,
                sheet_id,
            },
            "test".to_string(),
            None,
            false,
        );

        // Merge cells A1:B2
        let selection = A1Selection::test_a1_sheet_id("A1:B2", sheet_id);
        gc.merge_cells(selection, None, false);

        // All cells should have no fill
        let sheet = gc.sheet(sheet_id);
        assert_eq!(sheet.formats.fill_color.get(pos![A1]), None);
        assert_eq!(sheet.formats.fill_color.get(pos![B1]), None);
        assert_eq!(sheet.formats.fill_color.get(pos![A2]), None);
        assert_eq!(sheet.formats.fill_color.get(pos![B2]), None);
    }

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

    #[test]
    fn test_merge_cells_consolidates_bold() {
        let mut gc = GridController::test();
        let sheet_id = gc.sheet_ids()[0];

        // Set bold on A1 only
        gc.set_bold(
            &A1Selection::test_a1_sheet_id("A1", sheet_id),
            Some(true),
            None,
            false,
        )
        .unwrap();

        // Verify initial state
        assert_eq!(gc.sheet(sheet_id).formats.bold.get(pos![A1]), Some(true));
        assert_eq!(gc.sheet(sheet_id).formats.bold.get(pos![B1]), None);

        // Merge cells A1:B2
        let selection = A1Selection::test_a1_sheet_id("A1:B2", sheet_id);
        gc.merge_cells(selection, None, false);

        // All cells should now have bold (from A1)
        let sheet = gc.sheet(sheet_id);
        assert_eq!(sheet.formats.bold.get(pos![A1]), Some(true), "A1 should be bold");
        assert_eq!(sheet.formats.bold.get(pos![B1]), Some(true), "B1 should be bold");
        assert_eq!(sheet.formats.bold.get(pos![A2]), Some(true), "A2 should be bold");
        assert_eq!(sheet.formats.bold.get(pos![B2]), Some(true), "B2 should be bold");

        // Undo the merge
        gc.undo(1, None, false);

        // Verify original state is restored
        let sheet = gc.sheet(sheet_id);
        assert_eq!(sheet.formats.bold.get(pos![A1]), Some(true), "A1 should still be bold");
        assert_eq!(sheet.formats.bold.get(pos![B1]), None, "B1 should not be bold");
        assert_eq!(sheet.formats.bold.get(pos![A2]), None, "A2 should not be bold");
        assert_eq!(sheet.formats.bold.get(pos![B2]), None, "B2 should not be bold");
    }

    #[test]
    fn test_merge_cells_consolidates_text_color() {
        let mut gc = GridController::test();
        let sheet_id = gc.sheet_ids()[0];

        // Set text_color on B1 only (not top-left)
        gc.set_text_color(
            &A1Selection::test_a1_sheet_id("B1", sheet_id),
            Some("blue".to_string()),
            None,
            false,
        )
        .unwrap();

        // Verify initial state
        assert_eq!(gc.sheet(sheet_id).formats.text_color.get(pos![A1]), None);
        assert_eq!(
            gc.sheet(sheet_id).formats.text_color.get(pos![B1]),
            Some("blue".to_string())
        );

        // Merge cells A1:B2
        let selection = A1Selection::test_a1_sheet_id("A1:B2", sheet_id);
        gc.merge_cells(selection, None, false);

        // All cells should now have blue text (first found in row-major order)
        let sheet = gc.sheet(sheet_id);
        assert_eq!(
            sheet.formats.text_color.get(pos![A1]),
            Some("blue".to_string()),
            "A1 should have blue text"
        );
        assert_eq!(
            sheet.formats.text_color.get(pos![B1]),
            Some("blue".to_string()),
            "B1 should have blue text"
        );
        assert_eq!(
            sheet.formats.text_color.get(pos![A2]),
            Some("blue".to_string()),
            "A2 should have blue text"
        );
        assert_eq!(
            sheet.formats.text_color.get(pos![B2]),
            Some("blue".to_string()),
            "B2 should have blue text"
        );
    }

    #[test]
    fn test_merge_cells_consolidates_multiple_formats() {
        let mut gc = GridController::test();
        let sheet_id = gc.sheet_ids()[0];

        // Set different formats on different cells
        // A1: bold, B1: italic, A2: fill_color
        gc.set_bold(
            &A1Selection::test_a1_sheet_id("A1", sheet_id),
            Some(true),
            None,
            false,
        )
        .unwrap();
        gc.set_italic(
            &A1Selection::test_a1_sheet_id("B1", sheet_id),
            Some(true),
            None,
            false,
        )
        .unwrap();
        gc.set_fill_color(
            &A1Selection::test_a1_sheet_id("A2", sheet_id),
            Some("green".to_string()),
            None,
            false,
        )
        .unwrap();

        // Merge cells A1:B2
        let selection = A1Selection::test_a1_sheet_id("A1:B2", sheet_id);
        gc.merge_cells(selection, None, false);

        // All cells should have all formats consolidated
        let sheet = gc.sheet(sheet_id);
        
        // Bold from A1 should be applied to all
        assert_eq!(sheet.formats.bold.get(pos![A1]), Some(true));
        assert_eq!(sheet.formats.bold.get(pos![B1]), Some(true));
        assert_eq!(sheet.formats.bold.get(pos![A2]), Some(true));
        assert_eq!(sheet.formats.bold.get(pos![B2]), Some(true));

        // Italic from B1 (first in row-major order) should be applied to all
        assert_eq!(sheet.formats.italic.get(pos![A1]), Some(true));
        assert_eq!(sheet.formats.italic.get(pos![B1]), Some(true));
        assert_eq!(sheet.formats.italic.get(pos![A2]), Some(true));
        assert_eq!(sheet.formats.italic.get(pos![B2]), Some(true));

        // Fill from A2 (first in row-major order) should be applied to all
        assert_eq!(sheet.formats.fill_color.get(pos![A1]), Some("green".to_string()));
        assert_eq!(sheet.formats.fill_color.get(pos![B1]), Some("green".to_string()));
        assert_eq!(sheet.formats.fill_color.get(pos![A2]), Some("green".to_string()));
        assert_eq!(sheet.formats.fill_color.get(pos![B2]), Some("green".to_string()));
    }

    #[test]
    fn test_merge_two_merged_cells_with_partial_selection() {
        use crate::a1::A1Context;

        let mut gc = GridController::test();
        let sheet_id = gc.sheet_ids()[0];

        // Create two merged cells: A1:B2 and C1:D2
        let selection1 = A1Selection::test_a1_sheet_id("A1:B2", sheet_id);
        gc.merge_cells(selection1, None, false);

        let selection2 = A1Selection::test_a1_sheet_id("C1:D2", sheet_id);
        gc.merge_cells(selection2, None, false);

        // Verify both merged cells exist
        let sheet = gc.sheet(sheet_id);
        assert!(sheet.merge_cells.is_merge_cell(Pos { x: 1, y: 1 })); // A1
        assert!(sheet.merge_cells.is_merge_cell(Pos { x: 2, y: 1 })); // B1
        assert!(sheet.merge_cells.is_merge_cell(Pos { x: 3, y: 1 })); // C1
        assert!(sheet.merge_cells.is_merge_cell(Pos { x: 4, y: 1 })); // D1

        // Simulate the user's scenario:
        // 1. Click on A1 (inside first merged cell)
        // 2. Shift+click on D1 (inside second merged cell, but NOT D2)
        // This should create a selection that includes both full merged cells

        // Create a selection starting at A1
        let mut selection = A1Selection::test_a1_sheet_id("A1", sheet_id);

        // Simulate shift+click at D1 (column 4, row 1) using select_to
        // This is what happens when the user shift+clicks
        let context = A1Context::default();
        selection.select_to(4, 1, false, &context, &sheet.merge_cells);

        // The selection should have expanded to include both full merged cells
        // It should be A1:D2 (not just A1:D1)
        let ranges = &selection.ranges;
        assert_eq!(ranges.len(), 1, "Should have exactly one range");

        if let crate::a1::CellRefRange::Sheet { range } = &ranges[0] {
            let rect = range.to_rect().expect("Should be a finite range");
            assert_eq!(
                rect.min,
                Pos { x: 1, y: 1 },
                "Selection should start at A1"
            );
            assert_eq!(
                rect.max,
                Pos { x: 4, y: 2 },
                "Selection should end at D2, including full extent of both merged cells. Got: {:?}",
                rect
            );
        } else {
            panic!("Expected a Sheet range");
        }
    }

    /// Test clicking inside a merged cell (not at anchor) and shift-clicking 
    /// inside another merged cell (not at bottom-right).
    /// This simulates: click on B2 (inside A1:B2), shift+click on D1 (inside C1:D2)
    #[test]
    fn test_merge_cells_selection_from_inside_merged_cells() {
        use crate::a1::A1Context;

        let mut gc = GridController::test();
        let sheet_id = gc.sheet_ids()[0];

        // Create two merged cells: A1:B2 and C1:D2
        let selection1 = A1Selection::test_a1_sheet_id("A1:B2", sheet_id);
        gc.merge_cells(selection1, None, false);

        let selection2 = A1Selection::test_a1_sheet_id("C1:D2", sheet_id);
        gc.merge_cells(selection2, None, false);

        // Verify both merged cells exist
        let sheet = gc.sheet(sheet_id);
        assert!(sheet.merge_cells.is_merge_cell(Pos { x: 1, y: 1 })); // A1
        assert!(sheet.merge_cells.is_merge_cell(Pos { x: 2, y: 2 })); // B2
        assert!(sheet.merge_cells.is_merge_cell(Pos { x: 3, y: 1 })); // C1
        assert!(sheet.merge_cells.is_merge_cell(Pos { x: 4, y: 1 })); // D1

        // Simulate clicking inside the first merged cell (B2) - not at anchor
        // This is what move_to does: places cursor at B2
        let mut selection = A1Selection::test_a1_sheet_id("B2", sheet_id);
        assert_eq!(selection.cursor, Pos { x: 2, y: 2 }, "Cursor should be at B2");

        // Now simulate shift+click at D1 (inside second merged cell, but NOT D2)
        let context = A1Context::default();
        selection.select_to(4, 1, false, &context, &sheet.merge_cells);

        // The selection should have expanded to include both FULL merged cells
        // Even though we clicked on B2 and D1, the selection should be A1:D2
        let ranges = &selection.ranges;
        assert_eq!(ranges.len(), 1, "Should have exactly one range");

        if let crate::a1::CellRefRange::Sheet { range } = &ranges[0] {
            let rect = range.to_rect().expect("Should be a finite range");
            // The selection should cover the full extent of both merged cells
            assert_eq!(
                rect.min,
                Pos { x: 1, y: 1 },
                "Selection should start at A1 (top-left of first merged cell). Got: {:?}",
                rect
            );
            assert_eq!(
                rect.max,
                Pos { x: 4, y: 2 },
                "Selection should end at D2 (bottom-right of second merged cell). Got: {:?}",
                rect
            );
        } else {
            panic!("Expected a Sheet range");
        }
    }

    /// Test that the merge operation itself expands to include overlapping merged cells.
    /// This tests the scenario where the selection was NOT expanded (e.g., created programmatically
    /// or through some code path that doesn't call select_to with merge cells).
    #[test]
    fn test_merge_operation_expands_for_overlapping_merged_cells() {
        let mut gc = GridController::test();
        let sheet_id = gc.sheet_ids()[0];

        // Create two merged cells: A1:B2 and C1:D2
        let selection1 = A1Selection::test_a1_sheet_id("A1:B2", sheet_id);
        gc.merge_cells(selection1, None, false);

        let selection2 = A1Selection::test_a1_sheet_id("C1:D2", sheet_id);
        gc.merge_cells(selection2, None, false);

        // Verify both merged cells exist and have correct anchors
        let sheet = gc.sheet(sheet_id);
        assert_eq!(sheet.merge_cells.get_anchor(Pos { x: 1, y: 1 }), Some(Pos { x: 1, y: 1 })); // A1 anchor
        assert_eq!(sheet.merge_cells.get_anchor(Pos { x: 2, y: 2 }), Some(Pos { x: 1, y: 1 })); // B2 -> A1
        assert_eq!(sheet.merge_cells.get_anchor(Pos { x: 3, y: 1 }), Some(Pos { x: 3, y: 1 })); // C1 anchor
        assert_eq!(sheet.merge_cells.get_anchor(Pos { x: 4, y: 2 }), Some(Pos { x: 3, y: 1 })); // D2 -> C1

        // Create a selection that only partially overlaps with both merged cells
        // This simulates a scenario where the selection was NOT expanded properly
        // (e.g., A1:D1 which only covers row 1 of both merged cells)
        let partial_selection = A1Selection::test_a1_sheet_id("A1:D1", sheet_id);
        
        // Call merge cells with this partial selection
        gc.merge_cells(partial_selection, None, false);

        // After merging, ALL cells in the resulting merge should have the SAME anchor (A1)
        // If the merge operation properly expanded to include the full merged cells,
        // then D2 should also have anchor A1, not C1
        let sheet = gc.sheet(sheet_id);

        // Verify ALL cells A1:D2 have the SAME anchor (A1)
        let expected_anchor = Pos { x: 1, y: 1 }; // A1
        for y in 1..=2 {
            for x in 1..=4 {
                let pos = Pos { x, y };
                let anchor = sheet.merge_cells.get_anchor(pos);
                assert_eq!(
                    anchor,
                    Some(expected_anchor),
                    "Cell at {:?} should have anchor A1 ({:?}), but has anchor {:?}",
                    pos,
                    expected_anchor,
                    anchor
                );
            }
        }

        // Also verify the merge rect from A1 covers the entire region
        let merge_rect = sheet.merge_cells.get_merge_cell_rect(Pos { x: 1, y: 1 });
        assert!(merge_rect.is_some(), "A1 should be part of a merged cell");
        let merge_rect = merge_rect.unwrap();
        assert_eq!(
            merge_rect,
            crate::Rect::new(1, 1, 4, 2),
            "Merge rect from A1 should be A1:D2"
        );
    }
}
