use anyhow::{bail, Result};

use super::{column_header::DataTableColumnHeader, DataTable};
use crate::Value;

impl DataTable {
    /// Insert a new column at the given index.
    pub fn insert_column(mut self, column_index: usize) -> Result<Self> {
        let column_name = self.unique_column_header_name(None).to_string();

        if let Value::Array(array) = self.value {
            let new_array = array.insert_column(column_index, None)?;
            self.value = Value::Array(new_array);
        } else {
            bail!("Expected an array");
        }

        self.display_buffer = None;

        if let Some(mut headers) = self.column_headers {
            let new_header = DataTableColumnHeader::new(column_name, true, column_index as u32);
            headers.push(new_header);
            self.column_headers = Some(headers);
        }

        Ok(self)
    }

    /// Remove a column at the given index.
    pub fn remove_column(mut self, column_index: usize) -> Result<Self> {
        if let Value::Array(array) = self.value {
            let new_array = array.remove_column(column_index)?;
            self.value = Value::Array(new_array);
        } else {
            bail!("Expected an array");
        }

        self.display_buffer = None;

        if let Some(mut headers) = self.column_headers {
            headers.remove(column_index);
            self.column_headers = Some(headers);
        }

        Ok(self)
    }
}

#[cfg(test)]
pub mod test {
    use crate::{
        grid::test::{new_data_table, pretty_print_data_table},
        ArraySize, CellValue,
    };
    use serial_test::parallel;

    #[test]
    #[parallel]
    fn test_data_table_insert_column() {
        let (_, mut data_table) = new_data_table();
        data_table.apply_first_row_as_header();

        pretty_print_data_table(&data_table, Some("Original Data Table"), None);

        data_table = data_table.insert_column(4).unwrap();
        pretty_print_data_table(&data_table, Some("Data Table with New Column"), None);

        // there should be a "Column" header
        let header = data_table.get_header_by_name("Column");
        assert!(header.is_some());

        // this should be a 5x4 array
        let expected_size = ArraySize::new(5, 4).unwrap();
        assert_eq!(data_table.output_size(), expected_size);

        // there is no data at position (0, 4)
        assert!(data_table.cell_value_at(0, 4).is_none());
    }

    #[test]
    #[parallel]
    fn test_data_table_remove_column() {
        let (_, mut source_data_table) = new_data_table();
        source_data_table.apply_first_row_as_header();

        pretty_print_data_table(&source_data_table, Some("Original Data Table"), None);

        let data_table = source_data_table.clone().remove_column(3).unwrap();
        pretty_print_data_table(&data_table, Some("Data Table without Population"), None);

        // there should be no "population" header
        let header = data_table.get_header_by_name("population");
        assert!(header.is_none());

        // this should be a 5x4 array
        let expected_size = ArraySize::new(3, 4).unwrap();
        assert_eq!(data_table.output_size(), expected_size);

        let data_table = source_data_table.clone().remove_column(0).unwrap();
        pretty_print_data_table(&data_table, Some("Data Table without City"), None);

        // there should be no "city" header
        let header = data_table.get_header_by_name("city");
        assert!(header.is_none());

        // this should be a 5x4 array
        let expected_size = ArraySize::new(3, 4).unwrap();
        assert_eq!(data_table.output_size(), expected_size);

        // there is no data at position (0, 0)
        assert_eq!(
            data_table.cell_value_at(0, 0).unwrap(),
            CellValue::Text("region".into())
        );

        let data_table = source_data_table.clone().remove_column(1).unwrap();
        pretty_print_data_table(&data_table, Some("Data Table without Region"), None);

        // there should be no "region" header
        let header = data_table.get_header_by_name("region");
        assert!(header.is_none());

        // this should be a 5x4 array
        let expected_size = ArraySize::new(3, 4).unwrap();
        assert_eq!(data_table.output_size(), expected_size);

        // there is no data at position (0, 0)
        assert_eq!(
            data_table.cell_value_at(0, 0).unwrap(),
            CellValue::Text("city".into())
        );
    }
}
