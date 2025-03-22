#[cfg(test)]
use crate::{
    Pos,
    controller::GridController,
    grid::{DataTable, SheetId},
};

/// Creates a data table on the given sheet of the grid controller. The values
/// will be converted to CellValues and fill the table row-wise (ie, the first
/// values will fill the columns of the first row, etc.).
///
/// The table's name is "test", and the first row is not a header.
///
/// Returns a clone of the created data table.
#[track_caller]
#[cfg(test)]
pub fn test_create_data_table(
    gc: &mut GridController,
    sheet_id: SheetId,
    pos: Pos,
    width: usize,
    height: usize,
    values: &[&str],
) -> DataTable {
    let mut v = vec![];
    for y in 0..height {
        let mut row = vec![];
        for x in 0..width {
            row.push(values[y * width + x].to_string());
        }
        v.push(row);
    }

    gc.add_data_table(
        pos.to_sheet_pos(sheet_id),
        "test_table".to_string(),
        v,
        false,
        None,
    );

    // return a clone of the created data table
    gc.sheet(gc.sheet_ids()[0])
        .data_table(pos)
        .expect("Data table not found")
        .clone()
}

#[cfg(test)]
mod tests {
    use crate::test_util::{assert_data_table_size, sheet};

    use super::*;

    #[test]
    fn test_basic_data_table_creation() {
        let mut gc = GridController::test();
        let pos = pos![B2];

        let values = ["a", "b", "c", "d"];
        let dt = test_create_data_table(&mut gc, SheetId::TEST, pos, 2, 2, &values);

        assert_eq!(dt.name, "test_table".into());
        assert_data_table_size(&gc, SheetId::TEST, pos, 2, 2, false);

        // Verify the table exists and has correct dimensions
        let sheet = sheet(&gc, SheetId::TEST);
        assert_eq!(sheet.data_tables.len(), 1);
    }
}
