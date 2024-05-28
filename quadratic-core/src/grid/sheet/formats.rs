use std::collections::HashSet;

use super::Sheet;
use crate::{
    grid::formats::{Format, FormatUpdate, Formats},
    selection::Selection,
    Pos, Rect,
};

impl Sheet {
    /// Sets the Format for all cells and returns Formats to undo that change.
    fn set_format_all(&mut self, update: &Formats) -> Formats {
        let mut old = Formats::default();
        let mut format_all = self
            .format_all
            .as_ref()
            .map_or(Format::default(), |f| f.clone());
        if let Some(format_update) = update.iter_values().next() {
            old.push(format_all.merge_update(format_update));
            if format_all.is_default() {
                self.format_all = None;
            } else {
                self.format_all = Some(format_all);
            }
        } else {
            old.push(FormatUpdate::default());
        }

        // todo: need to trigger client changes

        old
    }

    /// Sets the Formats for columns and returns existing Formats for columns.
    fn set_formats_columns(&mut self, columns: &Vec<i64>, formats: &Formats) -> Formats {
        let mut old_formats = Formats::default();
        let mut formats_iter = formats.iter_values();
        columns.iter().for_each(|x| {
            if let Some(format_update) = formats_iter.next() {
                let mut column_format = self
                    .formats_columns
                    .get(x)
                    .unwrap_or(&Format::default())
                    .clone();
                old_formats.push(column_format.merge_update(format_update));
                if column_format.is_default() {
                    self.formats_columns.remove(x);
                } else {
                    self.formats_columns.insert(*x, column_format);
                }
            }
        });

        // todo: need to trigger client changes

        old_formats
    }

    /// Sets the Formats for rows and returns existing Formats for rows.
    fn set_formats_rows(&mut self, rows: &Vec<i64>, formats: &Formats) -> Formats {
        let mut old_formats = Formats::default();
        let mut formats_iter = formats.iter_values();
        rows.iter().for_each(|y| {
            if let Some(format_update) = formats_iter.next() {
                let mut row_format = self
                    .formats_rows
                    .get(y)
                    .unwrap_or(&Format::default())
                    .clone();
                old_formats.push(row_format.merge_update(format_update));
                if row_format.is_default() {
                    self.formats_rows.remove(y);
                } else {
                    self.formats_rows.insert(*y, row_format);
                }
            }
        });

        // todo: need to trigger client changes

        old_formats
    }

    /// Sets the Formats for Vec<Rect> and returns existing Formats for the Vec<Rect>.
    fn set_formats_rects(&mut self, rects: &Vec<Rect>, formats: &Formats) -> Formats {
        let mut old_formats = Formats::default();
        let mut formats_iter = formats.iter_values();

        // tracks client changes
        let mut renders = HashSet::new();
        let mut html = HashSet::new();
        let mut fills = HashSet::new();

        rects.iter().for_each(|rect| {
            for x in rect.min.x..=rect.max.x {
                let column = self.get_or_create_column(x);
                for y in rect.min.y..=rect.max.y {
                    let pos = Pos { x, y };

                    // todo: this will be much simpler when we have a `column.format`
                    if let Some(format_update) = formats_iter.next() {
                        if format_update.is_default() {
                            old_formats.push(FormatUpdate::default());
                        } else {
                            let mut old_format = FormatUpdate::default();
                            if let Some(align) = format_update.align {
                                old_format.align = Some(column.align.get(y));
                                column.align.set(y, align);
                            }
                            if let Some(wrap) = format_update.wrap {
                                old_format.wrap = Some(column.wrap.get(y));
                                column.wrap.set(y, wrap);
                            }
                            if let Some(numeric_format) = format_update.numeric_format.as_ref() {
                                old_format.numeric_format = Some(column.numeric_format.get(y));
                                column.numeric_format.set(y, numeric_format.clone());
                            }
                            if let Some(numeric_decimals) = format_update.numeric_decimals {
                                old_format.numeric_decimals = Some(column.numeric_decimals.get(y));
                                column.numeric_decimals.set(y, numeric_decimals);
                            }
                            if let Some(numeric_commas) = format_update.numeric_commas {
                                old_format.numeric_commas = Some(column.numeric_commas.get(y));
                                column.numeric_commas.set(y, numeric_commas);
                            }
                            if let Some(bold) = format_update.bold {
                                old_format.bold = Some(column.bold.get(y));
                                column.bold.set(y, bold);
                            }
                            if let Some(italic) = format_update.italic {
                                old_format.italic = Some(column.italic.get(y));
                                column.italic.set(y, italic);
                            }
                            if let Some(text_color) = format_update.text_color.as_ref() {
                                old_format.text_color = Some(column.text_color.get(y));
                                column.text_color.set(y, text_color.clone());
                            }
                            if let Some(fill_color) = format_update.fill_color.as_ref() {
                                old_format.fill_color = Some(column.fill_color.get(y));
                                column.fill_color.set(y, fill_color.clone());
                            }
                            if let Some(render_size) = format_update.render_size.as_ref() {
                                old_format.render_size = Some(column.render_size.get(y));
                                column.render_size.set(y, render_size.clone());
                            }
                            old_formats.push(old_format);
                        }
                        if format_update.render_cells_changed() {
                            renders.insert(pos);
                        }
                        if format_update.html_changed() {
                            html.insert(pos);
                        }
                        if format_update.fill_changed() {
                            fills.insert(pos);
                        }
                    } else {
                        old_formats.push(FormatUpdate::default());
                    }
                }
            }
        });

        self.send_render_cells(&renders);
        self.send_html_output(&html);
        self.send_fills(&fills);
        old_formats
    }

    pub fn set_formats_selection(&mut self, selection: &Selection, formats: &Formats) -> Formats {
        if selection.all {
            self.set_format_all(formats)
        } else if let Some(columns) = selection.columns.as_ref() {
            self.set_formats_columns(columns, formats)
        } else if let Some(rows) = selection.rows.as_ref() {
            self.set_formats_rows(rows, formats)
        } else if let Some(rects) = selection.rects.as_ref() {
            self.set_formats_rects(rects, formats)
        } else {
            Formats::default()
        }
    }
}

#[cfg(test)]
mod tests {
    use std::collections::HashSet;

    use chrono::Utc;

    use crate::{
        grid::{
            formats::{Format, FormatUpdate, Formats},
            Bold, CodeCellLanguage, CodeRun, CodeRunResult, Italic, RenderSize, Sheet,
        },
        selection::Selection,
        wasm_bindings::js::{expect_js_call, hash_test},
        CellValue, CodeCellValue, Pos, Rect, Value,
    };

    #[test]
    fn set_formats_selection_rect() {
        let mut sheet = Sheet::test();
        let formats = Formats::repeat(
            FormatUpdate {
                bold: Some(Some(true)),
                ..Default::default()
            },
            4,
        );
        let rect = Rect::from_numbers(0, 0, 2, 2);
        let old_formats = sheet.set_formats_rects(&vec![rect], &formats);
        assert_eq!(
            sheet.get_formatting_value::<Bold>(Pos { x: 0, y: 0 }),
            Some(true)
        );
        assert_eq!(
            sheet.get_formatting_value::<Bold>(Pos { x: 1, y: 1 }),
            Some(true)
        );
        assert_eq!(sheet.get_formatting_value::<Bold>(Pos { x: 2, y: 2 }), None);

        let cells =
            serde_json::to_string(&sheet.get_render_cells(Rect::from_numbers(0, 0, 2, 2))).unwrap();
        let args = format!("{},{},{},{}", sheet.id, 0, 0, hash_test(&cells));
        expect_js_call("jsRenderCellSheets", args, true);

        let old_formats = sheet.set_formats_rects(&vec![rect], &old_formats);
        assert!(sheet
            .get_formatting_value::<Bold>(Pos { x: 0, y: 0 })
            .is_none());
        assert!(sheet
            .get_formatting_value::<Bold>(Pos { x: 1, y: 1 })
            .is_none());
        assert_eq!(old_formats, formats);
    }

    #[test]
    fn set_formats_selection_rect_html() {
        let mut sheet = Sheet::test();
        let pos = Pos { x: 1, y: 1 };
        sheet.set_cell_value(
            pos,
            CellValue::Code(CodeCellValue {
                language: CodeCellLanguage::Formula,
                code: "test".to_string(),
            }),
        );

        let code_run = CodeRun {
            std_err: None,
            std_out: None,
            formatted_code_string: None,
            cells_accessed: HashSet::new(),
            result: CodeRunResult::Ok(Value::Single(CellValue::Html("test".to_string()))),
            return_type: Some("number".into()),
            line_number: None,
            output_type: None,
            spill_error: false,
            last_modified: Utc::now(),
        };

        sheet.set_code_run(pos, Some(code_run));
        let formats = Formats::repeat(
            FormatUpdate {
                render_size: Some(Some(RenderSize {
                    w: "1".to_string(),
                    h: "2".to_string(),
                })),
                ..Default::default()
            },
            1,
        );
        sheet.set_formats_rects(&vec![Rect::single_pos(pos)], &formats);
        let expected = sheet.get_single_html_output(pos).unwrap();
        expect_js_call(
            "jsUpdateHtml",
            serde_json::to_string(&expected).unwrap(),
            true,
        );
    }

    #[test]
    fn set_formats_rects() {
        let mut sheet = Sheet::test();
        let mut formats = Formats::repeat(
            FormatUpdate {
                bold: Some(Some(true)),
                ..Default::default()
            },
            4,
        );
        let rect1 = Rect::from_numbers(0, 0, 2, 2);
        formats.push(FormatUpdate {
            italic: Some(Some(true)),
            ..Default::default()
        });
        let rect2 = Rect::from_numbers(2, 2, 1, 1);
        let old_formats = sheet.set_formats_rects(&vec![rect1, rect2], &formats);
        assert_eq!(
            sheet.get_formatting_value::<Italic>(Pos { x: 2, y: 2 }),
            Some(true)
        );
        assert_eq!(
            sheet.get_formatting_value::<Italic>(Pos { x: 3, y: 3 }),
            None
        );
        assert_eq!(
            sheet.get_formatting_value::<Bold>(Pos { x: 0, y: 0 }),
            Some(true)
        );
        assert_eq!(
            sheet.get_formatting_value::<Bold>(Pos { x: 1, y: 1 }),
            Some(true)
        );
        assert_eq!(sheet.get_formatting_value::<Bold>(Pos { x: 2, y: 2 }), None);

        let old_formats = sheet.set_formats_rects(&vec![rect1, rect2], &old_formats);
        assert!(sheet
            .get_formatting_value::<Italic>((2, 2).into())
            .is_none());
        assert!(sheet
            .get_formatting_value::<Italic>((3, 3).into())
            .is_none());
        assert!(sheet.get_formatting_value::<Bold>((0, 0).into()).is_none());
        assert!(sheet.get_formatting_value::<Bold>((1, 1).into()).is_none());

        assert_eq!(old_formats, formats);
    }

    #[test]
    fn set_format_selection_all() {
        let mut sheet = Sheet::test();
        let formats = Formats::repeat(
            FormatUpdate {
                bold: Some(Some(true)),
                ..FormatUpdate::default()
            },
            1,
        );
        let selection = Selection {
            all: true,
            ..Default::default()
        };
        let old_formats = sheet.set_formats_selection(&selection, &formats);
        assert_eq!(
            sheet.format_all,
            Some(Format {
                bold: Some(true),
                ..Format::default()
            })
        );
        assert_eq!(
            sheet.format_all,
            Some(Format {
                bold: Some(true),
                ..Default::default()
            })
        );

        let old_formats = sheet.set_formats_selection(
            &Selection {
                all: true,
                ..Default::default()
            },
            &old_formats,
        );
        assert!(sheet.format_all.is_none());
        assert_eq!(old_formats, formats);
    }

    #[test]
    fn set_format_all() {
        let mut sheet = Sheet::test();
        assert!(sheet.format_all.is_none());
        let formats = Formats::repeat(
            FormatUpdate {
                bold: Some(Some(true)),
                ..FormatUpdate::default()
            },
            1,
        );
        let old_formats = sheet.set_format_all(&formats);
        assert_eq!(
            sheet.format_all,
            Some(Format {
                bold: Some(true),
                ..Format::default()
            })
        );
        assert_eq!(
            sheet.format_all,
            Some(Format {
                bold: Some(true),
                ..Default::default()
            })
        );

        let old_formats = sheet.set_format_all(&old_formats);
        assert!(sheet.format_all.is_none());

        assert_eq!(old_formats, formats);
    }

    #[test]
    fn set_format_selection_columns() {
        let mut sheet = Sheet::test();
        let formats = Formats::repeat(
            FormatUpdate {
                bold: Some(Some(true)),
                ..FormatUpdate::default()
            },
            3,
        );
        let selection = Selection {
            columns: Some(vec![0, 1, 2]),
            ..Default::default()
        };
        let old_formats = sheet.set_formats_selection(&selection, &formats);
        assert_eq!(
            sheet.formats_columns.get(&0),
            Some(&Format {
                bold: Some(true),
                ..Format::default()
            })
        );
        assert_eq!(
            sheet.formats_columns.get(&1),
            Some(&Format {
                bold: Some(true),
                ..Format::default()
            })
        );
        assert_eq!(
            sheet.formats_columns.get(&2),
            Some(&Format {
                bold: Some(true),
                ..Format::default()
            })
        );
        assert_eq!(sheet.formats_columns.get(&3), None);

        let old_formats = sheet.set_formats_selection(&selection, &old_formats);
        assert_eq!(sheet.formats_columns.get(&0), None);
        assert_eq!(sheet.formats_columns.get(&1), None);
        assert_eq!(sheet.formats_columns.get(&2), None);
        assert_eq!(
            old_formats,
            Formats::repeat(
                FormatUpdate {
                    bold: Some(Some(true)),
                    ..FormatUpdate::default()
                },
                3
            )
        );

        assert_eq!(old_formats, formats);
    }

    #[test]
    fn set_format_columns() {
        let mut sheet = Sheet::test();
        let formats = Formats::repeat(
            FormatUpdate {
                bold: Some(Some(true)),
                ..FormatUpdate::default()
            },
            3,
        );
        let old_formats = sheet.set_formats_columns(&vec![0, 1, 2], &formats);
        assert_eq!(
            sheet.formats_columns.get(&0),
            Some(&Format {
                bold: Some(true),
                ..Format::default()
            })
        );
        assert_eq!(
            sheet.formats_columns.get(&1),
            Some(&Format {
                bold: Some(true),
                ..Format::default()
            })
        );
        assert_eq!(
            sheet.formats_columns.get(&2),
            Some(&Format {
                bold: Some(true),
                ..Format::default()
            })
        );
        assert_eq!(sheet.formats_columns.get(&3), None);

        let old_formats = sheet.set_formats_columns(&vec![0, 1, 2], &old_formats);
        assert_eq!(sheet.formats_columns.get(&0), None);
        assert_eq!(sheet.formats_columns.get(&1), None);
        assert_eq!(sheet.formats_columns.get(&2), None);
        assert_eq!(
            old_formats,
            Formats::repeat(
                FormatUpdate {
                    bold: Some(Some(true)),
                    ..FormatUpdate::default()
                },
                3
            )
        );

        assert_eq!(old_formats, formats);
    }

    #[test]
    fn set_format_selection_rows() {
        let mut sheet = Sheet::test();
        let formats = Formats::repeat(
            FormatUpdate {
                bold: Some(Some(true)),
                ..FormatUpdate::default()
            },
            3,
        );
        let selection = Selection {
            rows: Some(vec![0, 1, 2]),
            ..Default::default()
        };
        let old_formats = sheet.set_formats_selection(&selection, &formats);
        assert_eq!(
            sheet.formats_rows.get(&0),
            Some(&Format {
                bold: Some(true),
                ..Format::default()
            })
        );
        assert_eq!(
            sheet.formats_rows.get(&1),
            Some(&Format {
                bold: Some(true),
                ..Format::default()
            })
        );
        assert_eq!(
            sheet.formats_rows.get(&2),
            Some(&Format {
                bold: Some(true),
                ..Format::default()
            })
        );
        assert_eq!(sheet.formats_rows.get(&3), None);

        let old_formats = sheet.set_formats_selection(&selection, &old_formats);
        assert_eq!(sheet.formats_rows.get(&0), None);
        assert_eq!(sheet.formats_rows.get(&1), None);
        assert_eq!(sheet.formats_rows.get(&2), None);
        assert_eq!(
            old_formats,
            Formats::repeat(
                FormatUpdate {
                    bold: Some(Some(true)),
                    ..FormatUpdate::default()
                },
                3
            )
        );

        assert_eq!(old_formats, formats);
    }

    #[test]
    fn set_formats_rows() {
        let mut sheet = Sheet::test();
        let formats = Formats::repeat(
            FormatUpdate {
                bold: Some(Some(true)),
                ..FormatUpdate::default()
            },
            3,
        );
        let old_formats = sheet.set_formats_rows(&vec![0, 1, 2], &formats);
        assert_eq!(
            sheet.formats_rows.get(&0),
            Some(&Format {
                bold: Some(true),
                ..Format::default()
            })
        );
        assert_eq!(
            sheet.formats_rows.get(&1),
            Some(&Format {
                bold: Some(true),
                ..Format::default()
            })
        );
        assert_eq!(
            sheet.formats_rows.get(&2),
            Some(&Format {
                bold: Some(true),
                ..Format::default()
            })
        );
        assert_eq!(sheet.formats_rows.get(&3), None);

        let old_formats = sheet.set_formats_rows(&vec![0, 1, 2], &old_formats);
        assert_eq!(sheet.formats_rows.get(&0), None);
        assert_eq!(sheet.formats_rows.get(&1), None);
        assert_eq!(sheet.formats_rows.get(&2), None);
        assert_eq!(
            old_formats,
            Formats::repeat(
                FormatUpdate {
                    bold: Some(Some(true)),
                    ..FormatUpdate::default()
                },
                3
            )
        );

        assert_eq!(old_formats, formats);
    }
}
