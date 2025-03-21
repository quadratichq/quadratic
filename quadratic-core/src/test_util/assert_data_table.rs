#[cfg(test)]
use crate::{Pos, controller::GridController, grid::DataTable, grid::SheetId};

/// Runs an assertion that a cell value is equal to the given value. The col/row
/// are 0-indexed to the table and ignore all ui elements (ie, table name and
/// column headers).
#[track_caller]
#[cfg(test)]
pub fn assert_data_table_at(dt: &DataTable, col: i64, row: i64, value: &str) {
    let cell_value = dt.cell_value_at(col as u32, row as u32 + dt.y_adjustment(true) as u32);
    assert_eq!(
        cell_value,
        if value.is_empty() {
            None
        } else {
            Some(crate::CellValue::parse_from_str(value))
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
        assert_data_table_at(dt, index as i64, row, value);
    }
}

/// Run an assertion that cell values in a given column are equal to the given values. It ignores the table name.
#[track_caller]
#[cfg(test)]
pub fn assert_data_table_column(dt: &DataTable, column: i64, values: Vec<&str>) {
    for (index, value) in values.iter().enumerate() {
        assert_data_table_at(dt, column, index as i64, value);
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
    include_ui: bool,
) {
    let sheet = grid_controller.sheet(sheet_id);
    let data_table = sheet
        .data_table(pos)
        .expect(&format!("Data table at {} not found", pos));
    let adjust_height = if !include_ui {
        if data_table.show_ui {
            (if data_table.show_name { 1 } else { 0 })
                + (if data_table.show_columns { 1 } else { 0 })
        } else {
            0
        }
    } else {
        0
    };
    assert_eq!(
        data_table.width(),
        width,
        "Width of data table at {} is not {}",
        pos,
        width
    );
    assert_eq!(
        data_table.height(false) - adjust_height,
        height,
        "Height of data table at {} is not {} ({})",
        pos,
        height,
        if include_ui { "with ui" } else { "without ui" }
    );
}

#[cfg(test)]
mod tests {
    use crate::test_util::test_create_data_table;

    use super::*;
    #[test]
    fn test_assert_data_table_size() {
        let mut gc = GridController::test();
        let sheet_id = gc.sheet_ids()[0];
        test_create_data_table(
            &mut gc,
            SheetId::TEST,
            pos![A1],
            2,
            2,
            &["a", "b", "c", "d"],
        );
        assert_data_table_size(&gc, sheet_id, pos![A1], 2, 4, true);
        assert_data_table_size(&gc, sheet_id, pos![A1], 2, 2, false);
    }

    #[test]
    fn test_assert_data_table_at() {
        let mut gc = GridController::test();
        let dt = test_create_data_table(
            &mut gc,
            SheetId::TEST,
            pos![A1],
            2,
            2,
            &["a", "b", "c", "d"],
        );

        assert_data_table_at(&dt, 0, 0, "a");
        assert_data_table_at(&dt, 1, 0, "b");
        assert_data_table_at(&dt, 0, 1, "c");
        assert_data_table_at(&dt, 1, 1, "d");
    }

    #[test]
    #[should_panic(expected = "Cell at (0, 0) does not have the value")]
    fn test_assert_data_table_cell_value_failure() {
        let mut gc = GridController::test();
        let dt = test_create_data_table(
            &mut gc,
            SheetId::TEST,
            pos![A1],
            2,
            2,
            &["a", "b", "c", "d"],
        );

        assert_data_table_at(&dt, 0, 0, "wrong");
    }

    #[test]
    fn test_assert_data_table_row() {
        let mut gc = GridController::test();
        let dt = test_create_data_table(
            &mut gc,
            SheetId::TEST,
            pos![A1],
            2,
            2,
            &["a", "b", "c", "d"],
        );

        assert_data_table_row(&dt, 0, vec!["a", "b"]);
        assert_data_table_row(&dt, 1, vec!["c", "d"]);
    }

    #[test]
    fn test_assert_data_table_column() {
        let mut gc = GridController::test();
        let dt = test_create_data_table(
            &mut gc,
            SheetId::TEST,
            pos![A1],
            2,
            2,
            &["a", "b", "c", "d"],
        );

        assert_data_table_column(&dt, 0, vec!["a", "c"]);
        assert_data_table_column(&dt, 1, vec!["b", "d"]);
    }

    #[test]
    #[should_panic(expected = "Cell at (0, 2) does not have the value")]
    fn test_assert_data_table_row_failure() {
        let mut gc = GridController::test();
        let dt = test_create_data_table(
            &mut gc,
            SheetId::TEST,
            pos![A1],
            2,
            2,
            &["a", "b", "c", "d"],
        );

        assert_data_table_row(&dt, 2, vec!["wrong", "value"]);
    }

    #[test]
    #[should_panic(
        expected = "Cell at (1, 0) does not have the value \"wrong\", it's actually Some(Text(\"b\"))"
    )]
    fn test_assert_data_table_column_failure() {
        let mut gc = GridController::test();
        let dt = test_create_data_table(
            &mut gc,
            SheetId::TEST,
            pos![A1],
            2,
            2,
            &["a", "b", "c", "d"],
        );

        assert_data_table_column(&dt, 1, vec!["wrong", "value"]);
    }
}
