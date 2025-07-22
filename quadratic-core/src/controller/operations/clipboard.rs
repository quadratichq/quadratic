use std::collections::HashMap;

use anyhow::{Error, Result};
use indexmap::IndexMap;
use regex::Regex;
use serde::{Deserialize, Serialize};
use uuid::Uuid;

use super::operation::Operation;
use crate::cell_values::CellValues;
use crate::controller::GridController;
use crate::grid::DataTable;
use crate::grid::DataTableKind;
use crate::grid::Sheet;
use crate::grid::SheetId;
use crate::grid::formats::Format;
use crate::grid::formats::FormatUpdate;
use crate::grid::formats::SheetFormatUpdates;
use crate::grid::js_types::JsClipboard;
use crate::grid::sheet::borders::BordersUpdates;
use crate::grid::sheet::validations::validation::Validation;
use crate::grid::unique_data_table_name;
use crate::{CellValue, Pos, Rect, RefAdjust, RefError, SheetPos, SheetRect, a1::A1Selection};

// todo: this probably belongs in sheet and not controller

#[derive(Debug, Serialize, Deserialize, Clone, Copy, ts_rs::TS)]
pub enum PasteSpecial {
    // paste normal
    None,
    // paste only values
    Values,
    // paste only formatting/borders
    Formats,
}

/// This is used to track the origin of copies from column, row, or all
/// selection. In order to paste a column, row, or all, we need to know the
/// origin of the copy.
///
/// For example, this is used to copy and paste a column
/// on top of another column, or a sheet on top of another sheet.
#[derive(Debug, Serialize, Deserialize, Clone, Copy)]
pub struct ClipboardOrigin {
    pub x: i64,
    pub y: i64,
    pub sheet_id: SheetId,
    pub column: Option<i64>,
    pub row: Option<i64>,
    pub all: Option<(i64, i64)>,
}
impl ClipboardOrigin {
    pub fn default(sheet_id: SheetId) -> Self {
        Self {
            x: 0,
            y: 0,
            sheet_id,
            column: None,
            row: None,
            all: None,
        }
    }
}

#[derive(Default, Debug, Serialize, Deserialize)]
pub struct ClipboardSheetFormats {
    pub columns: HashMap<i64, Format>,
    pub rows: HashMap<i64, Format>,
    pub all: Option<Format>,
}

#[derive(Default, Clone, Debug, Serialize, Deserialize)]
pub struct ClipboardValidations {
    pub validations: Vec<Validation>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub enum ClipboardOperation {
    Cut,
    Copy,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
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

impl Clipboard {
    /// Decode the clipboard html and return a Clipboard struct.
    pub fn decode(html: &str) -> Result<Self> {
        let error = |e, msg| Error::msg(format!("Clipboard decode {msg:?}: {e:?}"));

        match Regex::new(r#"data-quadratic="(.*?)".*><tbody"#) {
            Err(e) => Err(error(e.to_string(), "Regex creation error")),
            Ok(re) => {
                // pull out the sub string
                let sub_string = re
                    .captures(html)
                    .ok_or_else(|| error("".into(), "Regex capture error"))?
                    .get(1)
                    .map_or("", |m| m.as_str());

                // decode html in attribute
                let decoded = htmlescape::decode_html(sub_string)
                    .map_err(|_| error("".into(), "Html decode error"))?;

                // parse into Clipboard
                serde_json::from_str::<Clipboard>(&decoded)
                    .map_err(|e| error(e.to_string(), "Serialization error"))
            }
        }
    }

    /// Return the largest rect that contains the clipboard, with `insert_at` as the top left corner
    pub fn to_rect(&self, insert_at: Pos) -> Rect {
        Rect::from_numbers(insert_at.x, insert_at.y, self.w as i64, self.h as i64)
    }
}

impl GridController {
    pub fn cut_to_clipboard_operations(
        &mut self,
        selection: &A1Selection,
        include_plain_text: bool,
    ) -> Result<(Vec<Operation>, JsClipboard), String> {
        let sheet = self
            .try_sheet(selection.sheet_id)
            .ok_or("Unable to find Sheet")?;

        let js_clipboard = sheet.copy_to_clipboard(
            selection,
            self.a1_context(),
            ClipboardOperation::Cut,
            include_plain_text,
        )?;

        let operations = self.delete_values_and_formatting_operations(selection, true);

        Ok((operations, js_clipboard))
    }

    /// Converts the clipboard to an (Array, Vec<(relative x, relative y) for a CellValue::Code>) tuple.
    fn cell_values_from_clipboard_cells(
        w: u32,
        h: u32,
        cells: &CellValues,
        values: &CellValues,
        special: PasteSpecial,
    ) -> (Option<CellValues>, Vec<(u32, u32)>) {
        if w == 0 && h == 0 {
            return (None, vec![]);
        }

        match special {
            PasteSpecial::Values => (Some(values.to_owned()), vec![]),
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
                (Some(cells.to_owned()), code)
            }
            _ => (None, vec![]),
        }
    }

    fn clipboard_cell_values_operations(
        &self,
        cell_values: &mut CellValues,
        cell_value_pos: Pos,
        start_pos: SheetPos,
        values: CellValues,
        clipboard_selection: Option<&A1Selection>,
        clipboard_operation: Option<&ClipboardOperation>,
    ) -> Result<Vec<Operation>> {
        let delete_value = matches!(clipboard_operation, Some(ClipboardOperation::Cut));

        self.cell_values_operations(
            clipboard_selection,
            start_pos,
            cell_value_pos,
            cell_values,
            values,
            delete_value,
        )
    }

    fn clipboard_code_operations(
        &self,
        start_pos: SheetPos,
        tables: Vec<(u32, u32)>,
        clipboard: &Clipboard,
        cursor: &mut A1Selection,
    ) -> Result<Vec<Operation>> {
        let mut ops = vec![];

        if let Some(sheet) = self.try_sheet(start_pos.sheet_id) {
            for (x, y) in tables.iter() {
                let source_pos = Pos {
                    x: clipboard.origin.x + *x as i64,
                    y: clipboard.origin.y + *y as i64,
                };

                let target_pos = Pos {
                    x: start_pos.x + *x as i64,
                    y: start_pos.y + *y as i64,
                };

                let paste_in_import = sheet
                    .iter_code_output_in_rect(Rect::single_pos(target_pos))
                    .any(|(output_rect, data_table)| {
                        // this table is being moved in the same transaction
                        if matches!(clipboard.operation, ClipboardOperation::Cut)
                            && start_pos.sheet_id == clipboard.selection.sheet_id
                            && clipboard
                                .selection
                                .contains_pos(output_rect.min, self.a1_context())
                        {
                            return false;
                        }

                        target_pos != output_rect.min
                            && matches!(data_table.kind, DataTableKind::Import(_))
                    });

                if paste_in_import {
                    let message = "Cannot place table within a table";

                    #[cfg(any(target_family = "wasm", test))]
                    {
                        let severity = crate::grid::js_types::JsSnackbarSeverity::Error;
                        crate::wasm_bindings::js::jsClientMessage(
                            message.to_owned(),
                            severity.to_string(),
                        );
                    }

                    return Err(Error::msg(message));
                }

                if let Some(data_table) = clipboard.data_tables.get(&source_pos) {
                    let mut data_table = data_table.to_owned();

                    if matches!(clipboard.operation, ClipboardOperation::Copy) {
                        let old_name = data_table.name().to_string();
                        let new_name =
                            unique_data_table_name(&old_name, false, None, self.a1_context());

                        // update table name in paste cursor selection
                        cursor.replace_table_name(&old_name, &new_name);

                        data_table.name = new_name.into();
                    }

                    ops.push(Operation::SetDataTable {
                        sheet_pos: target_pos.to_sheet_pos(start_pos.sheet_id),
                        data_table: Some(data_table),
                        index: usize::MAX,
                    });
                }

                // For a cut, only rerun the code if the cut rectangle overlaps
                // with the data table's cells accessed or if the paste rectangle
                // overlaps with the data table's cells accessed.
                let should_rerun =
                    self.clipboard_code_operations_should_rerun(clipboard, source_pos, start_pos);

                if should_rerun {
                    ops.push(Operation::ComputeCode {
                        sheet_pos: target_pos.to_sheet_pos(start_pos.sheet_id),
                    });
                }
            }
        }

        Ok(ops)
    }

    /// For a cut, only rerun the code if the cut rectangle overlaps
    /// with the data table's cells accessed or if the paste rectangle
    /// overlaps with the data table's cells accessed.
    fn clipboard_code_operations_should_rerun(
        &self,
        clipboard: &Clipboard,
        source_pos: Pos,
        start_pos: SheetPos,
    ) -> bool {
        match clipboard.operation {
            ClipboardOperation::Copy => true,
            ClipboardOperation::Cut => {
                let cut_rects = clipboard.selection.rects_unbounded(self.a1_context());
                let paste_rect = clipboard.to_rect(start_pos.into());

                let cells_accessed = clipboard
                    .data_tables
                    .get(&source_pos)
                    .and_then(|data_table| data_table.cells_accessed(start_pos.sheet_id));

                cells_accessed.as_ref().is_some_and(|ranges| {
                    ranges.iter().any(|range| {
                        let cut_intersects = cut_rects
                            .iter()
                            .any(|rect| range.might_intersect_rect(*rect, self.a1_context()));

                        let paste_intersects =
                            range.might_intersect_rect(paste_rect, self.a1_context());

                        cut_intersects || paste_intersects
                    })
                })
            }
        }
    }

    fn clipboard_formats_operations(
        &self,
        sheet_id: SheetId,
        sheet_format_updates: &mut SheetFormatUpdates,
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
                        pos.x = data_table.get_column_index_from_display_index(pos.x as u32, true)
                            as i64;

                        // handle sort
                        pos.y = data_table.get_row_index_from_display_index(pos.y as u64) as i64;

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

        ops
    }

    /// Gets operations to add validations from clipboard to sheet.
    fn clipboard_validations_operations(
        &self,
        validations: &Option<ClipboardValidations>,
        start_pos: SheetPos,
    ) -> Vec<Operation> {
        if let Some(validations) = validations {
            validations
                .to_owned()
                .validations
                .into_iter()
                .filter_map(|mut validation| {
                    validation.id = Uuid::new_v4();
                    validation.selection.sheet_id = start_pos.sheet_id;
                    validation.selection = validation
                        .selection
                        .saturating_translate(start_pos.x - 1, start_pos.y - 1)?;
                    Some(Operation::SetValidation { validation })
                })
                .collect()
        } else {
            vec![]
        }
    }

    /// Collect the operations to paste the clipboard cells
    /// For cell values, formats and borders, we just add to the data structure to avoid extra operations
    #[allow(clippy::too_many_arguments)]
    fn get_clipboard_ops(
        &self,
        mut start_pos: Pos,
        cell_value_pos: Pos,
        cell_values: &mut CellValues,
        formats: &mut SheetFormatUpdates,
        borders: &mut BordersUpdates,
        selection: &A1Selection,
        clipboard: &Clipboard,
        special: PasteSpecial,
    ) -> Result<(Vec<Operation>, Vec<Operation>)> {
        let mut ops = vec![];
        let mut code_ops: Vec<_> = vec![];
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
            .clone()
            .saturating_translate(cursor_translate_x, cursor_translate_y)
            .ok_or(RefError)?;

        cursor.sheet_id = selection.sheet_id;

        match special {
            PasteSpecial::None => {
                let (values, tables) = GridController::cell_values_from_clipboard_cells(
                    clipboard.w,
                    clipboard.h,
                    &clipboard.cells,
                    &clipboard.values,
                    special,
                );

                if let Some(values) = values {
                    let cell_value_ops = self.clipboard_cell_values_operations(
                        cell_values,
                        cell_value_pos,
                        start_pos.to_sheet_pos(selection.sheet_id),
                        values,
                        Some(&clipboard.selection),
                        Some(&clipboard.operation),
                    )?;
                    ops.extend(cell_value_ops);
                }

                code_ops.extend(self.clipboard_code_operations(
                    start_pos.to_sheet_pos(selection.sheet_id),
                    tables,
                    clipboard,
                    &mut cursor,
                )?);

                let validations_ops = self.clipboard_validations_operations(
                    &clipboard.validations,
                    start_pos.to_sheet_pos(selection.sheet_id),
                );
                ops.extend(validations_ops);
            }
            PasteSpecial::Values => {
                let (values, _) = GridController::cell_values_from_clipboard_cells(
                    clipboard.w,
                    clipboard.h,
                    &clipboard.cells,
                    &clipboard.values,
                    special,
                );

                if let Some(values) = values {
                    let cell_value_ops = self.clipboard_cell_values_operations(
                        cell_values,
                        cell_value_pos,
                        start_pos.to_sheet_pos(selection.sheet_id),
                        values,
                        Some(&clipboard.selection),
                        Some(&clipboard.operation),
                    )?;
                    ops.extend(cell_value_ops);
                }
            }
            _ => (),
        }

        if matches!(special, PasteSpecial::None | PasteSpecial::Formats) {
            // for formats and borders, we need to translate the clipboard to the start_pos
            let contiguous_2d_translate_x = start_pos.x - clipboard.origin.x;
            let contiguous_2d_translate_y = start_pos.y - clipboard.origin.y;

            if !formats.is_default() {
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

            if !borders.is_empty() {
                borders.translate_in_place(contiguous_2d_translate_x, contiguous_2d_translate_y);
            }
        }

        Ok((ops, code_ops))
    }

    /// Collect the operations to paste the clipboard cells from plain text
    pub fn paste_plain_text_operations(
        &mut self,
        start_pos: SheetPos,
        end_pos: Pos,
        selection: &A1Selection,
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

        // If the clipboard is larger than the selection, we need to paste multiple times.
        // We don't want the paste to exceed the bounds of the selection (e.g. end_pos).
        let (max_x, max_y, cell_value_width, cell_value_height) =
            Self::get_max_paste_area(start_pos.into(), end_pos, w as u32, h as u32);

        // collect all cell values, values and sheet format updates for a a single operation
        let mut cell_values = CellValues::new(cell_value_width as u32, cell_value_height as u32);
        let mut values = CellValues::new(cell_value_width as u32, cell_value_height as u32);
        let mut sheet_format_updates = SheetFormatUpdates::default();

        // collect the plain text clipboard cells
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

        // loop through the paste area and collect the operations
        for (start_x, x) in (start_pos.x..=max_x).enumerate().step_by(w) {
            for (start_y, y) in (start_pos.y..=max_y).enumerate().step_by(h) {
                let cell_value_pos = Pos::from((start_x, start_y));
                let sheet_pos = SheetPos::new(start_pos.sheet_id, x, y);

                ops.extend(self.clipboard_cell_values_operations(
                    &mut cell_values,
                    cell_value_pos,
                    sheet_pos,
                    values.to_owned(), // we need to copy the values for each paste block
                    None,
                    None,
                )?);
            }
        }

        ops.push(Operation::SetCellValues {
            sheet_pos: start_pos,
            values: cell_values,
        });

        if !sheet_format_updates.is_default() {
            let formats_rect =
                Rect::from_numbers(start_pos.x, start_pos.y, w as i64, lines.len() as i64);

            ops.extend(self.clipboard_formats_operations(
                start_pos.sheet_id,
                &mut sheet_format_updates,
                formats_rect,
            ));

            ops.push(Operation::SetCellFormatsA1 {
                sheet_id: start_pos.sheet_id,
                formats: sheet_format_updates,
            });
        }

        ops.push(Operation::SetCursorA1 {
            selection: selection.to_owned(),
        });

        ops.extend(compute_code_ops);

        Ok(ops)
    }

    // todo: parse table structure to provide better pasting experience from other spreadsheets
    pub fn paste_html_operations(
        &mut self,
        insert_at: Pos,
        end_pos: Pos,
        selection: &A1Selection,
        html: String,
        special: PasteSpecial,
    ) -> Result<(Vec<Operation>, Vec<Operation>)> {
        let mut ops = vec![];
        let mut clipboard_ops = vec![];
        let mut compute_code_ops = vec![];
        let mut data_table_ops = vec![];
        let mut clipboard = Clipboard::decode(&html)?;
        let clipboard_rect = clipboard.to_rect(insert_at);

        let sheet_id = match clipboard.operation {
            ClipboardOperation::Cut => selection.sheet_id,
            ClipboardOperation::Copy => clipboard.origin.sheet_id,
        };

        // If the clipboard is larger than the selection, we need to paste multiple times.
        // We don't want the paste to exceed the bounds of the selection (e.g. end_pos).
        let (max_x, max_y, cell_value_width, cell_value_height) =
            Self::get_max_paste_area(insert_at, end_pos, clipboard.w, clipboard.h);

        // collect all cell values, values and sheet format updates for a a single operation
        let mut cell_values = CellValues::new(cell_value_width as u32, cell_value_height as u32);
        let mut formats = clipboard.formats.to_owned().unwrap_or_default();
        let mut borders = clipboard.borders.to_owned().unwrap_or_default();
        let source_columns = clipboard.cells.columns;

        // collect information for growing data tables
        let mut data_table_columns: HashMap<SheetPos, Vec<u32>> = HashMap::new();
        let mut data_table_rows: HashMap<SheetPos, Vec<u32>> = HashMap::new();

        // move the clipboard rect left and up by 1 to make adjacent tables intersect
        let moved_left_up_rect = Rect::from_numbers(
            insert_at.x - 1,
            insert_at.y - 1,
            clipboard.w as i64 + 1,
            clipboard.h as i64 + 1,
        );
        let existing_data_tables = self
            .a1_context_sheet_table_bounds(sheet_id)
            .into_iter()
            .filter(|rect| rect.intersects(moved_left_up_rect))
            .collect::<Vec<_>>();

        let mut growing_data_tables = existing_data_tables.clone();

        let bypass_growing =
            !Sheet::should_expand_data_table(&existing_data_tables, clipboard_rect);

        // loop through the clipboard and replace cell references in formulas
        // and other languages.  Also grow data tables if the cell value is touching
        // the right or bottom edge of the clipboard.
        for (start_x, x) in (insert_at.x..=max_x)
            .enumerate()
            .step_by(clipboard.w as usize)
        {
            for (start_y, y) in (insert_at.y..=max_y)
                .enumerate()
                .step_by(clipboard.h as usize)
            {
                let pos: Pos = Pos { x, y };
                let dx = insert_at.x - clipboard.origin.x + start_x as i64;
                let dy = insert_at.y - clipboard.origin.y + start_y as i64;
                let adjust = match clipboard.operation {
                    ClipboardOperation::Cut => RefAdjust::NO_OP,
                    ClipboardOperation::Copy => RefAdjust {
                        sheet_id: None,
                        relative_only: true,
                        dx,
                        dy,
                        x_start: 0,
                        y_start: 0,
                    },
                };

                // restore the original columns for each pass to avoid replacing the replaced code cells
                clipboard.cells.columns = source_columns.to_owned();

                if !(adjust.is_no_op() && sheet_id == clipboard.origin.sheet_id) {
                    for (cols_x, col) in clipboard.cells.columns.iter_mut().enumerate() {
                        for (cols_y, cell) in col {
                            if let CellValue::Code(code_cell) = cell {
                                let original_pos = SheetPos {
                                    x: clipboard.origin.x + cols_x as i64,
                                    y: clipboard.origin.y + *cols_y as i64,
                                    sheet_id: clipboard.origin.sheet_id,
                                };

                                code_cell.adjust_references(
                                    sheet_id,
                                    self.a1_context(),
                                    original_pos,
                                    adjust,
                                );
                            } else {
                                let new_x = x + cols_x as i64;
                                let new_y = y + *cols_y as i64;
                                let current_pos = Pos::new(new_x, new_y);
                                let within_data_table = existing_data_tables
                                    .iter()
                                    .any(|rect| rect.contains(current_pos));

                                // we're not within a data table
                                // expand the data table to the right or bottom if the
                                // cell value is touching the right or bottom edge
                                if let (false, false, Some(sheet)) =
                                    (within_data_table, bypass_growing, self.try_sheet(sheet_id))
                                {
                                    GridController::grow_data_table(
                                        sheet,
                                        &mut growing_data_tables,
                                        &mut data_table_columns,
                                        &mut data_table_rows,
                                        SheetPos::new(sheet_id, new_x, new_y),
                                        cell.to_display().is_empty(),
                                    );
                                }
                            }
                        }
                    }
                }

                let (clipboard_op, code_ops) = self.get_clipboard_ops(
                    pos,
                    Pos::new(start_x as i64, start_y as i64),
                    &mut cell_values,
                    &mut formats,
                    &mut borders,
                    selection,
                    &clipboard,
                    special,
                )?;
                clipboard_ops.extend(clipboard_op);
                compute_code_ops.extend(code_ops);
            }
        }

        // cell values need to be set before the compute_code_ops
        if matches!(special, PasteSpecial::None | PasteSpecial::Values) {
            ops.extend(clipboard_ops);

            if !cell_values.is_empty() {
                ops.push(Operation::SetCellValues {
                    sheet_pos: insert_at.to_sheet_pos(selection.sheet_id),
                    values: cell_values,
                });
            }

            ops.extend(compute_code_ops);

            data_table_ops.extend(GridController::grow_data_table_operations(
                data_table_columns,
                data_table_rows,
            ));
        }

        if !formats.is_default() {
            ops.push(Operation::SetCellFormatsA1 {
                sheet_id: selection.sheet_id,
                formats,
            });
        }

        if !borders.is_empty() {
            ops.push(Operation::SetBordersA1 {
                sheet_id: selection.sheet_id,
                borders,
            });
        }

        ops.push(Operation::SetCursorA1 {
            selection: selection.to_owned(),
        });

        Ok((ops, data_table_ops))
    }

    /// If the clipboard is larger than the selection, we need to paste multiple times.
    /// We don't want the paste to exceed the bounds of the selection (e.g. end_pos).
    fn get_max_paste_area(
        insert_at: Pos,
        end_pos: Pos,
        clipboard_width: u32,
        clipboard_height: u32,
    ) -> (i64, i64, i64, i64) {
        let max_x = {
            let width = (end_pos.x - insert_at.x + 1) as f64;
            let multiples = ((width / clipboard_width as f64).floor() as i64).max(0);
            let max_x = insert_at.x + (multiples * clipboard_width as i64) - 1;

            max_x.max(insert_at.x)
        };
        let max_y = {
            let height = (end_pos.y - insert_at.y + 1) as f64;
            let multiples = ((height / clipboard_height as f64).floor() - 1.0).max(0.0) as i64;
            let max_y = insert_at.y + (multiples * clipboard_height as i64);

            max_y.max(insert_at.y)
        };

        let cell_value_width = max_x - insert_at.x + 1;
        let cell_value_height = max_y - insert_at.y + 1;

        (max_x, max_y, cell_value_width, cell_value_height)
    }

    pub fn move_cells_operations(
        &mut self,
        source: SheetRect,
        dest: SheetPos,
        columns: bool,
        rows: bool,
    ) -> Vec<Operation> {
        vec![Operation::MoveCells {
            source,
            dest,
            columns,
            rows,
        }]
    }
}

#[cfg(test)]
mod test {
    use super::{PasteSpecial, *};
    use crate::a1::{A1Context, A1Selection, CellRefRange, ColRange, TableRef};
    use crate::controller::active_transactions::pending_transaction::PendingTransaction;
    use crate::controller::active_transactions::transaction_name::TransactionName;
    use crate::controller::user_actions::import::tests::{simple_csv, simple_csv_at};
    use crate::grid::js_types::{JsClipboard, JsSnackbarSeverity};
    use crate::grid::sheet::validations::rules::ValidationRule;
    use crate::grid::{CellWrap, CellsAccessed, CodeCellLanguage, CodeRun, SheetId};
    use crate::test_util::*;
    use crate::wasm_bindings::js::{clear_js_calls, expect_js_call};
    use crate::{Rect, Value};

    fn paste(gc: &mut GridController, sheet_id: SheetId, x: i64, y: i64, html: String) {
        gc.paste_from_clipboard(
            &A1Selection::from_xy(x, y, sheet_id),
            None,
            Some(html),
            PasteSpecial::None,
            None,
        );
    }

    fn simple_csv_selection(
        sheet_id: SheetId,
        table_ref: TableRef,
        rect: Rect,
    ) -> (A1Selection, A1Context) {
        let cell_ref_range = CellRefRange::Table { range: table_ref };
        let context = A1Context::test(
            &[("Sheet1", sheet_id)],
            &[(
                "simple.csv",
                &["city", "region", "country", "population"],
                rect,
            )],
        );
        let selection = A1Selection::from_range(cell_ref_range, sheet_id, &context);

        (selection, context)
    }

    #[test]
    fn move_cell_operations() {
        let mut gc = GridController::test();
        let sheet_id = gc.sheet_ids()[0];
        let source = (0, 0, 2, 2, sheet_id).into();
        let dest = (2, 2, sheet_id).into();
        let operations = gc.move_cells_operations(source, dest, false, false);
        assert_eq!(operations.len(), 1);
        assert_eq!(
            operations[0],
            Operation::MoveCells {
                source,
                dest,
                columns: false,
                rows: false
            }
        );
    }

    #[test]
    fn paste_clipboard_cells_columns() {
        let mut gc = GridController::test();
        let sheet_id = gc.sheet_ids()[0];
        let sheet = gc.sheet_mut(sheet_id);
        sheet.test_set_values(1, 5, 1, 5, vec!["1", "2", "3", "4", "5"]);
        let selection = A1Selection::test_a1("A");
        let sheet = gc.sheet(sheet_id);
        let JsClipboard { html, .. } = sheet
            .copy_to_clipboard(&selection, gc.a1_context(), ClipboardOperation::Copy, false)
            .unwrap();
        let selection = A1Selection::test_a1("E");
        let insert_at = selection.cursor;
        let operations = gc
            .paste_html_operations(insert_at, insert_at, &selection, html, PasteSpecial::None)
            .unwrap()
            .0;
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
        let sheet = gc.sheet(sheet_id);
        let JsClipboard { html, .. } = sheet
            .copy_to_clipboard(&selection, gc.a1_context(), ClipboardOperation::Copy, false)
            .unwrap();
        let selection = A1Selection::test_a1("5");
        let insert_at = selection.cursor;
        let operations = gc
            .paste_html_operations(insert_at, insert_at, &selection, html, PasteSpecial::None)
            .unwrap()
            .0;
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

        let a1_context = gc.a1_context().to_owned();
        gc.sheet_mut(sheet_id).recalculate_bounds(&a1_context);
        let selection = A1Selection::all(sheet_id);
        let sheet = gc.sheet(sheet_id);
        let JsClipboard { html, .. } = sheet
            .copy_to_clipboard(&selection, gc.a1_context(), ClipboardOperation::Copy, false)
            .unwrap();
        gc.add_sheet(None);

        let sheet_id = gc.sheet_ids()[1];
        let insert_at = selection.cursor;
        let operations = gc
            .paste_html_operations(
                insert_at,
                insert_at,
                &A1Selection::all(sheet_id),
                html,
                PasteSpecial::None,
            )
            .unwrap()
            .0;
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
            .copy_to_clipboard(&selection, gc.a1_context(), ClipboardOperation::Copy, false)
            .unwrap();

        gc.paste_from_clipboard(
            &A1Selection::from_xy(3, 3, sheet_id),
            None,
            Some(html),
            PasteSpecial::None,
            None,
        );

        let sheet = gc.sheet(sheet_id);
        assert_eq!(sheet.formats.italic.get(pos![C3]), None);
        assert_eq!(sheet.formats.italic.get(pos![C4]), None);
        assert_eq!(sheet.formats.italic.get(pos![C5]), Some(true));
        assert_eq!(sheet.formats.italic.get(pos![C6]), Some(true));

        assert_eq!(sheet.formats.italic.get(pos![A3]), Some(true));
        assert_eq!(sheet.formats.bold.get(pos![A3]), Some(true));
        assert_eq!(sheet.formats.italic.get(pos![B3]), Some(true));
        assert_eq!(sheet.formats.bold.get(pos![B3]), Some(true));
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
            &Some(validations),
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
            None,
        );

        assert_eq!(
            gc.sheet(sheet_id).get_code_cell_value((1, 4).into()),
            Some(CellValue::Number(6.into()))
        );

        let selection = A1Selection::test_a1("A1:B5");
        let JsClipboard { html, .. } = gc
            .sheet(sheet_id)
            .copy_to_clipboard(&selection, gc.a1_context(), ClipboardOperation::Copy, false)
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
            Some(CellValue::Number(6.into()))
        );
    }

    #[test]
    fn paste_clipboard_with_formula_across_sheets() {
        let mut gc = GridController::new();
        gc.add_sheet(None);
        let sheet1 = gc.sheet_ids()[0];
        let sheet2 = gc.sheet_ids()[1];

        gc.set_cell_value(pos![sheet1!B1], "1".into(), None);
        gc.set_cell_value(pos![sheet1!B2], "2".into(), None);
        gc.set_cell_value(pos![sheet1!B3], "3".into(), None);
        gc.set_cell_value(pos![sheet1!B4], "4".into(), None);
        gc.set_cell_value(pos![sheet1!B5], "5".into(), None);
        gc.set_cell_value(pos![sheet1!B6], "6".into(), None);
        gc.set_cell_value(pos![sheet1!C4], "100".into(), None);

        gc.set_cell_value(pos![sheet2!B2], "50".into(), None);
        gc.set_cell_value(pos![sheet2!C4], "1000".into(), None);

        let s1 = gc.sheet(sheet1).name.clone();
        let s2 = gc.sheet(sheet2).name.clone();
        assert_ne!(s1, s2);

        gc.set_code_cell(
            pos![sheet1!A4],
            CodeCellLanguage::Formula,
            format!("SUM(B1:B3, B4:B6, '{s1}'!C4, '{s2}'!C4)"),
            None,
            None,
        );

        print_sheet(gc.sheet(sheet1));

        let get_code_cell_value_str = |gc: &GridController, sheet_pos: SheetPos| {
            gc.sheet(sheet_pos.sheet_id)
                .get_code_cell_value(sheet_pos.into())
                .unwrap()
                .to_string()
        };
        let get_code_cell_source_str = |gc: &GridController, sheet_pos: SheetPos| {
            gc.sheet(sheet_pos.sheet_id)
                .cell_value(sheet_pos.into())
                .unwrap()
                .code_cell_value()
                .unwrap()
                .code
        };

        assert_eq!("1121", get_code_cell_value_str(&gc, pos![sheet1!A4]));

        let a4_sel = A1Selection::from_single_cell(pos![sheet1!A4]);
        let a3_sel = A1Selection::from_single_cell(pos![sheet1!A3]);

        // copy within sheet
        let JsClipboard { html, .. } = gc
            .sheet(sheet1)
            .copy_to_clipboard(&a4_sel, gc.a1_context(), ClipboardOperation::Copy, false)
            .unwrap();
        gc.paste_from_clipboard(&a3_sel, None, Some(html), PasteSpecial::None, None);
        // all references should have updated
        assert_eq!(
            format!("SUM(#REF!, B3:B5, '{s1}'!C3, '{s2}'!C3)"),
            get_code_cell_source_str(&gc, pos![sheet1!A3]),
        );
        // code cell should have been re-evaluated
        assert_eq!(
            "Bad cell reference",
            get_code_cell_value_str(&gc, pos![sheet1!A3])
        );

        // cut within sheet
        let JsClipboard { html, .. } = gc
            .sheet(sheet1)
            .copy_to_clipboard(&a4_sel, gc.a1_context(), ClipboardOperation::Cut, false)
            .unwrap();
        gc.paste_from_clipboard(&a3_sel, None, Some(html), PasteSpecial::None, None);
        // all references should have stayed the same
        assert_eq!(
            format!("SUM(B1:B3, B4:B6, '{s1}'!C4, '{s2}'!C4)"),
            get_code_cell_source_str(&gc, pos![sheet1!A3]),
        );
        // code cell should have the same value
        assert_eq!("1121", get_code_cell_value_str(&gc, pos![sheet1!A3]));

        // copy to other sheet
        let JsClipboard { html, .. } = gc
            .sheet(sheet1)
            .copy_to_clipboard(&a3_sel, gc.a1_context(), ClipboardOperation::Copy, false)
            .unwrap();
        gc.paste_from_clipboard(
            &A1Selection::from_single_cell(pos![sheet2!A4]),
            None,
            Some(html),
            PasteSpecial::None,
            None,
        );
        // all references should have updated
        assert_eq!(
            format!("SUM(B2:B4, B5:B7, '{s1}'!C5, '{s2}'!C5)"),
            get_code_cell_source_str(&gc, pos![sheet2!A4]),
        );
        // code cell should have been re-evaluated
        assert_eq!("50", get_code_cell_value_str(&gc, pos![sheet2!A4]));

        // cut to other sheet
        let JsClipboard { html, .. } = gc
            .sheet(sheet1)
            .copy_to_clipboard(&a3_sel, gc.a1_context(), ClipboardOperation::Cut, false)
            .unwrap();
        gc.paste_from_clipboard(
            &A1Selection::from_single_cell(pos![sheet2!A4]),
            None,
            Some(html),
            PasteSpecial::None,
            None,
        );
        // all references should have updated to have a sheet name
        assert_eq!(
            format!("SUM('{s1}'!B1:B3, '{s1}'!B4:B6, '{s1}'!C4, '{s2}'!C4)"),
            get_code_cell_source_str(&gc, pos![sheet2!A4]),
        );
        // code cell should have the same value
        assert_eq!("1121", get_code_cell_value_str(&gc, pos![sheet2!A4]));
    }

    #[test]
    fn copy_paste_clipboard_with_data_table() {
        clear_js_calls();

        let (mut gc, sheet_id, _, _) = simple_csv();
        let paste = |gc: &mut GridController, x, y, html| {
            let selection = A1Selection::from_xy(x, y, sheet_id);
            gc.paste_from_clipboard(&selection, None, Some(html), PasteSpecial::None, None);
        };

        let table_ref = TableRef::new("simple.csv");
        let (selection, context) =
            simple_csv_selection(sheet_id, table_ref, Rect::test_a1("A1:D11"));

        let JsClipboard { html, .. } = gc
            .sheet(sheet_id)
            .copy_to_clipboard(&selection, &context, ClipboardOperation::Copy, false)
            .unwrap();

        let expected_row1 = vec!["city", "region", "country", "population"];

        // paste side by side
        paste(&mut gc, 10, 1, html.clone());
        print_table_in_rect(&gc, sheet_id, Rect::from_numbers(10, 1, 4, 11));
        assert_cell_value_row(&gc, sheet_id, 10, 13, 2, expected_row1);

        let cursor = A1Selection::from_rect(SheetRect::from_numbers(10, 1, 1, 1, sheet_id));
        expect_js_call("jsSetCursor", serde_json::to_string(&cursor).unwrap(), true);
    }

    #[test]
    fn cut_paste_clipboard_with_data_table() {
        let (mut gc, sheet_id, _, _) = simple_csv();
        let table_ref = TableRef::new("simple.csv");
        let (selection, _) = simple_csv_selection(sheet_id, table_ref, Rect::test_a1("A1:BV11"));

        let (ops, js_clipboard) = gc.cut_to_clipboard_operations(&selection, false).unwrap();
        gc.start_user_transaction(ops, None, TransactionName::CutClipboard);

        let expected_row1 = vec!["city", "region", "country", "population"];

        // paste side by side
        paste(&mut gc, sheet_id, 10, 1, js_clipboard.html.clone());
        print_table_in_rect(&gc, sheet_id, Rect::from_numbers(10, 1, 4, 11));
        assert_cell_value_row(&gc, sheet_id, 10, 13, 2, expected_row1);
    }

    #[test]
    fn copy_paste_clipboard_first_column_of_data_table() {
        clear_js_calls();

        let (mut gc, sheet_id, _, _) = simple_csv();

        let table_ref = TableRef {
            table_name: "simple.csv".to_string(),
            data: true,
            headers: false,
            totals: false,
            col_range: ColRange::Col("city".to_string()),
        };
        let (selection, context) =
            simple_csv_selection(sheet_id, table_ref, Rect::test_a1("A1:D11"));

        let JsClipboard { html, .. } = gc
            .sheet(sheet_id)
            .copy_to_clipboard(&selection, &context, ClipboardOperation::Copy, false)
            .unwrap();

        let expected_header_row = vec!["city", "", "", ""];
        let expected_first_data = vec!["Southborough", "", "", ""];

        // paste side by side
        paste(&mut gc, sheet_id, 10, 1, html.clone());
        print_table_in_rect(&gc, sheet_id, Rect::from_numbers(10, 1, 4, 11));
        assert_cell_value_row(&gc, sheet_id, 10, 13, 1, expected_header_row);
        assert_cell_value_row(&gc, sheet_id, 10, 13, 2, expected_first_data);

        // let cursor = A1Selection::table(pos![J2].to_sheet_pos(sheet_id), "simple.csv1");
        // expect_js_call("jsSetCursor", serde_json::to_string(&cursor).unwrap(), true);
    }

    #[test]
    fn copy_paste_clipboard_first_2_columns_of_data_table() {
        clear_js_calls();

        let (mut gc, sheet_id, _, _) = simple_csv();

        let table_ref = TableRef {
            table_name: "simple.csv".to_string(),
            data: true,
            headers: false,
            totals: false,
            col_range: ColRange::ColRange("city".to_string(), "region".to_string()),
        };
        let (selection, context) =
            simple_csv_selection(sheet_id, table_ref, Rect::test_a1("A1:D11"));

        let JsClipboard { html, .. } = gc
            .sheet(sheet_id)
            .copy_to_clipboard(&selection, &context, ClipboardOperation::Copy, false)
            .unwrap();

        let expected_header_row = vec!["city", "region", "", ""];
        let expected_first_data = vec!["Southborough", "MA", "", ""];

        // paste side by side
        paste(&mut gc, sheet_id, 10, 1, html.clone());
        print_table_in_rect(&gc, sheet_id, Rect::from_numbers(10, 1, 4, 11));
        assert_cell_value_row(&gc, sheet_id, 10, 13, 1, expected_header_row);
        assert_cell_value_row(&gc, sheet_id, 10, 13, 2, expected_first_data);

        // let cursor = A1Selection::table(pos![J2].to_sheet_pos(sheet_id), "simple.csv1");
        // expect_js_call("jsSetCursor", serde_json::to_string(&cursor).unwrap(), true);
    }

    #[test]
    fn copy_paste_clipboard_last_2_columns_of_data_table() {
        clear_js_calls();

        let (mut gc, sheet_id, _, _) = simple_csv();

        let table_ref = TableRef {
            table_name: "simple.csv".to_string(),
            data: true,
            headers: false,
            totals: false,
            col_range: ColRange::ColRange("country".to_string(), "population".to_string()),
        };
        let (selection, context) =
            simple_csv_selection(sheet_id, table_ref, Rect::test_a1("A1:D11"));

        let JsClipboard { html, .. } = gc
            .sheet(sheet_id)
            .copy_to_clipboard(&selection, &context, ClipboardOperation::Copy, false)
            .unwrap();

        let expected_header_row = vec!["country", "population", "", ""];
        let expected_first_data = vec!["United States", "9686", "", ""];

        // paste side by side
        paste(&mut gc, sheet_id, 10, 1, html.clone());
        print_table_in_rect(&gc, sheet_id, Rect::from_numbers(10, 1, 4, 11));
        assert_cell_value_row(&gc, sheet_id, 10, 13, 1, expected_header_row);
        assert_cell_value_row(&gc, sheet_id, 10, 13, 2, expected_first_data);

        // let cursor = A1Selection::table(pos![J2].to_sheet_pos(sheet_id), "simple.csv1");
        // expect_js_call("jsSetCursor", serde_json::to_string(&cursor).unwrap(), true);
    }

    // TODO(ddimaria): implement once we decide to take on the work
    // we currently copy a single rectangle, so copying two non-touching columns captures the gap
    // #[test]
    // fn copy_paste_clipboard_2_non_touching_columns_of_data_table() {
    //     clear_js_calls();

    //     let (mut gc, sheet_id, _, _) = simple_csv();

    //     let context = A1Context::test(
    //         &[("Sheet1", sheet_id)],
    //         &[(
    //             "simple.csv",
    //             &["city", "region", "country", "population"],
    //             Rect::test_a1("A1:D11"),
    //         )],
    //     );

    //     let mut range = TableRef {
    //         table_name: "simple.csv".to_string(),
    //         data: true,
    //         headers: false,
    //         totals: false,
    //         col_range: ColRange::Col("city".to_string()),
    //     };
    //     let cell_ref_range_1 = CellRefRange::Table {
    //         range: range.clone(),
    //     };
    //     range.col_range = ColRange::Col("country".to_string());
    //     let cell_ref_range_2 = CellRefRange::Table { range };

    //     let selection =
    //         A1Selection::from_ranges(vec![cell_ref_range_1, cell_ref_range_2], sheet_id, &context)
    //             .unwrap();
    //     let JsClipboard { html, .. } = gc
    //         .sheet(sheet_id)
    //         .copy_to_clipboard(&selection, &context, ClipboardOperation::Copy, false)
    //         .unwrap();

    //     let expected_header_row = vec!["city", "country"];
    //     let expected_first_data = vec!["Southborough", "United States"];

    //     // paste side by side
    //     paste(&mut gc, sheet_id, 10, 1, html.clone());
    //     print_table(&gc, sheet_id, Rect::from_numbers(10, 1, 4, 11));
    //     assert_cell_value_row(&gc, sheet_id, 10, 13, 1, expected_header_row);
    //     assert_cell_value_row(&gc, sheet_id, 10, 13, 2, expected_first_data);

    //     // let cursor = A1Selection::table(pos![J2].to_sheet_pos(sheet_id), "simple.csv1");
    //     // expect_js_call("jsSetCursor", serde_json::to_string(&cursor).unwrap(), true);
    // }

    #[test]
    fn update_code_cell_references_python() {
        let mut gc = GridController::test();
        let sheet_id = gc.sheet_ids()[0];

        gc.set_code_cell(
            pos![C3].to_sheet_pos(sheet_id),
            CodeCellLanguage::Python,
            r#"q.cells("A1:B2", first_row_header=True)"#.to_string(),
            None,
            None,
        );

        let selection = A1Selection::test_a1("A1:E5");
        let JsClipboard { html, .. } = gc
            .sheet(sheet_id)
            .copy_to_clipboard(&selection, gc.a1_context(), ClipboardOperation::Copy, false)
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
        let sheet = gc.sheet(sheet_id);
        let JsClipboard { html, .. } = sheet
            .copy_to_clipboard(
                &A1Selection::from_rect(rect),
                gc.a1_context(),
                ClipboardOperation::Copy,
                false,
            )
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
        print_table_in_rect(&gc, sheet_id, Rect::from_numbers(0, 0, 8, 11));
        assert_cell_value_row(&gc, sheet_id, 4, 5, 2, expected_row1.clone());
        assert_cell_value_row(&gc, sheet_id, 4, 5, 3, expected_row2.clone());
        gc.undo(None);

        // paste overlap with right grid
        paste(&mut gc, 5, 2, html.clone());
        print_table_in_rect(&gc, sheet_id, Rect::from_numbers(0, 0, 8, 11));
        assert_cell_value_row(&gc, sheet_id, 5, 6, 2, expected_row1.clone());
        assert_cell_value_row(&gc, sheet_id, 5, 6, 3, expected_row2.clone());
        gc.undo(None);

        // paste overlap with bottom grid
        paste(&mut gc, 4, 10, html.clone());
        print_table_in_rect(&gc, sheet_id, Rect::from_numbers(0, 0, 8, 12));
        assert_cell_value_row(&gc, sheet_id, 4, 5, 10, expected_row1.clone());
        assert_cell_value_row(&gc, sheet_id, 4, 5, 11, expected_row2.clone());
        gc.undo(None);

        // paste overlap with bottom left grid
        paste(&mut gc, 1, 10, html.clone());
        print_table_in_rect(&gc, sheet_id, Rect::from_numbers(0, 0, 8, 12));
        // print_table(&gc, sheet_id, Rect::from_numbers(1, 10, 2, 2));
        assert_cell_value_row(&gc, sheet_id, 1, 2, 10, expected_row1.clone());
        assert_cell_value_row(&gc, sheet_id, 1, 2, 11, expected_row2.clone());
        gc.undo(None);

        // paste overlap with top left grid
        paste(&mut gc, 3, 0, html.clone());
        print_table_in_rect(&gc, sheet_id, Rect::from_numbers(2, 0, 4, 4));
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
            None,
        );

        let selection = A1Selection::test_a1("A1:E5");
        let JsClipboard { html, .. } = gc
            .sheet(sheet_id)
            .copy_to_clipboard(&selection, gc.a1_context(), ClipboardOperation::Copy, false)
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
            None,
        );

        let sheet = gc.sheet(sheet_id);
        let rect = SheetRect::single_pos(pos![J1], sheet_id);
        let JsClipboard { html, .. } = sheet
            .copy_to_clipboard(
                &A1Selection::from_rect(rect),
                gc.a1_context(),
                ClipboardOperation::Copy,
                false,
            )
            .unwrap();
        let selection = A1Selection::test_a1_sheet_id("B2", sheet_id);
        let insert_at = selection.cursor;

        assert!(
            gc.paste_html_operations(insert_at, insert_at, &selection, html, PasteSpecial::None)
                .is_err()
        );

        expect_js_call(
            "jsClientMessage",
            format!(
                "Cannot place code within a table,{}",
                JsSnackbarSeverity::Error
            ),
            true,
        );

        assert_display_cell_value(&gc, sheet_id, 2, 3, "MA");
    }

    #[test]
    fn paste_plain_html_inside_data_table() {
        let (mut gc, sheet_id, pos, _) = simple_csv_at(pos![E2]);

        gc.set_cell_value(pos![B2].to_sheet_pos(sheet_id), "1".to_string(), None);
        gc.set_cell_value(pos![C2].to_sheet_pos(sheet_id), "123,456".to_string(), None);
        gc.set_cell_value(pos![B3].to_sheet_pos(sheet_id), "654,321".to_string(), None);
        gc.set_cell_value(pos![C3].to_sheet_pos(sheet_id), "4".to_string(), None);

        // hide the second column
        let data_table = gc.sheet(sheet_id).data_table_at(&pos).unwrap();
        let mut column_headers = data_table.column_headers.to_owned().unwrap();
        column_headers[1].display = false;
        gc.test_data_table_update_meta(
            pos.to_sheet_pos(sheet_id),
            Some(column_headers),
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
                &A1Selection::test_a1_sheet_id("B2:C3", sheet_id),
                gc.a1_context(),
                ClipboardOperation::Copy,
                false,
            )
            .unwrap();

        gc.paste_from_clipboard(
            &A1Selection::test_a1_sheet_id("E13", sheet_id),
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
                wrap: Some(CellWrap::Clip),
                numeric_commas: Some(true),
                ..Default::default()
            }
        );

        // show the second column
        let data_table = gc.sheet(sheet_id).data_table_at(&pos).unwrap();
        let mut column_headers = data_table.column_headers.to_owned().unwrap();
        column_headers[1].display = true;
        gc.test_data_table_update_meta(
            pos.to_sheet_pos(sheet_id),
            Some(column_headers),
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
        // assert_eq!(
        //     sheet.display_value(pos![F14]).unwrap(),
        //     CellValue::Number(4.into())
        // );
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
                wrap: Some(CellWrap::Clip),
                numeric_commas: Some(true),
                ..Default::default()
            }
        );
    }

    #[test]
    fn paste_plain_text_inside_data_table() {
        let (mut gc, sheet_id, pos, _) = simple_csv_at(pos![E2]);

        gc.set_cell_value(pos![B2].to_sheet_pos(sheet_id), "1".to_string(), None);
        gc.set_cell_value(pos![C2].to_sheet_pos(sheet_id), "123,456".to_string(), None);
        gc.set_cell_value(pos![B3].to_sheet_pos(sheet_id), "654,321".to_string(), None);
        gc.set_cell_value(pos![C3].to_sheet_pos(sheet_id), "4".to_string(), None);

        // hide the second column
        let data_table = gc.sheet(sheet_id).data_table_at(&pos).unwrap();
        let mut column_headers = data_table.column_headers.to_owned().unwrap();
        column_headers[1].display = false;
        gc.test_data_table_update_meta(
            pos.to_sheet_pos(sheet_id),
            Some(column_headers),
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
                &A1Selection::test_a1_sheet_id("B2:C3", sheet_id),
                gc.a1_context(),
                ClipboardOperation::Copy,
                true,
            )
            .unwrap();

        gc.paste_from_clipboard(
            &A1Selection::test_a1_sheet_id("E13", sheet_id),
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
        let data_table = gc.sheet(sheet_id).data_table_at(&pos).unwrap();
        let mut column_headers = data_table.column_headers.to_owned().unwrap();
        column_headers[1].display = true;
        gc.test_data_table_update_meta(
            pos.to_sheet_pos(sheet_id),
            Some(column_headers),
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

    #[test]
    fn test_paste_chart_over_chart() {
        let mut gc = test_create_gc();
        let sheet_id = first_sheet_id(&gc);

        let dt = test_create_html_chart(&mut gc, sheet_id, pos![A1], 5, 5);
        let mut selection = A1Selection::table(pos![sheet_id!A1], dt.name());
        selection.cursor = pos![A1];
        let sheet = gc.sheet(sheet_id);
        let clipboard = sheet
            .copy_to_clipboard(&selection, gc.a1_context(), ClipboardOperation::Copy, true)
            .unwrap();

        gc.paste_from_clipboard(
            &selection,
            None,
            Some(clipboard.html),
            PasteSpecial::None,
            None,
        );

        // ensures we're pasting over the chart (there was a bug where it would
        // paste under the chart and cause a spill)
        assert_table_count(&gc, sheet_id, 1);
    }

    #[test]
    fn test_paste_clipboard_next_to_data_table() {
        let mut gc = test_create_gc();
        let sheet_id = first_sheet_id(&gc);

        test_create_data_table(&mut gc, sheet_id, pos![A1], 3, 3);
        let data_table = gc.sheet(sheet_id).data_table_at(&pos![A1]).unwrap();
        print_sheet(gc.sheet(sheet_id));
        assert_eq!(data_table.width(), 3);
        assert_eq!(data_table.height(false), 5);

        let rect = SheetRect::single_pos(pos![A3], sheet_id);
        let JsClipboard { html, .. } = gc
            .sheet(sheet_id)
            .copy_to_clipboard(
                &A1Selection::from_rect(rect),
                gc.a1_context(),
                ClipboardOperation::Copy,
                false,
            )
            .unwrap();

        // paste cell to the right of the data table
        paste(&mut gc, sheet_id, 4, 3, html.clone());
        let data_table = gc.sheet(sheet_id).data_table_at(&pos![A1]).unwrap();
        print_sheet(gc.sheet(sheet_id));
        assert_eq!(data_table.width(), 4);

        // paste cell to the bottom of the data table
        paste(&mut gc, sheet_id, 1, 6, html.clone());
        let data_table = gc.sheet(sheet_id).data_table_at(&pos![A1]).unwrap();
        print_sheet(gc.sheet(sheet_id));
        assert_eq!(data_table.height(false), 6);
    }

    #[test]
    fn test_paste_special() {
        let mut gc = GridController::test();
        let sheet_id = gc.sheet_ids()[0];

        gc.set_cell_values(
            SheetPos {
                x: 2,
                y: 1,
                sheet_id,
            },
            vec![vec!["1".into(), "2".into(), "3".into()]],
            None,
        );

        gc.set_bold(
            &A1Selection::from_single_cell(pos![sheet_id!B1]),
            Some(true),
            None,
        )
        .unwrap();

        assert_cell_value_row(&gc, sheet_id, 2, 4, 1, vec!["1", "2", "3"]);
        assert_cell_format_bold_row(&gc, sheet_id, 2, 4, 1, vec![true, false, false]);

        let clipboard = gc
            .sheet(sheet_id)
            .copy_to_clipboard(
                &A1Selection::from_rect(rect![B1:D1].to_sheet_rect(sheet_id)),
                gc.a1_context(),
                ClipboardOperation::Copy,
                true,
            )
            .unwrap();

        // paste values only
        gc.paste_from_clipboard(
            &A1Selection::from_single_cell(pos![sheet_id!B2]),
            Some(clipboard.plain_text.clone()),
            Some(clipboard.html.clone()),
            PasteSpecial::Values,
            None,
        );
        // values are pasted
        assert_cell_value_row(&gc, sheet_id, 2, 4, 2, vec!["1", "2", "3"]);
        // formats are not pasted
        assert_cell_format_bold_row(&gc, sheet_id, 2, 4, 2, vec![false, false, false]);

        // paste formats only, offset by 1 column to check for values getting overwritten
        gc.paste_from_clipboard(
            &A1Selection::from_single_cell(pos![sheet_id!C2]),
            Some(clipboard.plain_text),
            Some(clipboard.html),
            PasteSpecial::Formats,
            None,
        );
        // values should be the same
        assert_cell_value_row(&gc, sheet_id, 2, 4, 2, vec!["1", "2", "3"]);
        // formats should be pasted, offset by 1 column
        assert_cell_format_bold_row(&gc, sheet_id, 2, 5, 2, vec![false, true, false, false]);
    }

    #[test]
    fn test_clipboard_code_operations_should_rerun() {
        let mut gc = GridController::test();
        let sheet_id = gc.sheet_ids()[0];
        let pos_1_1 = SheetPos::new(sheet_id, 1, 1);
        let pos_1_2 = SheetPos::new(sheet_id, 1, 2);
        let sheet_rect = SheetRect::from_numbers(1, 1, 1, 1, sheet_id);

        gc.set_cell_value(pos_1_1, "1".to_string(), None);

        let mut transaction = PendingTransaction::default();
        let mut cells_accessed = CellsAccessed::default();
        cells_accessed.add_sheet_rect(sheet_rect);
        let code_run = CodeRun {
            language: CodeCellLanguage::Formula,
            code: "A1 + 5".into(),
            std_err: None,
            std_out: None,
            error: None,
            return_type: Some("number".into()),
            line_number: None,
            output_type: None,
            cells_accessed: cells_accessed.clone(),
        };
        gc.finalize_data_table(
            &mut transaction,
            pos_1_2,
            Some(DataTable::new(
                DataTableKind::CodeRun(code_run),
                "Table 1",
                Value::Single(CellValue::Number(6.into())),
                false,
                Some(false),
                Some(false),
                None,
            )),
            None,
        );

        // copying A1:A2 and pasting on B1 should rerun the code
        let selection_rect = SheetRect::from_numbers(1, 1, 1, 2, sheet_id);
        let selection = A1Selection::from_rect(selection_rect);
        let (_, js_clipboard) = gc.cut_to_clipboard_operations(&selection, false).unwrap();
        let clipboard = Clipboard::decode(&js_clipboard.html).unwrap();
        let should_rerun = gc.clipboard_code_operations_should_rerun(
            &clipboard,
            pos![A2],
            pos![B1].to_sheet_pos(sheet_id),
        );
        assert!(should_rerun);

        // copying A2 and pasting on B1 should not rerun the code
        let selection_rect = SheetRect::from_numbers(1, 2, 1, 1, sheet_id);
        let selection = A1Selection::from_rect(selection_rect);
        let (_, js_clipboard) = gc.cut_to_clipboard_operations(&selection, false).unwrap();
        let clipboard = Clipboard::decode(&js_clipboard.html).unwrap();
        let should_rerun = gc.clipboard_code_operations_should_rerun(
            &clipboard,
            pos![A2],
            pos![B1].to_sheet_pos(sheet_id),
        );
        assert!(!should_rerun);

        // unbounded cut should rerun the code
        let selection = A1Selection::from_range(
            CellRefRange::new_relative_column(1),
            SheetId::TEST,
            gc.a1_context(),
        );
        let (_, js_clipboard) = gc.cut_to_clipboard_operations(&selection, false).unwrap();
        let clipboard = Clipboard::decode(&js_clipboard.html).unwrap();
        let should_rerun = gc.clipboard_code_operations_should_rerun(
            &clipboard,
            pos![A2],
            pos![B1].to_sheet_pos(sheet_id),
        );
        assert!(should_rerun);
    }

    #[test]
    fn test_copy_paste_table_column() {
        let (mut gc, sheet_id, pos, file_name) = simple_csv_at(pos![E2]);

        let data_table = gc.sheet(sheet_id).data_table_at(&pos).unwrap();

        assert_data_table_column(
            data_table,
            1,
            vec![
                "region", "MA", "MA", "MA", "MA", "MA", "MO", "NJ", "OH", "OR", "NH",
            ],
        );

        assert_data_table_column(
            data_table,
            3,
            vec![
                "population",
                "9686",
                "14061",
                "29313",
                "38334",
                "152227",
                "150443",
                "14976",
                "64325",
                "56032",
                "42605",
            ],
        );

        let JsClipboard { html, plain_text } = gc
            .sheet(sheet_id)
            .copy_to_clipboard(
                &A1Selection::test_a1_context(&format!("{file_name}[region]"), gc.a1_context()),
                gc.a1_context(),
                ClipboardOperation::Copy,
                false,
            )
            .unwrap();

        gc.paste_from_clipboard(
            &A1Selection::test_a1_context(&format!("{file_name}[population]"), gc.a1_context()),
            Some(plain_text),
            Some(html),
            PasteSpecial::None,
            None,
        );

        let data_table = gc.sheet(sheet_id).data_table_at(&pos).unwrap();

        assert_data_table_column(
            data_table,
            1,
            vec![
                "region", "MA", "MA", "MA", "MA", "MA", "MO", "NJ", "OH", "OR", "NH",
            ],
        );

        assert_data_table_column(
            data_table,
            3,
            vec![
                "region2", "MA", "MA", "MA", "MA", "MA", "MO", "NJ", "OH", "OR", "NH",
            ],
        );
    }
}
