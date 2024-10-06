use crate::{grid::SheetId, A1Error, SheetNameIdMap};

use super::{A1Part, A1Range};

impl A1Part {
    pub fn to_a1(&self, sheet_id: SheetId, map: &SheetNameIdMap) -> Result<String, A1Error> {
        let sheet_name = if let Some(part_sheet_id) = self.sheet_id {
            if part_sheet_id != sheet_id {
                let mut name = String::new();
                for (sheet_name, &id) in map.iter() {
                    if id == part_sheet_id {
                        name = if sheet_name.contains(' ') || sheet_name.contains('!') {
                            format!("'{}'!", sheet_name)
                        } else {
                            format!("{}!", sheet_name)
                        };
                        break;
                    }
                }
                if name.is_empty() {
                    return Err(A1Error::InvalidSheetName(String::new()));
                }
                name
            } else {
                String::new()
            }
        } else {
            String::new()
        };

        let range_str = match &self.range {
            &A1Range::All => "*".to_string(),
            A1Range::Column(col) | A1Range::ExcludeColumn(col) => col.to_column_a1(),
            A1Range::Row(row) | A1Range::ExcludeRow(row) => row.to_row_a1(),
            A1Range::ColumnRange(cols) | A1Range::ExcludeColumnRange(cols) => {
                format!("{}:{}", cols.from.to_column_a1(), cols.to.to_column_a1())
            }
            A1Range::RowRange(rows) | A1Range::ExcludeRowRange(rows) => {
                format!("{}:{}", rows.from.to_row_a1(), rows.to.to_row_a1())
            }
            A1Range::Pos(pos) | A1Range::ExcludePos(pos) => pos.to_a1(),
            A1Range::Rect(rect) | A1Range::ExcludeRect(rect) => {
                format!("{}:{}", rect.min.to_a1(), rect.max.to_a1())
            }
        };

        Ok(format!("{}{}", sheet_name, range_str))
    }
}

#[cfg(test)]
mod tests {
    use std::collections::HashMap;

    use serial_test::parallel;

    use crate::{RelColRow, RelColRowRange, RelPos};

    use super::*;

    #[test]
    #[parallel]
    fn test_to_a1_same_sheet() {
        let sheet_id = SheetId::test();
        let map = HashMap::new();

        let part = A1Part {
            sheet_id: None,
            range: A1Range::All,
        };
        let result = part.to_a1(sheet_id, &map).unwrap();
        assert_eq!(result, "*");
    }
    #[test]
    #[parallel]
    fn test_to_a1_different_sheet() {
        let sheet_id = SheetId::new();
        let sheet_id2 = SheetId::new();
        let map = HashMap::from([("Sheet 2".to_string(), sheet_id2)]);
        let part = A1Part {
            sheet_id: Some(sheet_id2),
            range: A1Range::All,
        };
        let result = part.to_a1(sheet_id, &map).unwrap();
        assert_eq!(result, "'Sheet 2'!*");
    }

    #[test]
    #[parallel]
    fn test_to_a1_column() {
        let sheet_id = SheetId::test();
        let map = HashMap::new();
        let part = A1Part {
            sheet_id: None,
            range: A1Range::Column(RelColRow::new(3, true)),
        };
        let result = part.to_a1(sheet_id, &map).unwrap();
        assert_eq!(result, "C");
        let part = A1Part {
            sheet_id: None,
            range: A1Range::Column(RelColRow::new(3, false)),
        };
        let result = part.to_a1(sheet_id, &map).unwrap();
        assert_eq!(result, "$C");
        let part = A1Part {
            sheet_id: None,
            range: A1Range::ExcludeColumn(RelColRow::new(3, true)),
        };
        let result = part.to_a1(sheet_id, &map).unwrap();
        assert_eq!(result, "C");
    }

    #[test]
    #[parallel]
    fn test_to_a1_row() {
        let sheet_id = SheetId::test();
        let map = HashMap::new();
        let part = A1Part {
            sheet_id: None,
            range: A1Range::Row(RelColRow::new(3, true)),
        };
        let result = part.to_a1(sheet_id, &map).unwrap();
        assert_eq!(result, "3");
        let part = A1Part {
            sheet_id: None,
            range: A1Range::Row(RelColRow::new(3, false)),
        };
        let result = part.to_a1(sheet_id, &map).unwrap();
        assert_eq!(result, "$3");
        let part = A1Part {
            sheet_id: None,
            range: A1Range::ExcludeRow(RelColRow::new(3, true)),
        };
        let result = part.to_a1(sheet_id, &map).unwrap();
        assert_eq!(result, "3");
    }

    #[test]
    #[parallel]
    fn test_to_a1_column_range() {
        let sheet_id = SheetId::test();
        let map = HashMap::new();
        let part = A1Part {
            sheet_id: None,
            range: A1Range::ColumnRange(RelColRowRange {
                from: RelColRow::new(3, true),
                to: RelColRow::new(5, true),
            }),
        };
        let result = part.to_a1(sheet_id, &map).unwrap();
        assert_eq!(result, "C:E");
        let part = A1Part {
            sheet_id: None,
            range: A1Range::ExcludeColumnRange(RelColRowRange {
                from: RelColRow::new(3, true),
                to: RelColRow::new(5, true),
            }),
        };
        let result = part.to_a1(sheet_id, &map).unwrap();
        assert_eq!(result, "C:E");
        let part = A1Part {
            sheet_id: None,
            range: A1Range::ColumnRange(RelColRowRange {
                from: RelColRow::new(3, false),
                to: RelColRow::new(5, false),
            }),
        };
        let result = part.to_a1(sheet_id, &map).unwrap();
        assert_eq!(result, "$C:$E");
    }

    #[test]
    #[parallel]
    fn test_to_a1_row_range() {
        let sheet_id = SheetId::test();
        let map = HashMap::new();
        let part = A1Part {
            sheet_id: None,
            range: A1Range::RowRange(RelColRowRange {
                from: RelColRow::new(3, true),
                to: RelColRow::new(5, true),
            }),
        };
        let result = part.to_a1(sheet_id, &map).unwrap();
        assert_eq!(result, "3:5");
        let part = A1Part {
            sheet_id: None,
            range: A1Range::ExcludeRowRange(RelColRowRange {
                from: RelColRow::new(3, true),
                to: RelColRow::new(5, true),
            }),
        };
        let result = part.to_a1(sheet_id, &map).unwrap();
        assert_eq!(result, "3:5");
        let part = A1Part {
            sheet_id: None,
            range: A1Range::RowRange(RelColRowRange {
                from: RelColRow::new(3, false),
                to: RelColRow::new(5, false),
            }),
        };
        let result = part.to_a1(sheet_id, &map).unwrap();
        assert_eq!(result, "$3:$5");
    }

    #[test]
    #[parallel]
    fn test_to_a1_pos() {
        let sheet_id = SheetId::test();
        let map = HashMap::new();
        let part = A1Part {
            sheet_id: None,
            range: A1Range::Pos(RelPos::new(3, 5, true, true)),
        };
        let result = part.to_a1(sheet_id, &map).unwrap();
        assert_eq!(result, "C5");
        let part = A1Part {
            sheet_id: None,
            range: A1Range::ExcludePos(RelPos::new(3, 5, true, true)),
        };
        let result = part.to_a1(sheet_id, &map).unwrap();
        assert_eq!(result, "C5");
        let part = A1Part {
            sheet_id: None,
            range: A1Range::Pos(RelPos::new(3, 5, false, true)),
        };
        let result = part.to_a1(sheet_id, &map).unwrap();
        assert_eq!(result, "$C5");
        let part = A1Part {
            sheet_id: None,
            range: A1Range::Pos(RelPos::new(3, 5, true, false)),
        };
        let result = part.to_a1(sheet_id, &map).unwrap();
        assert_eq!(result, "C$5");
        let part = A1Part {
            sheet_id: None,
            range: A1Range::Pos(RelPos::new(3, 5, false, false)),
        };
        let result = part.to_a1(sheet_id, &map).unwrap();
        assert_eq!(result, "$C$5");
    }
}
