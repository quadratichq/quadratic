use anyhow::{Result, bail};

use super::DataTable;
use crate::{
    CellValue, CopyFormats,
    grid::{formats::SheetFormatUpdates, sheet::borders::BordersUpdates},
};

impl DataTable {
    /// Get the values of a row (does not include the header)
    pub fn get_row(&self, row_index: usize) -> Result<Vec<CellValue>> {
        let data_row_index = usize::try_from(row_index as i64 - self.y_adjustment(true))?;

        let row = self
            .value_ref()?
            .iter()
            .skip(data_row_index * self.width())
            .take(self.width())
            .map(|value| value.to_owned().to_owned())
            .collect();

        Ok(row)
    }

    /// Get the values of a row taking into account sorted columns.
    ///
    /// Maps the display row index to the actual row index
    pub fn get_row_sorted(&self, display_row_index: usize) -> Result<Vec<CellValue>> {
        let row_index = display_row_index as i64 - self.y_adjustment(true);

        let actual_row_index = self.get_row_index_from_display_index(row_index as u64) as i64;

        self.get_row(usize::try_from(actual_row_index + self.y_adjustment(true))?)
    }

    /// Insert a new row at the given index.
    pub fn insert_row(&mut self, row_index: usize, values: Option<Vec<CellValue>>) -> Result<()> {
        let row_index = row_index as i64 - self.y_adjustment(true);
        let array = self.mut_value_as_array()?;
        array.insert_row(usize::try_from(row_index)?, values)?;

        // formats and borders are 1 indexed
        if let Some(formats) = self.formats.as_mut() {
            formats.insert_row(row_index + 1, CopyFormats::None);
        }
        if let Some(borders) = self.borders.as_mut() {
            borders.insert_row(row_index + 1, CopyFormats::None);
        }

        let row_index = u64::try_from(row_index)?;

        // add the row to the display buffer
        if let Some(display_buffer) = &mut self.display_buffer {
            let len = display_buffer.len();
            let index = usize::try_from(row_index)?;

            if index > len {
                bail!("Row index {index} is out of bounds. Display buffer length: {len}");
            }

            for y in display_buffer.iter_mut() {
                if *y >= row_index {
                    *y += 1;
                }
            }

            display_buffer.insert(index, row_index);
        }

        Ok(())
    }

    /// Remove a row at the given index.
    pub fn delete_row(
        &mut self,
        row_index: usize,
    ) -> Result<(Vec<CellValue>, SheetFormatUpdates, BordersUpdates)> {
        let row_index = row_index as i64 - self.y_adjustment(true);

        let array = self.mut_value_as_array()?;
        let values = array.delete_row(usize::try_from(row_index)?)?;

        // formats and borders are 1 indexed
        let formats = self
            .formats
            .as_mut()
            .map(|formats| formats.remove_row(row_index + 1))
            .unwrap_or_default();
        let borders = self
            .borders
            .as_mut()
            .map(|borders| borders.remove_row(row_index + 1))
            .unwrap_or_default();

        Ok((values, formats, borders))
    }

    /// Remove a row at the given index, for table having sorted columns.
    ///
    /// Removes the row and calls sort_all to update the display buffer.
    pub fn delete_row_sorted(
        &mut self,
        display_row_index: usize,
    ) -> Result<(
        u32,
        Option<Vec<CellValue>>,
        SheetFormatUpdates,
        BordersUpdates,
    )> {
        let row_index = display_row_index as i64 - self.y_adjustment(true);

        let actual_row_index = self.get_row_index_from_display_index(row_index as u64);

        let (old_values, formats, borders) = self.delete_row(usize::try_from(
            actual_row_index as i64 + self.y_adjustment(true),
        )?)?;

        // remove the row from the display buffer
        if let Some(display_buffer) = &mut self.display_buffer {
            display_buffer.remove(usize::try_from(row_index)?);
            for y in display_buffer.iter_mut() {
                if *y > actual_row_index {
                    *y -= 1;
                }
            }
        }

        let reverse_row_index = u32::try_from(actual_row_index as i64 + self.y_adjustment(true))?;

        Ok((reverse_row_index, Some(old_values), formats, borders))
    }
}

#[cfg(test)]
mod test {
    use crate::{
        ArraySize, CellValue,
        grid::{data_table::test_util::new_data_table, sort::SortDirection},
        test_util::pretty_print_data_table,
    };

    #[test]
    fn test_data_table_insert_row() {
        let (_, mut data_table) = new_data_table();
        data_table.apply_first_row_as_header();

        pretty_print_data_table(&data_table, Some("Original Data Table"), None);

        data_table.insert_row(5, None).unwrap();
        pretty_print_data_table(&data_table, Some("Data Table with New Row"), None);

        // this should be a 4x6 array
        let expected_size = ArraySize::new(4, 6).unwrap();
        assert_eq!(data_table.output_size(), expected_size);

        // first sort the table to create the display buffer
        data_table.sort_column(0, SortDirection::Ascending).unwrap();

        data_table.insert_row(6, None).unwrap();
        pretty_print_data_table(&data_table, Some("Data Table with second New Row"), None);

        // this should be a 4x7 array
        let expected_size = ArraySize::new(4, 7).unwrap();
        assert_eq!(data_table.output_size(), expected_size);

        // expect index out of bounds error
        let expected_error = data_table.insert_row(10, None);
        assert!(expected_error.is_err());
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
