mod a1_error;
mod a1_part;
pub(crate) mod a1_parts;
mod a1_sheet_name;
mod a1_to_a1;

use crate::Pos;
pub use a1_error::A1Error;
pub use a1_part::*;
pub use a1_parts::A1Parts;
pub use a1_sheet_name::SheetNameIdMap;

#[derive(Debug)]
pub struct A1 {}

impl A1 {
    /// Helper function to convert an A1 string to a Pos
    pub fn try_from_pos(a1: &str) -> Option<Pos> {
        if a1.contains(" ") || a1.contains("!") {
            return None;
        }
        if let Ok(rel_pos) = A1Part::try_from_position(a1) {
            rel_pos.map(|rel_pos| rel_pos.into())
        } else {
            None
        }
    }

    /// Get a column from an A1 string and automatically unwrap it (only used
    /// for tests).
    #[cfg(test)]
    pub fn column(a1_column: &str) -> i64 {
        A1Part::try_from_column(a1_column).unwrap().index as i64
    }
}
