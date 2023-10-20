use super::{
    formatting::CellFmtArray, operations::Operation, transaction_summary::TransactionSummary,
    GridController,
};
use crate::{
    grid::{CodeCellValue, SheetId},
    Array, ArraySize, CellValue, Pos, Rect,
};
use htmlescape;
use regex::Regex;
use serde::{Deserialize, Serialize};

#[derive(Serialize, Deserialize)]
pub struct ClipboardCell {
    pub value: Option<CellValue>,
    pub code: Option<CodeCellValue>,
}

#[derive(Serialize, Deserialize)]
pub struct Clipboard {
    w: u32,
    h: u32,
    cells: Vec<ClipboardCell>,
    formats: Vec<CellFmtArray>,
}

impl GridController {
    pub fn copy_to_clipboard(&self, sheet_id: SheetId, rect: Rect) -> (String, String) {
        let mut cells = vec![];
        let mut plain_text = String::new();
        let mut html = String::from("<tbody>");

        let sheet = self.grid().sheet_from_id(sheet_id);
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
                let value = sheet.get_cell_value(pos);

                let spill_value = if value.is_none() {
                    sheet.get_code_cell_value(pos)
                } else {
                    None
                };
                let code: Option<CodeCellValue> = if value.is_none() && spill_value.is_none() {
                    let code_cell_value = sheet.get_code_cell(pos);
                    code_cell_value.map(|code_cell_value| CodeCellValue {
                        language: code_cell_value.language,
                        code_string: code_cell_value.code_string.clone(),
                        formatted_code_string: None,
                        last_modified: code_cell_value.last_modified.clone(),
                        output: None,
                    })
                } else {
                    None
                };

                // create quadratic clipboard values
                cells.push(ClipboardCell {
                    value: value.clone(),
                    code: code.clone(),
                });

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
                } else if code.is_some() {
                    let output = code.unwrap().get_output_value(0, 0);
                    if let Some(output) = output {
                        plain_text.push_str(&output.repr());
                    }
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
        let clipboard = Clipboard {
            cells,
            formats,
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

    pub async fn cut_to_clipboard(
        &mut self,
        sheet_id: SheetId,
        rect: Rect,
        cursor: Option<String>,
    ) -> (TransactionSummary, String, String) {
        let copy = self.copy_to_clipboard(sheet_id, rect);
        let summary = self
            .delete_values_and_formatting(sheet_id, rect, cursor)
            .await;
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
            match &cell.value {
                Some(value) => {
                    let value = value.as_ref().clone();
                    let _ = array.set(x, y, value);
                }
                None => {
                    let _ = array.set(x, y, CellValue::Blank);
                }
            };
            x += 1;
            if x == clipboard.w {
                x = 0;
                y += 1;
            }
        });
        Some(array)
    }

    async fn set_clipboard_cells(
        &mut self,
        sheet_id: SheetId,
        start_pos: Pos,
        clipboard: Clipboard,
        cursor: Option<String>,
    ) -> TransactionSummary {
        let rect = Rect {
            min: start_pos,
            max: Pos {
                x: start_pos.x + (clipboard.w as i64) - 1,
                y: start_pos.y + (clipboard.h as i64) - 1,
            },
        };
        let formats = clipboard.formats.clone();

        let mut ops = vec![];
        let region = self.region(sheet_id, rect);
        let values = GridController::array_from_clipboard_cells(clipboard);
        if let Some(values) = values {
            ops.push(Operation::SetCellValues {
                region: region.clone(),
                values,
            });
        }

        formats.iter().for_each(|format| {
            ops.push(Operation::SetCellFormats {
                region: region.clone(),
                attr: format.clone(),
            });
        });

        self.transact_forward(ops, cursor).await
    }

    async fn paste_plain_text(
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

        self.transact_forward(operations, cursor).await
    }

    // todo: parse table structure to provide better pasting experience from other spreadsheets
    async fn paste_html(
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
        Ok(self
            .set_clipboard_cells(sheet_id, pos, clipboard, cursor)
            .await)
    }

    pub async fn paste_from_clipboard(
        &mut self,
        sheet_id: SheetId,
        pos: Pos,
        plain_text: Option<String>,
        html: Option<String>,
        cursor: Option<String>,
    ) -> TransactionSummary {
        // first try html
        if let Some(html) = html {
            let pasted_html = self.paste_html(sheet_id, pos, html, cursor.clone()).await;
            if let Ok(pasted_html) = pasted_html {
                return pasted_html;
            }
        }

        // if not quadratic html, then use the plain text
        // first try html
        if let Some(plain_text) = plain_text {
            return self
                .paste_plain_text(sheet_id, pos, plain_text, cursor)
                .await;
        }
        TransactionSummary::default()
    }
}

#[cfg(test)]
mod test {
    use bigdecimal::BigDecimal;

    use crate::{
        controller::GridController, grid::js_types::CellFormatSummary, CellValue, Pos, Rect,
    };

    fn test_pasted_output() -> String {
        String::from("<table data-quadratic=\"&#x7B;&quot;w&quot;&#x3A;4&#x2C;&quot;h&quot;&#x3A;4&#x2C;&quot;cells&quot;&#x3A;&#x5B;&#x7B;&quot;value&quot;&#x3A;null&#x2C;&quot;code&quot;&#x3A;null&#x7D;&#x2C;&#x7B;&quot;value&quot;&#x3A;null&#x2C;&quot;code&quot;&#x3A;null&#x7D;&#x2C;&#x7B;&quot;value&quot;&#x3A;null&#x2C;&quot;code&quot;&#x3A;null&#x7D;&#x2C;&#x7B;&quot;value&quot;&#x3A;null&#x2C;&quot;code&quot;&#x3A;null&#x7D;&#x2C;&#x7B;&quot;value&quot;&#x3A;null&#x2C;&quot;code&quot;&#x3A;null&#x7D;&#x2C;&#x7B;&quot;value&quot;&#x3A;&#x7B;&quot;type&quot;&#x3A;&quot;text&quot;&#x2C;&quot;value&quot;&#x3A;&quot;1&#x2C;&#x20;1&quot;&#x7D;&#x2C;&quot;code&quot;&#x3A;null&#x7D;&#x2C;&#x7B;&quot;value&quot;&#x3A;null&#x2C;&quot;code&quot;&#x3A;null&#x7D;&#x2C;&#x7B;&quot;value&quot;&#x3A;null&#x2C;&quot;code&quot;&#x3A;null&#x7D;&#x2C;&#x7B;&quot;value&quot;&#x3A;null&#x2C;&quot;code&quot;&#x3A;null&#x7D;&#x2C;&#x7B;&quot;value&quot;&#x3A;null&#x2C;&quot;code&quot;&#x3A;null&#x7D;&#x2C;&#x7B;&quot;value&quot;&#x3A;null&#x2C;&quot;code&quot;&#x3A;null&#x7D;&#x2C;&#x7B;&quot;value&quot;&#x3A;&#x7B;&quot;type&quot;&#x3A;&quot;number&quot;&#x2C;&quot;value&quot;&#x3A;&quot;12&quot;&#x7D;&#x2C;&quot;code&quot;&#x3A;null&#x7D;&#x2C;&#x7B;&quot;value&quot;&#x3A;null&#x2C;&quot;code&quot;&#x3A;null&#x7D;&#x2C;&#x7B;&quot;value&quot;&#x3A;null&#x2C;&quot;code&quot;&#x3A;null&#x7D;&#x2C;&#x7B;&quot;value&quot;&#x3A;null&#x2C;&quot;code&quot;&#x3A;null&#x7D;&#x2C;&#x7B;&quot;value&quot;&#x3A;null&#x2C;&quot;code&quot;&#x3A;null&#x7D;&#x5D;&#x2C;&quot;formats&quot;&#x3A;&#x5B;&#x7B;&quot;Align&quot;&#x3A;&#x5B;&#x5B;null&#x2C;16&#x5D;&#x5D;&#x7D;&#x2C;&#x7B;&quot;Wrap&quot;&#x3A;&#x5B;&#x5B;null&#x2C;16&#x5D;&#x5D;&#x7D;&#x2C;&#x7B;&quot;NumericFormat&quot;&#x3A;&#x5B;&#x5B;null&#x2C;16&#x5D;&#x5D;&#x7D;&#x2C;&#x7B;&quot;NumericDecimals&quot;&#x3A;&#x5B;&#x5B;null&#x2C;16&#x5D;&#x5D;&#x7D;&#x2C;&#x7B;&quot;Bold&quot;&#x3A;&#x5B;&#x5B;null&#x2C;5&#x5D;&#x2C;&#x5B;true&#x2C;1&#x5D;&#x2C;&#x5B;null&#x2C;10&#x5D;&#x5D;&#x7D;&#x2C;&#x7B;&quot;Italic&quot;&#x3A;&#x5B;&#x5B;null&#x2C;11&#x5D;&#x2C;&#x5B;true&#x2C;1&#x5D;&#x2C;&#x5B;null&#x2C;4&#x5D;&#x5D;&#x7D;&#x2C;&#x7B;&quot;TextColor&quot;&#x3A;&#x5B;&#x5B;null&#x2C;16&#x5D;&#x5D;&#x7D;&#x2C;&#x7B;&quot;FillColor&quot;&#x3A;&#x5B;&#x5B;null&#x2C;16&#x5D;&#x5D;&#x7D;&#x5D;&#x7D;\"><tbody><tr><td></td><td></td><td></td><td></tr><tr><td></td><td><span style={font-weight:bold;}>1, 1</span></td><td></td><td></tr><tr><td></td><td></td><td></td><td><span style={font-style:italic;}>12</span></tr><tr><td></td><td></td><td></td><td></tr></tbody></table>")
    }

    #[tokio::test]
    async fn test_copy_to_clipboard() {
        let mut gc = GridController::default();
        let sheet_id = gc.sheet_ids()[0];

        gc.set_cell_value(sheet_id, Pos { x: 1, y: 1 }, String::from("1, 1"), None)
            .await;
        gc.set_cell_bold(
            sheet_id,
            Rect {
                min: Pos { x: 1, y: 1 },
                max: Pos { x: 1, y: 1 },
            },
            Some(true),
            None,
        )
        .await;
        gc.set_cell_value(sheet_id, Pos { x: 3, y: 2 }, String::from("12"), None)
            .await;
        gc.set_cell_italic(
            sheet_id,
            Rect {
                min: Pos { x: 3, y: 2 },
                max: Pos { x: 3, y: 2 },
            },
            Some(true),
            None,
        )
        .await;

        let rect = Rect {
            min: Pos { x: 1, y: 1 },
            max: Pos { x: 3, y: 2 },
        };

        let (plain_text, _) = gc.copy_to_clipboard(sheet_id, rect);
        assert_eq!(plain_text, String::from("1, 1\t\t\n\t\t12"));

        let rect = Rect::new_span(Pos { x: 0, y: 0 }, Pos { x: 3, y: 3 });
        let clipboard = gc.copy_to_clipboard(sheet_id, rect);
        print!("{}", clipboard.1);
        // paste using plain_text
        let mut gc = GridController::default();
        let sheet_id = gc.sheet_ids()[0];
        gc.paste_from_clipboard(sheet_id, Pos { x: 0, y: 0 }, Some(clipboard.0), None, None)
            .await;
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
            Some(clipboard.1),
            None,
        )
        .await;
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
    }

    #[tokio::test]
    async fn test_paste_from_quadratic_clipboard() {
        let mut gc = GridController::default();
        let sheet_id = gc.sheet_ids()[0];
        gc.paste_from_clipboard(
            sheet_id,
            Pos { x: 1, y: 2 },
            None,
            Some(test_pasted_output()),
            None,
        )
        .await;

        let sheet = gc.sheet(sheet_id);
        let cell11 = sheet.get_cell_value(Pos { x: 2, y: 3 });
        assert_eq!(cell11.unwrap(), CellValue::Text(String::from("1, 1")));
        let cell21 = sheet.get_cell_value(Pos { x: 4, y: 4 });
        assert_eq!(cell21.unwrap(), CellValue::Number(BigDecimal::from(12)));
    }
}
