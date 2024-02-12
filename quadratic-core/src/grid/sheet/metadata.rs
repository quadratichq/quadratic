use crate::{sheet_offsets::SheetOffsets, Rect};

use super::Sheet;

impl Sheet {
    /// Exports all sheet metadata for use by the client and workers.
    pub fn metadata(&self) -> (SheetOffsets, Option<Rect>, Option<Rect>) {
        (
            self.offsets.clone(),
            self.data_bounds.into(),
            self.format_bounds.into(),
        )
    }
}
