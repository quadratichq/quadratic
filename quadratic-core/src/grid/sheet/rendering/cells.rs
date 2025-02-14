use crate::{
    grid::{
        js_types::{JsNumber, JsRenderCell, JsRenderCellSpecial},
        CellAlign, CodeCellLanguage, DataTable, Format, Sheet,
    },
    CellValue, Pos, Rect, RunError, RunErrorMsg,
};

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
        value: &CellValue,
        mut format: Format,
        language: Option<CodeCellLanguage>,
        special: Option<JsRenderCellSpecial>,
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
            underline: format.underline,
            strike_through: format.strike_through,
        }
    }

    // Converts a CodeValue::Code and CodeRun into a vector of JsRenderCell.
    pub(crate) fn get_code_cells(
        &self,
        code: &CellValue,
        data_table: &DataTable,
        render_rect: &Rect,
        code_rect: &Rect,
    ) -> Vec<JsRenderCell> {
        let mut cells = vec![];

        if let Some(code_cell_value) = code.code_cell_value() {
            if data_table.spill_error {
                cells.push(self.get_render_cell(
                    code_rect.min.x,
                    code_rect.min.y,
                    &CellValue::Error(Box::new(RunError {
                        span: None,
                        msg: RunErrorMsg::Spill,
                    })),
                    Format::default(),
                    Some(code_cell_value.language),
                    None,
                ));
            } else if let Some(error) = data_table.get_error() {
                cells.push(self.get_render_cell(
                    code_rect.min.x,
                    code_rect.min.y,
                    &CellValue::Error(Box::new(error)),
                    Format::default(),
                    Some(code_cell_value.language),
                    None,
                ));
            } else {
                let code_rect_start_y = code_rect.min.y + data_table.y_adjustment(false);
                if let Some(intersection) = code_rect.intersection(render_rect) {
                    for x in intersection.x_range() {
                        for y in intersection.y_range() {
                            // We skip rendering the header rows because we render it separately.
                            if y < code_rect_start_y {
                                continue;
                            }

                            let pos = Pos {
                                x: x - code_rect.min.x,
                                y: y - code_rect.min.y,
                            };

                            let value = data_table.cell_value_at(pos.x as u32, pos.y as u32);

                            let format = data_table.try_format(pos).unwrap_or_default();

                            if let Some(value) = value {
                                let language = if x == code_rect.min.x && y == code_rect.min.y {
                                    Some(code_cell_value.language.to_owned())
                                } else {
                                    None
                                };
                                cells.push(
                                    self.get_render_cell(x, y, &value, format, language, None),
                                );
                            }
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
                column.values.range(rect.y_range()).for_each(|(&y, value)| {
                    // ignore code cells when rendering since they will be taken care in the next part
                    if !matches!(value, CellValue::Code(_) | CellValue::Import(_)) {
                        let context = self.a1_context();
                        let special = self
                            .validations
                            .render_special_pos(Pos { x, y }, &context)
                            .or({
                                if matches!(value, CellValue::Logical(_)) {
                                    Some(JsRenderCellSpecial::Logical)
                                } else {
                                    None
                                }
                            });

                        let format = self.formats.try_format(Pos { x, y }).unwrap_or_default();

                        render_cells.push(self.get_render_cell(x, y, value, format, None, special));
                    }
                });
            });

        // Fetch values from code cells
        self.iter_code_output_in_rect(rect)
            .for_each(|(data_table_rect, data_table)| {
                // sanity check that there is a CellValue::Code for this CodeRun
                if let Some(cell_value) = self.cell_value(Pos {
                    x: data_table_rect.min.x,
                    y: data_table_rect.min.y,
                }) {
                    render_cells.extend(self.get_code_cells(
                        &cell_value,
                        data_table,
                        &rect,
                        &data_table_rect,
                    ));
                }
            });

        // need a sheet-specific table map to get validations (since
        // validation.selection may have a reference to table w/in the sheet)
        let context = self.a1_context();

        // Populate validations for cells that are not yet in the render_cells
        self.validations
            .in_rect(rect, &context)
            .iter()
            .rev() // we need to reverse to ensure that later rules overwrite earlier ones
            .for_each(|validation| {
                if let Some(special) = validation.render_special() {
                    validation
                        .selection
                        .ranges
                        .iter()
                        .for_each(|validations_range| {
                            if let Some(validation_rect) = validations_range.to_rect(&context) {
                                validation_rect
                                    .iter()
                                    .filter(|pos| rect.contains(*pos))
                                    .for_each(|pos| {
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
                            }
                        });
                }
            });

        render_cells
    }
}

#[cfg(test)]
#[serial_test::parallel]
mod tests {
    use crate::{
        a1::A1Selection,
        controller::GridController,
        grid::{CellVerticalAlign, CellWrap, CodeCellValue, CodeRun, DataTableKind},
        wasm_bindings::js::{clear_js_calls, expect_js_call, hash_test},
        SheetPos, Value,
    };

    use serial_test::serial;

    use super::*;

    #[test]
    fn test_has_render_cells() {
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
        let code_run = CodeRun {
            std_err: None,
            std_out: None,
            cells_accessed: Default::default(),
            error: None,
            return_type: Some("text".into()),
            line_number: None,
            output_type: None,
        };
        sheet.set_data_table(
            Pos { x: 2, y: 3 },
            Some(DataTable::new(
                DataTableKind::CodeRun(code_run),
                "Table 1",
                Value::Single(CellValue::Text("hello".to_string())),
                false,
                false,
                true,
                None,
            )),
        );
        assert!(sheet.has_render_cells(rect));

        let selection = A1Selection::from_xy(2, 3, sheet_id);
        gc.delete_cells(&selection, None);
        let sheet = gc.sheet(sheet_id);
        assert!(!sheet.has_render_cells(rect));
    }

    #[test]
    fn test_get_render_cells() {
        let mut gc = GridController::test();
        let sheet_id = gc.sheet_ids()[0];

        let sheet = gc.sheet_mut(sheet_id);
        sheet.set_cell_value(Pos { x: 1, y: 2 }, CellValue::Text("test".to_string()));
        sheet.formats.bold.set(Pos { x: 1, y: 2 }, Some(true));
        sheet
            .formats
            .align
            .set(Pos { x: 1, y: 2 }, Some(CellAlign::Center));
        sheet
            .formats
            .vertical_align
            .set(Pos { x: 1, y: 2 }, Some(CellVerticalAlign::Middle));
        sheet
            .formats
            .wrap
            .set(Pos { x: 1, y: 2 }, Some(CellWrap::Wrap));
        sheet.set_cell_value(Pos { x: 1, y: 3 }, CellValue::Number(123.into()));
        sheet.formats.italic.set(Pos { x: 1, y: 3 }, Some(true));
        sheet.set_cell_value(Pos { x: 2, y: 4 }, CellValue::Html("html".to_string()));
        sheet.set_cell_value(Pos { x: 2, y: 5 }, CellValue::Logical(true));
        sheet.set_cell_value(
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
                wrap: Some(CellWrap::Clip),
                ..Default::default()
            }]
        );
    }

    #[test]
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
    fn render_cells_duration() {
        let mut gc = GridController::test();
        let sheet_id = gc.sheet_ids()[0];
        gc.set_cell_value((0, 0, sheet_id).into(), "1 week, 3 days".to_string(), None);
        gc.set_cell_value((0, 1, sheet_id).into(), "36 mo 500 ms".to_string(), None);
        gc.set_cell_value((0, 2, sheet_id).into(), "1 min, 10 ms".to_string(), None);
        gc.set_cell_value((0, 3, sheet_id).into(), "0.2 millisecond".to_string(), None);

        let sheet = gc.sheet(sheet_id);
        let rendering = sheet.get_render_cells(Rect {
            min: (0, 0).into(),
            max: (0, 3).into(),
        });
        assert_eq!(rendering[0].value, "10d");
        assert_eq!(rendering[1].value, "3y 0d 0h 0m 0.5s");
        assert_eq!(rendering[2].value, "1m 0.01s");
        assert_eq!(rendering[3].value, "200µs");
    }

    #[test]
    #[serial]
    fn render_bool_on_code_run() {
        clear_js_calls();

        let mut gc = GridController::test_with_viewport_buffer();
        let sheet_id = gc.sheet_ids()[0];

        gc.set_code_cell(
            (1, 1, sheet_id).into(),
            CodeCellLanguage::Formula,
            "{TRUE(), FALSE(), TRUE()}".into(),
            None,
        );
        let cells = vec![
            JsRenderCell {
                x: 1,
                y: 1,
                value: "true".to_string(),
                language: Some(CodeCellLanguage::Formula),
                wrap: Some(CellWrap::Clip),
                special: Some(JsRenderCellSpecial::Logical),
                ..Default::default()
            },
            JsRenderCell {
                x: 2,
                y: 1,
                value: "false".to_string(),
                wrap: Some(CellWrap::Clip),
                special: Some(JsRenderCellSpecial::Logical),
                ..Default::default()
            },
            JsRenderCell {
                x: 3,
                y: 1,
                value: "true".to_string(),
                wrap: Some(CellWrap::Clip),
                special: Some(JsRenderCellSpecial::Logical),
                ..Default::default()
            },
        ];
        let sheet = gc.sheet(sheet_id);
        let expected = sheet.get_render_cells(Rect::new(1, 1, 3, 1));

        println!("{:?}", expected);
        println!("{:?}", cells);

        assert_eq!(expected.len(), cells.len());
        assert!(expected.iter().all(|cell| cells.contains(cell)));

        let cells_string = serde_json::to_string(&cells).unwrap();
        expect_js_call(
            "jsRenderCellSheets",
            format!("{},{},{},{}", sheet_id, 0, 0, hash_test(&cells_string)),
            true,
        );
    }
}
