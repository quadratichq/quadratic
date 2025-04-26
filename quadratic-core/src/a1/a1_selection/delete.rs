use crate::a1::A1Context;

use super::A1Selection;

impl A1Selection {
    /// Deletes the selection from the current selection. Returns the remaining
    /// selection or None if the selection is completely deleted.
    pub fn delete(
        &mut self,
        selection: &A1Selection,
        a1_context: &A1Context,
    ) -> Option<A1Selection> {
        // let ranges = self.ranges.iter().filter_map(|range| {
        //     if let Some(remaining) = range.delete(selection, a1_context) {
        //         Some(remaining)
        //     } else {
        //         None
        //     }
        // });
        // if ranges.is_empty() {
        //     None
        // } else {
        //     Some(A1Selection {
        //         ranges,
        //         ..self.clone()
        //     })
        // }
        None
    }
}
