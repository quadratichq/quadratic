use super::operation::Operation;
use crate::{
    controller::GridController,
    grid::{formatting::CellFmtArray, generate_borders_full, BorderSelection, CellBorders},
    Array, ArraySize, CellValue, Pos, SheetPos, SheetRect,
};
use anyhow::{Error, Result};
use regex::Regex;
use serde::{Deserialize, Serialize};

#[derive(Debug, Serialize, Deserialize)]
pub struct Clipboard {
    pub w: u32,
    pub h: u32,
    pub cells: Vec<Option<CellValue>>,
    pub formats: Vec<CellFmtArray>,
    pub borders: Vec<(i64, i64, Option<CellBorders>)>,
}

impl GridController {
    pub fn cut_to_clipboard_operations(
        &mut self,
        sheet_rect: SheetRect,
    ) -> (Vec<Operation>, String, String) {
        let copy = self.copy_to_clipboard(sheet_rect);
        let operations = self.delete_values_and_formatting_operations(sheet_rect);
        (operations, copy.0, copy.1)
    }

    /// Converts the clipboard to an (Array, Vec<(relative x, relative y) for a CellValue::Code>) tuple.
    fn array_from_clipboard_cells(clipboard: Clipboard) -> (Option<Array>, Vec<(u32, u32)>) {
        if clipboard.w == 0 && clipboard.h == 0 {
            return (None, vec![]);
        }

        let mut array = Array::new_empty(ArraySize::new(clipboard.w, clipboard.h).unwrap());
        let mut code = vec![];
        let mut x = 0;
        let mut y = 0;

        clipboard.cells.iter().for_each(|cell| {
            let value = cell.clone().map_or(CellValue::Blank, |v| v);

            if let CellValue::Code(_) = &value {
                code.push((x, y));
            }

            // ignore result errors
            let _ = array.set(x, y, value);

            x += 1;

            if x == clipboard.w {
                x = 0;
                y += 1;
            }
        });

        (Some(array), code)
    }

    fn set_clipboard_cells(&mut self, start_pos: SheetPos, clipboard: Clipboard) -> Vec<Operation> {
        let sheet_rect = SheetRect {
            min: start_pos.into(),
            max: Pos {
                x: start_pos.x + (clipboard.w as i64) - 1,
                y: start_pos.y + (clipboard.h as i64) - 1,
            },
            sheet_id: start_pos.sheet_id,
        };
        let formats = clipboard.formats.clone();
        let borders = clipboard.borders.clone();

        let mut ops = vec![];
        let (values, code) = GridController::array_from_clipboard_cells(clipboard);
        if let Some(values) = values {
            ops.push(Operation::SetCellValues { sheet_rect, values });
        }

        code.iter().for_each(|(x, y)| {
            let sheet_pos = SheetPos {
                x: start_pos.x + *x as i64,
                y: start_pos.y + *y as i64,
                sheet_id: start_pos.sheet_id,
            };
            ops.push(Operation::ComputeCode { sheet_pos });
        });

        formats.iter().for_each(|format| {
            ops.push(Operation::SetCellFormats {
                sheet_rect,
                attr: format.clone(),
            });
        });

        if let Some(sheet) = self.try_sheet(start_pos.sheet_id) {
            // add borders to the sheet
            borders.iter().for_each(|(x, y, cell_borders)| {
                if let Some(cell_borders) = cell_borders {
                    let mut border_selections = vec![];
                    let mut border_styles = vec![];
                    let sheet_rect: SheetRect = SheetPos {
                        sheet_id: sheet.id,
                        x: *x + start_pos.x,
                        y: *y + start_pos.y,
                    }
                    .into();

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

                    let borders = generate_borders_full(
                        sheet,
                        &sheet_rect.into(),
                        border_selections,
                        border_styles,
                    );
                    ops.push(Operation::SetBorders {
                        sheet_rect,
                        borders,
                    });
                }
            });
        }
        ops.push(Operation::SetCursor { sheet_rect });
        ops
    }

    pub fn paste_plain_text_operations(
        &mut self,
        start_pos: SheetPos,
        clipboard: String,
    ) -> Vec<Operation> {
        let lines: Vec<&str> = clipboard.split('\n').collect();

        let mut ops = vec![];

        let cell_values = lines
            .iter()
            .enumerate()
            .map(|(x, line)| {
                line.split('\t')
                    .enumerate()
                    .map(|(y, value)| {
                        let (operations, cell_value) = self.string_to_cell_value(
                            SheetPos {
                                x: start_pos.x + x as i64,
                                y: start_pos.y + y as i64,
                                sheet_id: start_pos.sheet_id,
                            },
                            value,
                        );
                        ops.extend(operations);
                        cell_value
                    })
                    .collect::<Vec<CellValue>>()
            })
            .collect::<Vec<Vec<CellValue>>>();

        let array = Array::from(cell_values);
        let sheet_rect = SheetRect::new_pos_span(
            start_pos.into(),
            (
                start_pos.x + array.width() as i64 - 1,
                start_pos.y + array.height() as i64 - 1,
            )
                .into(),
            start_pos.sheet_id,
        );
        ops.push(Operation::SetCellValues {
            sheet_rect,
            values: array,
        });
        ops
    }

    // todo: parse table structure to provide better pasting experience from other spreadsheets
    pub fn paste_html_operations(
        &mut self,
        sheet_pos: SheetPos,
        html: String,
    ) -> Result<Vec<Operation>> {
        // use regex to find data-quadratic
        match Regex::new(r#"data-quadratic="(.*)"><tbody"#) {
            Err(_) => Err(Error::msg("Regex creation error")),
            Ok(re) => {
                let Some(data) = re.captures(&html) else {
                    return Err(Error::msg("Regex capture error"));
                };
                let result = &data.get(1).map_or("", |m| m.as_str());

                // decode html in attribute
                let unencoded = htmlescape::decode_html(result);
                if unencoded.is_err() {
                    return Err(Error::msg("Html decode error"));
                }

                // parse into Clipboard
                let parsed = serde_json::from_str::<Clipboard>(&unencoded.unwrap());
                if parsed.is_err() {
                    return Err(Error::msg("Clipboard parse error"));
                }
                let clipboard = parsed.unwrap();
                Ok(self.set_clipboard_cells(sheet_pos, clipboard))
            }
        }
    }
}
