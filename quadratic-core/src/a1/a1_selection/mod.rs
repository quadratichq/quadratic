use serde::{Deserialize, Serialize};
use ts_rs::TS;

use crate::{Pos, grid::SheetId};

use super::CellRefRange;

mod create;
mod delete;
mod display;
mod exclude;
mod intersects;
mod merge_cells;
mod mutate;
mod parse;
mod query;
pub(crate) mod select;
mod select_table;

/// Maximum number of columns that can be parsed in a column name.
pub const MAX_COLUMNS: i64 = 5000000;

#[derive(Serialize, Deserialize, Clone, PartialEq, Eq, TS)]
#[cfg_attr(test, derive(proptest_derive::Arbitrary))]
pub struct A1Selection {
    /// Current sheet.
    ///
    /// Selections can only span a single sheet.
    #[cfg_attr(test, proptest(value = "SheetId::TEST"))]
    pub sheet_id: SheetId,
    /// Cursor position, which is moved using the arrow keys (while not holding
    /// shift).
    ///
    /// This always coincides with the start of the last range in `ranges`, but
    /// in the case of an infinite selection it contains information that cannot
    /// be inferred from `ranges`.
    pub cursor: Pos,
    /// Selected ranges (union).
    ///
    /// The cursor selection must always contain at least one range, and the
    /// last range can be manipulated using the arrow keys.
    ///
    /// The `start` of the last range is where the cursor outline is drawn, and
    /// can be moved by pressing arrow keys without holding the shift key.
    ///
    /// The `end` of the last range can be moved by pressing arrow keys while
    /// holding the shift key.
    pub ranges: Vec<CellRefRange>,
}
