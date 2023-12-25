use uuid::Uuid;

use super::{GridController, TransactionType};
use crate::{
    controller::{
        operations::operation::Operation,
        transaction_summary::{TransactionSummary, CELL_SHEET_HEIGHT, CELL_SHEET_WIDTH},
        transaction_types::{CellsForArray, JsCodeResult, JsComputeGetCells},
    },
    Pos,
};
use core::panic;
use std::collections::HashSet;

impl GridController {
    // loop compute cycle until complete or an async call is made
    pub(super) fn handle_transactions(&mut self, transaction_type: TransactionType) {
        loop {
            if self.operations.is_empty() {
                self.complete = true;
                if self.has_async {
                    self.finalize_transaction();
                }
                break;
            }

            let op = self.operations.remove(0);

            #[cfg(feature = "show-operations")]
            crate::util::dbgjs(&format!("[Operation] {:?}", &op));

            self.execute_operation(op, transaction_type.clone());

            if self.waiting_for_async.is_some() {
                break;
            }
        }
    }

    /// Creates and runs a new Transaction
    pub(super) fn start_transaction(
        &mut self,
        operations: Vec<Operation>,
        cursor: Option<String>,
        transaction_type: TransactionType,
    ) {
        self.transaction_in_progress = true;
        self.reverse_operations = vec![];
        self.cursor = cursor;
        self.cells_accessed = HashSet::new();
        self.operations = operations;
        self.transaction_type = transaction_type.clone();
        self.has_async = false;
        self.current_sheet_pos = None;
        self.waiting_for_async = None;
        self.complete = false;
        self.forward_operations = vec![];

        // rollback transaction combines these summaries
        if transaction_type != TransactionType::Rollback {
            self.clear_summary();
        }

        if matches!(transaction_type, TransactionType::User) {
            self.transaction_id = Uuid::new_v4();
        }

        self.handle_transactions(transaction_type);
    }

    /// Clears summary-type flags -- not called when rolling back changes for multiplayer on the grid
    pub(crate) fn clear_summary(&mut self) {
        self.summary = TransactionSummary::default();
        self.sheets_with_dirty_bounds = HashSet::new();
    }

    /// Finalizes the transaction and pushes it to the various stacks (if needed)
    pub(super) fn finalize_transaction(&mut self) {
        match self.transaction_type {
            TransactionType::User => {
                let undo = self.to_undo_transaction();
                self.undo_stack.push(undo.clone());
                self.redo_stack.clear();
                self.unsaved_transactions
                    .push((self.to_forward_transaction(), undo));
            }
            TransactionType::Undo => {
                let undo = self.to_undo_transaction();
                self.redo_stack.push(undo.clone());
                self.unsaved_transactions
                    .push((self.to_forward_transaction(), undo));
            }
            TransactionType::Redo => {
                let undo = self.to_undo_transaction();
                self.undo_stack.push(undo.clone());
                self.unsaved_transactions
                    .push((self.to_forward_transaction(), undo));
            }
            TransactionType::Multiplayer => (),
            TransactionType::Rollback => (),
            TransactionType::Unset => panic!("Expected a transaction type"),
        }
        self.transaction_in_progress = false;
    }

    pub fn start_user_transaction(
        &mut self,
        operations: Vec<Operation>,
        cursor: Option<String>,
    ) -> TransactionSummary {
        assert!(
            !self.transaction_in_progress,
            "Expected no transaction in progress in start_user_transaction"
        );
        self.start_transaction(operations, cursor, TransactionType::User);

        let mut summary = self.prepare_transaction_summary();
        self.transaction_updated_bounds();

        if self.complete {
            summary.save = true;
            self.finalize_transaction();
        }
        summary
    }

    pub fn undo_transaction(
        &mut self,
        operations: Vec<Operation>,
        cursor: Option<String>,
    ) -> TransactionSummary {
        // todo: clone transaction_in_progress here

        self.start_transaction(operations, cursor, TransactionType::Undo);
        let mut summary = self.prepare_transaction_summary();
        self.transaction_updated_bounds();
        summary.save = true;
        self.finalize_transaction();
        summary
    }

    pub fn redo_transaction(
        &mut self,
        operations: Vec<Operation>,
        cursor: Option<String>,
    ) -> TransactionSummary {
        // todo: clone transaction_in_progress here

        self.start_transaction(operations, cursor, TransactionType::Redo);
        let mut summary = self.prepare_transaction_summary();
        self.transaction_updated_bounds();
        summary.save = true;
        self.finalize_transaction();
        summary
    }

    pub fn calculation_complete(&mut self, result: JsCodeResult) -> TransactionSummary {
        assert!(self.transaction_in_progress);

        // todo: i'm not sure what this does
        let transaction_type = self.transaction_type.clone();
        if result.cancel_compute.unwrap_or(false) {
            // self.clear_cells_to_compute();
            self.handle_transactions(transaction_type);
        }

        self.after_calculation_async(result);

        self.transaction_updated_bounds();
        if self.complete {
            self.summary.save = true;
            self.finalize_transaction();
        }
        self.prepare_transaction_summary()
    }

    /// This is used to get cells during a TS-controlled async calculation
    pub fn calculation_get_cells(&mut self, get_cells: JsComputeGetCells) -> Option<CellsForArray> {
        assert!(self.transaction_in_progress);
        self.get_cells(get_cells)
    }
}

#[derive(Debug, PartialEq)]
pub struct CellHash(String);

impl CellHash {
    pub fn get(&self) -> String {
        self.0.clone()
    }
}

impl From<Pos> for CellHash {
    fn from(pos: Pos) -> Self {
        let hash_width = CELL_SHEET_WIDTH as f64;
        let hash_height = CELL_SHEET_HEIGHT as f64;
        let cell_hash_x = (pos.x as f64 / hash_width).floor() as i64;
        let cell_hash_y = (pos.y as f64 / hash_height).floor() as i64;
        let cell_hash = format!("{},{}", cell_hash_x, cell_hash_y);

        CellHash(cell_hash)
    }
}

#[cfg(test)]
mod tests {
    use crate::{grid::GridBounds, Array, CellValue, Pos, Rect, SheetPos, SheetRect};

    use super::*;

    fn add_cell_value(sheet_pos: SheetPos, value: CellValue) -> Operation {
        let sheet_rect = SheetRect::single_sheet_pos(sheet_pos);

        Operation::SetCellValues {
            sheet_rect,
            values: Array::from(value),
        }
    }

    fn get_operations(gc: &mut GridController) -> (Operation, Operation) {
        let sheet_id = gc.sheet_ids()[0];
        let sheet_pos = SheetPos::from((0, 0, sheet_id));
        let value = CellValue::Text("test".into());
        let operation = add_cell_value(sheet_pos, value);
        let operation_undo = add_cell_value(sheet_pos, CellValue::Blank);

        (operation, operation_undo)
    }

    #[test]
    fn test_transactions_finalize_transaction() {
        let mut gc = GridController::new();
        let (operation, operation_undo) = get_operations(&mut gc);

        // TransactionType::User
        gc.start_transaction(vec![operation.clone()], None, TransactionType::User);
        gc.finalize_transaction();

        assert_eq!(gc.undo_stack.len(), 1);
        assert_eq!(gc.redo_stack.len(), 0);
        assert_eq!(vec![operation_undo.clone()], gc.undo_stack[0].operations);

        // TransactionType::Undo
        gc.start_transaction(vec![], None, TransactionType::Undo);
        gc.finalize_transaction();

        assert_eq!(gc.undo_stack.len(), 1);
        assert_eq!(gc.redo_stack.len(), 1);
        assert_eq!(vec![operation_undo.clone()], gc.undo_stack[0].operations);
        assert_eq!(gc.redo_stack[0].operations.len(), 0);

        // TransactionType::Redo
        gc.start_transaction(vec![], None, TransactionType::Redo);
        gc.finalize_transaction();

        assert_eq!(gc.undo_stack.len(), 2);
        assert_eq!(gc.redo_stack.len(), 1);
        assert_eq!(vec![operation_undo.clone()], gc.undo_stack[0].operations);
        assert_eq!(gc.redo_stack[0].operations.len(), 0);
    }

    #[test]
    fn test_transactions_undo_redo() {
        let mut gc = GridController::new();
        let (operation, operation_undo) = get_operations(&mut gc);

        assert!(!gc.has_undo());
        assert!(!gc.has_redo());

        gc.start_user_transaction(vec![operation.clone()], None);
        assert!(gc.has_undo());
        assert!(!gc.has_redo());
        assert_eq!(vec![operation_undo.clone()], gc.undo_stack[0].operations);

        // undo
        gc.undo(None);
        assert!(!gc.has_undo());
        assert!(gc.has_redo());

        // redo
        gc.redo(None);
        assert!(gc.has_undo());
        assert!(!gc.has_redo());
    }

    #[test]
    fn test_transactions_transaction_summary() {
        let mut gc = GridController::new();
        assert_eq!(
            gc.prepare_transaction_summary(),
            TransactionSummary::default()
        );
    }

    #[test]
    fn test_transactions_updated_bounds_in_transaction() {
        let mut gc = GridController::new();
        let (operation, _) = get_operations(&mut gc);

        assert_eq!(gc.grid().sheets()[0].bounds(true), GridBounds::Empty);

        gc.start_user_transaction(vec![operation], None);
        gc.transaction_updated_bounds();

        let expected = GridBounds::NonEmpty(Rect::single_pos((0, 0).into()));
        assert_eq!(gc.grid().sheets()[0].bounds(true), expected);
    }

    #[test]
    fn test_transactions_cell_hash() {
        let hash = "test".to_string();
        let cell_hash = CellHash(hash.clone());
        assert_eq!(cell_hash.get(), hash);

        let pos = Pos::from((0, 0));
        let cell_hash = CellHash::from(pos);
        assert_eq!(cell_hash, CellHash("0,0".into()));
    }
}
