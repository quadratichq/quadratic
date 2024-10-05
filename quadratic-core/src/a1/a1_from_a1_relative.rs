use super::{
    a1_parts::{RelColRow, RelColRowRange, RelPos, RelRect},
    A1,
};

impl A1 {
    /// Tries to convert an A1 part to a (column, relative).
    pub fn try_from_column_relative(a1: &str) -> Option<RelColRow> {
        let column = A1::try_from_column(a1)?;
        let relative = !a1.trim().starts_with('$');

        Some(RelColRow {
            index: column,
            relative,
        })
    }

    /// Tries to convert an A1 part to RelColRow.
    pub fn try_from_row_relative(a1: &str) -> Option<RelColRow> {
        let row = A1::try_from_row(a1)?;
        let relative = !a1.trim().starts_with('$');

        Some(RelColRow {
            index: row,
            relative,
        })
    }

    /// Tries to convert an A1 part to RelPos.
    pub fn try_from_pos_relative(a1: &str) -> Option<RelPos> {
        let pos = A1::try_from_pos(&a1)?;

        let relative_x = !a1.trim().starts_with('$');

        let numeric = a1.find(char::is_numeric)?;
        let relative_y = a1.chars().nth(numeric - 1).is_some_and(|c| c != '$');

        Some(RelPos {
            x: pos.x as u64,
            y: pos.y as u64,
            relative_x,
            relative_y,
        })
    }

    /// Tries to create a Vec<RelRect> from an A1 string.
    pub fn try_from_range_relative(a1: &str) -> Option<RelRect> {
        if let Some((from, to)) = a1.split_once(':') {
            let min = A1::try_from_pos_relative(from)?;
            let max = A1::try_from_pos_relative(to)?;

            Some(RelRect { min, max })
        } else {
            None
        }
    }

    /// Tries to create Column(s) from an A1 string. Returns a vector of RelColRow.
    pub fn try_from_column_range_relative(a1: &str) -> Option<RelColRowRange> {
        a1.split_once(':')
            .map(|(from, to)| {
                let (from, to) = match (
                    A1::try_from_column_relative(from),
                    A1::try_from_column_relative(to),
                ) {
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
                A1::try_from_column_relative(&a1).map(|x| RelColRowRange { from: x, to: x })
            })
    }

    /// Tries to create Row ranges from an A1 string.
    pub fn try_from_row_range_relative(a1: &str) -> Option<RelColRowRange> {
        a1.split_once(':')
            .map(|(from, to)| {
                let (from, to) = match (
                    A1::try_from_row_relative(from),
                    A1::try_from_row_relative(to),
                ) {
                    (Some(a), Some(b)) => {
                        if a.index > b.index {
                            (b, a)
                        } else {
                            (a, b)
                        }
                    }

                    // handles the case of a "1:" (partially inputted range)
                    (Some(a), None) => (a, a),
                    _ => return None,
                };
                Some(RelColRowRange { from, to })
            })
            .unwrap_or_else(|| {
                A1::try_from_row_relative(&a1).map(|y| RelColRowRange { from: y, to: y })
            })
    }
}

#[cfg(test)]
mod test {
    use super::*;

    #[test]
    fn test_try_from_column_relative() {
        assert_eq!(
            A1::try_from_column_relative("A"),
            Some(RelColRow {
                index: 1,
                relative: true
            })
        );
        assert_eq!(
            A1::try_from_column_relative("$B"),
            Some(RelColRow {
                index: 2,
                relative: false
            })
        );
        assert_eq!(A1::try_from_column_relative("1"), None);
    }

    #[test]
    fn test_try_from_row_relative() {
        assert_eq!(
            A1::try_from_row_relative("1"),
            Some(RelColRow {
                index: 1,
                relative: true
            })
        );
        assert_eq!(
            A1::try_from_row_relative("$2"),
            Some(RelColRow {
                index: 2,
                relative: false
            })
        );
        assert_eq!(A1::try_from_row_relative("A"), None);
    }

    #[test]
    fn test_try_from_pos_relative() {
        assert_eq!(
            A1::try_from_pos_relative("A1"),
            Some(RelPos {
                x: 1,
                y: 1,
                relative_x: true,
                relative_y: true
            })
        );
        assert_eq!(
            A1::try_from_pos_relative("$B$2"),
            Some(RelPos {
                x: 2,
                y: 2,
                relative_x: false,
                relative_y: false
            })
        );
        assert_eq!(
            A1::try_from_pos_relative("$C3"),
            Some(RelPos {
                x: 3,
                y: 3,
                relative_x: false,
                relative_y: true
            })
        );
        assert_eq!(A1::try_from_pos_relative("A"), None);
    }

    #[test]
    fn test_try_from_range_relative() {
        assert_eq!(
            A1::try_from_range_relative("A1:B2"),
            Some(RelRect {
                min: RelPos {
                    x: 1,
                    y: 1,
                    relative_x: true,
                    relative_y: true
                },
                max: RelPos {
                    x: 2,
                    y: 2,
                    relative_x: true,
                    relative_y: true
                }
            })
        );
        assert_eq!(
            A1::try_from_range_relative("$A$1:$B$2"),
            Some(RelRect {
                min: RelPos {
                    x: 1,
                    y: 1,
                    relative_x: false,
                    relative_y: false
                },
                max: RelPos {
                    x: 2,
                    y: 2,
                    relative_x: false,
                    relative_y: false
                }
            })
        );
        assert_eq!(A1::try_from_range_relative("A1"), None);
    }

    #[test]
    fn test_try_from_column_range_relative() {
        assert_eq!(
            A1::try_from_column_range_relative("A:C"),
            Some(RelColRowRange {
                from: RelColRow {
                    index: 1,
                    relative: true
                },
                to: RelColRow {
                    index: 3,
                    relative: true
                }
            })
        );
        assert_eq!(
            A1::try_from_column_range_relative("$B:$D"),
            Some(RelColRowRange {
                from: RelColRow {
                    index: 2,
                    relative: false
                },
                to: RelColRow {
                    index: 4,
                    relative: false
                }
            })
        );
        assert_eq!(
            A1::try_from_column_range_relative("C:A"),
            Some(RelColRowRange {
                from: RelColRow {
                    index: 1,
                    relative: true
                },
                to: RelColRow {
                    index: 3,
                    relative: true
                }
            })
        );
        assert_eq!(
            A1::try_from_column_range_relative("A"),
            Some(RelColRowRange {
                from: RelColRow {
                    index: 1,
                    relative: true
                },
                to: RelColRow {
                    index: 1,
                    relative: true
                }
            })
        );
    }

    #[test]
    fn test_try_from_row_range_relative() {
        assert_eq!(
            A1::try_from_row_range_relative("1:3"),
            Some(RelColRowRange {
                from: RelColRow {
                    index: 1,
                    relative: true
                },
                to: RelColRow {
                    index: 3,
                    relative: true
                }
            })
        );
        assert_eq!(
            A1::try_from_row_range_relative("$2:$4"),
            Some(RelColRowRange {
                from: RelColRow {
                    index: 2,
                    relative: false
                },
                to: RelColRow {
                    index: 4,
                    relative: false
                }
            })
        );
        assert_eq!(
            A1::try_from_row_range_relative("3:1"),
            Some(RelColRowRange {
                from: RelColRow {
                    index: 1,
                    relative: true
                },
                to: RelColRow {
                    index: 3,
                    relative: true
                }
            })
        );
        assert_eq!(
            A1::try_from_row_range_relative("1"),
            Some(RelColRowRange {
                from: RelColRow {
                    index: 1,
                    relative: true
                },
                to: RelColRow {
                    index: 1,
                    relative: true
                }
            })
        );
    }
}
