#[cfg(test)]
use crate::{Pos, SheetPos, controller::GridController, grid::SheetId};

#[track_caller]
#[cfg(test)]
pub fn assert_cell_format_bold_row(
    grid_controller: &GridController,
    sheet_id: SheetId,
    x_start: i64,
    x_end: i64,
    y: i64,
    value: Vec<bool>,
) {
    for (index, x) in (x_start..=x_end).enumerate() {
        assert_cell_format_bold(
            grid_controller,
            sheet_id,
            x,
            y,
            *value.get(index).unwrap_or(&false),
        );
    }
}

#[track_caller]
#[cfg(test)]
pub fn assert_cell_format_bold(
    grid_controller: &GridController,
    sheet_id: SheetId,
    x: i64,
    y: i64,
    expect_bold: bool,
) {
    let sheet = grid_controller.sheet(sheet_id);
    let has_bold = sheet.formats.bold.get(Pos { x, y });
    assert!(
        has_bold == Some(expect_bold) || (has_bold.is_none() && !expect_bold),
        "Cell at ({}, {}) should be bold={}, but is actually bold={}",
        x,
        y,
        expect_bold,
        has_bold.unwrap_or(false)
    );
}

// TODO(ddimaria): refactor all format assertions into a generic function
#[track_caller]
#[cfg(test)]
pub fn assert_cell_format_cell_fill_color_row(
    grid_controller: &GridController,
    sheet_id: SheetId,
    x_start: i64,
    x_end: i64,
    y: i64,
    value: Vec<&str>,
) {
    for (index, x) in (x_start..=x_end).enumerate() {
        assert_cell_format_fill_color(
            grid_controller,
            sheet_id,
            x,
            y,
            value.get(index).unwrap().to_owned(),
        );
    }
}

#[track_caller]
#[cfg(test)]
pub fn assert_fill_color(gc: &GridController, pos: SheetPos, fill_color: &str) {
    let sheet = gc.sheet(pos.sheet_id);
    let cell_fill_color = sheet.formats.fill_color.get(pos.into());
    assert_eq!(
        cell_fill_color,
        Some(fill_color.to_string()),
        "Cell at {pos:?} should be fill_color={fill_color:?}, but is actually fill_color={fill_color:?}"
    );
}

#[track_caller]
#[cfg(test)]
pub fn assert_cell_format_fill_color(
    grid_controller: &GridController,
    sheet_id: SheetId,
    x: i64,
    y: i64,
    expect_fill_color: &str,
) {
    let sheet = grid_controller.sheet(sheet_id);
    let fill_color = sheet.formats.fill_color.get(Pos { x, y });
    assert!(
        fill_color == Some(expect_fill_color.to_string()),
        "Cell at ({x}, {y}) should be fill_color={expect_fill_color:?}, but is actually fill_color={fill_color:?}"
    );
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_assert_cell_format_bold() {
        let mut gc = GridController::test();
        let sheet_id = gc.sheet_ids()[0];
        let sheet = gc.sheet_mut(sheet_id);

        // Set bold formatting
        sheet.formats.bold.set(pos![A1], Some(true));

        // Test the assertion passes when bold is set
        assert_cell_format_bold(&gc, sheet_id, 1, 1, true);
        // Test the assertion passes when bold is not set
        assert_cell_format_bold(&gc, sheet_id, 1, 2, false);
    }
}
