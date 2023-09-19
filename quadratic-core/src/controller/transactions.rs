use crate::{grid::*, Pos, Rect};
use serde::{Deserialize, Serialize};

use super::{operations::Operation, GridController};

impl GridController {
    pub fn transact_forward(&mut self, transaction: Transaction) -> TransactionSummary {
        let (reverse_transaction, summary) = self.transact(transaction);
        self.redo_stack.clear();
        self.undo_stack.push(reverse_transaction);
        summary
    }
    pub fn has_undo(&self) -> bool {
        !self.undo_stack.is_empty()
    }
    pub fn has_redo(&self) -> bool {
        !self.redo_stack.is_empty()
    }
    pub fn undo(&mut self, cursor: Option<String>) -> Option<TransactionSummary> {
        let transaction = self.undo_stack.pop()?;
        let cursor_old = transaction.cursor.clone();
        let (mut reverse_transaction, mut summary) = self.transact(transaction);
        reverse_transaction.cursor = cursor;
        self.redo_stack.push(reverse_transaction);
        summary.cursor = cursor_old;
        Some(summary)
    }
    pub fn redo(&mut self, cursor: Option<String>) -> Option<TransactionSummary> {
        let transaction = self.redo_stack.pop()?;
        let cursor_old = transaction.cursor.clone();
        let (mut reverse_transaction, mut summary) = self.transact(transaction);
        reverse_transaction.cursor = cursor;
        self.undo_stack.push(reverse_transaction);
        summary.cursor = cursor_old;
        Some(summary)
    }

    // pub fn start_transaction(&mut self) -> TransactionInProgress {
    //     TransactionInProgress {
    //         grid_controller: self,
    //         summary: TransactionSummary::default(),
    //         rev_ops: vec![],
    //         is_committed: false,
    //     }
    // }

    pub fn transact(&mut self, transaction: Transaction) -> (Transaction, TransactionSummary) {
        let mut reverse_operations = vec![];
        let mut sheets_with_changed_bounds = vec![];
        let mut summary = TransactionSummary::default();
        for op in transaction.ops {
            if let Some(new_dirty_sheet) = op.sheet_with_changed_bounds() {
                if !sheets_with_changed_bounds.contains(&new_dirty_sheet) {
                    sheets_with_changed_bounds.push(new_dirty_sheet)
                }
            }
            let reverse_operation = self.execute_operation(op, &mut summary);
            reverse_operations.push(reverse_operation);
        }
        for dirty_sheet in sheets_with_changed_bounds {
            self.grid
                .sheet_mut_from_id(dirty_sheet)
                .recalculate_bounds();
        }
        reverse_operations.reverse();

        let reverse_transaction = Transaction {
            ops: reverse_operations,
            cursor: transaction.cursor,
        };

        (reverse_transaction, summary)
    }
}

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct Transaction {
    pub ops: Vec<Operation>,
    pub cursor: Option<String>,
}

#[derive(Serialize, Deserialize, Debug, Default, Clone, PartialEq, Eq)]
#[cfg_attr(feature = "js", derive(ts_rs::TS))]
pub struct TransactionSummary {
    /// Cell and text formatting regions modified.
    pub cell_regions_modified: Vec<(SheetId, Rect)>,
    /// Sheets where any fills have been modified.
    pub fill_sheets_modified: Vec<SheetId>,
    /// Sheets where any borders have been modified.
    pub border_sheets_modified: Vec<SheetId>,
    /// Locations of code cells that were modified. They may no longer exist.
    pub code_cells_modified: Vec<(SheetId, Pos)>,
    /// Sheet metadata or order was modified.
    pub sheet_list_modified: bool,
    /// Cursor location for undo/redo operation
    pub cursor: Option<String>,
}

// struct TransactionInProgress<'a> {
//     grid_controller: &'a mut GridController,
//     summary: TransactionSummary,
//     rev_ops: Vec<Operation>,
//     is_committed: bool,
// }

// impl Drop for TransactionInProgress<'_> {
//     fn drop(&mut self) {
//         if !self.is_committed {
//             panic!("Transaction was not committed");
//         }
//     }
// }

// impl TransactionInProgress {
//     pub fn add_operation(&mut self, op: Operation) {
//         let reverse_traction = self.execute_operation(op);
//         self.rev_ops.push(op);
//     }

//     /// Ends transaction and DOES NOT add to undo stack.
//     pub fn commit(&mut self) -> TransactionSummary {
//         self.is_committed = true;
//         self.summary
//     }

//     /// Ends transaction and adds to undo stack.
//     pub fn commit_forward(&mut self) -> TransactionSummary {
//         self.grid_controller.undo_stack.extend(self.rev_ops);
//         self.grid_controller.redo_stack.clear();
//         self.commit()
//     }
// }
