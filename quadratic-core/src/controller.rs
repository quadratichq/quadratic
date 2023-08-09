use serde::{Deserialize, Serialize};

use crate::{
    grid::{CellRef, Grid},
    CellValue,
};

pub struct GridController {
    grid: Grid,
    undo_stack: Vec<Transaction>,
    redo_stack: Vec<Transaction>,
}
impl GridController {
    pub fn new() -> Self {
        Self::from_grid(Grid::new())
    }
    pub fn from_grid(grid: Grid) -> Self {
        GridController {
            grid,
            undo_stack: vec![],
            redo_stack: vec![],
        }
    }

    pub fn set_cell(&mut self, pos: CellRef, value: CellValue) {
        let transaction = Transaction {
            ops: vec![Operation::SetCell { pos, value }],
        };
        let rev_transaction = self.transact(transaction);
    }

    fn transact_forward(&mut self, transaction: Transaction) {
        let reverse_transaction = self.transact(transaction);
        self.redo_stack.clear();
        self.undo_stack.push(reverse_transaction);
    }
    pub fn undo(&mut self) -> bool {
        if let Some(transaction) = self.undo_stack.pop() {
            let reverse_transaction = self.transact(transaction);
            self.redo_stack.push(reverse_transaction);
            true
        } else {
            false
        }
    }
    pub fn redo(&mut self) -> bool {
        if let Some(transaction) = self.redo_stack.pop() {
            let reverse_transaction = self.transact(transaction);
            self.undo_stack.push(reverse_transaction);
            true
        } else {
            false
        }
    }

    fn transact(&mut self, transaction: Transaction) -> Transaction {
        let mut rev_ops = vec![];
        for op in transaction.ops {
            match op {
                Operation::SetCell { pos, value } => {
                    let sheet = self.grid.sheet_mut_from_id(pos.sheet);
                    let cell_xy = sheet.cell_ref_to_pos(pos).expect("bad cell reference");
                    let response = sheet
                        .set_cell_value(cell_xy, value)
                        .expect("error setting cell");
                    rev_ops.push(Operation::SetCell {
                        pos,
                        value: response.old_value,
                    });
                }
            }
        }
        rev_ops.reverse();
        Transaction { ops: rev_ops }
    }
}

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct Transaction {
    ops: Vec<Operation>,
}

#[derive(Serialize, Deserialize, Debug, Clone)]
pub enum Operation {
    SetCell { pos: CellRef, value: CellValue },
}
