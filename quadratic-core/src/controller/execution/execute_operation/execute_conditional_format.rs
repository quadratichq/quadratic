//! Execute operations for conditional formatting.

use crate::SheetRect;
use crate::a1::{A1Context, A1Selection, CellRefRange};
use crate::controller::GridController;
use crate::controller::active_transactions::pending_transaction::PendingTransaction;
use crate::controller::operations::operation::Operation;
use crate::grid::{Sheet, SheetId};

impl GridController {
    /// Checks if cell value changes affect any conditional formats with fill colors.
    /// If so, marks the affected fills as dirty for re-rendering.
    pub(crate) fn check_conditional_format_fills(
        &self,
        transaction: &mut PendingTransaction,
        sheet_rect: SheetRect,
    ) {
        let Some(sheet) = self.try_sheet(sheet_rect.sheet_id) else {
            return;
        };

        // If no conditional formats, nothing to do
        if sheet.conditional_formats.is_empty() {
            return;
        }

        // Check if any conditional format with a fill (static fill_color or color scale)
        // might be affected by this cell value change. For simplicity, we mark all
        // conditional format fills as potentially dirty since formulas can reference any cell.
        let fill_selections: Vec<_> = sheet
            .conditional_formats
            .iter()
            .filter(|cf| cf.has_fill())
            .map(|cf| cf.selection.clone())
            .collect();

        if !fill_selections.is_empty() {
            Self::add_fill_cells_for_cf_selections(
                transaction,
                sheet,
                self.a1_context(),
                &fill_selections,
            );
        }
    }

    /// Adds fill cells for conditional format selections, handling infinite selections
    /// (column ranges, row ranges, and all) properly by marking appropriate hashes as dirty.
    fn add_fill_cells_for_cf_selections(
        transaction: &mut PendingTransaction,
        sheet: &Sheet,
        a1_context: &A1Context,
        selections: &[A1Selection],
    ) {
        use crate::grid::GridBounds;
        use crate::Rect;

        // Get sheet bounds for determining range limits
        let bounds = sheet.bounds(false);

        for selection in selections {
            // Check for infinite selections that need special handling
            for range in &selection.ranges {
                if let CellRefRange::Sheet { range } = range {
                    let (x1, y1, x2, y2) = range.to_contiguous2d_coords();
                    match (x2, y2) {
                        // All selected - mark all fill cells within bounds
                        (None, None) => {
                            if let GridBounds::NonEmpty(bounds_rect) = bounds {
                                transaction.add_fill_cells(sheet.id, bounds_rect);
                            }
                        }
                        // Row range (unbounded columns) - mark fill cells for these rows
                        (None, Some(y2_val)) => {
                            if let GridBounds::NonEmpty(bounds_rect) = bounds {
                                let rect = Rect::new(
                                    bounds_rect.min.x,
                                    y1,
                                    bounds_rect.max.x,
                                    y2_val,
                                );
                                transaction.add_fill_cells(sheet.id, rect);
                            }
                        }
                        // Column range (unbounded rows) - mark fill cells for these columns
                        (Some(x2_val), None) => {
                            if let GridBounds::NonEmpty(bounds_rect) = bounds {
                                let rect = Rect::new(
                                    x1,
                                    bounds_rect.min.y,
                                    x2_val,
                                    bounds_rect.max.y,
                                );
                                transaction.add_fill_cells(sheet.id, rect);
                            }
                        }
                        // Finite selection - handled by add_fill_cells_from_selections
                        (Some(_), Some(_)) => {}
                    }
                }
            }
        }

        // Also add the finite fill cells using the existing method
        transaction.add_fill_cells_from_selections(sheet, a1_context, selections.to_vec());
    }

    /// Marks fill cells dirty for a conditional format selection on a specific sheet.
    fn mark_cf_fills_dirty(
        &self,
        transaction: &mut PendingTransaction,
        sheet_id: SheetId,
        selection: &A1Selection,
    ) {
        let Some(sheet) = self.try_sheet(sheet_id) else {
            return;
        };

        Self::add_fill_cells_for_cf_selections(
            transaction,
            sheet,
            self.a1_context(),
            std::slice::from_ref(selection),
        );
    }

    pub(crate) fn execute_set_conditional_format(
        &mut self,
        transaction: &mut PendingTransaction,
        op: Operation,
    ) {
        let Operation::SetConditionalFormat { conditional_format } = op else {
            unreachable!("expected SetConditionalFormat");
        };

        let sheet_id = conditional_format.selection.sheet_id;
        let selection = conditional_format.selection.clone();

        let Some(sheet) = self.grid.try_sheet_mut(sheet_id) else {
            return;
        };

        let reverse = sheet
            .conditional_formats
            .set(conditional_format.clone(), sheet_id);

        // Extract old selection if this was an update (not a new format)
        let old_selection = if let Operation::SetConditionalFormat {
            conditional_format: ref old_format,
        } = reverse
        {
            Some(old_format.selection.clone())
        } else {
            None
        };

        if transaction.is_user_ai_undo_redo() {
            transaction.reverse_operations.push(reverse);

            transaction
                .forward_operations
                .push(Operation::SetConditionalFormat { conditional_format });
        }

        transaction.conditional_formats.insert(sheet_id);

        if transaction.is_server() {
            return;
        }

        self.send_updated_bounds(transaction, sheet_id);

        // Mark cells in the selection as dirty so they get re-rendered
        if let Some(sheet) = self.try_sheet(sheet_id) {
            let mut selections_to_mark = vec![selection.clone()];
            if let Some(ref old_sel) = old_selection {
                selections_to_mark.push(old_sel.clone());
            }
            transaction.add_dirty_hashes_from_selections(
                sheet,
                self.a1_context(),
                selections_to_mark,
            );
        }

        // Mark fills as dirty for the new selection, handling infinite selections properly
        self.mark_cf_fills_dirty(transaction, sheet_id, &selection);

        // Also mark fills dirty for the old selection if this was an update
        if let Some(old_sel) = old_selection {
            self.mark_cf_fills_dirty(transaction, sheet_id, &old_sel);
        }
    }

    pub(crate) fn execute_remove_conditional_format(
        &mut self,
        transaction: &mut PendingTransaction,
        op: Operation,
    ) {
        let Operation::RemoveConditionalFormat {
            sheet_id,
            conditional_format_id,
        } = op
        else {
            unreachable!("expected RemoveConditionalFormat");
        };

        let Some(sheet) = self.grid.try_sheet_mut(sheet_id) else {
            return;
        };

        // Get the selection before removing so we can mark dirty hashes
        let selection = sheet
            .conditional_formats
            .get(conditional_format_id)
            .map(|cf| cf.selection.clone());

        if let Some(reverse) = sheet.conditional_formats.remove(conditional_format_id)
            && transaction.is_user_ai_undo_redo()
        {
            transaction.reverse_operations.push(reverse);

            transaction
                .forward_operations
                .push(Operation::RemoveConditionalFormat {
                    sheet_id,
                    conditional_format_id,
                });
        }

        transaction.conditional_formats.insert(sheet_id);

        if transaction.is_server() {
            return;
        }

        self.send_updated_bounds(transaction, sheet_id);

        // Mark cells in the selection as dirty so they get re-rendered
        if let Some(selection) = selection {
            if let Some(sheet) = self.try_sheet(sheet_id) {
                transaction.add_dirty_hashes_from_selections(
                    sheet,
                    self.a1_context(),
                    vec![selection.clone()],
                );
            }

            // Mark fills as dirty, handling infinite selections properly
            self.mark_cf_fills_dirty(transaction, sheet_id, &selection);
        }
    }
}
