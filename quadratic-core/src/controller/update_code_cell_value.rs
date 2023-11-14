use std::ops::Range;

use indexmap::IndexSet;

use crate::{
    controller::{
        operation::Operation,
        transaction_summary::{CellSheetsModified, TransactionSummary},
        GridController,
    },
    grid::{CellRef, CodeCellValue, SheetId},
    Pos, Value,
};

/// updates code cell value
/// returns true if the code cell was successful
pub fn update_code_cell_value(
    grid_controller: &mut GridController,
    cell_ref: CellRef,
    updated_code_cell_value: Option<CodeCellValue>,
    cells_to_compute: &mut IndexSet<CellRef>,
    reverse_operations: &mut Vec<Operation>,
    summary: &mut TransactionSummary,
) -> bool {
    let mut success = false;
    summary.save = true;
    let sheet_id = cell_ref.sheet.clone();
    let sheet = grid_controller.grid.sheet_mut_from_id(sheet_id);
    if let Some(pos) = sheet.cell_ref_to_pos(cell_ref) {
        let mut spill = false;
        if let Some(updated_code_cell_value) = updated_code_cell_value.clone() {
            if let Some(output) = updated_code_cell_value.output {
                match output.result.output_value() {
                    Some(output_value) => {
                        success = true;
                        match output_value {
                            Value::Array(array) => {
                                if sheet.spilled(cell_ref, array.width(), array.height()) {
                                    summary.cell_sheets_modified.insert(CellSheetsModified::new(
                                        sheet.id,
                                        Pos { x: pos.x, y: pos.y },
                                    ));
                                    spill = true;
                                } else {
                                    spill = false;
                                    for x in 0..array.width() {
                                        let column_id =
                                            sheet.get_or_create_column(pos.x + x as i64).0.id;
                                        for y in 0..array.height() {
                                            summary.cell_sheets_modified.insert(
                                                CellSheetsModified::new(
                                                    sheet.id,
                                                    Pos {
                                                        x: pos.x,
                                                        y: pos.y + y as i64,
                                                    },
                                                ),
                                            );
                                            let row_id =
                                                sheet.get_or_create_row(pos.y + y as i64).id;
                                            // add all but the first cell to the compute cycle
                                            if x != 0 || y != 0 {
                                                cells_to_compute.insert(CellRef {
                                                    sheet: sheet.id,
                                                    column: column_id,
                                                    row: row_id,
                                                });
                                            }
                                        }
                                    }
                                }
                            }
                            Value::Single(_) => {
                                spill = false;
                                summary
                                    .cell_sheets_modified
                                    .insert(CellSheetsModified::new(sheet.id, pos));
                            }
                        };
                    }
                    None => {
                        summary
                            .cell_sheets_modified
                            .insert(CellSheetsModified::new(sheet.id, pos));
                    }
                };
            }
        }

        let updated_code_cell_value = if let Some(cell_value) = updated_code_cell_value {
            if spill {
                // spill can only be set if updated_code_cell value is not None
                let mut updated_code_cell_value = cell_value;
                updated_code_cell_value.output.as_mut().unwrap().spill = true;
                Some(updated_code_cell_value)
            } else if cell_value.spill_error() {
                let mut updated_code_cell_value = cell_value;
                updated_code_cell_value.output.as_mut().unwrap().spill = false;
                Some(updated_code_cell_value)
            } else {
                Some(cell_value)
            }
        } else {
            None
        };
        let old_code_cell_value = sheet.set_code_cell_value(pos, updated_code_cell_value.clone());

        fetch_code_cell_difference(
            grid_controller,
            sheet_id,
            pos,
            old_code_cell_value.clone(),
            updated_code_cell_value,
            summary,
            cells_to_compute,
            reverse_operations,
        );

        reverse_operations.push(Operation::SetCellCode {
            cell_ref,
            code_cell_value: old_code_cell_value,
        });

        summary.code_cells_modified.insert(sheet_id);

        grid_controller.check_spill(
            cell_ref.into(),
            cells_to_compute,
            summary,
            reverse_operations,
        );
    }

    success
}

/// Fetches the difference between the old and new code cell values and updates the UI
pub fn fetch_code_cell_difference(
    grid_controller: &mut GridController,
    sheet_id: SheetId,
    pos: Pos,
    old_code_cell_value: Option<CodeCellValue>,
    new_code_cell_value: Option<CodeCellValue>,
    summary: &mut TransactionSummary,
    cells_to_compute: &mut IndexSet<CellRef>,
    reverse_operations: &mut Vec<Operation>,
) {
    let sheet = grid_controller.grid.sheet_mut_from_id(sheet_id);
    let (old_w, old_h) = if let Some(old_code_cell_value) = old_code_cell_value {
        if old_code_cell_value.spill_error() {
            (1, 1)
        } else {
            let size = old_code_cell_value.output_size();
            (size.w.get(), size.h.get())
        }
    } else {
        (1, 1)
    };
    let (new_w, new_h) = if let Some(new_code_cell_value) = new_code_cell_value {
        if new_code_cell_value.spill_error() {
            (1, 1)
        } else {
            let size = new_code_cell_value.output_size();
            (size.w.get(), size.h.get())
        }
    } else {
        (0, 0)
    };

    let mut possible_spills = vec![];

    if old_w > new_w {
        for x in new_w..old_w {
            let (_, column) = sheet.get_or_create_column(pos.x + x as i64);
            let column_id = column.id;

            // todo: start here...
            // sheet.remove_spills
            column.spills.remove_range(Range {
                start: pos.y,
                end: pos.y + new_h as i64 + 1,
            });
            for y in 0..new_h {
                let row_id = sheet.get_or_create_row(pos.y + y as i64).id;
                let pos = Pos {
                    x: pos.x + x as i64,
                    y: pos.y + y as i64,
                };
                summary
                    .cell_sheets_modified
                    .insert(CellSheetsModified::new(sheet_id, pos));
                let cell_ref = CellRef {
                    sheet: sheet_id,
                    column: column_id,
                    row: row_id,
                };
                cells_to_compute.insert(cell_ref.clone());
                if y <= old_h {
                    possible_spills.push(cell_ref);
                }
            }
        }
    }
    if old_h > new_h {
        for x in 0..old_w {
            let (_, column) = sheet.get_or_create_column(pos.x + x as i64);
            let column_id = column.id;

            // todo: perhaps this???
            // // only remove the spill range when cell_value = this
            // for y in (pos.y + new_h as i64)..(pos.y + old_h as i64) {
            //     if column.spills.get(y).is_some_and(|c| c != cell_ref) {
            //         column.spills.remove_range(y.into());
            //     }
            // }

            column.spills.remove_range(Range {
                start: pos.y + new_h as i64,
                end: pos.y + old_h as i64 + 1,
            });
            for y in new_h..old_h {
                let row_id = sheet.get_or_create_row(pos.y + y as i64).id;
                let pos = Pos {
                    x: pos.x + x as i64,
                    y: pos.y + y as i64,
                };
                summary
                    .cell_sheets_modified
                    .insert(CellSheetsModified::new(sheet_id, pos));
                let cell_ref = CellRef {
                    sheet: sheet_id,
                    column: column_id,
                    row: row_id,
                };
                cells_to_compute.insert(cell_ref.clone());
                possible_spills.push(cell_ref);
            }
        }
    }

    // check for released spills
    possible_spills.iter().for_each(|cell_ref| {
        grid_controller.check_release_spill(
            *cell_ref,
            cells_to_compute,
            summary,
            reverse_operations,
        );
    });
}

#[cfg(test)]
mod test {
    use indexmap::IndexSet;

    use crate::{
        controller::{
            transaction_summary::TransactionSummary,
            update_code_cell_value::fetch_code_cell_difference, GridController,
        },
        grid::{CodeCellLanguage, CodeCellRunOutput, CodeCellValue},
        Array, ArraySize, CellValue, Pos, SheetPos, Value,
    };

    use super::update_code_cell_value;

    #[test]
    fn test_fetch_code_cell_difference() {
        let mut gc = GridController::new();
        let sheet_id = gc.sheet_ids()[0];
        let sheet = gc.grid.sheet_mut_from_id(sheet_id);

        let old = Some(CodeCellValue {
            language: CodeCellLanguage::Python,
            code_string: "print(1)".to_string(),
            formatted_code_string: None,
            last_modified: String::from(""),
            output: Some(CodeCellRunOutput {
                std_out: None,
                std_err: None,
                result: crate::grid::CodeCellRunResult::Ok {
                    output_value: Value::Array(Array::new_empty(
                        ArraySize::try_from((2, 3)).expect("failed to create array"),
                    )),
                    cells_accessed: Vec::new(),
                },
                spill: false,
            }),
        });
        let new_smaller = Some(CodeCellValue {
            language: CodeCellLanguage::Python,
            code_string: "print(1)".to_string(),
            formatted_code_string: None,
            last_modified: String::from(""),
            output: Some(CodeCellRunOutput {
                std_out: None,
                std_err: None,
                result: crate::grid::CodeCellRunResult::Ok {
                    output_value: Value::Array(Array::new_empty(
                        ArraySize::try_from((1, 2)).expect("failed to create array"),
                    )),
                    cells_accessed: Vec::new(),
                },
                spill: false,
            }),
        });

        let sheet_pos = SheetPos {
            x: 0,
            y: 0,
            sheet_id: sheet.id,
        };

        let mut summary = TransactionSummary::default();

        let mut cells_to_compute = IndexSet::new();
        let mut reverse_operations = Vec::new();
        fetch_code_cell_difference(
            &mut gc,
            sheet_id,
            sheet_pos.into(),
            old.clone(),
            new_smaller,
            &mut summary,
            &mut cells_to_compute,
            &mut reverse_operations,
        );
        assert_eq!(summary.cell_sheets_modified.len(), 1);

        summary.clear();

        let new_larger = Some(CodeCellValue {
            language: CodeCellLanguage::Python,
            code_string: "print(1)".to_string(),
            formatted_code_string: None,
            last_modified: String::from(""),
            output: Some(CodeCellRunOutput {
                std_out: None,
                std_err: None,
                result: crate::grid::CodeCellRunResult::Ok {
                    output_value: Value::Array(Array::new_empty(
                        ArraySize::try_from((5, 6)).expect("failed to create array"),
                    )),
                    cells_accessed: Vec::new(),
                },
                spill: false,
            }),
        });

        super::fetch_code_cell_difference(
            &mut gc,
            sheet_id,
            sheet_pos.into(),
            old,
            new_larger,
            &mut summary,
            &mut cells_to_compute,
            &mut reverse_operations,
        );
        assert_eq!(summary.cell_sheets_modified.len(), 0);
    }

    #[test]
    fn test_spilled_output_over_normal_cell() {
        let mut gc = GridController::new();
        let sheet_id = gc.sheet_ids()[0];
        let sheet = gc.grid.sheet_mut_from_id(sheet_id);
        sheet.set_cell_value(Pos { x: 0, y: 1 }, CellValue::Text("test".into()));

        let code_cell_output = Some(CodeCellValue {
            language: CodeCellLanguage::Python,
            code_string: "print(1)".to_string(),
            formatted_code_string: None,
            last_modified: String::from(""),
            output: Some(CodeCellRunOutput {
                std_out: None,
                std_err: None,
                result: crate::grid::CodeCellRunResult::Ok {
                    output_value: Value::Array(Array::new_empty(
                        ArraySize::try_from((2, 3)).expect("failed to create array"),
                    )),
                    cells_accessed: Vec::new(),
                },
                spill: false,
            }),
        });

        let sheet = gc.grid.sheet_mut_from_id(sheet_id);
        let cell_ref = sheet.get_or_create_cell_ref(Pos { x: 0, y: 0 });

        update_code_cell_value(
            &mut gc,
            cell_ref,
            code_cell_output.clone(),
            &mut IndexSet::default(),
            &mut vec![],
            &mut TransactionSummary::default(),
        );

        let sheet = gc.grid.sheet_from_id(sheet_id);
        let code_cell = sheet.get_code_cell(Pos { x: 0, y: 0 });
        assert_eq!(code_cell.unwrap().spill_error(), true);
    }

    #[test]
    fn test_spilled_output_over_code_cell() {
        let mut gc = GridController::new();
        let sheet_id = gc.sheet_ids()[0];

        let code_cell_output = Some(CodeCellValue {
            language: CodeCellLanguage::Python,
            code_string: "print(1)".to_string(),
            formatted_code_string: None,
            last_modified: String::from(""),
            output: Some(CodeCellRunOutput {
                std_out: None,
                std_err: None,
                result: crate::grid::CodeCellRunResult::Ok {
                    output_value: Value::Array(Array::new_empty(
                        ArraySize::try_from((2, 3)).expect("failed to create array"),
                    )),
                    cells_accessed: Vec::new(),
                },
                spill: false,
            }),
        });

        let sheet = gc.grid.sheet_mut_from_id(sheet_id);
        let original_cell_ref = sheet.get_or_create_cell_ref(Pos { x: 0, y: 1 });

        update_code_cell_value(
            &mut gc,
            original_cell_ref,
            code_cell_output.clone(),
            &mut IndexSet::default(),
            &mut vec![],
            &mut TransactionSummary::default(),
        );

        let code_cell_output = Some(CodeCellValue {
            language: CodeCellLanguage::Python,
            code_string: "print(1)".to_string(),
            formatted_code_string: None,
            last_modified: String::from(""),
            output: Some(CodeCellRunOutput {
                std_out: None,
                std_err: None,
                result: crate::grid::CodeCellRunResult::Ok {
                    output_value: Value::Array(Array::new_empty(
                        ArraySize::try_from((1, 3)).expect("failed to create array"),
                    )),
                    cells_accessed: Vec::new(),
                },
                spill: false,
            }),
        });

        let sheet = gc.grid.sheet_mut_from_id(sheet_id);
        let cell_ref = sheet.get_or_create_cell_ref(Pos { x: 0, y: 0 });

        update_code_cell_value(
            &mut gc,
            cell_ref,
            code_cell_output.clone(),
            &mut IndexSet::default(),
            &mut vec![],
            &mut TransactionSummary::default(),
        );

        let sheet = gc.grid.sheet_from_id(sheet_id);
        let code_cell = sheet.get_code_cell(Pos { x: 0, y: 0 });
        assert_eq!(code_cell.unwrap().spill_error(), true);
        assert_eq!(sheet.get_column(0).unwrap().spills.get(0), Some(cell_ref));
        assert_eq!(
            sheet.get_column(0).unwrap().spills.get(1),
            Some(original_cell_ref)
        );
    }
}
