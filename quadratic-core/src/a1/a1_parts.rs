//! A1Parts is a struct that represents the parts of an A1 string. It is used to
//! parse and and then stringify an A1 string (eg, after a translate).

use std::collections::HashSet;

use crate::grid::SheetId;

use super::{A1Error, A1Part, SheetNameIdMap};

#[derive(Debug, Default, PartialEq)]
pub struct A1Parts {
    // default sheet_id used for parts without SheetId
    pub sheet_id: SheetId,

    pub parts: Vec<A1Part>,
}

impl A1Parts {
    pub fn from_a1(a1: &str, sheet_id: SheetId, map: SheetNameIdMap) -> Result<Self, A1Error> {
        let mut parts = A1Parts {
            sheet_id,
            parts: vec![],
        };

        // First break up the string by commas. This is an A1Part.
        for part in a1.split(',') {
            // Then break up the part by spaces. Anything after a space is an
            // excluded part. Need to also ignore spaces within quotes (which
            // are sheet names).
            let mut in_quotes = false;
            let mut after_space = false;
            let mut current_part = String::new();
            for char in part.chars() {
                match char {
                    '\'' => {
                        in_quotes = !in_quotes;
                        current_part.push(char);
                    }
                    ' ' if !in_quotes => {
                        if !current_part.is_empty() {
                            let mut part = A1Part::from_a1(&current_part, sheet_id, &map)?;
                            if after_space {
                                part.to_excluded()?;
                            }
                            parts.parts.push(part);
                            current_part.clear();
                            after_space = true;
                        }
                    }
                    _ => {
                        current_part.push(char);
                    }
                }
            }

            // Add the last part if it exists
            if !current_part.is_empty() {
                let mut part = A1Part::from_a1(&current_part, sheet_id, &map)?;
                if after_space {
                    part.to_excluded()?;
                }
                parts.parts.push(part);
            }
        }

        Ok(parts)
    }

    /// Translates A1Parts by a delta.
    pub fn translate(&mut self, delta_x: i64, delta_y: i64) -> Result<(), A1Error> {
        for part in &mut self.parts {
            part.translate(delta_x, delta_y)?;
        }
        Ok(())
    }

    /// Returns the number of sheets in the A1Parts. Includes the base sheet
    /// only if any part has no sheet id.
    pub fn sheets(&self) -> Vec<SheetId> {
        let mut sheets = HashSet::new();
        self.parts.iter().for_each(|part| {
            if let Some(sheet_id) = part.sheet_id {
                sheets.insert(sheet_id);
            } else {
                sheets.insert(self.sheet_id);
            }
        });
        sheets.into_iter().collect()
    }

    /// Returns an iterator over the A1Parts.
    pub fn iter(&self) -> impl Iterator<Item = &A1Part> {
        self.parts.iter()
    }

    /// Converts the A1Parts to an A1 string.
    pub fn to_a1(&self, map: &SheetNameIdMap) -> Result<String, A1Error> {
        let mut s = String::new();
        let len = self.parts.len();
        for (i, part) in self.parts.iter().enumerate() {
            s.push_str(&part.to_a1(self.sheet_id, map)?);
            if i != len - 1 {
                if part.is_excluded() {
                    s.push(' ');
                } else {
                    s.push(',');
                }
            }
        }
        Ok(s)
    }
}

#[cfg(test)]
mod tests {
    use std::collections::HashMap;

    use serial_test::parallel;

    use crate::{A1Range, RelColRow, RelColRowRange, RelPos, RelRect};

    use super::*;

    #[test]
    #[parallel]
    fn test_from_a1_pos() {
        let sheet_id = SheetId::test();
        let map = HashMap::from([("Sheet1".to_string(), sheet_id)]);

        // Test basic cell reference
        let parts = A1Parts::from_a1("A1", sheet_id, map.clone()).unwrap();
        assert_eq!(
            parts,
            A1Parts {
                sheet_id,
                parts: vec![A1Part {
                    sheet_id: None,
                    range: A1Range::Pos(RelPos::new(1, 1, true, true)),
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
        let parts = A1Parts::from_a1("A1:B2", sheet_id, map.clone()).unwrap();
        assert_eq!(
            parts,
            A1Parts {
                sheet_id,
                parts: vec![A1Part {
                    sheet_id: None,
                    range: A1Range::Rect(RelRect {
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
        let parts = A1Parts::from_a1("$A$1:$B$2", sheet_id, map.clone()).unwrap();
        assert_eq!(
            parts,
            A1Parts {
                sheet_id,
                parts: vec![A1Part {
                    sheet_id: None,
                    range: A1Range::Rect(RelRect {
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
        let parts = A1Parts::from_a1("A:C", sheet_id, map.clone()).unwrap();
        assert_eq!(
            parts,
            A1Parts {
                sheet_id,
                parts: vec![A1Part {
                    sheet_id: None,
                    range: A1Range::ColumnRange(RelColRowRange {
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
        let parts = A1Parts::from_a1("1:3", sheet_id, map.clone()).unwrap();
        assert_eq!(
            parts,
            A1Parts {
                sheet_id,
                parts: vec![A1Part {
                    sheet_id: None,
                    range: A1Range::RowRange(RelColRowRange {
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
        let parts = A1Parts::from_a1("A1,B2:C3,$D$4", sheet_id, map.clone()).unwrap();
        assert_eq!(
            parts,
            A1Parts {
                sheet_id,
                parts: vec![
                    A1Part {
                        sheet_id: None,
                        range: A1Range::Pos(RelPos::new(1, 1, true, true)),
                    },
                    A1Part {
                        sheet_id: None,
                        range: A1Range::Rect(RelRect {
                            min: RelPos::new(2, 2, true, true),
                            max: RelPos::new(3, 3, true, true),
                        }),
                    },
                    A1Part {
                        sheet_id: None,
                        range: A1Range::Pos(RelPos::new(4, 4, false, false)),
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
        let parts = A1Parts::from_a1("Sheet2!A1:B2", sheet_id, map.clone()).unwrap();
        assert_eq!(
            parts,
            A1Parts {
                sheet_id: sheet_id2,
                parts: vec![A1Part {
                    sheet_id: None,
                    range: A1Range::Rect(RelRect {
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
            A1Parts::from_a1("In2validInput", sheet_id, map.clone()),
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

        let parts = A1Parts::from_a1("A1,B2:C3", sheet_id1, map.clone()).unwrap();
        assert_eq!(parts.sheets(), vec![sheet_id1]);

        let parts = A1Parts::from_a1("Sheet1!A1,B2:C3", sheet_id1, map.clone()).unwrap();
        assert_eq!(parts.sheets(), vec![sheet_id1]);

        let parts = A1Parts::from_a1("Sheet2!A1,Sheet2!B2:C3", sheet_id1, map.clone()).unwrap();
        assert_eq!(parts.sheets(), vec![sheet_id2]);

        let parts = A1Parts::from_a1("A1,Sheet2!B2:C3,D4", sheet_id1, map.clone()).unwrap();
        assert_eq!(parts.sheets().len(), 2);
        assert!(parts.sheets().contains(&sheet_id1));
        assert!(parts.sheets().contains(&sheet_id2));

        let parts = A1Parts::from_a1("A1,Sheet2!B2,C3,D4", sheet_id1, map.clone()).unwrap();
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
        let mut parts =
            A1Parts::from_a1("'Sheet 2'!A1,$B$2,C:D,3:4", sheet_id, map.clone()).unwrap();
        assert_eq!(parts.to_a1(&map).unwrap(), "'Sheet 2'!A1,$B$2,C:D,3:4");
        parts.translate(1, 1).unwrap();
        assert_eq!(parts.to_a1(&map).unwrap(), "'Sheet 2'!B2,$B$2,D:E,4:5");
    }

    #[test]
    #[parallel]
    fn test_from_string() {
        let sheet_id = SheetId::test();
        let map = HashMap::new();
        let parts = A1Parts::from_a1("*", sheet_id, map.clone()).unwrap();
        assert_eq!(parts.parts.len(), 1);
        assert_eq!(parts.parts[0].range, A1Range::All);

        let parts = A1Parts::from_a1("A1,B2:C3", sheet_id, map).unwrap();
        assert_eq!(parts.parts.len(), 2);
        assert_eq!(
            parts.parts[0].range,
            A1Range::Pos(RelPos::new(1, 1, true, true))
        );
        assert_eq!(
            parts.parts[1].range,
            A1Range::Rect(RelRect {
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
        let parts = A1Parts::from_a1("Sheet2!A1,$B$2,C:D,3:4", sheet_id, map.clone()).unwrap();
        assert_eq!(parts.to_a1(&map).unwrap(), "Sheet2!A1,$B$2,C:D,3:4");
    }
}
