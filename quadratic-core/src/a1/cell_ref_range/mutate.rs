use super::*;

impl CellRefRange {
    pub fn translate_in_place(&mut self, x: i64, y: i64) {
        match self {
            Self::Sheet { range } => range.translate_in_place(x, y),
            Self::Table { .. } => (),
        }
    }

    pub fn translate(&self, x: i64, y: i64) -> Self {
        if let Self::Sheet { range } = self {
            Self::Sheet {
                range: range.translate(x, y),
            }
        } else {
            self.clone()
        }
    }

    pub fn adjust_column_row_in_place(
        &mut self,
        column: Option<i64>,
        row: Option<i64>,
        delta: i64,
    ) {
        if let Self::Sheet { range } = self {
            range.adjust_column_row_in_place(column, row, delta);
        }
    }

    pub fn adjust_column_row(&self, column: Option<i64>, row: Option<i64>, delta: i64) -> Self {
        if let Self::Sheet { range } = self {
            Self::Sheet {
                range: range.adjust_column_row(column, row, delta),
            }
        } else {
            self.clone()
        }
    }

    pub fn replace_table_name(&mut self, old_name: &str, new_name: &str) {
        match self {
            Self::Sheet { .. } => {}
            Self::Table { range } => {
                range.replace_table_name(old_name, new_name);
            }
        }
    }

    pub fn replace_column_name(&mut self, old_name: &str, new_name: &str) {
        match self {
            Self::Sheet { .. } => {}
            Self::Table { range } => {
                range.replace_column_name(old_name, new_name);
            }
        }
    }
}

#[cfg(test)]
#[serial_test::parallel]
mod tests {
    use super::*;

    #[test]
    fn test_translate_in_place() {
        // Test single cell translation
        let mut cell = CellRefRange::test_a1("A1");
        cell.translate_in_place(1, 2);
        assert_eq!(cell.to_string(), "B3");

        // Test range translation
        let mut range = CellRefRange::test_a1("A1:B2");
        range.translate_in_place(2, 1);
        assert_eq!(range.to_string(), "C2:D3");

        // Test column range translation
        let mut col_range = CellRefRange::test_a1("A:B");
        col_range.translate_in_place(1, 0);
        assert_eq!(col_range.to_string(), "B:C");

        // Test row range translation
        let mut row_range = CellRefRange::test_a1("1:2");
        row_range.translate_in_place(0, 2);
        assert_eq!(row_range.to_string(), "3:4");

        // Test negative translation capping
        let mut cell = CellRefRange::test_a1("A1");
        cell.translate_in_place(-10, -10);
        assert_eq!(cell.to_string(), "A1");
    }

    #[test]
    fn test_translate() {
        // Test single cell translation
        let cell = CellRefRange::test_a1("A1");
        let translated = cell.translate(1, 2);
        assert_eq!(translated.to_string(), "B3");
        assert_eq!(cell, CellRefRange::test_a1("A1"));

        // Test range translation
        let range = CellRefRange::test_a1("A1:B2");
        let translated = range.translate(2, 1);
        assert_eq!(translated.to_string(), "C2:D3");
        assert_eq!(range, CellRefRange::test_a1("A1:B2"));

        // Test column range translation
        let col_range = CellRefRange::test_a1("A:B");
        let translated = col_range.translate(1, 0);
        assert_eq!(translated.to_string(), "B:C");
        assert_eq!(col_range, CellRefRange::test_a1("A:B"));

        // Test row range translation
        let row_range = CellRefRange::test_a1("1:2");
        let translated = row_range.translate(0, 2);
        assert_eq!(translated.to_string(), "3:4");
        assert_eq!(row_range, CellRefRange::test_a1("1:2"));

        // Test negative translation capping
        let cell = CellRefRange::test_a1("A1");
        let translated = cell.translate(-10, -10);
        assert_eq!(translated.to_string(), "A1");
        assert_eq!(cell, CellRefRange::test_a1("A1"));
    }

    #[test]
    fn test_adjust_column_row() {
        let mut range = CellRefRange::test_a1("B3");
        range.adjust_column_row_in_place(Some(2), None, 1);
        assert_eq!(range.to_string(), "C3");

        let mut range = CellRefRange::test_a1("B3");
        range.adjust_column_row_in_place(None, Some(2), 1);
        assert_eq!(range.to_string(), "B4");

        let mut range = CellRefRange::test_a1("B3");
        range.adjust_column_row_in_place(Some(3), None, 1);
        assert_eq!(range.to_string(), "B3");

        let mut range = CellRefRange::test_a1("B3");
        range.adjust_column_row_in_place(None, Some(4), 1);
        assert_eq!(range.to_string(), "B3");

        let mut range = CellRefRange::test_a1("B3");
        range.adjust_column_row_in_place(Some(1), None, -1);
        assert_eq!(range.to_string(), "A3");

        let mut range = CellRefRange::test_a1("B3");
        range.adjust_column_row_in_place(None, Some(1), -1);
        assert_eq!(range.to_string(), "B2");
    }
}
