use crate::A1Error;

use super::{A1Range, A1RangeType, RelColRow, RelColRowRange, RelPos, RelRect};

fn translate_index(col_row: &RelColRow, delta: i64) -> Result<RelColRow, A1Error> {
    if !col_row.relative {
        Ok(*col_row)
    } else {
        let new_index = col_row.index as i64 + delta;
        if new_index <= 0 {
            return Err(A1Error::InvalidColumn(format!(
                "Invalid column: {}",
                new_index
            )));
        }

        Ok(RelColRow {
            index: new_index as u64,
            relative: col_row.relative,
        })
    }
}

fn translate_col_row_range(
    col_row_range: &RelColRowRange,
    delta_x: i64,
) -> Result<RelColRowRange, A1Error> {
    Ok(RelColRowRange {
        from: translate_index(&col_row_range.from, delta_x)?,
        to: translate_index(&col_row_range.to, delta_x)?,
    })
}

fn translate_pos(pos: &RelPos, delta_x: i64, delta_y: i64) -> Result<RelPos, A1Error> {
    Ok(RelPos {
        x: translate_index(&pos.x, delta_x)?,
        y: translate_index(&pos.y, delta_y)?,
    })
}

fn translate_rect(rect: &RelRect, delta_x: i64, delta_y: i64) -> Result<RelRect, A1Error> {
    Ok(RelRect {
        min: translate_pos(&rect.min, delta_x, delta_y)?,
        max: translate_pos(&rect.max, delta_x, delta_y)?,
    })
}

impl A1Range {
    /// Translates the range by a delta (only translates relative columns and rows).
    pub fn translate(&mut self, delta_x: i64, delta_y: i64) -> Result<(), A1Error> {
        self.range = match &self.range {
            A1RangeType::Column(x) => A1RangeType::Column(translate_index(x, delta_x)?),
            A1RangeType::ExcludeColumn(x) => {
                A1RangeType::ExcludeColumn(translate_index(x, delta_x)?)
            }
            A1RangeType::ColumnRange(range) => {
                A1RangeType::ColumnRange(translate_col_row_range(range, delta_x)?)
            }
            A1RangeType::ExcludeColumnRange(range) => {
                A1RangeType::ExcludeColumnRange(translate_col_row_range(range, delta_x)?)
            }
            A1RangeType::Row(x) => A1RangeType::Row(translate_index(x, delta_y)?),
            A1RangeType::ExcludeRow(x) => A1RangeType::ExcludeRow(translate_index(x, delta_y)?),
            A1RangeType::RowRange(range) => {
                A1RangeType::RowRange(translate_col_row_range(range, delta_y)?)
            }
            A1RangeType::ExcludeRowRange(range) => {
                A1RangeType::ExcludeRowRange(translate_col_row_range(range, delta_y)?)
            }
            A1RangeType::Pos(pos) => A1RangeType::Pos(translate_pos(pos, delta_x, delta_y)?),
            A1RangeType::ExcludePos(pos) => {
                A1RangeType::ExcludePos(translate_pos(pos, delta_x, delta_y)?)
            }
            A1RangeType::Rect(rect) => A1RangeType::Rect(translate_rect(rect, delta_x, delta_y)?),
            A1RangeType::ExcludeRect(rect) => {
                A1RangeType::ExcludeRect(translate_rect(rect, delta_x, delta_y)?)
            }
            A1RangeType::All => A1RangeType::All,
        };
        Ok(())
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
    fn test_translate_index() {
        let col_row = RelColRow {
            index: 5,
            relative: true,
        };

        assert_eq!(
            translate_index(&col_row, 3),
            Ok(RelColRow {
                index: 8,
                relative: true
            })
        );
        assert_eq!(
            translate_index(&col_row, -2),
            Ok(RelColRow {
                index: 3,
                relative: true
            })
        );
        assert!(translate_index(&col_row, -5).is_err());
    }

    #[test]
    #[parallel]
    fn test_translate_col_row_range() {
        let range = RelColRowRange {
            from: RelColRow {
                index: 2,
                relative: true,
            },
            to: RelColRow {
                index: 5,
                relative: true,
            },
        };

        let expected = RelColRowRange {
            from: RelColRow {
                index: 4,
                relative: true,
            },
            to: RelColRow {
                index: 7,
                relative: true,
            },
        };

        assert_eq!(translate_col_row_range(&range, 2), Ok(expected));
    }

    #[test]
    #[parallel]
    fn test_translate_pos() {
        let pos = RelPos {
            x: RelColRow {
                index: 3,
                relative: true,
            },
            y: RelColRow {
                index: 4,
                relative: true,
            },
        };

        let expected = RelPos {
            x: RelColRow {
                index: 5,
                relative: true,
            },
            y: RelColRow {
                index: 7,
                relative: true,
            },
        };

        assert_eq!(translate_pos(&pos, 2, 3), Ok(expected));
    }

    #[test]
    #[parallel]
    fn test_translate_rect() {
        let rect = RelRect {
            min: RelPos {
                x: RelColRow {
                    index: 1,
                    relative: true,
                },
                y: RelColRow {
                    index: 2,
                    relative: true,
                },
            },
            max: RelPos {
                x: RelColRow {
                    index: 3,
                    relative: true,
                },
                y: RelColRow {
                    index: 4,
                    relative: true,
                },
            },
        };

        let expected = RelRect {
            min: RelPos {
                x: RelColRow {
                    index: 2,
                    relative: true,
                },
                y: RelColRow {
                    index: 4,
                    relative: true,
                },
            },
            max: RelPos {
                x: RelColRow {
                    index: 4,
                    relative: true,
                },
                y: RelColRow {
                    index: 6,
                    relative: true,
                },
            },
        };

        assert_eq!(translate_rect(&rect, 1, 2), Ok(expected));
    }

    #[test]
    #[parallel]
    fn test_translate_column() {
        let sheet_id = SheetId::new();
        let sheet_name_id = HashMap::new();
        let mut range = A1Range::from_a1("B", sheet_id, &sheet_name_id).unwrap();
        dbg!(&range);
        range.translate(1, 0).unwrap();
        assert_eq!(range.range, A1RangeType::Column(RelColRow::new(3, true)));
    }

    #[test]
    #[parallel]
    fn test_translate_row() {
        let sheet_id = SheetId::new();
        let sheet_name_id = HashMap::new();
        let mut range = A1Range::from_a1("2", sheet_id, &sheet_name_id).unwrap();
        range.translate(0, 2).unwrap();
        assert_eq!(range.range, A1RangeType::Row(RelColRow::new(4, true)));
    }

    #[test]
    #[parallel]
    fn test_translate_position() {
        let sheet_id = SheetId::new();
        let sheet_name_id = HashMap::new();
        let mut range = A1Range::from_a1("C3", sheet_id, &sheet_name_id).unwrap();
        range.translate(2, 1).unwrap();
        assert_eq!(range.range, A1RangeType::Pos(RelPos::new(5, 4, true, true)));
    }

    #[test]
    #[parallel]
    fn test_translate_range() {
        let sheet_id = SheetId::new();
        let sheet_name_id = HashMap::new();
        let mut range = A1Range::from_a1("A1:B2", sheet_id, &sheet_name_id).unwrap();
        range.translate(1, 1).unwrap();
        assert_eq!(
            range.range,
            A1RangeType::Rect(RelRect {
                min: RelPos::new(2, 2, true, true),
                max: RelPos::new(3, 3, true, true),
            })
        );
    }

    #[test]
    #[parallel]
    fn test_translate_excluded_column() {
        let sheet_id = SheetId::new();
        let sheet_name_id = HashMap::new();
        let mut range = A1Range::from_a1("C", sheet_id, &sheet_name_id).unwrap();
        range.to_excluded().unwrap();
        range.translate(-1, 0).unwrap();
        assert_eq!(
            range.range,
            A1RangeType::ExcludeColumn(RelColRow::new(2, true))
        );
    }

    #[test]
    #[parallel]
    fn test_translate_all() {
        let sheet_id = SheetId::new();
        let sheet_name_id = HashMap::new();
        let mut range = A1Range::from_a1("*", sheet_id, &sheet_name_id).unwrap();
        range.translate(1, 1).unwrap();
        assert_eq!(range.range, A1RangeType::All);
    }

    #[test]
    #[parallel]
    fn test_translate_out_of_bounds() {
        let sheet_id = SheetId::new();
        let sheet_name_id = HashMap::new();
        let mut range = A1Range::from_a1("A1", sheet_id, &sheet_name_id).unwrap();
        assert!(range.translate(-1, -1).is_err());
    }
}
