//! Merge cells horizontally, vertically, or both.
//!
//! Internally, we keep a list of RefRangeBounds that allows unbounded merges.
//! Note: we do not use CellRefRange b/c we do not want want merges to be
//! dynamic--ie, if you change a named range, you would not want the merged
//! cells to change automatically.
//!
//! Note: cursor selection will always expand to include the full scope of
//! merged cells. This is in line with competitor's implementations and is
//! probably to ensure you can't merge cells into non-rectangular shapes.

use serde::{Deserialize, Serialize};
use ts_rs::TS;

use crate::RefRangeBounds;

pub mod merge_col_row;
pub mod merge_sheet;

#[derive(Default, Serialize, Deserialize, Debug, Clone, PartialEq)]
pub struct MergeCells {
    pub ranges: Vec<RefRangeBounds>,
}

#[derive(Default, Serialize, Deserialize, Debug, Clone, PartialEq, TS)]
pub enum MergeResult {
    #[default]
    Ok,
    HasMoreThanOneData,
    OverlappingRanges,
}
