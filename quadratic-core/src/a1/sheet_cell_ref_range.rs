//! A CellRefRange that includes a default sheet name. This is used by ranges
//! that may include multiple sheets.

use serde::{Deserialize, Serialize};

use crate::{Pos, RefAdjust, RefError, SheetPos, grid::SheetId};

use super::{A1Context, A1Error, CellRefRange, parse_optional_sheet_name_to_id};

#[derive(Serialize, Deserialize, Debug, Clone, PartialEq, Eq, Hash)]
pub struct SheetCellRefRange {
    pub sheet_id: SheetId,
    pub cells: CellRefRange,
    /// Whether the sheet name was specified explicitly.
    pub explicit_sheet_name: bool,
}

impl SheetCellRefRange {
    /// Parses a cell range reference using A1 or RC notation.
    ///
    /// Ranges without an explicit sheet use `pos.sheet_id`.
    ///
    /// This is a wrapper around [`Self::parse()`] that takes a [`SheetPos`].
    pub fn parse_at(a1: &str, pos: SheetPos, a1_context: &A1Context) -> Result<Self, A1Error> {
        Self::parse(a1, pos.sheet_id, a1_context, Some(pos.into()))
    }
    /// Parses a cell range reference using A1 notation.
    ///
    /// Ranges without an explicit sheet use `default_sheet_id`.
    ///
    /// This is a wrapper around [`Self::parse()`] that passes `base_pos: None`.
    pub fn parse_a1(
        a1: &str,
        default_sheet_id: SheetId,
        a1_context: &A1Context,
    ) -> Result<Self, A1Error> {
        Self::parse(a1, default_sheet_id, a1_context, None)
    }
    /// Parses a cell range reference using A1 or RC notation.
    ///
    /// Ranges without an explicit sheet use `default_sheet_id`.
    pub fn parse(
        a1: &str,
        default_sheet_id: SheetId,
        a1_context: &A1Context,
        base_pos: Option<Pos>,
    ) -> Result<Self, A1Error> {
        let (sheet, cells_str) = parse_optional_sheet_name_to_id(a1, a1_context)?;
        let (cells, table_sheet_id) = CellRefRange::parse(cells_str, a1_context, base_pos)?;
        Ok(Self {
            sheet_id: table_sheet_id.or(sheet).unwrap_or(default_sheet_id),
            cells,
            explicit_sheet_name: sheet.is_some(),
        })
    }

    /// Returns whether the reference needs a sheet name in order to be unambiguous.
    fn needs_sheet_name(&self, default_sheet_id: Option<SheetId>) -> bool {
        match self.cells {
            CellRefRange::Sheet { .. } => {
                self.explicit_sheet_name
                    || default_sheet_id.is_none_or(|sheet_id| sheet_id != self.sheet_id)
            }

            // table names are unique per file; only include sheet name if explicit
            CellRefRange::Table { .. } => self.explicit_sheet_name,
        }
    }

    /// Returns an A1-style string describing the range. The sheet name is
    /// included in the output only if `default_sheet_id` is `None` or differs
    /// from the ID of the sheet containing the range.
    pub fn to_a1_string(
        &self,
        default_sheet_id: Option<SheetId>,
        a1_context: &A1Context,
    ) -> String {
        if self.needs_sheet_name(default_sheet_id)
            && let Some(sheet_name) = a1_context.try_sheet_id(self.sheet_id)
        {
            return format!(
                "{}!{}",
                super::quote_sheet_name(sheet_name),
                self.cells.to_a1_string(),
            );
        }
        format!("{}", self.cells)
    }

    /// Returns an RC-style string describing the range. The sheet name is
    /// included in the output only if `default_sheet_id` is `None` or differs
    /// from the ID of the sheet containing the range.
    pub fn to_rc_string(
        &self,
        default_sheet_id: Option<SheetId>,
        a1_context: &A1Context,
        base_pos: Pos,
    ) -> String {
        if self.needs_sheet_name(default_sheet_id)
            && let Some(sheet_name) = a1_context.try_sheet_id(self.sheet_id)
        {
            return format!(
                "{}!{}",
                super::quote_sheet_name(sheet_name),
                self.cells.to_rc_string(base_pos),
            );
        }
        self.cells.to_rc_string(base_pos)
    }

    /// Adjusts coordinates by `adjust`. Returns an error if the result is out
    /// of bounds.
    #[must_use = "this method returns a new value instead of modifying its input"]
    pub fn adjust(self, adjust: RefAdjust) -> Result<Self, RefError> {
        if adjust.affects_sheet(self.sheet_id) {
            Ok(Self {
                sheet_id: self.sheet_id,
                cells: self.cells.adjust(adjust)?,
                explicit_sheet_name: self.explicit_sheet_name,
            })
        } else {
            Ok(self)
        }
    }
    /// Adjusts coordinates by `adjust`, clamping the result within the sheet
    /// bounds. Returns `None` if the whole range goes out of bounds.
    #[must_use = "this method returns a new value instead of modifying its input"]
    pub fn saturating_adjust(self, adjust: RefAdjust) -> Option<Self> {
        if adjust.affects_sheet(self.sheet_id) {
            Some(Self {
                sheet_id: self.sheet_id,
                cells: self.cells.saturating_adjust(adjust)?,
                explicit_sheet_name: self.explicit_sheet_name,
            })
        } else {
            Some(self)
        }
    }

    /// Replaces a table name in the range.
    pub fn replace_table_name(&mut self, old_name: &str, new_name: &str) {
        self.cells.replace_table_name(old_name, new_name);
    }

    /// Replaces a table column name in the range.
    pub fn replace_column_name(&mut self, table_name: &str, old_name: &str, new_name: &str) {
        self.cells
            .replace_column_name(table_name, old_name, new_name);
    }
}

#[cfg(test)]
mod tests {
    use crate::Rect;

    use super::*;

    #[test]
    fn test_table_different_sheet() {
        let sheet1_id = SheetId::TEST;
        let sheet2_id = SheetId::new();
        let context = A1Context::test(
            &[("Sheet1", sheet1_id), ("Sheet2", sheet2_id)],
            &[("Table1", &["col1", "col2", "col3"], Rect::test_a1("A1:C3"))],
        );

        // Create a table reference in Sheet 2
        let range = SheetCellRefRange::parse_a1("Table1", sheet2_id, &context).unwrap();

        // Verify the sheet ID matches Sheet 2
        assert_eq!(range.sheet_id, sheet1_id);

        assert_eq!(range.to_a1_string(None, &context), "Table1");
    }
}
