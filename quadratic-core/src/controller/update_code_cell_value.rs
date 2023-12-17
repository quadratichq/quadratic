use std::ops::Range;

use crate::{
    controller::{
        operations::operation::Operation, transaction_summary::CellSheetsModified, GridController,
    },
    grid::CodeCellValue,
    Pos, Rect, SheetPos, SheetRect, Value,
};

impl GridController {
    /// updates code cell value
    /// returns true if the code cell was successful
    pub fn update_code_cell_value(
        &mut self,
        sheet_pos: SheetPos,
        updated_code_cell_value: Option<CodeCellValue>,
    ) -> bool {
        assert!(self.transaction_in_progress);
        let mut success = false;
        self.summary.save = true;
        let sheet_id = sheet_pos.sheet_id;
        let sheet = self.grid.sheet_mut_from_id(sheet_id);

        let pos = sheet_pos.into();
        let old_code_cell_value = sheet.get_code_cell(pos);
        if old_code_cell_value.is_some_and(|code_cell_value| {
            code_cell_value
                .get_output_value(0, 0)
                .is_some_and(|cell_value| cell_value.is_html())
        }) {
            self.summary.html.insert(sheet.id);
        }
        let mut spill = false;
        if let Some(updated_code_cell_value) = updated_code_cell_value.clone() {
            if let Some(output) = updated_code_cell_value.output {
                match output.result.output_value() {
                    Some(output_value) => {
                        success = true;
                        match output_value {
                            Value::Array(array) => {
                                if sheet.is_ok_to_spill_in(pos, array.size()) {
                                    self.summary.cell_sheets_modified.insert(
                                        CellSheetsModified::new(SheetPos {
                                            sheet_id: sheet.id,
                                            x: pos.x,
                                            y: pos.y,
                                        }),
                                    );
                                    spill = true;
                                } else {
                                    spill = false;
                                    for x in 0..array.width() {
                                        for y in 0..array.height() {
                                            self.summary.cell_sheets_modified.insert(
                                                CellSheetsModified::new(SheetPos {
                                                    sheet_id,
                                                    x: pos.x,
                                                    y: pos.y + y as i64,
                                                }),
                                            );
                                            if x != 0 || y != 0 {
                                                self.cells_to_compute.insert(SheetPos {
                                                    x: pos.x + x as i64,
                                                    y: pos.y + y as i64,
                                                    sheet_id,
                                                });
                                            }
                                        }
                                    }
                                }
                            }
                            Value::Single(value) => {
                                spill = false;
                                self.summary
                                    .cell_sheets_modified
                                    .insert(CellSheetsModified::new(sheet_pos));
                                if value.is_html() {
                                    self.summary.html.insert(sheet.id);
                                }
                            }
                        };
                    }
                    None => {
                        self.summary
                            .cell_sheets_modified
                            .insert(CellSheetsModified::new(sheet_pos));
                    }
                };
            }
        }

        let updated_code_cell_value = updated_code_cell_value.map(|mut cell_value| {
            if spill {
                // spill can only be set if updated_code_cell value is not None
                if let Some(output) = cell_value.output.as_mut() {
                    output.spill = true;
                }
            } else if cell_value.has_spill_error() {
                if let Some(output) = cell_value.output.as_mut() {
                    output.spill = false;
                }
            }
            cell_value
        });

        let old_code_cell_value = sheet.set_code_cell_value(pos, updated_code_cell_value.clone());

        // updates summary.thumbnail_dirty flag
        if let Some(updated_code_cell_value) = updated_code_cell_value.as_ref() {
            if let Some(output) = updated_code_cell_value.output.as_ref() {
                match output.result.output_value() {
                    Some(output_value) => {
                        match output_value {
                            Value::Array(array) => {
                                self.summary.generate_thumbnail = self.summary.generate_thumbnail
                                    || self.thumbnail_dirty_sheet_rect(SheetRect::new_pos_span(
                                        pos,
                                        Pos {
                                            x: pos.x + array.width() as i64,
                                            y: pos.y + array.height() as i64,
                                        },
                                        sheet_id,
                                    ));
                            }
                            Value::Single(_) => {
                                self.summary.generate_thumbnail = self.summary.generate_thumbnail
                                    || self.thumbnail_dirty_sheet_pos(sheet_pos);
                            }
                        };
                    }
                    None => {
                        self.summary.generate_thumbnail = self.summary.generate_thumbnail
                            || self.thumbnail_dirty_sheet_pos(sheet_pos);
                    }
                }
            }
        }

        self.fetch_code_cell_difference(
            sheet_pos,
            old_code_cell_value.clone(),
            updated_code_cell_value.clone(),
        );

        self.forward_operations.push(Operation::SetCellCode {
            sheet_pos,
            code_cell_value: updated_code_cell_value,
        });

        self.reverse_operations.push(Operation::SetCellCode {
            sheet_pos,
            code_cell_value: old_code_cell_value,
        });

        self.summary.code_cells_modified.insert(sheet_id);

        self.check_spill(sheet_pos);

        success
    }

    /// Fetches the difference between the old and new code cell values and updates the UI
    #[allow(clippy::too_many_arguments)]
    pub fn fetch_code_cell_difference(
        &mut self,
        sheet_pos: SheetPos,
        old_code_cell_value: Option<CodeCellValue>,
        new_code_cell_value: Option<CodeCellValue>,
    ) {
        assert!(self.transaction_in_progress);
        let sheet_id = sheet_pos.sheet_id;
        let sheet = self.grid.sheet_mut_from_id(sheet_id);
        let mut possible_spills = vec![];

        let (old_w, old_h) = old_code_cell_value.map_or((1, 1), |code_cell_value| {
            if code_cell_value.is_html() {
                self.summary.html.insert(sheet_id);
            }
            if code_cell_value.has_spill_error() {
                (1, 1)
            } else {
                code_cell_value.output_size().into()
            }
        });

        let (new_w, new_h) = new_code_cell_value.map_or((0, 0), |code_cell_value| {
            if code_cell_value.is_html() {
                self.summary.html.insert(sheet_id);
            }
            if code_cell_value.has_spill_error() {
                (1, 1)
            } else {
                code_cell_value.output_size().into()
            }
        });

        if old_w > new_w {
            for x in new_w..old_w {
                // the columnId necessarily exists since this is just a diff operation
                let column = sheet.get_or_create_column(sheet_pos.x + x);

                // remove any spills created by the updated code_cell
                for y in sheet_pos.y..=sheet_pos.y + old_h {
                    if let Some(spill) = column.spills.get(y) {
                        if spill == sheet_pos.into() {
                            column.spills.set(y, None);
                        }
                    }
                }

                column.spills.remove_range(Range {
                    start: sheet_pos.y,
                    end: sheet_pos.y + new_h + 1,
                });
                for y in 0..new_h {
                    let sheet_pos_entry = SheetPos {
                        sheet_id,
                        x,
                        y: sheet_pos.y + y,
                    };
                    self.cells_to_compute.insert(sheet_pos_entry);
                    if y <= old_h {
                        possible_spills.push(sheet_pos_entry);
                    }
                }
            }
        }

        if old_h > new_h {
            for x in 0..old_w {
                // the columnId necessarily exists since this is just a diff operation
                let column = sheet.get_or_create_column(sheet_pos.x + x);

                // remove any spills created by the updated code_cell
                for y in sheet_pos.y + new_h..=sheet_pos.y + old_h {
                    if let Some(spill) = column.spills.get(y) {
                        if spill == sheet_pos.into() {
                            column.spills.set(y, None);
                        }
                    }
                }

                for y in new_h..old_h {
                    // the rowId necessarily exists since this is just a diff operation
                    let sheet_pos_entry = SheetPos {
                        sheet_id,
                        x,
                        y: sheet_pos.y + y,
                    };
                    self.cells_to_compute.insert(sheet_pos_entry);
                    possible_spills.push(sheet_pos_entry);
                }
            }
        }

        let rect = Rect::new_span(
            sheet_pos.into(),
            Pos {
                x: sheet_pos.x + new_w.max(old_w),
                y: sheet_pos.y + new_h.max(old_h),
            },
        );
        rect.iter().for_each(|pos| {
            self.summary
                .cell_sheets_modified
                .insert(CellSheetsModified::new(pos.to_sheet_pos(sheet_id)));
        });

        self.summary
            .cell_sheets_modified
            .insert(CellSheetsModified::new(sheet_pos));

        // check for released spills
        possible_spills.iter().for_each(|cell_ref| {
            self.update_code_cell_value_if_spill_error_released(*cell_ref);
        });
    }
}

#[cfg(test)]
mod test {
    use std::collections::HashSet;

    use crate::{
        controller::GridController,
        grid::{CodeCellLanguage, CodeCellRunOutput, CodeCellValue},
        Array, ArraySize, CellValue, Pos, SheetPos, Value,
    };

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
                    cells_accessed: HashSet::new(),
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
                    cells_accessed: HashSet::new(),
                },
                spill: false,
            }),
        });

        let sheet_pos = SheetPos {
            x: 0,
            y: 0,
            sheet_id: sheet.id,
        };

        gc.transaction_in_progress = true;
        gc.fetch_code_cell_difference(sheet_pos, old.clone(), new_smaller);
        assert_eq!(gc.summary.cell_sheets_modified.len(), 1);

        gc.summary.clear(false);

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
                spill: false,
            }),
        });

        gc.fetch_code_cell_difference(sheet_pos, old, new_larger);
        assert_eq!(gc.summary.cell_sheets_modified.len(), 1);
    }

    #[test]
    fn test_spilled_output_over_normal_cell() {
        let mut gc = GridController::new();
        let sheet_id = gc.sheet_ids()[0];
        let sheet = gc.grid.sheet_mut_from_id(sheet_id);
        let _ = sheet.set_cell_value(Pos { x: 0, y: 1 }, CellValue::Text("test".into()));

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
                    cells_accessed: HashSet::new(),
                },
                spill: false,
            }),
        });

        gc.transaction_in_progress = true;
        gc.update_code_cell_value(
            SheetPos {
                x: 0,
                y: 0,
                sheet_id,
            },
            code_cell_output.clone(),
        );

        let sheet = gc.grid.sheet_from_id(sheet_id);
        let code_cell = sheet.get_code_cell(Pos { x: 0, y: 0 });
        assert!(code_cell.unwrap().has_spill_error());
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
                    cells_accessed: HashSet::new(),
                },
                spill: false,
            }),
        });

        let original = SheetPos {
            x: 0,
            y: 1,
            sheet_id,
        };
        gc.transaction_in_progress = true;
        gc.update_code_cell_value(original, code_cell_output.clone());

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
                    cells_accessed: HashSet::new(),
                },
                spill: false,
            }),
        });

        let sheet_pos = SheetPos {
            x: 0,
            y: 0,
            sheet_id,
        };

        gc.update_code_cell_value(sheet_pos, code_cell_output.clone());

        let sheet = gc.grid.sheet_from_id(sheet_id);
        let code_cell = sheet.get_code_cell(Pos { x: 0, y: 0 });
        assert!(code_cell.unwrap().has_spill_error());
        assert_eq!(
            sheet.get_column(0).unwrap().spills.get(0),
            Some(sheet_pos.into())
        );
        assert_eq!(
            sheet.get_column(0).unwrap().spills.get(1),
            Some(original.into())
        );
    }
}
