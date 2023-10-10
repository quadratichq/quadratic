use crate::{grid::SheetId, Pos};
use serde::{Deserialize, Serialize};

use super::{
    compute::SheetPos, operations::Operation, transaction_summary::TransactionSummary,
    GridController,
};

impl GridController {
    /// Takes a Vec of initial Operations creates and runs a tractions, returning a transaction summary.
    /// This is the main entry point actions added to the undo/redo stack.
    /// Also runs computations for cells that need to be recomputed, and all of their dependencies.
    pub async fn transact_forward(
        &mut self,
        operations: Vec<Operation>,
        cursor: Option<String>,
    ) -> TransactionSummary {
        // make initial changes
        let mut summary = TransactionSummary::default();
        let mut cell_values_modified: Vec<SheetPos> = vec![];
        let mut reverse_operations =
            self.transact(operations, &mut cell_values_modified, &mut summary);

        // run computations
        let mut additional_operations = self.compute(cell_values_modified, &mut summary).await;

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

        // these are irrelevant when undoing b/c we do not rerun computations
        let mut cell_values_modified = vec![];

        let reverse_operation =
            self.transact(transaction.ops, &mut cell_values_modified, &mut summary);
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

        // these are irrelevant when redoing b/c we do not rerun computations
        let mut cell_values_modified = vec![];

        let reverse_operations =
            self.transact(transaction.ops, &mut cell_values_modified, &mut summary);
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
        cell_values_modified: &mut Vec<SheetPos>,
        summary: &mut TransactionSummary,
    ) -> Vec<Operation> {
        let mut reverse_operations = vec![];
        // TODO move bounds recalculation to somewhere else?
        let mut sheets_with_changed_bounds = vec![];

        for op in operations.iter() {
            if let Some(new_dirty_sheet) = op.sheet_with_changed_bounds() {
                if !sheets_with_changed_bounds.contains(&new_dirty_sheet) {
                    sheets_with_changed_bounds.push(new_dirty_sheet);
                }
            }
            let reverse_operation =
                self.execute_operation(op.clone(), cell_values_modified, summary);
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
    use std::collections::btree_map::Entry;

    use crate::{grid::js_types::JsRenderCell, Array, CellValue, Pos, Rect};

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

    fn add_cell_text(
        gc: &mut GridController,
        sheet_id: SheetId,
        pos: Pos,
        value: &str,
    ) -> Operation {
        add_cell_value(gc, sheet_id, pos, CellValue::Text(value.into()))
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
