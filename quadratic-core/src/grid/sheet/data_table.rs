use super::Sheet;
use crate::{grid::data_table::DataTable, Pos};

use anyhow::{anyhow, bail, Result};
use indexmap::map::{Entry, OccupiedEntry};

impl Sheet {
    /// Sets or deletes a data table.
    ///
    /// Returns the old value if it was set.
    #[cfg(test)]
    pub fn set_data_table(&mut self, pos: Pos, data_table: Option<DataTable>) -> Option<DataTable> {
        if let Some(data_table) = data_table {
            self.data_tables.insert_sorted(pos, data_table).1
        } else {
            self.data_tables.shift_remove(&pos)
        }
    }

    /// Returns a DataTable at a Pos
    pub fn data_table(&self, pos: Pos) -> Option<&DataTable> {
        self.data_tables.get(&pos)
    }

    /// Returns a DataTable at a Pos
    pub fn data_table_result(&self, pos: Pos) -> Result<&DataTable> {
        self.data_tables
            .get(&pos)
            .ok_or_else(|| anyhow!("Data table not found at {:?}", pos))
    }

    /// Returns a mutable DataTable at a Pos
    pub fn data_table_mut(&mut self, pos: Pos) -> Result<&mut DataTable> {
        self.data_tables
            .get_mut(&pos)
            .ok_or_else(|| anyhow!("Data table not found at {:?}", pos))
    }

    /// Returns a DataTable entry at a Pos for in-place manipulation
    pub fn data_table_entry(&mut self, pos: Pos) -> Result<OccupiedEntry<'_, Pos, DataTable>> {
        let entry = self.data_tables.entry(pos);

        match entry {
            Entry::Occupied(entry) => Ok(entry),
            Entry::Vacant(_) => bail!("Data table not found at {:?}", pos),
        }
    }

    pub fn delete_data_table(&mut self, pos: Pos) -> Result<DataTable> {
        self.data_tables
            .swap_remove(&pos)
            .ok_or_else(|| anyhow!("Data table not found at {:?}", pos))
    }

    pub fn data_tables_within(&self, pos: Pos) -> Result<Vec<Pos>> {
        let data_tables = self
            .data_tables
            .iter()
            .filter_map(|(data_table_pos, data_table)| {
                data_table
                    .output_rect(*data_table_pos, false)
                    .contains(pos)
                    .then_some(*data_table_pos)
            })
            .collect();

        Ok(data_tables)
    }

    pub fn first_data_table_within(&self, pos: Pos) -> Result<Pos> {
        let data_tables = self.data_tables_within(pos)?;

        match data_tables.first() {
            Some(pos) => Ok(*pos),
            None => bail!("No data tables found within {:?}", pos),
        }
    }

    /// Checks whether a table intersects a position. We ignore the table if it
    /// includes either exclude_x or exclude_y.
    pub fn table_intersects(
        &self,
        x: i64,
        y: i64,
        exclude_x: Option<i64>,
        exclude_y: Option<i64>,
    ) -> bool {
        self.data_tables.iter().any(|(data_table_pos, data_table)| {
            // we only care about html or image tables
            if !data_table.is_html_or_image() {
                return false;
            }
            let output_rect = data_table.output_rect(*data_table_pos, false);
            if output_rect.contains(Pos { x, y }) {
                if let Some(exclude_x) = exclude_x {
                    if exclude_x >= output_rect.min.x && exclude_x <= output_rect.max.x {
                        return false;
                    }
                }
                if let Some(exclude_y) = exclude_y {
                    if exclude_y >= output_rect.min.y && exclude_y <= output_rect.max.y {
                        return false;
                    }
                }
                true
            } else {
                false
            }
        })
    }
}

#[cfg(test)]
mod test {
    use super::*;
    use crate::{
        controller::GridController,
        grid::{CodeRun, DataTableKind},
        CellValue, Value,
    };
    use bigdecimal::BigDecimal;
    use serial_test::parallel;
    use std::vec;

    #[test]
    #[parallel]
    fn test_set_data_table() {
        let mut gc = GridController::test();
        let sheet_id = gc.sheet_ids()[0];
        let sheet = gc.grid_mut().try_sheet_mut(sheet_id).unwrap();
        let code_run = CodeRun {
            std_out: None,
            std_err: None,
            formatted_code_string: None,
            cells_accessed: Default::default(),
            error: None,
            return_type: Some("number".into()),
            line_number: None,
            output_type: None,
        };
        let data_table = DataTable::new(
            DataTableKind::CodeRun(code_run),
            "Table 1",
            Value::Single(CellValue::Number(BigDecimal::from(2))),
            false,
            false,
            true,
            None,
        );
        let old = sheet.set_data_table(Pos { x: 0, y: 0 }, Some(data_table.clone()));
        assert_eq!(old, None);
        assert_eq!(sheet.data_table(Pos { x: 0, y: 0 }), Some(&data_table));
        assert_eq!(sheet.data_table(Pos { x: 0, y: 0 }), Some(&data_table));
        assert_eq!(sheet.data_table(Pos { x: 1, y: 0 }), None);
    }

    #[test]
    #[parallel]
    fn test_get_data_table() {
        let mut gc = GridController::test();
        let sheet_id = gc.sheet_ids()[0];
        let sheet = gc.grid_mut().try_sheet_mut(sheet_id).unwrap();
        let code_run = CodeRun {
            std_err: None,
            std_out: None,
            formatted_code_string: None,
            cells_accessed: Default::default(),
            error: None,
            return_type: Some("number".into()),
            line_number: None,
            output_type: None,
        };
        let data_table = DataTable::new(
            DataTableKind::CodeRun(code_run),
            "Table 1",
            Value::Single(CellValue::Number(BigDecimal::from(2))),
            false,
            false,
            true,
            None,
        );
        sheet.set_data_table(Pos { x: 0, y: 0 }, Some(data_table.clone()));
        assert_eq!(
            sheet.get_code_cell_value(Pos { x: 0, y: 0 }),
            Some(CellValue::Number(BigDecimal::from(2)))
        );
        assert_eq!(sheet.data_table(Pos { x: 0, y: 0 }), Some(&data_table));
        assert_eq!(sheet.data_table(Pos { x: 1, y: 1 }), None);
    }
}