use serde::{Deserialize, Serialize};

use crate::grid::{GridBounds, Sheet};

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

impl From<&Sheet> for SheetInfo {
    fn from(sheet: &Sheet) -> Self {
        let offsets = serde_json::to_string(&sheet.offsets).unwrap();
        Self {
            sheet_id: sheet.id.to_string(),
            name: sheet.name.clone(),
            order: sheet.order.clone(),
            color: sheet.color.clone(),
            offsets,
            bounds: sheet.bounds(false),
            bounds_without_formatting: sheet.bounds(true),
        }
    }
}
