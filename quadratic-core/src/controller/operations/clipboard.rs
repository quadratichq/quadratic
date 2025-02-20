use std::collections::HashMap;

use anyhow::{Error, Result};
use indexmap::IndexMap;
use regex::Regex;
use serde::{Deserialize, Serialize};
use uuid::Uuid;

use super::operation::Operation;
use crate::cell_values::CellValues;
use crate::controller::GridController;
use crate::formulas::replace_a1_notation;
use crate::grid::formats::Format;
use crate::grid::formats::FormatUpdate;
use crate::grid::formats::SheetFormatUpdates;
use crate::grid::js_types::JsClipboard;
use crate::grid::js_types::JsSnackbarSeverity;
use crate::grid::sheet::borders::BordersUpdates;
use crate::grid::sheet::validations::validation::Validation;
use crate::grid::CodeCellLanguage;
use crate::grid::DataTable;
use crate::grid::DataTableKind;
use crate::grid::SheetId;
use crate::{a1::A1Selection, CellValue, Pos, Rect, SheetPos, SheetRect};

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
#[derive(Default, Debug, Serialize, Deserialize, Clone, Copy)]
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

#[derive(Debug, Serialize, Deserialize, PartialEq)]
pub enum ClipboardOperation {
    Cut,
    Copy,
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

    #[serde(with = "crate::util::indexmap_serde")]
    pub data_tables: IndexMap<Pos, DataTable>,

    pub operation: ClipboardOperation,
}

impl GridController {
    pub fn cut_to_clipboard_operations(
        &mut self,
        selection: &A1Selection,
    ) -> Result<(Vec<Operation>, JsClipboard), String> {
        let sheet = self
            .try_sheet(selection.sheet_id)
            .ok_or("Unable to find Sheet")?;

        let js_clipboard = sheet.copy_to_clipboard(selection, ClipboardOperation::Cut)?;
        let operations = self.delete_values_and_formatting_operations(selection, true);

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
                                CellValue::Code(_) | CellValue::Import(_) => {
                                    Some((x as u32, *y as u32))
                                }
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

    fn clipboard_cell_values_operations(
        &self,
        start_pos: SheetPos,
        mut values: CellValues,
    ) -> Result<Vec<Operation>> {
        let mut ops = vec![];

        if let Some(sheet) = self.try_sheet(start_pos.sheet_id) {
            let rect =
                Rect::from_numbers(start_pos.x, start_pos.y, values.w as i64, values.h as i64);

            // Determine if the paste is happening within a data table.
            // If so, replace values in the data table with the
            // intersection of the data table and the paste
            for (output_rect, intersection_rect, data_table) in
                sheet.iter_code_output_intersects_rect(rect)
            {
                let contains_source_cell = intersection_rect.contains(output_rect.min);
                // there is no pasting on top of code cell output
                if !data_table.readonly && !contains_source_cell {
                    let adjusted_rect = Rect::from_numbers(
                        intersection_rect.min.x - start_pos.x,
                        intersection_rect.min.y - start_pos.y,
                        intersection_rect.width() as i64,
                        intersection_rect.height() as i64,
                    );

                    // pull the values from `values`, replacing
                    // the values in `values` with CellValue::Blank
                    let cell_values = values.get_rect(adjusted_rect);

                    let paste_code_cell_in_import = cell_values.iter().any(|col| {
                        col.iter().any(|cell_value| {
                            cell_value.is_code()
                                || cell_value.is_import()
                                || cell_value.is_image()
                                || cell_value.is_html()
                        })
                    });
                    if paste_code_cell_in_import {
                        crate::wasm_bindings::js::jsClientMessage(
                            "Error pasting values in table".to_string(),
                            JsSnackbarSeverity::Error.to_string(),
                        );
                        return Err(Error::msg("Error pasting values in table"));
                    }

                    let contains_header = intersection_rect.y_range().contains(&output_rect.min.y);
                    let headers = data_table.column_headers.to_owned();

                    if let (Some(mut headers), true) = (headers, contains_header) {
                        let y = output_rect.min.y - start_pos.y;

                        for x in intersection_rect.x_range() {
                            let new_x = x - output_rect.min.x;

                            if let Some(header) = headers.get_mut(new_x as usize) {
                                let safe_x = u32::try_from(x - start_pos.x).unwrap_or(0);
                                let safe_y = u32::try_from(y).unwrap_or(0);

                                let cell_value =
                                    values.remove(safe_x, safe_y).unwrap_or(CellValue::Blank);

                                header.name = cell_value;
                            }
                        }

                        let sheet_pos = output_rect.min.to_sheet_pos(start_pos.sheet_id);
                        ops.push(Operation::DataTableMeta {
                            sheet_pos,
                            name: None,
                            alternating_colors: None,
                            columns: Some(headers.to_vec()),
                            show_ui: None,
                            show_name: None,
                            show_columns: None,
                            readonly: None,
                        });
                    }

                    let sheet_pos = intersection_rect.min.to_sheet_pos(start_pos.sheet_id);
                    ops.push(Operation::SetDataTableAt {
                        sheet_pos,
                        values: CellValues::from(cell_values),
                    });
                }
            }
        }

        ops.push(Operation::SetCellValues {
            sheet_pos: start_pos,
            values,
        });

        Ok(ops)
    }

    fn clipboard_code_operations(
        &self,
        start_pos: SheetPos,
        clipboard_origin: ClipboardOrigin,
        mut clipboard_data_tables: IndexMap<Pos, DataTable>,
        clipboard_operation: ClipboardOperation,
        code: Vec<(u32, u32)>,
        cursor: &mut A1Selection,
    ) -> Result<Vec<Operation>> {
        let mut ops = vec![];

        if let Some(sheet) = self.try_sheet(start_pos.sheet_id) {
            for (x, y) in code.iter() {
                let sheet_pos = SheetPos {
                    x: start_pos.x + *x as i64,
                    y: start_pos.y + *y as i64,
                    sheet_id: start_pos.sheet_id,
                };

                let paste_in_import = sheet
                    .iter_code_output_in_rect(Rect::single_pos(Pos::from(sheet_pos)))
                    .any(|(_, data_table)| matches!(data_table.kind, DataTableKind::Import(_)));
                if paste_in_import {
                    crate::wasm_bindings::js::jsClientMessage(
                        "Error pasting values in table".to_string(),
                        JsSnackbarSeverity::Error.to_string(),
                    );
                    return Err(Error::msg("Error pasting values in table"));
                }

                let source_pos = Pos {
                    x: clipboard_origin.x + *x as i64,
                    y: clipboard_origin.y + *y as i64,
                };

                if let Some(mut data_table) = clipboard_data_tables.shift_remove(&source_pos) {
                    if matches!(clipboard_operation, ClipboardOperation::Copy) {
                        let old_name = data_table.name.to_display();
                        let new_name = self.grid().unique_data_table_name(&old_name, false, None);

                        // update table name in paste cursor selection
                        cursor.replace_table_name(&old_name, &new_name);

                        data_table.name = new_name.into();
                    }

                    ops.push(Operation::SetDataTable {
                        sheet_pos,
                        data_table: Some(data_table),
                        index: 0,
                    });
                }

                ops.push(Operation::ComputeCode { sheet_pos });
            }
        }

        Ok(ops)
    }

    fn clipboard_formats_operations(
        &self,
        sheet_id: SheetId,
        mut sheet_format_updates: SheetFormatUpdates,
        formats_rect: Rect,
    ) -> Vec<Operation> {
        let mut ops = vec![];

        if let Some(sheet) = self.try_sheet(sheet_id) {
            for (output_rect, intersection_rect, data_table) in
                sheet.iter_code_output_intersects_rect(formats_rect)
            {
                let mut table_format_updates = SheetFormatUpdates::default();

                let data_table_pos = output_rect.min;

                for x in intersection_rect.x_range() {
                    for y in intersection_rect.y_range() {
                        let mut pos = Pos { x, y };
                        let update = sheet_format_updates.format_update(pos);
                        sheet_format_updates.set_format_cell(pos, FormatUpdate::cleared());

                        // handle show_variable, 0-based
                        pos.translate_in_place(
                            -data_table_pos.x,
                            -data_table_pos.y - data_table.y_adjustment(true),
                            -1,
                            -1,
                        );

                        if pos.x < 0 || pos.y < 0 {
                            continue;
                        }
                        // handle hide columns
                        pos.x = data_table.get_column_index_from_display_index(pos.x as u32) as i64;

                        // handle sort
                        pos.y = data_table.transmute_index(pos.y as u64) as i64;

                        // 1-based
                        pos.translate_in_place(1, 1, 1, 1);

                        table_format_updates.set_format_cell(pos, update);
                    }
                }

                ops.push(Operation::DataTableFormats {
                    sheet_pos: data_table_pos.to_sheet_pos(sheet_id),
                    formats: table_format_updates,
                });
            }
        }

        if !sheet_format_updates.is_default() {
            ops.push(Operation::SetCellFormatsA1 {
                sheet_id,
                formats: sheet_format_updates,
            });
        }

        ops
    }

    /// Gets operations to add validations from clipboard to sheet.
    fn clipboard_validations_operations(
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
    ) -> Result<Vec<Operation>> {
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
                    let cell_value_ops = self.clipboard_cell_values_operations(
                        start_pos.to_sheet_pos(selection.sheet_id),
                        values,
                    )?;
                    ops.extend(cell_value_ops);
                }

                let code_ops = self.clipboard_code_operations(
                    start_pos.to_sheet_pos(selection.sheet_id),
                    clipboard.origin,
                    clipboard.data_tables,
                    clipboard.operation,
                    code,
                    &mut cursor,
                )?;
                ops.extend(code_ops);

                let validations_ops = self.clipboard_validations_operations(
                    clipboard.validations,
                    start_pos.to_sheet_pos(selection.sheet_id),
                );
                ops.extend(validations_ops);
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

        if matches!(special, PasteSpecial::None | PasteSpecial::Formats) {
            // for formats and borders, we need to translate the clipboard to the start_pos
            let contiguous_2d_translate_x = start_pos.x - clipboard.origin.x;
            let contiguous_2d_translate_y = start_pos.y - clipboard.origin.y;

            if let Some(mut formats) = clipboard.formats {
                formats.translate_in_place(contiguous_2d_translate_x, contiguous_2d_translate_y);
                let formats_ops = self.clipboard_formats_operations(
                    selection.sheet_id,
                    formats,
                    Rect::from_numbers(
                        start_pos.x,
                        start_pos.y,
                        clipboard.w as i64,
                        clipboard.h as i64,
                    ),
                );
                ops.extend(formats_ops);
            }

            if let Some(mut borders) = clipboard.borders {
                borders.translate_in_place(contiguous_2d_translate_x, contiguous_2d_translate_y);
                ops.push(Operation::SetBordersA1 {
                    sheet_id: selection.sheet_id,
                    borders,
                });
            }
        }

        ops.push(Operation::SetCursorA1 { selection: cursor });

        Ok(ops)
    }

    pub fn paste_plain_text_operations(
        &mut self,
        start_pos: SheetPos,
        plain_text: String,
        special: PasteSpecial,
    ) -> Result<Vec<Operation>> {
        // nothing to paste from plain text for formats
        if matches!(special, PasteSpecial::Formats) {
            return Ok(vec![]);
        }
        let lines: Vec<&str> = plain_text.split('\n').collect();

        let mut ops = vec![];
        let mut compute_code_ops = vec![];

        // calculate the width by checking the first line (with the assumption that all lines should have the same width)
        let w = lines
            .first()
            .map(|line| line.split('\t').count())
            .unwrap_or(0);
        let h = lines.len();

        let mut values = CellValues::new(w as u32, h as u32);
        let mut sheet_format_updates = SheetFormatUpdates::default();

        lines.iter().enumerate().for_each(|(y, line)| {
            line.split('\t').enumerate().for_each(|(x, value)| {
                let (cell_value, format_update) = self.string_to_cell_value(value, true);

                let is_code = matches!(cell_value, CellValue::Code(_));

                if cell_value != CellValue::Blank {
                    values.set(x as u32, y as u32, cell_value);
                }

                let pos = Pos {
                    x: start_pos.x + x as i64,
                    y: start_pos.y + y as i64,
                };

                if !format_update.is_default() {
                    sheet_format_updates.set_format_cell(pos, format_update);
                }

                if is_code {
                    compute_code_ops.push(Operation::ComputeCode {
                        sheet_pos: pos.to_sheet_pos(start_pos.sheet_id),
                    });
                }
            });
        });

        let cell_value_ops = self.clipboard_cell_values_operations(start_pos, values)?;
        ops.extend(cell_value_ops);

        if !sheet_format_updates.is_default() {
            let formats_rect =
                Rect::from_numbers(start_pos.x, start_pos.y, w as i64, lines.len() as i64);
            let formats_ops = self.clipboard_formats_operations(
                start_pos.sheet_id,
                sheet_format_updates,
                formats_rect,
            );
            ops.extend(formats_ops);
        }

        ops.extend(compute_code_ops);

        Ok(ops)
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

                let context = self.a1_context();
                let delta_x = insert_at.x - clipboard.origin.x;
                let delta_y = insert_at.y - clipboard.origin.y;

                // loop through the clipboard and replace cell references in formulas, translate cell references in other languages
                for (x, col) in clipboard.cells.columns.iter_mut().enumerate() {
                    for (&y, cell) in col.iter_mut() {
                        match cell {
                            CellValue::Code(code_cell) => match code_cell.language {
                                CodeCellLanguage::Formula => {
                                    code_cell.code = replace_a1_notation(
                                        &code_cell.code,
                                        context,
                                        Pos {
                                            x: insert_at.x + x as i64,
                                            y: insert_at.y + y as i64,
                                        }
                                        .to_sheet_pos(selection.sheet_id),
                                    );
                                }
                                _ => {
                                    if clipboard.operation == ClipboardOperation::Copy {
                                        code_cell.translate_cell_references(
                                            delta_x,
                                            delta_y,
                                            &selection.sheet_id,
                                            context,
                                        );
                                    }
                                }
                            },
                            _ => { /* noop */ }
                        };
                    }
                }

                self.set_clipboard_cells(selection, clipboard, special)
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

    use super::{PasteSpecial, *};
    use crate::a1::{A1Context, A1Selection, CellRefRange, TableRef};
    use crate::controller::active_transactions::transaction_name::TransactionName;
    use crate::controller::user_actions::import::tests::{simple_csv, simple_csv_at};
    use crate::grid::js_types::JsClipboard;
    use crate::grid::sheet::validations::validation_rules::ValidationRule;
    use crate::grid::{CellWrap, CodeCellLanguage, SheetId};
    use crate::test_util::{
        assert_cell_value_row, assert_data_table_cell_value, print_data_table, print_table,
    };
    use crate::wasm_bindings::js::{clear_js_calls, expect_js_call};
    use crate::Rect;

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
        sheet.test_set_values(1, 5, 1, 5, vec!["1", "2", "3", "4", "5"]);
        let selection = A1Selection::test_a1("A");
        let JsClipboard { html, .. } = sheet
            .copy_to_clipboard(&selection, ClipboardOperation::Copy)
            .unwrap();
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
    fn paste_clipboard_cells_rows() {
        let mut gc = GridController::test();
        let sheet_id = gc.sheet_ids()[0];
        let sheet = gc.sheet_mut(sheet_id);
        sheet.test_set_values(5, 2, 5, 1, vec!["1", "2", "3", "4", "5"]);
        let selection: A1Selection = A1Selection::test_a1("2");
        let JsClipboard { html, .. } = sheet
            .copy_to_clipboard(&selection, ClipboardOperation::Copy)
            .unwrap();
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
    fn paste_clipboard_cells_all() {
        let mut gc = GridController::test();
        let sheet_id = gc.sheet_ids()[0];
        let sheet = gc.sheet_mut(sheet_id);
        sheet.test_set_values(3, 3, 2, 2, vec!["1", "2", "3", "4"]);
        sheet.recalculate_bounds();
        let selection = A1Selection::all(sheet_id);
        let JsClipboard { html, .. } = sheet
            .copy_to_clipboard(&selection, ClipboardOperation::Copy)
            .unwrap();
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
        let selection = A1Selection::test_a1("A:B,3:4,A3");
        let JsClipboard { html, .. } = sheet
            .copy_to_clipboard(&selection, ClipboardOperation::Copy)
            .unwrap();

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
        let operations = gc.clipboard_validations_operations(
            Some(validations),
            SheetPos {
                x: 2,
                y: 2,
                sheet_id: SheetId::TEST,
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
    fn paste_clipboard_with_formula() {
        let mut gc = GridController::test();
        let sheet_id = gc.sheet_ids()[0];

        gc.set_cell_values(
            SheetPos {
                x: 2,
                y: 1,
                sheet_id,
            },
            vec![vec!["1".into()], vec!["2".into()], vec!["3".into()]],
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
        let JsClipboard { html, .. } = gc
            .sheet(sheet_id)
            .copy_to_clipboard(&selection, ClipboardOperation::Copy)
            .unwrap();

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
    fn copy_paste_clipboard_with_data_table() {
        clear_js_calls();

        let (mut gc, sheet_id, _, _) = simple_csv();
        let paste = |gc: &mut GridController, x, y, html| {
            gc.paste_from_clipboard(
                &A1Selection::from_xy(x, y, sheet_id),
                None,
                Some(html),
                PasteSpecial::None,
                None,
            );
        };

        let table_ref = TableRef::new("simple.csv");
        let cell_ref_range = CellRefRange::Table { range: table_ref };
        let context = A1Context::test(
            &[("Sheet1", sheet_id)],
            &[(
                "simple.csv",
                &["city", "region", "country", "population"],
                Rect::test_a1("A1:D11"),
            )],
        );
        let selection = A1Selection::from_range(cell_ref_range, sheet_id, &context);

        let JsClipboard { html, .. } = gc
            .sheet(sheet_id)
            .copy_to_clipboard(&selection, ClipboardOperation::Copy)
            .unwrap();

        let expected_row1 = vec!["city", "region", "country", "population"];

        // paste side by side
        paste(&mut gc, 10, 1, html.clone());
        print_table(&gc, sheet_id, Rect::from_numbers(10, 1, 4, 11));
        assert_cell_value_row(&gc, sheet_id, 10, 13, 0, expected_row1);

        let cursor = A1Selection::table(pos![J2].to_sheet_pos(sheet_id), "simple.csv1");
        expect_js_call("jsSetCursor", serde_json::to_string(&cursor).unwrap(), true);
    }

    #[test]
    fn cut_paste_clipboard_with_data_table() {
        let (mut gc, sheet_id, _, _) = simple_csv();
        let paste = |gc: &mut GridController, x, y, html| {
            gc.paste_from_clipboard(
                &A1Selection::from_xy(x, y, sheet_id),
                None,
                Some(html),
                PasteSpecial::None,
                None,
            );
        };

        let table_ref = TableRef::new("simple.csv");
        let cell_ref_range = CellRefRange::Table { range: table_ref };
        let context = A1Context::test(
            &[("Sheet1", sheet_id)],
            &[(
                "simple.csv",
                &["city", "region", "country", "population"],
                Rect::test_a1("A1:BV11"),
            )],
        );
        let selection = A1Selection::from_range(cell_ref_range, sheet_id, &context);

        // let selection = A1Selection::test_a1("A1:B4");

        let (ops, js_clipboard) = gc.cut_to_clipboard_operations(&selection).unwrap();
        gc.start_user_transaction(ops, None, TransactionName::CutClipboard);

        // let js_clipboard = gc
        //     .sheet(sheet_id)
        //     .copy_to_clipboard(&selection, ClipboardOperation::Copy)
        //     .unwrap();

        let expected_row1 = vec!["city", "region", "country", "population"];

        // paste side by side
        paste(&mut gc, 10, 1, js_clipboard.html.clone());
        print_table(&gc, sheet_id, Rect::from_numbers(10, 1, 4, 11));
        assert_cell_value_row(&gc, sheet_id, 10, 13, 0, expected_row1);
    }

    #[test]
    fn update_code_cell_references_python() {
        let mut gc = GridController::test();
        let sheet_id = gc.sheet_ids()[0];

        gc.set_code_cell(
            pos![C3].to_sheet_pos(sheet_id),
            CodeCellLanguage::Python,
            r#"q.cells("A1:B2", first_row_header=True)"#.to_string(),
            None,
        );

        let selection = A1Selection::test_a1("A1:E5");
        let JsClipboard { html, .. } = gc
            .sheet(sheet_id)
            .copy_to_clipboard(&selection, ClipboardOperation::Copy)
            .unwrap();

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
    fn paste_clipboard_on_top_of_data_table() {
        let (mut gc, sheet_id, _, _) = simple_csv_at(Pos { x: 2, y: 0 });
        let sheet = gc.sheet_mut(sheet_id);
        let rect = SheetRect::from_numbers(10, 0, 2, 2, sheet.id);

        sheet.test_set_values(10, 0, 2, 2, vec!["1", "2", "3", "4"]);
        let JsClipboard { html, .. } = sheet
            .copy_to_clipboard(&A1Selection::from_rect(rect), ClipboardOperation::Copy)
            .unwrap();

        let paste = |gc: &mut GridController, x, y, html| {
            gc.paste_from_clipboard(
                &A1Selection::from_xy(x, y, sheet_id),
                None,
                Some(html),
                PasteSpecial::None,
                None,
            );
        };

        let expected_row1 = vec!["1", "2"];
        let expected_row2 = vec!["3", "4"];

        // paste overlap inner
        paste(&mut gc, 4, 2, html.clone());
        print_table(&gc, sheet_id, Rect::from_numbers(0, 0, 8, 11));
        assert_cell_value_row(&gc, sheet_id, 4, 5, 2, expected_row1.clone());
        assert_cell_value_row(&gc, sheet_id, 4, 5, 3, expected_row2.clone());
        gc.undo(None);

        // paste overlap with right grid
        paste(&mut gc, 5, 2, html.clone());
        print_table(&gc, sheet_id, Rect::from_numbers(0, 0, 8, 11));
        assert_cell_value_row(&gc, sheet_id, 5, 6, 2, expected_row1.clone());
        assert_cell_value_row(&gc, sheet_id, 5, 6, 3, expected_row2.clone());
        gc.undo(None);

        // paste overlap with bottom grid
        paste(&mut gc, 4, 10, html.clone());
        print_table(&gc, sheet_id, Rect::from_numbers(0, 0, 8, 12));
        assert_cell_value_row(&gc, sheet_id, 4, 5, 10, expected_row1.clone());
        assert_cell_value_row(&gc, sheet_id, 4, 5, 11, expected_row2.clone());
        gc.undo(None);

        // paste overlap with bottom left grid
        paste(&mut gc, 1, 10, html.clone());
        print_table(&gc, sheet_id, Rect::from_numbers(0, 0, 8, 12));
        // print_table(&gc, sheet_id, Rect::from_numbers(1, 10, 2, 2));
        assert_cell_value_row(&gc, sheet_id, 1, 2, 10, expected_row1.clone());
        assert_cell_value_row(&gc, sheet_id, 1, 2, 11, expected_row2.clone());
        gc.undo(None);

        // paste overlap with top left grid
        paste(&mut gc, 3, 0, html.clone());
        print_data_table(&gc, sheet_id, Rect::from_numbers(2, 0, 4, 4));
        // print_table(&gc, sheet_id, Rect::from_numbers(2, 0, 4, 4));
        // assert_cell_value_row(&gc, sheet_id, 1, 2, 10, expected_row1.clone());
        // assert_cell_value_row(&gc, sheet_id, 1, 2, 11, expected_row2.clone());
        gc.undo(None);
    }

    #[test]
    fn update_code_cell_references_javascript() {
        let mut gc = GridController::test();
        let sheet_id = gc.sheet_ids()[0];

        gc.set_code_cell(
            pos![C3].to_sheet_pos(sheet_id),
            CodeCellLanguage::Javascript,
            r#"return q.cells("A1:B2");"#.to_string(),
            None,
        );

        let selection = A1Selection::test_a1("A1:E5");
        let JsClipboard { html, .. } = gc
            .sheet(sheet_id)
            .copy_to_clipboard(&selection, ClipboardOperation::Copy)
            .unwrap();

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
    fn paste_code_cell_inside_data_table() {
        clear_js_calls();

        let (mut gc, sheet_id, _, _) = simple_csv_at(pos![A1]);

        gc.set_code_cell(
            pos![J1].to_sheet_pos(sheet_id),
            CodeCellLanguage::Javascript,
            r#"return "test";"#.to_string(),
            None,
        );

        let sheet = gc.sheet_mut(sheet_id);
        let rect = SheetRect::single_pos(pos![J1], sheet_id);
        let JsClipboard { html, .. } = sheet
            .copy_to_clipboard(&A1Selection::from_rect(rect), ClipboardOperation::Copy)
            .unwrap();

        assert!(gc
            .paste_html_operations(
                &A1Selection::test_a1_sheet_id("B2", &sheet_id),
                html,
                PasteSpecial::None,
            )
            .is_err());

        expect_js_call(
            "jsClientMessage",
            format!(
                "Error pasting values in table,{}",
                JsSnackbarSeverity::Error
            ),
            true,
        );

        assert_data_table_cell_value(&gc, sheet_id, 2, 3, "MA");
    }

    #[test]
    fn paste_plain_html_inside_data_table() {
        let (mut gc, sheet_id, pos, _) = simple_csv_at(pos![E2]);

        gc.set_cell_value(pos![B2].to_sheet_pos(sheet_id), "1".to_string(), None);
        gc.set_cell_value(pos![C2].to_sheet_pos(sheet_id), "123,456".to_string(), None);
        gc.set_cell_value(pos![B3].to_sheet_pos(sheet_id), "654,321".to_string(), None);
        gc.set_cell_value(pos![C3].to_sheet_pos(sheet_id), "4".to_string(), None);

        // hide the second column
        let data_table = gc.sheet(sheet_id).data_table(pos).unwrap();
        let mut column_headers = data_table.column_headers.to_owned().unwrap();
        column_headers[1].display = false;
        gc.test_data_table_update_meta(
            pos.to_sheet_pos(sheet_id),
            Some(column_headers),
            None,
            None,
            None,
        );

        let sheet = gc.sheet(sheet_id);
        assert_eq!(
            sheet.display_value(pos![E13]).unwrap(),
            CellValue::Text("Concord".to_string())
        );
        assert_eq!(
            sheet.display_value(pos![F13]).unwrap(),
            CellValue::Text("United States".to_string())
        );
        assert!(sheet.cell_format(pos![E13]).is_table_default());
        assert!(sheet.cell_format(pos![F13]).is_table_default());
        assert!(sheet.cell_format(pos![E14]).is_default());
        assert!(sheet.cell_format(pos![F14]).is_default());

        let JsClipboard { html, .. } = gc
            .sheet(sheet_id)
            .copy_to_clipboard(
                &A1Selection::test_a1_sheet_id("B2:C3", &sheet_id),
                ClipboardOperation::Copy,
            )
            .unwrap();

        gc.paste_from_clipboard(
            &A1Selection::test_a1_sheet_id("E13", &sheet_id),
            None,
            Some(html),
            PasteSpecial::None,
            None,
        );

        let sheet = gc.sheet(sheet_id);
        assert_eq!(
            sheet.display_value(pos![E13]).unwrap(),
            CellValue::Number(1.into())
        );
        assert_eq!(
            sheet.display_value(pos![F13]).unwrap(),
            CellValue::Number(123456.into())
        );
        assert_eq!(
            sheet.display_value(pos![E14]).unwrap(),
            CellValue::Number(654321.into())
        );
        assert_eq!(
            sheet.display_value(pos![F14]).unwrap(),
            CellValue::Number(4.into())
        );
        assert!(sheet.cell_format(pos![E13]).is_table_default());
        assert_eq!(
            sheet.cell_format(pos![F13]),
            Format {
                wrap: Some(CellWrap::Clip),
                numeric_commas: Some(true),
                ..Default::default()
            }
        );
        assert_eq!(
            sheet.cell_format(pos![E14]),
            Format {
                numeric_commas: Some(true),
                ..Default::default()
            }
        );
        assert!(sheet.cell_format(pos![F14]).is_default());

        // show the second column
        let data_table = gc.sheet(sheet_id).data_table(pos).unwrap();
        let mut column_headers = data_table.column_headers.to_owned().unwrap();
        column_headers[1].display = true;
        gc.test_data_table_update_meta(
            pos.to_sheet_pos(sheet_id),
            Some(column_headers),
            None,
            None,
            None,
        );

        let sheet = gc.sheet(sheet_id);
        assert_eq!(
            sheet.display_value(pos![E13]).unwrap(),
            CellValue::Number(1.into())
        );
        assert_eq!(
            sheet.display_value(pos![F13]).unwrap(),
            CellValue::Text("NH".to_string())
        );
        assert_eq!(
            sheet.display_value(pos![G13]).unwrap(),
            CellValue::Number(123456.into())
        );
        assert_eq!(
            sheet.display_value(pos![E14]).unwrap(),
            CellValue::Number(654321.into())
        );
        assert_eq!(
            sheet.display_value(pos![F14]).unwrap(),
            CellValue::Number(4.into())
        );
        assert!(sheet.cell_format(pos![E13]).is_table_default());
        assert!(sheet.cell_format(pos![F13]).is_table_default());
        assert_eq!(
            sheet.cell_format(pos![G13]),
            Format {
                wrap: Some(CellWrap::Clip),
                numeric_commas: Some(true),
                ..Default::default()
            }
        );
        assert_eq!(
            sheet.cell_format(pos![E14]),
            Format {
                numeric_commas: Some(true),
                ..Default::default()
            }
        );
        assert!(sheet.cell_format(pos![F14]).is_default());
    }

    #[test]
    fn paste_plain_text_inside_data_table() {
        let (mut gc, sheet_id, pos, _) = simple_csv_at(pos![E2]);

        gc.set_cell_value(pos![B2].to_sheet_pos(sheet_id), "1".to_string(), None);
        gc.set_cell_value(pos![C2].to_sheet_pos(sheet_id), "123,456".to_string(), None);
        gc.set_cell_value(pos![B3].to_sheet_pos(sheet_id), "654,321".to_string(), None);
        gc.set_cell_value(pos![C3].to_sheet_pos(sheet_id), "4".to_string(), None);

        // hide the second column
        let data_table = gc.sheet(sheet_id).data_table(pos).unwrap();
        let mut column_headers = data_table.column_headers.to_owned().unwrap();
        column_headers[1].display = false;
        gc.test_data_table_update_meta(
            pos.to_sheet_pos(sheet_id),
            Some(column_headers),
            None,
            None,
            None,
        );

        let sheet = gc.sheet(sheet_id);
        assert_eq!(
            sheet.display_value(pos![E13]).unwrap(),
            CellValue::Text("Concord".to_string())
        );
        assert_eq!(
            sheet.display_value(pos![F13]).unwrap(),
            CellValue::Text("United States".to_string())
        );
        assert!(sheet.cell_format(pos![E13]).is_table_default());
        assert!(sheet.cell_format(pos![F13]).is_table_default());
        assert!(sheet.cell_format(pos![E14]).is_default());
        assert!(sheet.cell_format(pos![F14]).is_default());

        let JsClipboard { plain_text, .. } = gc
            .sheet(sheet_id)
            .copy_to_clipboard(
                &A1Selection::test_a1_sheet_id("B2:C3", &sheet_id),
                ClipboardOperation::Copy,
            )
            .unwrap();

        gc.paste_from_clipboard(
            &A1Selection::test_a1_sheet_id("E13", &sheet_id),
            Some(plain_text),
            None,
            PasteSpecial::None,
            None,
        );

        let sheet = gc.sheet(sheet_id);
        assert_eq!(
            sheet.display_value(pos![E13]).unwrap(),
            CellValue::Number(1.into())
        );
        assert_eq!(
            sheet.display_value(pos![F13]).unwrap(),
            CellValue::Number(123456.into())
        );
        assert_eq!(
            sheet.display_value(pos![E14]).unwrap(),
            CellValue::Number(654321.into())
        );
        assert_eq!(
            sheet.display_value(pos![F14]).unwrap(),
            CellValue::Number(4.into())
        );
        assert!(sheet.cell_format(pos![E13]).is_table_default());
        assert!(sheet.cell_format(pos![F13]).is_table_default());
        assert!(sheet.cell_format(pos![E14]).is_default());
        assert!(sheet.cell_format(pos![F14]).is_default());

        // show the second column
        let data_table = gc.sheet(sheet_id).data_table(pos).unwrap();
        let mut column_headers = data_table.column_headers.to_owned().unwrap();
        column_headers[1].display = true;
        gc.test_data_table_update_meta(
            pos.to_sheet_pos(sheet_id),
            Some(column_headers),
            None,
            None,
            None,
        );

        let sheet = gc.sheet(sheet_id);
        assert_eq!(
            sheet.display_value(pos![E13]).unwrap(),
            CellValue::Number(1.into())
        );
        assert_eq!(
            sheet.display_value(pos![F13]).unwrap(),
            CellValue::Text("NH".to_string())
        );
        assert_eq!(
            sheet.display_value(pos![G13]).unwrap(),
            CellValue::Number(123456.into())
        );
        assert_eq!(
            sheet.display_value(pos![E14]).unwrap(),
            CellValue::Number(654321.into())
        );
        assert_eq!(
            sheet.display_value(pos![F14]).unwrap(),
            CellValue::Number(4.into())
        );
        assert!(sheet.cell_format(pos![E13]).is_table_default());
        assert!(sheet.cell_format(pos![F13]).is_table_default());
        assert!(sheet.cell_format(pos![G13]).is_table_default());
        assert!(sheet.cell_format(pos![E14]).is_default());
        assert!(sheet.cell_format(pos![F14]).is_default());
    }
}
