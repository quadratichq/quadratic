use super::*;

impl A1Selection {
    /// Selects a table.
    pub fn select_table(&mut self, table_name: &str, col: Option<String>, append: bool) {
        if append {
            if let Some(CellRefRange::Table { range }) = self.ranges.iter_mut().find(|r| {
                if let CellRefRange::Table { range } = r {
                    range.table_name.eq_ignore_ascii_case(table_name)
                } else {
                    false
                }
            }) {
                if let Some(col) = col {
                    range.set_col(col, true);
                }
                return;
            }
        } else {
            self.ranges.clear();
        }
        let mut table_ref = TableRef::new(table_name);
        if let Some(col) = col {
            table_ref.set_col(col, false);
        }
        self.ranges.push(CellRefRange::Table { range: table_ref });
    }
}

#[cfg(test)]
#[serial_test::parallel]
mod tests {
    use crate::a1::RefRangeBounds;

    use super::*;

    #[test]
    fn test_select_table() {
        let mut selection = A1Selection::test_a1("A1");
        selection.select_table("Table1", None, false);
        assert_eq!(selection.ranges.len(), 1);
        assert_eq!(
            selection.ranges[0],
            CellRefRange::Table {
                range: TableRef::new("Table1"),
            }
        );
    }

    #[test]
    fn test_select_table_col() {
        let mut selection = A1Selection::test_a1("A1");
        selection.select_table("Table1", Some("Col1".to_string()), false);
        assert_eq!(selection.ranges.len(), 1);
        let mut table_ref = TableRef::new("Table1");
        table_ref.set_col("Col1".to_string(), false);
        assert_eq!(
            selection.ranges[0],
            CellRefRange::Table { range: table_ref }
        );
    }

    #[test]
    fn test_select_table_append() {
        let mut selection = A1Selection::test_a1("A1");
        selection.select_table("Table1", None, true);
        assert_eq!(selection.ranges.len(), 2);
        assert_eq!(
            selection.ranges[0],
            CellRefRange::Sheet {
                range: RefRangeBounds::test_a1("A1"),
            }
        );
        assert_eq!(
            selection.ranges[1],
            CellRefRange::Table {
                range: TableRef::new("Table1"),
            }
        );
    }

    #[test]
    fn test_select_table_append_col() {
        let mut selection = A1Selection::test_a1("A1");
        selection.select_table("Table1", None, false);
        selection.select_table("Table1", Some("Col1".to_string()), true);
        assert_eq!(selection.ranges.len(), 1);
        let mut table_ref = TableRef::new("Table1");
        table_ref.set_col("Col1".to_string(), false);
        assert_eq!(
            selection.ranges[0],
            CellRefRange::Table { range: table_ref }
        );

        selection.select_table("Table1", Some("Col2".to_string()), true);
        assert_eq!(selection.ranges.len(), 2);
        let mut table_ref = TableRef::new("Table1");
        table_ref.set_col("Col1".to_string(), false);
        table_ref.set_col("Col2".to_string(), false);
        assert_eq!(
            selection.ranges[0],
            CellRefRange::Table { range: table_ref }
        );
    }
}
