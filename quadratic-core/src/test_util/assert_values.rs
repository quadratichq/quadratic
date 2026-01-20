#[cfg(test)]
use crate::{CellValue, Pos, SheetPos, controller::GridController, grid::SheetId};

/// Run an assertion that a cell value is equal to the given value
#[track_caller]
#[cfg(test)]
pub fn assert_cell_value(
    grid_controller: &GridController,
    sheet_id: SheetId,
    x: i64,
    y: i64,
    value: CellValue,
) {
    let sheet = grid_controller.sheet(sheet_id);
    let cell_value = sheet.cell_value(Pos { x, y }).unwrap_or(CellValue::Blank);

    assert_eq!(
        value, cell_value,
        "Cell at ({x}, {y}) does not have the value {value:?}, it's actually {cell_value:?}"
    );
}

/// Run an assertion that a cell value is equal to the given value using the first sheet of the gc
#[track_caller]
#[cfg(test)]
pub fn assert_display_cell_value_first_sheet(
    grid_controller: &GridController,
    x: i64,
    y: i64,
    value: &str,
) {
    assert_display_cell_value(grid_controller, grid_controller.sheet_ids()[0], x, y, value);
}

/// Run an assertion that a cell value is equal to the given value
#[track_caller]
#[cfg(test)]
pub fn assert_display(gc: &GridController, sheet_pos: SheetPos, value: &str) {
    assert_display_cell_value(gc, sheet_pos.sheet_id, sheet_pos.x, sheet_pos.y, value);
}

/// Run an assertion that a cell value is equal to the given value
#[track_caller]
#[cfg(test)]
pub fn assert_display_cell_value(
    grid_controller: &GridController,
    sheet_id: SheetId,
    x: i64,
    y: i64,
    value: &str,
) {
    let sheet = grid_controller.sheet(sheet_id);
    let cell_value = sheet
        .display_value(Pos { x, y })
        .map_or_else(|| CellValue::Blank, |v| CellValue::Text(v.to_string()));
    let expected_text_or_blank = |v: &CellValue| {
        v == &CellValue::Text(value.into()) || (v == &CellValue::Blank && value.trim().is_empty())
    };

    assert!(
        expected_text_or_blank(&cell_value),
        "Cell at ({}, {}) does not have the value {:?}, it's actually {:?}",
        x,
        y,
        CellValue::Text(value.into()),
        cell_value
    );
}

/// Run an assertion that a cell value is equal to the given value
#[track_caller]
#[cfg(test)]
pub fn assert_display_cell_value_pos(
    grid_controller: &GridController,
    sheet_id: SheetId,
    pos: Pos,
    value: &str,
) {
    assert_display_cell_value(grid_controller, sheet_id, pos.x, pos.y, value);
}

#[track_caller]
#[cfg(test)]
pub fn assert_code(gc: &GridController, pos: SheetPos, value: &str) {
    let Some(code_run) = gc.sheet(pos.sheet_id).code_run_at(&pos.into()) else {
        panic!("No code cell at {pos}");
    };
    assert_eq!(
        value, code_run.code,
        "Cell at {pos} does not have the value {:?}, it's actually {:?}",
        value, code_run.code
    );
}

/// Run an assertion that a cell value is equal to the given value
#[track_caller]
#[cfg(test)]
pub fn assert_code_cell_value(gc: &GridController, sheet_id: SheetId, x: i64, y: i64, value: &str) {
    let sheet = gc.sheet(sheet_id);
    // handle CellValue::Code first
    if let Some(CellValue::Code(code_cell)) = sheet.cell_value(Pos { x, y }) {
        assert_eq!(
            value, code_cell.code_run.code,
            "Cell at ({}, {}) does not have the value {:?}, it's actually {:?}",
            x, y, value, code_cell.code_run.code
        );
        return;
    }
    let Some(cell_value) = sheet.edit_code_value(Pos { x, y }, gc.a1_context()) else {
        panic!("Expected code cell at {}", Pos { x, y });
    };
    assert_eq!(
        value, cell_value.code_string,
        "Cell at ({}, {}) does not have the value {:?}, it's actually {:?}",
        x, y, value, cell_value.code_string
    );
}

// Run an assertion that cell values in a give column are equal to the given value
#[track_caller]
#[cfg(test)]
pub fn assert_cell_value_col(
    grid_controller: &GridController,
    sheet_id: SheetId,
    x: i64,
    y_start: i64,
    y_end: i64,
    value: Vec<&str>,
) {
    for y in y_start..=y_end {
        assert_display_cell_value(
            grid_controller,
            sheet_id,
            x,
            y,
            value.get((y - y_start) as usize).unwrap_or(&""),
        );
    }
}

/// Run an assertion that cell values in a given row are equal to the given value
#[track_caller]
#[cfg(test)]
pub fn assert_cell_value_row(
    gc: &GridController,
    sheet_id: SheetId,
    x_start: i64,
    x_end: i64,
    y: i64,
    value: Vec<&str>,
) {
    for (index, x) in (x_start..=x_end).enumerate() {
        if let Some(cell_value) = value.get(index) {
            assert_display_cell_value(gc, sheet_id, x, y, cell_value);
        } else {
            panic!("No value at position ({index},{y})");
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_assert_cell_value() {
        let mut gc = GridController::test();
        let sheet_id = gc.sheet_ids()[0];

        // Set up a test cell
        gc.set_cell_value(pos![sheet_id!A1], "test".into(), None, false);

        // Test the assertion passes when values match
        assert_cell_value(&gc, sheet_id, 1, 1, CellValue::Text("test".to_string()));
    }

    #[test]
    fn test_assert_display_cell_value() {
        let mut gc = GridController::test();
        let sheet_id = gc.sheet_ids()[0];

        // Set up a test cell
        gc.set_cell_value(pos![sheet_id!A1], "display test".into(), None, false);

        // Test the assertion passes when values match
        assert_display_cell_value(&gc, sheet_id, 1, 1, "display test");
    }

    #[test]
    fn test_assert_cell_value_row() {
        let mut gc = GridController::test();
        let sheet_id = gc.sheet_ids()[0];

        // Set up a row of test cells
        gc.set_cell_value(pos![sheet_id!A1], "one".into(), None, false);
        gc.set_cell_value(pos![sheet_id!B1], "two".into(), None, false);
        gc.set_cell_value(pos![sheet_id!C1], "three".into(), None, false);

        // Test the assertion passes for a row
        assert_cell_value_row(&gc, sheet_id, 1, 3, 1, vec!["one", "two", "three"]);
    }
}
