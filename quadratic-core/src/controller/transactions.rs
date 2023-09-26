use crate::{grid::*, Pos, Rect};
use serde::{Deserialize, Serialize};

use super::{compute::SheetRect, operations::Operation, GridController};

impl GridController {
    /// Takes a Vec of initial Operations creates and runs a tractions, returning a transaction summary.
    /// This is the main entry point actions added to the undo/redo stack.
    /// Also runs computations for cells that need to be recomputed, and all of their dependencies.
    pub fn transact_forward(
        &mut self,
        operations: Vec<Operation>,
        cursor: Option<String>,
    ) -> TransactionSummary {
        // make initial changes
        let mut summary = TransactionSummary::default();
        let mut reverse_operations = self.transact(operations, &mut summary);

        // run computations
        // TODO cell_regions_modified also contains formatting updates, create new structure for just updated code and values
        let mut additional_operations = self.compute(
            summary
                .cell_regions_modified
                .iter()
                .map(|rect| SheetRect {
                    sheet_id: rect.0,
                    min: rect.1.min,
                    max: rect.1.max,
                })
                .collect(),
        );

        reverse_operations.append(&mut additional_operations);

        // update undo/redo stack
        self.redo_stack.clear();
        self.undo_stack.push(Transaction {
            ops: reverse_operations,
            cursor,
        });
        summary
    }

    pub fn has_undo(&self) -> bool {
        !self.undo_stack.is_empty()
    }
    pub fn has_redo(&self) -> bool {
        !self.redo_stack.is_empty()
    }
    pub fn undo(&mut self, cursor: Option<String>) -> Option<TransactionSummary> {
        if self.undo_stack.is_empty() {
            return None;
        }
        let transaction = self.undo_stack.pop()?;
        let cursor_old = transaction.cursor.clone();
        let mut summary = TransactionSummary::default();
        let reverse_operation = self.transact(transaction.ops, &mut summary);
        self.redo_stack.push(Transaction {
            ops: reverse_operation,
            cursor,
        });
        summary.cursor = cursor_old;
        Some(summary)
    }
    pub fn redo(&mut self, cursor: Option<String>) -> Option<TransactionSummary> {
        if self.redo_stack.is_empty() {
            return None;
        }
        let transaction = self.redo_stack.pop()?;
        let cursor_old = transaction.cursor.clone();
        let mut summary = TransactionSummary::default();
        let reverse_operations = self.transact(transaction.ops, &mut summary);
        self.undo_stack.push(Transaction {
            ops: reverse_operations,
            cursor,
        });
        summary.cursor = cursor_old;
        Some(summary)
    }

    /// executes a set of operations and returns the reverse operations
    /// TODO: remove this function and move code to transact_forward and execute_operation?
    fn transact(
        &mut self,
        operations: Vec<Operation>,
        summary: &mut TransactionSummary,
    ) -> Vec<Operation> {
        let mut reverse_operations = vec![];
        // TODO move bounds recalculation to somewhere else?
        let mut sheets_with_changed_bounds = vec![];

        for op in operations.iter() {
            if let Some(new_dirty_sheet) = op.sheet_with_changed_bounds() {
                if !sheets_with_changed_bounds.contains(&new_dirty_sheet) {
                    sheets_with_changed_bounds.push(new_dirty_sheet)
                }
            }
            let reverse_operation = self.execute_operation(op.clone(), summary);
            reverse_operations.push(reverse_operation);
        }
        for dirty_sheet in sheets_with_changed_bounds {
            self.grid
                .sheet_mut_from_id(dirty_sheet)
                .recalculate_bounds();
        }
        reverse_operations.reverse();
        reverse_operations
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

impl Operation {
    pub fn sheet_with_changed_bounds(&self) -> Option<SheetId> {
        match self {
            Operation::SetCellValues { region, .. } => Some(region.sheet),
            Operation::SetCellDependencies { .. } => None,
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
