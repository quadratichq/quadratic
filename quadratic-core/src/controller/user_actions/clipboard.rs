use crate::controller::{
    operations::clipboard::{Clipboard, ClipboardCell},
    transaction_summary::TransactionSummary,
    GridController,
};
use crate::{
    grid::{get_cell_borders_in_rect, CodeCellValue},
    Pos, SheetPos, SheetRect,
};
use htmlescape;

impl GridController {
    pub fn copy_to_clipboard(&self, sheet_rect: SheetRect) -> (String, String) {
        let mut cells = vec![];
        let mut plain_text = String::new();
        let mut html = String::from("<tbody>");
        let mut code = vec![];
        let sheet = &mut self.grid().sheet_from_id(sheet_rect.sheet_id);

        for y in sheet_rect.y_range() {
            if y != sheet_rect.min.y {
                plain_text.push('\n');
                html.push_str("</tr>");
            }
            html.push_str("<tr>");

            for x in sheet_rect.x_range() {
                if x != sheet_rect.min.x {
                    plain_text.push('\t');
                    html.push_str("</td>");
                }
                html.push_str("<td>");
                let pos = Pos { x, y };
                let value = sheet.get_cell_value_only(pos);

                // spill_value is only needed if there is no cell_value
                let spill_value = if value.is_none() {
                    sheet.get_code_cell_value(pos)
                } else {
                    None
                };

                // store code_cells w/o output (which will be rerun on paste)
                if let Some(code_cell_value) = sheet.get_code_cell(pos) {
                    code.push((
                        Pos {
                            x: x - sheet_rect.min.x,
                            y: y - sheet_rect.min.y,
                        },
                        CodeCellValue {
                            language: code_cell_value.language,
                            code_string: code_cell_value.code_string.clone(),
                            formatted_code_string: None,
                            last_modified: code_cell_value.last_modified.clone(),
                            output: None,
                        },
                    ));
                }

                // create quadratic clipboard values
                cells.push(ClipboardCell {
                    value: value.clone(),
                    spill: spill_value.clone(),
                });

                // add styling for html (only used for pasting to other spreadsheets)
                // todo: add text color, fill, etc.
                let (bold, italic) =
                    if let Some(format) = sheet.get_existing_cell_format_summary(pos) {
                        (
                            format.bold.is_some_and(|bold| bold),
                            format.italic.is_some_and(|italic| italic),
                        )
                    } else {
                        (false, false)
                    };
                if bold || italic {
                    html.push_str("<span style={");
                    if bold {
                        html.push_str("font-weight:bold;");
                    }
                    if italic {
                        html.push_str("font-style:italic;");
                    }
                    html.push_str("}>");
                }
                if let Some(value) = value.as_ref() {
                    plain_text.push_str(&value.to_string());
                    html.push_str(&value.to_string());
                } else if let Some(spill_value) = spill_value.as_ref() {
                    plain_text.push_str(&spill_value.to_string());
                    html.push_str(&spill_value.to_string());
                };
                if bold || italic {
                    html.push_str("</span>");
                }
            }
        }

        let formats = self.get_all_cell_formats(sheet_rect);
        let borders = get_cell_borders_in_rect(sheet, sheet_rect.into());
        let clipboard = Clipboard {
            cells,
            formats,
            borders,
            code,
            w: sheet_rect.width() as u32,
            h: sheet_rect.height() as u32,
        };

        html.push_str("</tr></tbody></table>");
        let mut final_html = String::from("<table data-quadratic=\"");
        let data = serde_json::to_string(&clipboard).unwrap();
        let encoded = htmlescape::encode_attribute(&data);
        final_html.push_str(&encoded);
        final_html.push_str(&String::from("\">"));
        final_html.push_str(&html);
        (plain_text, final_html)
    }

    pub fn cut_to_clipboard(
        &mut self,
        sheet_rect: SheetRect,
        cursor: Option<String>,
    ) -> (TransactionSummary, String, String) {
        let (ops, plain_text, html) = self.cut_to_clipboard_operations(sheet_rect);
        let summary = self.start_user_transaction(ops, cursor);
        (summary, plain_text, html)
    }

    pub fn paste_from_clipboard(
        &mut self,
        sheet_pos: SheetPos,
        plain_text: Option<String>,
        html: Option<String>,
        cursor: Option<String>,
    ) -> TransactionSummary {
        // first try html
        if let Some(html) = html {
            if let Ok(ops) = self.paste_html_operations(sheet_pos, html) {
                self.start_user_transaction(ops, cursor)
            } else {
                TransactionSummary::default()
            }
        }
        // if not quadratic html, then use the plain text
        // first try html
        else if let Some(plain_text) = plain_text {
            let ops = self.paste_plain_text_operations(sheet_pos, plain_text);
            self.start_user_transaction(ops, cursor)
        } else {
            TransactionSummary::default()
        }
    }
}

#[cfg(test)]
mod test {
    use bigdecimal::BigDecimal;

    use crate::{
        color::Rgba,
        controller::GridController,
        grid::{
            generate_borders, js_types::CellFormatSummary, set_rect_borders, BorderSelection,
            BorderStyle, CellBorderLine, CodeCellLanguage, Sheet,
        },
        CellValue, Pos, Rect, SheetPos, SheetRect,
    };

    fn set_borders(sheet: &mut Sheet) {
        let selection = vec![BorderSelection::All];
        let style = BorderStyle {
            color: Rgba::from_str("#000000").unwrap(),
            line: CellBorderLine::Line1,
        };
        let rect = Rect::new_span(Pos { x: 0, y: 0 }, Pos { x: 0, y: 0 });
        let borders = generate_borders(sheet, &rect, selection, Some(style));
        set_rect_borders(sheet, &rect, borders);
    }

    #[test]
    fn test_copy_to_clipboard() {
        let mut gc = GridController::default();
        let sheet_id = gc.sheet_ids()[0];

        gc.set_cell_value(
            SheetPos {
                x: 1,
                y: 1,
                sheet_id,
            },
            String::from("1, 1"),
            None,
        );
        gc.set_cell_bold(
            SheetRect {
                min: Pos { x: 1, y: 1 },
                max: Pos { x: 1, y: 1 },
                sheet_id,
            },
            Some(true),
            None,
        );

        gc.set_cell_value(
            SheetPos {
                x: 3,
                y: 2,
                sheet_id,
            },
            String::from("12"),
            None,
        );
        gc.set_cell_italic(
            SheetRect {
                min: Pos { x: 3, y: 2 },
                max: Pos { x: 3, y: 2 },
                sheet_id,
            },
            Some(true),
            None,
        );

        let sheet_rect = SheetRect {
            min: Pos { x: 1, y: 1 },
            max: Pos { x: 3, y: 2 },
            sheet_id,
        };

        let (plain_text, _) = gc.copy_to_clipboard(sheet_rect);
        assert_eq!(plain_text, String::from("1, 1\t\t\n\t\t12"));

        let sheet_rect = SheetRect::new_pos_span(Pos { x: 0, y: 0 }, Pos { x: 3, y: 3 }, sheet_id);
        let clipboard = gc.copy_to_clipboard(sheet_rect);

        // paste using plain_text
        let mut gc = GridController::default();
        let sheet_id = gc.sheet_ids()[0];
        gc.paste_from_clipboard(
            SheetPos {
                x: 0,
                y: 0,
                sheet_id,
            },
            Some(clipboard.clone().0),
            None,
            None,
        );
        let sheet = gc.sheet(sheet_id);
        assert_eq!(
            sheet.get_cell_value(Pos { x: 1, y: 1 }),
            Some(CellValue::Text(String::from("1, 1")))
        );
        assert_eq!(
            sheet.get_cell_value(Pos { x: 3, y: 2 }),
            Some(CellValue::Number(BigDecimal::from(12)))
        );

        // paste using html
        let mut gc = GridController::default();
        let sheet_id = gc.sheet_ids()[0];
        gc.paste_from_clipboard(
            SheetPos {
                x: 0,
                y: 0,
                sheet_id,
            },
            Some(String::from("")),
            Some(clipboard.clone().1),
            None,
        );
        let sheet = gc.sheet(sheet_id);
        assert_eq!(
            sheet.get_cell_value(Pos { x: 1, y: 1 }),
            Some(CellValue::Text(String::from("1, 1")))
        );
        assert_eq!(
            sheet.get_cell_format_summary(Pos { x: 1, y: 1 }),
            CellFormatSummary {
                bold: Some(true),
                italic: None,
                text_color: None,
                fill_color: None,
            }
        );
        assert_eq!(
            sheet.get_cell_value(Pos { x: 3, y: 2 }),
            Some(CellValue::Number(BigDecimal::from(12)))
        );
        assert_eq!(
            sheet.get_cell_format_summary(Pos { x: 3, y: 2 }),
            CellFormatSummary {
                bold: None,
                italic: Some(true),
                text_color: None,
                fill_color: None,
            }
        );

        // use to create output for test_paste_from_quadratic_clipboard()
        // print!("{}", clipboard.1);
    }

    #[test]
    fn test_copy_code_to_clipboard() {
        let mut gc = GridController::default();
        let sheet_id = gc.sheet_ids()[0];

        gc.set_cell_code(
            SheetPos {
                x: 1,
                y: 1,
                sheet_id,
            },
            CodeCellLanguage::Formula,
            String::from("1 + 1"),
            None,
        );

        assert_eq!(gc.undo_stack.len(), 1);

        let sheet_rect = SheetRect::new_pos_span(Pos { x: 1, y: 1 }, Pos { x: 1, y: 1 }, sheet_id);
        let clipboard = gc.copy_to_clipboard(sheet_rect);

        // paste using html
        let mut gc = GridController::default();
        let sheet_id = gc.sheet_ids()[0];

        assert_eq!(gc.undo_stack.len(), 0);

        // overwrite an existing code cell
        gc.set_cell_code(
            SheetPos {
                x: 0,
                y: 0,
                sheet_id,
            },
            CodeCellLanguage::Formula,
            String::from("2 + 2"),
            None,
        );

        assert_eq!(gc.undo_stack.len(), 1);

        gc.paste_from_clipboard(
            SheetPos {
                x: 0,
                y: 0,
                sheet_id,
            },
            Some(String::from("")),
            Some(clipboard.1),
            None,
        );
        let sheet = gc.sheet(sheet_id);
        assert_eq!(
            sheet.get_cell_value(Pos { x: 0, y: 0 }),
            Some(CellValue::Number(BigDecimal::from(2)))
        );

        assert_eq!(gc.undo_stack.len(), 2);

        // original code cell value
        gc.undo(None);
        let sheet = gc.sheet(sheet_id);
        assert_eq!(
            sheet.get_cell_value(Pos { x: 0, y: 0 }),
            Some(CellValue::Number(BigDecimal::from(4)))
        );

        assert_eq!(gc.undo_stack.len(), 1);

        // empty code cell
        gc.undo(None);
        let sheet = gc.sheet(sheet_id);
        assert_eq!(sheet.get_cell_value(Pos { x: 0, y: 0 }), None);

        assert_eq!(gc.undo_stack.len(), 0);
    }

    #[test]
    fn test_copy_borders_to_clipboard() {
        let mut gc = GridController::default();
        let sheet_id = gc.sheet_ids()[0];
        let sheet = gc.grid_mut().sheet_mut_from_id(sheet_id);

        set_borders(sheet);

        let sheet_rect = SheetRect::new_pos_span(Pos { x: 0, y: 0 }, Pos { x: 0, y: 0 }, sheet_id);
        let clipboard = gc.copy_to_clipboard(sheet_rect);

        gc.paste_from_clipboard(
            SheetPos {
                x: 3,
                y: 3,
                sheet_id,
            },
            Some(String::from("")),
            Some(clipboard.1),
            None,
        );

        let borders = gc
            .sheet(sheet_id)
            .borders()
            .per_cell
            .borders
            .iter()
            .collect::<Vec<_>>();

        // compare the border info stored in the block's content
        assert_eq!(
            borders[0].1.blocks().next().unwrap().content,
            borders[1].1.blocks().next().unwrap().content
        );
    }

    #[test]
    fn test_copy_borders_inside() {
        let mut gc = GridController::default();
        let sheet_id = gc.sheet_ids()[0];
        let sheet = gc.grid_mut().sheet_mut_from_id(sheet_id);

        let selection = vec![BorderSelection::Outer];
        let style = BorderStyle {
            color: Rgba::from_str("#000000").unwrap(),
            line: CellBorderLine::Line1,
        };
        let rect = Rect::new_span(Pos { x: 0, y: 0 }, Pos { x: 4, y: 4 });
        let borders = generate_borders(sheet, &rect, selection, Some(style));
        set_rect_borders(sheet, &rect, borders);

        // weird: can't test them by comparing arrays since the order is seemingly random
        let render = gc.get_render_borders(sheet_id.to_string());
        assert!(render.get_horizontal().iter().any(|border| {
            border.x == 0
                && border.y == 0
                && border.w == Some(5)
                && border.h.is_none()
                && border.style == style
        }));
        assert!(render.get_horizontal().iter().any(|border| {
            border.x == 0
                && border.y == 5
                && border.w == Some(5)
                && border.h.is_none()
                && border.style == style
        }));
        assert!(render.get_vertical().iter().any(|border| {
            border.x == 0
                && border.y == 0
                && border.w.is_none()
                && border.h == Some(5)
                && border.style == style
        }));

        assert!(render.get_vertical().iter().any(|border| {
            border.x == 5
                && border.y == 0
                && border.w.is_none()
                && border.h == Some(5)
                && border.style == style
        }));

        let (_, html) = gc.copy_to_clipboard(SheetRect::new_pos_span(
            Pos { x: 0, y: 0 },
            Pos { x: 4, y: 4 },
            sheet_id,
        ));
        let _ = gc.paste_from_clipboard(
            SheetPos {
                x: 0,
                y: 10,
                sheet_id,
            },
            None,
            Some(html),
            None,
        );

        let render = gc.get_render_borders(sheet_id.to_string());
        assert!(render.get_horizontal().iter().any(|border| {
            border.x == 0
                && border.y == 10
                && border.w == Some(5)
                && border.h.is_none()
                && border.style == style
        }));
        assert!(render.get_horizontal().iter().any(|border| {
            border.x == 0
                && border.y == 15
                && border.w == Some(5)
                && border.h.is_none()
                && border.style == style
        }));
        assert!(render.get_vertical().iter().any(|border| {
            border.x == 0
                && border.y == 10
                && border.w.is_none()
                && border.h == Some(5)
                && border.style == style
        }));
        assert!(render.get_vertical().iter().any(|border| {
            border.x == 5
                && border.y == 10
                && border.w.is_none()
                && border.h == Some(5)
                && border.style == style
        }));
    }

    #[test]
    fn test_paste_from_quadratic_clipboard() {
        let mut gc = GridController::default();
        let sheet_id = gc.sheet_ids()[0];

        // see line 489 for the output
        let pasted_output = String::from(
            r#"<table data-quadratic="&#x7B;&quot;w&quot;&#x3A;4&#x2C;&quot;h&quot;&#x3A;4&#x2C;&quot;cells&quot;&#x3A;&#x5B;&#x7B;&quot;value&quot;&#x3A;null&#x2C;&quot;spill&quot;&#x3A;null&#x7D;&#x2C;&#x7B;&quot;value&quot;&#x3A;null&#x2C;&quot;spill&quot;&#x3A;null&#x7D;&#x2C;&#x7B;&quot;value&quot;&#x3A;null&#x2C;&quot;spill&quot;&#x3A;null&#x7D;&#x2C;&#x7B;&quot;value&quot;&#x3A;null&#x2C;&quot;spill&quot;&#x3A;null&#x7D;&#x2C;&#x7B;&quot;value&quot;&#x3A;null&#x2C;&quot;spill&quot;&#x3A;null&#x7D;&#x2C;&#x7B;&quot;value&quot;&#x3A;&#x7B;&quot;type&quot;&#x3A;&quot;text&quot;&#x2C;&quot;value&quot;&#x3A;&quot;1&#x2C;&#x20;1&quot;&#x7D;&#x2C;&quot;spill&quot;&#x3A;null&#x7D;&#x2C;&#x7B;&quot;value&quot;&#x3A;null&#x2C;&quot;spill&quot;&#x3A;null&#x7D;&#x2C;&#x7B;&quot;value&quot;&#x3A;null&#x2C;&quot;spill&quot;&#x3A;null&#x7D;&#x2C;&#x7B;&quot;value&quot;&#x3A;null&#x2C;&quot;spill&quot;&#x3A;null&#x7D;&#x2C;&#x7B;&quot;value&quot;&#x3A;null&#x2C;&quot;spill&quot;&#x3A;null&#x7D;&#x2C;&#x7B;&quot;value&quot;&#x3A;null&#x2C;&quot;spill&quot;&#x3A;null&#x7D;&#x2C;&#x7B;&quot;value&quot;&#x3A;&#x7B;&quot;type&quot;&#x3A;&quot;number&quot;&#x2C;&quot;value&quot;&#x3A;&quot;12&quot;&#x7D;&#x2C;&quot;spill&quot;&#x3A;null&#x7D;&#x2C;&#x7B;&quot;value&quot;&#x3A;null&#x2C;&quot;spill&quot;&#x3A;null&#x7D;&#x2C;&#x7B;&quot;value&quot;&#x3A;null&#x2C;&quot;spill&quot;&#x3A;null&#x7D;&#x2C;&#x7B;&quot;value&quot;&#x3A;null&#x2C;&quot;spill&quot;&#x3A;null&#x7D;&#x2C;&#x7B;&quot;value&quot;&#x3A;null&#x2C;&quot;spill&quot;&#x3A;null&#x7D;&#x5D;&#x2C;&quot;formats&quot;&#x3A;&#x5B;&#x7B;&quot;Align&quot;&#x3A;&#x5B;&#x5B;null&#x2C;16&#x5D;&#x5D;&#x7D;&#x2C;&#x7B;&quot;Wrap&quot;&#x3A;&#x5B;&#x5B;null&#x2C;16&#x5D;&#x5D;&#x7D;&#x2C;&#x7B;&quot;NumericFormat&quot;&#x3A;&#x5B;&#x5B;null&#x2C;16&#x5D;&#x5D;&#x7D;&#x2C;&#x7B;&quot;NumericDecimals&quot;&#x3A;&#x5B;&#x5B;null&#x2C;16&#x5D;&#x5D;&#x7D;&#x2C;&#x7B;&quot;Bold&quot;&#x3A;&#x5B;&#x5B;null&#x2C;5&#x5D;&#x2C;&#x5B;true&#x2C;1&#x5D;&#x2C;&#x5B;null&#x2C;10&#x5D;&#x5D;&#x7D;&#x2C;&#x7B;&quot;Italic&quot;&#x3A;&#x5B;&#x5B;null&#x2C;11&#x5D;&#x2C;&#x5B;true&#x2C;1&#x5D;&#x2C;&#x5B;null&#x2C;4&#x5D;&#x5D;&#x7D;&#x2C;&#x7B;&quot;TextColor&quot;&#x3A;&#x5B;&#x5B;null&#x2C;16&#x5D;&#x5D;&#x7D;&#x2C;&#x7B;&quot;FillColor&quot;&#x3A;&#x5B;&#x5B;null&#x2C;16&#x5D;&#x5D;&#x7D;&#x5D;&#x2C;&quot;borders&quot;&#x3A;&#x5B;&#x5B;1&#x2C;0&#x2C;null&#x5D;&#x2C;&#x5B;1&#x2C;1&#x2C;null&#x5D;&#x2C;&#x5B;1&#x2C;2&#x2C;null&#x5D;&#x2C;&#x5B;1&#x2C;3&#x2C;null&#x5D;&#x2C;&#x5B;3&#x2C;0&#x2C;null&#x5D;&#x2C;&#x5B;3&#x2C;1&#x2C;null&#x5D;&#x2C;&#x5B;3&#x2C;2&#x2C;null&#x5D;&#x2C;&#x5B;3&#x2C;3&#x2C;null&#x5D;&#x5D;&#x2C;&quot;code&quot;&#x3A;&#x5B;&#x5D;&#x7D;"><tbody><tr><td></td><td></td><td></td><td></tr><tr><td></td><td><span style={font-weight:bold;}>1, 1</span></td><td></td><td></tr><tr><td></td><td></td><td></td><td><span style={font-style:italic;}>12</span></tr><tr><td></td><td></td><td></td><td></tr></tbody></table>"#,
        );

        gc.paste_from_clipboard(
            SheetPos {
                x: 1,
                y: 2,
                sheet_id,
            },
            None,
            Some(pasted_output),
            None,
        );

        let sheet = gc.sheet(sheet_id);
        let cell11 = sheet.get_cell_value(Pos { x: 2, y: 3 });
        assert_eq!(cell11.unwrap(), CellValue::Text(String::from("1, 1")));
        let cell21 = sheet.get_cell_value(Pos { x: 4, y: 4 });
        assert_eq!(cell21.unwrap(), CellValue::Number(BigDecimal::from(12)));
    }
}
