//! DataTable columns

use serde::{Deserialize, Serialize};

use super::DataTable;
use crate::grid::fix_names::sanitize_column_name;
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
            name: CellValue::Text(sanitize_column_name(name)),
            display,
            value_index,
        }
    }
}

impl DataTable {
    /// Returns the number of columns in the data table.
    pub fn column_headers_len(&self) -> u32 {
        self.column_headers
            .as_ref()
            .map(|headers| headers.len() as u32)
            .unwrap_or(0)
    }

    /// Takes the first row of the array and sets it as the column headings.
    pub fn apply_first_row_as_header(&mut self) {
        self.header_is_first_row = true;

        let first_row = match &self.value {
            Value::Array(array) => array.get_row(0).ok(),
            _ => None,
        };

        self.column_headers = first_row.map(|array| {
            array
                .iter()
                .enumerate()
                .map(|(i, value)| {
                    let display = self.header_display(i);
                    DataTableColumnHeader::new(value.to_string(), display, i as u32)
                })
                .collect()
        });

        self.normalize_column_header_names();
    }

    /// Toggles whether the first row of the data table is used as the column headings.
    pub fn toggle_first_row_as_header(&mut self, first_row_as_header: bool) {
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
                .map(|i| {
                    let display = self.header_display(i as usize);
                    DataTableColumnHeader::new(func(i), display, i - 1)
                })
                .collect::<Vec<DataTableColumnHeader>>(),
            _ => vec![],
        }
    }

    /// Apply default column headings to the DataTable.
    /// For example, the column headings will be "Column 1", "Column 2", etc.
    pub fn apply_default_header(&mut self) {
        self.header_is_first_row = false;
        self.column_headers = Some(self.default_header(None));
    }

    /// Get the display of a column header at the given index.
    pub fn header_display(&self, index: usize) -> bool {
        self.column_headers
            .as_ref()
            .is_none_or(|headers| headers.get(index).is_none_or(|header| header.display))
    }

    /// Adjust the index for the header.
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

    /// Create a unique column header name.
    pub fn unique_column_header_name(
        &self,
        name: Option<&str>,
        index: usize,
        skip_index: Option<usize>,
    ) -> String {
        let default_name = format!("Column {}", index + 1);
        let name = name.unwrap_or(&default_name);

        if let Some(columns) = self.column_headers.as_ref() {
            let all_names = columns
                .iter()
                .enumerate()
                .filter(|(i, _)| skip_index.is_none_or(|skip_index| *i != skip_index))
                .map(|(_, c)| c.name.to_string())
                .collect::<Vec<_>>();

            let check_name = |name: &str| !all_names.contains(&name.to_string());
            let iter_names = all_names.iter().rev();
            unique_name(name, false, check_name, iter_names)
        } else {
            name.to_string()
        }
    }

    /// Set the display of a column header at the given index.
    pub fn normalize_column_header_names(&mut self) {
        let mut all_names: Vec<String> = vec![];

        if let Some(columns) = self.column_headers.as_mut() {
            columns.iter_mut().for_each(|column| {
                let check_name = |name: &str| !all_names.contains(&name.to_string());
                let iter_names = all_names.iter().rev();
                let name = unique_name(&column.name.to_string(), false, check_name, iter_names);
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

    /// Get the column header at the given display index.
    pub fn display_header_at(&self, display_x: u32) -> Option<&DataTableColumnHeader> {
        let column_index = self.get_column_index_from_display_index(display_x, true);
        self.get_column_header(column_index as usize)
    }
}

#[cfg(test)]
mod test {

    use super::*;
    use crate::{
        Array, Pos,
        cellvalue::Import,
        grid::{DataTableKind, Sheet, data_table::test_util::new_data_table},
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
        let mut data_table = DataTable::new(
            kind.clone(),
            "Table 1",
            value,
            true,
            Some(true),
            Some(true),
            None,
        )
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
            sort_dirty: false,
            display_buffer: None,
            value: array.into(),
            last_modified: Utc::now(),
            show_name: Some(true),
            show_columns: Some(true),
            header_is_first_row: true,
            alternating_colors: true,
            formats: Default::default(),
            borders: Default::default(),
            chart_output: None,
            chart_pixel_output: None,
            spill_value: false,
            spill_data_table: false,
            spill_merged_cell: false,
        };
        sheet.set_data_table(pos, Some(t.clone()));
        assert_eq!(
            sheet.display_value(Pos { x: 1, y: 2 }),
            Some(CellValue::Text("first".into()))
        );

        sheet
            .modify_data_table_at(&(1, 1).into(), |dt| {
                dt.toggle_first_row_as_header(false);
                Ok(())
            })
            .unwrap();

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

    #[test]
    fn test_headers_x() {
        let mut sheet = Sheet::test();
        let array =
            Array::from_str_vec(vec![vec!["first", "second"], vec!["third", "fourth"]], true)
                .unwrap();
        let pos = Pos { x: 1, y: 1 };
        let mut t = DataTable {
            kind: DataTableKind::Import(Import::new("test.csv".to_string())),
            name: "Table 1".into(),
            column_headers: None,
            sort: None,
            sort_dirty: false,
            display_buffer: None,
            value: array.into(),
            last_modified: Utc::now(),
            show_name: Some(true),
            show_columns: Some(true),
            header_is_first_row: false,
            alternating_colors: true,
            formats: Default::default(),
            borders: Default::default(),
            chart_output: None,
            chart_pixel_output: None,
            spill_value: false,
            spill_data_table: false,
            spill_merged_cell: false,
        };
        t.apply_default_header();
        sheet.set_data_table(pos, Some(t.clone()));
        assert_eq!(
            sheet.display_value(Pos { x: 1, y: 2 }),
            Some(CellValue::Text("Column 1".into()))
        );

        // make first row a header
        sheet
            .modify_data_table_at(&(1, 1).into(), |dt| {
                dt.toggle_first_row_as_header(true);
                Ok(())
            })
            .unwrap();
        assert_eq!(
            sheet.display_value(Pos { x: 1, y: 2 }),
            Some(CellValue::Text("first".into()))
        );

        // hide first column
        sheet
            .modify_data_table_at(&(1, 1).into(), |dt| {
                let column_headers = dt.column_headers.as_mut().unwrap();
                column_headers[0].display = false;
                Ok(())
            })
            .unwrap();
        assert_eq!(
            sheet.display_value(Pos { x: 1, y: 2 }),
            Some(CellValue::Text("second".into()))
        );
    }
}
