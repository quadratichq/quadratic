use crate::{grid::Sheet, A1Selection};

use super::MergeResult;

impl Sheet {
    /// Returns true if there is more than one data entry within any of the
    /// selection areas.
    pub fn check_merge(&self, selection: A1Selection) -> MergeResult {
        for range in selection.iter_ranges() {
            let rect = self.cell_ref_range_to_rect(*range, true);
            if self.has_more_than_one_data_in_rect(rect) {
                return MergeResult::HasMoreThanOneData;
            }
        }
        MergeResult::Ok
    }

    pub fn merge(&mut self, selection: A1Selection) {
        // we cannot merge if there are overlapping ranges (this can happen if a
        // named range changes before the operation is executed)
        if self.check_merge(selection) == MergeResult::OverlappingRanges {
            return;
        };
    }
}
