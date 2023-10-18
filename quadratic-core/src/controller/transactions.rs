use core::panic;

use crate::{grid::SheetId, Pos};
use serde::{Deserialize, Serialize};

use super::{
    in_progress_transaction::InProgressTransaction,
    operation::Operation,
    transaction_summary::TransactionSummary,
    transaction_types::{CellsForArray, JsCodeResult, JsComputeGetCells},
    GridController,
};

pub enum TransactionType {
    Normal,
    Undo,
    Redo,
}

impl GridController {
    pub fn set_in_progress_transaction(
        &mut self,
        operations: Vec<Operation>,
        cursor: Option<String>,
        compute: bool,
        undo: TransactionType,
    ) -> TransactionSummary {
        if self
            .in_progress_transaction
            .as_ref()
            .is_some_and(|in_progress_transaction| !in_progress_transaction.complete)
        {
            // todo: this should be handled more gracefully. Perhaps as a queue of operations?
            panic!("Cannot start a transaction while a transaction is in progress");
        }
        let mut transaction = InProgressTransaction::new(self, operations, cursor, compute);
        let mut summary = transaction.transaction_summary();
        if transaction.complete {
            match undo {
                TransactionType::Normal => {
                    self.undo_stack.push(transaction.into());
                    self.redo_stack.clear();
                }
                TransactionType::Undo => {
                    self.redo_stack.push(transaction.into());
                }
                TransactionType::Redo => {
                    self.undo_stack.push(transaction.into());
                }
            }
            summary.save = true;
        } else {
            self.in_progress_transaction = Some(transaction);
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
            self.set_in_progress_transaction(transaction.ops, cursor, false, TransactionType::Undo)
        } else {
            TransactionSummary::default()
        }
    }
    pub fn redo(&mut self, cursor: Option<String>) -> TransactionSummary {
        if let Some(transaction) = self.redo_stack.pop() {
            self.set_in_progress_transaction(transaction.ops, cursor, false, TransactionType::Redo)
        } else {
            TransactionSummary::default()
        }
    }
    pub fn calculation_complete(&mut self, result: JsCodeResult) -> TransactionSummary {
        // todo: there's probably a better way to do this
        if let Some(transaction) = &mut self.in_progress_transaction.clone() {
            transaction.calculation_complete(self, result);
            self.in_progress_transaction = Some(transaction.to_owned());
            transaction.transaction_summary()
        } else {
            panic!("Expected an in progress transaction");
        }
    }

    /// This is used to get cells during a TS-controlled async calculation
    pub fn calculation_get_cells(&mut self, get_cells: JsComputeGetCells) -> Option<CellsForArray> {
        // todo: there's probably a better way to do this - the clone is necessary b/c get_cells needs a mutable grid as well
        if let Some(transaction) = &mut self.in_progress_transaction.clone() {
            let result = transaction.get_cells(self, get_cells);
            self.in_progress_transaction = Some(transaction.to_owned());
            result
        } else {
            panic!("Expected a transaction to still be running");
        }
    }
}

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct Transaction {
    pub ops: Vec<Operation>,
    pub cursor: Option<String>,
}

impl Operation {
    pub fn sheet_with_changed_bounds(&self) -> Option<SheetId> {
        match self {
            Operation::SetCellValues { region, .. } => Some(region.sheet),
            // Operation::SetCellDependencies { .. } => None,
            Operation::SetCellCode { cell_ref, .. } => Some(cell_ref.sheet),
            Operation::SetCellFormats { region, .. } => Some(region.sheet),
            Operation::AddSheet { .. } => None,
            Operation::DeleteSheet { .. } => None,
            Operation::SetSheetColor { .. } => None,
            Operation::SetSheetName { .. } => None,
            Operation::ReorderSheet { .. } => None,
            Operation::ResizeColumn { .. } => None,
            Operation::ResizeRow { .. } => None,
            Operation::None { .. } => None,
        }
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
    use crate::{Array, CellValue, Pos, Rect};

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
