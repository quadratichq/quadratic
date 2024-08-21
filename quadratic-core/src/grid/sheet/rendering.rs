use code_run::CodeRunResult;

use crate::{
    controller::transaction_summary::{CELL_SHEET_HEIGHT, CELL_SHEET_WIDTH},
    grid::{
        borders::{get_render_horizontal_borders, get_render_vertical_borders},
        code_run,
        formats::format::Format,
        js_types::{
            JsHtmlOutput, JsNumber, JsRenderBorders, JsRenderCell, JsRenderCellSpecial,
            JsRenderCodeCell, JsRenderCodeCellState, JsRenderFill, JsSheetFill,
            JsValidationWarning,
        },
        CellAlign, CodeCellLanguage, CodeRun, Column,
    },
    CellValue, Pos, Rect, RunError, RunErrorMsg,
};

use super::Sheet;

impl Sheet {
    /// checks columns for any column that has data that might render
    pub fn has_render_cells(&self, rect: Rect) -> bool {
        self.columns.range(rect.x_range()).any(|(_, column)| {
            column
                .values
                .iter()
                .any(|(y, _)| rect.y_range().contains(y))
        }) || self.iter_code_output_in_rect(rect).count() > 0
    }

    /// creates a render for a single cell
    fn get_render_cell(
        &self,
        x: i64,
        y: i64,
        column: Option<&Column>,
        value: &CellValue,
        language: Option<CodeCellLanguage>,
    ) -> JsRenderCell {
        if let CellValue::Html(_) = value {
            return JsRenderCell {
                x,
                y,
                language,
                special: Some(JsRenderCellSpecial::Chart),
                ..Default::default()
            };
        } else if let CellValue::Error(error) = value {
            let spill_error = matches!(error.msg, RunErrorMsg::Spill);
            return JsRenderCell {
                x,
                y,
                language,
                special: Some(if spill_error {
                    JsRenderCellSpecial::SpillError
                } else {
                    JsRenderCellSpecial::RunError
                }),
                ..Default::default()
            };
        } else if let CellValue::Image(_) = value {
            return JsRenderCell {
                x,
                y,
                language,
                special: Some(JsRenderCellSpecial::Chart),
                ..Default::default()
            };
        }

        let align = if matches!(value, CellValue::Number(_))
            || matches!(value, CellValue::DateTime(_))
            || matches!(value, CellValue::Date(_))
            || matches!(value, CellValue::Time(_))
        {
            Some(CellAlign::Right)
        } else {
            None
        };
        let special = self.validations.render_special_pos(Pos { x, y }).or({
            if matches!(value, CellValue::Logical(_)) {
                Some(JsRenderCellSpecial::Logical)
            } else {
                None
            }
        });

        match column {
            None => {
                let format = Format::combine(
                    None,
                    self.try_format_column(x).as_ref(),
                    self.try_format_row(y).as_ref(),
                    self.format_all.as_ref(),
                );
                let align = format.align.or(align);
                let number: Option<JsNumber> = if matches!(value, CellValue::Number(_)) {
                    Some((&format).into())
                } else {
                    None
                };
                let value = Self::value_date_time(value, format.date_time);
                JsRenderCell {
                    x,
                    y,
                    value,
                    language,
                    align,
                    vertical_align: format.vertical_align,
                    wrap: format.wrap,
                    bold: format.bold,
                    italic: format.italic,
                    text_color: format.text_color,
                    special,
                    number,
                }
            }
            Some(column) => {
                let format_cell = column.format(y);
                let mut format = Format::combine(
                    format_cell.as_ref(),
                    self.try_format_column(x).as_ref(),
                    self.try_format_row(y).as_ref(),
                    self.format_all.as_ref(),
                );
                let mut number: Option<JsNumber> = None;
                let value = match &value {
                    CellValue::Number(_) => {
                        // get numeric_format and numeric_decimal to turn number into a string
                        // if align is not set, set it to right only for numbers
                        format.align = format.align.or(Some(CellAlign::Right));
                        number = Some((&format).into());
                        value.to_display()
                    }
                    CellValue::Date(_) | CellValue::DateTime(_) | CellValue::Time(_) => {
                        Self::value_date_time(value, format.date_time)
                    }
                    _ => value.to_display(),
                };
                JsRenderCell {
                    x,
                    y,
                    value,
                    language,
                    align: format.align.or(align),
                    wrap: format.wrap,
                    bold: format.bold,
                    italic: format.italic,
                    text_color: format.text_color,
                    vertical_align: format.vertical_align,
                    special,
                    number,
                }
            }
        }
    }

    // Converts a CodeValue::Code and CodeRun into a vector of JsRenderCell.
    fn get_code_cells(
        &self,
        code: &CellValue,
        run: &CodeRun,
        output_rect: &Rect,
        code_rect: &Rect,
    ) -> Vec<JsRenderCell> {
        let mut cells = vec![];
        if let CellValue::Code(code) = code {
            if run.spill_error {
                cells.push(self.get_render_cell(
                    code_rect.min.x,
                    code_rect.min.y,
                    None,
                    &CellValue::Error(Box::new(RunError {
                        span: None,
                        msg: RunErrorMsg::Spill,
                    })),
                    Some(code.language.to_owned()),
                ));
            } else if let Some(error) = run.get_error() {
                cells.push(self.get_render_cell(
                    code_rect.min.x,
                    code_rect.min.y,
                    None,
                    &CellValue::Error(Box::new(error)),
                    Some(code.language.to_owned()),
                ));
            } else {
                // find overlap of code_rect into rect
                let x_start = if code_rect.min.x > output_rect.min.x {
                    code_rect.min.x
                } else {
                    output_rect.min.x
                };
                let x_end = if code_rect.max.x > output_rect.max.x {
                    output_rect.max.x
                } else {
                    code_rect.max.x
                };
                let y_start = if code_rect.min.y > output_rect.min.y {
                    code_rect.min.y
                } else {
                    output_rect.min.y
                };
                let y_end = if code_rect.max.y > output_rect.max.y {
                    output_rect.max.y
                } else {
                    code_rect.max.y
                };
                for x in x_start..=x_end {
                    let column = self.get_column(x);
                    for y in y_start..=y_end {
                        let value = run.cell_value_at(
                            (x - code_rect.min.x) as u32,
                            (y - code_rect.min.y) as u32,
                        );
                        if let Some(value) = value {
                            let language = if x == code_rect.min.x && y == code_rect.min.y {
                                Some(code.language.to_owned())
                            } else {
                                None
                            };
                            cells.push(self.get_render_cell(x, y, column, &value, language));
                        }
                    }
                }
            }
        }
        cells
    }

    /// Returns cell data in a format useful for rendering. This includes only
    /// the data necessary to render raw text values.
    pub fn get_render_cells(&self, rect: Rect) -> Vec<JsRenderCell> {
        let mut render_cells = vec![];

        // Fetch ordinary value cells.
        rect.x_range()
            .filter_map(|x| Some((x, self.get_column(x)?)))
            .for_each(|(x, column)| {
                column.values.range(rect.y_range()).for_each(|(y, value)| {
                    // ignore code cells when rendering since they will be taken care in the next part
                    if !matches!(value, CellValue::Code(_)) {
                        render_cells.push(self.get_render_cell(x, *y, Some(column), value, None));
                    }
                });
            });

        // Fetch values from code cells
        self.iter_code_output_in_rect(rect)
            .for_each(|(code_rect, code_run)| {
                // sanity check that there is a CellValue::Code for this CodeRun
                if let Some(code) = self.cell_value(Pos {
                    x: code_rect.min.x,
                    y: code_rect.min.y,
                }) {
                    render_cells.extend(self.get_code_cells(&code, code_run, &rect, &code_rect));
                }
            });

        // Populate validations for cells that are not yet in the render_cells
        self.validations
            .in_rect(rect)
            .iter()
            .rev() // we need to reverse to ensure that later rules overwrite earlier ones
            .for_each(|validation| {
                if let Some(special) = validation.render_special() {
                    if let Some(rects) = validation.selection.rects.as_ref() {
                        rects.iter().for_each(|r| {
                            r.iter().filter(|pos| rect.contains(*pos)).for_each(|pos| {
                                if !render_cells
                                    .iter()
                                    .any(|cell| cell.x == pos.x && cell.y == pos.y)
                                {
                                    render_cells.push(JsRenderCell {
                                        x: pos.x,
                                        y: pos.y,
                                        special: Some(special.clone()),
                                        ..Default::default()
                                    });
                                }
                            });
                        });
                    }
                }
            });
        render_cells
    }

    pub fn get_single_html_output(&self, pos: Pos) -> Option<JsHtmlOutput> {
        let run = self.code_runs.get(&pos)?;
        if !run.is_html() {
            return None;
        }
        let (w, h) = if let Some(render_size) = self.render_size(pos) {
            (Some(render_size.w), Some(render_size.h))
        } else {
            (None, None)
        };
        let output = run.cell_value_at(0, 0)?;
        Some(JsHtmlOutput {
            sheet_id: self.id.to_string(),
            x: pos.x,
            y: pos.y,
            html: Some(output.to_display()),
            w,
            h,
        })
    }

    pub fn get_html_output(&self) -> Vec<JsHtmlOutput> {
        self.code_runs
            .iter()
            .filter_map(|(pos, run)| {
                let output = run.cell_value_at(0, 0)?;
                if !matches!(output, CellValue::Html(_)) {
                    return None;
                }
                let (w, h) = if let Some(render_size) = self.render_size(*pos) {
                    (Some(render_size.w), Some(render_size.h))
                } else {
                    (None, None)
                };
                Some(JsHtmlOutput {
                    sheet_id: self.id.to_string(),
                    x: pos.x,
                    y: pos.y,
                    html: Some(output.to_display()),
                    w,
                    h,
                })
            })
            .collect()
    }

    /// Returns all data for rendering cell fill color.
    pub fn get_all_render_fills(&self) -> Vec<JsRenderFill> {
        let mut ret = vec![];
        for (&x, column) in self.columns.iter() {
            for block in column.fill_color.blocks() {
                ret.push(JsRenderFill {
                    x,
                    y: block.y,
                    w: 1,
                    h: block.len() as u32,
                    color: block.content().value.clone(),
                });
            }
        }
        ret
    }

    /// Returns all fills for the rows, columns, and sheet. This does not return
    /// individual cell formats.
    pub fn get_sheet_fills(&self) -> JsSheetFill {
        let columns = self
            .formats_columns
            .iter()
            .filter_map(|(x, (format, timestamp))| {
                format
                    .fill_color
                    .as_ref()
                    .map(|color| (*x, (color.clone(), *timestamp)))
            })
            .collect();
        let rows = self
            .formats_rows
            .iter()
            .filter_map(|(y, (format, timestamp))| {
                format
                    .fill_color
                    .as_ref()
                    .map(|color| (*y, (color.clone(), *timestamp)))
            })
            .collect();
        let all = self.format_all().fill_color.clone();
        JsSheetFill { columns, rows, all }
    }

    pub fn get_render_code_cell(&self, pos: Pos) -> Option<JsRenderCodeCell> {
        let run = self.code_runs.get(&pos)?;
        let code = self.cell_value(pos)?;
        let output_size = run.output_size();
        let (state, w, h, spill_error) = if run.spill_error {
            let reasons = self.find_spill_error_reasons(&run.output_rect(pos, true), pos);
            (
                JsRenderCodeCellState::SpillError,
                output_size.w.get(),
                output_size.h.get(),
                Some(reasons),
            )
        } else {
            match run.result {
                CodeRunResult::Ok(_) => (
                    JsRenderCodeCellState::Success,
                    output_size.w.get(),
                    output_size.h.get(),
                    None,
                ),
                CodeRunResult::Err(_) => (JsRenderCodeCellState::RunError, 1, 1, None),
            }
        };
        Some(JsRenderCodeCell {
            x: pos.x as i32,
            y: pos.y as i32,
            w,
            h,
            language: match code {
                CellValue::Code(code) => code.language,
                _ => return None,
            },
            state,
            spill_error,
        })
    }

    /// Returns data for all rendering code cells
    pub fn get_all_render_code_cells(&self) -> Vec<JsRenderCodeCell> {
        self.code_runs
            .iter()
            .filter_map(|(pos, run)| {
                if let Some(code) = self.cell_value(*pos) {
                    match &code {
                        CellValue::Code(code) => {
                            let output_size = run.output_size();
                            let (state, w, h, spill_error) = if run.spill_error {
                                let reasons = self
                                    .find_spill_error_reasons(&run.output_rect(*pos, true), *pos);
                                (
                                    JsRenderCodeCellState::SpillError,
                                    output_size.w.get(),
                                    output_size.h.get(),
                                    Some(reasons),
                                )
                            } else {
                                match run.result {
                                    CodeRunResult::Ok(_) => (
                                        JsRenderCodeCellState::Success,
                                        output_size.w.get(),
                                        output_size.h.get(),
                                        None,
                                    ),
                                    CodeRunResult::Err(_) => {
                                        (JsRenderCodeCellState::RunError, 1, 1, None)
                                    }
                                }
                            };
                            Some(JsRenderCodeCell {
                                x: pos.x as i32,
                                y: pos.y as i32,
                                w,
                                h,
                                language: code.language.to_owned(),
                                state,
                                spill_error,
                            })
                        }
                        _ => None, // this should not happen. A CodeRun should always have a CellValue::Code.
                    }
                } else {
                    None // this should not happen. A CodeRun should always have a CellValue::Code.
                }
            })
            .collect()
    }

    /// Returns borders to render in a sheet.
    pub fn render_borders(&self) -> JsRenderBorders {
        JsRenderBorders {
            horizontal: get_render_horizontal_borders(self),
            vertical: get_render_vertical_borders(self),
        }
    }

    /// Send images in this sheet to the client. Note: we only have images
    /// inside CodeRuns. We may open this up in the future to allow images to be
    /// placed directly on the grid without a CodeRun. In that case, we'll need
    /// to search the columns for images as well.
    pub fn send_all_images(&self) {
        if !cfg!(target_family = "wasm") && !cfg!(test) {
            return;
        }

        self.code_runs.iter().for_each(|(pos, run)| {
            if let Some(CellValue::Image(image)) = run.cell_value_at(0, 0) {
                let (w, h) = if let Some(render_size) = self.render_size(*pos) {
                    (Some(render_size.w), Some(render_size.h))
                } else {
                    (None, None)
                };
                crate::wasm_bindings::js::jsSendImage(
                    self.id.to_string(),
                    pos.x as i32,
                    pos.y as i32,
                    Some(image),
                    w,
                    h,
                );
            }
        });
    }

    /// Sends all validations for this sheet to the client.
    pub fn send_all_validations(&self) {
        if let Ok(validations) = serde_json::to_string(&self.validations.validations) {
            crate::wasm_bindings::js::jsSheetValidations(self.id.to_string(), validations);
        }
    }

    /// Sends all validation warnings for this sheet to the client.
    pub fn send_all_validation_warnings(&self) {
        let warnings = self
            .validations
            .warnings
            .iter()
            .map(|(pos, validation_id)| JsValidationWarning {
                x: pos.x,
                y: pos.y,
                validation: Some(*validation_id),
                style: self
                    .validations
                    .validation(*validation_id)
                    .map(|v| v.error.style.clone()),
            })
            .collect::<Vec<_>>();

        if let Ok(warnings) = serde_json::to_string(&warnings) {
            crate::wasm_bindings::js::jsValidationWarning(self.id.to_string(), warnings);
        }
    }

    /// Sends validation warnings for a hashed region to the client.
    pub fn send_validation_warnings(&self, hash_x: i64, hash_y: i64, rect: Rect) {
        let warnings = self
            .validations
            .warnings
            .iter()
            .filter_map(|(pos, validation_id)| {
                if rect.contains(*pos) {
                    let validation = self.validations.validation(*validation_id)?;
                    Some(JsValidationWarning {
                        x: pos.x,
                        y: pos.y,
                        validation: Some(*validation_id),
                        style: Some(validation.error.style.clone()),
                    })
                } else {
                    None
                }
            })
            .collect::<Vec<_>>();

        if let Ok(warnings) = serde_json::to_string(&warnings) {
            crate::wasm_bindings::js::jsRenderValidationWarnings(
                self.id.to_string(),
                hash_x,
                hash_y,
                warnings,
            );
        }
    }

    /// Sends validation warnings as a response from the request from the
    /// client. Note, the client always requests hash-sized rects.
    pub fn send_validation_warnings_rect(&self, rect: Rect) {
        let hash_x = rect.min.x / CELL_SHEET_WIDTH as i64;
        let hash_y = rect.min.y / CELL_SHEET_HEIGHT as i64;
        self.send_validation_warnings(hash_x, hash_y, rect);
    }
}

#[cfg(test)]
mod tests {
    use std::collections::HashSet;

    use chrono::Utc;
    use serial_test::{parallel, serial};
    use uuid::Uuid;

    use crate::{
        controller::{transaction_types::JsCodeResult, GridController},
        grid::{
            formats::{format::Format, format_update::FormatUpdate, Formats},
            js_types::{
                JsHtmlOutput, JsNumber, JsRenderCell, JsRenderCellSpecial, JsRenderCodeCell,
                JsSheetFill, JsValidationWarning,
            },
            sheet::validations::{
                validation::{Validation, ValidationStyle},
                validation_rules::{validation_logical::ValidationLogical, ValidationRule},
            },
            Bold, CellAlign, CellVerticalAlign, CellWrap, CodeCellLanguage, CodeRun, CodeRunResult,
            Italic, RenderSize, Sheet,
        },
        selection::Selection,
        wasm_bindings::js::{expect_js_call, expect_js_call_count, hash_test},
        CellValue, CodeCellValue, Pos, Rect, RunError, RunErrorMsg, SheetPos, Value,
    };

    #[test]
    #[parallel]
    fn has_render_cells() {
        let mut gc = GridController::test();
        let sheet_id = gc.sheet_ids()[0];
        let sheet = gc.sheet_mut(sheet_id);

        let rect = Rect {
            min: Pos { x: 0, y: 0 },
            max: Pos { x: 100, y: 100 },
        };
        assert!(!sheet.has_render_cells(rect));

        let _ = sheet.set_cell_value(Pos { x: 1, y: 2 }, CellValue::Text("test".to_string()));
        assert!(sheet.has_render_cells(rect));

        sheet.delete_cell_values(Rect::single_pos(Pos { x: 1, y: 2 }));
        assert!(!sheet.has_render_cells(rect));

        sheet.set_cell_value(
            Pos { x: 2, y: 3 },
            CellValue::Code(CodeCellValue {
                language: CodeCellLanguage::Python,
                code: "1 + 1".to_string(),
            }),
        );
        sheet.set_code_run(
            Pos { x: 2, y: 3 },
            Some(CodeRun {
                formatted_code_string: None,
                std_err: None,
                std_out: None,
                spill_error: false,
                cells_accessed: HashSet::new(),
                result: CodeRunResult::Ok(Value::Single(CellValue::Text("hello".to_string()))),
                return_type: Some("text".into()),
                line_number: None,
                output_type: None,
                last_modified: Utc::now(),
            }),
        );
        assert!(sheet.has_render_cells(rect));

        let selection = Selection::pos(2, 3, sheet_id);
        gc.delete_cells(&selection, None);
        let sheet = gc.sheet(sheet_id);
        assert!(!sheet.has_render_cells(rect));
    }

    #[test]
    #[parallel]
    fn test_get_render_cells() {
        let mut gc = GridController::test();
        let sheet_id = gc.sheet_ids()[0];

        let sheet = gc.sheet_mut(sheet_id);
        let _ = sheet.set_cell_value(Pos { x: 1, y: 2 }, CellValue::Text("test".to_string()));
        let _ = sheet.set_formatting_value::<Bold>(Pos { x: 1, y: 2 }, Some(true));
        let _ =
            sheet.set_formatting_value::<CellAlign>(Pos { x: 1, y: 2 }, Some(CellAlign::Center));
        let _ = sheet.set_formatting_value::<CellVerticalAlign>(
            Pos { x: 1, y: 2 },
            Some(CellVerticalAlign::Middle),
        );
        let _ = sheet.set_formatting_value::<CellWrap>(Pos { x: 1, y: 2 }, Some(CellWrap::Wrap));
        let _ = sheet.set_cell_value(Pos { x: 1, y: 3 }, CellValue::Number(123.into()));
        let _ = sheet.set_formatting_value::<Italic>(Pos { x: 1, y: 3 }, Some(true));
        let _ = sheet.set_cell_value(Pos { x: 2, y: 4 }, CellValue::Html("html".to_string()));
        let _ = sheet.set_cell_value(Pos { x: 2, y: 5 }, CellValue::Logical(true));
        let _ = sheet.set_cell_value(
            Pos { x: 2, y: 6 },
            CellValue::Error(Box::new(RunError {
                span: None,
                msg: RunErrorMsg::Spill,
            })),
        );
        let _ = sheet.set_cell_value(
            Pos { x: 3, y: 3 },
            CellValue::Error(Box::new(RunError {
                span: None,
                msg: crate::RunErrorMsg::ArrayTooBig,
            })),
        );

        let render = sheet.get_render_cells(Rect {
            min: Pos { x: 0, y: 0 },
            max: Pos { x: 10, y: 10 },
        });
        assert_eq!(render.len(), 6);

        let get = |x: i64, y: i64| -> Option<&JsRenderCell> {
            render.iter().find(|r| r.x == x && r.y == y)
        };

        assert_eq!(get(0, 0), None);

        assert_eq!(
            *get(1, 2).unwrap(),
            JsRenderCell {
                x: 1,
                y: 2,
                value: "test".to_string(),
                align: Some(CellAlign::Center),
                vertical_align: Some(CellVerticalAlign::Middle),
                wrap: Some(CellWrap::Wrap),
                bold: Some(true),
                ..Default::default()
            },
        );
        assert_eq!(
            *get(1, 3).unwrap(),
            JsRenderCell {
                x: 1,
                y: 3,
                value: "123".to_string(),
                align: Some(CellAlign::Right),
                italic: Some(true),
                number: Some(JsNumber::default()),
                ..Default::default()
            },
        );
        assert_eq!(
            *get(2, 4).unwrap(),
            JsRenderCell {
                x: 2,
                y: 4,
                special: Some(JsRenderCellSpecial::Chart),
                ..Default::default()
            },
        );
        assert_eq!(
            *get(2, 5).unwrap(),
            JsRenderCell {
                x: 2,
                y: 5,
                value: "true".to_string(),
                special: Some(JsRenderCellSpecial::Logical),
                ..Default::default()
            },
        );
        assert_eq!(
            *get(2, 6).unwrap(),
            JsRenderCell {
                x: 2,
                y: 6,
                special: Some(JsRenderCellSpecial::SpillError),
                ..Default::default()
            },
        );
        assert_eq!(
            *get(3, 3).unwrap(),
            JsRenderCell {
                x: 3,
                y: 3,
                special: Some(JsRenderCellSpecial::RunError),
                ..Default::default()
            },
        );
    }

    #[test]
    #[parallel]
    fn test_get_html_output() {
        let mut gc = GridController::test();
        let sheet_id = gc.sheet_ids()[0];
        gc.set_code_cell(
            SheetPos {
                x: 1,
                y: 2,
                sheet_id,
            },
            CodeCellLanguage::Python,
            "<html></html>".to_string(),
            None,
        );
        let transaction_id = gc.async_transactions()[0].id;
        gc.calculation_complete(JsCodeResult::new(
            transaction_id.to_string(),
            true,
            None,
            None,
            Some(vec!["<html></html>".into(), "text".into()]),
            None,
            None,
            None,
            None,
        ))
        .ok();
        let sheet = gc.sheet(sheet_id);
        let render_cells = sheet.get_html_output();
        assert_eq!(render_cells.len(), 1);
        assert_eq!(
            render_cells[0],
            JsHtmlOutput {
                sheet_id: sheet.id.to_string(),
                x: 1,
                y: 2,
                html: Some("<html></html>".to_string()),
                w: None,
                h: None,
            }
        );
        gc.set_cell_render_size(
            SheetPos {
                x: 1,
                y: 2,
                sheet_id,
            }
            .into(),
            Some(RenderSize {
                w: "1".into(),
                h: "2".into(),
            }),
            None,
        );
        let sheet = gc.sheet(sheet_id);
        let render_cells = sheet.get_html_output();
        assert_eq!(render_cells.len(), 1);
        assert_eq!(
            render_cells[0],
            JsHtmlOutput {
                sheet_id: sheet.id.to_string(),
                x: 1,
                y: 2,
                html: Some("<html></html>".to_string()),
                w: Some("1".into()),
                h: Some("2".into()),
            }
        );
    }

    #[test]
    #[parallel]
    fn test_get_code_cells() {
        let sheet = Sheet::test();
        let code_cell = CellValue::Code(CodeCellValue {
            language: CodeCellLanguage::Python,
            code: "".to_string(),
        });

        // code_run is always 3x2
        let code_run = CodeRun {
            std_out: None,
            std_err: None,
            formatted_code_string: None,
            last_modified: Utc::now(),
            cells_accessed: HashSet::new(),
            result: CodeRunResult::Ok(Value::Array(
                vec![vec!["1", "2", "3"], vec!["4", "5", "6"]].into(),
            )),
            return_type: Some("text".into()),
            spill_error: false,
            line_number: None,
            output_type: None,
        };

        // render rect is larger than code rect
        let code_cells = sheet.get_code_cells(
            &code_cell,
            &code_run,
            &Rect::from_numbers(0, 0, 10, 10),
            &Rect::from_numbers(5, 5, 3, 2),
        );
        assert_eq!(code_cells.len(), 6);
        assert_eq!(code_cells[0].value, "1".to_string());
        assert_eq!(code_cells[0].language, Some(CodeCellLanguage::Python));
        assert_eq!(code_cells[0].number, None);
        assert_eq!(code_cells[5].value, "6".to_string());
        assert_eq!(code_cells[5].language, None);

        // code rect overlaps render rect to the top-left
        let code_cells = sheet.get_code_cells(
            &code_cell,
            &code_run,
            &Rect::from_numbers(2, 1, 10, 10),
            &Rect::from_numbers(0, 0, 3, 2),
        );
        assert_eq!(code_cells.len(), 1);
        assert_eq!(code_cells[0].value, "6".to_string());
        assert_eq!(code_cells[0].language, None);

        // code rect overlaps render rect to the bottom-right
        let code_cells = sheet.get_code_cells(
            &code_cell,
            &code_run,
            &Rect::from_numbers(0, 0, 3, 2),
            &Rect::from_numbers(2, 1, 10, 10),
        );
        assert_eq!(code_cells.len(), 1);
        assert_eq!(code_cells[0].value, "1".to_string());
        assert_eq!(code_cells[0].language, Some(CodeCellLanguage::Python));

        let code_run = CodeRun {
            std_out: None,
            std_err: None,
            formatted_code_string: None,
            last_modified: Utc::now(),
            cells_accessed: HashSet::new(),
            result: CodeRunResult::Ok(Value::Single(CellValue::Number(1.into()))),
            return_type: Some("number".into()),
            spill_error: false,
            line_number: None,
            output_type: None,
        };
        let code_cells = sheet.get_code_cells(
            &code_cell,
            &code_run,
            &Rect::from_numbers(0, 0, 10, 10),
            &Rect::from_numbers(5, 5, 1, 1),
        );
        assert_eq!(code_cells[0].value, "1".to_string());
        assert_eq!(code_cells[0].language, Some(CodeCellLanguage::Python));
        assert_eq!(
            code_cells[0].number,
            Some(JsNumber {
                decimals: None,
                commas: None,
                format: None
            })
        );
    }

    #[test]
    #[parallel]
    fn test_get_render_cells_code() {
        let mut gc = GridController::test();
        let sheet_id = gc.sheet_ids()[0];

        gc.set_code_cell(
            SheetPos {
                x: 1,
                y: 2,
                sheet_id,
            },
            CodeCellLanguage::Formula,
            "1 + 1".to_string(),
            None,
        );
        assert_eq!(
            gc.sheet(sheet_id)
                .get_render_cells(Rect::from_numbers(1, 2, 1, 1)),
            vec![JsRenderCell {
                x: 1,
                y: 2,
                value: "2".to_string(),
                language: Some(CodeCellLanguage::Formula),
                align: Some(CellAlign::Right),
                number: Some(JsNumber::default()),
                ..Default::default()
            }]
        );
    }

    #[test]
    #[parallel]
    fn render_cells_boolean() {
        let mut gc = GridController::test();
        let sheet_id = gc.sheet_ids()[0];
        gc.set_cell_value((0, 0, sheet_id).into(), "true".to_string(), None);
        gc.set_cell_value((1, 1, sheet_id).into(), "false".to_string(), None);
        gc.set_cell_value((2, 2, sheet_id).into(), "TRUE".to_string(), None);
        gc.set_cell_value((3, 3, sheet_id).into(), "FALSE".to_string(), None);
        gc.set_cell_value((4, 4, sheet_id).into(), "tRUE".to_string(), None);
        gc.set_cell_value((5, 5, sheet_id).into(), "fALSE".to_string(), None);

        let sheet = gc.sheet(sheet_id);
        let rendering = sheet.get_render_cells(Rect {
            min: (0, 0).into(),
            max: (5, 5).into(),
        });
        for (i, rendering) in rendering.iter().enumerate().take(5 + 1) {
            if i % 2 == 0 {
                assert_eq!(rendering.value, "true".to_string());
            } else {
                assert_eq!(rendering.value, "false".to_string());
            }
            assert_eq!(rendering.special, Some(JsRenderCellSpecial::Logical));
        }
    }

    #[test]
    #[parallel]
    fn render_code_cell() {
        let mut gc = GridController::test();
        let sheet_id = gc.sheet_ids()[0];
        let sheet = gc.sheet_mut(sheet_id);
        let pos = (0, 0).into();
        let code = CellValue::Code(CodeCellValue {
            language: CodeCellLanguage::Python,
            code: "1 + 1".to_string(),
        });
        let run = CodeRun {
            std_out: None,
            std_err: None,
            formatted_code_string: None,
            last_modified: Utc::now(),
            cells_accessed: HashSet::new(),
            result: CodeRunResult::Ok(Value::Single(CellValue::Number(2.into()))),
            return_type: Some("number".into()),
            spill_error: false,
            line_number: None,
            output_type: None,
        };
        sheet.set_code_run(pos, Some(run));
        sheet.set_cell_value(pos, code);
        let rendering = sheet.get_render_code_cell(pos);
        assert_eq!(
            rendering,
            Some(JsRenderCodeCell {
                x: 0,
                y: 0,
                w: 1,
                h: 1,
                language: CodeCellLanguage::Python,
                state: crate::grid::js_types::JsRenderCodeCellState::Success,
                spill_error: None,
            })
        );
    }

    #[test]
    #[serial]
    fn render_images() {
        let mut gc = GridController::test();
        let sheet_id = gc.sheet_ids()[0];

        // ensure nothing is sent when no images are in the sheet
        let sheet = gc.sheet(sheet_id);
        sheet.send_all_images();
        expect_js_call_count("jsSendImage", 0, false);

        // add an image to a code run and then send it to the client
        let sheet = gc.sheet_mut(sheet_id);
        let pos = (0, 0).into();
        let image = "image".to_string();
        let code = CellValue::Image(image.clone());
        let run = CodeRun {
            std_out: None,
            std_err: None,
            formatted_code_string: None,
            last_modified: Utc::now(),
            cells_accessed: HashSet::new(),
            result: CodeRunResult::Ok(Value::Single(CellValue::Image(image.clone()))),
            return_type: Some("image".into()),
            spill_error: false,
            line_number: None,
            output_type: None,
        };
        sheet.set_code_run(pos, Some(run));
        sheet.set_cell_value(pos, code);
        sheet.send_all_images();
        expect_js_call(
            "jsSendImage",
            format!(
                "{},{},{},{:?},{:?},{:?}",
                sheet_id, pos.x as u32, pos.y as u32, true, None::<String>, None::<String>
            ),
            true,
        );
    }

    #[test]
    #[serial]
    fn render_bool_on_code_run() {
        let mut gc = GridController::test();
        let sheet_id = gc.sheet_ids()[0];

        gc.set_code_cell(
            (0, 0, sheet_id).into(),
            CodeCellLanguage::Formula,
            "{TRUE(), FALSE(), TRUE()}".into(),
            None,
        );
        let cells = vec![
            JsRenderCell {
                x: 0,
                y: 0,
                value: "true".to_string(),
                language: Some(CodeCellLanguage::Formula),
                special: Some(JsRenderCellSpecial::Logical),
                ..Default::default()
            },
            JsRenderCell {
                x: 1,
                y: 0,
                value: "false".to_string(),
                special: Some(JsRenderCellSpecial::Logical),
                ..Default::default()
            },
            JsRenderCell {
                x: 2,
                y: 0,
                value: "true".to_string(),
                special: Some(JsRenderCellSpecial::Logical),
                ..Default::default()
            },
        ];
        let sheet = gc.sheet(sheet_id);
        let expected = sheet.get_render_cells(Rect::new(0, 0, 2, 0));
        dbg!(&expected);
        dbg!(&cells);
        assert_eq!(expected.len(), cells.len());
        assert!(expected.iter().all(|cell| cells.contains(cell)));

        let cells_string = serde_json::to_string(&cells).unwrap();
        expect_js_call(
            "jsRenderCellSheets",
            format!("{},{},{},{}", sheet_id, 0, 0, hash_test(&cells_string)),
            true,
        );
    }

    #[test]
    #[parallel]
    fn get_sheet_fills() {
        let mut sheet = Sheet::test();
        assert_eq!(sheet.get_sheet_fills(), JsSheetFill::default());

        sheet.format_all = Some(Format {
            fill_color: Some("red".to_string()),
            ..Default::default()
        });
        assert_eq!(
            sheet.get_sheet_fills(),
            JsSheetFill {
                all: Some("red".to_string()),
                ..Default::default()
            }
        );

        let mut sheet = Sheet::test();
        sheet.set_formats_columns(
            &[1],
            &Formats::repeat(
                FormatUpdate {
                    fill_color: Some(Some("blue".to_string())),
                    ..Default::default()
                },
                1,
            ),
        );
        let fills = sheet.get_sheet_fills();
        assert_eq!(fills.columns.len(), 1);
        assert_eq!(fills.columns[0].1 .0, "blue".to_string());

        sheet.set_formats_rows(
            &[-5],
            &Formats::repeat(
                FormatUpdate {
                    fill_color: Some(Some("red".to_string())),
                    ..Default::default()
                },
                1,
            ),
        );

        let fills = sheet.get_sheet_fills();
        assert_eq!(fills.columns.len(), 1);
        assert_eq!(fills.columns[0].1 .0, "blue".to_string());
        assert_eq!(fills.rows.len(), 1);
        assert_eq!(fills.rows[0].1 .0, "red".to_string());
    }

    #[test]
    #[parallel]
    fn validation_list() {
        let mut sheet = Sheet::test();
        sheet.validations.set(Validation {
            id: Uuid::new_v4(),
            selection: Selection::rect(Rect::new(0, 0, 1, 1), sheet.id),
            rule: ValidationRule::Logical(ValidationLogical {
                show_checkbox: true,
                ignore_blank: true,
            }),
            message: Default::default(),
            error: Default::default(),
        });
        let render = sheet.get_render_cells(Rect::single_pos((0, 0).into()));
        assert_eq!(render.len(), 1);
    }

    #[test]
    #[serial]
    fn send_all_validations() {
        let mut gc = GridController::test();
        let sheet_id = gc.sheet_ids()[0];
        let sheet = gc.sheet_mut(sheet_id);
        sheet.validations.set(Validation {
            id: Uuid::new_v4(),
            selection: Selection::rect(Rect::new(0, 0, 1, 1), sheet_id),
            rule: ValidationRule::Logical(ValidationLogical {
                show_checkbox: true,
                ignore_blank: true,
            }),
            message: Default::default(),
            error: Default::default(),
        });
        sheet.send_all_validations();
        let validations = serde_json::to_string(&sheet.validations.validations).unwrap();
        expect_js_call(
            "jsSheetValidations",
            format!("{},{}", sheet.id, validations),
            true,
        );
    }

    #[test]
    #[serial]
    fn send_all_validation_warnings() {
        let mut sheet = Sheet::test();
        let sheet_id = sheet.id;
        let validation_id = Uuid::new_v4();
        sheet.validations.set(Validation {
            id: validation_id,
            selection: Selection::rect(Rect::new(0, 0, 1, 1), sheet_id),
            rule: ValidationRule::Logical(ValidationLogical {
                ignore_blank: false,
                ..Default::default()
            }),
            message: Default::default(),
            error: Default::default(),
        });
        sheet
            .validations
            .warnings
            .insert((0, 0).into(), validation_id);
        sheet.send_all_validation_warnings();
        let warnings = serde_json::to_string(&vec![JsValidationWarning {
            x: 0,
            y: 0,
            validation: Some(validation_id),
            style: Some(ValidationStyle::Stop),
        }])
        .unwrap();
        expect_js_call(
            "jsValidationWarning",
            format!("{},{}", sheet.id, warnings),
            true,
        );
    }
}
