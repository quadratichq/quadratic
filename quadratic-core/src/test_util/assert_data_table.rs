#[cfg(test)]
use crate::{
    CellValue, Pos, SheetPos,
    controller::GridController,
    grid::{CodeCellLanguage, DataTable, SheetId},
};

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
        "Cell at ({col}, {row}) does not have the value {value:?}, it's actually {cell_value:?}"
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

/// Run an assertion that the size of a chart is equal to the given width
/// and height.
#[cfg(test)]
#[track_caller]
pub fn assert_chart_size(
    gc: &GridController,
    sheet_id: SheetId,
    pos: Pos,
    width: usize,
    height: usize,
    include_ui: bool,
) {
    assert_data_table_size(gc, sheet_id, pos, width, height, include_ui);
}

/// Run an assertion that a data table is equal to the given data table.
#[cfg(test)]
#[track_caller]
pub fn assert_data_table_eq(gc: &GridController, sheet_pos: SheetPos, dt: &DataTable) {
    let sheet = gc.sheet(sheet_pos.sheet_id);
    let data_table = sheet.data_table_at(&sheet_pos.into()).unwrap();
    assert_eq!(
        data_table, dt,
        "Data table at {sheet_pos:?} is not equal to provided data table"
    );
}

/// Run an assertion that the size of a data table is equal to the given width
/// and height. Also works with charts.
#[cfg(test)]
#[track_caller]
pub fn assert_data_table_size(
    gc: &GridController,
    sheet_id: SheetId,
    pos: Pos,
    width: usize,
    height: usize,
    include_ui: bool,
) {
    let sheet = gc.sheet(sheet_id);
    let Some(data_table) = sheet.data_table_at(&pos) else {
        panic!("Data table at {pos} not found");
    };
    if data_table.is_html_or_image() {
        assert_eq!(
            data_table.chart_output,
            Some((
                width as u32,
                (if include_ui { 1 } else { 0 }) + height as u32
            )),
            "Chart size at {} is not {:?}",
            pos,
            data_table.chart_output
        );
        return;
    }

    let adjust_height = if !include_ui {
        (if data_table.get_show_name() { 1 } else { 0 })
            + (if data_table.get_show_columns() { 1 } else { 0 })
    } else {
        0
    };
    assert_eq!(
        data_table.width(),
        width,
        "Width of data table at {pos} is not {width}"
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
#[track_caller]
pub fn assert_table_count(gc: &GridController, sheet_id: SheetId, count: usize) {
    let sheet = gc.sheet(sheet_id);
    assert_eq!(
        sheet.data_tables.len(),
        count,
        "Data table count at {} is not {}",
        sheet.name,
        count
    );
}

#[cfg(test)]
#[track_caller]
pub fn assert_data_table_sort_dirty(
    gc: &GridController,
    sheet_id: SheetId,
    pos: Pos,
    sort_dirty: bool,
) {
    let sheet = gc.sheet(sheet_id);
    let data_table = sheet
        .data_table_at(&pos)
        .unwrap_or_else(|| panic!("Data table at {pos} not found"));
    assert_eq!(
        data_table.sort_dirty, sort_dirty,
        "Sort data table at {pos} is not {sort_dirty}"
    );
}

#[cfg(test)]
#[track_caller]
pub fn assert_import(
    gc: &GridController,
    sheet_pos: SheetPos,
    name: &str,
    w: usize,
    h_with_ui: usize,
) {
    use std::num::NonZero;

    use crate::CellValue;

    let Some(dt) = gc
        .sheet(sheet_pos.sheet_id)
        .data_table_at(&sheet_pos.into())
    else {
        panic!("Data table at {sheet_pos} not found");
    };
    if dt.is_code() {
        panic!("Data table at {sheet_pos} is not an import");
    }
    let size = dt.output_size();
    assert_eq!(
        size.w,
        NonZero::<u32>::new(w as u32).unwrap(),
        "Width of data table at {sheet_pos} is not {w}"
    );
    assert_eq!(
        size.h,
        NonZero::<u32>::new(h_with_ui as u32).unwrap(),
        "Height of data table at {sheet_pos} is not {h_with_ui}"
    );
    assert_eq!(
        dt.name,
        CellValue::Text(name.to_string()),
        "Name of data table at {sheet_pos} is not {name}"
    );
}

#[cfg(test)]
#[track_caller]
pub fn assert_code_language(
    gc: &GridController,
    sheet_pos: SheetPos,
    language: CodeCellLanguage,
    code: String,
) {
    let pos = Pos::from(sheet_pos);
    let sheet = gc.sheet(sheet_pos.sheet_id);

    // First check for CellValue::Code in columns
    if let Some(CellValue::Code(code_cell)) = sheet.cell_value_ref(pos) {
        assert_eq!(code_cell.code_run.language, language);
        assert_eq!(code_cell.code_run.code, code);
        return;
    }

    // Otherwise check data_tables
    let Some(dt) = sheet.data_table_at(&pos) else {
        panic!("Code cell at {pos} not found (neither CellValue::Code nor DataTable)");
    };
    if let Some(code_run) = dt.code_run() {
        assert_eq!(code_run.language, language);
        assert_eq!(code_run.code, code);
    } else {
        panic!("Data table at {pos} does not have a code run");
    }
}

#[cfg(test)]
mod tests {
    use crate::{test_create_data_table, test_util::test_create_data_table_with_values};

    use super::*;
    #[test]
    fn test_assert_data_table_size() {
        let mut gc = GridController::test();
        let sheet_id = gc.sheet_ids()[0];
        test_create_data_table_with_values(
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
        let dt = test_create_data_table_with_values(
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
        let dt = test_create_data_table_with_values(
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
        let dt = test_create_data_table_with_values(
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
        let dt = test_create_data_table_with_values(
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
        let dt = test_create_data_table_with_values(
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
        let dt = test_create_data_table_with_values(
            &mut gc,
            SheetId::TEST,
            pos![A1],
            2,
            2,
            &["a", "b", "c", "d"],
        );

        assert_data_table_column(&dt, 1, vec!["wrong", "value"]);
    }

    #[test]
    fn test_assert_data_table_count() {
        let mut gc = GridController::test();
        let sheet_id = gc.sheet_ids()[0];

        // Initially should have no data tables
        assert_table_count(&gc, sheet_id, 0);

        // Add one data table
        test_create_data_table(&mut gc, SheetId::TEST, pos![A1], 2, 2);
        assert_table_count(&gc, sheet_id, 1);

        // Add another data table
        test_create_data_table(&mut gc, SheetId::TEST, pos![D1], 1, 1);
        assert_table_count(&gc, sheet_id, 2);
    }

    #[test]
    fn test_assert_data_table() {
        let mut gc = GridController::test();
        let sheet_id = gc.sheet_ids()[0];

        // Create a data table with some values
        let dt = test_create_data_table(&mut gc, sheet_id, pos![A1], 2, 2);

        // Assert that the data table matches the expected one
        assert_data_table_eq(&gc, pos![sheet_id!a1], &dt);
    }

    #[test]
    #[should_panic(expected = "Data table at SheetPos")]
    fn test_assert_data_table_failure() {
        let mut gc = GridController::test();
        let sheet_id = gc.sheet_ids()[0];

        // Create a data table with some values
        test_create_data_table(&mut gc, sheet_id, pos![A1], 2, 2);

        // Create a different data table to compare against
        let different_dt = test_create_data_table(&mut gc, sheet_id, pos![D1], 2, 2);

        // This should panic since the data tables are different
        assert_data_table_eq(&gc, pos![sheet_id!a1], &different_dt);
    }
}
