use anyhow::Result;

use super::DataTable;
use crate::CellValue;

impl DataTable {
    /// Get the values of a row (does not include the header)
    pub fn get_row(&self, mut row_index: usize) -> Result<Vec<CellValue>> {
        row_index -= self.y_adjustment() as usize;

        let row = self
            .value_ref()?
            .iter()
            .skip(row_index * self.width())
            .take(self.width())
            .map(|value| value.to_owned().to_owned())
            .collect();

        Ok(row)
    }

    /// Insert a new row at the given index.
    pub fn insert_row(
        &mut self,
        mut row_index: usize,
        values: Option<Vec<CellValue>>,
    ) -> Result<()> {
        row_index -= self.y_adjustment() as usize;

        let array = self.mut_value_as_array()?;
        array.insert_row(row_index, values)?;

        self.display_buffer = None;

        Ok(())
    }

    /// Remove a row at the given index.
    pub fn delete_row(&mut self, mut row_index: usize) -> Result<()> {
        row_index -= self.y_adjustment() as usize;

        let array = self.mut_value_as_array()?;
        array.delete_row(row_index)?;
        self.display_buffer = None;

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
    fn test_data_table_insert_row() {
        let (_, mut data_table) = new_data_table();
        data_table.apply_first_row_as_header();

        pretty_print_data_table(&data_table, Some("Original Data Table"), None);

        data_table.insert_row(4, None).unwrap();
        pretty_print_data_table(&data_table, Some("Data Table with New Row"), None);

        // this should be a 5x4 array
        let expected_size = ArraySize::new(4, 6).unwrap();
        assert_eq!(data_table.output_size(), expected_size);
    }

    #[test]
    fn test_data_table_delete_row() {
        let (_, mut source_data_table) = new_data_table();
        source_data_table.apply_first_row_as_header();

        pretty_print_data_table(&source_data_table, Some("Original Data Table"), None);

        let mut data_table = source_data_table.clone();
        data_table.delete_row(5).unwrap();
        pretty_print_data_table(&data_table, Some("Data Table without Seattle row"), None);

        // this should be a 4x3 array, includes the header row
        let expected_size = ArraySize::new(4, 4).unwrap();
        assert_eq!(data_table.output_size(), expected_size);

        let mut data_table = source_data_table.clone();
        data_table.delete_row(4).unwrap();
        pretty_print_data_table(&data_table, Some("Data Table without Denver row"), None);

        // this should be a 4x3 array, includes the header row
        let expected_size = ArraySize::new(4, 4).unwrap();
        assert_eq!(data_table.output_size(), expected_size);

        // Denver should no longer be at (0, 2)
        assert_eq!(
            data_table.cell_value_at(0, 2),
            Some(CellValue::Text("Southborough".to_string()))
        );
    }
}