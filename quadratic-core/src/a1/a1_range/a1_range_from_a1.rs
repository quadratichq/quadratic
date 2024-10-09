use crate::{a1::a1_sheet_name::try_sheet_name, grid::SheetId, A1Error, SheetNameIdMap};

use super::{A1Range, A1RangeType, RelColRow, RelColRowRange, RelPos, RelRect};

impl A1Range {
    /// Tries to convert an A1 part to a (column, relative).
    pub(crate) fn try_from_column(a1: &str) -> Option<RelColRow> {
        let mut a1 = a1.to_ascii_uppercase();
        let relative = if a1.starts_with('$') {
            a1 = a1[1..].to_string();
            false
        } else {
            true
        };
        if a1.is_empty() {
            return None;
        }
        let total_alphabets = (b'Z' - b'A' + 1) as u64;
        let mut column = 0;
        for (i, &c) in a1.as_bytes().iter().rev().enumerate() {
            if !c.is_ascii_uppercase() || c < b'A' || c > b'Z' {
                return None;
            }
            column += (c - b'A' + 1) as u64 * total_alphabets.pow(i as u32);
        }

        Some(RelColRow {
            index: column,
            relative,
        })
    }

    /// Tries to convert an A1 part to all.
    pub(crate) fn try_from_all(a1: &str) -> bool {
        a1 == "*"
    }

    /// Tries to convert an A1 part to RelColRow.
    pub(crate) fn try_from_row(a1: &str) -> Option<RelColRow> {
        // Return None if the input contains any letters
        if a1.chars().any(|c| c.is_alphabetic()) {
            return None;
        }
        let (a1, relative) = match a1.strip_prefix('$') {
            Some(stripped) => (stripped, false),
            None => (a1, true),
        };

        if !a1.chars().all(|c| c.is_ascii_digit()) {
            return None;
        }

        a1.parse::<u64>()
            .ok()
            .filter(|&x| x > 0)
            .map(|index| RelColRow { index, relative })
    }

    /// Tries to create Column(s) from an A1 string. Returns a vector of RelColRow.
    pub(crate) fn try_from_column_range(a1: &str) -> Option<RelColRowRange> {
        if !a1.contains(':') {
            return None;
        }
        a1.split_once(':').and_then(|(from, to)| {
            let (from, to) = match (Self::try_from_column(from), Self::try_from_column(to)) {
                (Some(a), Some(b)) if a.index <= b.index => (a, b),
                (Some(a), Some(b)) => (b, a),
                (Some(a), None) => (a, a),
                _ => return None,
            };
            Some(RelColRowRange { from, to })
        })
    }

    /// Tries to create Row ranges from an A1 string.
    pub(crate) fn try_from_row_range(a1: &str) -> Option<RelColRowRange> {
        if !a1.contains(':') {
            return None;
        }
        a1.split_once(':')
            .map(|(from, to)| {
                let from = Self::try_from_row(from);
                let to = Self::try_from_row(to);

                match (from, to) {
                    (Some(a), Some(b)) => {
                        let (from, to) = if a.index > b.index { (b, a) } else { (a, b) };
                        Some(RelColRowRange { from, to })
                    }
                    (Some(a), None) => Some(RelColRowRange { from: a, to: a }),
                    _ => None,
                }
            })
            .flatten()
    }

    /// Tries to convert an A1 part to RelPos.
    pub(crate) fn try_from_position(a1: &str) -> Option<RelPos> {
        // Find the index where the digits start
        let Some(mut number_digit) = a1.find(char::is_numeric) else {
            return None;
        };

        if number_digit == 0 {
            return None;
        }

        // include the $ in the digit part
        if a1.chars().nth(number_digit - 1) == Some('$') {
            number_digit -= 1;
        }

        // Split the string into column and row parts
        let (column, row) = a1.split_at(number_digit);

        // Parse the column part
        let Some(x) = A1Range::try_from_column(column) else {
            return None;
        };

        // Parse the row part
        let Some(y) = A1Range::try_from_row(row) else {
            return None;
        };

        Some(RelPos { x, y })
    }

    /// Tries to create a Vec<RelRect> from an A1 string.
    pub(crate) fn try_from_rect(a1: &str) -> Option<RelRect> {
        if let Some((from, to)) = a1.split_once(':') {
            let Some(min) = A1Range::try_from_position(from) else {
                return None;
            };
            let Some(max) = A1Range::try_from_position(to) else {
                return None;
            };
            Some(RelRect { min, max })
        } else {
            None
        }
    }

    pub fn from_a1(
        original_a1: &str,
        sheet_id: SheetId,
        sheet_name_id: &SheetNameIdMap,
    ) -> Result<Self, A1Error> {
        let (a1, other_sheet_id) = try_sheet_name(original_a1, sheet_id, sheet_name_id)?;

        let range = if Self::try_from_all(a1) {
            A1RangeType::All
        } else if let Some(column) = Self::try_from_column(a1) {
            A1RangeType::Column(column)
        } else if let Some(row) = Self::try_from_row(a1) {
            A1RangeType::Row(row)
        } else if let Some(column_range) = Self::try_from_column_range(a1) {
            A1RangeType::ColumnRange(column_range)
        } else if let Some(row_range) = Self::try_from_row_range(a1) {
            A1RangeType::RowRange(row_range)
        } else if let Some(pos) = Self::try_from_position(a1) {
            A1RangeType::Pos(pos)
        } else if let Some(rect) = Self::try_from_rect(a1) {
            A1RangeType::Rect(rect)
        } else {
            return Err(A1Error::InvalidRange(a1.to_string()));
        };

        Ok(A1Range {
            range,
            sheet_id: other_sheet_id.unwrap_or(sheet_id),
        })
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use serial_test::parallel;
    use std::collections::HashMap;

    fn setup_sheet_ids() -> (SheetId, SheetId, HashMap<String, SheetId>) {
        let sheet_id = SheetId::new();
        let sheet_id_2 = SheetId::new();
        let sheet_name_id = HashMap::from([
            ("Sheet 1".to_string(), sheet_id),
            ("Sheet 2".to_string(), sheet_id_2),
        ]);
        (sheet_id, sheet_id_2, sheet_name_id)
    }

    #[test]
    #[parallel]
    fn test_try_from_column() {
        assert_eq!(A1Range::try_from_column("A"), Some(RelColRow::new(1, true)));
        assert_eq!(
            A1Range::try_from_column("$B"),
            Some(RelColRow::new(2, false))
        );
        assert_eq!(A1Range::try_from_column("in2valid"), None);
    }

    #[test]
    #[parallel]
    fn test_try_from_all() {
        assert_eq!(A1Range::try_from_all("*"), true);
        assert_eq!(A1Range::try_from_all("invalid"), false);
    }

    #[test]
    #[parallel]
    fn test_try_from_row() {
        assert_eq!(A1Range::try_from_row("1"), Some(RelColRow::new(1, true)));
        assert_eq!(
            A1Range::try_from_row("$100"),
            Some(RelColRow::new(100, false))
        );
        assert_eq!(A1Range::try_from_row("invalid"), None);
    }

    #[test]
    #[parallel]
    fn test_from_position() {
        assert_eq!(
            A1Range::try_from_position("A1"),
            Some(RelPos::new(1, 1, true, true))
        );
        assert_eq!(
            A1Range::try_from_position("A$1"),
            Some(RelPos::new(1, 1, true, false))
        );
        assert_eq!(
            A1Range::try_from_position("$A1"),
            Some(RelPos::new(1, 1, false, true))
        );
        assert_eq!(
            A1Range::try_from_position("$A$1"),
            Some(RelPos::new(1, 1, false, false))
        );
        assert_eq!(A1Range::try_from_position("invalid"), None);
    }

    #[test]
    #[parallel]
    fn test_try_from_rect() {
        assert_eq!(
            A1Range::try_from_rect("A1:B2"),
            Some(RelRect {
                min: RelPos::new(1, 1, true, true),
                max: RelPos::new(2, 2, true, true),
            })
        );
        assert_eq!(A1Range::try_from_rect("invalid"), None);
        assert_eq!(A1Range::try_from_rect("A:C"), None);
        assert_eq!(A1Range::try_from_rect("A"), None);
        assert_eq!(A1Range::try_from_rect("5"), None);
        assert_eq!(A1Range::try_from_rect("A5"), None);
    }

    #[test]
    #[parallel]
    fn test_try_from_column_range() {
        assert_eq!(
            A1Range::try_from_column_range("A:C"),
            Some(RelColRowRange {
                from: RelColRow::new(1, true),
                to: RelColRow::new(3, true),
            })
        );
        assert_eq!(A1Range::try_from_column_range("A1:B4"), None);
        assert_eq!(A1Range::try_from_column_range("A"), None);
        assert_eq!(A1Range::try_from_column_range("1"), None);
    }

    #[test]
    #[parallel]
    fn test_try_from_row_range() {
        assert_eq!(
            A1Range::try_from_row_range("1:3"),
            Some(RelColRowRange {
                from: RelColRow::new(1, true),
                to: RelColRow::new(3, true),
            })
        );
        assert_eq!(A1Range::try_from_row_range("A1:B4"), None);
        assert_eq!(A1Range::try_from_row_range("A"), None);
        assert_eq!(A1Range::try_from_row_range("1"), None);
    }

    #[test]
    #[parallel]
    fn test_from_a1_column() {
        let (sheet_id, _, sheet_name_id) = setup_sheet_ids();
        assert_eq!(
            A1Range::from_a1("A", sheet_id, &sheet_name_id),
            Ok(A1Range {
                sheet_id,
                range: A1RangeType::Column(RelColRow::new(1, true)),
            })
        );
    }

    #[test]
    #[parallel]
    fn test_from_a1_row() {
        let (sheet_id, _, sheet_name_id) = setup_sheet_ids();
        assert_eq!(
            A1Range::from_a1("1", sheet_id, &sheet_name_id),
            Ok(A1Range {
                sheet_id,
                range: A1RangeType::Row(RelColRow::new(1, true)),
            })
        );
    }

    #[test]
    #[parallel]
    fn test_from_a1_column_range() {
        let (sheet_id, _, sheet_name_id) = setup_sheet_ids();
        assert_eq!(
            A1Range::from_a1("A:C", sheet_id, &sheet_name_id),
            Ok(A1Range {
                sheet_id,
                range: A1RangeType::ColumnRange(RelColRowRange {
                    from: RelColRow::new(1, true),
                    to: RelColRow::new(3, true),
                }),
            })
        );
    }

    #[test]
    #[parallel]
    fn test_from_a1_row_range() {
        let (sheet_id, _, sheet_name_id) = setup_sheet_ids();
        assert_eq!(
            A1Range::from_a1("1:3", sheet_id, &sheet_name_id),
            Ok(A1Range {
                sheet_id,
                range: A1RangeType::RowRange(RelColRowRange {
                    from: RelColRow::new(1, true),
                    to: RelColRow::new(3, true),
                }),
            })
        );
    }

    #[test]
    #[parallel]
    fn test_from_a1_position() {
        let (sheet_id, _, sheet_name_id) = setup_sheet_ids();
        assert_eq!(
            A1Range::from_a1("A1", sheet_id, &sheet_name_id),
            Ok(A1Range {
                sheet_id,
                range: A1RangeType::Pos(RelPos::new(1, 1, true, true)),
            })
        );
    }

    #[test]
    #[parallel]
    fn test_from_a1_rect() {
        let (sheet_id, _, sheet_name_id) = setup_sheet_ids();
        assert_eq!(
            A1Range::from_a1("A1:B2", sheet_id, &sheet_name_id),
            Ok(A1Range {
                sheet_id,
                range: A1RangeType::Rect(RelRect {
                    min: RelPos::new(1, 1, true, true),
                    max: RelPos::new(2, 2, true, true),
                }),
            })
        );
    }

    #[test]
    #[parallel]
    fn test_from_a1_with_sheet_name() {
        let (sheet_id, sheet_id_2, sheet_name_id) = setup_sheet_ids();
        assert_eq!(
            A1Range::from_a1("'Sheet 2'!A1", sheet_id, &sheet_name_id),
            Ok(A1Range {
                sheet_id: sheet_id_2,
                range: A1RangeType::Pos(RelPos::new(1, 1, true, true)),
            })
        );
    }
}
