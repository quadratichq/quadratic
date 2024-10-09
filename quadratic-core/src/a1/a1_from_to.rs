//! A1 is a struct that represents the parts of an A1 string. It is used to
//! parse and and then stringify an A1 string (eg, after a translate).

use std::collections::HashSet;

use crate::grid::SheetId;

use super::{A1Error, A1Range, SheetNameIdMap, A1};

impl A1 {
    pub fn from_a1(a1: &str, sheet_id: SheetId, map: SheetNameIdMap) -> Result<Self, A1Error> {
        let mut parts = A1 { ranges: vec![] };

        // First break up the string by commas. This is an A1Range.
        for part in a1.split(',') {
            // Add the last part if it exists
            if !part.is_empty() {
                let range = A1Range::from_a1(&part, sheet_id, &map)?;
                parts.ranges.push(range);
            }
        }

        Ok(parts)
    }

    /// Translates A1 by a delta.
    pub fn translate(&mut self, delta_x: i64, delta_y: i64) -> Result<(), A1Error> {
        for range in &mut self.ranges {
            range.translate(delta_x, delta_y)?;
        }
        Ok(())
    }

    /// Returns the number of sheets in the A1. Includes the base sheet
    /// only if any part has no sheet id.
    pub fn sheets(&self) -> Vec<SheetId> {
        let mut sheets = HashSet::new();
        self.ranges.iter().for_each(|part| {
            sheets.insert(part.sheet_id);
        });
        sheets.into_iter().collect()
    }

    /// Returns an iterator over the A1.
    pub fn iter(&self) -> impl Iterator<Item = &A1Range> {
        self.ranges.iter()
    }

    /// Converts the A1 to an A1 string.
    pub fn to_a1(&self, sheet_id: SheetId, map: &SheetNameIdMap) -> Result<String, A1Error> {
        let mut s = String::new();
        let len = self.ranges.len();
        for (i, range) in self.ranges.iter().enumerate() {
            s.push_str(&range.to_a1(sheet_id, map)?);
            if i != len - 1 {
                s.push(',');
            }
        }
        Ok(s)
    }

    /// Returns the total number of cells in the A1. Returns None for all
    /// sheet-based ranges (eg, *, A, 1:5). ExcludedRanges return 0.
    pub fn cell_count(&self) -> Option<usize> {
        self.ranges.iter().map(|part| part.cell_count()).sum()
    }
}

#[cfg(test)]
mod tests {
    use std::collections::HashMap;

    use serial_test::parallel;

    use crate::{A1Range, A1RangeType, RelColRow, RelColRowRange, RelPos, RelRect};

    use super::*;

    #[test]
    #[parallel]
    fn test_from_a1_pos() {
        let sheet_id = SheetId::test();
        let map = HashMap::from([("Sheet1".to_string(), sheet_id)]);

        // Test basic cell reference
        let a1 = A1::from_a1("A1", sheet_id, map.clone()).unwrap();
        assert_eq!(
            a1,
            A1 {
                ranges: vec![A1Range {
                    sheet_id,
                    range: A1RangeType::Pos(RelPos::new(1, 1, true, true)),
                }],
            }
        );
    }

    #[test]
    #[parallel]
    fn test_from_a1_range() {
        let sheet_id = SheetId::test();
        let map = HashMap::from([("Sheet1".to_string(), sheet_id)]);

        // Test range
        let parts = A1::from_a1("A1:B2", sheet_id, map.clone()).unwrap();
        assert_eq!(
            parts,
            A1 {
                ranges: vec![A1Range {
                    sheet_id,
                    range: A1RangeType::Rect(RelRect {
                        min: RelPos::new(1, 1, true, true),
                        max: RelPos::new(2, 2, true, true),
                    }),
                }],
            }
        );
    }

    #[test]
    #[parallel]
    fn test_from_a1_absolute_references() {
        let sheet_id = SheetId::test();
        let map = HashMap::from([("Sheet1".to_string(), sheet_id)]);

        // Test absolute references
        let parts = A1::from_a1("$A$1:$B$2", sheet_id, map.clone()).unwrap();
        assert_eq!(
            parts,
            A1 {
                ranges: vec![A1Range {
                    sheet_id,
                    range: A1RangeType::Rect(RelRect {
                        min: RelPos::new(1, 1, false, false),
                        max: RelPos::new(2, 2, false, false),
                    }),
                }],
            }
        );
    }

    #[test]
    #[parallel]
    fn test_from_a1_column_range() {
        let sheet_id = SheetId::test();
        let map = HashMap::from([("Sheet1".to_string(), sheet_id)]);

        // Test column range
        let parts = A1::from_a1("A:C", sheet_id, map.clone()).unwrap();
        assert_eq!(
            parts,
            A1 {
                ranges: vec![A1Range {
                    sheet_id,
                    range: A1RangeType::ColumnRange(RelColRowRange {
                        from: RelColRow::new(1, true),
                        to: RelColRow::new(3, true),
                    }),
                }],
            }
        );
    }

    #[test]
    #[parallel]
    fn test_from_a1_row_range() {
        let sheet_id = SheetId::test();
        let map = HashMap::from([("Sheet1".to_string(), sheet_id)]);

        // Test row range
        let parts = A1::from_a1("1:3", sheet_id, map.clone()).unwrap();
        assert_eq!(
            parts,
            A1 {
                ranges: vec![A1Range {
                    sheet_id,
                    range: A1RangeType::RowRange(RelColRowRange {
                        from: RelColRow::new(1, true),
                        to: RelColRow::new(3, true),
                    }),
                }],
            }
        );
    }

    #[test]
    #[parallel]
    fn test_from_a1_multiple_parts() {
        let sheet_id = SheetId::test();
        let map = HashMap::from([("Sheet1".to_string(), sheet_id)]);

        // Test multiple parts
        let parts = A1::from_a1("A1,B2:C3,$D$4", sheet_id, map.clone()).unwrap();
        assert_eq!(
            parts,
            A1 {
                ranges: vec![
                    A1Range {
                        sheet_id,
                        range: A1RangeType::Pos(RelPos::new(1, 1, true, true)),
                    },
                    A1Range {
                        sheet_id,
                        range: A1RangeType::Rect(RelRect {
                            min: RelPos::new(2, 2, true, true),
                            max: RelPos::new(3, 3, true, true),
                        }),
                    },
                    A1Range {
                        sheet_id,
                        range: A1RangeType::Pos(RelPos::new(4, 4, false, false)),
                    },
                ],
            }
        );
    }

    #[test]
    #[parallel]
    fn test_from_a1_with_sheet_name() {
        let sheet_id = SheetId::test();
        let sheet_id2 = SheetId::test();
        let map = HashMap::from([
            ("Sheet1".to_string(), sheet_id),
            ("Sheet2".to_string(), sheet_id2),
        ]);

        // Test with sheet name
        let parts = A1::from_a1("Sheet2!A1:B2", sheet_id, map.clone()).unwrap();
        assert_eq!(
            parts,
            A1 {
                ranges: vec![A1Range {
                    sheet_id: sheet_id2,
                    range: A1RangeType::Rect(RelRect {
                        min: RelPos::new(1, 1, true, true),
                        max: RelPos::new(2, 2, true, true),
                    }),
                }],
            }
        );
    }

    #[test]
    #[parallel]
    fn test_from_a1_invalid_input() {
        let sheet_id = SheetId::test();
        let map = HashMap::from([("Sheet1".to_string(), sheet_id)]);
        assert_eq!(
            A1::from_a1("In2validInput", sheet_id, map.clone()),
            Err(A1Error::InvalidRange("In2validInput".to_string()))
        );
    }

    #[test]
    #[parallel]
    fn test_sheets() {
        let sheet_id1 = SheetId::test();
        let sheet_id2 = SheetId::new();
        let map = HashMap::from([
            ("Sheet1".to_string(), sheet_id1),
            ("Sheet2".to_string(), sheet_id2),
        ]);

        let parts = A1::from_a1("A1,B2:C3", sheet_id1, map.clone()).unwrap();
        assert_eq!(parts.sheets(), vec![sheet_id1]);

        let parts = A1::from_a1("Sheet1!A1,B2:C3", sheet_id1, map.clone()).unwrap();
        assert_eq!(parts.sheets(), vec![sheet_id1]);

        let parts = A1::from_a1("Sheet2!A1,Sheet2!B2:C3", sheet_id1, map.clone()).unwrap();
        assert_eq!(parts.sheets(), vec![sheet_id2]);

        let parts = A1::from_a1("A1,Sheet2!B2:C3,D4", sheet_id1, map.clone()).unwrap();
        assert_eq!(parts.sheets().len(), 2);
        assert!(parts.sheets().contains(&sheet_id1));
        assert!(parts.sheets().contains(&sheet_id2));

        let parts = A1::from_a1("A1,Sheet2!B2,C3,D4", sheet_id1, map.clone()).unwrap();
        assert_eq!(parts.sheets().len(), 2);
        assert!(parts.sheets().contains(&sheet_id1));
        assert!(parts.sheets().contains(&sheet_id2));
    }

    #[test]
    #[parallel]
    fn test_translate() {
        let sheet_id = SheetId::test();
        let sheet_id_2 = SheetId::new();
        let map = HashMap::from([
            ("Sheet1".to_string(), sheet_id),
            ("Sheet 2".to_string(), sheet_id_2),
        ]);
        let mut parts = A1::from_a1("'Sheet 2'!A1,$B$2,C:D,3:4", sheet_id, map.clone()).unwrap();
        assert_eq!(
            parts.to_a1(sheet_id, &map).unwrap(),
            "'Sheet 2'!A1,$B$2,C:D,3:4"
        );
        parts.translate(1, 1).unwrap();
        assert_eq!(
            parts.to_a1(sheet_id, &map).unwrap(),
            "'Sheet 2'!B2,$B$2,D:E,4:5"
        );
    }

    #[test]
    #[parallel]
    fn test_from_string() {
        let sheet_id = SheetId::test();
        let map = HashMap::new();
        let parts = A1::from_a1("*", sheet_id, map.clone()).unwrap();
        assert_eq!(parts.ranges.len(), 1);
        assert_eq!(parts.ranges[0].range, A1RangeType::All);

        let parts = A1::from_a1("A1,B2:C3", sheet_id, map).unwrap();
        assert_eq!(parts.ranges.len(), 2);
        assert_eq!(
            parts.ranges[0].range,
            A1RangeType::Pos(RelPos::new(1, 1, true, true))
        );
        assert_eq!(
            parts.ranges[1].range,
            A1RangeType::Rect(RelRect {
                min: RelPos::new(2, 2, true, true),
                max: RelPos::new(3, 3, true, true),
            })
        );
    }

    #[test]
    #[parallel]
    fn test_to_string() {
        let sheet_id = SheetId::new();
        let sheet_id_2 = SheetId::new();
        let map = HashMap::from([
            ("Sheet1".to_string(), sheet_id),
            ("Sheet2".to_string(), sheet_id_2),
        ]);
        let parts = A1::from_a1("Sheet2!A1,$B$2,C:D,3:4", sheet_id, map.clone()).unwrap();
        assert_eq!(
            parts.to_a1(sheet_id, &map).unwrap(),
            "Sheet2!A1,$B$2,C:D,3:4"
        );
    }

    #[test]
    #[parallel]
    fn test_cell_count() {
        let sheet_id = SheetId::test();
        let map = HashMap::new();

        // Test single cell
        let parts = A1::from_a1("A1", sheet_id, map.clone()).unwrap();
        assert_eq!(parts.cell_count(), Some(1));

        // Test range
        let parts = A1::from_a1("B2:D4", sheet_id, map.clone()).unwrap();
        assert_eq!(parts.cell_count(), Some(9));

        // Test column range
        let parts = A1::from_a1("C:E", sheet_id, map.clone()).unwrap();
        assert_eq!(parts.cell_count(), None);

        // Test row range
        let parts = A1::from_a1("3:5", sheet_id, map.clone()).unwrap();
        assert_eq!(parts.cell_count(), None);

        // Test all cells
        let parts = A1::from_a1("*", sheet_id, map.clone()).unwrap();
        assert_eq!(parts.cell_count(), None);

        // Test pos
        let parts = A1::from_a1("A1", sheet_id, map.clone()).unwrap();
        assert_eq!(parts.cell_count(), Some(1));

        // Test multiple ranges
        let parts = A1::from_a1("A1,B2:C3", sheet_id, map.clone()).unwrap();
        assert_eq!(parts.cell_count(), Some(5));
    }
}
