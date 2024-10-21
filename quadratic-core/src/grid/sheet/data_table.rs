use super::Sheet;
use crate::{grid::data_table::DataTable, Pos};

use anyhow::{anyhow, bail, Result};

impl Sheet {
    /// Sets or deletes a data table.
    ///
    /// Returns the old value if it was set.
    pub fn set_data_table(&mut self, pos: Pos, data_table: Option<DataTable>) -> Option<DataTable> {
        if let Some(data_table) = data_table {
            self.data_tables.insert(pos, data_table)
        } else {
            self.data_tables.shift_remove(&pos)
        }
    }

    pub fn update_table_name(&mut self, pos: Pos, name: &str) -> Result<()> {
        self.data_table_mut(pos)?.update_table_name(name);

        Ok(())
    }

    /// Returns a DatatTable at a Pos
    pub fn data_table(&self, pos: Pos) -> Option<&DataTable> {
        self.data_tables.get(&pos)
    }

    /// Returns a DatatTable at a Pos
    pub fn data_table_result(&self, pos: Pos) -> Result<&DataTable> {
        self.data_tables
            .get(&pos)
            .ok_or_else(|| anyhow!("Data table not found at {:?}", pos))
    }

    /// Returns a mutable DatatTable at a Pos
    pub fn data_table_mut(&mut self, pos: Pos) -> Result<&mut DataTable> {
        self.data_tables
            .get_mut(&pos)
            .ok_or_else(|| anyhow!("Data table not found at {:?}", pos))
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
                    .then(|| *data_table_pos)
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
    use std::{collections::HashSet, vec};

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
            cells_accessed: HashSet::new(),
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
            cells_accessed: HashSet::new(),
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
