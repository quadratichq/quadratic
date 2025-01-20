use crate::{
    a1::{A1Context, RefRangeBounds},
    OldSelection, SheetPos, SheetRect,
};

use super::*;

impl From<OldSelection> for A1Selection {
    fn from(value: OldSelection) -> Self {
        let OldSelection {
            sheet_id,
            x,
            y,
            rects,
            rows,
            columns,
            all,
        } = value;

        let mut ranges = if all {
            vec![CellRefRange::ALL]
        } else {
            itertools::chain!(
                rows.into_iter()
                    .flatten()
                    .map(CellRefRange::new_relative_row),
                columns
                    .into_iter()
                    .flatten()
                    .map(CellRefRange::new_relative_column),
                rects
                    .into_iter()
                    .flatten()
                    .map(CellRefRange::new_relative_rect),
            )
            .collect()
        };

        if ranges.is_empty() {
            ranges.push(CellRefRange::new_relative_pos(Pos { x, y }));
        }

        Self {
            sheet_id,
            cursor: Pos { x, y },
            ranges,
        }
    }
}

impl A1Selection {
    /// Constructs a basic selection containing a single region.
    pub fn from_range(range: CellRefRange, sheet: SheetId, context: &A1Context) -> Self {
        Self {
            sheet_id: sheet,
            cursor: Self::cursor_pos_from_last_range(&range, context),
            ranges: vec![range],
        }
    }

    pub fn from_ref_range_bounds(sheet_id: SheetId, range: RefRangeBounds) -> Self {
        Self {
            sheet_id,
            cursor: range.cursor_pos_from_last_range(),
            ranges: vec![CellRefRange::Sheet { range }],
        }
    }

    /// Constructs a selection containing a single cell.
    pub fn from_single_cell(sheet_pos: SheetPos) -> Self {
        Self::from_ref_range_bounds(
            sheet_pos.sheet_id,
            RefRangeBounds::new_relative_pos(sheet_pos.into()),
        )
    }

    /// Constructs a selection containing a single rectangle.
    pub fn from_rect(sheet_rect: SheetRect) -> Self {
        Self::from_ref_range_bounds(
            sheet_rect.sheet_id,
            RefRangeBounds::new_relative_rect(sheet_rect.into()),
        )
    }

    /// Constructs a selection containing a single cell.
    pub fn from_xy(x: i64, y: i64, sheet: SheetId) -> Self {
        let sheet_id = sheet;
        Self::from_single_cell(SheetPos { x, y, sheet_id })
    }

    /// Constructs a selection all for a sheet.
    pub fn all(sheet: SheetId) -> Self {
        Self::from_ref_range_bounds(sheet, RefRangeBounds::ALL)
    }

    /// Constructs the default selection, which contains only the cell A1.
    pub fn default(sheet: SheetId) -> Self {
        Self::from_single_cell(pos![A1].to_sheet_pos(sheet))
    }

    /// Returns a test selection from the A1-string with SheetId::test().
    #[cfg(test)]
    pub fn test_a1(a1: &str) -> Self {
        Self::parse(a1, &SheetId::TEST, &A1Context::default()).unwrap()
    }

    /// Returns a test selection from the A1-string with the given sheet ID.
    #[cfg(test)]
    pub fn test_a1_sheet_id(a1: &str, sheet_id: &SheetId) -> Self {
        Self::parse(a1, sheet_id, &A1Context::default()).unwrap()
    }

    #[cfg(test)]
    pub fn test_a1_context(a1: &str, context: &A1Context) -> Self {
        Self::parse(a1, &SheetId::TEST, context).unwrap()
    }
}
