use crate::a1::TableRef;

use super::*;

impl A1Selection {
    /// Selects a table.
    pub fn select_table(&mut self, table_name: &str, append: bool) {
        let table = CellRefRange::Table {
            range: TableRef::new(table_name),
        };
        if append {
            if !self.ranges.contains(&table) {
                self.ranges.push(table);
            }
        } else {
            self.ranges.clear();
            self.ranges.push(table);
        }
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
        selection.select_table("Table1", false);
        assert_eq!(selection.ranges.len(), 1);
        assert_eq!(
            selection.ranges[0],
            CellRefRange::Table {
                range: TableRef::new("Table1"),
            }
        );
    }

    #[test]
    fn test_select_table_append() {
        let mut selection = A1Selection::test_a1("A1");
        selection.select_table("Table1", true);
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
}
