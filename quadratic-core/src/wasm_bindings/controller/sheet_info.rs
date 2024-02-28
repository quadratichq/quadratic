use serde::{Deserialize, Serialize};

use crate::grid::GridBounds;

#[derive(Serialize, Deserialize)]
#[cfg_attr(feature = "js", derive(ts_rs::TS))]
pub struct SheetInfo {
    pub sheet_id: String,
    pub name: String,
    pub order: String,
    pub color: Option<String>,
    pub offsets: String,
    pub bounds: GridBounds,
    pub bounds_without_formatting: GridBounds,
}
