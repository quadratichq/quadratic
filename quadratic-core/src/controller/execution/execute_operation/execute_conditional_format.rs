//! Execute operations for conditional formatting.

use crate::SheetRect;
use crate::controller::GridController;
use crate::controller::active_transactions::pending_transaction::PendingTransaction;
use crate::controller::operations::operation::Operation;

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

        // Check if any conditional format with a fill color might be affected
        // by this cell value change. For simplicity, we mark all conditional format
        // fills as potentially dirty since formulas can reference any cell.
        let fill_selections: Vec<_> = sheet
            .conditional_formats
            .iter()
            .filter(|cf| cf.style.fill_color.is_some())
            .map(|cf| cf.selection.clone())
            .collect();

        if !fill_selections.is_empty() {
            transaction.add_fill_cells_from_selections(sheet, self.a1_context(), fill_selections);
        }
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
            transaction.add_dirty_hashes_from_selections(
                sheet,
                self.a1_context(),
                vec![selection.clone()],
            );

            // Also mark fills as dirty if the conditional format has a fill color
            transaction.add_fill_cells_from_selections(sheet, self.a1_context(), vec![selection]);
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

        if let Some(reverse) = sheet.conditional_formats.remove(conditional_format_id) {
            if transaction.is_user_ai_undo_redo() {
                transaction.reverse_operations.push(reverse);

                transaction
                    .forward_operations
                    .push(Operation::RemoveConditionalFormat {
                        sheet_id,
                        conditional_format_id,
                    });
            }
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

                // Also mark fills as dirty
                transaction.add_fill_cells_from_selections(
                    sheet,
                    self.a1_context(),
                    vec![selection],
                );
            }
        }
    }
}
