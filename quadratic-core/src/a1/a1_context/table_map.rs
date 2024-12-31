use serde::{Deserialize, Serialize};

use crate::{
    grid::{DataTable, SheetId},
    Pos, Rect,
};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TableMapEntry {
    pub sheet_id: SheetId,
    pub table_name: String,
    pub visible_columns: Vec<String>,
    pub all_columns: Vec<String>,
    pub bounds: Rect,
}

impl TableMapEntry {
    /// Tries to get the column for the given column name.
    pub fn try_col_index(&self, col: &str) -> Option<i64> {
        let index = self
            .visible_columns
            .iter()
            .position(|c| c.to_lowercase() == col.to_lowercase())?;
        Some(self.bounds.min.x + index as i64)
    }

    pub fn try_col_range(&self, col1: &str, col2: &str) -> Option<(i64, i64)> {
        // first try to see if start and end are visible columns
        let start = self.try_col_index(col1);
        let end = self.try_col_index(col2);
        if let (Some(start), Some(end)) = (start, end) {
            return Some((self.bounds.min.x + start, self.bounds.min.x + end));
        } else if let (Some(start), None) = (start, end) {
            let end = self
                .all_columns
                .iter()
                .position(|c| c.to_lowercase() == col2.to_lowercase())?;
            for i in start + 1..end as i64 {
                if self.visible_columns.contains(&self.all_columns[i as usize]) {
                    return Some((self.bounds.min.x + start, self.bounds.min.x + i));
                }
            }
        } else if let (None, Some(end)) = (start, end) {
            let start = self
                .all_columns
                .iter()
                .position(|c| c.to_lowercase() == col1.to_lowercase())?;
            for i in start as i64 + 1..end {
                if self.visible_columns.contains(&self.all_columns[i as usize]) {
                    return Some((self.bounds.min.x + i, self.bounds.min.x + end));
                }
            }
        } else {
            let start = self
                .all_columns
                .iter()
                .position(|c| c.to_lowercase() == col1.to_lowercase())?;
            let end = self
                .all_columns
                .iter()
                .position(|c| c.to_lowercase() == col2.to_lowercase())?;

            // Find first visible column after start
            let mut start_visible = None;
            for i in start + 1..end {
                if self.visible_columns.contains(&self.all_columns[i]) {
                    start_visible = Some(i);
                    break;
                }
            }
            if start_visible.is_none() {
                return None;
            }
            // Find last visible column before end
            let mut end_visible = None;
            for i in (start + 1..end).rev() {
                if self.visible_columns.contains(&self.all_columns[i]) {
                    end_visible = Some(i);
                    break;
                }
            }

            if let (Some(first), Some(last)) = (start_visible, end_visible) {
                return Some((
                    self.bounds.min.x + first as i64,
                    self.bounds.min.x + last as i64,
                ));
            }
        }
        None
    }
}

#[derive(Default, Debug, Clone, Serialize, Deserialize)]
pub struct TableMap {
    pub tables: Vec<TableMapEntry>,
}

impl TableMap {
    pub fn insert(&mut self, sheet_id: SheetId, pos: Pos, table: &DataTable) {
        self.tables.push(TableMapEntry {
            sheet_id,
            table_name: table.name.clone(),
            visible_columns: table.columns_map(false),
            all_columns: table.columns_map(true),
            bounds: table.output_rect(pos, true),
        });
    }

    /// Finds a table by name.
    pub fn try_table(&self, table_name: &str) -> Option<&TableMapEntry> {
        self.tables
            .iter()
            .find(|table| table.table_name.to_lowercase() == table_name.to_lowercase())
    }

    /// Returns a list of all table names in the table map.
    pub fn table_names(&self) -> Vec<String> {
        self.tables.iter().map(|t| t.table_name.clone()).collect()
    }
}

#[cfg(test)]
impl TableMap {
    /// Inserts a test table into the table map.
    ///
    /// if all_columns is None, then it uses visible_columns.
    pub fn test_insert(
        &mut self,
        sheet_id: SheetId,
        table_name: &str,
        visible_columns: &[&str],
        all_columns: Option<&[&str]>,
        bounds: Rect,
    ) {
        let visible_columns: Vec<String> = visible_columns.iter().map(|c| c.to_string()).collect();
        self.tables.push(TableMapEntry {
            sheet_id,
            table_name: table_name.to_string(),
            visible_columns: visible_columns.clone(),
            all_columns: all_columns.map_or(visible_columns, |c| {
                c.iter().map(|c| c.to_string()).collect()
            }),
            bounds,
        });
    }
}

#[cfg(test)]
#[serial_test::parallel]
mod tests {
    use super::*;

    #[test]
    fn test_try_col_index() {
        let mut map = TableMap::default();
        map.test_insert(
            SheetId::test(),
            "test",
            &["Col1", "Col2", "Col3"],
            None,
            Rect::new(1, 1, 3, 5),
        );

        let table = map.try_table("test").unwrap();

        // Test exact match
        assert_eq!(table.try_col_index("Col1"), Some(1));
        assert_eq!(table.try_col_index("Col2"), Some(2));
        assert_eq!(table.try_col_index("Col3"), Some(3));

        // Test case insensitive
        assert_eq!(table.try_col_index("col1"), Some(1));
        assert_eq!(table.try_col_index("COL2"), Some(2));

        // Test non-existent column
        assert_eq!(table.try_col_index("Col4"), None);
    }

    #[test]
    fn test_try_col_range() {
        let mut map = TableMap::default();

        // Test with visible and hidden columns
        map.test_insert(
            SheetId::test(),
            "test",
            &["A", "C", "E"],                 // visible columns
            Some(&["A", "B", "C", "D", "E"]), // all columns
            Rect::new(1, 1, 3, 5),
        );

        let table = map.try_table("test").unwrap();

        // Test both visible columns
        assert_eq!(table.try_col_range("A", "C"), Some((1, 2)));
        assert_eq!(table.try_col_range("A", "E"), Some((1, 3)));

        // Test case insensitive
        assert_eq!(table.try_col_range("a", "c"), Some((1, 2)));

        // Test with hidden start column
        assert_eq!(table.try_col_range("B", "E"), Some((2, 3)));

        // Test with hidden end column
        assert_eq!(table.try_col_range("A", "D"), Some((1, 2)));

        // Test with both hidden columns
        assert_eq!(table.try_col_range("B", "D"), Some((2, 2)));

        // Test non-existent columns
        assert_eq!(table.try_col_range("X", "Y"), None);
        assert_eq!(table.try_col_range("A", "Y"), None);
        assert_eq!(table.try_col_range("X", "E"), None);
    }
}
