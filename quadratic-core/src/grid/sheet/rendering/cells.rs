use crate::{
    CellValue, Pos, Rect, RunError, RunErrorMsg,
    a1::A1Context,
    grid::{
        CellAlign, CellWrap, CodeCellLanguage, DataTable, Format, Sheet,
        js_types::{
            JsNumber, JsRenderCell, JsRenderCellFormatSpan, JsRenderCellLinkSpan,
            JsRenderCellSpecial,
        },
    },
};

impl Sheet {
    /// checks columns for any column that has data that might render
    pub fn has_render_cells(&self, rect: Rect) -> bool {
        self.contains_value_within_rect(rect, None)
            || self.contains_data_table_within_rect(rect, None)
    }

    /// creates a render for a single cell
    fn get_render_cell(
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
                error_text: if spill_error {
                    None
                } else {
                    Some(format!("{}", error.msg))
                },
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

        // Extract hyperlink spans and formatting spans from RichText (with character ranges)
        let (link_spans, format_spans) = if let CellValue::RichText(spans) = value {
            let mut char_offset: u32 = 0;
            let mut links = Vec::new();
            let mut formats = Vec::new();

            for span in spans.iter() {
                let start = char_offset;
                let len = span.text.chars().count() as u32;
                char_offset += len;
                let end = char_offset;

                // Extract hyperlink span
                if let Some(url) = &span.link {
                    links.push(JsRenderCellLinkSpan {
                        start,
                        end,
                        url: url.clone(),
                    });
                }

                // Extract formatting span if it has any formatting overrides
                if span.bold.is_some()
                    || span.italic.is_some()
                    || span.underline.is_some()
                    || span.strike_through.is_some()
                    || span.text_color.is_some()
                    || span.link.is_some()
                {
                    formats.push(JsRenderCellFormatSpan {
                        start,
                        end,
                        bold: span.bold,
                        italic: span.italic,
                        underline: span.underline,
                        strike_through: span.strike_through,
                        text_color: span.text_color.clone(),
                        link: span.link.clone(),
                    });
                }
            }

            (links, formats)
        } else {
            (vec![], vec![])
        };

        let mut number: Option<JsNumber> = None;
        let display_value = match value {
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
            value: display_value,
            language,
            align: format.align.or(align),
            wrap: format.wrap,
            bold: format.bold,
            italic: format.italic,
            text_color: format.text_color,
            vertical_align: format.vertical_align,
            special,
            error_text: None,
            number,
            underline: format.underline,
            strike_through: format.strike_through,
            font_size: format.font_size,
            table_name: None,
            column_header: None,
            link_spans,
            format_spans,
        }
    }

    // Converts a CodeValue::Code and CodeRun into a vector of JsRenderCell.
    pub(crate) fn get_render_code_cells(
        &self,
        data_table: &DataTable,
        render_rect: &Rect,
        code_rect: &Rect,
        context: &A1Context,
    ) -> Vec<JsRenderCell> {
        let mut cells = vec![];

        // Note: DataTable cells don't have language set (border drawn from table struct)
        if data_table.has_spill() {
            cells.push(Self::get_render_cell(
                code_rect.min.x,
                code_rect.min.y,
                &CellValue::Error(Box::new(RunError {
                    span: None,
                    msg: RunErrorMsg::Spill,
                })),
                Format::default(),
                None,
                Some(JsRenderCellSpecial::SpillError),
            ));
        } else if let Some(error) = data_table.get_error() {
            // For single-value code cells with errors, set the language so that
            // CellsCodeOutlines can draw the outline (since no Table is created for single cells)
            let language = if data_table.is_code()
                && !data_table.is_html_or_image()
                && !data_table.get_show_name()
                && !data_table.get_show_columns()
            {
                let output_size = data_table.output_size();
                if output_size.w.get() == 1 && output_size.h.get() == 1 {
                    Some(data_table.get_language())
                } else {
                    None
                }
            } else {
                None
            };
            cells.push(Self::get_render_cell(
                code_rect.min.x,
                code_rect.min.y,
                &CellValue::Error(Box::new(error)),
                Format::default(),
                language,
                None,
            ));
        } else if let Some(intersection) = code_rect.intersection(render_rect) {
            let y_adjustment = data_table.y_adjustment(false);
            for y in intersection.y_range() {
                // We now render the header row to ensure clipping works
                // properly to the left of the header since we rely on the
                // renderer for clipping purposes
                let is_header = y < code_rect.min.y + y_adjustment;
                let is_table_name = data_table.get_show_name() && y == code_rect.min.y;
                let is_column_headers = is_header && !is_table_name;

                for x in intersection.x_range() {
                    let pos = Pos {
                        x: x - code_rect.min.x,
                        y: y - code_rect.min.y,
                    };

                    let value = data_table.cell_value_at(pos.x as u32, pos.y as u32);

                    if let Some(value) = value {
                        let mut format = if is_header {
                            // column headers are always clipped and bold
                            Format {
                                wrap: Some(CellWrap::Clip),
                                bold: Some(true),
                                ..Default::default()
                            }
                        } else {
                            let table_format = data_table.get_format(pos);
                            let sheet_format =
                                self.formats.try_format(Pos { x, y }).unwrap_or_default();
                            table_format.combine(&sheet_format)
                        };

                        // Note: language is not populated for DataTable cells because
                        // the table border is rendered based on the table struct itself.
                        // Only CellValue::Code cells need language for border rendering.
                        let language = None;

                        let special = self
                            .validations
                            .render_special_pos(Pos { x, y }, context)
                            .or(match value {
                                CellValue::Logical(_) => Some(JsRenderCellSpecial::Logical),
                                _ => None,
                            });

                        Self::ensure_lists_are_clipped(&mut format, &special);

                        let mut render_cell =
                            Self::get_render_cell(x, y, &value, format, language, special);

                        if is_table_name {
                            render_cell.table_name = Some(true);
                        }

                        if is_column_headers {
                            render_cell.column_header = Some(true);
                        }

                        cells.push(render_cell);
                    }
                }
            }
        }

        cells
    }

    /// ensure that list cells are always clipped or wrapped (so the dropdown icon is visible)
    fn ensure_lists_are_clipped(format: &mut Format, special: &Option<JsRenderCellSpecial>) {
        if special
            .as_ref()
            .is_some_and(|s| matches!(s, JsRenderCellSpecial::List))
            && !format.wrap.is_some_and(|w| matches!(w, CellWrap::Wrap))
        {
            format.wrap = Some(CellWrap::Clip);
        }
    }

    /// Returns cell data in a format useful for rendering. This includes only
    /// the data necessary to render raw text values.
    pub fn get_render_cells(&self, rect: Rect, a1_context: &A1Context) -> Vec<JsRenderCell> {
        let mut render_cells = vec![];

        // Fetch ordinary value cells.
        rect.x_range()
            .filter_map(|x| Some((x, self.get_column(x)?)))
            .for_each(|(x, column)| {
                column.values.range(rect.y_range()).for_each(|(&y, value)| {
                    // For CellValue::Code, we need to get the language and output value
                    // This includes error cases - the language is preserved so CellsCodeOutlines
                    // can draw the outline for single-value code cells with errors
                    let (render_value, language) = if let CellValue::Code(code_cell) = value {
                        // Use the output value for rendering, but pass the language for code border
                        (
                            code_cell.output.as_ref(),
                            Some(code_cell.code_run.language.clone()),
                        )
                    } else {
                        (value, None)
                    };

                    let special = self
                        .validations
                        .render_special_pos(Pos { x, y }, a1_context)
                        .or({
                            if matches!(render_value, CellValue::Logical(_)) {
                                Some(JsRenderCellSpecial::Logical)
                            } else {
                                None
                            }
                        });

                    let mut format = self.formats.try_format(Pos { x, y }).unwrap_or_default();

                    Self::ensure_lists_are_clipped(&mut format, &special);

                    render_cells.push(Self::get_render_cell(
                        x,
                        y,
                        render_value,
                        format,
                        language,
                        special,
                    ));
                });
            });

        // Fetch values from code cells
        self.iter_data_tables_in_rect(rect)
            .for_each(|(data_table_rect, data_table)| {
                render_cells.extend(self.get_render_code_cells(
                    data_table,
                    &rect,
                    &data_table_rect,
                    a1_context,
                ));
                // }
            });

        // Populate validations for cells that are not yet in the render_cells
        self.validations
            .in_rect_unbounded(rect, a1_context)
            .iter()
            .rev() // we need to reverse to ensure that later rules overwrite earlier ones
            .for_each(|validation| {
                if let Some(special) = validation.render_special() {
                    validation
                        .selection
                        .ranges
                        .iter()
                        .for_each(|validations_range| {
                            if let Some(validation_rect) =
                                validations_range.to_rect_unbounded(a1_context)
                                && let Some(validation_intersect) =
                                    validation_rect.intersection(&rect)
                            {
                                validation_intersect
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
mod tests {
    use crate::grid::js_types::JsHashRenderCells;
    use crate::grid::sheet::validations::rules::ValidationRule;
    use crate::grid::sheet::validations::validation::ValidationUpdate;
    use crate::test_util::*;
    use crate::{
        SheetPos, Value,
        a1::A1Selection,
        controller::GridController,
        grid::{CellVerticalAlign, CellWrap, CodeRun, DataTableKind},
        wasm_bindings::js::{clear_js_calls, expect_js_call},
    };

    use super::*;

    #[test]
    fn test_has_render_cells() {
        let mut gc = GridController::test();
        let sheet_id = gc.sheet_ids()[0];

        let rect = Rect {
            min: Pos { x: 0, y: 0 },
            max: Pos { x: 100, y: 100 },
        };
        assert!(!gc.sheet(sheet_id).has_render_cells(rect));

        gc.set_cell_value(pos![sheet_id!1,2], "test".into(), None, false);
        assert!(gc.sheet(sheet_id).has_render_cells(rect));

        gc.sheet_mut(sheet_id)
            .delete_values(Rect::single_pos(Pos { x: 1, y: 2 }));
        assert!(!gc.sheet(sheet_id).has_render_cells(rect));

        let code_run = CodeRun {
            language: CodeCellLanguage::Python,
            code: "1 + 1".to_string(),
            formula_ast: None,
            std_err: None,
            std_out: None,
            cells_accessed: Default::default(),
            error: None,
            return_type: Some("text".into()),
            line_number: None,
            output_type: None,
        };
        gc.sheet_mut(sheet_id).set_data_table(
            Pos { x: 2, y: 3 },
            Some(DataTable::new(
                DataTableKind::CodeRun(code_run),
                "Table 1",
                Value::Single(CellValue::Text("hello".to_string())),
                false,
                Some(true),
                Some(true),
                None,
            )),
        );
        assert!(gc.sheet(sheet_id).has_render_cells(rect));

        let selection = A1Selection::from_xy(2, 3, sheet_id);
        gc.delete_cells(&selection, None, false);
        assert!(!gc.sheet(sheet_id).has_render_cells(rect));
    }

    #[test]
    fn test_get_render_cells() {
        let mut gc = GridController::test();
        let sheet_id = gc.sheet_ids()[0];

        let pos = pos![1, 2];
        gc.set_cell_value(pos.to_sheet_pos(sheet_id), "test".into(), None, false);
        gc.sheet_mut(sheet_id).formats.bold.set(pos, Some(true));
        gc.sheet_mut(sheet_id)
            .formats
            .align
            .set(pos, Some(CellAlign::Center));
        gc.sheet_mut(sheet_id)
            .formats
            .vertical_align
            .set(pos, Some(CellVerticalAlign::Middle));
        gc.sheet_mut(sheet_id)
            .formats
            .wrap
            .set(pos, Some(CellWrap::Wrap));

        gc.set_cell_value(pos![sheet_id!1,3], "123".into(), None, false);
        gc.sheet_mut(sheet_id)
            .formats
            .italic
            .set(pos![1, 3], Some(true));

        gc.sheet_mut(sheet_id)
            .set_value(pos![2, 4], CellValue::Html("html".to_string()));
        gc.set_cell_value(pos![sheet_id!2,5], "true".into(), None, false);
        gc.sheet_mut(sheet_id).set_value(
            Pos { x: 2, y: 6 },
            CellValue::Error(Box::new(RunError {
                span: None,
                msg: RunErrorMsg::Spill,
            })),
        );
        gc.sheet_mut(sheet_id).set_value(
            Pos { x: 3, y: 3 },
            CellValue::Error(Box::new(RunError {
                span: None,
                msg: crate::RunErrorMsg::ArrayTooBig,
            })),
        );

        let sheet = gc.sheet(sheet_id);
        let render = sheet.get_render_cells(
            Rect {
                min: Pos { x: 0, y: 0 },
                max: Pos { x: 10, y: 10 },
            },
            gc.a1_context(),
        );
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
                error_text: Some("Array is too big".to_string()),
                ..Default::default()
            },
        );
    }

    #[test]
    fn test_get_render_cells_code() {
        let mut gc = GridController::test();
        let sheet_id = gc.sheet_ids()[0];

        // Note: 1x1 formulas are stored as CellValue::Code and DO populate
        // language in JsRenderCell (for drawing code cell border).
        gc.set_code_cell(
            SheetPos {
                x: 1,
                y: 2,
                sheet_id,
            },
            CodeCellLanguage::Formula,
            "1 + 1".to_string(),
            None,
            None,
            false,
        );
        assert_eq!(
            gc.sheet(sheet_id)
                .get_render_cells(Rect::from_numbers(1, 2, 1, 1), gc.a1_context()),
            vec![JsRenderCell {
                x: 1,
                y: 2,
                value: "2".to_string(),
                language: Some(CodeCellLanguage::Formula), // CellValue::Code cells DO populate language
                align: Some(CellAlign::Right),
                number: Some(JsNumber::default()),
                ..Default::default()
            }]
        );
    }

    #[test]
    fn render_cells_boolean() {
        let mut gc = GridController::test();
        let sheet_id = gc.sheet_ids()[0];
        gc.set_cell_value((0, 0, sheet_id).into(), "true".to_string(), None, false);
        gc.set_cell_value((1, 1, sheet_id).into(), "false".to_string(), None, false);
        gc.set_cell_value((2, 2, sheet_id).into(), "TRUE".to_string(), None, false);
        gc.set_cell_value((3, 3, sheet_id).into(), "FALSE".to_string(), None, false);
        gc.set_cell_value((4, 4, sheet_id).into(), "tRUE".to_string(), None, false);
        gc.set_cell_value((5, 5, sheet_id).into(), "fALSE".to_string(), None, false);

        let sheet = gc.sheet(sheet_id);
        let rendering = sheet.get_render_cells(
            Rect {
                min: (0, 0).into(),
                max: (5, 5).into(),
            },
            gc.a1_context(),
        );
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
    fn render_bool_on_code_run() {
        clear_js_calls();

        let mut gc = GridController::test_with_viewport_buffer();
        let sheet_id = gc.sheet_ids()[0];

        gc.set_code_cell(
            (1, 1, sheet_id).into(),
            CodeCellLanguage::Formula,
            "{TRUE(), FALSE(), TRUE()}".into(),
            None,
            None,
            false,
        );
        // Note: DataTable cells don't populate language (table border drawn from table struct)
        let expected = vec![
            JsRenderCell {
                x: 1,
                y: 1,
                value: "true".to_string(),
                language: None,
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
        let cells = sheet.get_render_cells(Rect::new(1, 1, 3, 1), gc.a1_context());

        assert_eq!(cells.len(), expected.len());
        assert!(expected.iter().all(|cell| cells.contains(cell)));

        let render_cells = vec![JsHashRenderCells {
            sheet_id,
            hash: (Pos { x: 0, y: 0 }).quadrant().into(),
            cells: expected,
        }];
        expect_js_call(
            "jsHashesRenderCells",
            format!("{:?}", serde_json::to_vec(&render_cells).unwrap()),
            true,
        );
    }

    #[test]
    fn test_get_code_cell_validations() {
        let mut gc = test_create_gc();
        let sheet_id = first_sheet_id(&gc);

        test_create_data_table(&mut gc, sheet_id, pos![b2], 3, 3);

        gc.update_validation(
            ValidationUpdate {
                id: None,
                selection: A1Selection::test_a1_context("test_table[Column 1]", gc.a1_context()),
                rule: ValidationRule::Logical(Default::default()),
                message: Default::default(),
                error: Default::default(),
            },
            None,
            false,
        );
    }

    #[test]
    fn test_ensure_lists_are_clipped() {
        // Test case 1: List cell with no wrap setting
        let mut format = Format::default();
        let special = Some(JsRenderCellSpecial::List);
        Sheet::ensure_lists_are_clipped(&mut format, &special);
        assert_eq!(format.wrap, Some(CellWrap::Clip));

        // Test case 2: List cell with wrap setting
        let mut format = Format {
            wrap: Some(CellWrap::Wrap),
            ..Default::default()
        };
        let special = Some(JsRenderCellSpecial::List);
        Sheet::ensure_lists_are_clipped(&mut format, &special);
        assert_eq!(format.wrap, Some(CellWrap::Wrap));

        // Test case 3: List cell with clip setting
        let mut format = Format {
            wrap: Some(CellWrap::Clip),
            ..Default::default()
        };
        let special = Some(JsRenderCellSpecial::List);
        Sheet::ensure_lists_are_clipped(&mut format, &special);
        assert_eq!(format.wrap, Some(CellWrap::Clip));

        // Test case 4: Non-list cell with no wrap setting
        let mut format = Format::default();
        let special = Some(JsRenderCellSpecial::Logical);
        Sheet::ensure_lists_are_clipped(&mut format, &special);
        assert_eq!(format.wrap, None);

        // Test case 5: Non-list cell with wrap setting
        let mut format = Format {
            wrap: Some(CellWrap::Wrap),
            ..Default::default()
        };
        let special = Some(JsRenderCellSpecial::Logical);
        Sheet::ensure_lists_are_clipped(&mut format, &special);
        assert_eq!(format.wrap, Some(CellWrap::Wrap));

        // Test case 6: No special type
        let mut format = Format::default();
        let special = None;
        Sheet::ensure_lists_are_clipped(&mut format, &special);
        assert_eq!(format.wrap, None);
    }

    #[test]
    fn test_render_cell_with_font_size() {
        let mut gc = GridController::test();
        let sheet_id = gc.sheet_ids()[0];

        let pos = pos![1, 2];
        gc.set_cell_value(pos.to_sheet_pos(sheet_id), "test".into(), None, false);
        gc.sheet_mut(sheet_id).formats.font_size.set(pos, Some(16));

        let sheet = gc.sheet(sheet_id);
        let render = sheet.get_render_cells(
            Rect {
                min: Pos { x: 1, y: 2 },
                max: Pos { x: 1, y: 2 },
            },
            gc.a1_context(),
        );

        assert_eq!(render.len(), 1);
        assert_eq!(
            render[0],
            JsRenderCell {
                x: 1,
                y: 2,
                value: "test".to_string(),
                font_size: Some(16),
                ..Default::default()
            }
        );

        // Test that font_size is None when not set
        let pos2 = pos![2, 3];
        gc.set_cell_value(pos2.to_sheet_pos(sheet_id), "test2".into(), None, false);

        let sheet = gc.sheet(sheet_id);
        let render2 = sheet.get_render_cells(
            Rect {
                min: Pos { x: 2, y: 3 },
                max: Pos { x: 2, y: 3 },
            },
            gc.a1_context(),
        );

        assert_eq!(render2.len(), 1);
        assert_eq!(
            render2[0],
            JsRenderCell {
                x: 2,
                y: 3,
                value: "test2".to_string(),
                font_size: None,
                ..Default::default()
            }
        );
    }

    #[test]
    fn test_render_rich_text_with_links_and_formatting() {
        use crate::cellvalue::TextSpan;
        use crate::grid::js_types::{JsRenderCellFormatSpan, JsRenderCellLinkSpan};

        let mut gc = GridController::test();
        let sheet_id = gc.sheet_ids()[0];

        // Set a RichText cell with hyperlinks and formatting
        let spans = vec![
            TextSpan::plain("Hello "),
            TextSpan::link("world", "https://example.com"),
            TextSpan {
                text: " bold".to_string(),
                bold: Some(true),
                ..Default::default()
            },
        ];
        gc.sheet_mut(sheet_id)
            .set_value(Pos { x: 1, y: 1 }, CellValue::RichText(spans));

        let sheet = gc.sheet(sheet_id);
        let render = sheet.get_render_cells(
            Rect {
                min: Pos { x: 1, y: 1 },
                max: Pos { x: 1, y: 1 },
            },
            gc.a1_context(),
        );

        assert_eq!(render.len(), 1);
        let cell = &render[0];

        // Check that value is the concatenated text
        assert_eq!(cell.value, "Hello world bold");

        // Check link_spans: "world" starts at char 6 and ends at char 11
        assert_eq!(cell.link_spans.len(), 1);
        assert_eq!(
            cell.link_spans[0],
            JsRenderCellLinkSpan {
                start: 6,
                end: 11,
                url: "https://example.com".to_string(),
            }
        );

        // Check format_spans: link span and bold span should have formatting
        assert_eq!(cell.format_spans.len(), 2);

        // Link span (chars 6-11)
        assert_eq!(
            cell.format_spans[0],
            JsRenderCellFormatSpan {
                start: 6,
                end: 11,
                link: Some("https://example.com".to_string()),
                ..Default::default()
            }
        );

        // Bold span (chars 11-16)
        assert_eq!(
            cell.format_spans[1],
            JsRenderCellFormatSpan {
                start: 11,
                end: 16,
                bold: Some(true),
                ..Default::default()
            }
        );
    }

    #[test]
    fn test_render_rich_text_plain_no_spans() {
        use crate::cellvalue::TextSpan;

        let mut gc = GridController::test();
        let sheet_id = gc.sheet_ids()[0];

        // Set a RichText cell with only plain text (no formatting)
        let spans = vec![TextSpan::plain("Plain text only")];
        gc.sheet_mut(sheet_id)
            .set_value(Pos { x: 1, y: 1 }, CellValue::RichText(spans));

        let sheet = gc.sheet(sheet_id);
        let render = sheet.get_render_cells(
            Rect {
                min: Pos { x: 1, y: 1 },
                max: Pos { x: 1, y: 1 },
            },
            gc.a1_context(),
        );

        assert_eq!(render.len(), 1);
        let cell = &render[0];

        assert_eq!(cell.value, "Plain text only");
        // Plain text spans should not create any link_spans or format_spans
        assert!(cell.link_spans.is_empty());
        assert!(cell.format_spans.is_empty());
    }

    #[test]
    fn test_render_code_cell_value() {
        use crate::CodeCell;
        use crate::grid::CodeRun;

        let mut gc = GridController::test();
        let sheet_id = gc.sheet_ids()[0];

        // Create a CodeCell directly in the sheet's columns (simulating migrated data)
        let code_run = CodeRun {
            language: CodeCellLanguage::Formula,
            code: "1 + 1".to_string(),
            ..Default::default()
        };
        let code_cell = CodeCell::new(code_run, CellValue::Number(2.into()));
        gc.sheet_mut(sheet_id)
            .set_value(Pos { x: 1, y: 1 }, CellValue::Code(Box::new(code_cell)));

        let sheet = gc.sheet(sheet_id);
        let render = sheet.get_render_cells(
            Rect {
                min: Pos { x: 1, y: 1 },
                max: Pos { x: 1, y: 1 },
            },
            gc.a1_context(),
        );

        assert_eq!(render.len(), 1);
        let cell = &render[0];

        // Should render the output value
        assert_eq!(cell.value, "2");
        // Should have the language set for code border rendering
        assert_eq!(cell.language, Some(CodeCellLanguage::Formula));
        // Numbers should be right-aligned
        assert_eq!(cell.align, Some(CellAlign::Right));
    }

    #[test]
    fn test_render_code_cell_value_with_error() {
        use crate::CodeCell;
        use crate::grid::CodeRun;

        let mut gc = GridController::test();
        let sheet_id = gc.sheet_ids()[0];

        // Create a CodeCell with an error output
        let code_run = CodeRun {
            language: CodeCellLanguage::Python,
            code: "invalid".to_string(),
            error: Some(RunError {
                span: None,
                msg: RunErrorMsg::DivideByZero,
            }),
            ..Default::default()
        };
        let code_cell = CodeCell::with_error(
            code_run,
            RunError {
                span: None,
                msg: RunErrorMsg::DivideByZero,
            },
        );
        gc.sheet_mut(sheet_id)
            .set_value(Pos { x: 2, y: 2 }, CellValue::Code(Box::new(code_cell)));

        let sheet = gc.sheet(sheet_id);
        let render = sheet.get_render_cells(
            Rect {
                min: Pos { x: 2, y: 2 },
                max: Pos { x: 2, y: 2 },
            },
            gc.a1_context(),
        );

        assert_eq!(render.len(), 1);
        let cell = &render[0];

        // Should have the language set for code border rendering
        assert_eq!(cell.language, Some(CodeCellLanguage::Python));
        // Should show as a run error
        assert_eq!(cell.special, Some(JsRenderCellSpecial::RunError));
    }

    #[test]
    fn test_render_single_value_data_table_with_error() {
        use crate::grid::{CodeRun, DataTableKind};

        let mut gc = GridController::test();
        let sheet_id = gc.sheet_ids()[0];

        // Create a DataTable with an error (single-value, no UI)
        // This simulates a Python cell that has an error and is stored as a DataTable
        // (because errors prevent it from being converted to CellValue::Code)
        let code_run = CodeRun {
            language: CodeCellLanguage::Python,
            code: "invalid".to_string(),
            error: Some(RunError {
                span: None,
                msg: RunErrorMsg::DivideByZero,
            }),
            ..Default::default()
        };
        let data_table = DataTable::new(
            DataTableKind::CodeRun(code_run),
            "Python1",
            Value::Single(CellValue::Blank), // Error cells have Blank output
            false,
            Some(false), // No UI
            Some(false), // No UI
            None,
        );
        gc.sheet_mut(sheet_id)
            .set_data_table(Pos { x: 3, y: 3 }, Some(data_table));

        let sheet = gc.sheet(sheet_id);
        let render = sheet.get_render_cells(
            Rect {
                min: Pos { x: 3, y: 3 },
                max: Pos { x: 3, y: 3 },
            },
            gc.a1_context(),
        );

        assert_eq!(render.len(), 1);
        let cell = &render[0];

        // Should have the language set for code border rendering (CellsCodeOutlines)
        assert_eq!(cell.language, Some(CodeCellLanguage::Python));
        // Should show as a run error
        assert_eq!(cell.special, Some(JsRenderCellSpecial::RunError));
    }
}
