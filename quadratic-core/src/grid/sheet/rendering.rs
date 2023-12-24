use crate::{
    grid::{
        borders::{get_render_horizontal_borders, get_render_vertical_borders},
        js_types::{
            JsHtmlOutput, JsRenderBorder, JsRenderCell, JsRenderCodeCell, JsRenderCodeCellState,
            JsRenderFill,
        },
        CellAlign, CodeCellLanguage, CodeCellRunResult, Column, NumericFormatKind,
    },
    CellValue, Error, ErrorMsg, Pos, Rect,
};

use super::Sheet;

impl Sheet {
    /// checks columns for any column that has data that might render
    pub fn has_render_cells(&self, rect: Rect) -> bool {
        self.columns
            .range(rect.x_range())
            .any(|(_, column)| column.values.has_blocks_in_range(rect.y_range()))
            || self.iter_code_output_in_rect(rect).count() > 0
    }

    /// creates a render for a single cell
    fn get_render_cell(
        &self,
        x: i64,
        y: i64,
        column: Option<&Column>,
        value: CellValue,
        language: Option<CodeCellLanguage>,
    ) -> JsRenderCell {
        if let CellValue::Html(_) = value {
            return JsRenderCell {
                x,
                y,
                value: " CHART".to_string(),
                language,
                align: None,
                wrap: None,
                bold: None,
                italic: Some(true),
                // from colors.ts: colors.languagePython
                text_color: Some(String::from("#3776ab")),
            };
        } else if let CellValue::Error(error) = value {
            let value = match error.msg {
                ErrorMsg::Spill => " SPILL",
                _ => " ERROR",
            };
            return JsRenderCell {
                x,
                y,
                value: value.into(),
                language,
                align: None,
                wrap: None,
                bold: None,
                italic: Some(true),
                text_color: Some(String::from("red")),
            };
        }

        match column {
            None => JsRenderCell {
                x,
                y,
                value: value.to_display(None, None, None),
                language,
                align: None,
                wrap: None,
                bold: None,
                italic: None,
                text_color: None,
            },
            Some(column) => {
                let mut align: Option<CellAlign> = column.align.get(y);
                let wrap = column.wrap.get(y);
                let bold = column.bold.get(y);
                let italic = column.italic.get(y);
                let text_color = column.text_color.get(y);
                let value = if matches!(value, CellValue::Number(_)) {
                    // get numeric_format and numeric_decimal to turn number into a string
                    let numeric_format = column.numeric_format.get(y);
                    let is_percentage = numeric_format.as_ref().is_some_and(|numeric_format| {
                        numeric_format.kind == NumericFormatKind::Percentage
                    });
                    let numeric_decimals = self.decimal_places(Pos { x, y }, is_percentage);
                    let numeric_commas = column.numeric_commas.get(y);

                    // if align is not set, set it to right only for numbers
                    align = align.or(Some(CellAlign::Right));

                    value.to_display(numeric_format, numeric_decimals, numeric_commas)
                } else {
                    value.to_display(None, None, None)
                };
                JsRenderCell {
                    x,
                    y,
                    value,
                    language,
                    align,
                    wrap,
                    bold,
                    italic,
                    text_color,
                }
            }
        }
    }

    /// Returns cell data in a format useful for rendering. This includes only
    /// the data necessary to render raw text values.
    pub fn get_render_cells(&self, rect: Rect) -> Vec<JsRenderCell> {
        let columns_iter = rect
            .x_range()
            .filter_map(|x| Some((x, self.get_column(x)?)));

        let mut render_cells = vec![];

        // Fetch ordinary value cells.
        columns_iter.clone().for_each(|(x, column)| {
            column
                .values
                .values_in_range(rect.y_range())
                .for_each(|(y, value)| {
                    render_cells.push(self.get_render_cell(x, y, Some(column), value, None));
                });
        });

        // Fetch values from code cells
        self.iter_code_output_in_rect(rect)
            .for_each(|(code_rect, code_cell_value)| {
                if code_cell_value.has_spill_error() {
                    render_cells.push(self.get_render_cell(
                        code_rect.min.x,
                        code_rect.min.y,
                        None,
                        CellValue::Error(Box::new(Error {
                            span: None,
                            msg: ErrorMsg::Spill,
                        })),
                        None,
                    ));
                } else if let Some(error) = code_cell_value.get_error() {
                    render_cells.push(self.get_render_cell(
                        code_rect.min.x,
                        code_rect.min.y,
                        None,
                        CellValue::Error(Box::new(error)),
                        None,
                    ));
                } else {
                    // find overlap of code_rect into rect
                    let x_start = if rect.min.x < code_rect.min.x {
                        code_rect.min.x
                    } else {
                        rect.min.x
                    };
                    let x_end = if rect.max.x > code_rect.max.x {
                        code_rect.max.x
                    } else {
                        rect.max.x
                    };
                    let y_start = if rect.min.y < code_rect.min.y {
                        code_rect.min.y
                    } else {
                        rect.min.y
                    };
                    let y_end = if rect.max.y > code_rect.max.y {
                        code_rect.max.y
                    } else {
                        rect.max.y
                    };
                    for x in x_start..=x_end {
                        let column = self.get_column(x);
                        for y in y_start..=y_end {
                            let value = code_cell_value
                                .get_output_value((x - x_start) as u32, (y - y_start) as u32);
                            if let Some(value) = value {
                                let language = if x == code_rect.min.x && y == code_rect.min.y {
                                    Some(code_cell_value.language)
                                } else {
                                    None
                                };
                                render_cells
                                    .push(self.get_render_cell(x, y, column, value, language));
                            }
                        }
                    }
                }
            });
        render_cells
    }

    pub fn get_html_output(&self) -> Vec<JsHtmlOutput> {
        self.code_cells
            .iter()
            .filter_map(|(pos, code_cell_value)| {
                let output = code_cell_value.get_output_value(0, 0)?;
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
                    html: output.to_display(None, None, None),
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
    /// Returns data for rendering cell fill color.
    pub fn get_render_fills(&self, region: Rect) -> Vec<JsRenderFill> {
        let mut ret = vec![];
        for (&x, column) in self.columns.range(region.x_range()) {
            for block in column.fill_color.blocks_covering_range(region.y_range()) {
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

    /// Returns data for all rendering code cells
    pub fn get_all_render_code_cells(&self) -> Vec<JsRenderCodeCell> {
        self.code_cells
            .iter()
            .map(|(pos, code_cell)| {
                let output_size = code_cell.output_size();

                let (state, w, h) = match &code_cell.output {
                    Some(output) => match &output.result {
                        CodeCellRunResult::Ok { .. } => {
                            if output.spill {
                                (JsRenderCodeCellState::SpillError, 1, 1)
                            } else {
                                (
                                    JsRenderCodeCellState::Success,
                                    output_size.w.get(),
                                    output_size.h.get(),
                                )
                            }
                        }
                        CodeCellRunResult::Err { .. } => (JsRenderCodeCellState::RunError, 1, 1),
                    },
                    None => (JsRenderCodeCellState::NotYetRun, 1, 1),
                };
                JsRenderCodeCell {
                    x: pos.x,
                    y: pos.y,
                    w,
                    h,
                    language: code_cell.language,
                    state,
                }
            })
            .collect()
    }

    /// Returns data for rendering horizontal borders.
    pub fn get_render_horizontal_borders(&self) -> Vec<JsRenderBorder> {
        get_render_horizontal_borders(self)
    }

    /// Returns data for rendering vertical borders.
    pub fn get_render_vertical_borders(&self) -> Vec<JsRenderBorder> {
        get_render_vertical_borders(self)
    }
}

#[cfg(test)]
mod tests {
    use std::collections::HashSet;

    use crate::{
        controller::{transaction_types::JsCodeResult, GridController},
        grid::{
            js_types::{JsHtmlOutput, JsRenderCell},
            Bold, CellAlign, CodeCellLanguage, CodeCellRunOutput, CodeCellRunResult, CodeCellValue,
            Italic, RenderSize,
        },
        CellValue, Error, ErrorMsg, Pos, Rect, SheetPos, Value,
    };

    #[test]
    fn test_has_render_cells() {
        let mut gc = GridController::new();
        let sheet_id = gc.sheet_ids()[0];
        let sheet = gc.grid_mut().sheet_mut_from_id(sheet_id);

        let rect = Rect {
            min: Pos { x: 0, y: 0 },
            max: Pos { x: 100, y: 100 },
        };
        assert!(!sheet.has_render_cells(rect));

        let _ = sheet.set_cell_value(Pos { x: 1, y: 2 }, CellValue::Text("test".to_string()));
        assert!(sheet.has_render_cells(rect));

        sheet.delete_cell_values(Rect::single_pos(Pos { x: 1, y: 2 }));
        assert!(!sheet.has_render_cells(rect));

        sheet.set_code_cell(
            Pos { x: 2, y: 3 },
            Some(CodeCellValue {
                language: crate::grid::CodeCellLanguage::Python,
                code_string: "print('hello')".to_string(),
                formatted_code_string: None,
                output: Some(CodeCellRunOutput {
                    result: CodeCellRunResult::Ok {
                        output_value: Value::Single(CellValue::Text("hello".to_string())),
                        cells_accessed: HashSet::new(),
                    },
                    std_err: None,
                    std_out: None,
                    spill: false,
                }),
                last_modified: "".into(),
            }),
        );
        assert!(sheet.has_render_cells(rect));

        gc.delete_cells_rect(
            SheetPos {
                x: 2,
                y: 3,
                sheet_id,
            }
            .into(),
            None,
        );
        let sheet = gc.sheet(sheet_id);
        assert!(!sheet.has_render_cells(rect));
    }

    #[test]
    fn test_get_render_cells() {
        let mut gc = GridController::new();
        let sheet_id = gc.sheet_ids()[0];

        let sheet = gc.grid_mut().sheet_mut_from_id(sheet_id);
        let _ = sheet.set_cell_value(Pos { x: 1, y: 2 }, CellValue::Text("test".to_string()));
        let _ = sheet.set_formatting_value::<Bold>(Pos { x: 1, y: 2 }, Some(true));
        let _ =
            sheet.set_formatting_value::<CellAlign>(Pos { x: 1, y: 2 }, Some(CellAlign::Center));
        let _ = sheet.set_cell_value(Pos { x: 1, y: 3 }, CellValue::Number(123.into()));
        let _ = sheet.set_formatting_value::<Italic>(Pos { x: 1, y: 3 }, Some(true));
        let _ = sheet.set_cell_value(Pos { x: 2, y: 4 }, CellValue::Html("html".to_string()));
        let _ = sheet.set_cell_value(Pos { x: 2, y: 5 }, CellValue::Logical(true));
        let _ = sheet.set_cell_value(
            Pos { x: 2, y: 6 },
            CellValue::Error(Box::new(Error {
                span: None,
                msg: ErrorMsg::Spill,
            })),
        );
        let _ = sheet.set_cell_value(
            Pos { x: 3, y: 3 },
            CellValue::Error(Box::new(Error {
                span: None,
                msg: crate::ErrorMsg::ArrayTooBig,
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
                language: None,
                align: Some(CellAlign::Center),
                wrap: None,
                bold: Some(true),
                italic: None,
                text_color: None,
            },
        );
        assert_eq!(
            *get(1, 3).unwrap(),
            JsRenderCell {
                x: 1,
                y: 3,
                value: "123".to_string(),
                language: None,
                align: Some(CellAlign::Right),
                wrap: None,
                bold: None,
                italic: Some(true),
                text_color: None,
            },
        );
        assert_eq!(
            *get(2, 4).unwrap(),
            JsRenderCell {
                x: 2,
                y: 4,
                value: " CHART".to_string(),
                language: None,
                align: None,
                wrap: None,
                bold: None,
                italic: Some(true),
                text_color: Some("#3776ab".to_string()),
            },
        );
        assert_eq!(
            *get(2, 5).unwrap(),
            JsRenderCell {
                x: 2,
                y: 5,
                value: "true".to_string(),
                language: None,
                align: None,
                wrap: None,
                bold: None,
                italic: None,
                text_color: None,
            },
        );
        assert_eq!(
            *get(2, 6).unwrap(),
            JsRenderCell {
                x: 2,
                y: 6,
                value: " SPILL".to_string(),
                language: None,
                align: None,
                wrap: None,
                bold: None,
                italic: Some(true),
                text_color: Some("red".to_string()),
            },
        );
        assert_eq!(
            *get(3, 3).unwrap(),
            JsRenderCell {
                x: 3,
                y: 3,
                value: " ERROR".to_string(),
                language: None,
                align: None,
                wrap: None,
                bold: None,
                italic: Some(true),
                text_color: Some("red".to_string()),
            },
        );
    }

    #[test]
    fn test_get_html_output() {
        let mut gc = GridController::new();
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
        gc.after_calculation_async(JsCodeResult::new(
            true,
            None,
            None,
            None,
            Some("<html></html>".into()),
            None,
            None,
            None,
        ));
        let sheet = gc.sheet(sheet_id);
        let render_cells = sheet.get_html_output();
        assert_eq!(render_cells.len(), 1);
        assert_eq!(
            render_cells[0],
            JsHtmlOutput {
                sheet_id: sheet.id.to_string(),
                x: 1,
                y: 2,
                html: "<html></html>".to_string(),
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
                html: "<html></html>".to_string(),
                w: Some("1".into()),
                h: Some("2".into()),
            }
        );
    }
}
