//! This module contains the function that shifts all offsets <= 0 to 1. This
//! happens during the transition from v1.7 to v1.7.1. There are no other
//! changes in v1.7.1. Note, we do not use the normal transaction process for
//! this change. quadratic-files will automatically upgrade using this function
//! before applying any received changes.

use std::collections::HashMap;

use crate::{
    controller::{
        active_transactions::pending_transaction::PendingTransaction, execution::TransactionSource,
    },
    grid::{Grid, GridBounds},
    CopyFormats,
};

pub const IMPORT_OFFSET: i64 = 1000000;

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
    let mut transaction = PendingTransaction {
        source: TransactionSource::Server,
        ..Default::default()
    };
    let mut changed = false;
    let mut shifted_offsets_sheet_name = HashMap::new(); // for migrating cells to q.cells
    let mut shifted_offsets_sheet_id = HashMap::new(); // for translating code runs's cells_accessed
    for sheet in grid.sheets.iter_mut() {
        let mut x_shift = 0;
        let mut y_shift = 0;

        if let GridBounds::NonEmpty(bounds) = sheet.bounds(false) {
            // shift columns
            if bounds.min.x <= 0 {
                changed = true;
                let insert = bounds.min.x - 1;
                for _ in bounds.min.x..=0 {
                    sheet.insert_column(&mut transaction, insert, CopyFormats::None);
                    sheet.recalculate_bounds();
                    x_shift += 1;
                }
            }

            // shift rows
            if bounds.min.y <= 0 {
                changed = true;
                let insert = bounds.min.y - 1;
                for _ in bounds.min.y..=0 {
                    sheet.insert_row(&mut transaction, insert, CopyFormats::None);
                    sheet.recalculate_bounds();
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
        for code_run in sheet.code_runs.values_mut() {
            let cells = &mut code_run.cells_accessed.cells;
            for (sheet_id, ranges) in cells {
                // Get shift values for the current sheet, skip if not found
                let Some(&(x_shift, y_shift)) = shifted_offsets_sheet_id.get(sheet_id) else {
                    continue;
                };

                // Skip translation if no shift is needed
                if x_shift == 0 && y_shift == 0 {
                    continue;
                }

                // Translate all ranges and collect into new HashSet
                *ranges = ranges
                    .iter()
                    .map(|r| r.translate(x_shift, y_shift))
                    .collect();
            }
        }
    }

    // remove the import offset from the formats and borders_a1
    for sheet in grid.sheets.iter_mut() {
        sheet
            .formats
            .translate_in_place(-IMPORT_OFFSET, -IMPORT_OFFSET);
        sheet
            .borders_a1
            .translate_in_place(-IMPORT_OFFSET, -IMPORT_OFFSET);
        sheet.recalculate_bounds();
    }

    // if changed && cfg!(target_family = "wasm") || cfg!(test) {
    if changed {
        crate::wasm_bindings::js::jsClientMessage("negative_offsets".to_string(), false);
    }

    shifted_offsets_sheet_name
}

#[cfg(test)]
mod test {
    use serial_test::parallel;

    use crate::{
        controller::GridController,
        grid::{file::import, sheet::borders_a1::CellBorderLine},
        CellValue, Pos,
    };

    #[test]
    #[parallel]
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
                y: i64::MAX
            }),
            Some("rgb(23, 200, 165)".to_string())
        );
        assert_eq!(sheet.formats.bold.get("F1".into()), Some(true));
        assert_eq!(sheet.formats.italic.get(pos![A9]), Some(true));
        assert_eq!(
            sheet.formats.fill_color.get(Pos { x: i64::MAX, y: 1 }),
            Some("rgb(241, 196, 15)".to_string())
        );

        let borders = sheet.borders_a1.get_style_cell(pos![A1]);
        assert_eq!(borders.top.unwrap().line, CellBorderLine::default());
        assert_eq!(borders.left.unwrap().line, CellBorderLine::default());
        assert_eq!(borders.bottom.unwrap().line, CellBorderLine::default());
        assert_eq!(borders.right.unwrap().line, CellBorderLine::default());
    }
}
