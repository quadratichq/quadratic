use crate::{
    grid::{formats::format::Format, CodeRunResult, GridBounds},
    selection::Selection,
    CellValue, Pos, Rect, SheetRect, Value,
};

use super::Sheet;

impl Sheet {
    /// Returns a Vec of (Pos, &CellValue) for a Selection in the Sheet.
    /// Note: there's an order of precedence in enumerating the selection:
    /// 1. All
    /// 2. Columns
    /// 3. Rows
    /// 4. Rects
    /// If the selection is empty or the count > max_count then it returns None.
    /// It ignores CellValue::Blank, and CellValue::Code (since it uses the CodeRun instead).
    ///
    /// Note: if the Code has an error, then it will not be part of the result (for now).
    pub fn selection(
        &self,
        selection: &Selection,
        max_count: Option<i64>,
        skip_code_runs: bool,
    ) -> Option<Vec<(Pos, &CellValue)>> {
        let mut count = 0;
        let mut vec = Vec::new();

        // This checks whether we should skip a CellValue::Code. We skip the
        // code cell if `skip_code_runs`` is true. For example, when running
        // summarize, we want the values of the code run, not the actual code
        // cell. Conversely, when we're deleting a cell, we want the code cell,
        // not the code run.
        let check_code =
            |entry: &CellValue| skip_code_runs || !matches!(entry, &CellValue::Code(_));

        if selection.all {
            for (x, column) in self.columns.iter() {
                count += column.values.len() as i64;
                if count >= max_count.unwrap_or(i64::MAX) {
                    return None;
                }
                vec.extend(column.values.iter().filter_map(|(y, entry)| {
                    if !matches!(entry, &CellValue::Blank) && check_code(entry) {
                        Some((Pos { x: *x, y: *y }, entry))
                    } else {
                        None
                    }
                }));
            }
            if !skip_code_runs {
                for (pos, code_run) in self.code_runs.iter() {
                    match code_run.result {
                        CodeRunResult::Ok(ref value) => match value {
                            Value::Single(v) => {
                                count += 1;
                                if count >= max_count.unwrap_or(i64::MAX) {
                                    return None;
                                }
                                vec.push((*pos, v));
                            }
                            Value::Array(a) => {
                                for x in 0..a.width() {
                                    for y in 0..a.height() {
                                        if let Ok(entry) = a.get(x, y) {
                                            if !matches!(entry, &CellValue::Blank) {
                                                count += 1;
                                                if count >= max_count.unwrap_or(i64::MAX) {
                                                    return None;
                                                }
                                                vec.push((
                                                    Pos {
                                                        x: x as i64 + pos.x,
                                                        y: y as i64 + pos.y,
                                                    },
                                                    entry,
                                                ));
                                            }
                                        }
                                    }
                                }
                            }
                        },
                        CodeRunResult::Err(_) => {}
                    }
                }
            }
        } else if let Some(columns) = selection.columns.as_ref() {
            for x in columns.iter() {
                if let Some(column) = self.columns.get(x) {
                    count += column.values.len() as i64;
                    if count >= max_count.unwrap_or(i64::MAX) {
                        return None;
                    }
                    vec.extend(column.values.iter().filter_map(|(y, entry)| {
                        if !matches!(entry, &CellValue::Blank) && check_code(entry) {
                            Some((Pos { x: *x, y: *y }, entry))
                        } else {
                            None
                        }
                    }));
                }
            }
            if !skip_code_runs {
                for (pos, code_run) in self.code_runs.iter() {
                    let rect = code_run.output_rect(*pos, false);
                    if columns
                        .iter()
                        .any(|column| *column >= rect.min.x && *column <= rect.max.x)
                    {
                        for x in rect.min.x..=rect.max.x {
                            if columns.contains(&x) {
                                for y in rect.min.y..=rect.max.y {
                                    if let Some(entry) = code_run
                                        .cell_value_ref((x - pos.x) as u32, (y - pos.y) as u32)
                                    {
                                        if !matches!(entry, &CellValue::Blank) {
                                            count += 1;
                                            if count >= max_count.unwrap_or(i64::MAX) {
                                                return None;
                                            }
                                            vec.push((Pos { x, y }, entry));
                                        }
                                    }
                                }
                            }
                        }
                    }
                }
            }
        } else if let Some(rows) = selection.rows.as_ref() {
            for (x, column) in self.columns.iter() {
                for (y, entry) in column.values.iter() {
                    if rows.contains(y) && !matches!(entry, &CellValue::Blank) && check_code(entry)
                    {
                        count += 1;
                        if count >= max_count.unwrap_or(i64::MAX) {
                            return None;
                        }
                        vec.push((Pos { x: *x, y: *y }, entry));
                    }
                }
            }
            if !skip_code_runs {
                for (pos, code_run) in self.code_runs.iter() {
                    let rect = code_run.output_rect(*pos, false);
                    for y in rect.min.y..=rect.max.y {
                        if rows.contains(&y) {
                            for x in rect.min.x..=rect.max.x {
                                if let Some(entry) =
                                    code_run.cell_value_ref((x - pos.x) as u32, (y - pos.y) as u32)
                                {
                                    if !matches!(entry, &CellValue::Blank) {
                                        count += 1;
                                        if count >= max_count.unwrap_or(i64::MAX) {
                                            return None;
                                        }
                                        vec.push((Pos { x, y }, entry));
                                    }
                                }
                            }
                        }
                    }
                }
            }
        } else if let Some(rects) = selection.rects.as_ref() {
            for rect in rects.iter() {
                for x in rect.min.x..=rect.max.x {
                    for y in rect.min.y..=rect.max.y {
                        if let Some(entry) = self.cell_value_ref(Pos { x, y }) {
                            if !matches!(entry, &CellValue::Blank) && check_code(entry) {
                                count += 1;
                                if count >= max_count.unwrap_or(i64::MAX) {
                                    return None;
                                }
                                vec.push((Pos { x, y }, entry));
                            }
                        }
                    }
                }
            }
            if !skip_code_runs {
                for (pos, code_run) in self.code_runs.iter() {
                    let rect = code_run.output_rect(*pos, false);
                    for x in rect.min.x..=rect.max.x {
                        for y in rect.min.y..=rect.max.y {
                            if rects.iter().any(|rect| rect.contains(Pos { x, y })) {
                                if let Some(entry) =
                                    code_run.cell_value_ref((x - pos.x) as u32, (y - pos.y) as u32)
                                {
                                    if !matches!(entry, &CellValue::Blank) {
                                        count += 1;
                                        if count >= max_count.unwrap_or(i64::MAX) {
                                            return None;
                                        }
                                        vec.push((Pos { x, y }, entry));
                                    }
                                }
                            }
                        }
                    }
                }
            }
        }
        Some(vec)
    }

    /// Gets a selection with bounds. This is useful for dealing with a
    /// rectangular selection. If sort is true, then values are sorted
    /// ascending, by y and then x.
    pub(crate) fn selection_with_bounds(
        &self,
        selection: &Selection,
        skip_code_runs: bool,
        sort: bool,
    ) -> Option<(Rect, Vec<(Pos, &CellValue)>)> {
        let mut values = self.selection(selection, None, skip_code_runs)?;
        let bounds: Vec<Pos> = values.iter().map(|(pos, _)| *pos).collect();
        if sort {
            values.sort_by(|(a, _), (b, _)| {
                if a.y < b.y {
                    return std::cmp::Ordering::Less;
                }
                if a.y > b.y {
                    return std::cmp::Ordering::Greater;
                }
                a.x.cmp(&b.x)
            });
        }
        Some((bounds.into(), values))
    }

    /// Gets a sheet_rect of the selection area. For selection.columns and
    /// selection.rows, we find the minimum index, and return either that, or 0
    /// if that index > 0. This ensures we're always at least copying from the
    /// top or left of the sheet.
    pub(crate) fn clipboard_selection(&self, selection: &Selection) -> Option<SheetRect> {
        let ignore_formatting = true;

        if selection.all {
            match self.bounds(false) {
                GridBounds::Empty => None,
                GridBounds::NonEmpty(rect) => Some(rect.to_sheet_rect(selection.sheet_id)),
            }
        } else if let Some(columns) = selection.columns.as_ref() {
            if columns.is_empty() {
                return None;
            }
            let min_x = columns.iter().min().unwrap_or(&0).to_owned();
            let max_x = columns.iter().max().unwrap_or(&0).to_owned();
            let mut min_y = i64::MAX;
            let mut max_y = i64::MIN;
            for i in min_x..=max_x {
                if let Some((min, max)) = self.column_bounds(i, ignore_formatting) {
                    min_y = min_y.min(min);
                    max_y = max_y.max(max);
                }
            }
            if min_x == i64::MAX || min_y == i64::MAX {
                None
            } else {
                Some(SheetRect {
                    min: Pos { x: min_x, y: min_y },
                    max: Pos { x: max_x, y: max_y },
                    sheet_id: selection.sheet_id,
                })
            }
        } else if let Some(rows) = selection.rows.as_ref() {
            if rows.is_empty() {
                return None;
            }
            let min_y = rows.iter().min().unwrap_or(&0).to_owned();
            let max_y = rows.iter().max().unwrap_or(&0).to_owned();
            let mut min_x = i64::MAX;
            let mut max_x = i64::MIN;
            for i in min_y..=max_y {
                if let Some((min, max)) = self.row_bounds(i, ignore_formatting) {
                    min_x = min_x.min(min);
                    max_x = max_x.max(max);
                }
            }
            if min_y == i64::MAX || min_x == i64::MAX {
                None
            } else {
                Some(SheetRect {
                    min: Pos { x: min_x, y: min_y },
                    max: Pos { x: max_x, y: max_y },
                    sheet_id: self.id,
                })
            }
        } else {
            selection.largest_rect()
        }
    }

    /// Gets a list of cells with formatting for a selection. Only cells with a
    /// format are returned.
    /// TODO: return &Format when we change how formats are stored internally.
    pub fn format_selection(&self, selection: &Selection) -> Vec<(Pos, Format)> {
        let mut vec = vec![];
        if selection.all {
            if let GridBounds::NonEmpty(bounds) = self.format_bounds {
                for x in bounds.min.x..=bounds.max.x {
                    if let Some(column) = self.columns.get(&x) {
                        for y in bounds.min.y..=bounds.max.y {
                            if let Some(format) = column.format(y) {
                                vec.push((Pos { x, y }, format));
                            }
                        }
                    }
                }
            }
        } else if let Some(columns) = selection.columns.as_ref() {
            vec = vec![];
            columns.iter().for_each(|x| {
                if let Some(column) = self.get_column(*x) {
                    if let Some(range) = column.format_range() {
                        for y in range.start..=range.end {
                            if let Some(format) = column.format(y) {
                                vec.push((Pos { x: *x, y }, format));
                            }
                        }
                    }
                }
            });
        } else if let Some(rows) = selection.rows.as_ref() {
            self.columns.iter().for_each(|(x, column)| {
                if let Some(range) = column.format_range() {
                    rows.iter().for_each(|y| {
                        if range.contains(y) {
                            if let Some(format) = column.format(*y) {
                                vec.push((Pos { x: *x, y: *y }, format));
                            }
                        }
                    });
                }
            });
        } else if let Some(rects) = selection.rects.as_ref() {
            for rect in rects {
                for x in rect.min.x..=rect.max.x {
                    if let Some(column) = self.columns.get(&x) {
                        for y in rect.min.y..=rect.max.y {
                            if let Some(format) = column.format(y) {
                                vec.push((Pos { x, y }, format));
                            }
                        }
                    }
                }
            }
        }
        vec
    }
}

#[cfg(test)]
mod tests {
    use std::str::FromStr;

    use bigdecimal::BigDecimal;

    use crate::{
        grid::{formats::format_update::FormatUpdate, CodeCellLanguage},
        CodeCellValue, Rect,
    };

    use super::*;

    #[test]
    fn selection_all() {
        let mut sheet = Sheet::test();
        sheet.test_set_values(
            0,
            0,
            3,
            3,
            vec!["1", "2", "3", "4", "5", "6", "7", "8", "9"],
        );
        sheet.test_set_code_run_array(-1, -10, vec!["1", "2", "3"], true);

        let selection = Selection {
            sheet_id: sheet.id,
            x: 0,
            y: 0,
            rects: None,
            rows: None,
            columns: None,
            all: true,
        };

        let results = sheet.selection(&selection, None, false).unwrap();
        assert_eq!(results.len(), 12);

        let results = sheet.selection(&selection, Some(10), false);
        assert!(results.is_none());

        let results = sheet.selection(&selection, None, true).unwrap();
        assert_eq!(results.len(), 10);
    }

    #[test]
    fn selection_columns() {
        let mut sheet = Sheet::test();
        sheet.test_set_values(
            0,
            0,
            3,
            3,
            vec!["1", "2", "3", "4", "5", "6", "7", "8", "9"],
        );
        sheet.test_set_code_run_single(
            0,
            5,
            CellValue::Number(BigDecimal::from_str("11").unwrap()),
        );
        sheet.test_set_code_run_array(-1, 0, vec!["10", "11", "12"], true);

        assert_eq!(
            sheet.display_value(Pos { x: -1, y: -0 }),
            Some(CellValue::Number(BigDecimal::from_str("10.0").unwrap()))
        );

        let selection = Selection {
            sheet_id: sheet.id,
            x: 0,
            y: 0,
            rects: None,
            rows: None,
            columns: Some(vec![0, 1, -1]),
            all: false,
        };

        let results = sheet.selection(&selection, None, false).unwrap();
        assert_eq!(results.len(), 10);
        assert_eq!(
            results.first(),
            Some(&(
                Pos { x: 0, y: 0 },
                &CellValue::Number(BigDecimal::from_str("1").unwrap())
            ))
        );
        assert_eq!(
            results.get(9),
            Some(&(
                Pos { x: -1, y: 2 },
                &CellValue::Number(BigDecimal::from_str("12").unwrap())
            ))
        );

        let results = sheet.selection(&selection, Some(5), false);
        assert!(results.is_none());

        let results = sheet.selection(&selection, None, true).unwrap();
        assert_eq!(results.len(), 8);
    }

    #[test]
    fn selection_rows() {
        let mut sheet = Sheet::test();
        sheet.test_set_values(
            0,
            0,
            3,
            3,
            vec!["1", "2", "3", "4", "5", "6", "7", "8", "9"],
        );
        sheet.test_set_code_run_array(-1, -10, vec!["1", "2", "3"], false);

        let selection = Selection {
            sheet_id: sheet.id,
            x: 0,
            y: 0,
            rects: None,
            rows: Some(vec![0, 1, -10]),
            columns: None,
            all: false,
        };

        let results = sheet.selection(&selection, None, false).unwrap();
        assert_eq!(results.len(), 9);

        let results = sheet.selection(&selection, Some(5), false);
        assert!(results.is_none());

        let results = sheet.selection(&selection, None, true).unwrap();
        assert_eq!(results.len(), 7);
    }

    #[test]
    fn selection_rects_values() {
        let mut sheet = Sheet::test();
        // create a 3x3 array at 0,0
        sheet.test_set_values(
            0,
            0,
            3,
            3,
            vec!["1", "2", "3", "4", "5", "6", "7", "8", "9"],
        );
        let rects = vec![
            Rect::from_numbers(0, 0, 1, 1),
            Rect::from_numbers(1, 1, 2, 2),
        ];
        let results = sheet
            .selection(
                &Selection {
                    sheet_id: sheet.id,
                    x: 0,
                    y: 0,
                    rects: Some(rects.clone()),
                    rows: None,
                    columns: None,
                    all: false,
                },
                None,
                false,
            )
            .unwrap();
        assert_eq!(
            results,
            vec![
                (Pos { x: 0, y: 0 }, &CellValue::Number(1.into())),
                (Pos { x: 1, y: 1 }, &CellValue::Number(5.into())),
                (Pos { x: 1, y: 2 }, &CellValue::Number(8.into())),
                (Pos { x: 2, y: 1 }, &CellValue::Number(6.into())),
                (Pos { x: 2, y: 2 }, &CellValue::Number(9.into())),
            ]
        );
        assert!(sheet
            .selection(
                &Selection {
                    sheet_id: sheet.id,
                    x: 0,
                    y: 0,
                    rects: Some(rects),
                    rows: None,
                    columns: None,
                    all: false,
                },
                Some(3),
                false,
            )
            .is_none());
    }

    #[test]
    fn selection_rects_code() {
        let mut sheet = Sheet::test();

        // create a 1x3 array at 4,0
        sheet.test_set_code_run_array(4, 0, vec!["1", "2", "3"], true);

        let rects = vec![
            Rect::from_numbers(4, 0, 1, 1),
            Rect::from_numbers(4, 2, 1, 2),
        ];
        let results = sheet
            .selection(
                &Selection {
                    sheet_id: sheet.id,
                    x: 0,
                    y: 0,
                    rects: Some(rects.clone()),
                    rows: None,
                    columns: None,
                    all: false,
                },
                None,
                false,
            )
            .unwrap();
        assert_eq!(
            results,
            vec![
                (Pos { x: 4, y: 0 }, &CellValue::Number(1.into())),
                (Pos { x: 4, y: 2 }, &CellValue::Number(3.into())),
            ]
        );

        assert!(sheet
            .selection(
                &Selection {
                    sheet_id: sheet.id,
                    x: 0,
                    y: 0,
                    rects: Some(rects.clone()),
                    rows: None,
                    columns: None,
                    all: false,
                },
                Some(1),
                false,
            )
            .is_none());

        let results = sheet
            .selection(
                &Selection {
                    sheet_id: sheet.id,
                    x: 0,
                    y: 0,
                    rects: Some(rects),
                    rows: None,
                    columns: None,
                    all: false,
                },
                None,
                true,
            )
            .unwrap();
        assert_eq!(results.len(), 1);
        assert_eq!(
            results[0],
            (
                Pos { x: 4, y: 0 },
                &CellValue::Code(CodeCellValue {
                    language: CodeCellLanguage::Formula,
                    code: "".to_string()
                })
            )
        );
    }

    #[test]
    fn clipboard_selection() {
        let mut sheet = Sheet::test();
        let sheet_id = sheet.id;

        let selection = Selection {
            sheet_id,
            ..Default::default()
        };
        assert_eq!(sheet.clipboard_selection(&selection), None);

        sheet.test_set_values(0, 0, 2, 2, vec!["1", "2", "a", "b"]);
        sheet.test_set_code_run_array(-1, -1, vec!["c", "d", "e"], true);

        let selection = Selection {
            sheet_id,
            rects: Some(vec![Rect::from_numbers(-4, -4, 10, 10)]),
            ..Default::default()
        };
        assert_eq!(
            sheet.clipboard_selection(&selection),
            Some(SheetRect::from_numbers(-4, -4, 10, 10, sheet_id))
        );

        let selection = Selection {
            sheet_id,
            columns: Some(vec![-1, 0]),
            ..Default::default()
        };
        assert_eq!(
            sheet.clipboard_selection(&selection),
            Some(SheetRect::from_numbers(-1, -1, 2, 3, sheet_id))
        );

        let selection = Selection {
            sheet_id,
            columns: Some(vec![5, 6]),
            ..Default::default()
        };
        assert_eq!(sheet.clipboard_selection(&selection), None);

        let selection = Selection {
            sheet_id,
            rows: Some(vec![-1, 0]),
            ..Default::default()
        };
        assert_eq!(
            sheet.clipboard_selection(&selection),
            Some(SheetRect {
                min: Pos { x: -1, y: -1 },
                max: Pos { x: 1, y: 0 },
                sheet_id
            })
        );

        let selection = Selection {
            sheet_id,
            rows: Some(vec![-10, -11]),
            ..Default::default()
        };
        assert_eq!(sheet.clipboard_selection(&selection), None);
    }

    #[test]
    fn format_selection() {
        let mut sheet = Sheet::test();
        let sheet_id = sheet.id;

        let selection = Selection {
            sheet_id,
            ..Default::default()
        };
        assert_eq!(sheet.format_selection(&selection), vec![]);

        sheet.test_set_format(
            0,
            0,
            FormatUpdate {
                bold: Some(Some(true)),
                ..Default::default()
            },
        );
        sheet.test_set_format(
            1,
            1,
            FormatUpdate {
                bold: Some(Some(false)),
                ..Default::default()
            },
        );

        let selection = Selection {
            sheet_id,
            rects: Some(vec![Rect::from_numbers(0, 0, 2, 2)]),
            ..Default::default()
        };
        assert_eq!(
            sheet.format_selection(&selection),
            vec![
                (
                    Pos { x: 0, y: 0 },
                    Format {
                        bold: Some(true),
                        ..Default::default()
                    }
                ),
                (
                    Pos { x: 1, y: 1 },
                    Format {
                        bold: Some(false),
                        ..Default::default()
                    }
                )
            ]
        );

        let selection = Selection {
            sheet_id,
            columns: Some(vec![0, 1]),
            ..Default::default()
        };
        assert_eq!(
            sheet.format_selection(&selection),
            vec![
                (
                    Pos { x: 0, y: 0 },
                    Format {
                        bold: Some(true),
                        ..Default::default()
                    }
                ),
                (
                    Pos { x: 1, y: 1 },
                    Format {
                        bold: Some(false),
                        ..Default::default()
                    }
                ),
            ]
        );

        let selection = Selection {
            sheet_id,
            rows: Some(vec![0, 1]),
            ..Default::default()
        };
        assert_eq!(
            sheet.format_selection(&selection),
            vec![
                (
                    Pos { x: 0, y: 0 },
                    Format {
                        bold: Some(true),
                        ..Default::default()
                    }
                ),
                (
                    Pos { x: 1, y: 1 },
                    Format {
                        bold: Some(false),
                        ..Default::default()
                    }
                ),
            ]
        );
    }
}
