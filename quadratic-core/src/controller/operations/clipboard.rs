use std::collections::HashMap;

use super::operation::Operation;
use crate::{
    cell_values::CellValues,
    controller::GridController,
    formulas::replace_internal_cell_references,
    grid::{
        formats::{format::Format, Formats},
        generate_borders_full,
        sheet::validations::validation::Validation,
        BorderSelection, CellBorders, CodeCellLanguage,
    },
    selection::Selection,
    CellValue, Pos, SheetPos, SheetRect,
};
use anyhow::{Error, Result};
use regex::Regex;
use serde::{Deserialize, Serialize};
use uuid::Uuid;

// todo: break up this file so tests are easier to write

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
#[derive(Default, Debug, Serialize, Deserialize)]
pub struct ClipboardOrigin {
    pub x: i64,
    pub y: i64,
    pub column: Option<i64>,
    pub row: Option<i64>,
    pub all: Option<(i64, i64)>,
}

#[derive(Default, Debug, Serialize, Deserialize)]
pub struct ClipboardSheetFormats {
    pub columns: HashMap<i64, Format>,
    pub rows: HashMap<i64, Format>,
    pub all: Option<Format>,
}

#[derive(Default, Debug, Serialize, Deserialize)]
pub struct ClipboardValidations {
    pub validations: Vec<Validation>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct Clipboard {
    pub w: u32,
    pub h: u32,
    pub cells: CellValues,

    // plain values for use with PasteSpecial::Values
    pub values: CellValues,

    pub formats: Formats,
    pub sheet_formats: ClipboardSheetFormats,
    pub borders: Vec<(i64, i64, Option<CellBorders>)>,

    pub origin: ClipboardOrigin,
    pub selection: Option<Selection>,

    pub validations: Option<ClipboardValidations>,
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

    /// Sets sheet formats from ClipboardSheetFormats.
    ///
    /// Returns a list of operations to undo the change.
    fn sheet_formats_operations(
        &mut self,
        selection: &Selection,
        clipboard: &Clipboard,
    ) -> Vec<Operation> {
        let mut ops = vec![];
        if let Some(all) = clipboard.sheet_formats.all.as_ref() {
            let formats = Formats::repeat(all.into(), 1);
            ops.push(Operation::SetCellFormatsSelection {
                selection: Selection {
                    sheet_id: selection.sheet_id,
                    all: true,
                    ..Default::default()
                },
                formats: formats.clone(),
            });
        } else {
            let mut formats = Formats::new();
            let mut new_selection = Selection {
                sheet_id: selection.sheet_id,
                ..Default::default()
            };
            let columns = clipboard
                .sheet_formats
                .columns
                .iter()
                .map(|(column, format)| {
                    formats.push(format.into());
                    column + selection.x
                })
                .collect::<Vec<_>>();
            if !columns.is_empty() {
                new_selection.columns = Some(columns);
            }
            let rows = clipboard
                .sheet_formats
                .rows
                .iter()
                .map(|(row, format)| {
                    formats.push(format.into());
                    row + selection.y
                })
                .collect::<Vec<_>>();
            if !rows.is_empty() {
                new_selection.rows = Some(rows);
            }
            if !formats.is_empty() {
                ops.push(Operation::SetCellFormatsSelection {
                    selection: new_selection,
                    formats,
                });
            }
        }
        ops
    }

    /// Gets operations to add validations from clipboard to sheet.
    fn set_clipboard_validations(
        &self,
        validations: &Option<ClipboardValidations>,
        start_pos: SheetPos,
    ) -> Vec<Operation> {
        if let Some(validations) = validations {
            validations
                .validations
                .iter()
                .map(|validation| {
                    let mut validation = validation.clone();
                    validation.id = Uuid::new_v4();
                    validation.selection.sheet_id = start_pos.sheet_id;
                    validation
                        .selection
                        .translate_in_place(start_pos.x, start_pos.y);
                    Operation::SetValidation { validation }
                })
                .collect()
        } else {
            vec![]
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

        // clear the sheet first
        ops.extend(self.clear_format_selection_operations(selection));

        let mut cursor_translate_x = selection.x - clipboard.origin.x;
        let mut cursor_translate_y = selection.y - clipboard.origin.y;

        // we paste the entire sheet over the existing sheet
        if let Some((x, y)) = clipboard.origin.all {
            // set the start_pos to the origin of the clipboard for the
            // copied sheet
            start_pos.x = x;
            start_pos.y = y;
        } else {
            if let Some(column_origin) = clipboard.origin.column {
                start_pos.x = column_origin + selection.x;
                cursor_translate_x += clipboard.origin.x;
            }
            if let Some(row_origin) = clipboard.origin.row {
                start_pos.y = row_origin + selection.y;
                cursor_translate_y += clipboard.origin.y;
            }
        }

        let cursor: Option<Operation> =
            clipboard
                .selection
                .as_ref()
                .map(|clipboard_selection| Operation::SetCursorSelection {
                    selection: clipboard_selection
                        .translate(cursor_translate_x, cursor_translate_y),
                });

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

        // paste formats and borders if not PasteSpecial::Values
        if !matches!(special, PasteSpecial::Values) {
            let sheet_rect = SheetRect {
                min: start_pos,
                max: Pos {
                    x: start_pos.x + (clipboard.w as i64) - 1,
                    y: start_pos.y + (clipboard.h as i64) - 1,
                },
                sheet_id: selection.sheet_id,
            };
            ops.push(Operation::SetCellFormatsSelection {
                selection: Selection::sheet_rect(sheet_rect),
                formats,
            });

            ops.extend(self.sheet_formats_operations(selection, &clipboard));

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

                ops.extend(self.set_clipboard_validations(
                    &clipboard.validations,
                    start_pos.to_sheet_pos(sheet.id),
                ));
            }
        }

        if let Some(cursor) = cursor {
            ops.push(cursor);
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
                                    code_cell.code =
                                        replace_internal_cell_references(&code_cell.code, dest_pos);
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
    use super::PasteSpecial;
    use super::*;
    use crate::controller::active_transactions::transaction_name::TransactionName;
    use crate::grid::formats::format_update::FormatUpdate;
    use crate::grid::sheet::validations::validation_rules::ValidationRule;
    use crate::grid::SheetId;
    use serial_test::parallel;

    #[test]
    #[parallel]
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
    #[parallel]
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
    #[parallel]
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
            sheet.cell_value_ref((10, 5).into()),
            Some(&CellValue::Number(5.into()))
        );
    }

    #[test]
    #[parallel]
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

    #[test]
    #[parallel]
    fn sheet_formats_operations_column_rows() {
        let mut gc = GridController::test();
        let sheet_id = gc.sheet_ids()[0];
        let sheet = gc.sheet_mut(sheet_id);
        sheet.set_formats_columns(
            &[1, 2],
            &Formats::repeat(
                FormatUpdate {
                    bold: Some(Some(true)),
                    ..Default::default()
                },
                2,
            ),
        );
        sheet.set_formats_rows(
            &[3, 4],
            &Formats::repeat(
                FormatUpdate {
                    italic: Some(Some(true)),
                    ..Default::default()
                },
                2,
            ),
        );

        let sheet = gc.sheet(sheet_id);
        let (_, html) = sheet
            .copy_to_clipboard(&Selection {
                sheet_id,
                x: 1,
                y: 3,
                columns: Some(vec![1, 2]),
                rows: Some(vec![3, 4]),
                ..Default::default()
            })
            .unwrap();

        gc.paste_from_clipboard(
            Selection {
                sheet_id,
                x: 3,
                y: 3,
                ..Default::default()
            },
            None,
            Some(html),
            PasteSpecial::None,
            None,
        );

        let sheet = gc.sheet(sheet_id);
        assert_eq!(
            sheet.format_cell(3, 3, true),
            Format {
                italic: Some(true),
                ..Default::default()
            }
        );
        assert_eq!(
            sheet.format_cell(3, 4, true),
            Format {
                italic: Some(true),
                ..Default::default()
            }
        );
        assert_eq!(
            sheet.format_cell(1, 3, true),
            Format {
                bold: Some(true),
                italic: Some(true),
                ..Default::default()
            }
        );
        assert_eq!(
            sheet.format_cell(2, 3, true),
            Format {
                bold: Some(true),
                italic: Some(true),
                ..Default::default()
            }
        );
    }

    #[test]
    #[parallel]
    fn set_clipboard_validations() {
        let gc = GridController::test();
        let validations = ClipboardValidations {
            validations: vec![Validation {
                id: Uuid::new_v4(),
                selection: Selection::rect(crate::Rect::new(1, 1, 2, 2), SheetId::test()),
                rule: ValidationRule::Logical(Default::default()),
                message: Default::default(),
                error: Default::default(),
            }],
        };
        let operations = gc.set_clipboard_validations(
            &Some(validations),
            SheetPos {
                x: 1,
                y: 1,
                sheet_id: SheetId::test(),
            },
        );
        assert_eq!(operations.len(), 1);
        if let Operation::SetValidation { validation } = &operations[0] {
            assert_eq!(
                validation.selection,
                Selection::rect(crate::Rect::new(2, 2, 3, 3), SheetId::test())
            );
        } else {
            panic!("Expected SetValidation operation");
        }
    }
}
