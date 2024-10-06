use crate::A1Error;

use super::{A1Part, A1Range, RelColRow, RelColRowRange, RelPos, RelRect};

fn translate_index(col_row: &RelColRow, delta: i64) -> Result<RelColRow, A1Error> {
    if !col_row.relative {
        Ok(col_row.clone())
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

impl A1Part {
    /// Translates the A1Part by a delta.
    pub fn translate(&mut self, delta_x: i64, delta_y: i64) -> Result<(), A1Error> {
        self.range = match &self.range {
            A1Range::All => A1Range::All,
            A1Range::Column(x) => A1Range::Column(translate_index(x, delta_x)?),
            A1Range::ExcludeColumn(x) => A1Range::ExcludeColumn(translate_index(x, delta_x)?),
            A1Range::ColumnRange(range) => {
                A1Range::ColumnRange(translate_col_row_range(range, delta_x)?)
            }
            A1Range::ExcludeColumnRange(range) => {
                A1Range::ExcludeColumnRange(translate_col_row_range(range, delta_x)?)
            }
            A1Range::Row(x) => A1Range::Row(translate_index(x, delta_y)?),
            A1Range::ExcludeRow(x) => A1Range::ExcludeRow(translate_index(x, delta_y)?),
            A1Range::RowRange(range) => A1Range::RowRange(translate_col_row_range(range, delta_y)?),
            A1Range::ExcludeRowRange(range) => {
                A1Range::ExcludeRowRange(translate_col_row_range(range, delta_y)?)
            }
            A1Range::Pos(pos) => A1Range::Pos(translate_pos(pos, delta_x, delta_y)?),
            A1Range::ExcludePos(pos) => A1Range::ExcludePos(translate_pos(pos, delta_x, delta_y)?),
            A1Range::Rect(rect) => A1Range::Rect(translate_rect(rect, delta_x, delta_y)?),
            A1Range::ExcludeRect(rect) => {
                A1Range::ExcludeRect(translate_rect(rect, delta_x, delta_y)?)
            }
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
        let mut a1_part = A1Part::from_a1("B", sheet_id, &sheet_name_id).unwrap();
        dbg!(&a1_part);
        a1_part.translate(1, 0).unwrap();
        assert_eq!(a1_part.range, A1Range::Column(RelColRow::new(3, true)));
    }

    #[test]
    #[parallel]
    fn test_translate_row() {
        let sheet_id = SheetId::new();
        let sheet_name_id = HashMap::new();
        let mut a1_part = A1Part::from_a1("2", sheet_id, &sheet_name_id).unwrap();
        a1_part.translate(0, 2).unwrap();
        assert_eq!(a1_part.range, A1Range::Row(RelColRow::new(4, true)));
    }

    #[test]
    #[parallel]
    fn test_translate_position() {
        let sheet_id = SheetId::new();
        let sheet_name_id = HashMap::new();
        let mut a1_part = A1Part::from_a1("C3", sheet_id, &sheet_name_id).unwrap();
        a1_part.translate(2, 1).unwrap();
        assert_eq!(a1_part.range, A1Range::Pos(RelPos::new(5, 4, true, true)));
    }

    #[test]
    #[parallel]
    fn test_translate_range() {
        let sheet_id = SheetId::new();
        let sheet_name_id = HashMap::new();
        let mut a1_part = A1Part::from_a1("A1:B2", sheet_id, &sheet_name_id).unwrap();
        a1_part.translate(1, 1).unwrap();
        assert_eq!(
            a1_part.range,
            A1Range::Rect(RelRect {
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
        let mut a1_part = A1Part::from_a1("C", sheet_id, &sheet_name_id).unwrap();
        a1_part.to_excluded().unwrap();
        a1_part.translate(-1, 0).unwrap();
        assert_eq!(
            a1_part.range,
            A1Range::ExcludeColumn(RelColRow::new(2, true))
        );
    }

    #[test]
    #[parallel]
    fn test_translate_all() {
        let sheet_id = SheetId::new();
        let sheet_name_id = HashMap::new();
        let mut a1_part = A1Part::from_a1("*", sheet_id, &sheet_name_id).unwrap();
        a1_part.translate(1, 1).unwrap();
        assert_eq!(a1_part.range, A1Range::All);
    }

    #[test]
    #[parallel]
    fn test_translate_out_of_bounds() {
        let sheet_id = SheetId::new();
        let sheet_name_id = HashMap::new();
        let mut a1_part = A1Part::from_a1("A1", sheet_id, &sheet_name_id).unwrap();
        assert!(a1_part.translate(-1, -1).is_err());
    }
}
