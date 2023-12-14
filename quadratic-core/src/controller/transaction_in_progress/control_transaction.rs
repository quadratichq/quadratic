use core::panic;
use std::collections::HashSet;

use crate::{
    controller::{
        operations::operation::Operation,
        transaction_summary::{TransactionSummary, CELL_SHEET_HEIGHT, CELL_SHEET_WIDTH},
        transaction_types::{CellsForArray, JsCodeResult, JsComputeGetCells},
    },
    Pos,
};
use indexmap::IndexSet;

use super::{GridController, TransactionType};

impl GridController {
    // loop compute cycle until complete or an async call is made
    pub(super) fn loop_compute(&mut self) {
        loop {
            self.compute();
            if self.waiting_for_async.is_some() {
                break;
            }
            if self.cells_to_compute.is_empty() {
                self.complete = true;
                self.transaction_in_progress = false;
                self.summary.save = true;
                if self.has_async {
                    self.finalize_transaction();
                }
                break;
            }
        }
    }

    /// executes a set of operations
    fn transact(&mut self, operations: Vec<Operation>, compute: bool) {
        for op in operations.iter() {
            if cfg!(feature = "show-operations") {
                crate::util::dbgjs(&format!("[Operation] {:?}", op.to_string()));
            }

            self.execute_operation(op.clone(), compute);
        }
    }

    /// Creates and runs a new Transaction
    ///
    /// Description
    /// * `compute` triggers the computation cycle
    fn start_transaction(
        &mut self,
        operations: Vec<Operation>,
        cursor: Option<String>,
        compute: bool,
        transaction_type: TransactionType,
    ) {
        if self.transaction_in_progress {
            panic!("Expected no transaction in progress");
        }
        self.transaction_in_progress = true;
        self.reverse_operations = vec![];
        self.cells_updated = IndexSet::new();
        self.cells_to_compute = IndexSet::new();
        self.cursor = cursor;
        self.cells_accessed = HashSet::new();
        self.summary = TransactionSummary::default();
        self.sheets_with_changed_bounds = HashSet::new();
        self.transaction_type = transaction_type;
        self.has_async = false;
        self.current_sheet_pos = None;
        self.waiting_for_async = None;
        self.complete = false;
        self.forward_operations = vec![];

        // apply operations
        self.transact(operations, compute);

        // run computations
        if compute {
            self.loop_compute();
        } else {
            self.complete = true;
            self.transaction_in_progress = false;
        }
    }

    pub(super) fn finalize_transaction(&mut self) {
        match self.transaction_type {
            TransactionType::Normal => {
                self.undo_stack.push(self.to_transaction());
                self.redo_stack.clear();
            }
            TransactionType::Undo => {
                self.redo_stack.push(self.to_transaction());
            }
            TransactionType::Redo => {
                self.undo_stack.push(self.to_transaction());
            }
            TransactionType::Multiplayer => (),
            TransactionType::Unset => panic!("Expected a transaction type"),
        }
    }

    pub fn set_in_progress_transaction(
        &mut self,
        operations: Vec<Operation>,
        cursor: Option<String>,
        compute: bool,
        transaction_type: TransactionType,
    ) -> TransactionSummary {
        assert!(
            !self.transaction_in_progress,
            "Expected no transaction in progress in set_in_progress_transaction"
        );
        self.start_transaction(operations, cursor, compute, transaction_type);
        let mut summary = self.prepare_transaction_summary();
        self.transaction_updated_bounds();

        if self.complete {
            summary.save = true;
            self.finalize_transaction();
        }
        summary
    }

    pub fn calculation_complete(&mut self, result: JsCodeResult) -> TransactionSummary {
        assert!(self.transaction_in_progress);
        let cancel_compute = result.cancel_compute.unwrap_or(false);

        if cancel_compute {
            self.clear_cells_to_compute();
            self.loop_compute();
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

    pub fn received_transaction(&mut self, transaction: String) -> TransactionSummary {
        let operations: Vec<Operation> = if let Ok(operations) = serde_json::from_str(&transaction)
        {
            operations
        } else {
            return TransactionSummary::default();
        };

        self.apply_received_transaction(operations)
    }

    pub fn apply_received_transaction(&mut self, operations: Vec<Operation>) -> TransactionSummary {
        self.start_transaction(operations, None, false, TransactionType::Multiplayer);
        self.transaction_updated_bounds();
        let mut summary = self.prepare_transaction_summary();
        summary.generate_thumbnail = false;
        summary.forward_operations = None;
        summary.save = false;
        summary
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

        // TransactionType::Normal
        gc.start_transaction(
            vec![operation.clone()],
            None,
            false,
            TransactionType::Normal,
        );
        gc.finalize_transaction();

        assert_eq!(gc.undo_stack.len(), 1);
        assert_eq!(gc.redo_stack.len(), 0);
        assert_eq!(vec![operation_undo.clone()], gc.undo_stack[0].operations);

        // TransactionType::Undo
        gc.start_transaction(vec![], None, false, TransactionType::Undo);
        gc.finalize_transaction();

        assert_eq!(gc.undo_stack.len(), 1);
        assert_eq!(gc.redo_stack.len(), 1);
        assert_eq!(vec![operation_undo.clone()], gc.undo_stack[0].operations);
        assert_eq!(gc.redo_stack[0].operations.len(), 0);

        // TransactionType::Redo
        gc.start_transaction(vec![], None, false, TransactionType::Redo);
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

        gc.set_in_progress_transaction(
            vec![operation.clone()],
            None,
            false,
            TransactionType::Normal,
        );
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

        gc.set_in_progress_transaction(vec![operation], None, true, TransactionType::Normal);
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
