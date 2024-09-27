use itertools::Itertools;

use crate::Rect;

use super::Selection;

impl Selection {
    /// Convert A1 notation column to a column index
    pub fn from_a1_column(a1_column: &str) -> u64 {
        let total_alphabets = (b'Z' - b'A' + 1) as u64;
        let mut result = 0;
        for (i, &c) in a1_column.as_bytes().iter().rev().enumerate() {
            if c < b'A' || c > b'Z' {
                return 0; // Invalid character
            }
            result += (c - b'A' + 1) as u64 * total_alphabets.pow(i as u32);
        }
        result
    }

    /// Convert column (x) to A1 notation
    fn to_a1_column(x: u64) -> String {
        // x is already 1-based, so we don't need to add 1
        let column = x;

        let mut a1_notation = Vec::new();
        let total_alphabets = (b'Z' - b'A' + 1) as u64;
        let mut block = column;

        while block > 0 {
            block -= 1; // Subtract 1 before calculating the character
            let char_code = (block % total_alphabets) as u8 + b'A';
            a1_notation.push(char_code as char);
            block = block / total_alphabets;
        }

        // Reverse the vector and convert to string
        a1_notation.reverse();
        a1_notation.into_iter().collect()
    }

    /// Converts a position to an A1-style string.
    pub fn pos_to_a1(x: u64, y: u64) -> String {
        format!("{}{}", Selection::to_a1_column(x), y)
    }

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
                    results.push(format!(
                        "{}:{}",
                        Selection::to_a1_column(s),
                        Selection::to_a1_column(c)
                    ));
                    start = Some(column);
                    current = None;
                }
            } else {
                current = Some(column);
            }
        }
        if let (Some(start), Some(current)) = (start, current) {
            results.push(format!(
                "{}:{}",
                Selection::to_a1_column(start),
                Selection::to_a1_column(current)
            ));
        } else if let Some(start) = start {
            results.push(format!("{}", Selection::to_a1_column(start)));
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
                Selection::pos_to_a1(x0, y0),
                Selection::pos_to_a1(x1, y1)
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
            results.push(Selection::pos_to_a1(self.x as u64, self.y as u64));
        }

        results.join(",")
    }
}

#[cfg(test)]
mod tests {
    use serial_test::parallel;

    use crate::grid::SheetId;

    use super::*;

    #[test]
    #[parallel]
    fn test_to_a1_column() {
        assert_eq!(Selection::to_a1_column(1), "A");
        assert_eq!(Selection::to_a1_column(2), "B");
        assert_eq!(Selection::to_a1_column(3), "C");
        assert_eq!(Selection::to_a1_column(25), "Y");
        assert_eq!(Selection::to_a1_column(26), "Z");
        assert_eq!(Selection::to_a1_column(27), "AA");
    }

    #[test]
    #[parallel]
    fn test_pos_to_a1() {
        assert_eq!(Selection::pos_to_a1(1, 1), "A1");
        assert_eq!(Selection::pos_to_a1(2, 1), "B1");
        assert_eq!(Selection::pos_to_a1(3, 1), "C1");
        assert_eq!(Selection::pos_to_a1(4, 1), "D1");
        assert_eq!(Selection::pos_to_a1(5, 1), "E1");
        assert_eq!(Selection::pos_to_a1(6, 1), "F1");

        // Test near ±26
        assert_eq!(Selection::pos_to_a1(25, 1), "Y1");
        assert_eq!(Selection::pos_to_a1(26, 1), "Z1");
        assert_eq!(Selection::pos_to_a1(27, 1), "AA1");
        assert_eq!(Selection::pos_to_a1(28, 1), "AB1");

        // Test near ±52
        assert_eq!(Selection::pos_to_a1(51, 1), "AY1");
        assert_eq!(Selection::pos_to_a1(52, 1), "AZ1");
        assert_eq!(Selection::pos_to_a1(53, 1), "BA1");
        assert_eq!(Selection::pos_to_a1(54, 1), "BB1");

        // Test near ±702
        assert_eq!(Selection::pos_to_a1(701, 1), "ZY1");
        assert_eq!(Selection::pos_to_a1(702, 1), "ZZ1");
        assert_eq!(Selection::pos_to_a1(703, 1), "AAA1");
        assert_eq!(Selection::pos_to_a1(704, 1), "AAB1");
    }

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
}
