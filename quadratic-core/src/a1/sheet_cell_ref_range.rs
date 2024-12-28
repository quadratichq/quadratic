use serde::{Deserialize, Serialize};

use crate::grid::{SheetId, TableMap};

use super::{A1Error, CellRefRange, SheetNameIdMap};

#[derive(Serialize, Deserialize, Debug, Clone, PartialEq, Eq, Hash)]
pub struct SheetCellRefRange {
    pub sheet: SheetId,
    pub cells: CellRefRange,
}

impl SheetCellRefRange {
    /// Parses a selection from a comma-separated list of ranges.
    ///
    /// Ranges without an explicit sheet use `default_sheet_id`.
    pub fn parse(
        a1: &str,
        default_sheet_id: &SheetId,
        sheet_map: &SheetNameIdMap,
        table_map: &TableMap,
    ) -> Result<Self, A1Error> {
        let (sheet, cells_str) =
            super::parse_optional_sheet_name_to_id(a1, default_sheet_id, sheet_map)?;
        let cells = CellRefRange::parse(cells_str, table_map)?;
        Ok(Self { sheet, cells })
    }

    /// Returns an A1-style string describing the range. The sheet name is
    /// included in the output only if `default_sheet_id` is `None` or differs
    /// from the ID of the sheet containing the range.
    pub fn to_string(
        self,
        default_sheet_id: Option<SheetId>,
        sheet_map: &SheetNameIdMap,
    ) -> String {
        if default_sheet_id.is_some_and(|it| it != self.sheet) {
            let sheet_name = sheet_map
                .iter()
                .find(|(_, id)| **id == self.sheet)
                .map(|(name, _)| name.clone())
                .unwrap_or(super::UNKNOWN_SHEET_NAME.to_string());
            format!("{}!{}", super::quote_sheet_name(&sheet_name), self.cells)
        } else {
            format!("{}", self.cells)
        }
    }
}
