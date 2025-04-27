use crate::a1::A1Context;

use super::A1Selection;

impl A1Selection {
    /// Deletes the selection from the current selection. Returns the remaining
    /// selection or None if the selection is completely deleted.
    pub fn delete_selection(
        &self,
        selection: &A1Selection,
        a1_context: &A1Context,
    ) -> Option<A1Selection> {
        let mut ranges = Vec::new();
        for range in self.ranges.iter() {
            selection.ranges.iter().for_each(|selection_range| {
                ranges.extend(range.delete_range(selection_range, a1_context));
            });
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
