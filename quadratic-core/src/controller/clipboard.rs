use super::{
    formatting::CellFmtArray, operation::Operation, transaction_summary::TransactionSummary,
    transactions::TransactionType, GridController,
};
use crate::{
    grid::{
        generate_borders_full, get_cell_borders_in_rect, BorderSelection, CellBorders,
        CodeCellValue, RegionRef, SheetId,
    },
    Array, ArraySize, CellValue, Pos, Rect,
};
use htmlescape;
use regex::Regex;
use serde::{Deserialize, Serialize};

#[derive(Debug, Serialize, Deserialize)]
pub struct ClipboardCell {
    pub value: Option<CellValue>,
    pub spill: Option<CellValue>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct Clipboard {
    w: u32,
    h: u32,
    cells: Vec<ClipboardCell>,
    formats: Vec<CellFmtArray>,
    borders: Vec<(i64, i64, Option<CellBorders>)>,
    code: Vec<(Pos, CodeCellValue)>,
}

impl GridController {
    pub fn copy_to_clipboard(&self, sheet_id: SheetId, rect: Rect) -> (String, String) {
        let mut cells = vec![];
        let mut plain_text = String::new();
        let mut html = String::from("<tbody>");
        let mut code = vec![];
        let sheet = &mut self.grid().sheet_from_id(sheet_id);

        for y in rect.y_range() {
            if y != rect.min.y {
                plain_text.push('\n');
                html.push_str("</tr>");
            }
            html.push_str("<tr>");
            for x in rect.x_range() {
                if x != rect.min.x {
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
                            x: x - rect.min.x,
                            y: y - rect.min.y,
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
                if value.is_some() {
                    plain_text.push_str(&value.as_ref().unwrap().to_string());
                    html.push_str(&value.as_ref().unwrap().to_string());
                } else if spill_value.is_some() {
                    plain_text.push_str(&spill_value.as_ref().unwrap().to_string());
                    html.push_str(&spill_value.as_ref().unwrap().to_string());
                }
                if bold || italic {
                    html.push_str("</span>");
                }
            }
        }

        let formats = self.get_all_cell_formats(sheet_id, rect);
        let borders = get_cell_borders_in_rect(sheet, rect);
        let clipboard = Clipboard {
            cells,
            formats,
            borders,
            code,
            w: rect.width(),
            h: rect.height(),
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
        sheet_id: SheetId,
        rect: Rect,
        cursor: Option<String>,
    ) -> (TransactionSummary, String, String) {
        let copy = self.copy_to_clipboard(sheet_id, rect);
        let summary = self.delete_values_and_formatting(sheet_id, rect, cursor);
        (summary, copy.0, copy.1)
    }

    fn array_from_clipboard_cells(clipboard: Clipboard) -> Option<Array> {
        if clipboard.w == 0 && clipboard.h == 0 {
            return None;
        }

        let mut array = Array::new_empty(ArraySize::new(clipboard.w, clipboard.h).unwrap());
        let mut x = 0;
        let mut y = 0;

        clipboard.cells.iter().for_each(|cell| {
            let value = cell.value.to_owned().map_or(CellValue::Blank, |v| v);
            // ignore result errors
            let _ = array.set(x, y, value);

            x += 1;

            if x == clipboard.w {
                x = 0;
                y += 1;
            }
        });
        Some(array)
    }

    fn set_clipboard_cells(
        &mut self,
        sheet_id: SheetId,
        start_pos: Pos,
        clipboard: Clipboard,
        cursor: Option<String>,
    ) -> TransactionSummary {
        let mut compute = false;
        let rect = Rect {
            min: start_pos,
            max: Pos {
                x: start_pos.x + (clipboard.w as i64) - 1,
                y: start_pos.y + (clipboard.h as i64) - 1,
            },
        };
        let formats = clipboard.formats.clone();
        let borders = clipboard.borders.clone();
        let code = clipboard.code.clone();

        let mut ops = vec![];
        let region = self.region(sheet_id, rect);
        let values = GridController::array_from_clipboard_cells(clipboard);
        if let Some(values) = values {
            ops.push(Operation::SetCellValues {
                region: region.clone(),
                values,
            });
            compute = true;
        }

        let sheet = self.grid.sheet_mut_from_id(sheet_id);

        // remove any overlapping code cells (which will automatically set the reverse operations)
        region.iter().for_each(|cell_ref| {
            if let Some(_code_cell) = sheet.get_code_cell_from_ref(cell_ref) {
                if let Some(pos) = sheet.cell_ref_to_pos(cell_ref) {
                    // no need to clear code cells that are being pasted
                    if !code.iter().any(|(code_pos, _)| {
                        Pos {
                            x: code_pos.x + start_pos.x,
                            y: code_pos.y + start_pos.y,
                        } == pos
                    }) {
                        ops.push(Operation::SetCellCode {
                            cell_ref,
                            code_cell_value: None,
                        });
                        compute = true;
                    }
                }
            }
        });

        // add copied code cells to the sheet
        code.iter().for_each(|entry| {
            let cell_ref = sheet.get_or_create_cell_ref(Pos {
                x: entry.0.x + start_pos.x,
                y: entry.0.y + start_pos.y,
            });
            ops.push(Operation::SetCellCode {
                cell_ref,
                code_cell_value: Some(entry.1.clone()),
            });
            compute = true;
        });

        formats.iter().for_each(|format| {
            ops.push(Operation::SetCellFormats {
                region: region.clone(),
                attr: format.clone(),
            });
        });

        // add borders to the sheet
        borders.iter().for_each(|(x, y, cell_borders)| {
            if let Some(cell_borders) = cell_borders {
                let mut border_selections = vec![];
                let mut border_styles = vec![];
                let (column, _) = sheet.get_or_create_column(*x + start_pos.x);
                let row_id = sheet.get_or_create_row(*y + start_pos.y);
                let region = RegionRef {
                    sheet: sheet.id,
                    columns: vec![column.id],
                    rows: vec![row_id.id],
                };

                cell_borders
                    .borders
                    .iter()
                    .enumerate()
                    .for_each(|(index, border_style)| {
                        if let Some(border_style) = border_style.to_owned() {
                            let border_selection = match index {
                                0 => BorderSelection::Left,
                                1 => BorderSelection::Top,
                                2 => BorderSelection::Right,
                                3 => BorderSelection::Bottom,
                                _ => BorderSelection::Clear,
                            };
                            border_selections.push(border_selection);
                            border_styles.push(Some(border_style));
                        }
                    });

                let borders =
                    generate_borders_full(sheet, &region, border_selections, border_styles);
                ops.push(Operation::SetBorders { region, borders });
            }
        });

        self.set_in_progress_transaction(ops, cursor, compute, TransactionType::Normal)
    }

    fn paste_plain_text(
        &mut self,
        sheet_id: SheetId,
        start_pos: Pos,
        clipboard: String,
        cursor: Option<String>,
    ) -> TransactionSummary {
        let lines: Vec<&str> = clipboard.split('\n').collect();
        let rows: Vec<Vec<&str>> = lines
            .iter()
            .map(|line| line.split('\t').collect())
            .collect();
        let mut operations = vec![];

        for (y, row) in rows.iter().enumerate() {
            for (x, value) in row.iter().enumerate() {
                operations.extend(self.set_cell_value_operations(
                    sheet_id,
                    (start_pos.x + x as i64, start_pos.y + y as i64).into(),
                    value,
                ));
            }
        }
        self.set_in_progress_transaction(operations, cursor, true, TransactionType::Normal)
    }

    // todo: parse table structure to provide better pasting experience from other spreadsheets
    fn paste_html(
        &mut self,
        sheet_id: SheetId,
        pos: Pos,
        html: String,
        cursor: Option<String>,
    ) -> Result<TransactionSummary, ()> {
        // use regex to find data-quadratic
        let re = Regex::new(r#"data-quadratic="(.*)"><tbody"#).unwrap();
        let Some(data) = re.captures(&html) else {
            return Err(());
        };
        let result = &data.get(1).map_or("", |m| m.as_str());

        // decode html in attribute
        let unencoded = htmlescape::decode_html(result);
        if unencoded.is_err() {
            return Err(());
        }

        // parse into Clipboard
        let parsed = serde_json::from_str::<Clipboard>(&unencoded.unwrap());
        if parsed.is_err() {
            return Err(());
        }
        let clipboard = parsed.unwrap();
        Ok(self.set_clipboard_cells(sheet_id, pos, clipboard, cursor))
    }

    pub fn paste_from_clipboard(
        &mut self,
        sheet_id: SheetId,
        pos: Pos,
        plain_text: Option<String>,
        html: Option<String>,
        cursor: Option<String>,
    ) -> TransactionSummary {
        // first try html
        if let Some(html) = html {
            let pasted_html = self.paste_html(sheet_id, pos, html, cursor.clone());
            if let Ok(pasted_html) = pasted_html {
                return pasted_html;
            }
        }

        // if not quadratic html, then use the plain text
        // first try html
        if let Some(plain_text) = plain_text {
            return self.paste_plain_text(sheet_id, pos, plain_text, cursor);
        }
        TransactionSummary::default()
    }
}

#[cfg(test)]
mod test {
    use bigdecimal::BigDecimal;

    use crate::{
        color::Rgba,
        controller::GridController,
        grid::{
            generate_borders, js_types::CellFormatSummary, set_region_borders, BorderSelection,
            BorderStyle, CellBorderLine, CodeCellLanguage, Sheet,
        },
        CellValue, Pos, Rect,
    };

    fn set_borders(sheet: &mut Sheet) {
        let selection = vec![BorderSelection::All];
        let style = BorderStyle {
            color: Rgba::from_str("#000000").unwrap(),
            line: CellBorderLine::Line1,
        };
        let rect = Rect::new_span(Pos { x: 0, y: 0 }, Pos { x: 0, y: 0 });
        let region = sheet.region(rect);
        let borders = generate_borders(sheet, &region, selection, Some(style));
        set_region_borders(sheet, vec![region.clone()], borders);
    }

    #[test]
    fn test_copy_to_clipboard() {
        let mut gc = GridController::default();
        let sheet_id = gc.sheet_ids()[0];

        gc.set_cell_value(sheet_id, Pos { x: 1, y: 1 }, String::from("1, 1"), None);
        gc.set_cell_bold(
            sheet_id,
            Rect {
                min: Pos { x: 1, y: 1 },
                max: Pos { x: 1, y: 1 },
            },
            Some(true),
            None,
        );

        gc.set_cell_value(sheet_id, Pos { x: 3, y: 2 }, String::from("12"), None);
        gc.set_cell_italic(
            sheet_id,
            Rect {
                min: Pos { x: 3, y: 2 },
                max: Pos { x: 3, y: 2 },
            },
            Some(true),
            None,
        );

        let rect = Rect {
            min: Pos { x: 1, y: 1 },
            max: Pos { x: 3, y: 2 },
        };

        let (plain_text, _) = gc.copy_to_clipboard(sheet_id, rect);
        assert_eq!(plain_text, String::from("1, 1\t\t\n\t\t12"));

        let rect = Rect::new_span(Pos { x: 0, y: 0 }, Pos { x: 3, y: 3 });
        let clipboard = gc.copy_to_clipboard(sheet_id, rect);

        // paste using plain_text
        let mut gc = GridController::default();
        let sheet_id = gc.sheet_ids()[0];
        gc.paste_from_clipboard(
            sheet_id,
            Pos { x: 0, y: 0 },
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
            sheet_id,
            Pos { x: 0, y: 0 },
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
            sheet_id,
            Pos { x: 1, y: 1 },
            CodeCellLanguage::Formula,
            String::from("1 + 1"),
            None,
        );

        assert_eq!(gc.undo_stack.len(), 1);

        let rect = Rect::new_span(Pos { x: 1, y: 1 }, Pos { x: 1, y: 1 });
        let clipboard = gc.copy_to_clipboard(sheet_id, rect);

        // paste using html
        let mut gc = GridController::default();
        let sheet_id = gc.sheet_ids()[0];

        assert_eq!(gc.undo_stack.len(), 0);

        // overwrite an existing code cell
        gc.set_cell_code(
            sheet_id,
            Pos { x: 0, y: 0 },
            CodeCellLanguage::Formula,
            String::from("2 + 2"),
            None,
        );

        assert_eq!(gc.undo_stack.len(), 1);

        gc.paste_from_clipboard(
            sheet_id,
            Pos { x: 0, y: 0 },
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

        let rect = Rect::new_span(Pos { x: 0, y: 0 }, Pos { x: 0, y: 0 });
        let clipboard = gc.copy_to_clipboard(sheet_id, rect);

        gc.paste_from_clipboard(
            sheet_id,
            Pos { x: 3, y: 3 },
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
        let region = sheet.region(rect);
        let borders = generate_borders(sheet, &region, selection, Some(style));
        set_region_borders(sheet, vec![region.clone()], borders);

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

        let (_, html) = gc.copy_to_clipboard(
            sheet_id,
            Rect::new_span(Pos { x: 0, y: 0 }, Pos { x: 4, y: 4 }),
        );
        let _ = gc.paste_html(sheet_id, Pos { x: 0, y: 10 }, html, None);

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
            sheet_id,
            Pos { x: 1, y: 2 },
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
