use crate::{grid::CodeRunResult, selection::Selection, CellValue, Pos, Value};

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
    /// Note: if the Code has an error, then it will not be part of the result (for now).
    pub fn selection(
        &self,
        selection: &Selection,
        max_count: Option<i64>,
    ) -> Option<Vec<(Pos, &CellValue)>> {
        let mut count = 0;
        let mut vec = Vec::new();

        if selection.all == true {
            for (x, column) in self.columns.iter() {
                count += column.values.len() as i64;
                if count >= max_count.unwrap_or(i64::MAX) {
                    return None;
                }
                vec.extend(column.values.iter().filter_map(|(y, entry)| {
                    if !matches!(entry, &CellValue::Blank) && !matches!(entry, &CellValue::Code(_))
                    {
                        Some((Pos { x: *x, y: *y }, entry))
                    } else {
                        None
                    }
                }));
            }
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
                                        if !matches!(entry, &CellValue::Blank)
                                            && !matches!(entry, &CellValue::Code(_))
                                        {
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
        } else if let Some(columns) = selection.columns {
            for x in columns.iter() {
                if let Some(column) = self.columns.get(x) {
                    count += column.values.len() as i64;
                    if count >= max_count.unwrap_or(i64::MAX) {
                        return None;
                    }
                    vec.extend(column.values.iter().filter_map(|(y, entry)| {
                        if !matches!(entry, &CellValue::Blank)
                            && !matches!(entry, &CellValue::Code(_))
                        {
                            Some((Pos { x: *x, y: *y }, entry))
                        } else {
                            None
                        }
                    }));
                }
            }
            for (pos, code_run) in self.code_runs.iter() {
                let rect = code_run.output_rect(*pos, false);
                if columns
                    .iter()
                    .any(|column| *column >= rect.min.x && *column <= rect.max.x)
                {
                    for x in rect.min.x..=rect.max.x {
                        if columns.contains(&x) {
                            for y in rect.min.y..=rect.max.y {
                                if let Some(entry) =
                                    code_run.cell_value_ref((x - pos.x) as u32, (y - pos.y) as u32)
                                {
                                    if !matches!(entry, &CellValue::Blank)
                                        && !matches!(entry, &CellValue::Code(_))
                                    {
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
        } else if let Some(rows) = selection.rows {
            for (x, column) in self.columns.iter() {
                for (y, entry) in column.values.iter() {
                    if rows.contains(y)
                        && !matches!(entry, &CellValue::Blank)
                        && !matches!(entry, &CellValue::Code(_))
                    {
                        count += 1;
                        if count >= max_count.unwrap_or(i64::MAX) {
                            return None;
                        }
                        vec.push((Pos { x: *x, y: *y }, entry));
                    }
                }
            }
            for (pos, code_run) in self.code_runs.iter() {
                let rect = code_run.output_rect(*pos, false);
                for y in rect.min.y..=rect.max.y {
                    if rows.contains(&y) {
                        for x in rect.min.x..=rect.max.x {
                            if let Some(entry) =
                                code_run.cell_value_ref((x - pos.x) as u32, (y - pos.y) as u32)
                            {
                                if !matches!(entry, &CellValue::Blank)
                                    && !matches!(entry, &CellValue::Code(_))
                                {
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
        } else if let Some(rects) = selection.rects {
            for rect in rects.iter() {
                for x in rect.min.x..=rect.max.x {
                    for y in rect.min.y..=rect.max.y {
                        if let Some(entry) = self.cell_value_ref(Pos { x, y }) {
                            if !matches!(entry, &CellValue::Blank)
                                && !matches!(entry, &CellValue::Code(_))
                            {
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
            for (pos, code_run) in self.code_runs.iter() {
                let rect = code_run.output_rect(*pos, false);
                for x in rect.min.x..=rect.max.x {
                    for y in rect.min.y..=rect.max.y {
                        if rects.iter().any(|rect| rect.contains(Pos { x, y })) {
                            if let Some(entry) =
                                code_run.cell_value_ref((x - pos.x) as u32, (y - pos.y) as u32)
                            {
                                if !matches!(entry, &CellValue::Blank)
                                    && !matches!(entry, &CellValue::Code(_))
                                {
                                    count += 1;
                                    if count >= max_count.unwrap_or(i64::MAX) {
                                        return None;
                                    }
                                    vec.push((
                                        Pos {
                                            x: x + pos.x,
                                            y: y + pos.y,
                                        },
                                        entry,
                                    ));
                                }
                            }
                        }
                    }
                }
            }
        }
        Some(vec)
    }
}

#[cfg(test)]
mod tests {
    use std::str::FromStr;

    use bigdecimal::BigDecimal;

    use crate::{grid::Sheet, selection::Selection, CellValue, Pos, Rect};

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

        let results = sheet.selection(selection, None).unwrap();
        assert_eq!(results.len(), 12);
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
        sheet.test_set_code_run(0, 5, "11");
        sheet.test_set_code_run_array(-1, -10, vec!["10", "11", "12"], true);

        assert_eq!(
            sheet.display_value(Pos { x: -1, y: -10 }),
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

        let results: Vec<(Pos, &CellValue)> = sheet.selection(selection, None).unwrap();
        assert_eq!(
            results.get(0),
            Some(&(
                Pos { x: 0, y: 0 },
                &CellValue::Number(BigDecimal::from_str("1").unwrap())
            ))
        );
        assert_eq!(
            results.get(9),
            Some(&(
                Pos { x: -1, y: -8 },
                &CellValue::Number(BigDecimal::from_str("12").unwrap())
            ))
        );
        assert_eq!(results.len(), 10);
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

        let results = sheet.selection(selection, None).unwrap();
        assert_eq!(results.len(), 9);
    }

    #[test]
    fn selection_rects() {
        let mut sheet = Sheet::test();
        sheet.test_set_values(
            0,
            0,
            3,
            3,
            vec!["1", "2", "3", "4", "5", "6", "7", "8", "9"],
        );
        sheet.test_set_code_run_array(-1, -10, vec!["1", "2", "3"], true);

        let results = sheet
            .selection(
                Selection {
                    sheet_id: sheet.id,
                    x: 0,
                    y: 0,
                    rects: Some(vec![
                        Rect::from_numbers(0, 0, 2, 2),
                        Rect::from_numbers(2, 2, 1, 1),
                    ]),
                    rows: None,
                    columns: None,
                    all: false,
                },
                None,
            )
            .unwrap();
        assert_eq!(results.len(), 5);

        let results = sheet
            .selection(
                Selection {
                    sheet_id: sheet.id,
                    x: 0,
                    y: 0,
                    rects: Some(vec![Rect::from_numbers(-2, -10, 2, 2)]),
                    rows: None,
                    columns: None,
                    all: false,
                },
                None,
            )
            .unwrap();
        assert_eq!(results.len(), 2);
    }
}
