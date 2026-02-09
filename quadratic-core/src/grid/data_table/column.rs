use anyhow::Result;

use super::{DataTable, column_header::DataTableColumnHeader};
use crate::{CellValue, CopyFormats};

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

    /// Gets the name of a column from the column_index (not the display index).
    pub fn column_name(&self, column_index: usize) -> Result<String> {
        if let Some(headers) = &self.column_headers {
            if column_index >= headers.len() {
                return Err(anyhow::anyhow!(
                    "Column index {} out of bounds for {} columns",
                    column_index,
                    headers.len()
                ));
            }
            return Ok(headers[column_index].name.to_string());
        }

        Err(anyhow::anyhow!("No column name found"))
    }

    /// Get the values of a column taking into account sorted columns.
    ///
    /// Maps the cells values from actual values index to display index, returning
    /// the values in the same sequence as they are displayed.
    pub fn get_column_sorted(&self, column_index: usize) -> Result<Vec<CellValue>> {
        let mut column = self.get_column(column_index)?;
        if let Some(display_buffer) = &self.display_buffer {
            let column_len = column.len();
            let mut sorted_column = vec![CellValue::Blank; column_len];
            for (display_index, row_index) in display_buffer.iter().enumerate() {
                let row_idx = *row_index as usize;
                if display_index >= column_len || row_idx >= column_len {
                    return Err(anyhow::anyhow!(
                        "display_buffer inconsistent with column length: display_index={}, row_index={}, column_len={}",
                        display_index,
                        row_idx,
                        column_len
                    ));
                }
                sorted_column[display_index] = std::mem::take(&mut column[row_idx]);
            }
            column = sorted_column;
        }
        Ok(column)
    }

    /// Insert a new column at the given index.
    fn insert_column(
        &mut self,
        column_index: usize,
        column_header: Option<String>,
        values: Option<Vec<CellValue>>,
    ) -> Result<()> {
        let column_name = self
            .unique_column_header_name(column_header.as_deref(), column_index, None)
            .to_string();

        let array = self.mut_value_as_array()?;
        array.insert_column(column_index, values)?;

        // formats and borders are 1 indexed
        self.formats
            .get_or_insert_default()
            .insert_column(column_index as i64 + 1, CopyFormats::None);
        self.borders
            .get_or_insert_default()
            .insert_column(column_index as i64 + 1, CopyFormats::None);

        if let Some(headers) = &mut self.column_headers {
            let new_header = DataTableColumnHeader::new(column_name, true, column_index as u32);

            if column_index < headers.len() {
                headers.insert(column_index, new_header);
            } else {
                headers.push(new_header);
            }

            for (index, header) in headers.iter_mut().enumerate() {
                header.value_index = index as u32;
            }
        }

        Ok(())
    }

    /// Insert a new column taking into account sorted columns.
    ///
    /// Maps the cells values to actual values index from display index.
    pub fn insert_column_sorted(
        &mut self,
        column_index: usize,
        column_header: Option<String>,
        mut values: Option<Vec<CellValue>>,
    ) -> Result<()> {
        if let Some(sort) = &mut self.sort {
            for sort in sort.iter_mut() {
                if sort.column_index >= column_index {
                    sort.column_index += 1;
                }
            }
        }

        if self.display_buffer.is_some()
            && let Some(cell_values) = values
        {
            let mut sorted_cell_values = vec![CellValue::Blank; cell_values.len()];

            for (index, cell_value) in cell_values.into_iter().enumerate() {
                let actual_index = self.get_row_index_from_display_index(index as u64);
                sorted_cell_values[actual_index as usize] = cell_value;
            }
            values = Some(sorted_cell_values);
        }

        self.insert_column(column_index, column_header, values)?;

        Ok(())
    }

    /// Remove a column at the given index.
    fn delete_column(&mut self, column_index: usize) -> Result<()> {
        let array = self.mut_value_as_array()?;
        array.delete_column(column_index)?;

        // formats and borders are 1 indexed
        if let Some(formats) = self.formats.as_mut() {
            formats.remove_column(column_index as i64 + 1);
        }
        if let Some(borders) = self.borders.as_mut() {
            borders.remove_column(column_index as i64 + 1);
        }

        // remove the header and update the value_index
        if let Some(headers) = &mut self.column_headers {
            headers.remove(column_index);
            for (index, header) in headers.iter_mut().enumerate() {
                header.value_index = index as u32;
            }
        }

        Ok(())
    }

    /// Remove a column at the given index and update the sort.
    pub fn delete_column_sorted(&mut self, column_index: usize) -> Result<()> {
        self.delete_column(column_index)?;

        if let Some(sort) = &mut self.sort {
            for sort in sort.iter_mut() {
                if sort.column_index > column_index {
                    sort.column_index -= 1;
                }
            }
            sort.retain(|sort| sort.column_index != column_index);
        }

        Ok(())
    }

    /// Returns the display column index from the column index in the values array.
    pub fn get_display_index_from_column_index(
        &self,
        column_index: u32,
        include_self: bool,
    ) -> i64 {
        let mut x_adjustment = 0;
        let columns = self.column_headers.iter().flatten().collect::<Vec<_>>();
        for (i, column) in columns.iter().enumerate() {
            if i > column_index as usize || (!include_self && i == column_index as usize) {
                break;
            }
            if !column.display {
                x_adjustment += 1;
            }
        }
        column_index as i64 - x_adjustment
    }

    /// Returns the column index from the display column index.
    pub fn get_column_index_from_display_index(
        &self,
        display_index: u32,
        include_self: bool,
    ) -> u32 {
        let mut hidden_columns = 0;
        let mut seen_display_index = -1;
        for (i, column) in self.column_headers.iter().flatten().enumerate() {
            if column.display {
                seen_display_index += 1;
                if seen_display_index == display_index as i32 {
                    break;
                }
            } else if include_self || i as u32 - hidden_columns != display_index {
                hidden_columns += 1;
            }
        }
        display_index + hidden_columns
    }
}

#[cfg(test)]
mod test {
    use crate::{
        ArraySize, CellValue, grid::data_table::test_util::new_data_table,
        test_util::pretty_print_data_table,
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
        let expected_size = ArraySize::new(5, 5).unwrap();
        assert_eq!(data_table.output_size(), expected_size);

        // there is no data at position (0, 5)
        assert!(data_table.cell_value_at(0, 5).is_none());

        // ensure the value_index is set correctly
        for (index, header) in data_table
            .column_headers
            .as_ref()
            .unwrap()
            .iter()
            .enumerate()
        {
            assert_eq!(header.value_index, index as u32);
        }
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

        // ensure the value_index is set correctly
        for (index, header) in data_table
            .column_headers
            .as_ref()
            .unwrap()
            .iter()
            .enumerate()
        {
            assert_eq!(header.value_index, index as u32);
        }
    }

    #[test]
    fn test_data_table_column_name() {
        let (_, mut data_table) = new_data_table();

        // Test when no column headers exist
        assert_eq!(data_table.column_name(0).unwrap(), "Column 1".to_string());

        // Apply headers and test valid column names
        data_table.apply_first_row_as_header();

        // "city", "region", "country", "population"
        assert_eq!(data_table.column_name(0).unwrap(), "city");
        assert_eq!(data_table.column_name(1).unwrap(), "region");
        assert_eq!(data_table.column_name(2).unwrap(), "country");
        assert_eq!(data_table.column_name(3).unwrap(), "population");

        // Test out of bounds
        assert!(data_table.column_name(4).is_err());
    }
}
