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
            if !c.is_ascii_uppercase() {
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
    fn try_from_all(a1: &str) -> bool {
        a1.trim() == "*"
    }

    /// Tries to convert an A1 part to RelColRow.
    fn try_from_row(a1: &str) -> Result<Option<RelColRow>, A1Error> {
        let mut a1 = a1;
        let relative = if a1.trim().starts_with('$') {
            a1 = &a1[1..];
            false
        } else {
            true
        };

        match a1.parse::<u64>() {
            Ok(x) => {
                if x > 0 {
                    Ok(Some(RelColRow { index: x, relative }))
                } else {
                    Err(A1Error::InvalidRow(a1.to_string()))
                }
            }
            Err(_) => Ok(None),
        }
    }

    /// Tries to create Column(s) from an A1 string. Returns a vector of RelColRow.
    fn try_from_column_range(a1: &str) -> Option<RelColRowRange> {
        a1.split_once(':')
            .map(|(from, to)| {
                let (from, to) = match (Self::try_from_column(from), Self::try_from_column(to)) {
                    (Some(a), Some(b)) => {
                        if a.index > b.index {
                            (b, a)
                        } else {
                            (a, b)
                        }
                    }

                    // handles the case of a "A:" (partially inputted range)
                    (Some(a), None) => (a, a),
                    _ => return None,
                };
                Some(RelColRowRange { from, to })
            })
            .unwrap_or_else(|| Self::try_from_column(a1).map(|x| RelColRowRange { from: x, to: x }))
    }

    /// Tries to create Row ranges from an A1 string.
    fn try_from_row_range(a1: &str) -> Result<Option<RelColRowRange>, A1Error> {
        a1.split_once(':')
            .map(|(from, to)| {
                let from = Self::try_from_row(from)?;
                let to = Self::try_from_row(to)?;

                match (from, to) {
                    (Some(a), Some(b)) => {
                        let (from, to) = if a.index > b.index { (b, a) } else { (a, b) };
                        Ok(Some(RelColRowRange { from, to }))
                    }
                    (Some(a), None) => Ok(Some(RelColRowRange { from: a, to: a })),
                    _ => Ok(None),
                }
            })
            .unwrap_or_else(|| {
                Self::try_from_row(a1).map(|row| row.map(|x| RelColRowRange { from: x, to: x }))
            })
    }

    /// Tries to convert an A1 part to RelPos.
    pub(crate) fn try_from_position(a1: &str) -> Result<Option<RelPos>, A1Error> {
        // Find the index where the digits start
        let Some(mut number_digit) = a1.find(char::is_numeric) else {
            return Ok(None);
        };

        if number_digit == 0 {
            return Ok(None);
        }

        // include the $ in the digit part
        if a1.chars().nth(number_digit - 1) == Some('$') {
            number_digit -= 1;
        }

        // Split the string into column and row parts
        let (column, row) = a1.split_at(number_digit);

        // Parse the column part
        let Some(x) = A1Range::try_from_column(column) else {
            return Ok(None);
        };

        // Parse the row part
        let Some(y) = A1Range::try_from_row(row)? else {
            return Ok(None);
        };

        Ok(Some(RelPos { x, y }))
    }

    /// Tries to create a Vec<RelRect> from an A1 string.
    fn try_from_rect(a1: &str) -> Result<Option<RelRect>, A1Error> {
        if let Some((from, to)) = a1.split_once(':') {
            let Some(min) = A1Range::try_from_position(from)? else {
                return Ok(None);
            };
            let Some(max) = A1Range::try_from_position(to)? else {
                return Ok(None);
            };
            Ok(Some(RelRect { min, max }))
        } else {
            Ok(None)
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
        } else if let Some(row) = Self::try_from_row(a1)? {
            A1RangeType::Row(row)
        } else if let Some(column_range) = Self::try_from_column_range(a1) {
            A1RangeType::ColumnRange(column_range)
        } else if let Some(row_range) = Self::try_from_row_range(a1)? {
            A1RangeType::RowRange(row_range)
        } else if let Some(pos) = Self::try_from_position(a1)? {
            A1RangeType::Pos(pos)
        } else if let Some(rect) = Self::try_from_rect(a1)? {
            A1RangeType::Rect(rect)
        } else {
            return Err(A1Error::InvalidRange(a1.to_string()));
        };

        Ok(A1Range {
            range,
            sheet_id: other_sheet_id.unwrap_or(sheet_id),
        })
    }

    /// Converts a normal A1Part into an excluded part.
    pub fn to_excluded(&mut self) -> Result<(), A1Error> {
        self.range = match &self.range {
            A1RangeType::Column(x) => A1RangeType::ExcludeColumn(*x),
            A1RangeType::Row(x) => A1RangeType::ExcludeRow(*x),
            A1RangeType::ColumnRange(x) => A1RangeType::ExcludeColumnRange(*x),
            A1RangeType::RowRange(x) => A1RangeType::ExcludeRowRange(*x),
            A1RangeType::Rect(x) => A1RangeType::ExcludeRect(*x),
            A1RangeType::Pos(x) => A1RangeType::ExcludePos(*x),

            A1RangeType::ExcludeColumn(x) => A1RangeType::ExcludeColumn(*x),
            A1RangeType::ExcludeRow(x) => A1RangeType::ExcludeRow(*x),
            A1RangeType::ExcludeColumnRange(x) => A1RangeType::ExcludeColumnRange(*x),
            A1RangeType::ExcludeRowRange(x) => A1RangeType::ExcludeRowRange(*x),
            A1RangeType::ExcludeRect(x) => A1RangeType::ExcludeRect(*x),
            A1RangeType::ExcludePos(x) => A1RangeType::ExcludePos(*x),

            A1RangeType::All => return Err(A1Error::InvalidExclusion("*".to_string())),
        };
        Ok(())
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
