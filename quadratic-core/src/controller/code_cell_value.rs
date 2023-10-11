use crate::{
    grid::{
        js_types::{JsRenderCellUpdate, JsRenderCellUpdateEnum},
        CodeCellValue, Sheet,
    },
    ArraySize, Pos, Value,
};

use super::compute::SheetPos;

/// Fetches the difference between the old and new code cell values and updates the UI
fn fetch_code_cell_difference(
    sheet: &mut Sheet,
    sheet_pos: SheetPos,
    old_code_cell_value: Option<CodeCellValue>,
    new_code_cell_value: Option<CodeCellValue>,
    summary_set: &mut Vec<JsRenderCellUpdate>,
    cells_to_compute: &mut Vec<SheetPos>,
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
            for y in 0..new_size.h.get() {
                let pos = Pos {
                    x: sheet_pos.x + x as i64,
                    y: sheet_pos.y + y as i64,
                };
                let (numeric_format, numeric_decimals) = sheet.cell_numeric_info(pos);
                let value = if let Some(value) = sheet.get_cell_value(pos) {
                    Some(value.to_display(numeric_format, numeric_decimals))
                } else {
                    None
                };
                summary_set.push(JsRenderCellUpdate {
                    x: pos.x,
                    y: pos.y,
                    update: JsRenderCellUpdateEnum::Value(value),
                });
                cells_to_compute.push(SheetPos {
                    x: pos.x,
                    y: pos.y,
                    sheet_id: sheet.id,
                });
            }
        }
    }
    if old_size.h > new_size.h {
        for y in new_size.h.get()..old_size.h.get() {
            for x in 0..old_size.w.get() {
                let pos = Pos {
                    x: sheet_pos.x + x as i64,
                    y: sheet_pos.y + y as i64,
                };
                // let (numeric_format, numeric_decimals) = sheet.cell_numeric_info(pos);
                let (numeric_format, numeric_decimals) = sheet.cell_numeric_info(pos);
                let value = if let Some(value) = sheet.get_cell_value(pos) {
                    Some(value.to_display(numeric_format, numeric_decimals))
                } else {
                    None
                };
                summary_set.push(JsRenderCellUpdate {
                    x: pos.x,
                    y: pos.y,
                    update: JsRenderCellUpdateEnum::Value(value),
                });
                cells_to_compute.push(SheetPos {
                    x: pos.x,
                    y: pos.y,
                    sheet_id: sheet.id,
                });
            }
        }
    }
}

/// Sets the value of a code cell and returns the undo value, updates to the UI, and additions to the compute cycle
pub fn update_code_cell_value(
    sheet: &mut Sheet,
    pos: SheetPos,
    code_cell: Option<CodeCellValue>,
    summary_set: &mut Vec<JsRenderCellUpdate>,
    cells_to_compute: &mut Vec<SheetPos>,
) -> Option<CodeCellValue> {
    let old_code_cell_value = sheet.set_code_cell_value(pos.into(), code_cell.clone());
    if let Some(code_cell) = code_cell.clone() {
        if let Some(output) = code_cell.output {
            match output.result.output_value() {
                Some(output_value) => {
                    match output_value {
                        Value::Array(array) => {
                            for y in 0..array.size().h.into() {
                                for x in 0..array.size().w.into() {
                                    // add all but the first cell to the compute cycle
                                    if x != 0 && y != 0 {
                                        cells_to_compute.push(SheetPos {
                                            x: pos.x + x as i64,
                                            y: pos.y + y as i64,
                                            sheet_id: sheet.id,
                                        });
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
                                                value.to_display(numeric_format, numeric_decimals),
                                            )),
                                        })
                                    }
                                }
                            }
                        }
                        Value::Single(value) => {
                            let (numeric_format, numeric_decimals) =
                                sheet.cell_numeric_info(pos.into());
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
                        update: JsRenderCellUpdateEnum::Value(Some("Error!".into())),
                    });
                    summary_set.push(JsRenderCellUpdate {
                        x: pos.x,
                        y: pos.y,
                        update: JsRenderCellUpdateEnum::TextColor(Some("red".into())),
                    });
                    summary_set.push(JsRenderCellUpdate {
                        x: pos.x,
                        y: pos.y,
                        update: JsRenderCellUpdateEnum::Bold(Some(true)),
                    });
                }
            };
        }
    }
    fetch_code_cell_difference(
        sheet,
        pos,
        old_code_cell_value.clone(),
        code_cell,
        summary_set,
        cells_to_compute,
    );
    old_code_cell_value
}

#[cfg(test)]
mod test {
    use crate::{
        controller::compute::SheetPos,
        grid::{CodeCellLanguage, CodeCellRunOutput, CodeCellValue, Sheet},
        Array, ArraySize, Value,
    };

    #[test]
    fn test_fetch_code_cell_difference() {
        let mut sheet = Sheet::test();
        let mut summary_set = Vec::new();
        let mut cells_to_compute = Vec::new();

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

        super::fetch_code_cell_difference(
            &mut sheet,
            sheet_pos.clone(),
            old.clone(),
            new_smaller,
            &mut summary_set,
            &mut cells_to_compute,
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
            sheet_pos,
            old,
            new_larger,
            &mut summary_set,
            &mut cells_to_compute,
        );
        assert_eq!(summary_set.len(), 0);
    }
}
