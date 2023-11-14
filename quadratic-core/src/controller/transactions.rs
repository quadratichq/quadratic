use core::panic;

use crate::{computation::TransactionInProgress, Pos};
use serde::{Deserialize, Serialize};

use super::{
    operation::Operation,
    transaction_summary::{TransactionSummary, CELL_SHEET_HEIGHT, CELL_SHEET_WIDTH},
    transaction_types::{CellsForArray, JsCodeResult, JsComputeGetCells},
    GridController,
};

#[derive(Default, Debug, Serialize, Deserialize, Clone)]
pub enum TransactionType {
    #[default]
    Normal,
    Undo,
    Redo,
}

impl GridController {
    pub fn finalize_transaction(&mut self, transaction_in_progress: &TransactionInProgress) {
        let transaction: Transaction = transaction_in_progress.into();
        match transaction_in_progress.transaction_type {
            TransactionType::Normal => {
                self.undo_stack.push(transaction);
                self.redo_stack.clear();
            }
            TransactionType::Undo => {
                self.redo_stack.push(transaction);
            }
            TransactionType::Redo => {
                self.undo_stack.push(transaction);
            }
        }
    }

    pub fn set_in_progress_transaction(
        &mut self,
        operations: Vec<Operation>,
        cursor: Option<String>,
        compute: bool,
        transaction_type: TransactionType,
    ) -> TransactionSummary {
        if self
            .transaction_in_progress
            .as_ref()
            .is_some_and(|in_progress_transaction| !in_progress_transaction.complete)
        {
            // todo: add this to a queue of operations instead of setting the busy flag
            return TransactionSummary::new(true);
        }
        let mut transaction =
            TransactionInProgress::new(self, operations, cursor, compute, transaction_type);
        let mut summary = transaction.transaction_summary();
        transaction.updated_bounds(self);

        if transaction.complete {
            summary.save = true;
            self.finalize_transaction(&transaction);
        } else {
            self.transaction_in_progress = Some(transaction);
        }
        summary
    }

    pub fn has_undo(&self) -> bool {
        !self.undo_stack.is_empty()
    }
    pub fn has_redo(&self) -> bool {
        !self.redo_stack.is_empty()
    }
    pub fn undo(&mut self, cursor: Option<String>) -> TransactionSummary {
        if let Some(transaction) = self.undo_stack.pop() {
            let mut summary = self.set_in_progress_transaction(
                transaction.ops,
                cursor,
                false,
                TransactionType::Undo,
            );
            summary.cursor = transaction.cursor;
            summary
        } else {
            TransactionSummary::default()
        }
    }
    pub fn redo(&mut self, cursor: Option<String>) -> TransactionSummary {
        if let Some(transaction) = self.redo_stack.pop() {
            let mut summary = self.set_in_progress_transaction(
                transaction.ops,
                cursor,
                false,
                TransactionType::Redo,
            );
            summary.cursor = transaction.cursor;
            summary
        } else {
            TransactionSummary::default()
        }
    }
    pub fn calculation_complete(&mut self, result: JsCodeResult) -> TransactionSummary {
        // todo: there's probably a better way to do this
        if let Some(transaction) = &mut self.transaction_in_progress.clone() {
            transaction.calculation_complete(self, result);
            self.transaction_in_progress = Some(transaction.to_owned());
            transaction.updated_bounds(self);
            if transaction.complete {
                transaction.transaction_summary()
            } else {
                TransactionSummary::default()
            }
        } else {
            panic!("Expected an in progress transaction");
        }
    }

    /// This is used to get cells during a TS-controlled async calculation
    pub fn calculation_get_cells(&mut self, get_cells: JsComputeGetCells) -> Option<CellsForArray> {
        // todo: there's probably a better way to do this - the clone is necessary b/c get_cells needs a mutable grid as well
        if let Some(transaction) = &mut self.transaction_in_progress.clone() {
            let result = transaction.get_cells(self, get_cells);
            self.transaction_in_progress = Some(transaction.to_owned());
            result
        } else {
            panic!("Expected a transaction to still be running");
        }
    }

    /// Creates a TransactionSummary and cleans
    /// Note: it may not pass cells_sheet_modified if the transaction is not complete (to avoid redrawing cells multiple times)
    pub fn transaction_summary(&mut self) -> Option<TransactionSummary> {
        // let skip_cell_rendering = self
        //     .transaction_in_progress
        //     .as_ref()
        //     .is_some_and(|transaction| !transaction.complete);
        self.transaction_in_progress
            .as_mut()
            .map(|transaction| transaction.transaction_summary())
    }

    pub fn updated_bounds_in_transaction(&mut self) {
        if let Some(transaction) = &mut self.transaction_in_progress.clone() {
            transaction.updated_bounds(self);
            self.transaction_in_progress = Some(transaction.to_owned());
        }
    }
}

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct Transaction {
    pub ops: Vec<Operation>,
    pub cursor: Option<String>,
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
    use crate::{
        grid::{GridBounds, SheetId},
        Array, CellValue, Pos, Rect,
    };

    use super::*;

    fn add_cell_value(
        gc: &mut GridController,
        sheet_id: SheetId,
        pos: Pos,
        value: CellValue,
    ) -> Operation {
        let rect = Rect::new_span(pos, pos);
        let region = gc.region(sheet_id, rect);

        Operation::SetCellValues {
            region,
            values: Array::from(value),
        }
    }

    fn get_operations(gc: &mut GridController) -> (Operation, Operation) {
        let sheet_id = gc.sheet_ids()[0];
        let pos = Pos::from((0, 0));
        let value = CellValue::Text("test".into());
        let operation = add_cell_value(gc, sheet_id, pos, value);
        let operation_undo = add_cell_value(gc, sheet_id, pos, CellValue::Blank);

        (operation, operation_undo)
    }

    #[test]
    fn test_transactions_finalize_transaction() {
        let mut gc = GridController::new();
        let (operation, operation_undo) = get_operations(&mut gc);

        // TransactionType::Normal
        let transaction_in_progress = TransactionInProgress::new(
            &mut gc,
            vec![operation.clone()],
            None,
            false,
            TransactionType::Normal,
        );
        gc.finalize_transaction(&transaction_in_progress);

        assert_eq!(gc.undo_stack.len(), 1);
        assert_eq!(gc.redo_stack.len(), 0);
        assert_eq!(vec![operation_undo.clone()], gc.undo_stack[0].ops);

        // TransactionType::Undo
        let transaction_in_progress =
            TransactionInProgress::new(&mut gc, vec![], None, false, TransactionType::Undo);
        gc.finalize_transaction(&transaction_in_progress);

        assert_eq!(gc.undo_stack.len(), 1);
        assert_eq!(gc.redo_stack.len(), 1);
        assert_eq!(vec![operation_undo.clone()], gc.undo_stack[0].ops);
        assert_eq!(gc.redo_stack[0].ops.len(), 0);

        // TransactionType::Redo
        let transaction_in_progress =
            TransactionInProgress::new(&mut gc, vec![], None, false, TransactionType::Redo);
        gc.finalize_transaction(&transaction_in_progress);

        assert_eq!(gc.undo_stack.len(), 2);
        assert_eq!(gc.redo_stack.len(), 1);
        assert_eq!(vec![operation_undo.clone()], gc.undo_stack[0].ops);
        assert_eq!(gc.redo_stack[0].ops.len(), 0);
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
        assert_eq!(vec![operation_undo.clone()], gc.undo_stack[0].ops);

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
        let summary = gc.transaction_summary();

        assert!(summary.is_none());
    }

    #[test]
    fn test_transactions_updated_bounds_in_transaction() {
        let mut gc = GridController::new();
        let (operation, _) = get_operations(&mut gc);

        assert_eq!(gc.grid().sheets()[0].bounds(true), GridBounds::Empty);

        gc.set_in_progress_transaction(vec![operation], None, true, TransactionType::Normal);
        gc.updated_bounds_in_transaction();

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
