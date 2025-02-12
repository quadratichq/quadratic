//! A CellRefRange that includes a default sheet name. This is used by ranges
//! that may include multiple sheets.

use serde::{Deserialize, Serialize};

use crate::{grid::SheetId, Pos};

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
    ///
    /// If `base_pos` is `None`, then only A1 notation is accepted. If it is
    /// `Some`, then A1 and RC notation are both accepted.
    pub fn parse(
        a1: &str,
        default_sheet_id: SheetId,
        context: &A1Context,
        base_pos: Option<Pos>,
    ) -> Result<Self, A1Error> {
        let (sheet, cells_str) = parse_optional_sheet_name_to_id(a1, &default_sheet_id, context)?;
        let (cells, table_sheet_id) = CellRefRange::parse(cells_str, context, base_pos)?;
        Ok(Self {
            sheet_id: table_sheet_id.unwrap_or(sheet),
            cells,
        })
    }

    /// Returns an A1-style string describing the range. The sheet name is
    /// included in the output only if `default_sheet_id` is `None` or differs
    /// from the ID of the sheet containing the range.
    pub fn to_a1_string(
        self,
        default_sheet_id: Option<SheetId>,
        context: &A1Context,
        force_sheet_name: bool,
    ) -> String {
        if default_sheet_id.is_some_and(|sheet_id| force_sheet_name || sheet_id != self.sheet_id) {
            if let Some(sheet_name) = context.try_sheet_id(self.sheet_id) {
                return format!(
                    "{}!{}",
                    super::quote_sheet_name(sheet_name),
                    self.cells.to_a1_string(),
                );
            }
        }
        format!("{}", self.cells)
    }

    /// Returns an RC-style string describing the range. The sheet name is
    /// included in the output only if `default_sheet_id` is `None` or differs
    /// from the ID of the sheet containing the range.
    pub fn to_rc_string(
        self,
        default_sheet_id: Option<SheetId>,
        context: &A1Context,
        force_sheet_name: bool,
        base_pos: Pos,
    ) -> String {
        if default_sheet_id.is_some_and(|sheet_id| force_sheet_name || sheet_id != self.sheet_id) {
            if let Some(sheet_name) = context.try_sheet_id(self.sheet_id) {
                return format!(
                    "{}!{}",
                    super::quote_sheet_name(sheet_name),
                    self.cells.to_rc_string(base_pos),
                );
            }
        }
        format!("{}", self.cells)
    }
}

#[cfg(test)]
#[serial_test::parallel]
mod tests {
    use crate::Rect;

    use super::*;

    #[test]
    fn test_table_different_sheet() {
        let sheet1_id = SheetId::test();
        let sheet2_id = SheetId::new();
        let context = A1Context::test(
            &[("Sheet1", sheet1_id), ("Sheet2", sheet2_id)],
            &[("Table1", &["col1", "col2", "col3"], Rect::test_a1("A1:C3"))],
        );

        // Create a table reference in Sheet2
        let range = SheetCellRefRange::parse("Table1", sheet2_id, &context, None).unwrap();

        // Verify the sheet ID matches Sheet2
        assert_eq!(range.sheet_id, sheet1_id);

        assert_eq!(range.to_a1_string(None, &context, false), "Table1");
    }
}
