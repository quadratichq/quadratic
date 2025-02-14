//! DataTable columns

use serde::{Deserialize, Serialize};

use super::DataTable;
use crate::grid::js_types::JsDataTableColumnHeader;
use crate::util::unique_name;
use crate::{CellValue, Value};

#[derive(Serialize, Deserialize, Debug, Clone, PartialEq)]
pub struct DataTableColumnHeader {
    pub name: CellValue,
    pub display: bool,
    pub value_index: u32,
}

impl From<DataTableColumnHeader> for CellValue {
    fn from(header: DataTableColumnHeader) -> Self {
        header.name
    }
}

impl DataTableColumnHeader {
    pub fn new(name: String, display: bool, value_index: u32) -> Self {
        DataTableColumnHeader {
            name: CellValue::Text(name),
            display,
            value_index,
        }
    }
}

impl DataTable {
    pub fn column_headers_len(&self) -> u32 {
        self.column_headers
            .as_ref()
            .map(|headers| headers.len() as u32)
            .unwrap_or(0)
    }

    /// Takes the first row of the array and sets it as the column headings.
    pub fn apply_first_row_as_header(&mut self) {
        self.header_is_first_row = true;

        self.column_headers = match self.value {
            // Value::Array(ref mut array) => array.shift().ok().map(|array| {
            Value::Array(ref mut array) => array.get_row(0).ok().map(|array| {
                array
                    .iter()
                    .enumerate()
                    .map(|(i, value)| DataTableColumnHeader::new(value.to_string(), true, i as u32))
                    .collect::<Vec<DataTableColumnHeader>>()
            }),
            _ => None,
        };

        self.normalize_column_header_names();
    }

    pub fn toggle_first_row_as_header(&mut self, first_row_as_header: bool) {
        self.header_is_first_row = first_row_as_header;

        match first_row_as_header {
            true => self.apply_first_row_as_header(),
            false => self.apply_default_header(),
        }
    }

    /// Create default column headings for the DataTable.
    /// For example, the column headings will be "Column 1", "Column 2", etc.
    pub fn default_header(&self, width: Option<u32>) -> Vec<DataTableColumnHeader> {
        let func = |i: u32| format!("Column {i}");

        self.default_header_with_name(func, width)
    }

    /// Create default column headings for the DataTable.
    /// Accept a formatting function
    pub fn default_header_with_name(
        &self,
        func: impl Fn(u32) -> String,
        width: Option<u32>,
    ) -> Vec<DataTableColumnHeader> {
        let width = width.unwrap_or(self.value.size().w.get());

        match self.value {
            Value::Array(_) => (1..=width)
                .map(|i| DataTableColumnHeader::new(func(i), true, i - 1))
                .collect::<Vec<DataTableColumnHeader>>(),
            _ => vec![],
        }
    }

    /// Apply default column headings to the DataTable.
    /// For example, the column headings will be "Column 1", "Column 2", etc.
    pub fn apply_default_header(&mut self) {
        self.column_headers = Some(self.default_header(None));
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
    pub fn send_columns(&self) -> Vec<JsDataTableColumnHeader> {
        let columns = match self.column_headers.as_ref() {
            Some(columns) => columns,
            None => {
                let width = self.value.size().w.get();
                &self.default_header(Some(width))
            }
        };
        columns
            .iter()
            .map(|column| JsDataTableColumnHeader::from(column.to_owned()))
            .collect()
    }

    pub fn unique_column_header_name(&self, name: Option<&str>, index: usize) -> String {
        let default_name = format!("Column {index}");
        let name = name.unwrap_or(&default_name);

        if let Some(columns) = self.column_headers.as_ref() {
            let all_names = columns
                .iter()
                .map(|c| c.name.to_string())
                .collect::<Vec<_>>();

            unique_name(name, &all_names, false)
        } else {
            name.to_string()
        }
    }

    /// Set the display of a column header at the given index.
    pub fn normalize_column_header_names(&mut self) {
        let mut all_names = vec![];

        if let Some(columns) = self.column_headers.as_mut() {
            columns.iter_mut().for_each(|column| {
                let name = unique_name(&column.name.to_string(), &all_names, false);
                column.name = CellValue::Text(name.to_owned());
                all_names.push(name);
            });
        }
    }

    /// Get a column header by index.
    pub fn get_column_header(&self, index: usize) -> Option<&DataTableColumnHeader> {
        self.column_headers
            .as_ref()
            .and_then(|columns| columns.get(index))
    }

    /// Get a column header by name.
    pub fn get_header_by_name(&self, name: &str) -> Option<&DataTableColumnHeader> {
        self.column_headers
            .as_ref()
            .and_then(|columns| columns.iter().find(|h| h.name.to_string() == name))
    }

    /// Convert column headers to a vector of cell values.
    pub fn column_headers_to_cell_values(&self) -> Option<Vec<CellValue>> {
        self.column_headers
            .as_ref()
            .map(|columns| columns.iter().map(|c| c.name.clone()).collect())
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

    #[test]
    fn test_data_table_and_headers() {
        // test data table without column headings
        let (_, mut data_table) = new_data_table();
        let kind = data_table.kind.clone();
        let values = data_table.value.clone().into_array().unwrap();

        data_table.apply_default_header();
        let expected_columns = vec![
            DataTableColumnHeader::new("Column 1".into(), true, 0),
            DataTableColumnHeader::new("Column 2".into(), true, 1),
            DataTableColumnHeader::new("Column 3".into(), true, 2),
            DataTableColumnHeader::new("Column 4".into(), true, 3),
        ];
        assert_eq!(data_table.column_headers, Some(expected_columns));

        // test column headings taken from first row
        let value = Value::Array(values.clone());
        let mut data_table =
            DataTable::new(kind.clone(), "Table 1", value, false, true, true, None)
                .with_last_modified(data_table.last_modified);

        data_table.apply_first_row_as_header();
        let expected_columns = vec![
            DataTableColumnHeader::new("city".into(), true, 0),
            DataTableColumnHeader::new("region".into(), true, 1),
            DataTableColumnHeader::new("country".into(), true, 2),
            DataTableColumnHeader::new("population".into(), true, 3),
        ];
        assert_eq!(data_table.column_headers, Some(expected_columns));

        let expected_values = values.clone();
        assert_eq!(
            data_table.value.clone().into_array().unwrap(),
            expected_values
        );
    }

    #[test]
    fn test_normalize_column_names() {
        let mut data_table = new_data_table().1;

        let to_cols = |columns: Vec<&str>| {
            columns
                .iter()
                .enumerate()
                .map(|(i, c)| DataTableColumnHeader::new(c.to_string(), true, i as u32))
                .collect::<Vec<DataTableColumnHeader>>()
        };

        let assert_cols =
            |data_table: &mut DataTable, columns: Vec<&str>, expected_columns: Vec<&str>| {
                data_table.column_headers = Some(to_cols(columns));
                data_table.normalize_column_header_names();
                let data_table_cols = data_table.column_headers.clone().unwrap();
                expected_columns.iter().enumerate().for_each(|(i, c)| {
                    assert_eq!(data_table_cols[i].name.to_string(), c.to_string());
                });
            };

        let columns = vec!["name", "name", "name", "name"];
        let expected_columns = vec!["name", "name1", "name2", "name3"];
        assert_cols(&mut data_table, columns, expected_columns);

        let columns = vec!["name1", "name1", "name2", "name2"];
        let expected_columns = vec!["name1", "name2", "name3", "name4"];
        assert_cols(&mut data_table, columns, expected_columns);
    }

    #[test]
    fn test_headers_y() {
        let mut sheet = Sheet::test();
        let array = Array::from_str_vec(vec![vec!["first"], vec!["second"]], true).unwrap();
        let pos = Pos { x: 1, y: 1 };
        let t = DataTable {
            kind: DataTableKind::Import(Import::new("test.csv".to_string())),
            name: "Table 1".into(),
            column_headers: None,
            sort: None,
            display_buffer: None,
            value: Value::Array(array),
            readonly: false,
            spill_error: false,
            last_modified: Utc::now(),
            show_ui: true,
            show_name: true,
            show_columns: true,
            header_is_first_row: true,
            alternating_colors: true,
            formats: Default::default(),
            borders: Default::default(),
            chart_output: None,
            chart_pixel_output: None,
        };
        sheet.set_cell_value(
            pos,
            Some(CellValue::Import(Import::new("test.csv".to_string()))),
        );
        sheet.set_data_table(pos, Some(t.clone()));
        assert_eq!(
            sheet.display_value(Pos { x: 1, y: 2 }),
            Some(CellValue::Text("first".into()))
        );

        let data_table = sheet.data_table_mut((1, 1).into()).unwrap();
        data_table.toggle_first_row_as_header(false);
        assert_eq!(
            sheet.display_value(Pos { x: 1, y: 2 }),
            Some(CellValue::Text("Column 1".into()))
        );
        assert_eq!(
            sheet.display_value(Pos { x: 1, y: 3 }),
            Some(CellValue::Text("first".into()))
        );
        assert_eq!(
            sheet.display_value(Pos { x: 1, y: 4 }),
            Some(CellValue::Text("second".into()))
        );
    }
}
