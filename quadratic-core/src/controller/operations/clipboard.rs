use std::collections::HashMap;

use anyhow::{Error, Result};
use regex::Regex;
use serde::{Deserialize, Serialize};
use uuid::Uuid;

use super::operation::Operation;
use crate::cell_values::CellValues;
use crate::controller::GridController;
use crate::formulas::replace_internal_cell_references;
use crate::grid::formats::Format;
use crate::grid::formats::SheetFormatUpdates;
use crate::grid::js_types::JsClipboard;
use crate::grid::sheet::borders::BordersUpdates;
use crate::grid::sheet::validations::validation::Validation;
use crate::grid::CodeCellLanguage;
use crate::{A1Selection, CellValue, Pos, SheetPos, SheetRect};

// todo: break up this file so tests are easier to write

#[derive(Debug, Serialize, Deserialize, Clone, Copy, ts_rs::TS)]
pub enum PasteSpecial {
    None,
    Values,
    Formats,
}

/// This is used to track the origin of copies from column, row, or all
/// selection. In order to paste a column, row, or all, we need to know the
/// origin of the copy.
///
/// For example, this is used to copy and paste a column
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
    pub origin: ClipboardOrigin,

    pub selection: A1Selection,

    pub w: u32,
    pub h: u32,

    pub cells: CellValues,

    // plain values for use with PasteSpecial::Values
    pub values: CellValues,

    #[serde(skip_serializing_if = "Option::is_none", default)]
    pub formats: Option<SheetFormatUpdates>,

    #[serde(skip_serializing_if = "Option::is_none", default)]
    pub borders: Option<BordersUpdates>,

    #[serde(skip_serializing_if = "Option::is_none", default)]
    pub validations: Option<ClipboardValidations>,
}

impl GridController {
    pub fn cut_to_clipboard_operations(
        &mut self,
        selection: &A1Selection,
    ) -> Result<(Vec<Operation>, JsClipboard), String> {
        let sheet = self
            .try_sheet(selection.sheet_id)
            .ok_or("Unable to find Sheet")?;

        let js_clipboard = sheet.copy_to_clipboard(selection)?;
        let operations = self.delete_values_and_formatting_operations(selection);
        Ok((operations, js_clipboard))
    }

    /// Converts the clipboard to an (Array, Vec<(relative x, relative y) for a CellValue::Code>) tuple.
    fn cell_values_from_clipboard_cells(
        w: u32,
        h: u32,
        cells: CellValues,
        values: CellValues,
        special: PasteSpecial,
    ) -> (Option<CellValues>, Vec<(u32, u32)>) {
        if w == 0 && h == 0 {
            return (None, vec![]);
        }

        match special {
            PasteSpecial::Values => (Some(values), vec![]),
            PasteSpecial::None => {
                let code = cells
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
                (Some(cells), code)
            }
            _ => (None, vec![]),
        }
    }

    /// Gets operations to add validations from clipboard to sheet.
    fn set_clipboard_validations(
        &self,
        validations: Option<ClipboardValidations>,
        start_pos: SheetPos,
    ) -> Vec<Operation> {
        if let Some(validations) = validations {
            validations
                .validations
                .into_iter()
                .map(|mut validation| {
                    validation.id = Uuid::new_v4();
                    validation.selection.sheet_id = start_pos.sheet_id;
                    validation
                        .selection
                        .translate_in_place(start_pos.x - 1, start_pos.y - 1);
                    Operation::SetValidation { validation }
                })
                .collect()
        } else {
            vec![]
        }
    }

    fn set_clipboard_cells(
        &mut self,
        selection: &A1Selection,
        clipboard: Clipboard,
        special: PasteSpecial,
    ) -> Vec<Operation> {
        let mut ops = vec![];

        let mut start_pos = selection.cursor;

        let mut cursor_translate_x = start_pos.x - clipboard.origin.x;
        let mut cursor_translate_y = start_pos.y - clipboard.origin.y;

        // we paste the entire sheet over the existing sheet
        if let Some((x, y)) = clipboard.origin.all {
            // set the start_pos to the origin of the clipboard for the
            // copied sheet
            start_pos.x = x;
            start_pos.y = y;
        } else {
            if let Some(column_origin) = clipboard.origin.column {
                start_pos.x += column_origin;
                cursor_translate_x += clipboard.origin.x;
            }
            if let Some(row_origin) = clipboard.origin.row {
                start_pos.y += row_origin;
                cursor_translate_y += clipboard.origin.y;
            }
        }

        let mut cursor = clipboard
            .selection
            .translate(cursor_translate_x, cursor_translate_y);
        cursor.sheet_id = selection.sheet_id;
        ops.push(Operation::SetCursorA1 { selection: cursor });

        match special {
            PasteSpecial::None => {
                let (values, code) = GridController::cell_values_from_clipboard_cells(
                    clipboard.w,
                    clipboard.h,
                    clipboard.cells,
                    clipboard.values,
                    special,
                );
                if let Some(values) = values {
                    ops.push(Operation::SetCellValues {
                        sheet_pos: start_pos.to_sheet_pos(selection.sheet_id),
                        values,
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
                let (values, _) = GridController::cell_values_from_clipboard_cells(
                    clipboard.w,
                    clipboard.h,
                    clipboard.cells,
                    clipboard.values,
                    special,
                );
                if let Some(values) = values {
                    ops.push(Operation::SetCellValues {
                        sheet_pos: start_pos.to_sheet_pos(selection.sheet_id),
                        values,
                    });
                }
            }
            _ => (),
        }

        // paste formats and borders if not PasteSpecial::Values
        if !matches!(special, PasteSpecial::Values) {
            let contiguous_2d_translate_x = start_pos.x - clipboard.origin.x;
            let contiguous_2d_translate_y = start_pos.y - clipboard.origin.y;

            if let Some(mut formats) = clipboard.formats {
                formats.translate_in_place(contiguous_2d_translate_x, contiguous_2d_translate_y);
                ops.push(Operation::SetCellFormatsA1 {
                    sheet_id: selection.sheet_id,
                    formats,
                });
            }

            if let Some(mut borders) = clipboard.borders {
                borders.translate_in_place(contiguous_2d_translate_x, contiguous_2d_translate_y);
                ops.push(Operation::SetBordersA1 {
                    sheet_id: selection.sheet_id,
                    borders,
                });
            }

            ops.extend(self.set_clipboard_validations(
                clipboard.validations,
                start_pos.to_sheet_pos(selection.sheet_id),
            ));
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

        ops.insert(
            0,
            Operation::SetCellValues {
                sheet_pos: start_pos,
                values: cell_values,
            },
        );
        ops
    }

    // todo: parse table structure to provide better pasting experience from other spreadsheets
    pub fn paste_html_operations(
        &mut self,
        selection: &A1Selection,
        html: String,
        special: PasteSpecial,
    ) -> Result<Vec<Operation>> {
        let error = |e, msg| Error::msg(format!("Clipboard Paste {:?}: {:?}", msg, e));

        let insert_at = selection.cursor;

        // use regex to find data-quadratic
        match Regex::new(r#"data-quadratic="(.*)"><tbody"#) {
            Err(e) => Err(error(e.to_string(), "Regex creation error")),
            Ok(re) => {
                let data = re
                    .captures(&html)
                    .ok_or_else(|| error("".into(), "Regex capture error"))?;

                let result = data.get(1).map_or("", |m| m.as_str());
                drop(data);

                // decode html in attribute
                let decoded = htmlescape::decode_html(result)
                    .map_err(|_| error("".into(), "Html decode error"))?;
                drop(html);

                // parse into Clipboard
                let mut clipboard = serde_json::from_str::<Clipboard>(&decoded)
                    .map_err(|e| error(e.to_string(), "Serialization error"))?;
                drop(decoded);

                let delta_x = insert_at.x - clipboard.origin.x;
                let delta_y = insert_at.y - clipboard.origin.y;

                // loop through the clipboard and replace cell references in formulas
                for (x, col) in clipboard.cells.columns.iter_mut().enumerate() {
                    for (&y, cell) in col.iter_mut() {
                        match cell {
                            CellValue::Code(code_cell) => {
                                if matches!(
                                    code_cell.language,
                                    CodeCellLanguage::Formula | CodeCellLanguage::AIResearcher
                                ) {
                                    code_cell.code = replace_internal_cell_references(
                                        &code_cell.code,
                                        Pos {
                                            x: insert_at.x + x as i64,
                                            y: insert_at.y + y as i64,
                                        },
                                    );
                                } else {
                                    let sheet_map = self.grid.sheet_name_id_map();
                                    code_cell.update_cell_references(
                                        delta_x,
                                        delta_y,
                                        &selection.sheet_id,
                                        &sheet_map,
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
    use bigdecimal::BigDecimal;
    use serial_test::parallel;

    use super::{PasteSpecial, *};
    use crate::controller::active_transactions::transaction_name::TransactionName;
    use crate::grid::js_types::JsClipboard;
    use crate::grid::sheet::validations::validation_rules::ValidationRule;
    use crate::grid::SheetId;
    use crate::{A1Selection, CellRefRange};

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
        sheet.test_set_values(1, 5, 1, 5, vec!["1", "2", "3", "4", "5"]);
        let selection = A1Selection::test_a1("A");
        let JsClipboard { html, .. } = sheet.copy_to_clipboard(&selection).unwrap();
        let operations = gc
            .paste_html_operations(&A1Selection::test_a1("E"), html, PasteSpecial::None)
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
        let selection: A1Selection = A1Selection::test_a1("2");
        let JsClipboard { html, .. } = sheet.copy_to_clipboard(&selection).unwrap();
        let operations = gc
            .paste_html_operations(&A1Selection::test_a1("5"), html, PasteSpecial::None)
            .unwrap();
        gc.start_user_transaction(operations, None, TransactionName::PasteClipboard);

        let sheet = gc.sheet(sheet_id);
        assert_eq!(
            sheet.cell_value_ref((9, 5).into()),
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
        sheet.recalculate_bounds();
        let selection = A1Selection::all(sheet_id);
        let JsClipboard { html, .. } = sheet.copy_to_clipboard(&selection).unwrap();
        gc.add_sheet(None);

        let sheet_id = gc.sheet_ids()[1];
        let operations = gc
            .paste_html_operations(&A1Selection::all(sheet_id), html, PasteSpecial::None)
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
        sheet.formats.bold.set_rect(1, 1, Some(2), None, Some(true));
        sheet
            .formats
            .italic
            .set_rect(1, 3, None, Some(4), Some(true));

        let sheet = gc.sheet(sheet_id);
        let selection = A1Selection::from_ranges(
            [
                CellRefRange::new_relative_column_range(1, 2),
                CellRefRange::new_relative_row_range(3, 4),
                CellRefRange::new_relative_pos(Pos { x: 1, y: 3 }),
            ]
            .into_iter(),
            sheet_id,
        );
        let JsClipboard { html, .. } = sheet.copy_to_clipboard(&selection).unwrap();

        gc.paste_from_clipboard(
            &A1Selection::from_xy(3, 3, sheet_id),
            None,
            Some(html),
            PasteSpecial::None,
            None,
        );

        let sheet = gc.sheet(sheet_id);
        assert_eq!(sheet.formats.italic.get(Pos { x: 3, y: 3 }), Some(true));
        assert_eq!(sheet.formats.italic.get(Pos { x: 3, y: 4 }), Some(true));

        assert_eq!(sheet.formats.italic.get(Pos { x: 1, y: 3 }), Some(true));
        assert_eq!(sheet.formats.bold.get(Pos { x: 1, y: 3 }), Some(true));
        assert_eq!(sheet.formats.italic.get(Pos { x: 2, y: 3 }), Some(true));
        assert_eq!(sheet.formats.bold.get(Pos { x: 2, y: 3 }), Some(true));
    }

    #[test]
    #[parallel]
    fn set_clipboard_validations() {
        let gc = GridController::test();
        let validations = ClipboardValidations {
            validations: vec![Validation {
                id: Uuid::new_v4(),
                selection: A1Selection::test_a1("A1:B2"),
                rule: ValidationRule::Logical(Default::default()),
                message: Default::default(),
                error: Default::default(),
            }],
        };
        let operations = gc.set_clipboard_validations(
            Some(validations),
            SheetPos {
                x: 2,
                y: 2,
                sheet_id: SheetId::test(),
            },
        );
        assert_eq!(operations.len(), 1);
        if let Operation::SetValidation { validation } = &operations[0] {
            assert_eq!(validation.selection, A1Selection::test_a1("B2:C3"));
        } else {
            panic!("Expected SetValidation operation");
        }
    }

    #[test]
    #[parallel]
    fn paste_clipboard_with_formula() {
        let mut gc = GridController::test();
        let sheet_id = gc.sheet_ids()[0];

        gc.set_cell_values(
            SheetPos {
                x: 2,
                y: 1,
                sheet_id,
            },
            vec![vec!["1"], vec!["2"], vec!["3"]],
            None,
        );

        gc.set_code_cell(
            SheetPos {
                x: 1,
                y: 4,
                sheet_id,
            },
            CodeCellLanguage::Formula,
            "SUM(B1:B3)".to_string(),
            None,
        );

        assert_eq!(
            gc.sheet(sheet_id).get_code_cell_value((1, 4).into()),
            Some(CellValue::Number(BigDecimal::from(6)))
        );

        let selection = A1Selection::test_a1("A1:B5");
        let JsClipboard { html, .. } = gc.sheet(sheet_id).copy_to_clipboard(&selection).unwrap();

        gc.paste_from_clipboard(
            &A1Selection::test_a1("E6"),
            None,
            Some(html),
            PasteSpecial::None,
            None,
        );

        assert_eq!(
            gc.sheet(sheet_id).get_code_cell_value((5, 9).into()),
            Some(CellValue::Number(BigDecimal::from(6)))
        );
    }

    #[test]
    #[parallel]
    fn paste_code_cell_references_python() {
        let mut gc = GridController::test();
        let sheet_id = gc.sheet_ids()[0];

        gc.set_code_cell(
            pos![C3].to_sheet_pos(sheet_id),
            CodeCellLanguage::Python,
            r#"q.cells("A1:B2", first_row_header=True)"#.to_string(),
            None,
        );

        let selection = A1Selection::test_a1("A1:E5");
        let JsClipboard { html, .. } = gc.sheet(sheet_id).copy_to_clipboard(&selection).unwrap();

        gc.paste_from_clipboard(
            &A1Selection::test_a1("E6"),
            None,
            Some(html),
            PasteSpecial::None,
            None,
        );

        let sheet = gc.sheet(sheet_id);
        match sheet.cell_value(pos![G8]) {
            Some(CellValue::Code(code_cell)) => {
                assert_eq!(code_cell.code, r#"q.cells("E6:F7", first_row_header=True)"#);
            }
            _ => panic!("expected code cell"),
        }
    }

    #[test]
    #[parallel]
    fn paste_code_cell_references_javascript() {
        let mut gc = GridController::test();
        let sheet_id = gc.sheet_ids()[0];

        gc.set_code_cell(
            pos![C3].to_sheet_pos(sheet_id),
            CodeCellLanguage::Javascript,
            r#"return q.cells("A1:B2");"#.to_string(),
            None,
        );

        let selection = A1Selection::test_a1("A1:E5");
        let JsClipboard { html, .. } = gc.sheet(sheet_id).copy_to_clipboard(&selection).unwrap();

        gc.paste_from_clipboard(
            &A1Selection::test_a1("E6"),
            None,
            Some(html),
            PasteSpecial::None,
            None,
        );

        let sheet = gc.sheet(sheet_id);
        match sheet.cell_value(pos![G8]) {
            Some(CellValue::Code(code_cell)) => {
                assert_eq!(code_cell.code, r#"return q.cells("E6:F7");"#);
            }
            _ => panic!("expected code cell"),
        }
    }

    #[test]
    #[parallel]
    fn paste_clipboard_with_ai_researcher() {
        let mut gc = GridController::test();
        let sheet_id = gc.sheet_ids()[0];

        gc.set_cell_values(
            pos![A1].to_sheet_pos(sheet_id),
            vec![vec!["1"], vec!["2"], vec!["3"]],
            None,
        );

        gc.set_code_cell(
            pos![B1].to_sheet_pos(sheet_id),
            CodeCellLanguage::Formula,
            "AI('query', A1:A3)".to_string(),
            None,
        );

        assert_eq!(
            gc.sheet(sheet_id).get_code_cell_value(pos![B1]),
            Some(CellValue::Text("result".to_string()))
        );

        let selection = A1Selection::test_a1("A1:B5");
        let JsClipboard { html, .. } = gc.sheet(sheet_id).copy_to_clipboard(&selection).unwrap();

        gc.paste_from_clipboard(
            &A1Selection::test_a1("E5"),
            None,
            Some(html),
            PasteSpecial::None,
            None,
        );

        assert_eq!(
            gc.sheet(sheet_id).get_code_cell_value(pos![F5]),
            Some(CellValue::Text("result".to_string()))
        );
    }
}
