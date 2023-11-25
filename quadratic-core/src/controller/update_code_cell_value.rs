use std::ops::Range;

use indexmap::IndexSet;

use crate::{
    controller::{
        operation::Operation,
        transaction_summary::{CellSheetsModified, TransactionSummary},
        GridController,
    },
    grid::{CodeCellValue, Sheet},
    Pos, SheetPos, SheetRect, Value,
};

/// updates code cell value
/// returns true if the code cell was successful
pub fn update_code_cell_value(
    grid_controller: &mut GridController,
    sheet_pos: SheetPos,
    updated_code_cell_value: Option<CodeCellValue>,
    cells_to_compute: &mut IndexSet<SheetPos>,
    reverse_operations: &mut Vec<Operation>,
    summary: &mut TransactionSummary,
) -> bool {
    let mut success = false;
    summary.save = true;
    let sheet = grid_controller.grid.sheet_mut_from_id(sheet_pos.sheet_id);
    let old_code_cell_value =
        sheet.set_code_cell_value(sheet_pos.into(), updated_code_cell_value.clone());
    if let Some(updated_code_cell_value) = updated_code_cell_value.clone() {
        if let Some(output) = updated_code_cell_value.output {
            match output.result.output_value() {
                Some(output_value) => {
                    success = true;
                    match output_value {
                        Value::Array(array) => {
                            for x in 0..array.width() {
                                for y in 0..array.height() {
                                    summary.cell_sheets_modified.insert(CellSheetsModified::new(
                                        SheetPos {
                                            x: sheet_pos.x,
                                            y: sheet_pos.y + y as i64,
                                            sheet_id: sheet.id,
                                        },
                                    ));
                                    // add all but the first cell to the compute cycle
                                    if x != 0 || y != 0 {
                                        cells_to_compute.insert(sheet_pos);
                                    }
                                }
                            }
                        }
                        Value::Single(_) => {
                            summary
                                .cell_sheets_modified
                                .insert(CellSheetsModified::new(sheet_pos));
                        }
                    };
                }
                None => {
                    summary
                        .cell_sheets_modified
                        .insert(CellSheetsModified::new(sheet_pos));
                }
            };
        }
    }

    // updates summary.thumbnail_dirty flag
    let sheet = grid_controller.grid.sheet_from_id(sheet_pos.sheet_id);
    if let Some(updated_code_cell_value) = updated_code_cell_value.as_ref() {
        if let Some(output) = updated_code_cell_value.output.as_ref() {
            match output.result.output_value() {
                Some(output_value) => {
                    match output_value {
                        Value::Array(array) => {
                            summary.generate_thumbnail = summary.generate_thumbnail
                                || grid_controller.thumbnail_dirty_rect(SheetRect::new_span(
                                    sheet_pos,
                                    SheetPos {
                                        x: sheet_pos.x + array.width() as i64,
                                        y: sheet_pos.y + array.height() as i64,
                                        sheet_id: sheet.id,
                                    },
                                ));
                        }
                        Value::Single(_) => {
                            summary.generate_thumbnail = summary.generate_thumbnail
                                || grid_controller.thumbnail_dirty_pos(sheet_pos);
                        }
                    };
                }
                None => {
                    summary.generate_thumbnail = summary.generate_thumbnail
                        || grid_controller.thumbnail_dirty_pos(sheet_pos);
                }
            }
        }
    }

    let sheet = grid_controller.grid.sheet_mut_from_id(sheet_pos.sheet_id);
    fetch_code_cell_difference(
        sheet,
        sheet_pos.into(),
        old_code_cell_value.clone(),
        updated_code_cell_value,
        summary,
        cells_to_compute,
    );

    reverse_operations.push(Operation::SetCellCode {
        sheet_pos,
        code_cell_value: old_code_cell_value,
    });
    summary.code_cells_modified.insert(sheet.id);

    success
}

/// Fetches the difference between the old and new code cell values and updates the UI
pub fn fetch_code_cell_difference(
    sheet: &mut Sheet,
    pos: Pos,
    old_code_cell_value: Option<CodeCellValue>,
    new_code_cell_value: Option<CodeCellValue>,
    summary: &mut TransactionSummary,
    cells_to_compute: &mut IndexSet<SheetPos>,
) {
    let (old_w, old_h) = if let Some(old_code_cell_value) = old_code_cell_value {
        let size = old_code_cell_value.output_size();
        (size.w.get(), size.h.get())
    } else {
        (0, 0)
    };
    let (new_w, new_h) = if let Some(new_code_cell_value) = new_code_cell_value {
        let size = new_code_cell_value.output_size();
        (size.w.get(), size.h.get())
    } else {
        (0, 0)
    };

    if old_w > new_w {
        for x in new_w..old_w {
            let column = sheet.get_or_create_column(pos.x + x as i64);

            // todo: temporary way of cleaning up deleted spills. There needs to be a spill checker here....
            column.spills.remove_range(Range {
                start: pos.y,
                end: pos.y + new_h as i64 + 1,
            });
            for y in 0..new_h {
                let pos = Pos {
                    x: pos.x + x as i64,
                    y: pos.y + y as i64,
                };
                summary
                    .cell_sheets_modified
                    .insert(CellSheetsModified::new(pos.to_sheet_pos(sheet.id)));
                cells_to_compute.insert(SheetPos {
                    x: x as i64,
                    y: y as i64,
                    sheet_id: sheet.id,
                });
            }
        }
    }
    if old_h > new_h {
        for x in 0..old_w {
            let column = sheet.get_or_create_column(pos.x + x as i64);

            // todo: temporary way of cleaning up deleted spills. There needs to be a spill checker here....
            column.spills.remove_range(Range {
                start: pos.y + new_h as i64,
                end: pos.y + old_h as i64 + 1,
            });
            for y in new_h..old_h {
                let pos = Pos {
                    x: pos.x + x as i64,
                    y: pos.y + y as i64,
                };
                summary
                    .cell_sheets_modified
                    .insert(CellSheetsModified::new(pos.to_sheet_pos(sheet.id)));
                cells_to_compute.insert(SheetPos {
                    x: x as i64,
                    y: y as i64,
                    sheet_id: sheet.id,
                });
            }
        }
    }
}

#[cfg(test)]
mod test {
    use std::collections::HashSet;

    use indexmap::IndexSet;

    use crate::{
        controller::{
            transaction_summary::TransactionSummary,
            update_code_cell_value::fetch_code_cell_difference,
        },
        grid::{CodeCellLanguage, CodeCellRunOutput, CodeCellValue, Sheet},
        Array, ArraySize, SheetPos, Value,
    };

    #[test]
    fn test_fetch_code_cell_difference() {
        let mut sheet = Sheet::test();

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
                    cells_accessed: HashSet::new(),
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
                    cells_accessed: HashSet::new(),
                },
            }),
        });

        let sheet_pos = SheetPos {
            x: 0,
            y: 0,
            sheet_id: sheet.id,
        };

        let mut summary = TransactionSummary::default();

        let mut cells_to_compute = IndexSet::new();

        fetch_code_cell_difference(
            &mut sheet,
            sheet_pos.into(),
            old.clone(),
            new_smaller,
            &mut summary,
            &mut cells_to_compute,
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
                    cells_accessed: HashSet::new(),
                },
            }),
        });

        super::fetch_code_cell_difference(
            &mut sheet,
            sheet_pos.into(),
            old,
            new_larger,
            &mut summary,
            &mut cells_to_compute,
        );
        assert_eq!(summary.cell_sheets_modified.len(), 0);
    }
}
