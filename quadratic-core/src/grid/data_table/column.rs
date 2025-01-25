use anyhow::Result;

use super::{column_header::DataTableColumnHeader, DataTable};
use crate::CellValue;

impl DataTable {
    /// Get the values of a column
    pub fn get_column(&self, column_index: usize) -> Result<Vec<CellValue>> {
        let column = self
            .value_ref()?
            .iter()
            .skip(column_index)
            .step_by(self.width())
            .map(|value| value.to_owned().to_owned())
            .collect();

        Ok(column)
    }

    /// Insert a new column at the given index.
    pub fn insert_column(
        &mut self,
        column_index: usize,
        column_header: Option<String>,
        values: Option<Vec<CellValue>>,
    ) -> Result<()> {
        let column_name = self
            .unique_column_header_name(column_header.as_deref(), column_index + 1)
            .to_string();

        let array = self.mut_value_as_array()?;
        array.insert_column(column_index, values)?;
        self.display_buffer = None;

        if let Some(headers) = &mut self.column_headers {
            let new_header = DataTableColumnHeader::new(column_name, true, column_index as u32);
            headers.insert(column_index, new_header);

            for header in headers.iter_mut() {
                if header.value_index > column_index as u32 {
                    header.value_index += 1;
                }
            }
        }

        Ok(())
    }

    /// Remove a column at the given index.
    pub fn delete_column(&mut self, column_index: usize) -> Result<()> {
        let array = self.mut_value_as_array()?;
        array.delete_column(column_index)?;
        self.display_buffer = None;

        if let Some(headers) = &mut self.column_headers {
            headers.remove(column_index);

            for header in headers.iter_mut() {
                if header.value_index > column_index as u32 {
                    header.value_index -= 1;
                }
            }
        }

        Ok(())
    }
}

#[cfg(test)]
#[serial_test::parallel]
pub mod test {
    use crate::{
        grid::test::{new_data_table, pretty_print_data_table},
        ArraySize, CellValue,
    };

    #[test]
    fn test_data_table_insert_column() {
        let (_, mut data_table) = new_data_table();
        data_table.apply_first_row_as_header();

        pretty_print_data_table(&data_table, Some("Original Data Table"), None);

        data_table.insert_column(4, None, None).unwrap();
        pretty_print_data_table(&data_table, Some("Data Table with New Column"), None);

        // there should be a "Column" header
        let header = data_table.get_header_by_name("Column 5");
        assert!(header.is_some());

        // this should be a 5x4 array
        let expected_size = ArraySize::new(5, 4).unwrap();
        assert_eq!(data_table.output_size(), expected_size);

        // there is no data at position (0, 4)
        assert!(data_table.cell_value_at(0, 4).is_none());
    }

    #[test]
    fn test_data_table_remove_column() {
        let (_, mut source_data_table) = new_data_table();
        source_data_table.apply_first_row_as_header();

        pretty_print_data_table(&source_data_table, Some("Original Data Table"), None);

        let mut data_table = source_data_table.clone();
        data_table.delete_column(3).unwrap();
        pretty_print_data_table(&data_table, Some("Data Table without Population"), None);

        // there should be no "population" header
        let header = data_table.get_header_by_name("population");
        assert!(header.is_none());

        // this should be a 5x4 array
        let expected_size = ArraySize::new(3, 5).unwrap();
        assert_eq!(data_table.output_size(), expected_size);

        let mut data_table = source_data_table.clone();
        data_table.delete_column(0).unwrap();
        pretty_print_data_table(&data_table, Some("Data Table without City"), None);

        // there should be no "city" header
        let header = data_table.get_header_by_name("city");
        assert!(header.is_none());

        // this should be a 5x4 array
        let expected_size = ArraySize::new(3, 5).unwrap();
        assert_eq!(data_table.output_size(), expected_size);

        // there is no data at position (0, 1)
        assert_eq!(
            data_table.cell_value_at(0, 1).unwrap(),
            CellValue::Text("region".into())
        );

        let mut data_table = source_data_table.clone();
        data_table.delete_column(1).unwrap();
        pretty_print_data_table(&data_table, Some("Data Table without Region"), None);

        // there should be no "region" header
        let header = data_table.get_header_by_name("region");
        assert!(header.is_none());

        // this should be a 5x4 array
        let expected_size = ArraySize::new(3, 5).unwrap();
        assert_eq!(data_table.output_size(), expected_size);

        // there is no data at position (0, 1)
        assert_eq!(
            data_table.cell_value_at(0, 1).unwrap(),
            CellValue::Text("city".into())
        );
    }
}
