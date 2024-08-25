use serde::{Deserialize, Serialize};
use ts_rs::TS;

use crate::grid::{GridBounds, Sheet};

#[derive(Serialize, Deserialize, TS)]
pub struct SheetInfo {
    pub sheet_id: String,
    pub name: String,
    pub order: String,
    pub color: Option<String>,
    pub offsets: String,
    pub bounds: GridBounds,
    pub bounds_without_formatting: GridBounds,
    pub visible_bounds: Option<(i64, i64)>,
}

impl From<&Sheet> for SheetInfo {
    fn from(sheet: &Sheet) -> Self {
        let offsets = serde_json::to_string(&sheet.offsets).unwrap_or("".to_string());
        Self {
            sheet_id: sheet.id.to_string(),
            name: sheet.name.clone(),
            order: sheet.order.clone(),
            color: sheet.color.clone(),
            offsets,
            bounds: sheet.bounds(false),
            bounds_without_formatting: sheet.bounds(true),
            visible_bounds: sheet.visible_bounds,
        }
    }
}

#[derive(Serialize, Deserialize)]
#[cfg_attr(feature = "js", derive(ts_rs::TS))]
pub struct SheetBounds {
    pub sheet_id: String,
    pub bounds: GridBounds,
    pub bounds_without_formatting: GridBounds,
}

impl From<&Sheet> for SheetBounds {
    fn from(sheet: &Sheet) -> Self {
        Self {
            sheet_id: sheet.id.to_string(),
            bounds: sheet.bounds(false),
            bounds_without_formatting: sheet.bounds(true),
        }
    }
}

#[cfg(test)]
mod tests {
    use serial_test::parallel;

    use crate::grid::{GridBounds, Sheet, SheetId};

    #[test]
    #[parallel]
    fn sheet_info() {
        let mut sheet = Sheet::new(SheetId::test(), "test name".to_string(), "A0".to_string());
        sheet.color = Some("red".to_string());
        sheet.visible_bounds = Some((10, 10));
        let sheet_info = crate::wasm_bindings::controller::SheetInfo::from(&sheet);
        assert_eq!(sheet_info.sheet_id, SheetId::test().to_string());
        assert_eq!(sheet_info.name, "test name");
        assert_eq!(sheet_info.order, "A0");
        assert_eq!(sheet_info.color, Some("red".to_string()));
        assert_eq!(sheet_info.offsets, "{\"column_widths\":{\"default\":100.0,\"sizes\":{}},\"row_heights\":{\"default\":21.0,\"sizes\":{}},\"thumbnail\":[13,35]}");
        assert_eq!(sheet_info.bounds, GridBounds::default());
        assert_eq!(
            sheet_info.bounds_without_formatting,
            crate::grid::GridBounds::default()
        );
        assert_eq!(sheet_info.visible_bounds, Some((10, 10)));
    }
}
