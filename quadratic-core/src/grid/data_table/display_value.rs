//! Display value for DataTable
//!
//! The display value is the value that is displayed in the DataTable and may
//! be different from the actual value.
//!
//! The `display_buffer` is an option mapping row indices to display values.
//! If the `display_buffer` is `None`, then the display value is the same as the
//! actual value. If the `display_buffer` is `Some(display_buffer)`, then the
//! display value is the value at the index specified by the `display_buffer`
//! at the given row and column.  This pattern enables a single copy of the
//! DataTable to exist in memory and be used for both display and execution.

use crate::{Array, CellValue, Pos, Value};
use anyhow::{anyhow, Ok, Result};
use arrow_array::ArrowNativeTypeOp;

use super::DataTable;

impl DataTable {
    /// Get the display value from the display buffer.
    pub fn display_value_from_buffer(&self, display_buffer: &[u64]) -> Result<Value> {
        let value = self.value.to_owned().into_array()?;
        let columns_to_show = self.columns_to_show();

        let values = display_buffer
            .iter()
            .filter_map(|index| {
                value
                    .get_row(*index as usize)
                    .map(|row| self.display_columns(&columns_to_show, row))
                    .ok()
            })
            .collect::<Vec<Vec<CellValue>>>();

        let array = Array::from(values);

        Ok(array.into())
    }

    /// Get the display value from the display buffer at a given position.
    pub fn display_value_from_buffer_at(
        &self,
        display_buffer: &[u64],
        pos: Pos,
    ) -> Result<&CellValue> {
        let y = display_buffer
            .get(pos.y as usize)
            .ok_or_else(|| anyhow!("Y {} out of bounds: {}", pos.y, display_buffer.len()))?;
        let new_pos = Pos::new(pos.x, *y as i64);
        let cell_value = self.display_value_from_value_at(new_pos)?;

        Ok(cell_value)
    }

    /// Get the display value from the source value.
    pub fn display_value_from_value(&self) -> Result<Value> {
        let columns_to_show = self.columns_to_show();

        let values = self
            .value
            .to_owned()
            .into_array()?
            .rows()
            .map(|row| self.display_columns(&columns_to_show, row))
            .collect::<Vec<Vec<CellValue>>>();
        let array = Array::from(values);

        Ok(array.into())
    }

    /// Get the display value from the source value at a given position.
    pub fn display_value_from_value_at(&self, pos: Pos) -> Result<&CellValue> {
        let output_size = self.output_size();
        let x = pos.x as u32;
        let y = pos.y as u32;
        let mut new_x = x;

        // if the x position is out of bounds, return a blank value
        if x >= output_size.w.get() {
            return Ok(&CellValue::Blank);
        }

        let columns = self.column_headers.iter().flatten().collect::<Vec<_>>();

        // increase the x position if the column before it is not displayed
        for (i, column) in columns.iter().enumerate() {
            if !column.display && i <= x as usize {
                new_x = new_x.add_checked(1).unwrap_or(new_x);
            }
        }

        let cell_value = self.value.get(new_x, y)?;

        Ok(cell_value)
    }

    /// Get the display value from the display buffer, falling back to the
    /// source value if the display buffer is not set.
    pub fn display_value(&self) -> Result<Value> {
        match self.display_buffer {
            Some(ref display_buffer) => self.display_value_from_buffer(display_buffer),
            None => self.display_value_from_value(),
        }
    }

    /// Get the display value at a given position.
    pub fn display_value_at(&self, mut pos: Pos) -> Result<&CellValue> {
        // only display the first cell if the source cell is HTML or image
        if self.is_html_or_image() && (pos.x != 0 || pos.y != 0) {
            return Ok(&CellValue::Blank);
        }

        if pos.y == 0 && self.show_ui && self.show_name {
            return Ok(self.name.as_ref());
        }
        if pos.y == (if self.show_name { 1 } else { 0 })
            && self.show_ui
            && self.show_columns
            && !self.header_is_first_row
        {
            if let Some(columns) = &self.column_headers {
                let display_columns = columns.iter().filter(|c| c.display).collect::<Vec<_>>();
                if let Some(column) = display_columns.get(pos.x as usize) {
                    return Ok(column.name.as_ref());
                }
            }
        }

        pos.y -= self.y_adjustment();

        match self.display_buffer {
            Some(ref display_buffer) => self.display_value_from_buffer_at(display_buffer, pos),
            None => self.display_value_from_value_at(pos),
        }
    }

    /// Get the indices of the columns to show.
    pub fn columns_to_show(&self) -> Vec<usize> {
        self.column_headers
            .to_owned()
            .unwrap_or_else(|| self.default_header(None))
            .iter()
            .enumerate()
            .filter(|(_, c)| c.display)
            .map(|(index, _)| index)
            .collect::<Vec<_>>()
    }

    /// Gets the visible columns by name. This is used to map it to a grid
    /// location in the selection.
    pub fn columns_map(&self, show_all: bool) -> Vec<String> {
        self.column_headers
            .to_owned()
            .unwrap_or_else(|| self.default_header(None))
            .iter()
            .enumerate()
            .filter(|(_, c)| show_all || c.display)
            .map(|(_, col)| col.name.to_string())
            .collect::<Vec<_>>()
    }

    /// For a given row of CellValues, return only the columns that should be displayed
    pub fn display_columns(&self, columns_to_show: &[usize], row: &[CellValue]) -> Vec<CellValue> {
        row.iter()
            .cloned()
            .enumerate()
            .filter(|(i, _)| {
                // TODO(ddimaria): removed the "*i != 0" check, delete the
                // commented-out code if no bugs arise
                // (*i == 0 && !self.header_is_first_row) || (*i != 0 && columns_to_show.contains(&i))
                (*i == 0 && !self.header_is_first_row) || (columns_to_show.contains(i))
            })
            .map(|(_, v)| v)
            .collect::<Vec<CellValue>>()
    }

    /// Transmute an index from the display buffer to the source index.
    pub fn transmute_index(&self, index: u64) -> u64 {
        match self.display_buffer {
            Some(ref display_buffer) => *display_buffer.get(index as usize).unwrap_or(&index),
            None => index,
        }
    }
}

#[cfg(test)]
pub mod test {
    use serial_test::parallel;

    use crate::{
        controller::{transaction_types::JsCodeResult, GridController},
        grid::{
            test::{
                assert_data_table_row, new_data_table, pretty_print_data_table, test_csv_values,
            },
            CodeCellLanguage, DataTable,
        },
        CellValue, Pos, SheetPos,
    };

    #[test]
    #[parallel]
    fn test_display_value_at_html_or_image() {
        let mut gc = GridController::test();
        let sheet_id = gc.sheet_ids()[0];
        let sheet_pos = SheetPos {
            x: 1,
            y: 1,
            sheet_id,
        };
        gc.set_code_cell(
            sheet_pos,
            CodeCellLanguage::Python,
            "code".to_string(),
            None,
        );
        let transaction_id = gc.last_transaction().unwrap().id;
        gc.calculation_complete(JsCodeResult {
            transaction_id: transaction_id.to_string(),
            success: true,
            output_value: Some(vec!["<html></html>".to_string(), "text".to_string()]),
            ..Default::default()
        })
        .unwrap();
        gc.set_chart_size(sheet_pos, 100.0, 100.0, None);

        let sheet = gc.sheet(sheet_id);

        assert_eq!(
            sheet.display_value(sheet_pos.into()).unwrap(),
            CellValue::Html("<html></html>".to_string())
        );

        assert_eq!(
            sheet.display_value(Pos { x: 2, y: 1 }).unwrap(),
            CellValue::Blank
        );
    }

    #[test]
    #[parallel]
    fn test_hide_column() {
        let (_, mut data_table) = new_data_table();
        data_table.apply_first_row_as_header();
        let width = data_table.output_size().w.get();
        let mut columns = data_table.column_headers.clone().unwrap();

        pretty_print_data_table(&data_table, None, None);

        // validate display_value()
        columns[0].display = false;
        data_table.column_headers = Some(columns.clone());
        let mut values = test_csv_values();
        values[0].remove(0);
        assert_data_table_row(&data_table, 0, values[0].clone());

        // reset values
        columns[0].display = true;
        data_table.column_headers = Some(columns.clone());

        let remove_column = |remove_at: usize, row: u32, data_table: &mut DataTable| {
            let mut column = columns.clone();
            column[remove_at].display = false;
            data_table.column_headers = Some(column);

            let title = Some(format!("Remove column {}", remove_at));
            pretty_print_data_table(data_table, title.as_deref(), None);

            let expected_output_width = data_table.columns_to_show().len();
            assert_eq!(
                data_table.output_size().w.get(),
                expected_output_width as u32
            );

            (0..width)
                .map(|x| {
                    data_table
                        .display_value_at((x, row).into())
                        .unwrap()
                        .to_string()
                })
                .collect::<Vec<String>>()
        };

        // validate display_value_at()
        let remove_city = remove_column(0, 0, &mut data_table);
        assert_eq!(remove_city, vec!["region", "country", "population", ""]);

        let remove_region = remove_column(1, 0, &mut data_table);
        assert_eq!(remove_region, vec!["city", "country", "population", ""]);

        let remove_county = remove_column(2, 0, &mut data_table);
        assert_eq!(remove_county, vec!["city", "region", "population", ""]);

        let remove_population = remove_column(3, 0, &mut data_table);
        assert_eq!(remove_population, vec!["city", "region", "country", ""]);

        // "Southborough", "MA", "United States", "1000"
        let remove_city = remove_column(0, 1, &mut data_table);
        assert_eq!(remove_city, vec!["MA", "United States", "1000", ""]);

        let remove_city = remove_column(1, 1, &mut data_table);
        assert_eq!(
            remove_city,
            vec!["Southborough", "United States", "1000", ""]
        );

        let remove_city = remove_column(2, 1, &mut data_table);
        assert_eq!(remove_city, vec!["Southborough", "MA", "1000", ""]);

        let remove_city = remove_column(3, 1, &mut data_table);
        assert_eq!(remove_city, vec!["Southborough", "MA", "United States", ""]);
    }
}
