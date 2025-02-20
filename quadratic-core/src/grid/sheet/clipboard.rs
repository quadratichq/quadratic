use indexmap::IndexMap;

use crate::a1::A1Selection;
use crate::cell_values::CellValues;
use crate::color::Rgba;
use crate::controller::operations::clipboard::{Clipboard, ClipboardOperation, ClipboardOrigin};
use crate::formulas::{replace_a1_notation, replace_internal_cell_references};
use crate::grid::js_types::JsClipboard;
use crate::grid::{CodeCellLanguage, Sheet};
use crate::{CellValue, Pos, Rect};

impl Sheet {
    /// Copies the selection to the clipboard.
    ///
    /// Returns the copied SheetRect, plain text, and html.
    pub fn copy_to_clipboard(
        &self,
        selection: &A1Selection,
        clipboard_operation: ClipboardOperation,
    ) -> Result<JsClipboard, String> {
        let mut clipboard_origin = ClipboardOrigin::default();
        let mut plain_text = String::new();
        let mut html_body = String::from("<tbody>");
        let mut cells = CellValues::default();
        let mut values = CellValues::default();
        let mut data_tables = IndexMap::new();
        let mut sheet_bounds: Option<Rect> = None;
        let context = self.a1_context();

        if let Some(bounds) = self.selection_bounds(selection, true) {
            clipboard_origin.x = bounds.min.x;
            clipboard_origin.y = bounds.min.y;
            sheet_bounds = Some(bounds);

            for y in bounds.y_range() {
                if y != bounds.min.y {
                    plain_text.push('\n');
                    html_body.push_str("</tr>");
                }

                html_body.push_str("<tr>");

                for x in bounds.x_range() {
                    if x != bounds.min.x {
                        plain_text.push('\t');
                        html_body.push_str("</td>");
                    }

                    let pos = Pos { x, y };

                    if !selection.might_contain_pos(pos, &context) {
                        continue;
                    }

                    // the CellValue at the cell that would be displayed in the cell (ie, including code_runs)
                    let simple_value = self.display_value(pos);

                    // the CellValue at the cell (ignoring code_runs)
                    let real_value = self.cell_value(pos);

                    // create quadratic clipboard values
                    if let Some(mut real_value) = real_value {
                        // replace cell references in formulas
                        match &mut real_value {
                            CellValue::Code(code_cell) => {
                                if matches!(code_cell.language, CodeCellLanguage::Formula) {
                                    let sheet_pos = pos.to_sheet_pos(self.id);
                                    match clipboard_operation {
                                        ClipboardOperation::Cut => {
                                            code_cell.code = replace_internal_cell_references(
                                                &code_cell.code,
                                                &context,
                                                sheet_pos,
                                            );
                                        }
                                        ClipboardOperation::Copy => {
                                            code_cell.code = replace_a1_notation(
                                                &code_cell.code,
                                                &context,
                                                sheet_pos,
                                            );
                                        }
                                    }
                                }
                            }
                            _ => { /* noop */ }
                        };

                        cells.set(
                            (x - bounds.min.x) as u32,
                            (y - bounds.min.y) as u32,
                            real_value,
                        );
                    }

                    // create quadratic clipboard value-only
                    if let Some(simple_value) = &simple_value {
                        values.set(
                            (x - bounds.min.x) as u32,
                            (y - bounds.min.y) as u32,
                            simple_value.clone(),
                        );
                    }

                    // add styling for html (only used for pasting to other spreadsheets)
                    let mut style = String::new();

                    let summary = self.cell_format_summary(pos);
                    let bold = summary.bold.unwrap_or(false);
                    let italic = summary.italic.unwrap_or(false);
                    let text_color = summary.text_color;
                    let fill_color = summary.fill_color;
                    let cell_align = summary.align;
                    let cell_vertical_align = summary.vertical_align;
                    let cell_wrap = summary.wrap;
                    let underline = summary.underline.unwrap_or(false);
                    let strike_through = summary.strike_through.unwrap_or(false);

                    let cell_border = self.borders.get_style_cell(pos);

                    if bold
                        || italic
                        || underline
                        || strike_through
                        || text_color.is_some()
                        || fill_color.is_some()
                        || cell_align.is_some()
                        || cell_vertical_align.is_some()
                        || cell_wrap.is_some()
                        || !cell_border.is_empty()
                    {
                        style.push_str("style=\"");

                        if bold {
                            style.push_str("font-weight:bold;");
                        }
                        if italic {
                            style.push_str("font-style:italic;");
                        }
                        if underline && !strike_through {
                            style.push_str("text-decoration:underline;");
                        } else if !underline && strike_through {
                            style.push_str("text-decoration:line-through;");
                        } else if underline && strike_through {
                            style.push_str("text-decoration:underline line-through;");
                        }
                        if let Some(text_color) = text_color {
                            if let Ok(text_color) = Rgba::from_css_str(text_color.as_str()) {
                                style.push_str(
                                    format!("color:{};", text_color.as_rgb_hex()).as_str(),
                                );
                            }
                        }
                        if let Some(fill_color) = fill_color {
                            if let Ok(fill_color) = Rgba::from_css_str(fill_color.as_str()) {
                                style.push_str(
                                    format!("background-color:{};", fill_color.as_rgb_hex())
                                        .as_str(),
                                );
                            }
                        }
                        if let Some(cell_align) = cell_align {
                            style.push_str(cell_align.as_css_string());
                        }
                        if let Some(cell_vertical_align) = cell_vertical_align {
                            style.push_str(cell_vertical_align.as_css_string());
                        }
                        if let Some(cell_wrap) = cell_wrap {
                            style.push_str(cell_wrap.as_css_string());
                        }
                        if underline && !strike_through {
                            style.push_str("text-decoration:underline;");
                        } else if !underline && strike_through {
                            style.push_str("text-decoration:line-through;");
                        } else if underline && strike_through {
                            style.push_str("text-decoration:underline line-through;");
                        }

                        if cell_border.left.is_some() {
                            style.push_str(
                                format!(
                                    "border-left: {} {};",
                                    cell_border.left.unwrap().line.as_css_string(),
                                    cell_border.left.unwrap().color.as_rgb_hex()
                                )
                                .as_str(),
                            );
                        }
                        if cell_border.top.is_some() {
                            style.push_str(
                                format!(
                                    "border-top: {} {};",
                                    cell_border.top.unwrap().line.as_css_string(),
                                    cell_border.top.unwrap().color.as_rgb_hex()
                                )
                                .as_str(),
                            );
                        }
                        if cell_border.right.is_some() {
                            style.push_str(
                                format!(
                                    "border-right: {} {};",
                                    cell_border.right.unwrap().line.as_css_string(),
                                    cell_border.right.unwrap().color.as_rgb_hex()
                                )
                                .as_str(),
                            );
                        }
                        if cell_border.bottom.is_some() {
                            style.push_str(
                                format!(
                                    "border-bottom: {} {};",
                                    cell_border.bottom.unwrap().line.as_css_string(),
                                    cell_border.bottom.unwrap().color.as_rgb_hex()
                                )
                                .as_str(),
                            );
                        }

                        style.push('"');
                    }

                    html_body.push_str(format!("<td {}>", style).as_str());

                    if let Some(value) = &simple_value {
                        plain_text.push_str(&value.to_string());
                        html_body.push_str(&value.to_string());
                    }
                }
            }

            // allow copying of code_run values (unless CellValue::Code is also in the clipboard)
            self.iter_code_output_in_rect(bounds)
                .for_each(|(output_rect, data_table)| {
                    // only change the cells if the CellValue::Code is not in the selection box
                    let data_table_pos = Pos {
                        x: output_rect.min.x,
                        y: output_rect.min.y,
                    };

                    // add the CellValue to cells if the code is not included in the clipboard
                    let include_in_cells = !bounds.contains(data_table_pos);

                    // if the source cell is included in the clipboard, add the data_table to the clipboard
                    if !include_in_cells {
                        data_tables.insert(data_table_pos, data_table.clone());
                    }

                    if data_table.spill_error {
                        return;
                    }

                    let x_start = std::cmp::max(output_rect.min.x, bounds.min.x);
                    let y_start = std::cmp::max(output_rect.min.y, bounds.min.y);
                    let x_end = std::cmp::min(output_rect.max.x, bounds.max.x);
                    let y_end = std::cmp::min(output_rect.max.y, bounds.max.y);

                    // add the code_run output to clipboard.values
                    for y in y_start..=y_end {
                        for x in x_start..=x_end {
                            if let Some(value) = data_table.cell_value_at(
                                (x - data_table_pos.x) as u32,
                                (y - data_table_pos.y) as u32,
                            ) {
                                let pos = Pos {
                                    x: x - bounds.min.x,
                                    y: y - bounds.min.y,
                                };
                                if selection.might_contain_pos(Pos { x, y }, &context) {
                                    if include_in_cells {
                                        cells.set(pos.x as u32, pos.y as u32, value.clone());
                                    }

                                    values.set(pos.x as u32, pos.y as u32, value);
                                }
                            }
                        }
                    }
                });
        }

        let formats = self.formats.to_clipboard(self, selection);
        let borders = self.borders.to_clipboard(self, selection);
        let validations = self
            .validations
            .to_clipboard(selection, &clipboard_origin, &context);

        let clipboard = Clipboard {
            cells,
            formats,
            borders,
            values,
            w: sheet_bounds.map_or(0, |b| b.width()),
            h: sheet_bounds.map_or(0, |b| b.height()),
            origin: clipboard_origin,
            selection: selection.clone(),
            validations,
            data_tables,
            operation: clipboard_operation,
        };

        html_body.push_str("</td></tr></tbody></table>");
        let mut html = String::from("<table data-quadratic=\"");
        let data = serde_json::to_string(&clipboard).unwrap_or_default();
        let encoded = htmlescape::encode_attribute(&data);
        html.push_str(&encoded);
        html.push_str(&String::from("\">"));
        html.push_str(&html_body);
        Ok(JsClipboard { plain_text, html })
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::controller::operations::clipboard::PasteSpecial;
    use crate::controller::GridController;
    use crate::grid::js_types::JsClipboard;
    use crate::grid::sheet::borders::{BorderSelection, BorderStyle, CellBorderLine};
    use crate::Pos;

    #[test]
    fn copy_to_clipboard_exclude() {
        let mut gc = GridController::test();
        let sheet_id = gc.sheet_ids()[0];

        let sheet = gc.sheet_mut(sheet_id);
        sheet.test_set_values(0, 0, 4, 1, vec!["1", "2", "3", "4"]);

        let selection = A1Selection::test_a1("A1,C1:C2");
        let JsClipboard { html, .. } = sheet
            .copy_to_clipboard(&selection, ClipboardOperation::Copy)
            .unwrap();

        gc.paste_from_clipboard(
            &A1Selection::from_xy(0, 5, sheet_id),
            None,
            Some(html),
            PasteSpecial::None,
            None,
        );

        let sheet = gc.sheet(sheet_id);
        assert!(sheet.cell_value(Pos { x: 1, y: 5 }).is_none());
    }

    #[test]
    fn clipboard_borders() {
        let mut gc = GridController::test();
        let sheet_id = gc.sheet_ids()[0];

        gc.set_borders(
            A1Selection::test_a1("A1"),
            BorderSelection::All,
            Some(BorderStyle::default()),
            None,
        );

        let sheet = gc.sheet(sheet_id);
        let JsClipboard { html, .. } = sheet
            .copy_to_clipboard(&A1Selection::test_a1("A1"), ClipboardOperation::Copy)
            .unwrap();

        gc.paste_from_clipboard(
            &A1Selection::test_a1("B2"),
            None,
            Some(html),
            PasteSpecial::None,
            None,
        );

        let sheet = gc.sheet(sheet_id);
        let border = sheet.borders.get_style_cell(pos![B2]);
        assert_eq!(border.top.unwrap().line, CellBorderLine::default());
        assert_eq!(border.bottom.unwrap().line, CellBorderLine::default());
        assert_eq!(border.left.unwrap().line, CellBorderLine::default());
        assert_eq!(border.right.unwrap().line, CellBorderLine::default());
    }
}
