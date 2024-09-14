use crate::{
    grid::{bounds::BoundsRect, Column, GridBounds},
    selection::Selection,
    CellValue, Pos, Rect,
};

use super::Sheet;

impl Sheet {
    /// calculates all bounds
    pub fn calculate_bounds(&mut self) {
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

    /// Recalculates all bounds of the sheet.
    ///
    /// Returns whether any of the sheet's bounds has changed
    pub fn recalculate_bounds(&mut self) -> bool {
        let old_data_bounds = self.data_bounds.to_bounds_rect();
        let old_format_bounds = self.format_bounds.to_bounds_rect();
        self.data_bounds.clear();
        self.format_bounds.clear();

        self.calculate_bounds();

        self.code_runs.iter().for_each(|(pos, code_cell_value)| {
            let output_rect = code_cell_value.output_rect(*pos, false);
            self.data_bounds.add(output_rect.min);
            self.data_bounds.add(output_rect.max);
        });

        self.validations.validations.iter().for_each(|validation| {
            if validation.render_special().is_some() {
                if let Some(rect) = validation.selection.largest_rect() {
                    self.data_bounds.add(rect.min);
                    self.data_bounds.add(rect.max);
                }
            }
        });

        old_data_bounds != self.data_bounds.to_bounds_rect()
            || old_format_bounds != self.format_bounds.to_bounds_rect()
    }

    /// Adds a SheetRect to the bounds of the sheet.
    ///
    /// Returns whether any of the sheet's bounds has changed
    pub fn recalculate_add_bounds(&mut self, rect: Rect, format: bool) -> bool {
        if format {
            let old_format_bounds = self.format_bounds.to_bounds_rect();
            self.format_bounds.add(rect.min);
            self.format_bounds.add(rect.max);
            old_format_bounds != self.format_bounds.to_bounds_rect()
        } else {
            let old_data_bounds = self.format_bounds.to_bounds_rect();
            self.data_bounds.add(rect.min);
            self.data_bounds.add(rect.max);
            old_data_bounds != self.data_bounds.to_bounds_rect()
        }
    }

    /// Adds a Selection to the bounds of the sheet.
    ///
    /// Returns whether any of the sheet's bounds has changed
    pub fn recalculate_add_bounds_selection(
        &mut self,
        selection: &Selection,
        format: bool,
    ) -> bool {
        if selection.all || selection.columns.is_some() || selection.rows.is_some() {
            false
        } else if let Some(rects) = &selection.rects {
            let old_data_bounds = self.data_bounds.to_bounds_rect();
            let old_format_bounds = self.format_bounds.to_bounds_rect();
            for rect in rects {
                if format {
                    self.format_bounds.add(rect.min);
                    self.format_bounds.add(rect.max);
                } else {
                    self.data_bounds.add(rect.min);
                    self.data_bounds.add(rect.max);
                }
            }
            old_data_bounds != self.data_bounds.to_bounds_rect()
                || old_format_bounds != self.format_bounds.to_bounds_rect()
        } else {
            false
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
    ///
    /// Borders are not included in this bounds call.
    pub fn bounds(&self, ignore_formatting: bool) -> GridBounds {
        match ignore_formatting {
            true => self.data_bounds,
            false => GridBounds::merge(self.data_bounds, self.format_bounds),
        }
    }

    pub fn format_bounds(&self) -> Option<Rect> {
        match self.format_bounds {
            GridBounds::Empty => None,
            GridBounds::NonEmpty(rect) => Some(rect),
        }
    }

    /// Returns the lower and upper bounds of a column, or `None` if the column
    /// is empty.
    ///
    /// If `ignore_formatting` is `true`, only data is considered; if it is
    /// `false`, then data and formatting are both considered.
    pub fn column_bounds(&self, column: i64, ignore_formatting: bool) -> Option<(i64, i64)> {
        let range = if let Some(column_data) = self.columns.get(&column) {
            column_data.range(ignore_formatting)
        } else {
            None
        };
        let code_range = self.code_columns_bounds(column, column);
        if range.is_none() && code_range.is_none() {
            return None;
        }
        if let (Some(range), Some(code_range)) = (&range, &code_range) {
            Some((
                range.start.min(code_range.start),
                range.end.max(code_range.end) - 1,
            ))
        } else if let Some(range) = range {
            Some((range.start, range.end - 1))
        } else {
            code_range.map(|code_range| (code_range.start, code_range.end - 1))
        }
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
        if let Some(code_bounds) = self.code_columns_bounds(column_start, column_end) {
            min = min.min(code_bounds.start);
            max = max.max(code_bounds.end - 1);
            found = true;
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
        let min = if let Some((index, _)) = self.columns.iter().find(column_has_row) {
            Some(*index)
        } else {
            None
        };
        let max = if let Some((index, _)) = self.columns.iter().rfind(column_has_row) {
            Some(*index)
        } else {
            None
        };
        let code_range = self.code_rows_bounds(row, row);

        if min.is_none() && code_range.is_none() {
            return None;
        }
        if let (Some(min), Some(max), Some(code_range)) = (min, max, &code_range) {
            Some((min.min(code_range.start), max.max(code_range.end - 1)))
        } else if let (Some(min), Some(max)) = (min, max) {
            Some((min, max))
        } else {
            code_range.map(|code_range| (code_range.start, code_range.end - 1))
        }
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
        if let Some(code_bounds) = self.code_rows_bounds(row_start, row_end) {
            min = min.min(code_bounds.start);
            max = max.max(code_bounds.end - 1);
            found = true;
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
    /// Returns the found column matching the criteria of with_content
    pub fn find_next_column(
        &self,
        column_start: i64,
        row: i64,
        reverse: bool,
        with_content: bool,
    ) -> Option<i64> {
        let Some(bounds) = self.row_bounds(row, true) else {
            return if with_content {
                None
            } else {
                Some(column_start)
            };
        };
        let mut x = column_start;
        while (reverse && x >= bounds.0) || (!reverse && x <= bounds.1) {
            let has_content = self.display_value(Pos { x, y: row });
            if has_content.is_some_and(|cell_value| cell_value != CellValue::Blank) {
                if with_content {
                    return Some(x);
                }
            } else if !with_content {
                return Some(x);
            }
            x += if reverse { -1 } else { 1 };
        }
        let has_content = self.display_value(Pos { x, y: row });
        if with_content == has_content.is_some() {
            Some(x)
        } else {
            None
        }
    }

    /// finds the next column with or without content
    /// if reverse is true it searches to the left of the start
    /// if with_content is true it searches for a column with content; otherwise it searches for a column without content
    ///
    /// Returns the found row matching the criteria of with_content
    pub fn find_next_row(
        &self,
        row_start: i64,
        column: i64,
        reverse: bool,
        with_content: bool,
    ) -> Option<i64> {
        let Some(bounds) = self.column_bounds(column, true) else {
            return if with_content { None } else { Some(row_start) };
        };
        let mut y = row_start;
        while (reverse && y >= bounds.0) || (!reverse && y <= bounds.1) {
            let has_content = self.display_value(Pos { x: column, y });
            if has_content.is_some_and(|cell_value| cell_value != CellValue::Blank) {
                if with_content {
                    return Some(y);
                }
            } else if !with_content {
                return Some(y);
            }
            y += if reverse { -1 } else { 1 };
        }
        let has_content = self.display_value(Pos { x: column, y });
        if with_content == has_content.is_some() {
            Some(y)
        } else {
            None
        }
    }

    /// Finds the height of a rectangle that contains data given an (x, y, w).
    pub fn find_last_data_row(&self, x: i64, y: i64, w: i64) -> i64 {
        let bounds = self.bounds(true);
        match bounds {
            GridBounds::Empty => 0,
            GridBounds::NonEmpty(rect) => {
                let mut h = 0;
                for y in y..=rect.max.y {
                    let mut has_data = false;
                    for x in x..x + w {
                        if self.display_value(Pos { x, y }).is_some() {
                            has_data = true;
                            break;
                        }
                    }
                    if has_data {
                        h += 1;
                    } else {
                        // We've reached a column without any data, so we can stop
                        return h;
                    }
                }
                h
            }
        }
    }

    /// Returns the bounds of the sheet.
    ///
    /// Returns `(data_bounds, format_bounds)`.
    pub fn to_bounds_rects(&self) -> (Option<BoundsRect>, Option<BoundsRect>) {
        (
            self.data_bounds.to_bounds_rect(),
            self.format_bounds.to_bounds_rect(),
        )
    }
}

#[cfg(test)]
mod test {
    use crate::{
        controller::GridController,
        grid::{
            sheet::validations::{
                validation::Validation,
                validation_rules::{validation_logical::ValidationLogical, ValidationRule},
            },
            BorderSelection, BorderStyle, CellAlign, CellWrap, CodeCellLanguage, GridBounds, Sheet,
        },
        selection::Selection,
        CellValue, Pos, Rect, SheetPos, SheetRect,
    };
    use proptest::proptest;
    use serial_test::parallel;
    use std::collections::HashMap;
    use uuid::Uuid;

    #[test]
    #[parallel]
    fn test_is_empty() {
        let mut sheet = Sheet::test();
        assert!(!sheet.recalculate_bounds());
        assert!(sheet.is_empty());

        let _ = sheet.set_cell_value(Pos { x: 0, y: 0 }, CellValue::Text(String::from("test")));
        assert!(sheet.recalculate_bounds());
        assert!(!sheet.is_empty());

        let _ = sheet.set_cell_value(Pos { x: 0, y: 0 }, CellValue::Blank);
        sheet.recalculate_bounds();
        assert!(sheet.is_empty());
    }

    #[test]
    #[parallel]
    fn test_bounds() {
        let mut sheet = Sheet::test();
        assert_eq!(sheet.bounds(true), GridBounds::Empty);
        assert_eq!(sheet.bounds(false), GridBounds::Empty);

        let _ = sheet.set_cell_value(Pos { x: 0, y: 0 }, CellValue::Text(String::from("test")));
        let _ =
            sheet.set_formatting_value::<CellAlign>(Pos { x: 1, y: 1 }, Some(CellAlign::Center));
        assert!(sheet.recalculate_bounds());

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
    #[parallel]
    fn column_bounds() {
        let mut sheet = Sheet::test();
        let _ = sheet.set_cell_value(
            Pos { x: 100, y: -50 },
            CellValue::Text(String::from("test")),
        );
        let _ = sheet.set_cell_value(Pos { x: 100, y: 80 }, CellValue::Text(String::from("test")));
        let _ =
            sheet.set_formatting_value::<CellWrap>(Pos { x: 100, y: 200 }, Some(CellWrap::Wrap));
        assert!(sheet.recalculate_bounds());

        assert_eq!(sheet.column_bounds(100, true), Some((-50, 80)));
        assert_eq!(sheet.column_bounds(100, false), Some((-50, 200)));
    }

    #[test]
    #[parallel]
    fn column_bounds_code() {
        let mut sheet = Sheet::test();
        sheet.test_set_code_run_array_2d(0, 0, 2, 2, vec!["1", "2", "3", "4"]);
        assert_eq!(sheet.column_bounds(0, true), Some((0, 1)));
        assert_eq!(sheet.column_bounds(1, true), Some((0, 1)));
    }

    #[test]
    #[parallel]
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
    #[parallel]
    fn row_bounds_code() {
        let mut sheet = Sheet::test();
        sheet.test_set_code_run_array_2d(0, 0, 2, 2, vec!["1", "2", "3", "4"]);
        assert_eq!(sheet.row_bounds(0, true), Some((0, 1)));
        assert_eq!(sheet.row_bounds(1, true), Some((0, 1)));
    }

    #[test]
    #[parallel]
    fn test_columns_bounds() {
        let mut sheet = Sheet::test();

        let _ = sheet.set_cell_value(
            Pos { x: 100, y: -50 },
            CellValue::Text(String::from("test")),
        );
        let _ = sheet.set_cell_value(Pos { x: 100, y: 80 }, CellValue::Text(String::from("test")));
        let _ = sheet
            .set_formatting_value::<CellAlign>(Pos { x: 100, y: 200 }, Some(CellAlign::Center));

        // set negative values
        let _ = sheet.set_cell_value(
            Pos { x: -100, y: -50 },
            CellValue::Text(String::from("test")),
        );
        let _ = sheet.set_cell_value(
            Pos { x: -100, y: -80 },
            CellValue::Text(String::from("test")),
        );
        let _ = sheet
            .set_formatting_value::<CellAlign>(Pos { x: -100, y: -200 }, Some(CellAlign::Center));
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
    #[parallel]
    fn test_rows_bounds() {
        let mut sheet = Sheet::test();

        let _ = sheet.set_cell_value(
            Pos { y: 100, x: -50 },
            CellValue::Text(String::from("test")),
        );
        let _ = sheet.set_cell_value(Pos { y: 100, x: 80 }, CellValue::Text(String::from("test")));
        let _ = sheet
            .set_formatting_value::<CellAlign>(Pos { y: 100, x: 200 }, Some(CellAlign::Center));

        // set negative values
        let _ = sheet.set_cell_value(
            Pos { y: -100, x: -50 },
            CellValue::Text(String::from("test")),
        );
        let _ = sheet.set_cell_value(
            Pos { y: -100, x: -80 },
            CellValue::Text(String::from("test")),
        );
        let _ = sheet
            .set_formatting_value::<CellAlign>(Pos { y: -100, x: -200 }, Some(CellAlign::Center));
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
    #[parallel]
    fn test_find_next_column() {
        let mut sheet = Sheet::test();

        sheet.set_cell_value(Pos { x: 1, y: 2 }, CellValue::Text(String::from("test")));
        sheet.set_cell_value(Pos { x: 10, y: 10 }, CellValue::Text(String::from("test")));

        assert_eq!(sheet.find_next_column(0, 0, false, false), Some(0));
        assert_eq!(sheet.find_next_column(0, 0, false, true), None);
        assert_eq!(sheet.find_next_column(0, 0, true, false), Some(0));
        assert_eq!(sheet.find_next_column(0, 0, true, true), None);
        assert_eq!(sheet.find_next_column(-1, 2, false, true), Some(1));
        assert_eq!(sheet.find_next_column(-1, 2, true, true), None);
        assert_eq!(sheet.find_next_column(3, 2, false, true), None);
        assert_eq!(sheet.find_next_column(3, 2, true, true), Some(1));
        assert_eq!(sheet.find_next_column(2, 2, false, true), None);
        assert_eq!(sheet.find_next_column(2, 2, true, true), Some(1));
        assert_eq!(sheet.find_next_column(0, 2, false, true), Some(1));
        assert_eq!(sheet.find_next_column(0, 2, true, true), None);
        assert_eq!(sheet.find_next_column(1, 2, false, false), Some(2));
        assert_eq!(sheet.find_next_column(1, 2, true, false), Some(0));

        sheet.set_cell_value(Pos { x: 2, y: 2 }, CellValue::Text(String::from("test")));
        sheet.set_cell_value(Pos { x: 3, y: 2 }, CellValue::Text(String::from("test")));

        assert_eq!(sheet.find_next_column(1, 2, false, false), Some(4));
        assert_eq!(sheet.find_next_column(2, 2, false, false), Some(4));
        assert_eq!(sheet.find_next_column(2, 2, true, false), Some(0));
        assert_eq!(sheet.find_next_column(3, 2, true, false), Some(0));
    }

    #[test]
    #[parallel]
    fn test_find_next_column_code() {
        let mut sheet = Sheet::test();
        sheet.test_set_code_run_array(0, 0, vec!["1", "2", "3"], false);

        assert_eq!(sheet.find_next_column(-1, 0, false, true), Some(0));
        assert_eq!(sheet.find_next_column(0, 0, false, false), Some(3));
        assert_eq!(sheet.find_next_column(2, 0, false, false), Some(3));
        assert_eq!(sheet.find_next_column(4, 0, true, true), Some(2));
        assert_eq!(sheet.find_next_column(2, 0, true, false), Some(-1));
    }

    #[test]
    #[parallel]
    fn test_find_next_row() {
        let mut sheet = Sheet::test();

        let _ = sheet.set_cell_value(Pos { x: 2, y: 1 }, CellValue::Text(String::from("test")));
        sheet.set_cell_value(Pos { x: 10, y: 10 }, CellValue::Text(String::from("test")));

        assert_eq!(sheet.find_next_row(0, 0, false, false), Some(0));
        assert_eq!(sheet.find_next_row(0, 0, false, true), None);
        assert_eq!(sheet.find_next_row(0, 0, true, false), Some(0));
        assert_eq!(sheet.find_next_row(0, 0, true, true), None);
        assert_eq!(sheet.find_next_row(-1, 2, false, true), Some(1));
        assert_eq!(sheet.find_next_row(-1, 2, true, true), None);
        assert_eq!(sheet.find_next_row(3, 2, false, true), None);
        assert_eq!(sheet.find_next_row(3, 2, true, true), Some(1));
        assert_eq!(sheet.find_next_row(2, 2, false, true), None);
        assert_eq!(sheet.find_next_row(2, 2, true, true), Some(1));
        assert_eq!(sheet.find_next_row(0, 2, false, true), Some(1));
        assert_eq!(sheet.find_next_row(0, 2, true, true), None);
        assert_eq!(sheet.find_next_row(1, 2, false, false), Some(2));
        assert_eq!(sheet.find_next_row(1, 2, true, false), Some(0));

        sheet.set_cell_value(Pos { x: 2, y: 2 }, CellValue::Text(String::from("test")));
        sheet.set_cell_value(Pos { x: 2, y: 3 }, CellValue::Text(String::from("test")));

        assert_eq!(sheet.find_next_row(1, 2, false, false), Some(4));
        assert_eq!(sheet.find_next_row(2, 2, false, false), Some(4));
        assert_eq!(sheet.find_next_row(3, 2, true, false), Some(0));
    }

    #[test]
    #[parallel]
    fn test_find_next_row_code() {
        let mut sheet = Sheet::test();
        sheet.test_set_code_run_array(0, 0, vec!["1", "2", "3"], true);

        assert_eq!(sheet.find_next_row(-1, 0, false, true), Some(0));
        assert_eq!(sheet.find_next_row(0, 0, false, false), Some(3));
        assert_eq!(sheet.find_next_row(2, 0, false, false), Some(3));
        assert_eq!(sheet.find_next_row(4, 0, true, true), Some(2));
        assert_eq!(sheet.find_next_row(2, 0, true, false), Some(-1));
    }

    #[test]
    #[parallel]
    fn test_read_write() {
        let rect = Rect {
            min: Pos::ORIGIN,
            max: Pos { x: 49, y: 49 },
        };
        let mut sheet = Sheet::test();
        sheet.random_numbers(&rect);
        assert_eq!(GridBounds::NonEmpty(rect), sheet.bounds(true));
        assert_eq!(GridBounds::NonEmpty(rect), sheet.bounds(false));
    }

    proptest! {
        #[test]
        #[parallel]
        fn proptest_sheet_writes(writes: Vec<(Pos, CellValue)>) {
            proptest_sheet_writes_internal(writes);
        }
    }

    fn proptest_sheet_writes_internal(writes: Vec<(Pos, CellValue)>) {
        let mut sheet = Sheet::test();

        // We'll be testing against the  ~ HASHMAP OF TRUTH ~
        let mut hashmap_of_truth = HashMap::new();

        for (pos, cell_value) in &writes {
            let _ = sheet.set_cell_value(*pos, cell_value.clone());
            hashmap_of_truth.insert(*pos, cell_value);
        }

        let nonempty_positions = hashmap_of_truth
            .iter()
            .filter(|(_, value)| !value.is_blank_or_empty_string())
            .map(|(pos, _)| pos);
        let min_x = nonempty_positions.clone().map(|pos| pos.x).min();
        let min_y = nonempty_positions.clone().map(|pos| pos.y).min();
        let max_x = nonempty_positions.clone().map(|pos| pos.x).max();
        let max_y = nonempty_positions.clone().map(|pos| pos.y).max();
        let expected_bounds = match (min_x, min_y, max_x, max_y) {
            (Some(min_x), Some(min_y), Some(max_x), Some(max_y)) => GridBounds::NonEmpty(Rect {
                min: Pos { x: min_x, y: min_y },
                max: Pos { x: max_x, y: max_y },
            }),
            _ => GridBounds::Empty,
        };

        for (pos, expected) in hashmap_of_truth {
            let actual = sheet.display_value(pos);
            if expected.is_blank_or_empty_string() {
                assert_eq!(None, actual);
            } else {
                assert_eq!(Some(expected.clone()), actual);
            }
        }

        sheet.recalculate_bounds();
        assert_eq!(expected_bounds, sheet.bounds(false));
        assert_eq!(expected_bounds, sheet.bounds(true));
    }

    #[test]
    #[parallel]
    fn code_run_columns_bounds() {
        let mut gc = GridController::test();
        let sheet_id = gc.sheet_ids()[0];
        gc.set_code_cell(
            SheetPos {
                x: 1,
                y: 2,
                sheet_id,
            },
            CodeCellLanguage::Formula,
            "{1, 2, 3; 4, 5, 6}".to_string(),
            None,
        );
        let sheet = gc.sheet(sheet_id);
        assert_eq!(sheet.columns_bounds(1, 2, true), Some((2, 3)));
        assert_eq!(sheet.columns_bounds(1, 2, false), Some((2, 3)));
    }

    #[test]
    #[parallel]
    fn code_run_rows_bounds() {
        let mut gc = GridController::test();
        let sheet_id = gc.sheet_ids()[0];
        gc.set_code_cell(
            SheetPos {
                x: 1,
                y: 2,
                sheet_id,
            },
            CodeCellLanguage::Formula,
            "{1, 2, 3; 4, 5, 6}".to_string(),
            None,
        );
        let sheet = gc.sheet(sheet_id);
        assert_eq!(sheet.rows_bounds(0, 2, true), Some((1, 3)));
        assert_eq!(sheet.rows_bounds(0, 2, false), Some((1, 3)));
    }

    #[test]
    #[parallel]
    fn code_run_column_bounds() {
        let mut gc = GridController::test();
        let sheet_id = gc.sheet_ids()[0];
        gc.set_code_cell(
            SheetPos {
                x: 1,
                y: 2,
                sheet_id,
            },
            CodeCellLanguage::Formula,
            "{1, 2, 3; 4, 5, 6}".to_string(),
            None,
        );
        let sheet = gc.sheet(sheet_id);
        assert_eq!(sheet.column_bounds(1, true), Some((2, 3)));
        assert_eq!(sheet.column_bounds(1, false), Some((2, 3)));
    }

    #[test]
    #[parallel]
    fn code_run_row_bounds() {
        let mut gc = GridController::test();
        let sheet_id = gc.sheet_ids()[0];
        gc.set_code_cell(
            SheetPos {
                x: 1,
                y: 2,
                sheet_id,
            },
            CodeCellLanguage::Formula,
            "{1, 2, 3; 4, 5, 6}".to_string(),
            None,
        );
        let sheet = gc.sheet(sheet_id);
        assert_eq!(sheet.row_bounds(2, true), Some((1, 3)));
        assert_eq!(sheet.row_bounds(2, false), Some((1, 3)));
    }

    #[test]
    #[parallel]
    fn single_row_bounds() {
        let mut gc = GridController::test();
        let sheet_id = gc.sheet_ids()[0];
        gc.set_cell_value(
            SheetPos {
                x: 1,
                y: 2,
                sheet_id,
            },
            "test".to_string(),
            None,
        );
        let sheet = gc.sheet(sheet_id);
        assert_eq!(sheet.row_bounds(2, true), Some((1, 1)));
        assert_eq!(sheet.row_bounds(2, false), Some((1, 1)));
    }

    #[test]
    #[parallel]
    fn send_updated_bounds_rect() {
        let mut gc = GridController::test();
        let sheet_id = gc.sheet_ids()[0];
        gc.set_cell_value(
            SheetPos {
                x: 1,
                y: 2,
                sheet_id,
            },
            "test".to_string(),
            None,
        );
        let sheet = gc.sheet(sheet_id);
        assert_eq!(
            sheet.data_bounds,
            GridBounds::NonEmpty(Rect::from_numbers(1, 2, 1, 1))
        );
        gc.set_cell_bold(
            SheetRect::from_numbers(3, 5, 1, 1, sheet_id),
            Some(true),
            None,
        );

        let sheet = gc.sheet(sheet_id);
        assert_eq!(
            sheet.bounds(true),
            GridBounds::NonEmpty(Rect::from_numbers(1, 2, 1, 1))
        );
        assert_eq!(
            sheet.bounds(false),
            GridBounds::NonEmpty(Rect::from_numbers(1, 2, 3, 4))
        );
    }

    #[test]
    #[parallel]
    fn row_bounds() {
        let mut gc = GridController::test();
        let sheet_id = gc.sheet_ids()[0];
        gc.set_cell_value((0, 0, sheet_id).into(), "a".to_string(), None);
        gc.set_code_cell(
            (1, 0, sheet_id).into(),
            CodeCellLanguage::Formula,
            "[['c','d']]".into(),
            None,
        );
        gc.set_cell_value((3, 0, sheet_id).into(), "d".into(), None);

        let sheet = gc.sheet(sheet_id);
        assert_eq!(sheet.row_bounds(0, true), Some((0, 3)));
        assert_eq!(sheet.row_bounds(0, false), Some((0, 3)));
    }

    #[test]
    #[parallel]
    fn find_last_data_row() {
        let mut gc = GridController::test();
        let sheet_id = gc.sheet_ids()[0];
        gc.set_cell_value((0, 0, sheet_id).into(), "a".to_string(), None);
        gc.set_cell_value((0, 1, sheet_id).into(), "b".to_string(), None);
        gc.set_cell_value((0, 2, sheet_id).into(), "c".to_string(), None);
        gc.set_cell_value((0, 4, sheet_id).into(), "e".to_string(), None);

        let sheet = gc.sheet(sheet_id);

        // height should be 3 (0,0 - 0.2)
        assert_eq!(sheet.find_last_data_row(0, 0, 1), 3);

        // height should be 1 (0,4)
        assert_eq!(sheet.find_last_data_row(0, 4, 1), 1);

        // height should be 0 since there is no data
        assert_eq!(sheet.find_last_data_row(0, 10, 1), 0);
    }

    #[test]
    #[parallel]
    fn recalculate_bounds_validations() {
        let mut gc = GridController::test();
        let sheet_id = gc.sheet_ids()[0];
        gc.update_validation(
            Validation {
                id: Uuid::new_v4(),
                rule: ValidationRule::Logical(ValidationLogical {
                    show_checkbox: true,
                    ignore_blank: true,
                }),
                selection: Selection::pos(0, 0, sheet_id),
                message: Default::default(),
                error: Default::default(),
            },
            None,
        );

        let sheet = gc.sheet(sheet_id);
        assert_eq!(
            sheet.data_bounds,
            GridBounds::NonEmpty(Rect::new(0, 0, 0, 0))
        );
    }

    #[test]
    #[parallel]
    fn empty_bounds_with_borders() {
        let mut gc = GridController::test();
        let sheet_id = gc.sheet_ids()[0];

        gc.set_borders_selection(
            Selection::sheet_rect(SheetRect::new(1, 1, 1, 1, sheet_id)),
            BorderSelection::All,
            Some(BorderStyle::default()),
            None,
        );

        let sheet = gc.sheet(sheet_id);
        assert_eq!(sheet.bounds(false), GridBounds::Empty);
    }
}
