use crate::cell_values::CellValues;
use crate::color::Rgba;
use crate::controller::operations::clipboard::{Clipboard, ClipboardOrigin};
use crate::formulas::replace_a1_notation;
use crate::grid::js_types::JsClipboard;
use crate::grid::{CodeCellLanguage, Sheet};
use crate::{A1Selection, CellValue, Pos, Rect};

impl Sheet {
    /// Copies the selection to the clipboard.
    ///
    /// Returns the copied SheetRect, plain text, and html.
    pub fn copy_to_clipboard(&self, selection: &A1Selection) -> Result<JsClipboard, String> {
        let mut clipboard_origin = ClipboardOrigin::default();
        let mut plain_text = String::new();
        let mut html_body = String::from("<tbody>");
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
                    html_body.push_str("</tr>");
                }

                html_body.push_str("<tr>");

                for x in bounds.x_range() {
                    if x != bounds.min.x {
                        plain_text.push('\t');
                        html_body.push_str("</td>");
                    }

                    let pos = Pos { x, y };

                    if !selection.might_contain_pos(pos) {
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

                    if bold
                        || italic
                        || underline
                        || strike_through
                        || text_color.is_some()
                        || fill_color.is_some()
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

                        dbgjs!("todo(ayush): implement cell_border");
                        // if let Some(cell_border) = cell_border {
                        //     for (side, border) in cell_border.borders.iter().enumerate() {
                        //         let side = match side {
                        //             0 => "-left",
                        //             1 => "-top",
                        //             2 => "-right",
                        //             3 => "-bottom",
                        //             _ => "",
                        //         };
                        //         if let Some(border) = border {
                        //             style.push_str(
                        //                 format!(
                        //                     "border{}: {} {};",
                        //                     side,
                        //                     border.line.as_css_string(),
                        //                     border.color.as_rgb_hex()
                        //                 )
                        //                 .as_str(),
                        //             );
                        //         }
                        //     }
                        // }

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
                                if selection.might_contain_pos(Pos { x, y }) {
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

        let borders = self.borders_a1.to_clipboard(self, selection);

        let validations = self.validations.to_clipboard(selection, &clipboard_origin);

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
        };

        html_body.push_str("</td></tr></tbody></table>");
        let mut html = String::from("<table data-quadratic=\"");
        let data = serde_json::to_string(&clipboard).unwrap();
        let encoded = htmlescape::encode_attribute(&data);
        html.push_str(&encoded);
        html.push_str(&String::from("\">"));
        html.push_str(&html_body);
        Ok(JsClipboard { plain_text, html })
    }
}

#[cfg(test)]
mod tests {
    use serial_test::parallel;

    use crate::controller::operations::clipboard::PasteSpecial;
    use crate::controller::GridController;
    use crate::grid::js_types::JsClipboard;
    use crate::grid::{BorderSelection, BorderStyle, CellBorderLine};
    use crate::selection::OldSelection;
    use crate::{A1Selection, Pos, Rect, SheetRect};

    #[test]
    #[parallel]
    fn copy_to_clipboard_exclude() {
        let mut gc = GridController::test();
        let sheet_id = gc.sheet_ids()[0];

        let sheet = gc.sheet_mut(sheet_id);
        sheet.test_set_values(0, 0, 4, 1, vec!["1", "2", "3", "4"]);

        let selection = A1Selection::from_rects(
            &[
                Rect::single_pos(Pos { x: 0, y: 0 }),
                Rect::from_numbers(2, 0, 2, 1),
            ],
            sheet_id,
        );
        let JsClipboard { html, .. } = sheet.copy_to_clipboard(&selection).unwrap();

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
    #[parallel]
    fn clipboard_borders() {
        let mut gc = GridController::test();
        let sheet_id = gc.sheet_ids()[0];

        let selection = OldSelection::sheet_rect(SheetRect::new(1, 1, 1, 1, sheet_id));
        // todo: this is temporary until all is moved to A1Selection
        let new_selection = A1Selection::from_rect(SheetRect::new(1, 1, 1, 1, sheet_id));

        gc.set_borders_selection(
            selection.clone(),
            BorderSelection::All,
            Some(BorderStyle::default()),
            None,
        );

        let sheet = gc.sheet(sheet_id);
        let JsClipboard { html, .. } = sheet.copy_to_clipboard(&new_selection).unwrap();

        gc.paste_from_clipboard(
            &A1Selection::from_xy(2, 2, sheet_id),
            None,
            Some(html),
            PasteSpecial::None,
            None,
        );

        let sheet = gc.sheet(sheet_id);
        let border = sheet.borders.get(2, 2);
        assert_eq!(border.top.unwrap().line, CellBorderLine::default());
        assert_eq!(border.bottom.unwrap().line, CellBorderLine::default());
        assert_eq!(border.left.unwrap().line, CellBorderLine::default());
        assert_eq!(border.right.unwrap().line, CellBorderLine::default());
    }
}
