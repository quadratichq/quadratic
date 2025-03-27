#[cfg(test)]
pub fn test_sheet_value(sheet: &mut crate::grid::Sheet, pos: crate::Pos, value: &str) {
    sheet.set_cell_value(pos, value);
}

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

#[cfg(test)]
mod tests {
    use super::*;
    use crate::grid::Sheet;

    #[test]
    fn test_assert_sheet_display_cell_value_matching() {
        let mut sheet = Sheet::test();
        let pos = pos![A1];
        test_sheet_value(&mut sheet, pos, "test");

        // This should not panic
        assert_sheet_display_cell_value(&sheet, pos, "test");
    }

    #[test]
    fn test_assert_sheet_display_cell_value_blank() {
        let sheet = Sheet::test();
        let pos = pos![B5];

        // This should not panic as blank cells match empty strings
        assert_sheet_display_cell_value(&sheet, pos, "");
    }

    #[test]
    #[should_panic(
        expected = "Cell at (1, 2) does not have the value Text(\"expected\"), it's actually Text(\"actual\")"
    )]
    fn test_assert_sheet_display_cell_value_mismatch() {
        let mut sheet = Sheet::test();
        let pos = pos![A2];
        test_sheet_value(&mut sheet, pos, "actual");

        // This should panic
        assert_sheet_display_cell_value(&sheet, pos, "expected");
    }
}
