use crate::{
    cell_values::CellValues,
    color::Rgba,
    controller::operations::clipboard::{Clipboard, ClipboardOrigin},
    formulas::replace_a1_notation,
    grid::{
        formats::Formats, get_cell_borders_in_rect, CellAlign, CellVerticalAlign, CellWrap,
        CodeCellLanguage, Sheet,
    },
    selection::Selection,
    CellValue, Pos, Rect,
};

impl Sheet {
    /// Copies the selection to the clipboard.
    ///
    /// Returns the copied SheetRect, plain text, and html.
    pub fn copy_to_clipboard(&self, selection: &Selection) -> Result<(String, String), String> {
        let mut clipboard_origin = ClipboardOrigin::default();
        let mut html = String::from("<tbody>");
        let mut plain_text = String::new();
        let mut cells = CellValues::default();
        let mut values = CellValues::default();
        let mut sheet_bounds: Option<Rect> = None;

        if let Some(bounds) = self.selection_bounds(selection) {
            clipboard_origin.x = bounds.min.x;
            clipboard_origin.y = bounds.min.y;
            sheet_bounds = Some(bounds);

            for y in bounds.y_range() {
                if y != bounds.min.y {
                    plain_text.push('\n');
                    html.push_str("</tr>");
                }

                html.push_str("<tr>");

                for x in bounds.x_range() {
                    if x != bounds.min.x {
                        plain_text.push('\t');
                        html.push_str("</td>");
                    }

                    let pos = Pos { x, y };

                    if !selection.contains_pos(pos) {
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

                    let summary = self.cell_format_summary(pos, true);
                    let bold = summary.bold.unwrap_or(false);
                    let italic = summary.italic.unwrap_or(false);
                    let text_color = summary.text_color;
                    let fill_color = summary.fill_color;

                    let cell_border = self.borders().per_cell.to_owned().get_cell_border(pos);
                    let cell_align = self.get_formatting_value::<CellAlign>(pos);
                    let cell_vertical_align = self.get_formatting_value::<CellVerticalAlign>(pos);
                    let cell_wrap = self.get_formatting_value::<CellWrap>(pos);

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
                            style.push_str(cell_align.as_css_string());
                        }
                        if let Some(cell_vertical_align) = cell_vertical_align {
                            style.push_str(cell_vertical_align.as_css_string());
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

            // allow copying of code_run values (unless CellValue::Code is also in the clipboard)
            self.iter_code_output_in_rect(bounds)
                .filter(|(_, code_cell)| !code_cell.spill_error)
                .for_each(|(output_rect, code_cell)| {
                    // only change the cells if the CellValue::Code is not in the selection box
                    let code_pos = Pos {
                        x: output_rect.min.x,
                        y: output_rect.min.y,
                    };
                    let x_start = if output_rect.min.x > bounds.min.x {
                        output_rect.min.x
                    } else {
                        bounds.min.x
                    };
                    let y_start = if output_rect.min.y > bounds.min.y {
                        output_rect.min.y
                    } else {
                        bounds.min.y
                    };
                    let x_end = if output_rect.max.x < bounds.max.x {
                        output_rect.max.x
                    } else {
                        bounds.max.x
                    };
                    let y_end = if output_rect.max.y < bounds.max.y {
                        output_rect.max.y
                    } else {
                        bounds.max.y
                    };

                    // add the CellValue to cells if the code is not included in the clipboard
                    let include_in_cells = !bounds.contains(code_pos);

                    // add the code_run output to clipboard.values
                    for y in y_start..=y_end {
                        for x in x_start..=x_end {
                            if let Some(value) = code_cell
                                .cell_value_at((x - code_pos.x) as u32, (y - code_pos.y) as u32)
                            {
                                let pos = Pos {
                                    x: x - bounds.min.x,
                                    y: y - bounds.min.y,
                                };
                                if selection.contains_pos(Pos { x, y }) {
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

        let (formats, borders) = if let Some(bounds) = sheet_bounds {
            (
                self.override_cell_formats(bounds, Some(selection)),
                get_cell_borders_in_rect(self, bounds, Some(selection)),
            )
        } else {
            (Formats::default(), vec![])
        };

        if selection.all {
            clipboard_origin.all = Some((clipboard_origin.x, clipboard_origin.y));
        } else {
            if selection.columns.is_some() {
                // we need the row origin when columns are selected
                clipboard_origin.row = sheet_bounds.map(|b| b.min.y);
            }

            if selection.rows.is_some() {
                // we need the column origin when rows are selected
                clipboard_origin.column = sheet_bounds.map(|b| b.min.x);
            }
        }
        let sheet_formats = self.sheet_formats(selection, &clipboard_origin);
        let validations = self.validations.to_clipboard(selection, &clipboard_origin);

        let clipboard = Clipboard {
            cells,
            formats,
            sheet_formats,
            borders,
            values,
            w: sheet_bounds.map_or(0, |b| b.width()),
            h: sheet_bounds.map_or(0, |b| b.height()),
            origin: clipboard_origin,
            selection: Some(selection.clone()),
            validations,
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
    use super::*;
    use crate::{
        controller::{operations::clipboard::PasteSpecial, GridController},
        Rect,
    };
    use serial_test::parallel;

    #[test]
    #[parallel]
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
