use serde::{Deserialize, Serialize};

use crate::grid::borders::style::CellBorderLine;

#[derive(Serialize, Deserialize, Debug, Default, Clone)]
#[cfg_attr(feature = "js", derive(ts_rs::TS))]
pub struct LegacyCellBorders {
    #[serde(skip_serializing_if = "Option::is_none")]
    pub h: Option<LegacyCellBorder>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub v: Option<LegacyCellBorder>,
}

#[derive(Serialize, Deserialize, Debug, Clone, PartialEq, Eq, Hash, Default)]
#[cfg_attr(feature = "js", derive(ts_rs::TS))]
pub struct LegacyCellBorder {
    #[serde(skip_serializing_if = "Option::is_none")]
    pub color: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none", rename = "type")]
    pub style: Option<CellBorderLine>,
}
