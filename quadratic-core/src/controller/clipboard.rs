use std::str::FromStr;

use super::{
    formatting::CellFmtArray,
    transactions::{Operation, Transaction, TransactionSummary},
    GridController,
};
use crate::{
    grid::{CodeCellValue, SheetId},
    Array, ArraySize, CellValue, Pos, Rect,
};
use bigdecimal::BigDecimal;
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
                plain_text.push_str("\n");
                html.push_str("</tr>");
            }
            html.push_str("<tr>");
            for x in rect.x_range() {
                if x != rect.min.x {
                    plain_text.push_str("\t");
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
                    let code_cell_value = sheet.get_code_cell(pos).clone();
                    match code_cell_value {
                        Some(code_cell_value) => Some(CodeCellValue {
                            language: code_cell_value.language,
                            code_string: code_cell_value.code_string.clone(),
                            formatted_code_string: None,
                            last_modified: code_cell_value.last_modified.clone(),
                            output: None,
                        }),
                        None => None,
                    }
                } else {
                    None
                };

                // create quadratic clipboard values
                cells.push(ClipboardCell {
                    value: value.clone(),
                    code: code.clone(),
                });

                let (bold, italic) = if let Some(format) = sheet.get_existing_cell_format(pos) {
                    (
                        format.bold.is_some_and(|bold| bold == true),
                        format.italic.is_some_and(|italic| italic == true),
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
                        html.push_str("font-style:italic;")
                    }
                    html.push_str("}>");
                }
                if value.is_some() {
                    plain_text.push_str(&value.as_ref().unwrap().to_string());
                    html.push_str(&value.as_ref().unwrap().to_string());
                } else if code.is_some() {
                    let output = code.unwrap().get_output_value(0, 0);
                    if output.is_some() {
                        plain_text.push_str(&output.unwrap().repr());
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

    fn array_from_plain_cells(clipboard: String) -> Option<Array> {
        let lines: Vec<&str> = clipboard.split("\n").collect();
        let rows: Vec<Vec<&str>> = lines
            .iter()
            .map(|line| line.split('\t').collect())
            .collect();
        if rows.len() == 0 {
            return None;
        }
        let longest = rows
            .iter()
            .map(|line| line.clone().len())
            .max()
            .unwrap_or(0);
        if longest == 0 {
            return None;
        }
        let mut array =
            Array::new_empty(ArraySize::new(longest as u32, rows.len() as u32).unwrap());
        let mut x = 0;
        let mut y = 0;
        rows.iter().for_each(|row| {
            row.iter().for_each(|s| {
                if s.len() != 0 {
                    if let Ok(n) = BigDecimal::from_str(s) {
                        let _ = array.set(x, y, CellValue::Number(n));
                    } else {
                        let _ = array.set(x, y, CellValue::Text(String::from(*s)));
                    };
                }
                x += 1;
            });
            y += 1;
            x = 0;
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
        if values.is_some() {
            ops.push(Operation::SetCellValues {
                region: region.clone(),
                values: values.unwrap(),
            });
        }

        formats.iter().for_each(|format| {
            ops.push(Operation::SetCellFormats {
                region: region.clone(),
                attr: format.clone(),
            })
        });

        self.transact_forward(Transaction { ops, cursor })
    }

    fn paste_plain_text(
        &mut self,
        sheet_id: SheetId,
        start_pos: Pos,
        clipboard: String,
        cursor: Option<String>,
    ) -> TransactionSummary {
        let array = Self::array_from_plain_cells(clipboard);
        match array {
            Some(array) => {
                let rect = Rect {
                    min: start_pos,
                    max: Pos {
                        x: start_pos.x + (array.width() as i64) - 1,
                        y: start_pos.y + (array.height() as i64) - 1,
                    },
                };
                let region = self.region(sheet_id, rect);
                let ops: Vec<Operation> = vec![Operation::SetCellValues {
                    region,
                    values: array,
                }];
                self.transact_forward(Transaction { ops, cursor })
            }
            None => TransactionSummary::default(),
        }
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
        let unencoded = htmlescape::decode_html(&result);
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
        if html.is_some() {
            let pasted_html = self.paste_html(sheet_id, pos, html.unwrap(), cursor.clone());
            if pasted_html.is_ok() {
                return pasted_html.unwrap();
            }
        }

        // if not quadratic html, then use the plain text
        if plain_text.is_some() {
            return self.paste_plain_text(sheet_id, pos, plain_text.unwrap(), cursor);
        }
        TransactionSummary::default()
    }
}

#[cfg(test)]
mod test {
    use bigdecimal::BigDecimal;

    use crate::{controller::GridController, CellValue, Pos, Rect};

    fn test_pasted_output() -> String {
        String::from("<table data-quadratic=\"&#x7B;&quot;w&quot;&#x3A;3&#x2C;&quot;h&quot;&#x3A;2&#x2C;&quot;cells&quot;&#x3A;&#x5B;&#x7B;&quot;value&quot;&#x3A;&#x7B;&quot;type&quot;&#x3A;&quot;text&quot;&#x2C;&quot;value&quot;&#x3A;&quot;1&#x2C;&#x20;1&quot;&#x7D;&#x2C;&quot;code&quot;&#x3A;null&#x7D;&#x2C;&#x7B;&quot;value&quot;&#x3A;null&#x2C;&quot;code&quot;&#x3A;null&#x7D;&#x2C;&#x7B;&quot;value&quot;&#x3A;null&#x2C;&quot;code&quot;&#x3A;null&#x7D;&#x2C;&#x7B;&quot;value&quot;&#x3A;null&#x2C;&quot;code&quot;&#x3A;null&#x7D;&#x2C;&#x7B;&quot;value&quot;&#x3A;null&#x2C;&quot;code&quot;&#x3A;null&#x7D;&#x2C;&#x7B;&quot;value&quot;&#x3A;&#x7B;&quot;type&quot;&#x3A;&quot;number&quot;&#x2C;&quot;value&quot;&#x3A;12&#x2E;0&#x7D;&#x2C;&quot;code&quot;&#x3A;null&#x7D;&#x5D;&#x2C;&quot;formats&quot;&#x3A;&#x5B;&#x7B;&quot;id&quot;&#x3A;&#x7B;&quot;id&quot;&#x3A;&quot;68e7dd34&#x2D;6528&#x2D;4783&#x2D;9ec6&#x2D;08d1e4d101a7&quot;&#x7D;&#x2C;&quot;values&quot;&#x3A;&#x7B;&#x7D;&#x2C;&quot;spills&quot;&#x3A;&#x7B;&#x7D;&#x2C;&quot;align&quot;&#x3A;&#x7B;&#x7D;&#x2C;&quot;wrap&quot;&#x3A;&#x7B;&#x7D;&#x2C;&quot;numeric&#x5F;format&quot;&#x3A;&#x7B;&#x7D;&#x2C;&quot;bold&quot;&#x3A;&#x7B;&quot;0&quot;&#x3A;&#x7B;&quot;y&quot;&#x3A;0&#x2C;&quot;content&quot;&#x3A;&#x7B;&quot;value&quot;&#x3A;true&#x2C;&quot;len&quot;&#x3A;1&#x7D;&#x7D;&#x7D;&#x2C;&quot;italic&quot;&#x3A;&#x7B;&#x7D;&#x2C;&quot;text&#x5F;color&quot;&#x3A;&#x7B;&#x7D;&#x2C;&quot;fill&#x5F;color&quot;&#x3A;&#x7B;&#x7D;&#x7D;&#x2C;&#x7B;&quot;id&quot;&#x3A;&#x7B;&quot;id&quot;&#x3A;&quot;32ccb46d&#x2D;625d&#x2D;4173&#x2D;a2fe&#x2D;be038b70605f&quot;&#x7D;&#x2C;&quot;values&quot;&#x3A;&#x7B;&#x7D;&#x2C;&quot;spills&quot;&#x3A;&#x7B;&#x7D;&#x2C;&quot;align&quot;&#x3A;&#x7B;&#x7D;&#x2C;&quot;wrap&quot;&#x3A;&#x7B;&#x7D;&#x2C;&quot;numeric&#x5F;format&quot;&#x3A;&#x7B;&#x7D;&#x2C;&quot;bold&quot;&#x3A;&#x7B;&#x7D;&#x2C;&quot;italic&quot;&#x3A;&#x7B;&#x7D;&#x2C;&quot;text&#x5F;color&quot;&#x3A;&#x7B;&#x7D;&#x2C;&quot;fill&#x5F;color&quot;&#x3A;&#x7B;&#x7D;&#x7D;&#x2C;&#x7B;&quot;id&quot;&#x3A;&#x7B;&quot;id&quot;&#x3A;&quot;fbdc69ce&#x2D;b964&#x2D;49af&#x2D;8a34&#x2D;f5bdcb8cb750&quot;&#x7D;&#x2C;&quot;values&quot;&#x3A;&#x7B;&#x7D;&#x2C;&quot;spills&quot;&#x3A;&#x7B;&#x7D;&#x2C;&quot;align&quot;&#x3A;&#x7B;&#x7D;&#x2C;&quot;wrap&quot;&#x3A;&#x7B;&#x7D;&#x2C;&quot;numeric&#x5F;format&quot;&#x3A;&#x7B;&#x7D;&#x2C;&quot;bold&quot;&#x3A;&#x7B;&#x7D;&#x2C;&quot;italic&quot;&#x3A;&#x7B;&quot;1&quot;&#x3A;&#x7B;&quot;y&quot;&#x3A;1&#x2C;&quot;content&quot;&#x3A;&#x7B;&quot;value&quot;&#x3A;true&#x2C;&quot;len&quot;&#x3A;1&#x7D;&#x7D;&#x7D;&#x2C;&quot;text&#x5F;color&quot;&#x3A;&#x7B;&#x7D;&#x2C;&quot;fill&#x5F;color&quot;&#x3A;&#x7B;&#x7D;&#x7D;&#x5D;&#x7D;\"><tbody><tr><td><span style={font-weight:bold;}>1, 1</span></td><td></td><td></tr><tr><td></td><td></td><td><span style={font-style:italic;}>12</span></tr></tbody></table>")
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

        // this won't work b/c column_id changes on each run :(
        // assert_eq!(html, test_pasted_output());
    }

    #[test]
    fn test_paste_from_quadratic_clipboard() {
        let mut gc = GridController::default();
        let sheet_id = gc.sheet_ids()[0];
        gc.paste_from_clipboard(
            sheet_id,
            Pos { x: 0, y: 0 },
            None,
            Some(test_pasted_output()),
            None,
        );

        let sheet = gc.sheet(sheet_id);
        let cell11 = sheet.get_cell_value(Pos { x: 0, y: 0 });
        assert_eq!(cell11.unwrap(), CellValue::Text(String::from("1, 1")));
        let cell21 = sheet.get_cell_value(Pos { x: 2, y: 1 });
        assert_eq!(cell21.unwrap(), CellValue::Number(BigDecimal::from(12)));
    }
}
