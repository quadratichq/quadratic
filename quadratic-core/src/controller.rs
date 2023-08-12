use itertools::Itertools;
use serde::{Deserialize, Serialize};
#[cfg(feature = "js")]
use wasm_bindgen::prelude::*;

use crate::{
    grid::{CellRef, ColumnId, Grid, RowId, Sheet, SheetId},
    Array, CellValue, Pos, Rect,
};

#[derive(Debug, Default, Clone)]
#[cfg_attr(feature = "js", wasm_bindgen)]
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
    pub fn grid(&self) -> &Grid {
        &self.grid
    }

    pub fn sheet_ids(&self) -> Vec<SheetId> {
        self.grid.sheets().iter().map(|sheet| sheet.id).collect()
    }
    pub fn sheet(&self, sheet_id: SheetId) -> &Sheet {
        self.grid.sheet_from_id(sheet_id)
    }

    pub fn set_cell_value(
        &mut self,
        sheet_id: SheetId,
        pos: Pos,
        value: CellValue,
    ) -> TransactionSummary {
        let sheet = self.grid.sheet_mut_from_id(sheet_id);
        let cell_ref = sheet.get_or_create_cell_ref(pos);
        let transaction = Transaction {
            ops: vec![Operation::SetCell { cell_ref, value }],
        };
        self.transact_forward(transaction)
    }
    pub fn set_cells(
        &mut self,
        sheet_id: SheetId,
        start_pos: Pos,
        values: Array,
    ) -> TransactionSummary {
        let sheet = self.grid.sheet_mut_from_id(sheet_id);
        let region = Rect {
            min: start_pos,
            max: Pos {
                x: start_pos.x + values.width() as i64 - 1,
                y: start_pos.y + values.height() as i64 - 1,
            },
        };
        let columns = region
            .x_range()
            .map(|x| sheet.get_or_create_column(x).0.id)
            .collect();
        let rows = region
            .x_range()
            .map(|x| sheet.get_or_create_row(x).id)
            .collect();
        let transaction = Transaction {
            ops: vec![Operation::SetCells {
                sheet_id,
                columns,
                rows,
                values,
            }],
        };
        self.transact_forward(transaction)
    }
    pub fn delete_cell_values(&mut self, sheet_id: SheetId, region: Rect) -> TransactionSummary {
        let sheet = self.grid.sheet_from_id(sheet_id);
        let columns = region
            .x_range()
            .filter_map(|x| sheet.get_column(x))
            .map(|column| column.id)
            .collect_vec();
        let rows = region
            .x_range()
            .filter_map(|x| sheet.get_row(x))
            .collect_vec();
        let width = columns.len() as u32;
        let height = rows.len() as u32;
        let transaction = match Array::new_empty(width, height) {
            Ok(values) => Transaction {
                ops: vec![Operation::SetCells {
                    sheet_id,
                    columns,
                    rows,
                    values,
                }],
            },
            Err(_) => Transaction {
                ops: vec![], // nothing to do! TODO: probably shouldn't even have an undo stack entry
            },
        };
        self.transact_forward(transaction)
    }

    fn transact_forward(&mut self, transaction: Transaction) -> TransactionSummary {
        let (reverse_transaction, summary) = self.transact(transaction);
        self.redo_stack.clear();
        self.undo_stack.push(reverse_transaction);
        summary
    }
    pub fn undo(&mut self) -> Option<TransactionSummary> {
        let transaction = self.undo_stack.pop()?;
        let (reverse_transaction, summary) = self.transact(transaction);
        self.redo_stack.push(reverse_transaction);
        Some(summary)
    }
    pub fn redo(&mut self) -> Option<TransactionSummary> {
        let transaction = self.redo_stack.pop()?;
        let (reverse_transaction, summary) = self.transact(transaction);
        self.undo_stack.push(reverse_transaction);
        Some(summary)
    }

    fn transact(&mut self, transaction: Transaction) -> (Transaction, TransactionSummary) {
        let mut rev_ops = vec![];
        let mut dirty_sheets = vec![];
        let mut regions_modified = vec![];
        for op in transaction.ops {
            if let Some(new_dirty_sheet) = op.dirty_sheet() {
                if !dirty_sheets.contains(&new_dirty_sheet) {
                    dirty_sheets.push(new_dirty_sheet)
                }
            }
            match op {
                Operation::SetCell { cell_ref, value } => {
                    let sheet = self.grid.sheet_mut_from_id(cell_ref.sheet);
                    let cell_xy = sheet.cell_ref_to_pos(cell_ref).expect("bad cell reference");

                    regions_modified.push((cell_ref.sheet, Rect::single_pos(cell_xy)));

                    let old_value = match sheet.set_cell_value(cell_xy, value) {
                        Some(response) => response.old_value,
                        None => CellValue::Blank,
                    };
                    rev_ops.push(Operation::SetCell {
                        cell_ref,
                        value: old_value,
                    });
                }
                Operation::SetCells {
                    sheet_id,
                    columns,
                    rows,
                    values,
                } => {
                    let sheet = self.grid.sheet_mut_from_id(sheet_id);

                    // Perhaps some columns or rows have disappeared since this
                    // transaction was first made. In that case, ignore the
                    // deleted columns when considering what region was
                    // modified.
                    let xs = columns.iter().filter_map(|&id| sheet.get_column_index(id));
                    let ys = rows.iter().filter_map(|&id| sheet.get_row_index(id));
                    if let Some(modified_rect) = Rect::from_xs_and_ys(xs, ys) {
                        regions_modified.push((sheet_id, modified_rect));
                    }

                    let width = rows.len() as u32;
                    let height = columns.len() as u32;
                    let old_values = itertools::iproduct!(&rows, &columns)
                        .zip(values.into_cell_values_vec())
                        .map(|((&row, &column), value)| {
                            let pos = sheet.cell_ref_to_pos(CellRef {
                                sheet: sheet_id,
                                column,
                                row,
                            })?;
                            let response = sheet.set_cell_value(pos, value)?;
                            Some(response.old_value)
                        })
                        .map(|old_value| old_value.unwrap_or(CellValue::Blank))
                        .collect();
                    let old_values = Array::new_row_major(width, height, old_values)
                        .expect("error constructing array of old values for SetCells operation");
                    rev_ops.push(Operation::SetCells {
                        sheet_id,
                        columns,
                        rows,
                        values: old_values,
                    })
                }
            }
        }
        for dirty_sheet in dirty_sheets {
            self.grid
                .sheet_mut_from_id(dirty_sheet)
                .recalculate_bounds();
        }
        rev_ops.reverse();

        let reverse_transaction = Transaction { ops: rev_ops };
        let summary = TransactionSummary { regions_modified };

        (reverse_transaction, summary)
    }
}

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct Transaction {
    ops: Vec<Operation>,
}

#[derive(Serialize, Deserialize, Debug, Clone)]
pub enum Operation {
    SetCell {
        cell_ref: CellRef,
        value: CellValue,
    },
    SetCells {
        sheet_id: SheetId,
        columns: Vec<ColumnId>,
        rows: Vec<RowId>,
        values: Array,
    },
}
impl Operation {
    pub fn dirty_sheet(&self) -> Option<SheetId> {
        match self {
            Operation::SetCell { cell_ref, .. } => Some(cell_ref.sheet),
            Operation::SetCells { sheet_id, .. } => Some(*sheet_id),
        }
    }
}

#[derive(Serialize, Deserialize, Debug, Default, Clone, PartialEq, Eq)]
#[cfg_attr(feature = "js", derive(ts_rs::TS))]
pub struct TransactionSummary {
    pub regions_modified: Vec<(SheetId, Rect)>,
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_set_cell_undo_redo() {
        let mut g = GridController::new();
        let sheet_id = g.grid.sheets()[0].id;
        let pos = Pos { x: 3, y: 6 };
        let get_the_cell =
            |g: &GridController| g.sheet(sheet_id).get_cell_value(pos).unwrap_or_default();
        let expected_summary = Some(TransactionSummary {
            regions_modified: vec![(sheet_id, Rect::single_pos(pos))],
        });

        assert_eq!(get_the_cell(&g), CellValue::Blank);
        g.set_cell_value(sheet_id, pos, "a".into());
        assert_eq!(get_the_cell(&g), "a".into());
        g.set_cell_value(sheet_id, pos, "b".into());
        assert_eq!(get_the_cell(&g), "b".into());
        assert!(g.undo() == expected_summary);
        assert_eq!(get_the_cell(&g), "a".into());
        assert!(g.redo() == expected_summary);
        assert_eq!(get_the_cell(&g), "b".into());
        assert!(g.undo() == expected_summary);
        assert_eq!(get_the_cell(&g), "a".into());
        assert!(g.undo() == expected_summary);
        assert_eq!(get_the_cell(&g), CellValue::Blank);
        assert!(g.undo().is_none());
        assert_eq!(get_the_cell(&g), CellValue::Blank);
        assert!(g.redo() == expected_summary);
        assert_eq!(get_the_cell(&g), "a".into());
        assert!(g.redo() == expected_summary);
        assert_eq!(get_the_cell(&g), "b".into());
        assert!(g.redo().is_none());
        assert_eq!(get_the_cell(&g), "b".into());
    }
}
