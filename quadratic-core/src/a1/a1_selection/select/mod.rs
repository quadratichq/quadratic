mod column_row;
mod helpers;
mod keyboard;
mod mouse;

#[cfg(test)]
mod tests;

use crate::a1::{A1Context, RefRangeBounds};
use crate::{Pos, Rect};

use super::{A1Selection, CellRefRange};

impl A1Selection {
    pub fn select_rect(&mut self, left: i64, top: i64, right: i64, bottom: i64, append: bool) {
        let range = RefRangeBounds::new_relative_rect(Rect::new(left, top, right, bottom));
        if append {
            self.ranges.push(CellRefRange::Sheet { range });
        } else {
            self.ranges.clear();
            self.ranges.push(CellRefRange::Sheet { range });
        }
        self.cursor.x = left;
        self.cursor.y = top;
    }

    pub fn move_to(&mut self, x: i64, y: i64, append: bool) {
        if append {
            self.ranges
                .push(CellRefRange::new_relative_pos(Pos::new(x, y)));
        } else {
            self.ranges.clear();
            self.ranges
                .push(CellRefRange::new_relative_pos(Pos::new(x, y)));
        }
        self.cursor.x = x;
        self.cursor.y = y;
    }

    /// Helper to convert last range to RefRangeBounds (for set_columns_selected and set_rows_selected)
    fn last_range_to_bounds(&self, a1_context: &A1Context) -> Option<RefRangeBounds> {
        let last = self.ranges.last()?;
        match last {
            CellRefRange::Sheet { range } => Some(*range),
            CellRefRange::Table { range } => {
                range.convert_to_ref_range_bounds(false, a1_context, false, false)
            }
        }
    }

    pub fn append_selection(&self, other: &Self) -> Self {
        let mut ranges = self.ranges.clone();
        ranges.extend(other.ranges.iter().cloned());
        Self {
            sheet_id: self.sheet_id,
            cursor: self.cursor,
            ranges,
        }
    }

    /// Selects the entire sheet. (Note: doesn't check whether the SheetId
    /// exists, only if it is valid)
    pub fn select_sheet(&mut self, sheet_id: String) -> Result<(), String> {
        self.sheet_id = SheetId::from_str(&sheet_id).map_err(|e| e.to_string())?;
        self.ranges.clear();
        self.ranges.push(CellRefRange::ALL);
        Ok(())
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_select_sheet() {
        let mut selection = A1Selection::default(SheetId::TEST);
        selection.select_sheet(SheetId::TEST.to_string()).unwrap();
        assert_eq!(selection.ranges, vec![CellRefRange::ALL]);
        assert_eq!(selection.sheet_id, SheetId::TEST);
    }
}
