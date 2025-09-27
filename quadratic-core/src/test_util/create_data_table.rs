#[cfg(test)]
use crate::{
    Pos,
    controller::GridController,
    grid::{DataTable, SheetId},
};

/// Creates a data table on the given sheet of the grid controller. The values
/// are 0..width * height inserted table row-wise (ie, the first values will
/// fill the columns of the first row, etc.).
///
/// The table's name is "test", and the first row is not a header.
///
/// Returns a clone of the created data table.
#[cfg(test)]
pub fn test_create_data_table(
    gc: &mut GridController,
    sheet_id: SheetId,
    pos: Pos,
    width: usize,
    height: usize,
) -> DataTable {
    let v: Vec<_> = (0..(width * height)).map(|i| i.to_string()).collect();
    let v_refs: Vec<&str> = v.iter().map(|s| s.as_str()).collect();
    test_create_data_table_with_values(gc, sheet_id, pos, width, height, &v_refs)
}

/// Creates a data table on the given sheet of the grid controller. The values
/// are 0..width * height inserted table row-wise (ie, the first values will
/// fill the columns of the first row, etc.).
///
/// The table's name is "test", and the first row is not a header.
///
/// Returns a clone of the created data table.
#[cfg(test)]
pub fn test_create_data_table_no_ui(
    gc: &mut GridController,
    sheet_id: SheetId,
    pos: Pos,
    width: usize,
    height: usize,
) -> DataTable {
    let v: Vec<_> = (0..(width * height)).map(|i| i.to_string()).collect();
    let v_refs: Vec<&str> = v.iter().map(|s| s.as_str()).collect();
    let dt = test_create_data_table_with_values(gc, sheet_id, pos, width, height, &v_refs);
    gc.data_table_meta(
        pos.to_sheet_pos(sheet_id),
        None,
        None,
        None,
        Some(Some(false)),
        Some(Some(false)),
        None,
        false,
    );
    dt
}

/// Creates a data table on the given sheet of the grid controller. The values
/// will be converted to CellValues and fill the table row-wise (ie, the first
/// values will fill the columns of the first row, etc.).
///
/// The table's name is "test", and the first row is not a header.
///
/// Returns a clone of the created data table.
#[cfg(test)]
pub fn test_create_data_table_with_values(
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

    gc.add_data_table_from_values(
        pos.to_sheet_pos(sheet_id),
        "test_table".to_string(),
        v,
        false,
        None,
        false,
    );

    // return a clone of the created data table
    gc.sheet(gc.sheet_ids()[0])
        .data_table_at(&pos)
        .expect("Data table not found")
        .clone()
}

#[cfg(test)]
mod tests {
    use crate::test_util::{assert_data_table_row, assert_data_table_size};

    use super::*;

    #[test]
    fn test_create_data_table_numeric_values() {
        let mut gc = GridController::test();
        let pos = pos![C3];

        let dt = test_create_data_table(&mut gc, SheetId::TEST, pos, 3, 2);

        assert_eq!(dt.name.to_display(), "test_table");
        assert_data_table_size(&gc, SheetId::TEST, pos, 3, 2, false);

        // Verify the values are correct (0 through 5)
        assert_data_table_row(&dt, 0, vec!["0", "1", "2"]);
        assert_data_table_row(&dt, 1, vec!["3", "4", "5"]);
    }

    #[test]
    fn test_create_data_table_with_custom_values() {
        let mut gc = GridController::test();
        let pos = pos![D4];

        let values = ["hello", "world", "test", "data"];
        let dt = test_create_data_table_with_values(&mut gc, SheetId::TEST, pos, 2, 2, &values);

        assert_eq!(dt.name.to_display(), "test_table");
        assert_data_table_size(&gc, SheetId::TEST, pos, 2, 2, false);

        // Verify the custom values are correctly placed
        assert_data_table_row(&dt, 0, vec!["hello", "world"]);
        assert_data_table_row(&dt, 1, vec!["test", "data"]);
    }
}
