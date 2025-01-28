use super::*;

impl CellRefRange {
    pub fn new_relative_all_from(pos: Pos) -> Self {
        Self::Sheet {
            range: RefRangeBounds::new_relative_all_from(pos),
        }
    }

    pub fn new_relative_row_from(row: i64, min_col: i64) -> Self {
        Self::Sheet {
            range: RefRangeBounds::new_relative(min_col, row, UNBOUNDED, row),
        }
    }

    pub fn new_relative_column_from(col: i64, min_row: i64) -> Self {
        Self::Sheet {
            range: RefRangeBounds::new_relative(col, min_row, UNBOUNDED, min_row),
        }
    }

    pub fn new_relative_xy(x: i64, y: i64) -> Self {
        Self::Sheet {
            range: RefRangeBounds::new_relative_xy(x, y),
        }
    }

    pub fn new_relative_pos(pos: Pos) -> Self {
        Self::Sheet {
            range: RefRangeBounds::new_relative_pos(pos),
        }
    }

    pub fn new_relative_column(x: i64) -> Self {
        Self::Sheet {
            range: RefRangeBounds::new_relative_col(x),
        }
    }

    pub fn new_relative_row(y: i64) -> Self {
        Self::Sheet {
            range: RefRangeBounds::new_relative_row(y),
        }
    }

    pub fn new_relative_column_range(x1: i64, x2: i64) -> Self {
        Self::Sheet {
            range: RefRangeBounds::new_relative_column_range(x1, x2),
        }
    }

    pub fn new_relative_row_range(y1: i64, y2: i64) -> Self {
        Self::Sheet {
            range: RefRangeBounds::new_relative_row_range(y1, y2),
        }
    }

    pub fn new_relative_rect(rect: Rect) -> Self {
        Self::Sheet {
            range: RefRangeBounds::new_relative_rect(rect),
        }
    }

    pub fn parse(s: &str, context: &A1Context) -> Result<Self, A1Error> {
        // first try table parsing
        if let Ok(table_ref) = TableRef::parse(s, context) {
            return Ok(Self::Table { range: table_ref });
        }
        // then try sheet parsing
        Ok(Self::Sheet {
            range: RefRangeBounds::from_str(s)?,
        })
    }
}

#[cfg(test)]
#[serial_test::parallel]
mod tests {
    use super::*;

    use proptest::prelude::*;

    proptest! {
        #[test]
        fn proptest_cell_ref_range_parsing(cell_ref_range: CellRefRange) {
            if matches!(cell_ref_range, CellRefRange::Table { .. }) {
                return Ok(());
            }
            let context = A1Context::default();
            let parsed = CellRefRange::parse(&cell_ref_range.to_string(), &context).unwrap();
            assert_eq!(
                cell_ref_range,
                parsed
            );
        }
    }
}
