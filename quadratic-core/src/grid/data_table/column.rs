//!

use crate::grid::js_types::JsDataTableColumn;
use crate::{CellValue, Value};
use anyhow::{anyhow, Ok};
use serde::{Deserialize, Serialize};

use super::DataTable;

#[derive(Serialize, Deserialize, Debug, Clone, PartialEq)]
pub struct DataTableColumn {
    pub name: CellValue,
    pub display: bool,
    pub value_index: u32,
}

impl DataTableColumn {
    pub fn new(name: String, display: bool, value_index: u32) -> Self {
        DataTableColumn {
            name: CellValue::Text(name),
            display,
            value_index,
        }
    }
}

impl DataTable {
    /// Takes the first row of the array and sets it as the column headings.
    pub fn apply_first_row_as_header(&mut self) {
        self.header_is_first_row = true;

        self.columns = match self.value {
            // Value::Array(ref mut array) => array.shift().ok().map(|array| {
            Value::Array(ref mut array) => array.get_row(0).ok().map(|array| {
                array
                    .iter()
                    .enumerate()
                    .map(|(i, value)| DataTableColumn::new(value.to_string(), true, i as u32))
                    .collect::<Vec<DataTableColumn>>()
            }),
            _ => None,
        };
    }

    pub fn toggle_first_row_as_header(&mut self, first_row_as_header: bool) {
        self.header_is_first_row = first_row_as_header;

        match first_row_as_header {
            true => self.apply_first_row_as_header(),
            false => self.apply_default_header(),
        }
    }

    /// Apply default column headings to the DataTable.
    /// For example, the column headings will be "Column 1", "Column 2", etc.
    pub fn apply_default_header(&mut self) {
        self.columns = match self.value {
            Value::Array(ref mut array) => Some(
                (1..=array.width())
                    .map(|i| DataTableColumn::new(format!("Column {i}"), true, i - 1))
                    .collect::<Vec<DataTableColumn>>(),
            ),
            _ => None,
        };
    }

    /// Ensure that the index is within the bounds of the columns.
    /// If there are no columns, apply default headers first if `apply_default_header` is true.
    fn check_index(&mut self, index: usize, apply_default_header: bool) -> anyhow::Result<()> {
        match self.columns {
            Some(ref mut columns) => {
                let column_len = columns.len();

                if index >= column_len {
                    return Err(anyhow!("Column {index} out of bounds: {column_len}"));
                }
            }
            // there are no columns, so we need to apply default headers first
            None => {
                apply_default_header.then(|| self.apply_default_header());
            }
        };

        Ok(())
    }

    /// Replace a column header at the given index in place.
    pub fn set_header_at(
        &mut self,
        index: usize,
        name: String,
        display: bool,
    ) -> anyhow::Result<()> {
        self.check_index(index, true)?;
        // let all_names = &self
        //     .columns
        //     .as_ref()
        //     .unwrap()
        //     .iter()
        //     .map(|column| column.name.to_string().to_owned().as_str())
        //     .collect_vec();
        // let name = unique_name(&name, all_names);

        self.columns
            .as_mut()
            .and_then(|columns| columns.get_mut(index))
            .map(|column| {
                column.name = CellValue::Text(name);
                column.display = display;
            });

        Ok(())
    }

    /// Set the display of a column header at the given index.
    pub fn set_header_display_at(&mut self, index: usize, display: bool) -> anyhow::Result<()> {
        self.check_index(index, true)?;

        self.columns
            .as_mut()
            .and_then(|columns| columns.get_mut(index))
            .map(|column| {
                column.display = display;
            });

        Ok(())
    }

    pub fn adjust_for_header(&self, index: usize) -> usize {
        if self.header_is_first_row {
            index + 1
        } else {
            index
        }
    }

    /// Prepares the columns to be sent to the client. If no columns are set, it
    /// will create default columns.
    pub fn send_columns(&self) -> Vec<JsDataTableColumn> {
        match self.columns.as_ref() {
            Some(columns) => columns
                .iter()
                .map(|column| JsDataTableColumn::from(column.to_owned()))
                .collect(),
            // TODO(ddimaria): refacor this to use the default columns
            None => {
                let size = self.output_size();
                (0..size.w.get())
                    .map(|i| DataTableColumn::new(format!("Column {}", i + 1), true, i).into())
                    .collect::<Vec<JsDataTableColumn>>()
            }
        }
    }
}

#[cfg(test)]
pub mod test {

    use super::*;
    use crate::{
        cellvalue::Import,
        grid::{test::new_data_table, DataTableKind, Sheet},
        Array, Pos,
    };
    use chrono::Utc;
    use serial_test::parallel;

    #[test]
    #[parallel]
    fn test_data_table_and_headers() {
        // test data table without column headings
        let (_, mut data_table) = new_data_table();
        let kind = data_table.kind.clone();
        let values = data_table.value.clone().into_array().unwrap();

        data_table.apply_default_header();
        let expected_columns = vec![
            DataTableColumn::new("Column 1".into(), true, 0),
            DataTableColumn::new("Column 2".into(), true, 1),
            DataTableColumn::new("Column 3".into(), true, 2),
            DataTableColumn::new("Column 4".into(), true, 3),
        ];
        assert_eq!(data_table.columns, Some(expected_columns));

        // test column headings taken from first row
        let value = Value::Array(values.clone().into());
        let mut data_table = DataTable::new(kind.clone(), "Table 1", value, false, true, true)
            .with_last_modified(data_table.last_modified);

        data_table.apply_first_row_as_header();
        let expected_columns = vec![
            DataTableColumn::new("city".into(), true, 0),
            DataTableColumn::new("region".into(), true, 1),
            DataTableColumn::new("country".into(), true, 2),
            DataTableColumn::new("population".into(), true, 3),
        ];
        assert_eq!(data_table.columns, Some(expected_columns));

        let expected_values = values.clone();
        assert_eq!(
            data_table.value.clone().into_array().unwrap(),
            expected_values
        );

        // test setting header at index
        data_table.set_header_at(0, "new".into(), true).unwrap();
        assert_eq!(
            data_table.columns.as_ref().unwrap()[0].name,
            CellValue::Text("new".into())
        );

        // test setting header display at index
        data_table.set_header_display_at(0, false).unwrap();
        assert_eq!(data_table.columns.as_ref().unwrap()[0].display, false);
    }

    #[test]
    #[parallel]
    fn test_headers_y() {
        let mut sheet = Sheet::test();
        let array = Array::from_str_vec(vec![vec!["first"], vec!["second"]], true).unwrap();
        let pos = Pos { x: 1, y: 1 };
        let t = DataTable {
            kind: DataTableKind::Import(Import::new("test.csv".to_string())),
            name: "Table 1".into(),
            columns: None,
            sort: None,
            display_buffer: None,
            value: Value::Array(array),
            readonly: false,
            spill_error: false,
            last_modified: Utc::now(),
            show_header: true,
            header_is_first_row: true,
            alternating_colors: true,
            formats: Default::default(),
        };
        sheet.set_cell_value(
            pos,
            Some(CellValue::Import(Import::new("test.csv".to_string()))),
        );
        sheet.set_data_table(pos, Some(t.clone()));
        assert_eq!(
            sheet.display_value(pos),
            Some(CellValue::Text("first".into()))
        );

        let data_table = sheet.data_table_mut((1, 1).into()).unwrap();
        data_table.toggle_first_row_as_header(false);
        assert_eq!(
            sheet.display_value(pos),
            Some(CellValue::Text("Column 1".into()))
        );
        assert_eq!(
            sheet.display_value(Pos { x: 1, y: 2 }),
            Some(CellValue::Text("first".into()))
        );
        assert_eq!(
            sheet.display_value(Pos { x: 1, y: 3 }),
            Some(CellValue::Text("second".into()))
        );
    }
}
