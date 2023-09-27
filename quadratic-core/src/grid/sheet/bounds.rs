use crate::{
    grid::{Column, GridBounds},
    Pos,
};

use super::Sheet;

impl Sheet {
    /// Returns the bounds of the sheet.
    ///
    /// If `ignore_formatting` is `true`, only data is considered; if it is
    /// `false`, then data and formatting are both considered.
    pub fn bounds(&self, ignore_formatting: bool) -> GridBounds {
        match ignore_formatting {
            true => self.data_bounds,
            false => GridBounds::merge(self.data_bounds, self.format_bounds),
        }
    }
    /// Returns the lower and upper bounds of a column, or `None` if the column
    /// is empty.
    ///
    /// If `ignore_formatting` is `true`, only data is considered; if it is
    /// `false`, then data and formatting are both considered.
    pub fn column_bounds(&self, column: i64, ignore_formatting: bool) -> Option<(i64, i64)> {
        let column = self.columns.get(&column)?;
        let range = column.range(ignore_formatting)?;
        Some((range.start, range.end - 1))
    }

    /// Returns the lower and upper bounds of a row, or `None` if the column is
    /// empty.
    ///
    /// If `ignore_formatting` is `true`, only data is considered; if it
    /// is `false`, then data and formatting are both considered.
    pub fn row_bounds(&self, y: i64, ignore_formatting: bool) -> Option<(i64, i64)> {
        let column_has_row = |(_x, column): &(&i64, &Column)| match ignore_formatting {
            true => column.has_anything_in_row(y),
            false => column.has_data_in_row(y),
        };
        let left = *self.columns.iter().find(column_has_row)?.0;
        let right = *self.columns.iter().rfind(column_has_row)?.0;
        Some((left, right))
    }

    /// Recalculates all bounds of the sheet.
    ///
    /// This should be called whenever data in the sheet is modified.
    pub fn recalculate_bounds(&mut self) {
        self.data_bounds.clear();
        self.format_bounds.clear();

        for (&x, column) in &self.columns {
            if let Some(data_range) = column.range(true) {
                let y = data_range.start;
                self.data_bounds.add(Pos { x, y });
                let y = data_range.end - 1;
                self.data_bounds.add(Pos { x, y });
            }
            if let Some(format_range) = column.range(false) {
                let y = format_range.start;
                self.format_bounds.add(Pos { x, y });
                let y = format_range.end - 1;
                self.format_bounds.add(Pos { x, y });
            }
        }
    }

    /// Returns whether the sheet is completely empty.
    pub fn is_empty(&self) -> bool {
        self.data_bounds.is_empty() && self.format_bounds.is_empty()
    }
}
