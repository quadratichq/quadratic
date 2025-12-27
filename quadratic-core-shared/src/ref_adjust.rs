use std::ops::RangeInclusive;

use crate::SheetId;

/// Adjustment to make to the coordinates of cell references in code cells.
///
/// Unbounded coordinates are always unmodified.
#[derive(Debug, Copy, Clone, PartialEq, Eq, Hash)]
pub struct RefAdjust {
    /// If specified, then only references to this sheet will be adjusted. If
    /// `None`, then all references will be adjusted.
    pub sheet_id: Option<SheetId>,

    /// Whether to translate only relative references.
    ///
    /// If this is false, then relative and absolute references are both
    /// translated.
    pub relative_only: bool,

    /// Offset to add to each X coordinate.
    pub dx: i64,
    /// Offset to add to each Y coordinate.
    pub dy: i64,

    /// Column before which coordinates should remain unmodified, or 0 if all
    /// columns should be affected.
    ///
    /// This is used when adding/removing a column.
    pub x_start: i64,
    /// Row before which coordinates should remain unmodified, or 0 if all rows
    /// should be affected.
    ///
    /// This is used when adding/removing a row.
    pub y_start: i64,
}
impl RefAdjust {
    /// Adjustment with no effect.
    pub const NO_OP: Self = Self {
        sheet_id: None,
        relative_only: false,
        dx: 0,
        dy: 0,
        x_start: 0,
        y_start: 0,
    };

    /// Returns whether the adjustment has no effect.
    pub fn is_no_op(self) -> bool {
        self.dx == 0 && self.dy == 0
    }

    /// Returns whether the adjustment affects a sheet.
    pub fn affects_sheet(self, sheet_id: SheetId) -> bool {
        self.sheet_id.is_none_or(|id| id == sheet_id)
    }

    /// Constructs an adjustment for inserting a column.
    pub fn new_insert_column(sheet_id: SheetId, column: i64) -> Self {
        Self::new_insert_columns(sheet_id, column..=column)
    }
    /// Constructs an adjustment for deleting a column.
    pub fn new_delete_column(sheet_id: SheetId, column: i64) -> Self {
        Self::new_delete_columns(sheet_id, column..=column)
    }
    /// Constructs an adjustment for inserting a row.
    pub fn new_insert_row(sheet_id: SheetId, row: i64) -> Self {
        Self::new_insert_rows(sheet_id, row..=row)
    }
    /// Constructs an adjustment for deleting a row.
    pub fn new_delete_row(sheet_id: SheetId, row: i64) -> Self {
        Self::new_delete_rows(sheet_id, row..=row)
    }

    /// Constructs an adjustment for inserting multiple columns at once.
    pub fn new_insert_columns(sheet_id: SheetId, range: RangeInclusive<i64>) -> Self {
        Self {
            sheet_id: Some(sheet_id),
            relative_only: false,
            x_start: *range.start(),
            dx: range.count() as i64,
            ..Self::NO_OP
        }
    }
    /// Constructs an adjustment for deleting multiple columns at once.
    pub fn new_delete_columns(sheet_id: SheetId, range: RangeInclusive<i64>) -> Self {
        Self {
            sheet_id: Some(sheet_id),
            relative_only: false,
            x_start: *range.start(),
            dx: -(range.count() as i64),
            ..Self::NO_OP
        }
    }
    /// Constructs an adjustment for inserting multiple rows at once.
    pub fn new_insert_rows(sheet_id: SheetId, range: RangeInclusive<i64>) -> Self {
        Self {
            sheet_id: Some(sheet_id),
            relative_only: false,
            y_start: *range.start(),
            dy: range.count() as i64,
            ..Self::NO_OP
        }
    }
    /// Constructs an adjustment for deleting multiple rows at once.
    pub fn new_delete_rows(sheet_id: SheetId, range: RangeInclusive<i64>) -> Self {
        Self {
            sheet_id: Some(sheet_id),
            relative_only: false,
            y_start: *range.start(),
            dy: -(range.count() as i64),
            ..Self::NO_OP
        }
    }

    /// Constructs a simple translation that applies to all non -ve references.
    pub fn new_translate(dx: i64, dy: i64) -> Self {
        Self {
            relative_only: false,
            dx,
            dy,
            ..Self::NO_OP
        }
    }

    /// Constructs a simple translation that applies to all references greater than or equal to the start.
    pub fn new_translate_with_start(dx: i64, dy: i64, x_start: i64, y_start: i64) -> Self {
        Self {
            sheet_id: None,
            relative_only: false,
            dx,
            dy,
            x_start,
            y_start,
        }
    }
}
