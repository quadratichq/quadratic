use itertools::Itertools;

use crate::{Rect, A1};

use super::*;

impl Selection {
    /// Convert columns to A1 notation.
    fn columns_to_a1(columns: &[i64]) -> Vec<String> {
        let mut results = vec![];
        let mut start: Option<u64> = None;
        let mut current: Option<u64> = None;
        for column in columns.iter().sorted() {
            // Skip negative columns as they're no longer supported.
            if *column < 0 {
                continue;
            }
            let column = *column as u64;
            if start.is_none() {
                start = Some(column);
                current = None;
            } else if let (Some(s), Some(c)) = (start, current) {
                if c + 1 == column {
                    current = Some(column);
                } else {
                    results.push(format!("{}:{}", A1::x_to_a1(s), A1::x_to_a1(c)));
                    start = Some(column);
                    current = None;
                }
            } else {
                current = Some(column);
            }
        }
        if let (Some(start), Some(current)) = (start, current) {
            results.push(format!("{}:{}", A1::x_to_a1(start), A1::x_to_a1(current)));
        } else if let Some(start) = start {
            results.push(A1::x_to_a1(start));
        }
        results
    }

    /// Convert rows to A1 notation.
    fn rows_to_a1(rows: &[i64]) -> Vec<String> {
        let mut results = vec![];
        let mut start: Option<u64> = None;
        let mut current: Option<u64> = None;
        for row in rows.iter().sorted() {
            let row = *row as u64;
            if start.is_none() {
                start = Some(row);
                current = None;
            } else if let (Some(s), Some(c)) = (start, current) {
                if c + 1 == row {
                    current = Some(row);
                } else {
                    results.push(format!("{}:{}", s, c));
                    start = Some(row);
                    current = None;
                }
            } else {
                current = Some(row);
            }
        }
        if let (Some(start), Some(current)) = (start, current) {
            results.push(format!("{}:{}", start, current));
        } else if let Some(start) = start {
            results.push(format!("{}", start));
        }
        results
    }

    pub fn rects_to_a1(rects: &[Rect]) -> Vec<String> {
        let mut results = vec![];
        for rect in rects.iter() {
            if rect.width() == 1 && rect.height() == 1 {
                results.push(A1::pos_to_a1(rect.min.x as u64, rect.min.y as u64));
                continue;
            }
            // skip any negative values
            if rect.min.x <= 0 || rect.min.y <= 0 || rect.max.x <= 0 || rect.max.y <= 0 {
                continue;
            }
            let x0 = rect.min.x as u64;
            let y0 = rect.min.y as u64;
            let x1 = rect.max.x as u64;
            let y1 = rect.max.y as u64;
            results.push(format!(
                "{}:{}",
                A1::pos_to_a1(x0, y0),
                A1::pos_to_a1(x1, y1)
            ));
        }
        results
    }

    /// Converts a selection to an A1-style string.
    pub fn to_a1(&self) -> String {
        if self.all {
            return "*".to_string();
        }

        let mut results = vec![];

        if let Some(columns) = self.columns.as_ref() {
            results.extend(Selection::columns_to_a1(columns));
        }

        if let Some(rows) = self.rows.as_ref() {
            results.extend(Selection::rows_to_a1(rows));
        }

        if let Some(rects) = self.rects.as_ref() {
            results.extend(Selection::rects_to_a1(rects));
        }

        if results.is_empty() {
            results.push(A1::pos_to_a1(self.x as u64, self.y as u64));
        }

        results.join(",")
    }
}

#[cfg(test)]
mod tests {
    use std::collections::HashMap;

    use serial_test::parallel;

    use crate::grid::SheetId;

    use super::*;

    #[test]
    #[parallel]
    fn test_to_a1_all() {
        let selection = Selection::all(SheetId::test());
        assert_eq!(selection.to_a1(), "*");
    }

    #[test]
    #[parallel]
    fn test_to_a1_columns() {
        let selection = Selection::columns(&[1, 2, 3, 4, 5, 10, 11, 12, 15], SheetId::test());
        assert_eq!(selection.to_a1(), "A:E,J:L,O");
    }

    #[test]
    #[parallel]
    fn test_to_a1_rows() {
        let selection = Selection::rows(&[1, 2, 3, 4, 5, 10, 11, 12, 15], SheetId::test());
        assert_eq!(selection.to_a1(), "1:5,10:12,15");
    }

    #[test]
    #[parallel]
    fn test_to_a1_rects() {
        let selection = Selection::rects(
            &[Rect::new(1, 1, 2, 2), Rect::new(3, 3, 4, 4)],
            SheetId::test(),
        );
        assert_eq!(selection.to_a1(), "A1:B2,C3:D4");
    }

    #[test]
    #[parallel]
    fn test_to_a1_pos() {
        let selection = Selection {
            x: 1,
            y: 1,
            sheet_id: SheetId::test(),
            ..Default::default()
        };
        assert_eq!(selection.to_a1(), "A1");
    }

    #[test]
    #[parallel]
    fn test_to_a1() {
        let selection = Selection {
            sheet_id: SheetId::test(),
            x: 10, // this should be ignored
            y: 11, // this should be ignored
            all: false,
            rects: Some(vec![Rect::new(1, 1, 2, 2), Rect::new(3, 3, 4, 4)]),
            columns: Some(vec![1, 2, 3, 4, 5, 10, 11, 12, 15]),
            rows: Some(vec![1, 2, 3, 4, 5, 10, 11, 12, 15]),
        };
        assert_eq!(selection.to_a1(), "A:E,J:L,O,1:5,10:12,15,A1:B2,C3:D4");
    }

    #[test]
    #[parallel]
    fn test_a1_with_one_sized_rect() {
        let selection = Selection {
            sheet_id: SheetId::test(),
            x: 1,
            y: 1,
            all: false,
            rects: Some(vec![Rect::new(1, 1, 1, 1)]),
            columns: None,
            rows: None,
        };
        assert_eq!(selection.to_a1(), "A1");
    }

    #[test]
    #[parallel]
    fn test_extra_comma() {
        let sheet_id = SheetId::test();
        let selection = Selection::from_a1("1,", sheet_id, HashMap::new()).unwrap();
        assert_eq!(selection.to_a1(), "1");
    }

    #[test]
    #[parallel]
    fn test_multiple_one_sized_rects() {
        let sheet_id = SheetId::test();
        let selection = Selection::from_a1("A1,B1,C1", sheet_id, HashMap::new()).unwrap();
        assert_eq!(selection.to_a1(), "A1,B1,C1");
    }
}
