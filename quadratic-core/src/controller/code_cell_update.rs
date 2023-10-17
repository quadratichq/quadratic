use crate::{
    grid::{
        js_types::{JsRenderCellUpdate, JsRenderCellUpdateEnum},
        CellRef, CodeCellValue, Sheet,
    },
    ArraySize, Pos, SheetPos, Value,
};

use super::{
    operation::Operation,
    transaction_summary::{OperationSummary, TransactionSummary},
    GridController,
};

pub fn update_code_cell_value(
    grid_controller: &mut GridController,
    cell_ref: CellRef,
    updated_code_cell_value: Option<CodeCellValue>,
    cells_to_compute: &mut Option<&mut Vec<CellRef>>,
    reverse_operations: &mut Vec<Operation>,
    summary: &mut TransactionSummary,
) {
    let sheet = grid_controller.grid.sheet_mut_from_id(cell_ref.sheet);
    if let Some(pos) = sheet.cell_ref_to_pos(cell_ref) {
        let old_code_cell_value = sheet.set_code_cell_value(pos, updated_code_cell_value.clone());
        let mut summary_set = vec![];
        if let Some(updated_code_cell_value) = updated_code_cell_value.clone() {
            if let Some(output) = updated_code_cell_value.output {
                match output.result.output_value() {
                    Some(output_value) => {
                        match output_value {
                            Value::Array(array) => {
                                for x in 0..array.size().w.into() {
                                    let column_id =
                                        sheet.get_or_create_column(pos.x + x as i64).0.id;
                                    for y in 0..array.size().h.into() {
                                        let row_id = sheet.get_or_create_row(pos.y + y as i64).id;
                                        // add all but the first cell to the compute cycle
                                        if x != 0 && y != 0 {
                                            if let Some(cells_to_compute) = cells_to_compute {
                                                cells_to_compute.push(CellRef {
                                                    sheet: sheet.id,
                                                    column: column_id,
                                                    row: row_id,
                                                });
                                            }
                                        }
                                        if let Ok(value) = array.get(x, y) {
                                            let entry_pos = Pos {
                                                x: pos.x + x as i64,
                                                y: pos.y + y as i64,
                                            };
                                            let (numeric_format, numeric_decimals) =
                                                sheet.cell_numeric_info(entry_pos);
                                            summary_set.push(JsRenderCellUpdate {
                                                x: pos.x + x as i64,
                                                y: pos.y + y as i64,
                                                update: JsRenderCellUpdateEnum::Value(Some(
                                                    value.to_display(
                                                        numeric_format,
                                                        numeric_decimals,
                                                    ),
                                                )),
                                            });
                                        }
                                    }
                                }
                            }
                            Value::Single(value) => {
                                let (numeric_format, numeric_decimals) =
                                    sheet.cell_numeric_info(pos);
                                summary_set.push(JsRenderCellUpdate {
                                    x: pos.x,
                                    y: pos.y,
                                    update: JsRenderCellUpdateEnum::Value(Some(
                                        value.to_display(numeric_format, numeric_decimals),
                                    )),
                                });
                            }
                        };
                    }
                    None => {
                        summary_set.push(JsRenderCellUpdate {
                            x: pos.x,
                            y: pos.y,
                            update: JsRenderCellUpdateEnum::Value(Some(" ERROR".into())),
                        });
                        summary_set.push(JsRenderCellUpdate {
                            x: pos.x,
                            y: pos.y,
                            update: JsRenderCellUpdateEnum::TextColor(Some("red".into())),
                        });
                        summary_set.push(JsRenderCellUpdate {
                            x: pos.x,
                            y: pos.y,
                            update: JsRenderCellUpdateEnum::Italic(Some(true)),
                        });
                    }
                };
            }
        }
        fetch_code_cell_difference(
            sheet,
            pos,
            old_code_cell_value.clone(),
            updated_code_cell_value.clone(),
            &mut summary_set,
            cells_to_compute,
        );
        reverse_operations.push(Operation::SetCellCode {
            cell_ref,
            code_cell_value: old_code_cell_value,
        });
        if !summary_set.is_empty() {
            summary.operations.push(OperationSummary::SetCellValues(
                sheet.id.to_string(),
                summary_set.clone(),
            ));
        }
        summary.code_cells_modified.insert(sheet.id);
    }
}

/// Fetches the difference between the old and new code cell values and updates the UI
pub fn fetch_code_cell_difference(
    sheet: &mut Sheet,
    pos: Pos,
    old_code_cell_value: Option<CodeCellValue>,
    new_code_cell_value: Option<CodeCellValue>,
    summary_set: &mut Vec<JsRenderCellUpdate>,
    cells_to_compute: &mut Option<&mut Vec<CellRef>>,
) {
    let old_size = if let Some(old_code_cell_value) = old_code_cell_value {
        old_code_cell_value.output_size()
    } else {
        ArraySize::_1X1
    };
    let new_size = if let Some(new_code_cell_value) = new_code_cell_value {
        new_code_cell_value.output_size()
    } else {
        ArraySize::_1X1
    };

    if old_size.w > new_size.w {
        for x in new_size.w.get()..old_size.w.get() {
            let column_id = sheet.get_or_create_column(pos.x + x as i64).0.id;
            for y in 0..new_size.h.get() {
                let row_id = sheet.get_or_create_row(pos.y + y as i64).id;
                let pos = Pos {
                    x: pos.x + x as i64,
                    y: pos.y + y as i64,
                };
                let (numeric_format, numeric_decimals) = sheet.cell_numeric_info(pos);
                let value = sheet
                    .get_cell_value(pos)
                    .map(|value| value.to_display(numeric_format, numeric_decimals));
                summary_set.push(JsRenderCellUpdate {
                    x: pos.x,
                    y: pos.y,
                    update: JsRenderCellUpdateEnum::Value(value),
                });
                if let Some(cells_to_compute) = cells_to_compute {
                    cells_to_compute.push(CellRef {
                        sheet: sheet.id,
                        column: column_id,
                        row: row_id,
                    });
                }
            }
        }
    }
    if old_size.h > new_size.h {
        for x in 0..old_size.w.get() {
            let column_id = sheet.get_or_create_column(pos.x + x as i64).0.id;
            for y in new_size.h.get()..old_size.h.get() {
                let row_id = sheet.get_or_create_row(pos.y + y as i64).id;
                let pos = Pos {
                    x: pos.x + x as i64,
                    y: pos.y + y as i64,
                };
                // let (numeric_format, numeric_decimals) = sheet.cell_numeric_info(pos);
                let (numeric_format, numeric_decimals) = sheet.cell_numeric_info(pos);
                let value = sheet
                    .get_cell_value(pos)
                    .map(|value| value.to_display(numeric_format, numeric_decimals));
                summary_set.push(JsRenderCellUpdate {
                    x: pos.x,
                    y: pos.y,
                    update: JsRenderCellUpdateEnum::Value(value),
                });
                if let Some(cells_to_compute) = cells_to_compute {
                    cells_to_compute.push(CellRef {
                        sheet: sheet.id,
                        column: column_id,
                        row: row_id,
                    });
                }
            }
        }
    }
}

#[cfg(test)]
mod test {
    use crate::{
        controller::code_cell_update::fetch_code_cell_difference,
        grid::{CodeCellLanguage, CodeCellRunOutput, CodeCellValue, Sheet},
        Array, ArraySize, SheetPos, Value,
    };

    #[test]
    fn test_fetch_code_cell_difference() {
        let mut sheet = Sheet::test();
        let mut summary_set = Vec::new();

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
            }),
        });

        let sheet_pos = SheetPos {
            x: 0,
            y: 0,
            sheet_id: sheet.id,
        };

        fetch_code_cell_difference(
            &mut sheet,
            sheet_pos.into(),
            old.clone(),
            new_smaller,
            &mut summary_set,
            &mut None,
        );
        assert_eq!(summary_set.len(), 4);

        summary_set.clear();

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
            }),
        });

        super::fetch_code_cell_difference(
            &mut sheet,
            sheet_pos.into(),
            old,
            new_larger,
            &mut summary_set,
            &mut None,
        );
        assert_eq!(summary_set.len(), 0);
    }
}
