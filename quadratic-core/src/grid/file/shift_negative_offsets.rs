//! This module contains the function that shifts all offsets <= 0 to 1. This
//! happens during the transition from v1.7 to v1.7.1. There are no other
//! changes in v1.7.1. Note, we do not use the normal transaction process for
//! this change. quadratic-files will automatically upgrade using this function
//! before applying any received changes.

use std::collections::HashMap;

use crate::{
    CopyFormats, Pos, RefAdjust,
    a1::A1Context,
    grid::{
        Grid, GridBounds, Sheet, js_types::JsSnackbarSeverity, sheet::validations::Validations,
    },
};

const IMPORT_OFFSET: i64 = 1000000;
pub const IMPORT_OFFSET_START_FOR_INFINITE: i64 = 1 - IMPORT_OFFSET;

pub fn add_import_offset_to_contiguous_2d_rect(
    x1: i64,
    y1: i64,
    x2: Option<i64>,
    y2: Option<i64>,
) -> (i64, i64, Option<i64>, Option<i64>) {
    let x1 = x1.saturating_add(IMPORT_OFFSET).max(1);
    let y1 = y1.saturating_add(IMPORT_OFFSET).max(1);
    let x2 = x2.map(|x| x.saturating_add(IMPORT_OFFSET).max(1));
    let y2 = y2.map(|y| y.saturating_add(IMPORT_OFFSET).max(1));
    (x1, y1, x2, y2)
}

/// Shifts all negative offsets in the grid and signals client.
pub fn shift_negative_offsets(grid: &mut Grid) -> HashMap<String, (i64, i64)> {
    // This is a dummy transaction because it happens before the initial
    // render of the grid file, so there's no info to share with the
    // client. Also, we do not send any information to multiplayer, as
    // quadratic-files will automatically upgrade using this function
    // before applying any changes.

    let mut changed = false;
    let mut shifted_offsets_sheet_name = HashMap::new(); // for migrating cells to q.cells
    let mut shifted_offsets_sheet_id = HashMap::new(); // for translating code runs's cells_accessed
    let a1_context = grid.make_a1_context();
    for sheet in grid.sheets.iter_mut() {
        sheet.migration_recalculate_bounds(&a1_context);
        sheet.columns.migration_regenerate_has_cell_value();

        let mut x_shift = 0;
        let mut y_shift = 0;

        if let GridBounds::NonEmpty(bounds) = sheet.bounds(false) {
            // shift columns
            if bounds.min.x <= 0 {
                changed = true;
                let insert = bounds.min.x - 1;
                for _ in bounds.min.x..=0 {
                    sheet.migration_insert_column(insert, CopyFormats::None, &a1_context);
                    x_shift += 1;
                }
            }

            // shift rows
            if bounds.min.y <= 0 {
                changed = true;
                let insert = bounds.min.y - 1;
                for _ in bounds.min.y..=0 {
                    sheet.migration_insert_row(insert, CopyFormats::None, &a1_context);
                    y_shift += 1;
                }
            }
        }

        // record the shift
        shifted_offsets_sheet_name.insert(sheet.name.clone(), (x_shift, y_shift));
        shifted_offsets_sheet_id.insert(sheet.id, (x_shift, y_shift));
    }

    // translate code runs's cells_accessed
    for sheet in grid.sheets.iter_mut() {
        for (_, code_run) in sheet.data_tables.migration_iter_code_runs_mut() {
            let cells = &mut code_run.cells_accessed.cells;
            for (sheet_id, ranges) in cells {
                // Get shift values for the referenced sheet, skip if not found
                let Some(&(x_shift, y_shift)) = shifted_offsets_sheet_id.get(sheet_id) else {
                    continue;
                };

                // Skip translation if no shift is needed
                if x_shift == 0 && y_shift == 0 {
                    continue;
                }

                // Translate all ranges and collect into new HashSet
                *ranges = std::mem::take(ranges)
                    .into_iter()
                    .filter_map(|r| {
                        r.adjust(RefAdjust::new_translate_with_start(
                            x_shift,
                            y_shift,
                            i64::MIN,
                            i64::MIN,
                        ))
                        .ok()
                    })
                    .collect();
            }
        }
    }

    // remove the import offset from the formats and borders
    for sheet in grid.sheets.iter_mut() {
        sheet
            .formats
            .translate_in_place(-IMPORT_OFFSET, -IMPORT_OFFSET);
        sheet
            .borders
            .translate_in_place(-IMPORT_OFFSET, -IMPORT_OFFSET);
        sheet.migration_recalculate_bounds(&a1_context);
    }

    if changed && (cfg!(target_family = "wasm") || cfg!(test)) {
        crate::wasm_bindings::js::jsClientMessage(
            "negative_offsets".to_string(),
            JsSnackbarSeverity::Success.to_string(),
        );
    }

    shifted_offsets_sheet_name
}

impl Sheet {
    /// Column
    ///
    ////////////
    fn migration_insert_column(
        &mut self,
        column: i64,
        copy_formats: CopyFormats,
        a1_context: &A1Context,
    ) {
        self.migration_check_insert_tables_columns(column, copy_formats);
        self.columns.insert_column(column);
        self.migration_adjust_insert_tables_columns(column, copy_formats);
        self.formats.insert_column(column, copy_formats);
        self.borders.insert_column(column, copy_formats);
        self.validations.migration_insert_column(column, a1_context);
        self.offsets.insert_column(column, copy_formats);
        self.migration_recalculate_bounds(a1_context);
        self.columns.migration_regenerate_has_cell_value();
    }
    fn migration_check_insert_tables_columns(&mut self, column: i64, copy_formats: CopyFormats) {
        let source_column = match copy_formats {
            CopyFormats::After => column - 1,
            _ => column,
        };
        for (pos, dt) in self.data_tables.migration_iter_mut() {
            let output_rect = dt.output_rect(*pos, false);
            // if html or image, then we need to change the width
            if dt.is_html_or_image() {
                if let Some((width, height)) = dt.chart_output {
                    if source_column >= pos.x && source_column < pos.x + output_rect.width() as i64
                    {
                        dt.chart_output = Some((width + 1, height));
                    }
                }
            } else {
                // Adds columns to data tables if the column is inserted inside the
                // table. Code is not impacted by this change.
                if !dt.is_code()
                    && source_column >= pos.x
                    && (column < pos.x + output_rect.width() as i64
                        || (CopyFormats::Before == copy_formats
                            && column < pos.x + output_rect.width() as i64 + 1))
                {
                    if let Ok(display_column_index) = u32::try_from(column - pos.x) {
                        let column_index =
                            dt.get_column_index_from_display_index(display_column_index, true);
                        let _ = dt.insert_column_sorted(column_index as usize, None, None);
                    }
                }
            }
        }
    }
    fn migration_adjust_insert_tables_columns(&mut self, column: i64, copy_formats: CopyFormats) {
        let mut data_tables_to_move_right = Vec::new();
        let mut data_tables_to_move_back = Vec::new();

        for (pos, dt) in self.data_tables.expensive_iter() {
            // Catch all cases where the dt needs to be pushed to the right b/c of an insert.
            if (copy_formats == CopyFormats::Before && pos.x > column)
                || (copy_formats == CopyFormats::Before && pos.x == column && dt.is_code())
                || (copy_formats != CopyFormats::Before && pos.x >= column)
            {
                data_tables_to_move_right.push(*pos);
            }
            if (!dt.is_code() || dt.is_html_or_image())
                && copy_formats == CopyFormats::Before
                && pos.x == column
            {
                data_tables_to_move_back.push(*pos);
            }
        }

        data_tables_to_move_right.sort_by(|a, b| b.x.cmp(&a.x));
        for old_pos in data_tables_to_move_right {
            if let Some((index, old_pos, data_table, _)) =
                self.data_tables.shift_remove_full(&old_pos)
            {
                let new_pos = old_pos.translate(1, 0, i64::MIN, i64::MIN);
                self.data_tables.insert_before(index, &new_pos, data_table);
            }
        }

        data_tables_to_move_back.sort_by(|a, b| a.x.cmp(&b.x));
        for to in data_tables_to_move_back {
            let from = to.translate(1, 0, i64::MIN, i64::MIN);
            self.columns.move_cell_value(&from, &to);
        }
    }

    /// Row
    ///
    ////////////
    fn migration_insert_row(
        &mut self,
        row: i64,
        copy_formats: CopyFormats,
        a1_context: &A1Context,
    ) {
        self.migration_check_insert_tables_rows(row, copy_formats);
        self.columns.insert_row(row);
        self.migration_adjust_insert_tables_rows(row);
        self.formats.insert_row(row, copy_formats);
        self.borders.insert_row(row, copy_formats);
        self.validations.migration_row_column(row, a1_context);
        self.offsets.insert_row(row, copy_formats);
        self.migration_recalculate_bounds(a1_context);
        self.columns.migration_regenerate_has_cell_value();
    }
    fn migration_check_insert_tables_rows(&mut self, row: i64, copy_formats: CopyFormats) {
        let source_row = match copy_formats {
            CopyFormats::After => row - 1,
            _ => row,
        };
        for (pos, dt) in self.data_tables.migration_iter_mut() {
            let output_rect = dt.output_rect(*pos, false);
            if dt.is_html_or_image() {
                if let Some((width, height)) = dt.chart_output {
                    if source_row >= pos.y && source_row < pos.y + output_rect.height() as i64 {
                        dt.chart_output = Some((width, height + 1));
                    }
                }
            } else if !dt.is_code()
                && source_row >= pos.y
                && (row < pos.y + output_rect.height() as i64
                    || (CopyFormats::Before == copy_formats
                        && row < pos.y + output_rect.height() as i64 + 1))
            {
                if let Ok(display_row_index) = usize::try_from(row - pos.y) {
                    if dt.insert_row(display_row_index, None).is_err() {
                        continue;
                    }
                    if dt.sort.is_some() {
                        dt.sort_dirty = true;
                    }
                }
            }
        }
    }
    fn migration_adjust_insert_tables_rows(&mut self, row: i64) {
        let mut data_tables_to_move = Vec::new();

        for (pos, _) in self.data_tables.expensive_iter() {
            if pos.y >= row {
                data_tables_to_move.push(*pos);
            }
        }

        data_tables_to_move.sort_by(|a, b| b.y.cmp(&a.y));
        for old_pos in data_tables_to_move {
            if let Some((index, old_pos, data_table, _)) =
                self.data_tables.shift_remove_full(&old_pos)
            {
                let new_pos = old_pos.translate(0, 1, i64::MIN, i64::MIN);
                self.data_tables.insert_before(index, &new_pos, data_table);
            }
        }
    }
}

impl Validations {
    fn migration_insert_column(&mut self, column: i64, a1_context: &A1Context) {
        self.validations.iter_mut().for_each(|validation| {
            validation.selection.inserted_column(column, a1_context);
        });

        let mut warnings_to_move = Vec::new();
        for pos in self.warnings.keys() {
            if pos.x >= column {
                warnings_to_move.push(*pos);
            }
        }

        warnings_to_move.sort_by(|a, b| b.x.cmp(&a.x));
        for pos in warnings_to_move {
            if let Some(uuid) = self.warnings.remove(&pos) {
                self.warnings.insert(
                    Pos {
                        x: pos.x + 1,
                        y: pos.y,
                    },
                    uuid,
                );
            }
        }
    }

    fn migration_row_column(&mut self, row: i64, a1_context: &A1Context) {
        self.validations.iter_mut().for_each(|validation| {
            validation.selection.inserted_row(row, a1_context);
        });

        let mut warnings_to_move = Vec::new();
        for pos in self.warnings.keys() {
            if pos.y >= row {
                warnings_to_move.push(*pos);
            }
        }

        warnings_to_move.sort_by(|a, b| b.y.cmp(&a.y));
        for pos in warnings_to_move {
            if let Some(uuid) = self.warnings.remove(&pos) {
                self.warnings.insert(
                    Pos {
                        x: pos.x,
                        y: pos.y + 1,
                    },
                    uuid,
                );
            }
        }
    }
}

#[cfg(test)]
mod test {

    use crate::{
        CellValue, Pos,
        a1::UNBOUNDED,
        controller::GridController,
        grid::{file::import, sheet::borders::CellBorderLine},
    };

    #[test]
    fn test_negative_offsets() {
        let file = include_bytes!("../../../test-files/v1.7_negative_offsets.grid");
        let imported = import(file.to_vec()).unwrap();
        let gc = GridController::from_grid(imported, 0);
        let sheet_id = gc.sheet_ids()[0];
        let sheet = gc.sheet(sheet_id);

        assert_eq!(
            sheet.display_value(pos![A1]).unwrap(),
            CellValue::Text("negative column and row".into())
        );
        assert_eq!(
            sheet.display_value(pos![F1]).unwrap(),
            CellValue::Text("negative row".into())
        );
        assert_eq!(
            sheet.display_value(pos![A9]).unwrap(),
            CellValue::Text("negative column".into())
        );
        assert_eq!(
            sheet.formats.fill_color.get(Pos {
                x: col![F],
                y: UNBOUNDED
            }),
            Some("rgb(23, 200, 165)".to_string())
        );
        assert_eq!(sheet.formats.bold.get("F1".into()), Some(true));
        assert_eq!(sheet.formats.italic.get(pos![A9]), Some(true));
        assert_eq!(
            sheet.formats.fill_color.get(Pos { x: UNBOUNDED, y: 1 }),
            Some("rgb(241, 196, 15)".to_string())
        );

        let borders = sheet.borders.get_style_cell(pos![A1]);
        assert_eq!(borders.top.unwrap().line, CellBorderLine::default());
        assert_eq!(borders.left.unwrap().line, CellBorderLine::default());
        assert_eq!(borders.bottom.unwrap().line, CellBorderLine::default());
        assert_eq!(borders.right.unwrap().line, CellBorderLine::default());
    }
}
