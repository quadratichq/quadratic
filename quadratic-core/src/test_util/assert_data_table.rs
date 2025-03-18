#[cfg(test)]
use crate::{controller::GridController, grid::DataTable, grid::SheetId, Pos};

/// Runs an assertion that a cell value is equal to the given value. The col/row
/// are 0-indexed to the table.
#[track_caller]
#[cfg(test)]
pub fn assert_data_table_cell_value(dt: &DataTable, col: i64, row: i64, value: &str) {
    let cell_value = dt.cell_value_at(col as u32, row as u32);
    assert_eq!(
        cell_value,
        if value.is_empty() {
            None
        } else {
            Some(value.into())
        },
        "Cell at ({}, {}) does not have the value {:?}, it's actually {:?}",
        col,
        row,
        value,
        cell_value
    );
}

/// Run an assertion that a row of data table is equal to the given values
#[track_caller]
#[cfg(test)]
pub fn assert_data_table_row(dt: &DataTable, row: i64, values: Vec<&str>) {
    for (index, value) in values.iter().enumerate() {
        assert_data_table_cell_value(dt, index as i64, row, value);
    }
}

/// Run an assertion that a row of data table is equal to the given values.
/// Note, this fn ignores the table name and column headers. Use
/// assert_data_table_row if you're testing those.
#[track_caller]
#[cfg(test)]
pub fn assert_data_table_row_values_only(dt: &DataTable, row: i64, values: Vec<&str>) {
    for (index, value) in values.iter().enumerate() {
        assert_data_table_cell_value(dt, index as i64, row + dt.y_adjustment(true), value);
    }
}

/// Run an assertion that cell values in a given column are equal to the given values
#[track_caller]
#[cfg(test)]
pub fn assert_data_table_column(dt: &DataTable, column: i64, values: Vec<&str>) {
    for (index, value) in values.iter().enumerate() {
        assert_data_table_cell_value(dt, column, index as i64, value);
    }
}

/// Run an assertion that the size of a data table is equal to the given width
/// and height.
#[track_caller]
#[cfg(test)]
pub fn assert_data_table_size(
    grid_controller: &GridController,
    sheet_id: SheetId,
    pos: Pos,
    width: usize,
    height: usize,
) {
    let sheet = grid_controller.sheet(sheet_id);
    let data_table = sheet
        .data_table(pos)
        .expect(&format!("Data table at {} not found", pos));
    assert_eq!(
        data_table.width(),
        width,
        "Width of data table at {} is not {}",
        pos,
        width
    );
    assert_eq!(
        data_table.height(false),
        height,
        "Height of data table at {} is not {}",
        pos,
        height
    );
}

#[cfg(test)]
mod tests {
    use crate::test_util::test_create_data_table_first_sheet;

    use super::*;
    #[test]
    fn test_assert_data_table_size() {
        let mut gc = GridController::test();
        let sheet_id = gc.sheet_ids()[0];
        test_create_data_table_first_sheet(&mut gc, pos![A1], 2, 2, &["a", "b", "c", "d"]);
        assert_data_table_size(&gc, sheet_id, pos![A1], 2, 4);
    }

    #[test]
    fn test_assert_data_table_cell_value() {
        let mut gc = GridController::test();
        let dt = test_create_data_table_first_sheet(&mut gc, pos![A1], 2, 2, &["a", "b", "c", "d"]);

        assert_data_table_cell_value(&dt, 0, 0, "a");
        assert_data_table_cell_value(&dt, 1, 0, "b");
        assert_data_table_cell_value(&dt, 0, 1, "c");
        assert_data_table_cell_value(&dt, 1, 1, "d");
    }

    #[test]
    #[should_panic(expected = "Cell at (0, 0) does not have the value")]
    fn test_assert_data_table_cell_value_failure() {
        let mut gc = GridController::test();
        let dt = test_create_data_table_first_sheet(&mut gc, pos![A1], 2, 2, &["a", "b", "c", "d"]);

        assert_data_table_cell_value(&dt, 0, 0, "wrong");
    }

    #[test]
    fn test_assert_data_table_row() {
        let mut gc = GridController::test();
        let dt = test_create_data_table_first_sheet(&mut gc, pos![A1], 2, 2, &["a", "b", "c", "d"]);

        assert_data_table_row(&dt, 0, vec!["a", "b"]);
        assert_data_table_row(&dt, 1, vec!["c", "d"]);
    }

    #[test]
    fn test_assert_data_table_column() {
        let mut gc = GridController::test();
        let dt = test_create_data_table_first_sheet(&mut gc, pos![A1], 2, 2, &["a", "b", "c", "d"]);

        assert_data_table_column(&dt, 0, vec!["a", "c"]);
        assert_data_table_column(&dt, 1, vec!["b", "d"]);
    }
}
