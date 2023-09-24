use crate::{
    grid::{Column, GridBounds},
    Pos,
};

use super::Sheet;

impl Sheet {
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

    /// Returns the lower and upper bounds of a range of columns, or 'None' if the columns are empty
    ///
    /// If `ignore_formatting` is `true`, only data is considered; if it
    /// is `false`, then data and formatting are both considered.
    ///
    pub fn columns_bounds(
        &self,
        column_start: i64,
        column_end: i64,
        ignore_formatting: bool,
    ) -> Option<(i64, i64)> {
        let mut min: i64 = i64::MAX;
        let mut max: i64 = i64::MIN;
        for x in column_start..=column_end {
            if let Some(bounds) = self.column_bounds(x, ignore_formatting) {
                min = min.min(bounds.0);
                max = max.max(bounds.1);
            }
        }
        if min != i64::MAX && max != i64::MIN {
            Some((min, max))
        } else {
            None
        }
    }

    /// Returns the lower and upper bounds of a row, or `None` if the column is
    /// empty.
    ///
    /// If `ignore_formatting` is `true`, only data is considered; if it
    /// is `false`, then data and formatting are both considered.
    ///
    pub fn row_bounds(&self, row: i64, ignore_formatting: bool) -> Option<(i64, i64)> {
        let column_has_row = |(_x, column): &(&i64, &Column)| match ignore_formatting {
            true => column.has_data_in_row(row),
            false => column.has_anything_in_row(row),
        };
        let left = *self.columns.iter().find(column_has_row)?.0;
        let right = *self.columns.iter().rfind(column_has_row)?.0;
        Some((left, right))
    }

    /// Returns the lower and upper bounds of a range of rows, or 'None' if the rows are empty
    ///
    /// If `ignore_formatting` is `true`, only data is considered; if it
    /// is `false`, then data and formatting are both considered.
    ///
    pub fn rows_bounds(
        &self,
        row_start: i64,
        row_end: i64,
        ignore_formatting: bool,
    ) -> Option<(i64, i64)> {
        let mut min: i64 = i64::MAX;
        let mut max: i64 = i64::MIN;
        for y in row_start..=row_end {
            if let Some(bounds) = self.row_bounds(y, ignore_formatting) {
                min = min.min(bounds.0);
                max = max.max(bounds.1);
            }
        }
        if min != i64::MAX && max != i64::MIN {
            Some((min, max))
        } else {
            None
        }
    }
}

#[cfg(test)]
mod test {
    use crate::{
        grid::{CellAlign, GridBounds, Sheet},
        CellValue, Pos, Rect,
    };

    #[test]
    fn test_is_empty() {
        let mut sheet = Sheet::test();
        assert_eq!(sheet.is_empty(), true);

        sheet.set_cell_value(Pos { x: 0, y: 0 }, CellValue::Text(String::from("test")));
        sheet.recalculate_bounds();
        assert_eq!(sheet.is_empty(), false);

        sheet.set_cell_value(Pos { x: 0, y: 0 }, CellValue::Blank);
        sheet.recalculate_bounds();
        assert_eq!(sheet.is_empty(), true);
    }

    #[test]
    fn test_bounds() {
        let mut sheet = Sheet::test();
        assert_eq!(sheet.bounds(true), GridBounds::Empty);
        assert_eq!(sheet.bounds(false), GridBounds::Empty);

        sheet.set_cell_value(Pos { x: 0, y: 0 }, CellValue::Text(String::from("test")));
        sheet.set_formatting_value::<CellAlign>(Pos { x: 1, y: 1 }, Some(CellAlign::Center));
        sheet.recalculate_bounds();

        assert_eq!(
            sheet.bounds(true),
            GridBounds::from(Rect {
                min: Pos { x: 0, y: 0 },
                max: Pos { x: 0, y: 0 }
            })
        );

        assert_eq!(
            sheet.bounds(false),
            GridBounds::from(Rect {
                min: Pos { x: 0, y: 0 },
                max: Pos { x: 1, y: 1 }
            })
        );
    }

    #[test]
    fn test_column_bounds() {
        let mut sheet = Sheet::test();
        sheet.set_cell_value(
            Pos { x: 100, y: -50 },
            CellValue::Text(String::from("test")),
        );
        sheet.set_cell_value(Pos { x: 100, y: 80 }, CellValue::Text(String::from("test")));
        sheet.set_formatting_value::<CellAlign>(Pos { x: 100, y: 200 }, Some(CellAlign::Center));
        sheet.recalculate_bounds();

        assert_eq!(sheet.column_bounds(100, true), Some((-50, 80)));
        assert_eq!(sheet.column_bounds(100, false), Some((-50, 200)));
    }

    #[test]
    fn test_row_bounds() {
        let mut sheet = Sheet::test();
        sheet.set_cell_value(
            Pos { y: 100, x: -50 },
            CellValue::Text(String::from("test")),
        );
        sheet.set_cell_value(Pos { y: 100, x: 80 }, CellValue::Text(String::from("test")));
        sheet.set_formatting_value::<CellAlign>(Pos { y: 100, x: 200 }, Some(CellAlign::Center));
        sheet.recalculate_bounds();

        assert_eq!(sheet.row_bounds(100, true), Some((-50, 80)));
        assert_eq!(sheet.row_bounds(100, false), Some((-50, 200)));
    }

    #[test]
    fn test_columns_bounds() {
        let mut sheet = Sheet::test();

        sheet.set_cell_value(
            Pos { x: 100, y: -50 },
            CellValue::Text(String::from("test")),
        );
        sheet.set_cell_value(Pos { x: 100, y: 80 }, CellValue::Text(String::from("test")));
        sheet.set_formatting_value::<CellAlign>(Pos { x: 100, y: 200 }, Some(CellAlign::Center));

        // set negative values
        sheet.set_cell_value(
            Pos { x: -100, y: -50 },
            CellValue::Text(String::from("test")),
        );
        sheet.set_cell_value(
            Pos { x: -100, y: -80 },
            CellValue::Text(String::from("test")),
        );
        sheet.set_formatting_value::<CellAlign>(Pos { x: -100, y: -200 }, Some(CellAlign::Center));
        sheet.recalculate_bounds();

        assert_eq!(sheet.columns_bounds(0, 100, true), Some((-50, 80)));
        assert_eq!(sheet.columns_bounds(0, 100, false), Some((-50, 200)));

        assert_eq!(sheet.columns_bounds(-100, 100, true), Some((-80, 80)));
        assert_eq!(sheet.columns_bounds(-100, 100, false), Some((-200, 200)));
    }

    #[test]
    fn test_rows_bounds() {
        let mut sheet = Sheet::test();

        sheet.set_cell_value(
            Pos { y: 100, x: -50 },
            CellValue::Text(String::from("test")),
        );
        sheet.set_cell_value(Pos { y: 100, x: 80 }, CellValue::Text(String::from("test")));
        sheet.set_formatting_value::<CellAlign>(Pos { y: 100, x: 200 }, Some(CellAlign::Center));

        // set negative values
        sheet.set_cell_value(
            Pos { y: -100, x: -50 },
            CellValue::Text(String::from("test")),
        );
        sheet.set_cell_value(
            Pos { y: -100, x: -80 },
            CellValue::Text(String::from("test")),
        );
        sheet.set_formatting_value::<CellAlign>(Pos { y: -100, x: -200 }, Some(CellAlign::Center));
        sheet.recalculate_bounds();

        assert_eq!(sheet.rows_bounds(0, 100, true), Some((-50, 80)));
        assert_eq!(sheet.rows_bounds(0, 100, false), Some((-50, 200)));

        assert_eq!(sheet.rows_bounds(-100, 100, true), Some((-80, 80)));
        assert_eq!(sheet.rows_bounds(-100, 100, false), Some((-200, 200)));
    }
}
