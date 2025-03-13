/// Run an assertion that a cell value is equal to the given value
#[track_caller]
#[cfg(test)]
pub fn assert_sheet_display_cell_value(sheet: &crate::grid::Sheet, pos: crate::Pos, value: &str) {
    use crate::CellValue;

    let cell_value = sheet
        .display_value(pos)
        .map_or_else(|| CellValue::Blank, |v| CellValue::Text(v.to_string()));
    let expected_text_or_blank =
        |v: &CellValue| v == &CellValue::Text(value.into()) || v == &CellValue::Blank;

    assert!(
        expected_text_or_blank(&cell_value),
        "Cell at ({}, {}) does not have the value {:?}, it's actually {:?}",
        pos.x,
        pos.y,
        CellValue::Text(value.into()),
        cell_value
    );
}
