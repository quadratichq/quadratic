use super::operation::Operation;
use crate::{
    cell_values::CellValues,
    controller::GridController,
    formulas::replace_internal_cell_references,
    grid::{
        formatting::CellFmtArray, generate_borders_full, BorderSelection, CellBorders,
        CodeCellLanguage,
    },
    selection::Selection,
    CellValue, Pos, SheetPos, SheetRect,
};
use anyhow::{Error, Result};
use regex::Regex;
use serde::{Deserialize, Serialize};

#[derive(Debug, Serialize, Deserialize, Clone, Copy, ts_rs::TS)]
pub enum PasteSpecial {
    None,
    Values,
    Formats,
}

/// This is used to track the origin of copies from column, row, or all
/// selection. In order to paste a column, row, or all, we need to know the
/// origin of the copy. For example, this is used to copy and paste a column
/// on top of another column, or a sheet on top of another sheet.
#[derive(Debug, Serialize, Deserialize)]
pub struct ClipboardOrigin {
    pub column: Option<i64>,
    pub row: Option<i64>,
    pub all: Option<(i64, i64)>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct Clipboard {
    pub w: u32,
    pub h: u32,
    pub cells: CellValues,

    // plain values for use with PasteSpecial::Values
    pub values: CellValues,

    pub formats: Vec<CellFmtArray>,
    pub borders: Vec<(i64, i64, Option<CellBorders>)>,

    pub origin: Option<ClipboardOrigin>,
}

impl GridController {
    pub fn cut_to_clipboard_operations(
        &mut self,
        selection: &Selection,
    ) -> Result<(Vec<Operation>, String, String), String> {
        let sheet = self
            .try_sheet(selection.sheet_id)
            .ok_or("Unable to find Sheet")?;

        let (plain_text, html) = sheet.copy_to_clipboard(selection)?;
        let operations = self.delete_values_and_formatting_operations(selection);
        Ok((operations, plain_text, html))
    }

    /// Converts the clipboard to an (Array, Vec<(relative x, relative y) for a CellValue::Code>) tuple.
    fn cell_values_from_clipboard_cells(
        clipboard: &Clipboard,
        special: PasteSpecial,
    ) -> (Option<&CellValues>, Vec<(u32, u32)>) {
        if clipboard.w == 0 && clipboard.h == 0 {
            return (None, vec![]);
        }

        match special {
            PasteSpecial::Values => (Some(&clipboard.values), vec![]),
            PasteSpecial::None => {
                let code = clipboard
                    .cells
                    .columns
                    .iter()
                    .enumerate()
                    .flat_map(|(x, col)| {
                        col.iter()
                            .filter_map(|(y, cell)| match cell {
                                CellValue::Code(_) => Some((x as u32, *y as u32)),
                                _ => None,
                            })
                            .collect::<Vec<_>>()
                    })
                    .collect::<Vec<_>>();
                (Some(&clipboard.cells), code)
            }
            _ => (None, vec![]),
        }
    }

    fn set_clipboard_cells(
        &mut self,
        selection: &Selection,
        clipboard: Clipboard,
        special: PasteSpecial,
    ) -> Vec<Operation> {
        let formats = clipboard.formats.clone();
        let borders = clipboard.borders.clone();

        let mut ops = vec![];

        let mut start_pos = Pos {
            x: selection.x,
            y: selection.y,
        };

        // adjust start_pos based on ClipboardOrigin special cases
        if let Some(clipboard_origin) = clipboard.origin.as_ref() {
            // we paste the entire sheet over the existing sheet
            if let Some((x, y)) = clipboard_origin.all {
                // clear the sheet first
                ops.extend(self.clear_format_selection_operations(selection));

                // set the start_pos to the origin of the clipboard for the
                // copied sheet
                start_pos.x = x;
                start_pos.y = y;
            } else if let Some(column_origin) = clipboard_origin.column {
                start_pos.x = column_origin;
            } else if let Some(row_origin) = clipboard_origin.row {
                start_pos.y = row_origin;
            }
        }

        match special {
            PasteSpecial::None => {
                let (values, code) =
                    GridController::cell_values_from_clipboard_cells(&clipboard, special);
                if let Some(values) = values {
                    ops.push(Operation::SetCellValues {
                        sheet_pos: start_pos.to_sheet_pos(selection.sheet_id),
                        values: values.clone(),
                    });
                }

                code.iter().for_each(|(x, y)| {
                    let sheet_pos = SheetPos {
                        x: start_pos.x + *x as i64,
                        y: start_pos.y + *y as i64,
                        sheet_id: selection.sheet_id,
                    };
                    ops.push(Operation::ComputeCode { sheet_pos });
                });
            }
            PasteSpecial::Values => {
                let (values, _) =
                    GridController::cell_values_from_clipboard_cells(&clipboard, special);
                if let Some(values) = values {
                    ops.push(Operation::SetCellValues {
                        sheet_pos: start_pos.to_sheet_pos(selection.sheet_id),
                        values: values.clone(),
                    });
                }
            }
            _ => (),
        }

        let sheet_rect = SheetRect {
            min: start_pos.into(),
            max: Pos {
                x: start_pos.x + (clipboard.w as i64) - 1,
                y: start_pos.y + (clipboard.h as i64) - 1,
            },
            sheet_id: selection.sheet_id,
        };

        // paste formats and borders unless pasting only values
        if !matches!(special, PasteSpecial::Values) {
            formats.iter().for_each(|format| {
                ops.push(Operation::SetCellFormats {
                    sheet_rect,
                    attr: format.clone(),
                });
            });

            if let Some(sheet) = self.try_sheet(selection.sheet_id) {
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

                        cell_borders.borders.iter().enumerate().for_each(
                            |(index, border_style)| {
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
                            },
                        );

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
        }

        // set the cursor based on the type of paste
        if clipboard.origin.as_ref().is_some_and(|o| o.all.is_some()) {
            ops.push(Operation::SetCursorSelection {
                selection: Selection {
                    sheet_id: selection.sheet_id,
                    all: true,
                    ..Default::default()
                },
            });
        } else if clipboard
            .origin
            .as_ref()
            .is_some_and(|o| o.column.is_some())
        {
            ops.push(Operation::SetCursorSelection {
                selection: Selection {
                    sheet_id: selection.sheet_id,
                    columns: Some(vec![start_pos.x]),
                    ..Default::default()
                },
            });
        } else if clipboard.origin.as_ref().is_some_and(|o| o.row.is_some()) {
            ops.push(Operation::SetCursorSelection {
                selection: Selection {
                    sheet_id: selection.sheet_id,
                    rows: Some(vec![start_pos.y]),
                    ..Default::default()
                },
            });
        } else {
            ops.push(Operation::SetCursorSelection {
                selection: Selection {
                    sheet_id: selection.sheet_id,
                    rects: Some(vec![sheet_rect.into()]),
                    ..Default::default()
                },
            });
        }
        ops
    }

    pub fn paste_plain_text_operations(
        &mut self,
        start_pos: SheetPos,
        clipboard: String,
        special: PasteSpecial,
    ) -> Vec<Operation> {
        // nothing to paste from plain text for formats
        if matches!(special, PasteSpecial::Formats) {
            return vec![];
        }
        let lines: Vec<&str> = clipboard.split('\n').collect();

        let mut ops = vec![];

        // calculate the width by checking the first line (with the assumption that all lines should have the same width)
        let w = lines
            .first()
            .map(|line| line.split('\t').count())
            .unwrap_or(0);
        let mut cell_values = CellValues::new(w as u32, lines.len() as u32);
        lines.iter().enumerate().for_each(|(y, line)| {
            line.split('\t').enumerate().for_each(|(x, value)| {
                let (operations, cell_value) = self.string_to_cell_value(
                    SheetPos {
                        x: start_pos.x + x as i64,
                        y: start_pos.y + y as i64,
                        sheet_id: start_pos.sheet_id,
                    },
                    value,
                );
                ops.extend(operations);
                if cell_value != CellValue::Blank {
                    cell_values.set(x as u32, y as u32, cell_value);
                }
            });
        });

        ops.push(Operation::SetCellValues {
            sheet_pos: start_pos,
            values: cell_values,
        });
        ops
    }

    // todo: parse table structure to provide better pasting experience from other spreadsheets
    pub fn paste_html_operations(
        &mut self,
        selection: &Selection,
        html: String,
        special: PasteSpecial,
    ) -> Result<Vec<Operation>> {
        let error = |e, msg| Error::msg(format!("Clipboard Paste {:?}: {:?}", msg, e));

        let dest_pos = Pos {
            x: selection.x,
            y: selection.y,
        };

        // use regex to find data-quadratic
        match Regex::new(r#"data-quadratic="(.*)"><tbody"#) {
            Err(e) => Err(error(e.to_string(), "Regex creation error")),
            Ok(re) => {
                let data = re
                    .captures(&html)
                    .ok_or_else(|| error("".into(), "Regex capture error"))?;
                let result = &data.get(1).map_or("", |m| m.as_str());

                // decode html in attribute
                let decoded = htmlescape::decode_html(result)
                    .map_err(|_| error("".into(), "Html decode error"))?;

                // parse into Clipboard
                let mut clipboard = serde_json::from_str::<Clipboard>(&decoded)
                    .map_err(|e| error(e.to_string(), "Serialization error"))?;

                // loop through the clipboard and replace cell references in formulas
                for col in clipboard.cells.columns.iter_mut() {
                    for (_y, cell) in col.iter_mut() {
                        match cell {
                            CellValue::Code(code_cell) => {
                                if matches!(code_cell.language, CodeCellLanguage::Formula) {
                                    code_cell.code = replace_internal_cell_references(
                                        &code_cell.code,
                                        dest_pos.into(),
                                    );
                                }
                            }
                            _ => { /* noop */ }
                        };
                    }
                }

                Ok(self.set_clipboard_cells(selection, clipboard, special))
            }
        }
    }

    pub fn move_cells_operations(&mut self, source: SheetRect, dest: SheetPos) -> Vec<Operation> {
        vec![Operation::MoveCells { source, dest }]
    }
}

#[cfg(test)]
mod test {
    use crate::{
        controller::{
            active_transactions::transaction_name::TransactionName,
            operations::operation::Operation, GridController,
        },
        selection::Selection,
        CellValue,
    };

    use super::PasteSpecial;

    #[test]
    fn move_cell_operations() {
        let mut gc = GridController::test();
        let sheet_id = gc.sheet_ids()[0];
        let source = (0, 0, 2, 2, sheet_id).into();
        let dest = (2, 2, sheet_id).into();
        let operations = gc.move_cells_operations(source, dest);
        assert_eq!(operations.len(), 1);
        assert_eq!(operations[0], Operation::MoveCells { source, dest });
    }

    #[test]
    fn paste_clipboard_cells_columns() {
        let mut gc = GridController::test();
        let sheet_id = gc.sheet_ids()[0];
        let sheet = gc.sheet_mut(sheet_id);
        sheet.test_set_values(0, 5, 1, 5, vec!["1", "2", "3", "4", "5"]);
        let (_, html) = sheet
            .copy_to_clipboard(&Selection {
                sheet_id,
                x: 0,
                y: 0,
                columns: Some(vec![0]),
                ..Default::default()
            })
            .unwrap();
        let operations = gc
            .paste_html_operations(
                &Selection {
                    sheet_id,
                    x: 5,
                    y: 0,
                    columns: Some(vec![5]),
                    ..Default::default()
                },
                html,
                PasteSpecial::None,
            )
            .unwrap();
        gc.start_user_transaction(operations, None, TransactionName::PasteClipboard);

        let sheet = gc.sheet(sheet_id);
        assert_eq!(
            sheet.cell_value_ref((5, 5).into()),
            Some(&CellValue::Number(1.into()))
        );
    }

    #[test]
    fn paste_clipboard_cells_rows() {
        let mut gc = GridController::test();
        let sheet_id = gc.sheet_ids()[0];
        let sheet = gc.sheet_mut(sheet_id);
        sheet.test_set_values(5, 2, 5, 1, vec!["1", "2", "3", "4", "5"]);
        let (_, html) = sheet
            .copy_to_clipboard(&Selection {
                sheet_id,
                x: 0,
                y: 2,
                rows: Some(vec![2]),
                ..Default::default()
            })
            .unwrap();
        let operations = gc
            .paste_html_operations(
                &Selection {
                    sheet_id,
                    x: 1,
                    y: 5,
                    rows: Some(vec![5]),
                    ..Default::default()
                },
                html,
                PasteSpecial::None,
            )
            .unwrap();
        gc.start_user_transaction(operations, None, TransactionName::PasteClipboard);

        let sheet = gc.sheet(sheet_id);
        assert_eq!(
            sheet.cell_value_ref((5, 5).into()),
            Some(&CellValue::Number(1.into()))
        );
    }

    #[test]
    fn paste_clipboard_cells_all() {
        let mut gc = GridController::test();
        let sheet_id = gc.sheet_ids()[0];
        let sheet = gc.sheet_mut(sheet_id);
        sheet.test_set_values(3, 3, 2, 2, vec!["1", "2", "3", "4"]);
        sheet.calculate_bounds();

        let (_, html) = sheet
            .copy_to_clipboard(&Selection {
                sheet_id,
                x: 0,
                y: 0,
                all: true,
                ..Default::default()
            })
            .unwrap();
        gc.add_sheet(None);

        let sheet_id = gc.sheet_ids()[1];
        let operations = gc
            .paste_html_operations(
                &Selection {
                    sheet_id,
                    x: 1,
                    y: 1,
                    all: true,
                    ..Default::default()
                },
                html,
                PasteSpecial::None,
            )
            .unwrap();
        gc.start_user_transaction(operations, None, TransactionName::PasteClipboard);

        let sheet = gc.sheet(sheet_id);
        assert_eq!(
            sheet.cell_value_ref((3, 3).into()),
            Some(&CellValue::Number(1.into()))
        );
    }
}
