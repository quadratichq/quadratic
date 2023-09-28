use crate::{
    grid::{Column, GridBounds},
    CellValue, Pos,
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
        let mut found = false;
        for x in column_start..=column_end {
            if let Some(bounds) = self.column_bounds(x, ignore_formatting) {
                min = min.min(bounds.0);
                max = max.max(bounds.1);
                found = true;
            }
        }
        if found {
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
        let mut found = false;
        for y in row_start..=row_end {
            if let Some(bounds) = self.row_bounds(y, ignore_formatting) {
                min = min.min(bounds.0);
                max = max.max(bounds.1);
                found = true;
            }
        }
        if found {
            Some((min, max))
        } else {
            None
        }
    }

    /// finds the nearest column with or without content
    /// if reverse is true it searches to the left of the start
    /// if with_content is true it searches for a column with content; otherwise it searches for a column without content
    ///
    /// Returns the found column or column_start
    pub fn find_next_column(
        &self,
        column_start: i64,
        row: i64,
        reverse: bool,
        with_content: bool,
    ) -> i64 {
        let bounds = self.bounds(true);
        if bounds.is_empty() {
            return column_start;
        }
        match bounds {
            GridBounds::Empty => column_start,
            GridBounds::NonEmpty(rect) => {
                let mut x = if reverse {
                    column_start.min(rect.max.x)
                } else {
                    column_start.max(rect.min.x)
                };
                while x >= rect.min.x && x <= rect.max.x {
                    let has_content = self.get_cell_value(Pos { x, y: row });
                    if has_content.is_some_and(|cell_value| cell_value != CellValue::Blank) {
                        if with_content {
                            return x;
                        }
                    } else if !with_content {
                        return x;
                    }
                    x += if reverse { -1 } else { 1 };
                }
                x
            }
        }
    }

    /// finds the next column with or without content
    /// if reverse is true it searches to the left of the start
    /// if with_content is true it searches for a column with content; otherwise it searches for a column without content
    ///
    /// Returns the found column or row_start
    pub fn find_next_row(
        &self,
        row_start: i64,
        column: i64,
        reverse: bool,
        with_content: bool,
    ) -> i64 {
        let bounds = self.bounds(true);
        if bounds.is_empty() {
            return row_start;
        }
        match bounds {
            GridBounds::Empty => row_start,
            GridBounds::NonEmpty(rect) => {
                let mut y = if reverse {
                    row_start.min(rect.max.y)
                } else {
                    row_start.max(rect.min.y)
                };
                while y >= rect.min.y && y <= rect.max.y {
                    let has_content = self.get_cell_value(Pos { x: column, y });
                    if has_content.is_some_and(|cell_value| cell_value != CellValue::Blank) {
                        if with_content {
                            return y;
                        }
                    } else if !with_content {
                        return y;
                    }
                    y += if reverse { -1 } else { 1 };
                }
                y
            }
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

        assert_eq!(sheet.columns_bounds(1000, 2000, true), None);
        assert_eq!(sheet.columns_bounds(1000, 2000, false), None);

        assert_eq!(sheet.columns_bounds(1000, 1000, true), None);
        assert_eq!(sheet.columns_bounds(1000, 1000, false), None);
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

        assert_eq!(sheet.rows_bounds(1000, 2000, true), None);
        assert_eq!(sheet.rows_bounds(1000, 2000, false), None);

        assert_eq!(sheet.rows_bounds(1000, 1000, true), None);
        assert_eq!(sheet.rows_bounds(1000, 1000, false), None);
    }

    #[test]
    fn test_find_next_column() {
        let mut sheet = Sheet::test();

        sheet.set_cell_value(Pos { x: 1, y: 2 }, CellValue::Text(String::from("test")));
        sheet.recalculate_bounds();

        assert_eq!(sheet.find_next_column(-1, 2, false, true), 1);
        assert_eq!(sheet.find_next_column(3, 2, true, true), 1);
        assert_eq!(sheet.find_next_column(2, 2, false, true), 2);
        assert_eq!(sheet.find_next_column(0, 2, true, true), 0);
        assert_eq!(sheet.find_next_column(1, 2, false, false), 2);
        assert_eq!(sheet.find_next_column(1, 2, true, false), 0);
    }

    #[test]
    fn test_find_next_row() {
        let mut sheet = Sheet::test();

        sheet.set_cell_value(Pos { y: 1, x: 2 }, CellValue::Text(String::from("test")));
        sheet.recalculate_bounds();

        assert_eq!(sheet.find_next_row(-1, 2, false, true), 1);
        assert_eq!(sheet.find_next_row(3, 2, true, true), 1);
        assert_eq!(sheet.find_next_row(2, 2, false, true), 2);
        assert_eq!(sheet.find_next_row(0, 2, true, true), 0);
        assert_eq!(sheet.find_next_row(1, 2, false, false), 2);
        assert_eq!(sheet.find_next_row(1, 2, true, false), 0);
    }
}
