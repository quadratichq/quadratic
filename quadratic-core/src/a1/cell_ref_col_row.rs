use super::CellRefRange;

impl CellRefRange {
    /// Handle the removal of a column. Returns whether the range was changed.
    ///
    /// Note: this does not handle the case where the deleted column is the same
    /// as self's column(s). That has to be handled one step above this call.
    pub fn removed_column(&mut self, column: i64) -> bool {
        let mut changed = false;

        match self {
            Self::Sheet { range } => {
                // Check if the start column needs to be adjusted
                if let Some(start_col) = range.start.col.as_mut() {
                    if start_col.coord > column {
                        start_col.coord = start_col.coord.saturating_sub(1).max(1);
                        changed = true;
                    }
                }

                // Check if the end column needs to be adjusted
                if let Some(end) = range.end.as_mut() {
                    if let Some(end_col) = end.col.as_mut() {
                        if end_col.coord >= column {
                            end_col.coord = end_col.coord.saturating_sub(1).max(1);
                            changed = true;
                        }
                    }
                }
                // clean up end if it's the same as start
                if range.end.is_some_and(|end| end == range.start) {
                    range.end = None;
                }
            }
        }

        changed
    }

    /// Handle the removal of a row. Returns whether the range was changed.
    ///
    /// Note: this does not handle the case where the deleted row is the same as
    /// self's row(s). That has to be handled one step above this call.
    pub fn removed_row(&mut self, row: i64) -> bool {
        let mut changed = false;

        match self {
            Self::Sheet { range } => {
                // Check if the start row needs to be adjusted
                if let Some(start_row) = range.start.row.as_mut() {
                    if start_row.coord > row {
                        start_row.coord = start_row.coord.saturating_sub(1).max(1);
                        changed = true;
                    }
                }

                // Check if the end row needs to be adjusted
                if let Some(end) = range.end.as_mut() {
                    if let Some(end_row) = end.row.as_mut() {
                        if end_row.coord >= row {
                            end_row.coord = end_row.coord.saturating_sub(1).max(1);
                            changed = true;
                        }
                    }
                }
                // clean up end if it's the same as start
                if range.end.is_some_and(|end| end == range.start) {
                    range.end = None;
                }
            }
        }

        changed
    }

    pub fn inserted_column(&mut self, column: i64) -> bool {
        let mut changed = false;

        match self {
            Self::Sheet { range } => {
                // Check if the start column needs to be adjusted
                if let Some(start_col) = range.start.col.as_mut() {
                    if start_col.coord >= column {
                        start_col.coord = start_col.coord.saturating_add(1);
                        changed = true;
                    }
                }

                // Check if the end column needs to be adjusted
                if let Some(end) = range.end.as_mut() {
                    if let Some(end_col) = end.col.as_mut() {
                        if end_col.coord >= column {
                            end_col.coord = end_col.coord.saturating_add(1);
                            changed = true;
                        }
                    }
                }
            }
        }

        changed
    }

    pub fn inserted_row(&mut self, row: i64) -> bool {
        let mut changed = false;

        match self {
            Self::Sheet { range } => {
                // Check if the start row needs to be adjusted
                if let Some(start_row) = range.start.row.as_mut() {
                    if start_row.coord >= row {
                        start_row.coord = start_row.coord.saturating_add(1);
                        changed = true;
                    }
                }

                // Check if the end row needs to be adjusted
                if let Some(end) = range.end.as_mut() {
                    if let Some(end_row) = end.row.as_mut() {
                        if end_row.coord >= row {
                            end_row.coord = end_row.coord.saturating_add(1);
                            changed = true;
                        }
                    }
                }
            }
        }

        changed
    }
}

#[cfg(test)]
#[serial_test::parallel]
mod tests {
    use super::*;

    #[test]
    fn test_removed_column() {
        // Basic case - removing a column in range
        let mut range = CellRefRange::test("A1:B2");
        assert!(range.removed_column(1));
        assert_eq!(range, CellRefRange::test("A1:A2"));

        // Removing column affects coordinates above it
        range = CellRefRange::test("D2:E5");
        assert!(range.removed_column(1));
        assert_eq!(range, CellRefRange::test("C2:D5"));

        // Removing a column not in the range
        range = CellRefRange::test("C1:D2");
        assert!(range.removed_column(1));
        assert_eq!(range, CellRefRange::test("B1:C2"));

        // Removing the start column
        range = CellRefRange::test("B1:D2");
        assert!(range.removed_column(2));
        assert_eq!(range, CellRefRange::test("B1:C2"));

        // Removing the end column
        range = CellRefRange::test("B1:D2");
        assert!(range.removed_column(4));
        assert_eq!(range, CellRefRange::test("B1:C2"));

        // Test minimum column boundary
        range = CellRefRange::test("A1:A2");
        assert!(range.removed_column(1));
        assert_eq!(range, CellRefRange::test("A1:A2"));

        // Test when start and end become equal
        range = CellRefRange::test("A1:B1");
        assert!(range.removed_column(2));
        assert_eq!(range, CellRefRange::test("A1"));
    }

    #[test]
    fn test_removed_row() {
        // Basic case - removing a row in range
        let mut range = CellRefRange::test("A1:B2");
        assert!(range.removed_row(1));
        assert_eq!(range, CellRefRange::test("A1:B1"));

        // Removing row affects coordinates above it
        range = CellRefRange::test("D2:E5");
        assert!(range.removed_row(1));
        assert_eq!(range, CellRefRange::test("D1:E4"));

        // Removing a row not in the range
        range = CellRefRange::test("C3:D4");
        assert!(range.removed_row(1));
        assert_eq!(range, CellRefRange::test("C2:D3"));

        // Removing the start row
        range = CellRefRange::test("B2:D4");
        assert!(range.removed_row(2));
        assert_eq!(range, CellRefRange::test("B2:D3"));

        // Removing the end row
        range = CellRefRange::test("B2:D4");
        assert!(range.removed_row(4));
        assert_eq!(range, CellRefRange::test("B2:D3"));

        // Test minimum row boundary
        range = CellRefRange::test("A1:B1");
        assert!(range.removed_row(1));
        assert_eq!(range, CellRefRange::test("A1:B1"));

        // Test when start and end become equal
        range = CellRefRange::test("A1:A2");
        assert!(range.removed_row(2));
        assert_eq!(range, CellRefRange::test("A1"));
    }

    #[test]
    fn test_inserted_column() {
        // Basic case - inserting a column before range
        let mut range = CellRefRange::test("B1:C2");
        assert!(range.inserted_column(1));
        assert_eq!(range, CellRefRange::test("C1:D2"));

        // Inserting column at start of range
        range = CellRefRange::test("B1:D2");
        assert!(range.inserted_column(2));
        assert_eq!(range, CellRefRange::test("C1:E2"));

        // Inserting column in middle of range
        range = CellRefRange::test("B1:D2");
        assert!(range.inserted_column(3));
        assert_eq!(range, CellRefRange::test("B1:E2"));

        // Inserting column at end of range
        range = CellRefRange::test("B1:D2");
        assert!(range.inserted_column(4));
        assert_eq!(range, CellRefRange::test("B1:E2"));

        // Inserting column after range - should not affect range
        range = CellRefRange::test("B1:D2");
        assert!(!range.inserted_column(5));
        assert_eq!(range, CellRefRange::test("B1:D2"));

        // Single cell reference
        range = CellRefRange::test("B1");
        assert!(range.inserted_column(2));
        assert_eq!(range, CellRefRange::test("C1"));

        // Single cell reference - insert after
        range = CellRefRange::test("B1");
        assert!(!range.inserted_column(3));
        assert_eq!(range, CellRefRange::test("B1"));

        // Testing with column-only references
        range = CellRefRange::test("B:D");
        assert!(range.inserted_column(2));
        assert_eq!(range, CellRefRange::test("C:E"));
    }

    #[test]
    fn test_inserted_row() {
        // Basic case - inserting a row before range
        let mut range = CellRefRange::test("A2:B3");
        assert!(range.inserted_row(1));
        assert_eq!(range, CellRefRange::test("A3:B4"));

        // Inserting row at start of range
        range = CellRefRange::test("A2:B4");
        assert!(range.inserted_row(2));
        assert_eq!(range, CellRefRange::test("A3:B5"));

        // Inserting row in middle of range
        range = CellRefRange::test("A2:B4");
        assert!(range.inserted_row(3));
        assert_eq!(range, CellRefRange::test("A2:B5"));

        // Inserting row at end of range
        range = CellRefRange::test("A2:B4");
        assert!(range.inserted_row(4));
        assert_eq!(range, CellRefRange::test("A2:B5"));

        // Inserting row after range - should not affect range
        range = CellRefRange::test("A2:B4");
        assert!(!range.inserted_row(5));
        assert_eq!(range, CellRefRange::test("A2:B4"));

        // Single cell reference
        range = CellRefRange::test("A2");
        assert!(range.inserted_row(2));
        assert_eq!(range, CellRefRange::test("A3"));

        // Single cell reference - insert after
        range = CellRefRange::test("A2");
        assert!(!range.inserted_row(3));
        assert_eq!(range, CellRefRange::test("A2"));

        // Testing with row-only references
        range = CellRefRange::test("2:4");
        assert!(range.inserted_row(2));
        assert_eq!(range, CellRefRange::test("3:5"));
    }
}
