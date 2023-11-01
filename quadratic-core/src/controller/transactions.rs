use core::panic;

use crate::{computation::TransactionInProgress, Pos};
use serde::{Deserialize, Serialize};

use super::{
    operation::Operation,
    transaction_summary::TransactionSummary,
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
            let mut summary = TransactionSummary::default();
            summary.transaction_busy = true;
            return summary;
        }
        let mut transaction =
            TransactionInProgress::new(self, operations, cursor, compute, transaction_type);
        let mut summary = transaction.transaction_summary();
        transaction.updated_bounds(self);

        // only trigger update to grid when computation cycle is complete
        // otherwise you end up redrawing too often
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

    pub fn transaction_summary(&mut self) -> Option<TransactionSummary> {
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
        let hash_width = 20_f64;
        let hash_height = 40_f64;
        let cell_hash_x = (pos.x as f64 / hash_width).floor() as i64;
        let cell_hash_y = (pos.y as f64 / hash_height).floor() as i64;
        let cell_hash = format!("{},{}", cell_hash_x, cell_hash_y);

        CellHash(cell_hash)
    }
}

#[cfg(test)]
mod tests {
    use crate::{grid::SheetId, Array, CellValue, Pos, Rect};

    use super::*;

    fn _add_cell_value(
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

    fn _add_cell_text(
        gc: &mut GridController,
        sheet_id: SheetId,
        pos: Pos,
        value: &str,
    ) -> Operation {
        _add_cell_value(gc, sheet_id, pos, CellValue::Text(value.into()))
    }
}
