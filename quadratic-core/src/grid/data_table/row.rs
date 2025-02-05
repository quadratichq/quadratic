use anyhow::Result;

use super::DataTable;
use crate::CellValue;

impl DataTable {
    /// Get the values of a row (does not include the header)
    pub fn get_row(&self, mut row_index: usize) -> Result<Vec<CellValue>> {
        row_index -= self.y_adjustment(true) as usize;

        let row = self
            .value_ref()?
            .iter()
            .skip(row_index * self.width())
            .take(self.width())
            .map(|value| value.to_owned().to_owned())
            .collect();

        Ok(row)
    }

    /// Get the values of a row taking into account sorted columns.
    ///
    /// Maps the display row index to the actual row index
    pub fn get_row_sorted(&self, mut display_row_index: usize) -> Result<Vec<CellValue>> {
        display_row_index -= self.y_adjustment(true) as usize;

        display_row_index = self.transmute_index(display_row_index as u64) as usize;

        display_row_index += self.y_adjustment(true) as usize;

        self.get_row(display_row_index)
    }

    /// Insert a new row at the given index.
    pub fn insert_row(
        &mut self,
        mut row_index: usize,
        values: Option<Vec<CellValue>>,
    ) -> Result<()> {
        row_index -= self.y_adjustment(true) as usize;

        let array = self.mut_value_as_array()?;
        array.insert_row(row_index, values)?;

        Ok(())
    }

    /// Insert a new row at the given index, for table having sorted or hidden columns.
    ///
    /// Add blank values for hidden columns and adds the row to the display buffer.
    pub fn insert_row_sorted_hidden(
        &mut self,
        mut display_row_index: usize,
        values: Option<Vec<CellValue>>,
    ) -> Result<()> {
        display_row_index -= self.y_adjustment(true) as usize;

        let actual_row_index = self.transmute_index(display_row_index as u64) as usize;
        if let Some(display_buffer) = &mut self.display_buffer {
            display_buffer.insert(actual_row_index, actual_row_index as u64);
        }

        self.insert_row(actual_row_index + self.y_adjustment(true) as usize, values)
    }

    /// Remove a row at the given index.
    pub fn delete_row(&mut self, mut row_index: usize) -> Result<()> {
        row_index -= self.y_adjustment(true) as usize;

        let array = self.mut_value_as_array()?;
        array.delete_row(row_index)?;

        // formats and borders are 1 indexed
        self.formats.remove_row(row_index as i64 + 1);
        self.borders.remove_row(row_index as i64 + 1);

        Ok(())
    }

    /// Remove a row at the given index, for table having sorted columns.
    ///
    /// Removes the row and calls sort_all to update the display buffer.
    pub fn delete_row_sorted(&mut self, mut display_row_index: usize) -> Result<()> {
        display_row_index -= self.y_adjustment(true) as usize;

        let actual_row_index = self.transmute_index(display_row_index as u64) as usize;

        self.delete_row(actual_row_index + self.y_adjustment(true) as usize)?;
        self.sort_all()?;

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
