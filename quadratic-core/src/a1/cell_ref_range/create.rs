use crate::grid::SheetId;

use super::*;

impl CellRefRange {
    pub(crate) fn new_relative_xy(x: i64, y: i64) -> Self {
        Self::Sheet {
            range: RefRangeBounds::new_relative_xy(x, y),
        }
    }

    pub(crate) fn new_relative_pos(pos: Pos) -> Self {
        Self::Sheet {
            range: RefRangeBounds::new_relative_pos(pos),
        }
    }

    pub(crate) fn new_relative_column(x: i64) -> Self {
        Self::Sheet {
            range: RefRangeBounds::new_relative_col(x),
        }
    }

    pub(crate) fn new_relative_row(y: i64) -> Self {
        Self::Sheet {
            range: RefRangeBounds::new_relative_row(y),
        }
    }

    pub(crate) fn new_relative_column_range(x1: i64, x2: i64) -> Self {
        Self::Sheet {
            range: RefRangeBounds::new_relative_column_range(x1, x2),
        }
    }

    pub(crate) fn new_relative_row_range(y1: i64, y2: i64) -> Self {
        Self::Sheet {
            range: RefRangeBounds::new_relative_row_range(y1, y2),
        }
    }

    pub(crate) fn new_relative_rect(rect: Rect) -> Self {
        Self::Sheet {
            range: RefRangeBounds::new_relative_rect(rect),
        }
    }

    /// Parses from A1 or RC notation.
    ///
    /// If `base_pos` is `None`, then only A1 notation is accepted. If it is
    /// `Some`, then A1 and RC notation are both accepted.
    pub(crate) fn parse(
        s: &str,
        a1_context: &A1Context,
        base_pos: Option<Pos>,
    ) -> Result<(Self, Option<SheetId>), A1Error> {
        // first try table parsing
        if let Ok(table_ref) = TableRef::parse(s, a1_context)
            && let Some(entry) = a1_context.try_table(&table_ref.table_name)
        {
            return Ok((Self::Table { range: table_ref }, Some(entry.sheet_id)));
        }
        // then try sheet parsing
        Ok((
            Self::Sheet {
                range: RefRangeBounds::from_str(s, base_pos)?,
            },
            None,
        ))
    }
}

#[cfg(test)]
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

            let base_pos = Pos::new(10, 15);
            let a1_string = cell_ref_range.to_string();
            let rc_string = cell_ref_range.to_rc_string(base_pos);
            let expected = (cell_ref_range, None);

            assert_eq!(expected, CellRefRange::parse(&a1_string, &context, None).unwrap());
            assert_eq!(expected, CellRefRange::parse(&a1_string, &context, Some(base_pos)).unwrap());
            assert_eq!(expected, CellRefRange::parse(&rc_string, &context, Some(base_pos)).unwrap());
        }
    }

    #[test]
    fn test_table_different_sheet() {
        let sheet1_id = SheetId::TEST;
        let sheet2_id = SheetId::TEST;
        let mut context = A1Context::test(
            &[("Sheet1", sheet1_id), ("Sheet 2", sheet2_id)],
            &[("Table1", &["col1", "col2", "col3"], Rect::test_a1("A1:C3"))],
        );
        context.table_mut("Table1").unwrap().sheet_id = sheet2_id;
        let (_, sheet_id) = CellRefRange::parse("Table1", &context, None).unwrap();
        assert_eq!(sheet_id, Some(sheet2_id));
        let base_pos = Pos::new(10, 15);
        let (_, sheet_id) = CellRefRange::parse("Table1", &context, Some(base_pos)).unwrap();
        assert_eq!(sheet_id, Some(sheet2_id));
    }
}
