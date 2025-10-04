use crate::a1::A1Context;

use super::A1Selection;

impl A1Selection {
    /// Deletes the selection from the current selection. Returns the remaining
    /// selection or None if the selection is completely deleted.
    pub(crate) fn delete_selection(
        &self,
        to_delete: &A1Selection,
        a1_context: &A1Context,
    ) -> Option<A1Selection> {
        let mut ranges = Vec::new();
        for range in self.ranges.iter() {
            let mut last_ranges = vec![range.clone()];
            for selection_range in to_delete.ranges.iter() {
                let mut next_ranges = Vec::new();
                for current_range in last_ranges.iter() {
                    next_ranges.extend(current_range.delete_range(selection_range, a1_context));
                }
                last_ranges = next_ranges;
            }
            ranges.extend(last_ranges);
        }

        if ranges.is_empty() {
            None
        } else {
            Some(A1Selection {
                ranges,
                ..self.clone()
            })
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::test_util::*;

    #[test]
    fn test_delete_selection_basic() {
        let gc = test_create_gc();
        let a1_context = gc.a1_context();

        // Create a selection A1:C3
        let selection = A1Selection::test_a1("A1:C3");

        // Delete A2:B2 from it
        let delete = A1Selection::test_a1("A2:B2");
        let result = selection.delete_selection(&delete, a1_context).unwrap();

        assert_eq!(result.ranges.len(), 3);
        assert_eq!(result.ranges[0].to_string(), "A1:C1");
        assert_eq!(result.ranges[1].to_string(), "A3:C3");
        assert_eq!(result.ranges[2].to_string(), "C2");
    }

    #[test]
    fn test_delete_selection_complete() {
        let gc = test_create_gc();
        let a1_context = gc.a1_context();

        // Create a selection A1:C3
        let selection = A1Selection::test_a1("A1:C3");

        // Delete the entire selection
        let delete = A1Selection::test_a1("A1:C3");
        let result = selection.delete_selection(&delete, a1_context);

        // Should return None since entire selection was deleted
        assert!(result.is_none());
    }

    #[test]
    fn test_delete_selection_table() {
        let mut gc = test_create_gc();
        let sheet_id = first_sheet_id(&gc);

        // Create a data table
        test_create_data_table(&mut gc, sheet_id, pos![A1], 3, 3);

        let a1_context = gc.a1_context();

        // Create a selection that includes the table
        let selection = A1Selection::test_a1("A1:C3");

        // Delete a portion of the table
        let delete = A1Selection::test_a1("B2");
        let result = selection.delete_selection(&delete, a1_context).unwrap();

        // Should result in multiple ranges excluding B2
        assert_eq!(result.ranges.len(), 4);
        assert_eq!(result.ranges[0].to_string(), "A1:C1");
        assert_eq!(result.ranges[1].to_string(), "A3:C3");
        assert_eq!(result.ranges[2].to_string(), "A2");
        assert_eq!(result.ranges[3].to_string(), "C2");
    }

    #[test]
    fn test_delete_selection_multiple_ranges() {
        let gc = test_create_gc();
        let a1_context = gc.a1_context();

        // Create a selection with multiple ranges
        let selection = A1Selection::test_a1("A1:C3,D1:F3");

        // Delete portions from both ranges
        let delete = A1Selection::test_a1("B2,E2");
        let result = selection.delete_selection(&delete, a1_context).unwrap();

        // Should result in multiple ranges excluding B2 and E2
        assert_eq!(result.ranges.len(), 8);
        assert_eq!(result.ranges[0].to_string(), "A1:C1");
        assert_eq!(result.ranges[1].to_string(), "A3:C3");
        assert_eq!(result.ranges[2].to_string(), "A2");
        assert_eq!(result.ranges[3].to_string(), "C2");
        assert_eq!(result.ranges[4].to_string(), "D1:F1");
        assert_eq!(result.ranges[5].to_string(), "D3:F3");
        assert_eq!(result.ranges[6].to_string(), "D2");
        assert_eq!(result.ranges[7].to_string(), "F2");
    }

    #[test]
    fn test_delete_selection_partial_table() {
        let mut gc = test_create_gc();
        let sheet_id = first_sheet_id(&gc);

        // Create a data table
        test_create_data_table(&mut gc, sheet_id, pos![A1], 3, 3);

        let selection = A1Selection::test_a1_context("test_table[Column 1]", gc.a1_context());

        // Delete a portion that overlaps with the table
        let delete = A1Selection::test_a1("A3");
        let result = selection
            .delete_selection(&delete, gc.a1_context())
            .unwrap();

        // Should result in multiple ranges excluding C3
        assert_eq!(result.ranges.len(), 1);
        assert_eq!(result.ranges[0].to_string(), "A4:A5");
    }

    #[test]
    fn test_delete_selection_table_table() {
        let mut gc = test_create_gc();
        let sheet_id = first_sheet_id(&gc);

        test_create_data_table(&mut gc, sheet_id, pos![A1], 3, 3);

        let selection = A1Selection::test_a1_context("test_table[Column 1]", gc.a1_context());

        let delete = A1Selection::test_a1_context("test_table[Column 1]", gc.a1_context());
        let result = selection.delete_selection(&delete, gc.a1_context());

        assert!(result.is_none());
    }
}
