//! This module contains the function that shifts all offsets <= 0 to 1. This
//! happens during the transition from v1.7 to v1.7.1. There are no other
//! changes in v1.7.1. Note, we do not use the normal transaction process for
//! this change. quadratic-files will automatically upgrade using this function
//! before applying any received changes.

use crate::{
    controller::{
        active_transactions::pending_transaction::PendingTransaction,
        operations::operation::CopyFormats,
    },
    grid::{Grid, GridBounds},
};

/// Shifts all negative offsets in the grid and signals client.
pub fn shift_negative_offsets(grid: &mut Grid) {
    let mut changed = false;
    for sheet in grid.sheets.iter_mut() {
        if let GridBounds::NonEmpty(bounds) = sheet.bounds(false) {
            // this is a dummy transaction because it happens before the initial
            // render of the grid file, so there's no info to share with the
            // client. Also, we do not send any information to multiplayer, as
            // quadratic-files will automatically upgrade using this function
            // before applying any changes.
            let mut _transaction = PendingTransaction::default();
            if bounds.min.x <= 0 {
                changed = true;
                let insert = bounds.min.x - 1;
                for _ in bounds.min.x..=0 {
                    sheet.insert_column(&mut _transaction, insert, CopyFormats::None);
                    sheet.recalculate_bounds();
                }
            }
            if bounds.min.y <= 0 {
                changed = true;
                let insert = bounds.min.y - 1;
                for _ in bounds.min.y..=0 {
                    sheet.insert_row(&mut _transaction, insert, CopyFormats::None);
                    sheet.recalculate_bounds();
                }
            }
        }
    }
    if changed {
        crate::wasm_bindings::js::jsClientMessage("negative_offsets".to_string(), false);
    }
}

#[cfg(test)]
mod test {
    use serial_test::parallel;

    use crate::{
        controller::GridController,
        grid::{file::import, formats::format::Format, CellBorderLine},
        CellValue, Pos, A1,
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
            sheet.display_value(Pos::from("a1")).unwrap(),
            CellValue::Text("negative column and row".into())
        );
        assert_eq!(
            sheet.display_value(Pos::from("f1")).unwrap(),
            CellValue::Text("negative row".into())
        );
        assert_eq!(
            sheet.display_value(Pos::from("a9")).unwrap(),
            CellValue::Text("negative column".into())
        );
        assert_eq!(
            sheet.format_column(A1::column("f")),
            Format {
                fill_color: Some("rgb(23, 200, 165)".to_string()),
                ..Default::default()
            }
        );
        assert_eq!(
            sheet.format_cell_a1("f1", false).unwrap(),
            Format {
                bold: Some(true),
                ..Default::default()
            }
        );
        assert_eq!(
            sheet.format_cell_a1("a9", false).unwrap(),
            Format {
                italic: Some(true),
                ..Default::default()
            }
        );
        assert_eq!(
            sheet.format_row(1),
            Format {
                fill_color: Some("rgb(241, 196, 15)".to_string()),
                ..Default::default()
            }
        );

        let borders = sheet.borders.try_from_a1("A1").unwrap();
        assert_eq!(borders.top.unwrap().line, CellBorderLine::default());
        assert_eq!(borders.left.unwrap().line, CellBorderLine::default());
        assert_eq!(borders.bottom.unwrap().line, CellBorderLine::default());
        assert_eq!(borders.right.unwrap().line, CellBorderLine::default());
    }
}
