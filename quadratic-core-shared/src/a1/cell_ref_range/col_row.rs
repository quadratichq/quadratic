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
                // do nothing if the column range is unbounded
                if !(range.start.col() == 1 && range.end.col.is_unbounded()) {
                    // Check if the start column needs to be adjusted
                    if range.start.col() > column {
                        let old = range.start.col();
                        range.start.col.coord = range.start.col.coord.saturating_sub(1).max(1);
                        changed = old != range.start.col();
                    }

                    // Check if the end column needs to be adjusted
                    if !range.end.col.is_unbounded() && range.end.col() >= column {
                        let old = range.end.col();
                        range.end.col.coord = range.end.col.coord.saturating_sub(1).max(1);
                        changed = old != range.end.col();
                    }
                }
            }
            // todo: handle table ranges--for now it ignores them
            Self::Table { .. } => (),
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
                if !(range.start.row() == 1 && range.end.row.is_unbounded()) {
                    // Check if the start row needs to be adjusted
                    if range.start.row() > row {
                        let old = range.start.row();
                        range.start.row.coord = range.start.row().saturating_sub(1).max(1);
                        changed = old != range.start.row();
                    }

                    // Check if the end row needs to be adjusted{
                    if !range.end.row.is_unbounded() && range.end.row() >= row {
                        let old = range.end.row();
                        range.end.row.coord = range.end.row().saturating_sub(1).max(1);
                        changed = old != range.end.row();
                    }
                }
            }
            // todo: handle table ranges--for now it ignores them
            Self::Table { .. } => (),
        }
        changed
    }

    pub fn inserted_column(&mut self, column: i64) -> bool {
        let mut changed = false;

        match self {
            Self::Sheet { range } => {
                // Check if the start column needs to be adjusted
                if range.start.col() >= column {
                    range.start.col.coord = range.start.col.coord.saturating_add(1);
                    changed = true;
                }

                // Check if the end column needs to be adjusted
                if range.end.col() >= column {
                    range.end.col.coord = range.end.col.coord.saturating_add(1);
                    changed = true;
                }
            }
            // todo: handle table ranges--for now it ignores them
            Self::Table { .. } => (),
        }
        changed
    }

    pub fn inserted_row(&mut self, row: i64) -> bool {
        let mut changed = false;

        match self {
            Self::Sheet { range } => {
                // Check if the start row needs to be adjusted
                if range.start.row() >= row {
                    range.start.row.coord = range.start.row().saturating_add(1);
                    changed = true;
                }

                // Check if the end row needs to be adjusted
                if range.end.row() >= row {
                    range.end.row.coord = range.end.row().saturating_add(1);
                    changed = true;
                }
            }
            // todo: handle table ranges--for now it ignores them
            Self::Table { .. } => (),
        }
        changed
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_removed_column() {
        // Basic case - removing a column in range
        let mut range = CellRefRange::test_a1("A1:B2");
        assert!(range.removed_column(1));
        assert_eq!(range, CellRefRange::test_a1("A1:A2"));

        // Removing column affects coordinates above it
        range = CellRefRange::test_a1("D2:E5");
        assert!(range.removed_column(1));
        assert_eq!(range, CellRefRange::test_a1("C2:D5"));

        // Removing a column not in the range
        range = CellRefRange::test_a1("C1:D2");
        assert!(range.removed_column(1));
        assert_eq!(range, CellRefRange::test_a1("B1:C2"));

        // Removing the start column
        range = CellRefRange::test_a1("B1:D2");
        assert!(range.removed_column(2));
        assert_eq!(range, CellRefRange::test_a1("B1:C2"));

        // Removing the end column
        range = CellRefRange::test_a1("B1:D2");
        assert!(range.removed_column(4));
        assert_eq!(range, CellRefRange::test_a1("B1:C2"));

        // Test minimum column boundary
        range = CellRefRange::test_a1("A1:A2");
        assert!(!range.removed_column(1));

        // Test when start and end become equal
        range = CellRefRange::test_a1("A1:B1");
        assert!(range.removed_column(2));
        assert_eq!(range, CellRefRange::test_a1("A1"));

        range = CellRefRange::test_a1("5:10");
        assert!(!range.removed_column(1));
    }

    #[test]
    fn test_removed_row() {
        // Basic case - removing a row in range
        let mut range = CellRefRange::test_a1("A1:B2");
        assert!(range.removed_row(1));
        assert_eq!(range, CellRefRange::test_a1("A1:B1"));

        // Removing row affects coordinates above it
        range = CellRefRange::test_a1("D2:E5");
        assert!(range.removed_row(1));
        assert_eq!(range, CellRefRange::test_a1("D1:E4"));

        // Removing a row not in the range
        range = CellRefRange::test_a1("C3:D4");
        assert!(range.removed_row(1));
        assert_eq!(range, CellRefRange::test_a1("C2:D3"));

        // Removing the start row
        range = CellRefRange::test_a1("B2:D4");
        assert!(range.removed_row(2));
        assert_eq!(range, CellRefRange::test_a1("B2:D3"));

        // Removing the end row
        range = CellRefRange::test_a1("B2:D4");
        assert!(range.removed_row(4));
        assert_eq!(range, CellRefRange::test_a1("B2:D3"));

        // Test minimum row boundary
        range = CellRefRange::test_a1("A1:B1");
        assert!(!range.removed_row(1));

        // Test when start and end become equal
        range = CellRefRange::test_a1("A1:A2");
        assert!(range.removed_row(2));
        assert_eq!(range, CellRefRange::test_a1("A1"));

        range = CellRefRange::test_a1("B:D");
        assert!(!range.removed_row(1));
    }

    #[test]
    fn test_inserted_column() {
        // Basic case - inserting a column before range
        let mut range = CellRefRange::test_a1("B1:C2");
        assert!(range.inserted_column(1));
        assert_eq!(range, CellRefRange::test_a1("C1:D2"));

        // Inserting column at start of range
        range = CellRefRange::test_a1("B1:D2");
        assert!(range.inserted_column(2));
        assert_eq!(range, CellRefRange::test_a1("C1:E2"));

        // Inserting column in middle of range
        range = CellRefRange::test_a1("B1:D2");
        assert!(range.inserted_column(3));
        assert_eq!(range, CellRefRange::test_a1("B1:E2"));

        // Inserting column at end of range
        range = CellRefRange::test_a1("B1:D2");
        assert!(range.inserted_column(4));
        assert_eq!(range, CellRefRange::test_a1("B1:E2"));

        // Inserting column after range - should not affect range
        range = CellRefRange::test_a1("B1:D2");
        assert!(!range.inserted_column(5));
        assert_eq!(range, CellRefRange::test_a1("B1:D2"));

        // Single cell reference
        range = CellRefRange::test_a1("B1");
        assert!(range.inserted_column(2));
        assert_eq!(range, CellRefRange::test_a1("C1"));

        // Single cell reference - insert after
        range = CellRefRange::test_a1("B1");
        assert!(!range.inserted_column(3));
        assert_eq!(range, CellRefRange::test_a1("B1"));

        // Testing with column-only references
        range = CellRefRange::test_a1("B:D");
        assert!(range.inserted_column(2));
        assert_eq!(range, CellRefRange::test_a1("C:E"));
    }

    #[test]
    fn test_inserted_row() {
        // Basic case - inserting a row before range
        let mut range = CellRefRange::test_a1("A2:B3");
        assert!(range.inserted_row(1));
        assert_eq!(range, CellRefRange::test_a1("A3:B4"));

        // Inserting row at start of range
        range = CellRefRange::test_a1("A2:B4");
        assert!(range.inserted_row(2));
        assert_eq!(range, CellRefRange::test_a1("A3:B5"));

        // Inserting row in middle of range
        range = CellRefRange::test_a1("A2:B4");
        assert!(range.inserted_row(3));
        assert_eq!(range, CellRefRange::test_a1("A2:B5"));

        // Inserting row at end of range
        range = CellRefRange::test_a1("A2:B4");
        assert!(range.inserted_row(4));
        assert_eq!(range, CellRefRange::test_a1("A2:B5"));

        // Inserting row after range - should not affect range
        range = CellRefRange::test_a1("A2:B4");
        assert!(!range.inserted_row(5));
        assert_eq!(range, CellRefRange::test_a1("A2:B4"));

        // Single cell reference
        range = CellRefRange::test_a1("A2");
        assert!(range.inserted_row(2));
        assert_eq!(range, CellRefRange::test_a1("A3"));

        // Single cell reference - insert after
        range = CellRefRange::test_a1("A2");
        assert!(!range.inserted_row(3));
        assert_eq!(range, CellRefRange::test_a1("A2"));

        // Testing with row-only references
        range = CellRefRange::test_a1("2:4");
        assert!(range.inserted_row(2));
        assert_eq!(range, CellRefRange::test_a1("3:5"));
    }
}
