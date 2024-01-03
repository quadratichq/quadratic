use crate::{
    controller::{active_transactions::pending_transaction::PendingTransaction, GridController},
    grid::{CodeCellLanguage, CodeRun},
    Array, CellValue, CodeCellValue, Rect, SheetPos, SheetRect,
};

use super::operation::Operation;

impl GridController {
    // Adds operations to delete any code runs within the sheet_rect.
    pub fn delete_code_run_operations(&self, sheet_rect: &SheetRect) -> Vec<Operation> {
        let mut ops = vec![];
        if let Some(sheet) = self.grid.try_sheet_from_id(sheet_rect.sheet_id) {
            let rect: Rect = (*sheet_rect).into();
            sheet
                .code_runs
                .iter()
                .filter(|(pos, _)| rect.contains(**pos))
                .for_each(|(pos, _)| {
                    let code_sheet_pos = pos.to_sheet_pos(sheet.id);
                    if sheet_rect.contains(code_sheet_pos) {
                        ops.push(Operation::SetCodeRun {
                            sheet_pos: pos.to_sheet_pos(sheet_rect.sheet_id),
                            code_run: None,
                        });
                    }
                });
        }
        ops
    }

    /// Adds operations to compute a CellValue::Code at teh sheet_pos.
    pub fn set_code_cell_operations(
        &self,
        sheet_pos: SheetPos,
        language: CodeCellLanguage,
        code: String,
    ) -> Vec<Operation> {
        vec![
            Operation::SetCellValues {
                sheet_rect: sheet_pos.into(),
                values: Array::from(CellValue::Code(CodeCellValue { language, code })),
            },
            Operation::ComputeCode { sheet_pos },
        ]
    }

    /// Adds operations to compute cells that are dependents within a SheetRect
    pub fn add_compute_operations(
        &mut self,
        transaction: &mut PendingTransaction,
        output: &SheetRect,
        skip_compute: Option<SheetPos>,
    ) {
        self.get_dependent_code_cells(output)
            .iter()
            .for_each(|sheet_positions| {
                sheet_positions.iter().for_each(|code_cell_sheet_pos| {
                    if !skip_compute
                        .is_some_and(|skip_compute| skip_compute == *code_cell_sheet_pos)
                    {
                        // only add a compute operation if there isn't already one pending
                        if !transaction.operations.iter().any(|op| match op {
                            Operation::ComputeCode { sheet_pos } => {
                                code_cell_sheet_pos == sheet_pos
                            }
                            _ => false,
                        }) {
                            transaction.operations.push_back(Operation::ComputeCode {
                                sheet_pos: *code_cell_sheet_pos,
                            });
                        }
                    }
                });
            });
    }

    /// Adds operations after a code_cell has changed
    pub fn add_code_run_operations(
        &mut self,
        transaction: &mut PendingTransaction,
        sheet_pos: SheetPos,
        old_code_run: &Option<CodeRun>,
        new_code_run: &Option<CodeRun>,
    ) {
        let old_sheet_rect = old_code_run
            .as_ref()
            .map(|c| c.output_sheet_rect(sheet_pos, false));
        let new_sheet_rect = new_code_run
            .as_ref()
            .map(|c| c.output_sheet_rect(sheet_pos, false));
        match (&old_sheet_rect, &new_sheet_rect) {
            (Some(old_sheet_rect), Some(new_sheet_rect)) => {
                let sheet_rect = old_sheet_rect.union(new_sheet_rect);
                self.add_compute_operations(transaction, &sheet_rect, Some(sheet_pos));
            }
            (Some(old_sheet_rect), None) => {
                self.add_compute_operations(transaction, old_sheet_rect, Some(sheet_pos));
            }
            (None, Some(new_sheet_rect)) => {
                self.add_compute_operations(transaction, new_sheet_rect, Some(sheet_pos));
            }
            (None, None) => {}
        }
    }
}

#[cfg(test)]
mod test {
    use super::*;
    use crate::{grid::CodeRunResult, Pos, Value};
    use chrono::Utc;
    use std::collections::HashSet;

    #[test]
    fn test_delete_code_cell_operations() {
        let mut gc = GridController::default();
        let sheet_id = gc.sheet_ids()[0];
        let sheet = gc.grid_mut().try_sheet_mut_from_id(sheet_id).unwrap();
        let pos = Pos { x: 0, y: 0 };
        sheet.set_code_run(
            pos,
            Some(CodeRun {
                formatted_code_string: None,
                std_err: None,
                std_out: None,
                result: CodeRunResult::Ok(Value::Single(CellValue::Text("delete me".to_string()))),
                last_modified: Utc::now(),
                cells_accessed: HashSet::new(),
                spill_error: false,
            }),
        );

        let operations = gc.delete_code_run_operations(&SheetRect::single_pos(pos, sheet_id));
        assert_eq!(operations.len(), 1);
        assert_eq!(
            operations[0],
            Operation::SetCodeRun {
                sheet_pos: pos.to_sheet_pos(sheet_id),
                code_run: None,
            }
        );
    }

    #[test]
    fn test_set_code_cell_operations() {
        let mut gc = GridController::default();
        let sheet_id = gc.sheet_ids()[0];
        let sheet = gc.grid_mut().try_sheet_mut_from_id(sheet_id).unwrap();
        let pos = Pos { x: 0, y: 0 };
        sheet.set_cell_value(pos, CellValue::Text("delete me".to_string()));

        let operations = gc.set_code_cell_operations(
            pos.to_sheet_pos(sheet_id),
            CodeCellLanguage::Python,
            "print('hello world')".to_string(),
        );
        assert_eq!(operations.len(), 2);
        assert_eq!(
            operations[0],
            Operation::SetCellValues {
                sheet_rect: SheetRect::from(pos.to_sheet_pos(sheet_id)),
                values: Array::from(CellValue::Code(CodeCellValue {
                    language: CodeCellLanguage::Python,
                    code: "print('hello world')".to_string(),
                })),
            }
        );
        assert_eq!(
            operations[1],
            Operation::ComputeCode {
                sheet_pos: pos.to_sheet_pos(sheet_id),
            }
        );
    }
}
