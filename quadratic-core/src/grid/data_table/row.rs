use anyhow::{bail, Result};

use super::DataTable;
use crate::Value;

impl DataTable {
    /// Insert a new row at the given index.
    pub fn insert_row(&mut self, row_index: usize) -> Result<()> {
        if let Value::Array(array) = &mut self.value {
            array.insert_row(row_index, None)?;
        } else {
            bail!("Expected an array");
        }

        self.display_buffer = None;

        Ok(())
    }

    /// Remove a row at the given index.
    pub fn delete_row(&mut self, row_index: usize) -> Result<()> {
        if let Value::Array(array) = &mut self.value {
            array.delete_row(row_index)?;
        } else {
            bail!("Expected an array");
        }

        self.display_buffer = None;

        Ok(())
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
    fn test_data_table_insert_row() {
        let (_, mut data_table) = new_data_table();
        data_table.apply_first_row_as_header();

        pretty_print_data_table(&data_table, Some("Original Data Table"), None);

        data_table.insert_row(4).unwrap();
        pretty_print_data_table(&data_table, Some("Data Table with New Row"), None);

        // this should be a 5x4 array
        let expected_size = ArraySize::new(4, 5).unwrap();
        assert_eq!(data_table.output_size(), expected_size);
    }

    #[test]
    #[parallel]
    fn test_data_table_delete_row() {
        let (_, mut source_data_table) = new_data_table();
        source_data_table.apply_first_row_as_header();

        pretty_print_data_table(&source_data_table, Some("Original Data Table"), None);

        let mut data_table = source_data_table.clone();
        data_table.delete_row(3).unwrap();
        pretty_print_data_table(&data_table, Some("Data Table without row 4"), None);

        // this should be a 4x3 array
        let expected_size = ArraySize::new(4, 3).unwrap();
        assert_eq!(data_table.output_size(), expected_size);

        let mut data_table = source_data_table.clone();
        data_table.delete_row(1).unwrap();
        pretty_print_data_table(&data_table, Some("Data Table without row 1"), None);

        // this should be a 4x3 array
        let expected_size = ArraySize::new(4, 3).unwrap();
        assert_eq!(data_table.output_size(), expected_size);

        // Southborough should no longer be at (0, 1)
        assert_eq!(
            data_table.cell_value_at(0, 1),
            Some(CellValue::Text("Denver".to_string()))
        );
    }
}
