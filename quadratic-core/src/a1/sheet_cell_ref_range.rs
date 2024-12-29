//! A CellRefRange that also might include a sheet name. This is used by ranges
//! that may include multiple sheets.

use serde::{Deserialize, Serialize};

use crate::grid::SheetId;

use super::{parse_optional_sheet_name_to_id, A1Context, A1Error, CellRefRange};

#[derive(Serialize, Deserialize, Debug, Clone, PartialEq, Eq, Hash)]
pub struct SheetCellRefRange {
    pub sheet_id: SheetId,
    pub cells: CellRefRange,
}

impl SheetCellRefRange {
    /// Parses a selection from a comma-separated list of ranges.
    ///
    /// Ranges without an explicit sheet use `default_sheet_id`.
    pub fn parse(
        a1: &str,
        default_sheet_id: &SheetId,
        context: &A1Context,
    ) -> Result<Self, A1Error> {
        let (sheet, cells_str) = parse_optional_sheet_name_to_id(a1, default_sheet_id, context)?;
        let cells = CellRefRange::parse(cells_str, context)?;
        Ok(Self {
            sheet_id: sheet,
            cells,
        })
    }

    /// Returns an A1-style string describing the range. The sheet name is
    /// included in the output only if `default_sheet_id` is `None` or differs
    /// from the ID of the sheet containing the range.
    pub fn to_string(self, default_sheet_id: Option<SheetId>, context: &A1Context) -> String {
        if default_sheet_id.is_some_and(|sheet_id| sheet_id != self.sheet_id) {
            if let Some(sheet_name) = context.try_sheet_id(self.sheet_id) {
                return format!("{}!{}", super::quote_sheet_name(&sheet_name), self.cells);
            }
        }
        format!("{}", self.cells)
    }
}
