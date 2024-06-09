use crate::cell_values::CellValues;
use crate::color::Rgba;
use crate::controller::active_transactions::transaction_name::TransactionName;
use crate::controller::{operations::clipboard::Clipboard, GridController};
use crate::formulas::replace_a1_notation;
use crate::grid::{CellAlign, CellVerticalAlign, CellWrap, CodeCellLanguage};
use crate::{grid::get_cell_borders_in_rect, Pos, SheetPos, SheetRect};
use crate::{CellValue, Rect};
use htmlescape;
use serde::{Deserialize, Serialize};

#[derive(Debug, Serialize, Deserialize, Clone, Copy)]
#[cfg_attr(feature = "js", derive(ts_rs::TS))]
pub enum PasteSpecial {
    None,
    Values,
    Formats,
}

// To view you clipboard contents, go to https://evercoder.github.io/clipboard-inspector/
// To decode the html, use https://codebeautify.org/html-decode-string

impl GridController {
    /// Copies clipboard to (plain_text, html).
    pub fn copy_to_clipboard(&self, sheet_rect: SheetRect) -> (String, String) {
        let mut cells = CellValues::new(sheet_rect.width() as u32, sheet_rect.height() as u32);
        let mut plain_text = String::new();
        let mut html = String::from("<tbody>");
        let mut values = CellValues::new(sheet_rect.width() as u32, sheet_rect.height() as u32);

        // todo: have function return an Option<(String, String)> and replace below with a question mark operator
        let Some(sheet) = self.try_sheet(sheet_rect.sheet_id) else {
            return (String::new(), String::new());
        };

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

                let pos = Pos { x, y };

                // the CellValue at the cell that would be displayed in the cell (ie, including code_runs)
                let simple_value = sheet.display_value(pos);

                // the CellValue at the cell (ignoring code_runs)
                let real_value = sheet.cell_value(pos);

                // create quadratic clipboard values
                if let Some(mut real_value) = real_value {
                    // replace cell references in formulas
                    match &mut real_value {
                        CellValue::Code(code_cell) => {
                            if matches!(code_cell.language, CodeCellLanguage::Formula) {
                                code_cell.code = replace_a1_notation(&code_cell.code, pos);
                            }
                        }
                        _ => { /* noop */ }
                    };

                    cells.set(
                        (x - sheet_rect.min.x) as u32,
                        (y - sheet_rect.min.y) as u32,
                        real_value,
                    );
                }

                // create quadratic clipboard value-only
                if let Some(simple_value) = &simple_value {
                    values.set(
                        (x - sheet_rect.min.x) as u32,
                        (y - sheet_rect.min.y) as u32,
                        simple_value.clone(),
                    );
                }

                // add styling for html (only used for pasting to other spreadsheets)
                let mut style = String::new();

                let (bold, italic, text_color, fill_color) =
                    if let Some(format) = sheet.get_existing_cell_format_summary(pos) {
                        (
                            format.bold.is_some_and(|bold| bold),
                            format.italic.is_some_and(|italic| italic),
                            format.text_color,
                            format.fill_color,
                        )
                    } else {
                        (false, false, None, None)
                    };

                let cell_border = sheet.borders().per_cell.to_owned().get_cell_border(pos);

                let cell_align = sheet.get_formatting_value::<CellAlign>(pos);

                let cell_vertical_align = sheet.get_formatting_value::<CellVerticalAlign>(pos);

                let cell_wrap = sheet.get_formatting_value::<CellWrap>(pos);

                if bold
                    || italic
                    || text_color.is_some()
                    || fill_color.is_some()
                    || cell_border.is_some()
                    || cell_align.is_some()
                    || cell_vertical_align.is_some()
                    || cell_wrap.is_some()
                {
                    style.push_str("style=\"");

                    if bold {
                        style.push_str("font-weight:bold;");
                    }
                    if italic {
                        style.push_str("font-style:italic;");
                    }
                    if let Some(text_color) = text_color {
                        if let Ok(text_color) = Rgba::from_css_str(text_color.as_str()) {
                            style.push_str(format!("color:{};", text_color.as_rgb_hex()).as_str());
                        }
                    }
                    if let Some(fill_color) = fill_color {
                        if let Ok(fill_color) = Rgba::from_css_str(fill_color.as_str()) {
                            style.push_str(
                                format!("background-color:{};", fill_color.as_rgb_hex()).as_str(),
                            );
                        }
                    }
                    if let Some(cell_border) = cell_border {
                        for (side, border) in cell_border.borders.iter().enumerate() {
                            let side = match side {
                                0 => "-left",
                                1 => "-top",
                                2 => "-right",
                                3 => "-bottom",
                                _ => "",
                            };
                            if let Some(border) = border {
                                style.push_str(
                                    format!(
                                        "border{}: {} {};",
                                        side,
                                        border.line.as_css_string(),
                                        border.color.as_rgb_hex()
                                    )
                                    .as_str(),
                                );
                            }
                        }
                    }
                    if let Some(cell_align) = cell_align {
                        style.push_str(&cell_align.as_css_string());
                    }
                    if let Some(cell_vertical_align) = cell_vertical_align {
                        style.push_str(&cell_vertical_align.as_css_string());
                    }
                    if let Some(cell_wrap) = cell_wrap {
                        style.push_str(cell_wrap.as_css_string());
                    }

                    style.push('"');
                }

                html.push_str(format!("<td {}>", style).as_str());

                if let Some(value) = &simple_value {
                    plain_text.push_str(&value.to_string());
                    html.push_str(&value.to_string());
                }
            }
        }

        let clipboard_rect: Rect = sheet_rect.into();

        // allow copying of code_run values (unless CellValue::Code is also in the clipboard)
        sheet
            .iter_code_output_in_rect(clipboard_rect)
            .filter(|(_, code_cell)| !code_cell.spill_error)
            .for_each(|(output_rect, code_cell)| {
                // only change the cells if the CellValue::Code is not in the selection box
                let code_pos = Pos {
                    x: output_rect.min.x,
                    y: output_rect.min.y,
                };
                let x_start = if output_rect.min.x > clipboard_rect.min.x {
                    output_rect.min.x
                } else {
                    clipboard_rect.min.x
                };
                let y_start = if output_rect.min.y > clipboard_rect.min.y {
                    output_rect.min.y
                } else {
                    clipboard_rect.min.y
                };
                let x_end = if output_rect.max.x < clipboard_rect.max.x {
                    output_rect.max.x
                } else {
                    clipboard_rect.max.x
                };
                let y_end = if output_rect.max.y < clipboard_rect.max.y {
                    output_rect.max.y
                } else {
                    clipboard_rect.max.y
                };

                // add the CellValue to cells if the code is not included in the clipboard
                let include_in_cells = !clipboard_rect.contains(code_pos);

                // add the code_run output to clipboard.values
                for y in y_start..=y_end {
                    for x in x_start..=x_end {
                        if let Some(value) = code_cell
                            .cell_value_at((x - code_pos.x) as u32, (y - code_pos.y) as u32)
                        {
                            if include_in_cells {
                                cells.set(
                                    (x - sheet_rect.min.x) as u32,
                                    (y - sheet_rect.min.y) as u32,
                                    value.clone(),
                                );
                            }
                            values.set(
                                (x - sheet_rect.min.x) as u32,
                                (y - sheet_rect.min.y) as u32,
                                value,
                            );
                        }
                    }
                }
            });

        let formats = self.get_all_cell_formats(sheet_rect);
        let borders = get_cell_borders_in_rect(sheet, sheet_rect.into());
        let clipboard = Clipboard {
            cells,
            formats,
            borders,
            values,
            w: sheet_rect.width() as u32,
            h: sheet_rect.height() as u32,
        };

        html.push_str("</td></tr></tbody></table>");
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
    ) -> (String, String) {
        let (ops, plain_text, html) = self.cut_to_clipboard_operations(sheet_rect);
        self.start_user_transaction(
            ops,
            cursor,
            TransactionName::CutClipboard,
            Some(sheet_rect.sheet_id),
            Some(sheet_rect.into()),
        );
        (plain_text, html)
    }

    pub fn paste_from_clipboard(
        &mut self,
        dest_pos: SheetPos,
        plain_text: Option<String>,
        html: Option<String>,
        special: PasteSpecial,
        cursor: Option<String>,
    ) {
        // first try html
        if let Some(html) = html {
            if let Ok(ops) = self.paste_html_operations(dest_pos, html, special) {
                return self.start_user_transaction(
                    ops,
                    cursor,
                    TransactionName::PasteClipboard,
                    Some(dest_pos.sheet_id),
                    Some(Rect::single_pos(dest_pos.into())),
                );
            }
        }
        // if not quadratic html, then use the plain text
        // first try html
        if let Some(plain_text) = plain_text {
            let ops = self.paste_plain_text_operations(dest_pos, plain_text, special);
            self.start_user_transaction(
                ops,
                cursor,
                TransactionName::PasteClipboard,
                Some(dest_pos.sheet_id),
                Some(Rect::single_pos(dest_pos.into())),
            );
        }
    }

    pub fn move_cells(&mut self, source: SheetRect, dest: SheetPos, cursor: Option<String>) {
        let ops = self.move_cells_operations(source, dest);
        self.start_user_transaction(
            ops,
            cursor,
            TransactionName::PasteClipboard,
            Some(source.sheet_id),
            Some(source.into()),
        );
    }
}

#[cfg(test)]
mod test {
    use super::*;
    use crate::{
        color::Rgba,
        controller::GridController,
        grid::{
            generate_borders, js_types::CellFormatSummary, set_rect_borders, BorderSelection,
            BorderStyle, CellBorderLine, CodeCellLanguage, Sheet, SheetId,
        },
        CellValue, CodeCellValue, Pos, Rect, SheetPos, SheetRect,
    };
    use bigdecimal::BigDecimal;

    fn set_borders(sheet: &mut Sheet) {
        let selection = vec![BorderSelection::All];
        let style = BorderStyle {
            color: Rgba::color_from_str("#000000").unwrap(),
            line: CellBorderLine::Line1,
        };
        let rect = Rect::new_span(Pos { x: 0, y: 0 }, Pos { x: 0, y: 0 });
        let borders = generate_borders(sheet, &rect, selection, Some(style));
        set_rect_borders(sheet, &rect, borders);
    }

    fn set_cell_value(gc: &mut GridController, sheet_id: SheetId, value: &str, x: i64, y: i64) {
        gc.set_cell_value(SheetPos { x, y, sheet_id }, value.into(), None);
    }

    fn set_code_cell(
        gc: &mut GridController,
        sheet_id: SheetId,
        language: CodeCellLanguage,
        code: &str,
        x: i64,
        y: i64,
    ) {
        gc.set_code_cell(SheetPos { x, y, sheet_id }, language, code.into(), None);
    }

    fn set_formula_code_cell(
        gc: &mut GridController,
        sheet_id: SheetId,
        code: &str,
        x: i64,
        y: i64,
    ) {
        set_code_cell(gc, sheet_id, CodeCellLanguage::Formula, code, x, y);
    }

    #[test]
    fn test_copy_to_clipboard() {
        let mut gc = GridController::default();
        let sheet_id = gc.sheet_ids()[0];

        set_cell_value(&mut gc, sheet_id, "1, 1", 1, 1);
        gc.set_cell_bold(
            SheetRect {
                min: Pos { x: 1, y: 1 },
                max: Pos { x: 1, y: 1 },
                sheet_id,
            },
            Some(true),
            None,
        );
        set_cell_value(&mut gc, sheet_id, "12", 3, 2);
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
            (0, 0, sheet_id).into(),
            Some(clipboard.clone().0),
            None,
            PasteSpecial::None,
            None,
        );

        let sheet = gc.sheet(sheet_id);
        assert_eq!(
            sheet.display_value(Pos { x: 1, y: 1 }),
            Some(CellValue::Text(String::from("1, 1")))
        );
        assert_eq!(
            sheet.display_value(Pos { x: 3, y: 2 }),
            Some(CellValue::Number(BigDecimal::from(12)))
        );

        // paste using html
        let mut gc = GridController::default();
        let sheet_id = gc.sheet_ids()[0];
        gc.paste_from_clipboard(
            (0, 0, sheet_id).into(),
            Some(String::from("")),
            Some(clipboard.clone().1),
            PasteSpecial::None,
            None,
        );
        let sheet = gc.sheet(sheet_id);
        assert_eq!(
            sheet.display_value(Pos { x: 1, y: 1 }),
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
            sheet.display_value(Pos { x: 3, y: 2 }),
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

        set_formula_code_cell(&mut gc, sheet_id, "1 + 1", 1, 1);

        assert_eq!(gc.undo_stack.len(), 1);
        let sheet = gc.sheet(sheet_id);
        assert_eq!(
            sheet.display_value(Pos { x: 1, y: 1 }),
            Some(CellValue::Number(BigDecimal::from(2)))
        );

        let sheet_rect = SheetRect::new_pos_span(Pos { x: 1, y: 1 }, Pos { x: 1, y: 1 }, sheet_id);
        let clipboard = gc.copy_to_clipboard(sheet_rect);

        // paste using html on a new grid controller
        let mut gc = GridController::default();
        let sheet_id = gc.sheet_ids()[0];

        // ensure the grid controller is empty
        assert_eq!(gc.undo_stack.len(), 0);

        gc.paste_from_clipboard(
            (0, 0, sheet_id).into(),
            None,
            Some(clipboard.1.clone()),
            PasteSpecial::None,
            None,
        );
        let sheet = gc.sheet(sheet_id);
        assert_eq!(
            sheet.display_value(Pos { x: 0, y: 0 }),
            Some(CellValue::Number(BigDecimal::from(2)))
        );
        gc.undo(None);
        let sheet = gc.sheet(sheet_id);
        assert_eq!(sheet.display_value(Pos { x: 0, y: 0 }), None);

        // prepare a cell to be overwritten
        set_formula_code_cell(&mut gc, sheet_id, "2 + 2", 0, 0);

        assert_eq!(gc.undo_stack.len(), 1);

        let sheet = gc.sheet(sheet_id);
        assert_eq!(
            sheet.display_value(Pos { x: 0, y: 0 }),
            Some(CellValue::Number(BigDecimal::from(4)))
        );

        gc.paste_from_clipboard(
            (0, 0, sheet_id).into(),
            Some(String::from("")),
            Some(clipboard.1),
            PasteSpecial::None,
            None,
        );
        let sheet = gc.sheet(sheet_id);
        assert_eq!(
            sheet.display_value(Pos { x: 0, y: 0 }),
            Some(CellValue::Number(BigDecimal::from(2)))
        );

        assert_eq!(gc.undo_stack.len(), 2);

        // undo to original code cell value
        gc.undo(None);

        let sheet = gc.sheet(sheet_id);
        assert_eq!(
            sheet.display_value(Pos { x: 0, y: 0 }),
            Some(CellValue::Number(BigDecimal::from(4)))
        );

        assert_eq!(gc.undo_stack.len(), 1);

        // empty code cell
        gc.undo(None);
        let sheet = gc.sheet(sheet_id);
        assert_eq!(sheet.display_value(Pos { x: 0, y: 0 }), None);

        assert_eq!(gc.undo_stack.len(), 0);
    }

    #[test]
    fn test_copy_code_to_clipboard_with_array_output() {
        let mut gc = GridController::default();
        let sheet_id = gc.sheet_ids()[0];

        set_formula_code_cell(&mut gc, sheet_id, "{1, 2, 3}", 1, 1);

        assert_eq!(gc.undo_stack.len(), 1);
        let sheet = gc.sheet(sheet_id);
        assert_eq!(
            sheet.display_value(Pos { x: 1, y: 1 }),
            Some(CellValue::Number(BigDecimal::from(1)))
        );
        assert_eq!(
            sheet.display_value(Pos { x: 2, y: 1 }),
            Some(CellValue::Number(BigDecimal::from(2)))
        );
        assert_eq!(
            sheet.display_value(Pos { x: 3, y: 1 }),
            Some(CellValue::Number(BigDecimal::from(3)))
        );
        let sheet_rect = SheetRect::new_pos_span(Pos { x: 1, y: 1 }, Pos { x: 3, y: 1 }, sheet_id);
        let clipboard = gc.copy_to_clipboard(sheet_rect);

        // paste using html on a new grid controller
        let mut gc = GridController::default();
        let sheet_id = gc.sheet_ids()[0];

        // ensure the grid controller is empty
        assert_eq!(gc.undo_stack.len(), 0);

        gc.paste_from_clipboard(
            (0, 0, sheet_id).into(),
            None,
            Some(clipboard.1.clone()),
            PasteSpecial::None,
            None,
        );
        let sheet = gc.sheet(sheet_id);
        assert_eq!(
            sheet.display_value(Pos { x: 0, y: 0 }),
            Some(CellValue::Number(BigDecimal::from(1)))
        );
        assert_eq!(
            sheet.display_value(Pos { x: 1, y: 0 }),
            Some(CellValue::Number(BigDecimal::from(2)))
        );
        assert_eq!(
            sheet.display_value(Pos { x: 2, y: 0 }),
            Some(CellValue::Number(BigDecimal::from(3)))
        );

        gc.undo(None);
        let sheet = gc.sheet(sheet_id);
        assert_eq!(sheet.display_value(Pos { x: 0, y: 0 }), None);
        assert_eq!(sheet.display_value(Pos { x: 1, y: 0 }), None);
        assert_eq!(sheet.display_value(Pos { x: 2, y: 0 }), None);
    }

    #[test]
    fn test_copy_borders_to_clipboard() {
        let mut gc = GridController::default();
        let sheet_id = gc.sheet_ids()[0];
        let sheet = gc.sheet_mut(sheet_id);

        set_borders(sheet);

        let sheet_rect = SheetRect::new_pos_span(Pos { x: 0, y: 0 }, Pos { x: 0, y: 0 }, sheet_id);
        let clipboard = gc.copy_to_clipboard(sheet_rect);

        gc.paste_from_clipboard(
            (3, 3, sheet_id).into(),
            Some(String::from("")),
            Some(clipboard.1),
            PasteSpecial::None,
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
        let sheet = gc.sheet_mut(sheet_id);

        let selection = vec![BorderSelection::Outer];
        let style = BorderStyle {
            color: Rgba::color_from_str("#000000").unwrap(),
            line: CellBorderLine::Line1,
        };
        let rect = Rect::new_span(Pos { x: 0, y: 0 }, Pos { x: 4, y: 4 });
        let borders = generate_borders(sheet, &rect, selection, Some(style));
        set_rect_borders(sheet, &rect, borders);

        // weird: can't test them by comparing arrays since the order is seemingly random
        let borders = sheet.render_borders();
        assert!(borders.horizontal.iter().any(|border| {
            border.x == 0
                && border.y == 0
                && border.w == Some(5)
                && border.h.is_none()
                && border.style == style
        }));
        assert!(borders.horizontal.iter().any(|border| {
            border.x == 0
                && border.y == 5
                && border.w == Some(5)
                && border.h.is_none()
                && border.style == style
        }));
        assert!(borders.vertical.iter().any(|border| {
            border.x == 0
                && border.y == 0
                && border.w.is_none()
                && border.h == Some(5)
                && border.style == style
        }));

        assert!(borders.vertical.iter().any(|border| {
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
        gc.paste_from_clipboard(
            SheetPos {
                x: 0,
                y: 10,
                sheet_id,
            },
            None,
            Some(html),
            PasteSpecial::None,
            None,
        );

        let sheet = gc.sheet_mut(sheet_id);
        let borders = sheet.render_borders();
        assert!(borders.horizontal.iter().any(|border| {
            border.x == 0
                && border.y == 10
                && border.w == Some(5)
                && border.h.is_none()
                && border.style == style
        }));
        assert!(borders.horizontal.iter().any(|border| {
            border.x == 0
                && border.y == 15
                && border.w == Some(5)
                && border.h.is_none()
                && border.style == style
        }));
        assert!(borders.vertical.iter().any(|border| {
            border.x == 0
                && border.y == 10
                && border.w.is_none()
                && border.h == Some(5)
                && border.style == style
        }));
        assert!(borders.vertical.iter().any(|border| {
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

        // see line ~357 for the output (`print!("{}", clipboard.1);`)
        let pasted_output = String::from(
            r#"<table data-quadratic="&#x7B;&quot;w&quot;&#x3A;4&#x2C;&quot;h&quot;&#x3A;4&#x2C;&quot;cells&quot;&#x3A;&#x7B;&quot;columns&quot;&#x3A;&#x5B;&#x7B;&#x7D;&#x2C;&#x7B;&quot;1&quot;&#x3A;&#x7B;&quot;type&quot;&#x3A;&quot;text&quot;&#x2C;&quot;value&quot;&#x3A;&quot;1&#x2C;&#x20;1&quot;&#x7D;&#x7D;&#x2C;&#x7B;&#x7D;&#x2C;&#x7B;&quot;2&quot;&#x3A;&#x7B;&quot;type&quot;&#x3A;&quot;number&quot;&#x2C;&quot;value&quot;&#x3A;&quot;12&quot;&#x7D;&#x7D;&#x5D;&#x2C;&quot;w&quot;&#x3A;4&#x2C;&quot;h&quot;&#x3A;4&#x7D;&#x2C;&quot;values&quot;&#x3A;&#x7B;&quot;columns&quot;&#x3A;&#x5B;&#x7B;&#x7D;&#x2C;&#x7B;&quot;1&quot;&#x3A;&#x7B;&quot;type&quot;&#x3A;&quot;text&quot;&#x2C;&quot;value&quot;&#x3A;&quot;1&#x2C;&#x20;1&quot;&#x7D;&#x7D;&#x2C;&#x7B;&#x7D;&#x2C;&#x7B;&quot;2&quot;&#x3A;&#x7B;&quot;type&quot;&#x3A;&quot;number&quot;&#x2C;&quot;value&quot;&#x3A;&quot;12&quot;&#x7D;&#x7D;&#x5D;&#x2C;&quot;w&quot;&#x3A;4&#x2C;&quot;h&quot;&#x3A;4&#x7D;&#x2C;&quot;formats&quot;&#x3A;&#x5B;&#x7B;&quot;Align&quot;&#x3A;&#x5B;&#x5B;null&#x2C;16&#x5D;&#x5D;&#x7D;&#x2C;&#x7B;&quot;Wrap&quot;&#x3A;&#x5B;&#x5B;null&#x2C;16&#x5D;&#x5D;&#x7D;&#x2C;&#x7B;&quot;NumericFormat&quot;&#x3A;&#x5B;&#x5B;null&#x2C;16&#x5D;&#x5D;&#x7D;&#x2C;&#x7B;&quot;NumericDecimals&quot;&#x3A;&#x5B;&#x5B;null&#x2C;16&#x5D;&#x5D;&#x7D;&#x2C;&#x7B;&quot;NumericCommas&quot;&#x3A;&#x5B;&#x5B;null&#x2C;16&#x5D;&#x5D;&#x7D;&#x2C;&#x7B;&quot;Bold&quot;&#x3A;&#x5B;&#x5B;null&#x2C;5&#x5D;&#x2C;&#x5B;true&#x2C;1&#x5D;&#x2C;&#x5B;null&#x2C;10&#x5D;&#x5D;&#x7D;&#x2C;&#x7B;&quot;Italic&quot;&#x3A;&#x5B;&#x5B;null&#x2C;11&#x5D;&#x2C;&#x5B;true&#x2C;1&#x5D;&#x2C;&#x5B;null&#x2C;4&#x5D;&#x5D;&#x7D;&#x2C;&#x7B;&quot;TextColor&quot;&#x3A;&#x5B;&#x5B;null&#x2C;16&#x5D;&#x5D;&#x7D;&#x2C;&#x7B;&quot;FillColor&quot;&#x3A;&#x5B;&#x5B;null&#x2C;16&#x5D;&#x5D;&#x7D;&#x5D;&#x2C;&quot;borders&quot;&#x3A;&#x5B;&#x5B;0&#x2C;0&#x2C;null&#x5D;&#x2C;&#x5B;0&#x2C;1&#x2C;null&#x5D;&#x2C;&#x5B;0&#x2C;2&#x2C;null&#x5D;&#x2C;&#x5B;0&#x2C;3&#x2C;null&#x5D;&#x2C;&#x5B;1&#x2C;0&#x2C;null&#x5D;&#x2C;&#x5B;1&#x2C;1&#x2C;null&#x5D;&#x2C;&#x5B;1&#x2C;2&#x2C;null&#x5D;&#x2C;&#x5B;1&#x2C;3&#x2C;null&#x5D;&#x2C;&#x5B;2&#x2C;0&#x2C;null&#x5D;&#x2C;&#x5B;2&#x2C;1&#x2C;null&#x5D;&#x2C;&#x5B;2&#x2C;2&#x2C;null&#x5D;&#x2C;&#x5B;2&#x2C;3&#x2C;null&#x5D;&#x2C;&#x5B;3&#x2C;0&#x2C;null&#x5D;&#x2C;&#x5B;3&#x2C;1&#x2C;null&#x5D;&#x2C;&#x5B;3&#x2C;2&#x2C;null&#x5D;&#x2C;&#x5B;3&#x2C;3&#x2C;null&#x5D;&#x5D;&#x7D;"><tbody><tr><td></td><td></td><td></td><td></tr><tr><td></td><td><span style={font-weight:bold;}>1, 1</span></td><td></td><td></tr><tr><td></td><td></td><td></td><td><span style={font-style:italic;}>12</span></tr><tr><td></td><td></td><td></td><td></tr></tbody></table>"#,
        );

        gc.paste_from_clipboard(
            (1, 2, sheet_id).into(),
            None,
            Some(pasted_output),
            PasteSpecial::None,
            None,
        );

        let sheet = gc.sheet(sheet_id);
        let cell11 = sheet.display_value(Pos { x: 2, y: 3 });
        assert_eq!(cell11.unwrap(), CellValue::Text(String::from("1, 1")));
        let cell21 = sheet.display_value(Pos { x: 4, y: 4 });
        assert_eq!(cell21.unwrap(), CellValue::Number(BigDecimal::from(12)));
    }

    // | 1 | A0           |
    // | 2 | [paste here] |
    //
    // paste the code cell (0,1) => A0 from the clipboard to (1,1),
    // expect value to change to 2
    #[test]
    fn test_paste_relative_code_from_quadratic_clipboard() {
        let mut gc = GridController::default();
        let sheet_id = gc.sheet_ids()[0];
        let src_pos: SheetPos = (3, 2, sheet_id).into();

        set_formula_code_cell(&mut gc, sheet_id, "SUM( C2)", src_pos.x, src_pos.y);
        set_cell_value(&mut gc, sheet_id, "1", 2, 2);
        set_cell_value(&mut gc, sheet_id, "2", 2, 3);
        set_cell_value(&mut gc, sheet_id, "3", 2, 4);

        // generate the html from the values above
        let (_, html) = gc.copy_to_clipboard(src_pos.into());

        let get_value = |gc: &GridController, x, y| {
            let sheet = gc.sheet(sheet_id);
            let cell_value = sheet.cell_value(Pos { x, y });
            let display_value = sheet.display_value(Pos { x, y });
            (cell_value, display_value)
        };

        let assert_code_cell = |gc: &mut GridController,
                                dest_pos: SheetPos,
                                code: &str,
                                value: i32| {
            gc.paste_from_clipboard(dest_pos, None, Some(html.clone()), PasteSpecial::None, None);

            let cell_value = get_value(gc, dest_pos.x, dest_pos.y);
            let expected_cell_value = Some(CellValue::Code(CodeCellValue {
                language: CodeCellLanguage::Formula,
                code: code.into(),
            }));
            let expected_display_value = Some(CellValue::Number(BigDecimal::from(value)));

            assert_eq!(cell_value, (expected_cell_value, expected_display_value));
        };

        // paste code cell (3,2) from the clipboard to (3,3)
        let dest_pos: SheetPos = (3, 3, sheet_id).into();
        assert_code_cell(&mut gc, dest_pos, "SUM( C3)", 2);

        // paste code cell (3,2) from the clipboard to (3,4)
        let dest_pos: SheetPos = (3, 4, sheet_id).into();
        assert_code_cell(&mut gc, dest_pos, "SUM( C4)", 3);
    }

    #[test]
    fn paste_special_values() {
        let mut gc = GridController::default();
        let sheet_id = gc.sheet_ids()[0];

        set_formula_code_cell(&mut gc, sheet_id, "{1, 2, 3}", 1, 1);

        let sheet = gc.sheet(sheet_id);
        assert_eq!(
            sheet.display_value(Pos { x: 1, y: 1 }),
            Some(CellValue::Number(BigDecimal::from(1)))
        );
        assert_eq!(
            sheet.display_value(Pos { x: 3, y: 1 }),
            Some(CellValue::Number(BigDecimal::from(3)))
        );

        let (plain, html) = gc.copy_to_clipboard(SheetRect {
            min: Pos { x: 1, y: 1 },
            max: Pos { x: 3, y: 1 },
            sheet_id,
        });

        gc.paste_from_clipboard(
            (0, 2, sheet_id).into(),
            Some(plain),
            Some(html),
            PasteSpecial::Values,
            None,
        );

        let sheet = gc.sheet(sheet_id);
        assert_eq!(
            sheet.cell_value(Pos { x: 0, y: 2 }),
            Some(CellValue::Number(BigDecimal::from(1)))
        );
        assert_eq!(
            sheet.cell_value(Pos { x: 1, y: 2 }),
            Some(CellValue::Number(BigDecimal::from(2)))
        );
        assert_eq!(
            sheet.cell_value(Pos { x: 2, y: 2 }),
            Some(CellValue::Number(BigDecimal::from(3)))
        );
    }

    #[test]
    fn paste_special_formats() {
        let mut gc = GridController::default();
        let sheet_id = gc.sheet_ids()[0];

        set_cell_value(&mut gc, sheet_id, "1", 1, 1);
        gc.set_cell_bold(
            SheetRect {
                min: Pos { x: 1, y: 1 },
                max: Pos { x: 1, y: 1 },
                sheet_id,
            },
            Some(true),
            None,
        );

        set_cell_value(&mut gc, sheet_id, "12", 2, 2);
        gc.set_cell_italic(
            SheetRect {
                min: Pos { x: 2, y: 2 },
                max: Pos { x: 2, y: 2 },
                sheet_id,
            },
            Some(true),
            None,
        );

        let sheet_rect = SheetRect {
            min: Pos { x: 0, y: 0 },
            max: Pos { x: 2, y: 2 },
            sheet_id,
        };

        let (plain_text, html) = gc.copy_to_clipboard(sheet_rect);
        assert_eq!(plain_text, String::from("\t\t\n\t1\t\n\t\t12"));

        let mut gc = GridController::default();
        let sheet_id = gc.sheet_ids()[0];
        gc.paste_from_clipboard(
            (0, 0, sheet_id).into(),
            Some(plain_text),
            Some(html),
            PasteSpecial::Formats,
            None,
        );
        let sheet = gc.sheet(sheet_id);
        assert_eq!(sheet.display_value(Pos { x: 1, y: 1 }), None);
        assert_eq!(sheet.display_value(Pos { x: 2, y: 2 }), None);
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
            sheet.get_cell_format_summary(Pos { x: 2, y: 2 }),
            CellFormatSummary {
                bold: None,
                italic: Some(true),
                text_color: None,
                fill_color: None,
            }
        );
    }

    #[test]
    fn copy_part_of_code_run() {
        let mut gc = GridController::default();
        let sheet_id = gc.sheet_ids()[0];

        set_formula_code_cell(&mut gc, sheet_id, "{1, 2, 3; 4, 5, 6}", 1, 1);

        let sheet = gc.sheet(sheet_id);
        assert_eq!(
            sheet.display_value(Pos { x: 1, y: 1 }),
            Some(CellValue::Number(BigDecimal::from(1)))
        );

        // don't copy the origin point
        let sheet_rect = SheetRect::new_pos_span(Pos { x: 2, y: 1 }, Pos { x: 3, y: 2 }, sheet_id);
        let clipboard = gc.copy_to_clipboard(sheet_rect);

        // paste using html on a new grid controller
        let mut gc = GridController::default();
        let sheet_id = gc.sheet_ids()[0];

        // ensure the grid controller is empty
        assert_eq!(gc.undo_stack.len(), 0);

        gc.paste_from_clipboard(
            (0, 0, sheet_id).into(),
            Some(clipboard.0),
            Some(clipboard.1),
            PasteSpecial::None,
            None,
        );
        let sheet = gc.sheet(sheet_id);
        assert_eq!(
            sheet.display_value(Pos { x: 0, y: 0 }),
            Some(CellValue::Number(BigDecimal::from(2)))
        );

        gc.undo(None);
        let sheet = gc.sheet(sheet_id);
        assert_eq!(sheet.display_value(Pos { x: 0, y: 0 }), None);
    }

    #[test]
    fn move_cells() {
        let mut gc = GridController::default();
        let sheet_id = gc.sheet_ids()[0];

        set_formula_code_cell(&mut gc, sheet_id, "{1, 2, 3; 4, 5, 6}", 0, 0);
        set_cell_value(&mut gc, sheet_id, "100", 0, 2);

        gc.move_cells(
            SheetRect::new_pos_span(Pos { x: 0, y: 0 }, Pos { x: 3, y: 2 }, sheet_id),
            (10, 10, sheet_id).into(),
            None,
        );

        let sheet = gc.sheet(sheet_id);
        assert_eq!(
            sheet.display_value((10, 10).into()),
            Some(CellValue::Number(BigDecimal::from(1)))
        );
        assert_eq!(
            sheet.display_value((10, 12).into()),
            Some(CellValue::Number(BigDecimal::from(100)))
        );
        assert_eq!(sheet.display_value((0, 0).into()), None);
        assert_eq!(sheet.display_value((0, 2).into()), None);

        gc.undo(None);

        let sheet = gc.sheet(sheet_id);
        assert_eq!(sheet.display_value((10, 10).into()), None);
        assert_eq!(sheet.display_value((10, 12).into()), None);
        assert_eq!(
            sheet.display_value((0, 0).into()),
            Some(CellValue::Number(BigDecimal::from(1)))
        );
        assert_eq!(
            sheet.display_value((0, 2).into()),
            Some(CellValue::Number(BigDecimal::from(100)))
        );
    }
}
