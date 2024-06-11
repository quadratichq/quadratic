use crate::{
    cell_values::CellValues,
    color::Rgba,
    controller::operations::clipboard::{Clipboard, ClipboardOrigin},
    formulas::replace_a1_notation,
    grid::{get_cell_borders_in_rect, CellAlign, CellWrap, CodeCellLanguage, Sheet},
    selection::Selection,
    CellValue, Pos, Rect,
};

impl Sheet {
    /// Copies the selection to the clipboard.
    ///
    /// Returns the copied SheetRect, plain text, and html.
    pub fn copy_to_clipboard(&self, selection: &Selection) -> Result<(String, String), String> {
        let sheet_rect = self
            .clipboard_selection(selection)
            .ok_or("Unable to find SheetRect in selection")?;

        let mut cells = CellValues::new(sheet_rect.width() as u32, sheet_rect.height() as u32);
        let mut plain_text = String::new();
        let mut html = String::from("<tbody>");
        let mut values = CellValues::new(sheet_rect.width() as u32, sheet_rect.height() as u32);

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

                if !selection.pos_in_selection(pos) {
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

                let summary = self.cell_format_summary(pos, false);
                let bold = summary.bold.unwrap_or(false);
                let italic = summary.italic.unwrap_or(false);
                let text_color = summary.text_color;
                let fill_color = summary.fill_color;

                let cell_border = self.borders().per_cell.to_owned().get_cell_border(pos);
                let cell_align = self.get_formatting_value::<CellAlign>(pos);
                let cell_wrap = self.get_formatting_value::<CellWrap>(pos);

                if bold
                    || italic
                    || text_color.is_some()
                    || fill_color.is_some()
                    || cell_border.is_some()
                    || cell_align.is_some()
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
                        style.push_str(
                            format!("text-align:{};", cell_align)
                                .to_lowercase()
                                .as_str(),
                        );
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
        self.iter_code_output_in_rect(clipboard_rect)
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
        let borders = get_cell_borders_in_rect(self, sheet_rect.into());
        let origin = if selection.all {
            ClipboardOrigin {
                x: sheet_rect.min.x,
                y: sheet_rect.min.y,
                all: Some((sheet_rect.min.x, sheet_rect.min.y)),
                column: None,
                row: None,
            }
        } else if selection.columns.is_some() {
            // we need the row origin when columns are selected
            ClipboardOrigin {
                x: sheet_rect.min.x,
                y: sheet_rect.min.y,
                all: None,
                column: None,
                row: Some(sheet_rect.min.y),
            }
        } else if selection.rows.is_some() {
            // we need the column origin when rows are selected
            ClipboardOrigin {
                x: sheet_rect.min.x,
                y: sheet_rect.min.y,
                all: None,
                column: Some(sheet_rect.min.x),
                row: None,
            }
        } else {
            ClipboardOrigin {
                x: sheet_rect.min.x,
                y: sheet_rect.min.y,
                all: None,
                column: None,
                row: None,
            }
        };
        let clipboard = Clipboard {
            cells,
            formats,
            borders,
            values,
            w: sheet_rect.width() as u32,
            h: sheet_rect.height() as u32,
            origin,
            selection: Some(selection.clone()),
        };

        html.push_str("</td></tr></tbody></table>");
        let mut final_html = String::from("<table data-quadratic=\"");
        let data = serde_json::to_string(&clipboard).unwrap();
        let encoded = htmlescape::encode_attribute(&data);
        final_html.push_str(&encoded);
        final_html.push_str(&String::from("\">"));
        final_html.push_str(&html);
        Ok((plain_text, final_html))
    }
}

#[cfg(test)]
mod tests {
    use crate::controller::{operations::clipboard::PasteSpecial, GridController};

    use super::*;

    #[test]
    fn copy_to_clipboard_exclude() {
        let mut gc = GridController::test();
        let sheet_id = gc.sheet_ids()[0];

        let sheet = gc.sheet_mut(sheet_id);
        sheet.test_set_values(0, 0, 4, 1, vec!["1", "2", "3", "4"]);

        let (_, html) = sheet
            .copy_to_clipboard(&Selection {
                rects: Some(vec![
                    Rect::single_pos(Pos { x: 0, y: 0 }),
                    Rect::from_numbers(2, 0, 2, 1),
                ]),
                ..Default::default()
            })
            .unwrap();

        gc.paste_from_clipboard(
            Selection::pos(0, 5, sheet_id),
            None,
            Some(html),
            PasteSpecial::None,
            None,
        );

        let sheet = gc.sheet(sheet_id);
        assert!(sheet.cell_value(Pos { x: 1, y: 5 }).is_none());
    }
}
