use core::panic;

use crate::{grid::SheetId, Pos};
use serde::{Deserialize, Serialize};

use super::{
    in_progress_transaction::InProgressTransaction, operations::Operation,
    transaction_summary::TransactionSummary, GridController,
};

impl GridController {
    pub fn set_in_progress_transaction(
        &mut self,
        operations: Vec<Operation>,
        cursor: Option<String>,
        compute: bool,
    ) -> TransactionSummary {
        if self
            .in_progress_transaction
            .as_ref()
            .is_some_and(|in_progress_transaction| !in_progress_transaction.complete)
        {
            panic!("Cannot start a transaction while a transaction is in progress");
        }
        let mut transaction = InProgressTransaction::new(self, operations, cursor, compute);
        let summary = transaction.transaction_summary();
        self.in_progress_transaction = Some(transaction);
        summary
    }

    // pub fn transact(
    //     &mut self,
    //     operations: Vec<Operation>,
    //     cursor: Option<String>,
    //     compute: bool,
    // ) -> TransactionSummary {
    //     if self.in_progress_transaction.is_some() {
    //         panic!("Cannot start a transaction while a transaction is in progress");
    //     }
    //     let mut in_progress_transaction = InProgressTransaction::new(cursor);
    //     in_progress_transaction.start(self, operations, compute);
    //     if in_progress_transaction.complete {
    //         self.redo_stack.push(in_progress_transaction.into());
    //     } else {
    //         self.in_progress_transaction = Some(in_progress_transaction);
    //     }
    //     in_progress_transaction.transaction_summary()
    // }

    pub fn has_undo(&self) -> bool {
        !self.undo_stack.is_empty()
    }
    pub fn has_redo(&self) -> bool {
        !self.redo_stack.is_empty()
    }
    pub fn undo(&mut self, cursor: Option<String>) -> TransactionSummary {
        if let Some(transaction) = self.undo_stack.pop() {
            self.set_in_progress_transaction(transaction.ops, cursor, false)
        } else {
            panic!("No undo stack");
        }
    }
    pub fn redo(&mut self, cursor: Option<String>) -> TransactionSummary {
        if let Some(transaction) = self.redo_stack.pop() {
            self.set_in_progress_transaction(transaction.ops, cursor, false)
        } else {
            panic!("No redo stack");
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
            Operation::SetCellDependencies { .. } => None,
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

    #[test]
    fn converts_a_pos_into_a_cell_hash() {
        let assert_cell_hash = |pos: Pos, expected: &str| {
            assert_eq!(
                CellHash::from(pos),
                CellHash(expected.into()),
                "expected pos {} to convert to '{}'",
                pos,
                expected
            );
        };

        assert_cell_hash((0, 0).into(), "0,0");
        assert_cell_hash((1, 0).into(), "0,0");
        assert_cell_hash((0, 1).into(), "0,0");
        assert_cell_hash((21, 0).into(), "1,0");
        assert_cell_hash((41, 0).into(), "2,0");
        assert_cell_hash((0, 41).into(), "0,1");
        assert_cell_hash((0, 81).into(), "0,2");
    }
    /*
    #[tokio::test]
    async fn test_execute_operation_set_cell_values() {
        let mut gc = GridController::new();
        let sheet_id = gc.grid.sheets()[0].id;
        let data = vec![(0, 0, "a"), (1, 0, "b"), (21, 0, "c"), (0, 41, "d")];
        let mut operations: Vec<Operation> = vec![];

        data.clone().into_iter().for_each(|(x, y, value)| {
            operations.push(add_cell_text(&mut gc, sheet_id, (x, y).into(), value));
        });

        let summary = gc.transact_forward(operations, None).await;

        let expected = vec![
            ("0,0", vec![(0, 0, "a"), (1, 0, "b")]),
            ("0,1", vec![(0, 41, "d")]),
            ("1,0", vec![(21, 0, "c")]),
        ];

        let to_js_render_cell = |entry: Vec<(i64, i64, &str)>| {
            entry
                .into_iter()
                .map(|entry| JsRenderCell {
                    x: entry.0,
                    y: entry.1,
                    value: entry.2.into(),
                    language: None,
                    align: None,
                    wrap: None,
                    bold: None,
                    italic: None,
                    text_color: None,
                })
                .collect::<Vec<_>>()
        };

        let map = summary
            .cell_hash_values_modified
            .entry(sheet_id.to_string());

        match map {
            Entry::Occupied(entry) => {
                entry
                    .get()
                    .into_iter()
                    .enumerate()
                    .for_each(|(index, (key, value))| {
                        assert_eq!(key, expected[index].0);
                        assert_eq!(*value, to_js_render_cell(expected[index].1.clone()));
                    });
            }
            _ => panic!("expected cell_hash_values_modified to be occupied"),
        }

        // now make one of tne non-blank cells blank
        let operations = vec![add_cell_value(
            &mut gc,
            sheet_id,
            (0, 0).into(),
            CellValue::Blank,
        )];

        let summary = gc.transact_forward(operations, None).await;
        assert_eq!(
            summary
                .cell_hash_values_modified
                .get(&sheet_id.to_string())
                .unwrap()
                .get("0,0")
                .unwrap(),
            &to_js_render_cell(vec![(0, 0, "")])
        );
    }*/
}
