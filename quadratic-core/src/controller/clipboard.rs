use super::{transactions::TransactionSummary, GridController};
use crate::{
    grid::{js_types::CellFormatSummary, CodeCellValue, Sheet, SheetId},
    CellValue, Pos, Rect,
};
use html_escape;
use serde::{Deserialize, Serialize};

#[derive(Serialize, Deserialize)]
pub struct ClipboardCell {
    pub x: i64,
    pub y: i64,
    pub value: Option<CellValue>,
    pub code: Option<CodeCellValue>,
    pub format: Option<CellFormatSummary>,
    pub spill_value: Option<CellValue>,
}

impl GridController {
    pub fn copy_to_clipboard(&self, sheet_id: SheetId, rect: Rect) -> (String, String) {
        let mut cells: Vec<ClipboardCell> = vec![];
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

                // todo: probably need to return code in the cell for formulas (probably overwritten by spill_value)

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
                let format = sheet.get_existing_cell_format(pos);

                // create quadratic clipboard values
                if value.is_some() || code.is_some() || format.is_some() {
                    cells.push(ClipboardCell {
                        x,
                        y,
                        value: value.clone(),
                        code: code.clone(),
                        format: format.clone(),
                        spill_value: spill_value.clone(),
                    })
                }

                if format.is_some() {
                    html.push_str("<span style={");
                    if format.unwrap().bold.is_some_and(|bold| bold == true) {
                        html.push_str("font-weight:bold;");
                    }
                    if format.unwrap().italic.is_some_and(|italic| italic == true) {
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
                if format.is_some() {
                    html.push_str("</span>");
                }
            }
        }
        html.push_str("</tr></tbody></table>");
        let mut final_html = String::from("<table data-quadratic=\"");
        let data = serde_json::to_string(&cells).unwrap();
        let encoded = html_escape::encode_safe(&data);
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
        let summary = self.delete_cell_values(sheet_id, rect, cursor);
        (summary, copy.0, copy.1)
    }

    fn paste_html(sheet: Sheet, pos: Pos, html: String) -> TransactionSummary {}

    fn paste_plain_text(sheet: Sheet, pos: Pos, plain_text: String) -> TransactionSummary {}

    pub fn paste_from_clipboard(
        &mut self,
        sheet_id: SheetId,
        pos: Pos,
        plain_text: Option<String>,
        html: Option<String>,
        cursor: Option<String>,
    ) -> TransactionSummary {
        let sheet = self.grid().sheet_from_id(sheet_id);

        if html.is_some() {
            return self.paste_html(sheet, pos, html);
        } else if plain_text.is_some() {
            return self.paste_plain_text(sheet, pos, plain_text);
        }
        TransactionSummary::default()
    }
}

#[test]
fn test_copy_to_clipboard() {
    let mut gc = GridController::default();
    gc.add_sheet(None);
    let sheet_id = gc.sheet_ids()[0];

    gc.set_cell_value(
        sheet_id,
        Pos { x: 1, y: 1 },
        CellValue::Text(String::from("1, 1")),
        None,
    );
    gc.set_cell_bold(
        sheet_id,
        Rect {
            min: Pos { x: 1, y: 1 },
            max: Pos { x: 1, y: 1 },
        },
        Some(true),
        None,
    );
    gc.set_cell_value(sheet_id, Pos { x: 3, y: 2 }, CellValue::Number(12.0), None);
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

    let (plain_text, html) = gc.copy_to_clipboard(sheet_id, rect);
    assert_eq!(plain_text, String::from("1, 1\t\t\n\t\t12"));
    assert_eq!(html, String::from("<table data-quadratic=\"[{\"x\":1,\"y\":1,\"value\":{\"type\":\"text\",\"value\":\"1, 1\"},\"code\":null,\"format\":{\"bold\":true,\"italic\":null},\"spill_value\":null},{\"x\":3,\"y\":2,\"value\":{\"type\":\"number\",\"value\":12.0},\"code\":null,\"format\":{\"bold\":null,\"italic\":true},\"spill_value\":null}]\"><tbody><tr><td><span style={font-weight:bold;}>1, 1</span></td><td></td><td></tr><tr><td></td><td></td><td><span style={font-style:italic;}>12</span></tr></tbody></table>"));
}
