use serde::{Deserialize, Serialize};

use crate::{
    grid::{CellRef, Grid, SheetId},
    CellValue, Pos,
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

    pub fn set_cell(&mut self, sheet_id: SheetId, pos: Pos, value: CellValue) {
        let sheet = self.grid.sheet_mut_from_id(sheet_id);
        let cell_ref = sheet.get_or_create_cell_ref(pos);
        let transaction = Transaction {
            ops: vec![Operation::SetCell { cell_ref, value }],
        };
        self.transact_forward(transaction);
    }
    pub fn get_cell(&self, sheet_id: SheetId, pos: Pos) -> CellValue {
        self.grid
            .sheet_from_id(sheet_id)
            .get_cell_value(pos)
            .unwrap_or(CellValue::Blank)
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
                Operation::SetCell { cell_ref, value } => {
                    let sheet = self.grid.sheet_mut_from_id(cell_ref.sheet);
                    let cell_xy = sheet.cell_ref_to_pos(cell_ref).expect("bad cell reference");
                    let response = sheet
                        .set_cell_value(cell_xy, value)
                        .expect("error setting cell");
                    rev_ops.push(Operation::SetCell {
                        cell_ref,
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
    SetCell { cell_ref: CellRef, value: CellValue },
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_set_cell_undo_redo() {
        let mut g = GridController::new();
        let sheet_id = g.grid.sheets()[0].id;
        let pos = Pos { x: 3, y: 6 };
        assert_eq!(g.get_cell(sheet_id, pos), CellValue::Blank);
        g.set_cell(sheet_id, pos, "a".into());
        assert_eq!(g.get_cell(sheet_id, pos), "a".into());
        g.set_cell(sheet_id, pos, "b".into());
        assert_eq!(g.get_cell(sheet_id, pos), "b".into());
        assert!(g.undo());
        assert_eq!(g.get_cell(sheet_id, pos), "a".into());
        assert!(g.redo());
        assert_eq!(g.get_cell(sheet_id, pos), "b".into());
        assert!(g.undo());
        assert_eq!(g.get_cell(sheet_id, pos), "a".into());
        assert!(g.undo());
        assert_eq!(g.get_cell(sheet_id, pos), CellValue::Blank);
        assert!(g.redo());
        assert_eq!(g.get_cell(sheet_id, pos), "a".into());
        assert!(g.redo());
        assert_eq!(g.get_cell(sheet_id, pos), "b".into());
        assert!(!g.redo());
        assert_eq!(g.get_cell(sheet_id, pos), "b".into());
    }
}
