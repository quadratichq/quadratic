//! Mutation methods that insert or delete columns and rows from a selection.

use super::A1Selection;

impl A1Selection {
    /// Potentially shrinks a selection after the removal of a column.
    pub fn removed_column(&mut self, column: u64) -> bool {
        let mut changed = false;
        let mut ranges_to_delete = Vec::new();
        self.ranges.iter_mut().for_each(|range| {
            // if the range is only in the deleted column, then mark it for deletion
            if !range.end.is_some() && range.start.col.is_some_and(|col| col.coord == column) {
                ranges_to_delete.push(range.clone());
            } else {
                changed |= range.removed_column(column);
            }
        });

        // Remove the ranges that are marked for deletion
        if !ranges_to_delete.is_empty() {
            self.ranges
                .retain(|range| !ranges_to_delete.contains(range));
            changed = true;
        }
        changed
    }

    /// Potentially shrinks a selection after the removal of a row.
    pub fn removed_row(&mut self, row: u64) -> bool {
        let mut changed = false;
        self.ranges.iter_mut().for_each(|range| {
            changed |= range.removed_row(row);
        });
        changed
    }

    pub fn inserted_column(&mut self, column: u64) -> bool {
        let mut changed = false;
        self.ranges.iter_mut().for_each(|range| {
            changed |= range.inserted_column(column);
        });
        changed
    }

    pub fn inserted_row(&mut self, row: u64) -> bool {
        let mut changed = false;
        self.ranges.iter_mut().for_each(|range| {
            changed |= range.inserted_row(row);
        });
        changed
    }

    pub fn translate_in_place(&mut self, _x: i64, _y: i64) {
        unimplemented!()
    }
}

#[cfg(test)]
#[serial_test::parallel]
mod tests {
    use super::*;

    #[test]
    fn test_removed_column() {
        let mut selection = A1Selection::test("A1:B2");
        assert_eq!(selection.removed_column(1), true);
        assert_eq!(selection, A1Selection::test("A1"));

        selection = A1Selection::test("A1");
        assert_eq!(selection.removed_column(1), true);
        assert!(selection.ranges.is_empty());
    }
}
