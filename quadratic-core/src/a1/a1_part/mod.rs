use crate::grid::SheetId;

pub mod a1_part_to_a1;
pub mod a1_part_translate;
mod a1_part_types;
pub use a1_part_types::*;

use super::{a1_sheet_name::try_sheet_name, A1Error, SheetNameIdMap};

#[derive(Debug, PartialEq)]
pub struct A1Part {
    pub sheet_id: Option<SheetId>,
    pub range: A1Range,
}

impl A1Part {
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
        a1.trim() == "*".to_string()
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
                    return Err(A1Error::InvalidRow(a1.to_string()));
                }
            }
            Err(_) => return Ok(None),
        }
    }

    /// Tries to create Column(s) from an A1 string. Returns a vector of RelColRow.
    fn try_from_column_range(a1: &str) -> Option<RelColRowRange> {
        a1.split_once(':')
            .map(|(from, to)| {
                let (from, to) = match (A1Part::try_from_column(from), A1Part::try_from_column(to))
                {
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
            .unwrap_or_else(|| {
                A1Part::try_from_column(&a1).map(|x| RelColRowRange { from: x, to: x })
            })
    }

    /// Tries to create Row ranges from an A1 string.
    fn try_from_row_range(a1: &str) -> Result<Option<RelColRowRange>, A1Error> {
        a1.split_once(':')
            .map(|(from, to)| {
                let from = A1Part::try_from_row(from)?;
                let to = A1Part::try_from_row(to)?;

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
                A1Part::try_from_row(a1).map(|row| row.map(|x| RelColRowRange { from: x, to: x }))
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
        let Some(x) = A1Part::try_from_column(column) else {
            return Ok(None);
        };

        // Parse the row part
        let Some(y) = A1Part::try_from_row(row)? else {
            return Ok(None);
        };

        Ok(Some(RelPos { x, y }))
    }

    /// Tries to create a Vec<RelRect> from an A1 string.
    fn try_from_rect(a1: &str) -> Result<Option<RelRect>, A1Error> {
        if let Some((from, to)) = a1.split_once(':') {
            let Some(min) = A1Part::try_from_position(from)? else {
                return Ok(None);
            };
            let Some(max) = A1Part::try_from_position(to)? else {
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
    ) -> Result<A1Part, A1Error> {
        let (a1, sheet_id) = try_sheet_name(original_a1, sheet_id, sheet_name_id)?;

        let range = if A1Part::try_from_all(a1) {
            A1Range::All
        } else if let Some(column) = A1Part::try_from_column(a1) {
            A1Range::Column(column)
        } else if let Some(row) = A1Part::try_from_row(a1)? {
            A1Range::Row(row)
        } else if let Some(column_range) = A1Part::try_from_column_range(a1) {
            A1Range::ColumnRange(column_range)
        } else if let Some(row_range) = A1Part::try_from_row_range(a1)? {
            A1Range::RowRange(row_range)
        } else if let Some(pos) = A1Part::try_from_position(a1)? {
            A1Range::Pos(pos)
        } else if let Some(rect) = A1Part::try_from_rect(a1)? {
            A1Range::Rect(rect)
        } else {
            return Err(A1Error::InvalidRange(a1.to_string()));
        };

        Ok(A1Part { sheet_id, range })
    }

    /// Converts a normal A1Part into an excluded part.
    pub fn to_excluded(&mut self) -> Result<(), A1Error> {
        self.range = match &self.range {
            A1Range::Column(x) => A1Range::ExcludeColumn(*x),
            A1Range::Row(x) => A1Range::ExcludeRow(*x),
            A1Range::ColumnRange(x) => A1Range::ExcludeColumnRange(*x),
            A1Range::RowRange(x) => A1Range::ExcludeRowRange(*x),
            A1Range::Rect(x) => A1Range::ExcludeRect(*x),
            A1Range::Pos(x) => A1Range::ExcludePos(*x),

            A1Range::ExcludeColumn(x) => A1Range::ExcludeColumn(*x),
            A1Range::ExcludeRow(x) => A1Range::ExcludeRow(*x),
            A1Range::ExcludeColumnRange(x) => A1Range::ExcludeColumnRange(*x),
            A1Range::ExcludeRowRange(x) => A1Range::ExcludeRowRange(*x),
            A1Range::ExcludeRect(x) => A1Range::ExcludeRect(*x),
            A1Range::ExcludePos(x) => A1Range::ExcludePos(*x),

            A1Range::All => return Err(A1Error::InvalidExclusion("*".to_string())),
        };
        Ok(())
    }

    /// Returns true if the A1Part is excluded.
    pub fn is_excluded(&self) -> bool {
        matches!(
            self.range,
            A1Range::ExcludeColumn(_)
                | A1Range::ExcludeRow(_)
                | A1Range::ExcludeColumnRange(_)
                | A1Range::ExcludeRowRange(_)
                | A1Range::ExcludeRect(_)
                | A1Range::ExcludePos(_)
        )
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
            A1Part::from_a1("A", sheet_id, &sheet_name_id),
            Ok(A1Part {
                sheet_id: None,
                range: A1Range::Column(RelColRow::new(1, true)),
            })
        );
    }

    #[test]
    #[parallel]
    fn test_from_a1_row() {
        let (sheet_id, _, sheet_name_id) = setup_sheet_ids();
        assert_eq!(
            A1Part::from_a1("1", sheet_id, &sheet_name_id),
            Ok(A1Part {
                sheet_id: None,
                range: A1Range::Row(RelColRow::new(1, true)),
            })
        );
    }

    #[test]
    #[parallel]
    fn test_from_a1_column_range() {
        let (sheet_id, _, sheet_name_id) = setup_sheet_ids();
        assert_eq!(
            A1Part::from_a1("A:C", sheet_id, &sheet_name_id),
            Ok(A1Part {
                sheet_id: None,
                range: A1Range::ColumnRange(RelColRowRange {
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
            A1Part::from_a1("1:3", sheet_id, &sheet_name_id),
            Ok(A1Part {
                sheet_id: None,
                range: A1Range::RowRange(RelColRowRange {
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
            A1Part::from_a1("A1", sheet_id, &sheet_name_id),
            Ok(A1Part {
                sheet_id: None,
                range: A1Range::Pos(RelPos::new(1, 1, true, true)),
            })
        );
    }

    #[test]
    #[parallel]
    fn test_from_a1_rect() {
        let (sheet_id, _, sheet_name_id) = setup_sheet_ids();
        assert_eq!(
            A1Part::from_a1("A1:B2", sheet_id, &sheet_name_id),
            Ok(A1Part {
                sheet_id: None,
                range: A1Range::Rect(RelRect {
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
            A1Part::from_a1("'Sheet 2'!A1", sheet_id, &sheet_name_id),
            Ok(A1Part {
                sheet_id: Some(sheet_id_2),
                range: A1Range::Pos(RelPos::new(1, 1, true, true)),
            })
        );
    }

    #[test]
    #[parallel]
    fn test_is_excluded() {
        let (sheet_id, _, sheet_name_id) = setup_sheet_ids();

        // Test non-excluded A1Parts
        let non_excluded = vec![
            A1Part::from_a1("A", sheet_id, &sheet_name_id).unwrap(),
            A1Part::from_a1("1", sheet_id, &sheet_name_id).unwrap(),
            A1Part::from_a1("A:C", sheet_id, &sheet_name_id).unwrap(),
            A1Part::from_a1("1:3", sheet_id, &sheet_name_id).unwrap(),
            A1Part::from_a1("A1", sheet_id, &sheet_name_id).unwrap(),
            A1Part::from_a1("A1:B2", sheet_id, &sheet_name_id).unwrap(),
        ];

        for part in non_excluded {
            assert!(
                !part.is_excluded(),
                "Expected {:?} to not be excluded",
                part
            );
        }

        // Test excluded A1Parts
        let mut excluded = vec![
            A1Part::from_a1("A", sheet_id, &sheet_name_id).unwrap(),
            A1Part::from_a1("1", sheet_id, &sheet_name_id).unwrap(),
            A1Part::from_a1("A:C", sheet_id, &sheet_name_id).unwrap(),
            A1Part::from_a1("1:3", sheet_id, &sheet_name_id).unwrap(),
            A1Part::from_a1("A1", sheet_id, &sheet_name_id).unwrap(),
            A1Part::from_a1("A1:B2", sheet_id, &sheet_name_id).unwrap(),
        ];

        for part in &mut excluded {
            part.to_excluded().unwrap();
            assert!(part.is_excluded(), "Expected {:?} to be excluded", part);
        }

        // Test that All cannot be excluded
        let mut all = A1Part::from_a1("*", sheet_id, &sheet_name_id).unwrap();
        assert!(
            all.to_excluded().is_err(),
            "Expected All to not be excludable"
        );
    }
}
