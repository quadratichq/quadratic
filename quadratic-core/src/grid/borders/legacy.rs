use itertools::Itertools;
use serde::{Deserialize, Serialize};

use crate::grid::borders::style::{BorderStyle, CellBorderLine};

#[deprecated]
#[derive(Serialize, Deserialize, Debug, Default, Clone)]
#[cfg_attr(feature = "js", derive(ts_rs::TS))]
pub struct LegacyCellBorders {
    #[serde(skip_serializing_if = "Option::is_none")]
    pub h: Option<LegacyCellBorder>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub v: Option<LegacyCellBorder>,
}

#[deprecated]
#[derive(Serialize, Deserialize, Debug, Clone, PartialEq, Eq, Hash, Default)]
#[cfg_attr(feature = "js", derive(ts_rs::TS))]
pub struct LegacyCellBorder {
    #[serde(skip_serializing_if = "Option::is_none")]
    pub color: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none", rename = "type")]
    pub style: Option<CellBorderLine>,
}

impl LegacyCellBorder {
    fn from_border_style(style: &BorderStyle) -> Self {
        return Self {
            color: Some(style.color.as_string()),
            style: Some(style.line),
        };
    }
}
