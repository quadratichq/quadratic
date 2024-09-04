use serde::{Deserialize, Serialize};
use std::collections::HashMap;

use crate::grid::{block::SameValue, ColumnData};
pub use borders_style::*;

pub mod borders_bounds;
pub mod borders_clipboard;
pub mod borders_get;
pub mod borders_render;
pub mod borders_set;
pub mod borders_style;

#[cfg(test)]
pub mod borders_test;

#[derive(Default, Serialize, Deserialize, Debug, Clone, PartialEq)]
pub struct Borders {
    // sheet-wide formatting
    pub(crate) all: BorderStyleCell,
    pub(crate) columns: HashMap<i64, BorderStyleCell>,
    pub(crate) rows: HashMap<i64, BorderStyleCell>,

    // cell-specific formatting (vertical)
    pub(crate) left: HashMap<i64, ColumnData<SameValue<BorderStyleTimestamp>>>,
    pub(crate) right: HashMap<i64, ColumnData<SameValue<BorderStyleTimestamp>>>,

    // cell-specific formatting (horizontal); note: this ColumnData is
    // actually row-based data
    pub(crate) top: HashMap<i64, ColumnData<SameValue<BorderStyleTimestamp>>>,
    pub(crate) bottom: HashMap<i64, ColumnData<SameValue<BorderStyleTimestamp>>>,
}
