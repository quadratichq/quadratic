//! Calculates all bounds for the sheet: data, formatting, and borders. We cache
//! this value and only recalculate when necessary.

use crate::{CellValue, Pos, Rect, a1::A1Context, grid::GridBounds};

use super::Sheet;

mod traverse;

impl Sheet {
    /// Recalculates all bounds of the sheet.
    ///
    /// Returns whether any of the sheet's bounds has changed
    pub fn recalculate_bounds(&mut self, a1_context: &A1Context) -> bool {
        let old_data_bounds = self.data_bounds.to_bounds_rect();
        let old_format_bounds = self.format_bounds.to_bounds_rect();
        self.data_bounds.clear();
        self.format_bounds.clear();

        if let Some(rect) = self.columns.finite_bounds() {
            self.data_bounds.add_rect(rect);
        };

        if let Some(rect) = self.data_tables.finite_bounds() {
            self.data_bounds.add_rect(rect);
        };

        for validation in self.validations.validations.iter() {
            if validation.render_special().is_some()
                && let Some(rect) =
                    self.selection_bounds(&validation.selection, false, false, true, a1_context)
            {
                self.data_bounds.add(rect.min);
                self.data_bounds.add(rect.max);
            }
        }
        for (&pos, _) in self.validations.warnings.iter() {
            self.data_bounds.add(pos);
        }

        if let Some(rect) = self.formats.finite_bounds() {
            self.format_bounds.add_rect(rect);
        }

        old_data_bounds != self.data_bounds.to_bounds_rect()
            || old_format_bounds != self.format_bounds.to_bounds_rect()
    }

    /// Returns whether the sheet is completely empty.
    pub fn is_empty(&self) -> bool {
        self.data_bounds.is_empty() && self.format_bounds.is_empty()
    }

    /// Returns the bounds of the sheet, including borders.
    pub fn all_bounds(&self) -> GridBounds {
        GridBounds::merge(self.bounds(false), self.border_bounds())
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

    /// Returns the bounds of the formatting.
    pub fn format_bounds(&self) -> GridBounds {
        self.format_bounds
    }

    /// Returns the bounds of the borders.
    pub fn border_bounds(&self) -> GridBounds {
        self.borders
            .finite_bounds()
            .map(|rect| rect.into())
            .unwrap_or(GridBounds::Empty)
    }

    /// Returns the lower and upper bounds of a column, or `None` if the column
    /// is empty.
    ///
    /// If `ignore_formatting` is `true`, only data is considered; if it is
    /// `false`, then data and formatting are both considered.
    pub fn column_bounds(&self, column: i64, ignore_formatting: bool) -> Option<(i64, i64)> {
        // Get bounds from data columns
        let data_range = self.columns.get_column(column).and_then(|col| col.range());

        // Get bounds from code columns
        let code_range = self.code_columns_bounds(column, column);

        // Get bounds from formatting if needed
        let format_range = if !ignore_formatting {
            self.formats
                .col_max(column)
                .map(|max| (self.formats.col_min(column).unwrap_or(1i64), max))
        } else {
            None
        };

        // Early return if no bounds found
        if data_range.is_none() && code_range.is_none() && format_range.is_none() {
            return None;
        }

        // Find min/max across all ranges
        let mut min = i64::MAX;
        let mut max = i64::MIN;

        if let Some(range) = data_range.as_ref() {
            min = min.min(range.start);
            max = max.max(range.end - 1);
        }

        if let Some(range) = code_range.as_ref() {
            min = min.min(range.start);
            max = max.max(range.end - 1);
        }

        if let Some((start, end)) = format_range {
            min = min.min(start);
            max = max.max(end);
        }

        // Return bounds if any were found
        if min != i64::MAX && max != i64::MIN {
            Some((min, max))
        } else {
            None
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
        if found { Some((min, max)) } else { None }
    }

    /// Returns the lower and upper bounds of a row, or `None` if the column is
    /// empty.
    ///
    /// If `ignore_formatting` is `true`, only data is considered; if it
    /// is `false`, then data and formatting are both considered.
    ///
    pub fn row_bounds(&self, row: i64, ignore_formatting: bool) -> Option<(i64, i64)> {
        let (mut min, mut max) = match self.columns.row_bounds(row) {
            Some((min, max)) => (
                if min > 0 { Some(min) } else { None },
                if max > 0 { Some(max) } else { None },
            ),
            None => (None, None),
        };

        if !ignore_formatting {
            min = match self.formats.row_min(row) {
                Some(formats_min) => Some(min.map_or(formats_min, |m| m.min(formats_min))),
                None => min,
            };
            max = match self.formats.row_max(row) {
                Some(formats_max) => Some(max.map_or(formats_max, |m| m.max(formats_max))),
                None => max,
            };
        }

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

    /// Returns the lower and upper bounds of formatting in a row, or `None` if
    /// the row has no formatting.
    pub fn row_bounds_formats(&self, row: i64) -> Option<(i64, i64)> {
        if let (Some(min), Some(max)) = (self.formats.row_min(row), self.formats.row_max(row)) {
            Some((min, max))
        } else {
            None
        }
    }

    /// Returns the lower and upper bounds of a range of rows, or 'None' if the rows are empty
    ///
    /// If `ignore_formatting` is `true`, only data is considered; if it
    /// is `false`, then data and formatting are both considered.
    ///
    /// todo: would be helpful if we added column_start: Option<i64> to this function
    pub fn rows_bounds(
        &self,
        row_start: i64,
        row_end: i64,
        ignore_formatting: bool,
    ) -> Option<(i64, i64)> {
        // TODO: Take a range of rows instead of start & end, to make the
        // boundary conditions and `row_start <= row_end` assumption explicit.
        // Do the same for `columns_bounds()`.
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
        if found { Some((min, max)) } else { None }
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

    /// finds the nearest column that can be used to place a rect
    /// if reverse is true it searches to the left of the start
    ///
    /// todo: return None instead of negatives
    pub fn find_next_column_for_rect(
        &self,
        column_start: i64,
        row: i64,
        reverse: bool,
        rect: Rect,
    ) -> i64 {
        let mut rect_start_x = column_start;
        let bounds = self.bounds(true);
        match bounds {
            GridBounds::Empty => rect_start_x,
            GridBounds::NonEmpty(sheet_rect) => {
                while (!reverse && rect_start_x <= sheet_rect.max.x)
                    || (reverse && (rect_start_x - 1 + rect.width() as i64) >= sheet_rect.min.x)
                {
                    let mut is_valid = true;
                    let rect_range = rect_start_x..(rect_start_x + rect.width() as i64);
                    for x in rect_range {
                        if let Some(next_row_with_content) = self.find_next_row(row, x, false, true)
                            && (next_row_with_content - row) < rect.height() as i64
                        {
                            rect_start_x = if !reverse {
                                x + 1
                            } else {
                                x - rect.width() as i64
                            };
                            is_valid = false;
                            break;
                        }
                    }
                    if is_valid {
                        return rect_start_x;
                    }
                }
                rect_start_x
            }
        }
    }

    /// finds the nearest column that can be used to place a rect
    /// if reverse is true it searches to the left of the start
    ///
    /// todo: return None instead of negatives
    pub fn find_next_row_for_rect(
        &self,
        row_start: i64,
        column: i64,
        reverse: bool,
        rect: Rect,
    ) -> i64 {
        let mut rect_start_y = row_start;
        let bounds = self.bounds(true);
        match bounds {
            GridBounds::Empty => rect_start_y,
            GridBounds::NonEmpty(sheet_rect) => {
                while (!reverse && rect_start_y <= sheet_rect.max.y)
                    || (reverse && (rect_start_y - 1 + rect.height() as i64) >= sheet_rect.min.y)
                {
                    let mut is_valid = true;
                    let rect_range = rect_start_y..(rect_start_y + rect.height() as i64);
                    for y in rect_range {
                        if let Some(next_column_with_content) =
                            self.find_next_column(column, y, false, true)
                            && (next_column_with_content - column) < rect.width() as i64
                        {
                            rect_start_y = if !reverse {
                                y + 1
                            } else {
                                y - rect.height() as i64
                            };
                            is_valid = false;
                            break;
                        }
                    }
                    if is_valid {
                        return rect_start_y;
                    }
                }
                rect_start_y
            }
        }
    }

    pub fn find_tabular_data_rects_in_selection_rects(
        &self,
        selection_rects: Vec<Rect>,
    ) -> Vec<Rect> {
        let mut tabular_data_rects = Vec::new();

        let is_non_data_cell = |pos: Pos| match self.cell_value_ref(pos) {
            Some(value) => value.is_blank_or_empty_string() || value.is_image() || value.is_html(),
            None => self
                .data_table_at(&pos)
                .map_or(false, |dt| !dt.is_single_value()),
        };

        for selection_rect in selection_rects {
            for y in selection_rect.y_range() {
                for x in selection_rect.x_range() {
                    let pos = Pos { x, y };

                    let is_visited = tabular_data_rects
                        .iter()
                        .any(|prev_tabular_data_rect: &Rect| prev_tabular_data_rect.contains(pos));
                    if is_visited {
                        continue;
                    }

                    if self.is_in_non_single_code_cell_code_table(pos) {
                        continue;
                    }

                    let has_value = self.has_content(pos);
                    if !has_value {
                        continue;
                    }

                    let Some((col_min, col_max)) = self.row_bounds(pos.y, true) else {
                        continue;
                    };

                    if pos.x < col_min || pos.x > col_max {
                        continue;
                    }

                    let Some((row_min, row_max)) = self.column_bounds(pos.x, true) else {
                        continue;
                    };

                    if pos.y < row_min || pos.y > row_max {
                        continue;
                    }

                    // search till we find a non-data cell and use the previous row
                    let last_row = ((pos.y + 1)..=(row_max + 1))
                        .find(|y| is_non_data_cell(Pos { x: pos.x, y: *y }))
                        .unwrap_or(row_max + 1)
                        - 1;

                    // search till we find a non-data cell and use the previous column
                    let last_col = ((pos.x + 1)..=(col_max + 1))
                        .find(|x| is_non_data_cell(Pos { x: *x, y: pos.y }))
                        .unwrap_or(col_max + 1)
                        - 1;

                    let tabular_data_rect = Rect::new(pos.x, pos.y, last_col, last_row);
                    tabular_data_rects.push(tabular_data_rect);
                }
            }
        }

        tabular_data_rects
    }
}

#[cfg(test)]
mod test {
    use crate::{
        Array, CellValue, Pos, Rect, SheetPos,
        a1::A1Selection,
        controller::{GridController, user_actions::import::tests::simple_csv_at},
        grid::{
            CellAlign, CellWrap, CodeCellLanguage, GridBounds, Sheet,
            sheet::{
                borders::{BorderSelection, BorderStyle},
                validations::{
                    rules::{ValidationRule, validation_logical::ValidationLogical},
                    validation::ValidationUpdate,
                },
            },
        },
        test_util::*,
    };
    use proptest::proptest;
    use std::collections::HashMap;

    #[test]
    fn test_is_empty() {
        let mut sheet = Sheet::test();
        let a1_context = sheet.expensive_make_a1_context();
        assert!(!sheet.recalculate_bounds(&a1_context));
        assert!(sheet.is_empty());

        let _ = sheet.set_cell_value(Pos { x: 1, y: 1 }, CellValue::Text(String::from("test")));
        assert!(sheet.recalculate_bounds(&a1_context));
        assert!(!sheet.is_empty());

        let _ = sheet.set_cell_value(Pos { x: 1, y: 1 }, CellValue::Blank);
        assert!(sheet.recalculate_bounds(&a1_context));
        assert!(sheet.is_empty());
    }

    #[test]
    fn test_bounds() {
        let mut sheet = Sheet::test();
        assert_eq!(sheet.bounds(true), GridBounds::Empty);
        assert_eq!(sheet.bounds(false), GridBounds::Empty);

        sheet.set_cell_value(Pos { x: 1, y: 1 }, CellValue::Text(String::from("test")));
        sheet
            .formats
            .align
            .set(Pos { x: 2, y: 2 }, Some(CellAlign::Center));
        let a1_context = sheet.expensive_make_a1_context();
        assert!(sheet.recalculate_bounds(&a1_context));

        assert_eq!(
            sheet.bounds(true),
            GridBounds::from(Rect {
                min: Pos { x: 1, y: 1 },
                max: Pos { x: 1, y: 1 }
            })
        );

        assert_eq!(
            sheet.bounds(false),
            GridBounds::from(Rect {
                min: Pos { x: 1, y: 1 },
                max: Pos { x: 2, y: 2 }
            })
        );
    }

    #[test]
    fn column_bounds() {
        let mut sheet = Sheet::test();
        let _ = sheet.set_cell_value(
            Pos { x: 100, y: -50 },
            CellValue::Text(String::from("test")),
        );
        let _ = sheet.set_cell_value(Pos { x: 100, y: 80 }, CellValue::Text(String::from("test")));
        sheet
            .formats
            .wrap
            .set(Pos { x: 100, y: 200 }, Some(CellWrap::Wrap));
        let a1_context = sheet.expensive_make_a1_context();
        assert!(sheet.recalculate_bounds(&a1_context));

        assert_eq!(sheet.column_bounds(100, true), Some((-50, 80)));
        assert_eq!(sheet.column_bounds(100, false), Some((-50, 200)));
    }

    #[test]
    fn column_bounds_code() {
        let mut sheet = Sheet::test();
        sheet.test_set_code_run_array_2d(1, 1, 2, 2, vec!["1", "2", "3", "4"]);
        assert_eq!(sheet.column_bounds(1, true), Some((1, 2)));
        assert_eq!(sheet.column_bounds(2, true), Some((1, 2)));
    }

    #[test]
    fn test_row_bounds() {
        let mut sheet = Sheet::test();
        sheet.set_cell_value(Pos { x: 1, y: 100 }, CellValue::Text(String::from("test")));
        sheet.set_cell_value(Pos { x: 80, y: 100 }, CellValue::Text(String::from("test")));
        sheet
            .formats
            .align
            .set(Pos { x: 200, y: 100 }, Some(CellAlign::Center));
        let a1_context = sheet.expensive_make_a1_context();
        sheet.recalculate_bounds(&a1_context);

        assert_eq!(sheet.row_bounds(100, true), Some((1, 80)));
        assert_eq!(sheet.row_bounds(100, false), Some((1, 200)));
    }

    #[test]
    fn row_bounds_code() {
        let mut sheet = Sheet::test();
        sheet.test_set_code_run_array_2d(1, 1, 2, 2, vec!["1", "2", "3", "4"]);
        assert_eq!(sheet.row_bounds(1, true), Some((1, 2)));
        assert_eq!(sheet.row_bounds(2, true), Some((1, 2)));
    }

    #[test]
    fn test_columns_bounds() {
        let mut sheet = Sheet::test();

        sheet.set_cell_value(Pos { x: 100, y: 50 }, CellValue::Text(String::from("test")));
        sheet.set_cell_value(Pos { x: 100, y: 80 }, CellValue::Text(String::from("test")));
        sheet
            .formats
            .align
            .set(Pos { x: 100, y: 200 }, Some(CellAlign::Center));

        sheet
            .formats
            .align
            .set(Pos { x: 100, y: 200 }, Some(CellAlign::Center));
        let a1_context = sheet.expensive_make_a1_context();
        sheet.recalculate_bounds(&a1_context);

        assert_eq!(sheet.columns_bounds(1, 100, true), Some((50, 80)));

        assert_eq!(sheet.columns_bounds(1, 100, false), Some((50, 200)));

        assert_eq!(sheet.columns_bounds(1000, 2000, true), None);
        assert_eq!(sheet.columns_bounds(1000, 2000, false), None);

        assert_eq!(sheet.columns_bounds(1000, 1000, true), None);
        assert_eq!(sheet.columns_bounds(1000, 1000, false), None);
    }

    #[test]
    fn test_rows_bounds() {
        let mut sheet = Sheet::test();

        sheet.set_cell_value(Pos { x: 1, y: 100 }, CellValue::Text(String::from("test")));
        sheet.set_cell_value(Pos { x: 80, y: 100 }, CellValue::Text(String::from("test")));
        sheet
            .formats
            .align
            .set(Pos { x: 100, y: 200 }, Some(CellAlign::Center));

        sheet
            .formats
            .align
            .set(Pos { x: 100, y: 200 }, Some(CellAlign::Center));
        let a1_context = sheet.expensive_make_a1_context();
        sheet.recalculate_bounds(&a1_context);

        assert_eq!(sheet.rows_bounds(1, 100, true), Some((1, 80)));
        assert_eq!(sheet.rows_bounds(1, 100, false), Some((1, 80)));

        assert_eq!(sheet.rows_bounds(1, 100, true), Some((1, 80)));
        assert_eq!(sheet.rows_bounds(1, 100, false), Some((1, 80)));

        assert_eq!(sheet.rows_bounds(1000, 2000, true), None);
        assert_eq!(sheet.rows_bounds(1000, 2000, false), None);

        assert_eq!(sheet.rows_bounds(1000, 1000, true), None);
        assert_eq!(sheet.rows_bounds(1000, 1000, false), None);
    }

    #[test]
    fn test_read_write() {
        let rect = Rect {
            min: Pos { x: 1, y: 1 },
            max: Pos { x: 49, y: 49 },
        };
        let mut sheet = Sheet::test();
        let a1_context = sheet.expensive_make_a1_context();
        sheet.random_numbers(&rect, &a1_context);
        assert_eq!(GridBounds::NonEmpty(rect), sheet.bounds(true));
        assert_eq!(GridBounds::NonEmpty(rect), sheet.bounds(false));
    }

    proptest! {
        #[test]
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

        let a1_context = sheet.expensive_make_a1_context();
        sheet.recalculate_bounds(&a1_context);
        assert_eq!(expected_bounds, sheet.bounds(false));
        assert_eq!(expected_bounds, sheet.bounds(true));
    }

    #[test]
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
            None,
            false,
        );
        let sheet = gc.sheet(sheet_id);
        assert_eq!(sheet.columns_bounds(1, 2, true), Some((2, 3)));
        assert_eq!(sheet.columns_bounds(1, 2, false), Some((2, 3)));
    }

    #[test]
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
            None,
            false,
        );
        let sheet = gc.sheet(sheet_id);
        assert_eq!(sheet.rows_bounds(0, 2, true), Some((1, 3)));
        assert_eq!(sheet.rows_bounds(0, 2, false), Some((1, 3)));
    }

    #[test]
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
            None,
            false,
        );
        let sheet = gc.sheet(sheet_id);
        assert_eq!(sheet.column_bounds(1, true), Some((2, 3)));
        assert_eq!(sheet.column_bounds(1, false), Some((2, 3)));
    }

    #[test]
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
            None,
            false,
        );
        let sheet = gc.sheet(sheet_id);
        assert_eq!(sheet.row_bounds(2, true), Some((1, 3)));
        assert_eq!(sheet.row_bounds(2, false), Some((1, 3)));
    }

    #[test]
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
            false,
        );
        let sheet = gc.sheet(sheet_id);
        assert_eq!(sheet.row_bounds(2, true), Some((1, 1)));
        assert_eq!(sheet.row_bounds(2, false), Some((1, 1)));
    }

    #[test]
    fn test_row_bounds_with_formats() {
        let mut gc = GridController::test();
        let sheet_id = gc.sheet_ids()[0];
        gc.set_cell_value((1, 1, sheet_id).into(), "a".to_string(), None, false);
        gc.set_code_cell(
            (2, 1, sheet_id).into(),
            CodeCellLanguage::Formula,
            "[['c','d']]".into(),
            None,
            None,
            false,
        );
        gc.set_cell_value((3, 1, sheet_id).into(), "d".into(), None, false);
        gc.set_bold(&A1Selection::test_a1("D1"), Some(true), None, false)
            .unwrap();
        let sheet = gc.sheet(sheet_id);
        assert_eq!(sheet.row_bounds(1, true), Some((1, 3)));
        assert_eq!(sheet.row_bounds(1, false), Some((1, 4)));
    }

    #[test]
    fn find_last_data_row() {
        let mut gc = GridController::test();
        let sheet_id = gc.sheet_ids()[0];
        gc.set_cell_value((1, 1, sheet_id).into(), "a".to_string(), None, false);
        gc.set_cell_value((1, 2, sheet_id).into(), "b".to_string(), None, false);
        gc.set_cell_value((1, 3, sheet_id).into(), "c".to_string(), None, false);
        gc.set_cell_value((1, 5, sheet_id).into(), "e".to_string(), None, false);

        let sheet = gc.sheet(sheet_id);

        // height should be 3 (1,1 - 1,3)
        assert_eq!(sheet.find_last_data_row(1, 1, 1), 3);

        // height should be 1 (1,5)
        assert_eq!(sheet.find_last_data_row(1, 5, 1), 1);

        // height should be 0 since there is no data
        assert_eq!(sheet.find_last_data_row(1, 11, 1), 0);
    }

    #[test]
    fn recalculate_bounds_validations() {
        let mut gc = GridController::test();
        let sheet_id = gc.sheet_ids()[0];
        gc.update_validation(
            ValidationUpdate {
                id: None,
                rule: ValidationRule::Logical(ValidationLogical {
                    show_checkbox: true,
                    ignore_blank: true,
                }),
                selection: A1Selection::test_a1_sheet_id("A1", sheet_id),
                message: Default::default(),
                error: Default::default(),
            },
            None,
            false,
        );

        let sheet = gc.sheet(sheet_id);
        assert_eq!(
            sheet.data_bounds,
            GridBounds::NonEmpty(Rect::new(1, 1, 1, 1))
        );
    }

    #[test]
    fn empty_bounds_with_borders() {
        let mut gc = GridController::test();
        let sheet_id = gc.sheet_ids()[0];

        gc.set_borders(
            A1Selection::test_a1("A1"),
            BorderSelection::All,
            Some(BorderStyle::default()),
            None,
            false,
        );

        let sheet = gc.sheet(sheet_id);
        assert_eq!(sheet.bounds(false), GridBounds::Empty);
    }

    #[test]
    fn test_row_bounds_formats() {
        let mut sheet = Sheet::test();

        sheet
            .formats
            .fill_color
            .set(Pos { x: 3, y: 1 }, Some("red".to_string()));
        sheet
            .formats
            .fill_color
            .set(Pos { x: 5, y: 1 }, Some("red".to_string()));

        // Check that the bounds include the formatted row
        assert_eq!(sheet.row_bounds_formats(1), Some((3, 5)));

        // Check that the data bounds are still empty
        assert_eq!(sheet.data_bounds, GridBounds::Empty);
    }

    #[test]
    fn test_find_next_column_for_rect() {
        let mut gc = GridController::default();
        let sheet_id = gc.sheet_ids()[0];

        // Set up some cells
        gc.set_cell_value((1, 1, sheet_id).into(), "a".to_string(), None, false);
        gc.set_cell_value((3, 1, sheet_id).into(), "b".to_string(), None, false);
        gc.set_cell_value((5, 1, sheet_id).into(), "c".to_string(), None, false);

        let sheet = gc.sheet(sheet_id);

        // Find next column to the right
        let rect = Rect::from_numbers(0, 0, 1, 1);
        let result = sheet.find_next_column_for_rect(1, 1, false, rect);
        assert_eq!(result, 2);

        // Find next column to the left
        let result = sheet.find_next_column_for_rect(5, 1, true, rect);
        assert_eq!(result, 4);

        // Find next column with larger rect (right)
        let rect = Rect::from_numbers(0, 0, 2, 1);
        let result = sheet.find_next_column_for_rect(1, 1, false, rect);
        assert_eq!(result, 6);

        // Find next column with larger rect (left)
        let result = sheet.find_next_column_for_rect(5, 1, true, rect);
        assert_eq!(result, -1);

        // No available column
        let rect = Rect::from_numbers(0, 0, 10, 1);
        let result = sheet.find_next_column_for_rect(0, 1, false, rect);
        assert_eq!(result, 6);

        // With multiple obstacles
        gc.set_cell_value((7, 1, sheet_id).into(), "d".to_string(), None, false);
        gc.set_cell_value((9, 1, sheet_id).into(), "e".to_string(), None, false);
        let rect = Rect::from_numbers(0, 0, 1, 1);
        let sheet = gc.sheet(sheet_id);
        let result = sheet.find_next_column_for_rect(0, 1, false, rect);
        assert_eq!(result, 0);
        let result = sheet.find_next_column_for_rect(1, 1, false, rect);
        assert_eq!(result, 2);
        let result = sheet.find_next_column_for_rect(4, 1, false, rect);
        assert_eq!(result, 4);
        let result = sheet.find_next_column_for_rect(7, 1, false, rect);
        assert_eq!(result, 8);

        // Larger rect and multiple obstacles
        let rect = Rect::from_numbers(0, 0, 10, 1);
        let result = sheet.find_next_column_for_rect(0, 1, false, rect);
        assert_eq!(result, 10);
    }

    #[test]
    fn test_find_next_row_for_rect() {
        let mut gc = GridController::default();
        let sheet_id = gc.sheet_ids()[0];

        // Set up some cells
        gc.set_cell_value((1, 1, sheet_id).into(), "a".to_string(), None, false);
        gc.set_cell_value((1, 3, sheet_id).into(), "b".to_string(), None, false);
        gc.set_cell_value((1, 5, sheet_id).into(), "c".to_string(), None, false);

        let sheet = gc.sheet(sheet_id);

        // Find next row downwards
        let rect = Rect::from_numbers(0, 0, 1, 1);
        let result = sheet.find_next_row_for_rect(1, 1, false, rect);
        assert_eq!(result, 2);

        // Find next row upwards
        let result = sheet.find_next_row_for_rect(5, 1, true, rect);
        assert_eq!(result, 4);

        // Find next row with larger rect (down)
        let rect = Rect::from_numbers(0, 0, 1, 2);
        let result = sheet.find_next_row_for_rect(1, 1, false, rect);
        assert_eq!(result, 6);

        // Find next row with larger rect (up)
        let result = sheet.find_next_row_for_rect(5, 1, true, rect);
        assert_eq!(result, -1);

        // No available row
        let rect = Rect::from_numbers(0, 0, 1, 10);
        let result = sheet.find_next_row_for_rect(0, 1, false, rect);
        assert_eq!(result, 6);

        // With multiple obstacles
        gc.set_cell_value((1, 7, sheet_id).into(), "d".to_string(), None, false);
        gc.set_cell_value((1, 9, sheet_id).into(), "e".to_string(), None, false);
        let rect = Rect::from_numbers(0, 0, 1, 1);
        let sheet = gc.sheet(sheet_id);
        let result = sheet.find_next_row_for_rect(0, 1, false, rect);
        assert_eq!(result, 0);
        let result = sheet.find_next_row_for_rect(1, 1, false, rect);
        assert_eq!(result, 2);
        let result = sheet.find_next_row_for_rect(4, 1, false, rect);
        assert_eq!(result, 4);
        let result = sheet.find_next_row_for_rect(7, 1, false, rect);
        assert_eq!(result, 8);

        // Larger rect and multiple obstacles
        let rect = Rect::from_numbers(0, 0, 1, 10);
        let result = sheet.find_next_row_for_rect(0, 1, false, rect);
        assert_eq!(result, 10);
    }

    #[test]
    fn test_find_tabular_data_rects_in_selection_rects() {
        let (mut gc, sheet_id, _, _) = simple_csv_at(pos![B2]);

        let sheet = gc.sheet_mut(sheet_id);
        sheet.set_cell_values(
            Rect {
                min: Pos { x: 6, y: 2 },
                max: Pos { x: 15, y: 101 },
            },
            Array::from(
                (2..=101)
                    .map(|row| {
                        (6..=15)
                            .map(|_| {
                                if row == 2 {
                                    "heading1".to_string()
                                } else {
                                    "value1".to_string()
                                }
                            })
                            .collect::<Vec<String>>()
                    })
                    .collect::<Vec<Vec<String>>>(),
            ),
        );

        sheet.set_cell_values(
            Rect {
                min: Pos { x: 31, y: 101 },
                max: Pos { x: 35, y: 303 },
            },
            Array::from(
                (101..=303)
                    .map(|row| {
                        (31..=35)
                            .map(|_| {
                                if row == 101 {
                                    "heading2".to_string()
                                } else {
                                    "value2".to_string()
                                }
                            })
                            .collect::<Vec<String>>()
                    })
                    .collect::<Vec<Vec<String>>>(),
            ),
        );

        let tabular_data_rects =
            sheet.find_tabular_data_rects_in_selection_rects(vec![Rect::new(1, 1, 50, 400)]);
        assert_eq!(tabular_data_rects.len(), 2);

        let expected_rects = vec![
            Rect::from_numbers(6, 2, 10, 100),
            Rect::from_numbers(31, 101, 5, 203),
        ];
        assert_eq!(tabular_data_rects, expected_rects);
    }

    #[test]
    fn test_find_tabular_data_rects_with_single_cell_code_tables() {
        let mut gc = test_create_gc();
        let sheet_id = first_sheet_id(&gc);

        for y in 1..=10 {
            gc.set_code_cell(
                SheetPos { x: 1, y, sheet_id },
                CodeCellLanguage::Formula,
                "15".to_string(),
                None,
                None,
                false,
            );
        }
        gc.set_code_cell(
            pos![sheet_id!A11],
            CodeCellLanguage::Formula,
            "{1,2,3}".to_string(),
            None,
            None,
            false,
        );

        let sheet = gc.sheet(sheet_id);
        let tabular_data_rects =
            sheet.find_tabular_data_rects_in_selection_rects(vec![rect![A1:J10]]);
        assert_eq!(tabular_data_rects.len(), 1);
        assert_eq!(tabular_data_rects[0], rect![A1:A10]);
    }
}
