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
use anyhow::{Ok, Result, anyhow};

use super::DataTable;

impl DataTable {
    /// Get the display value from the display buffer.
    pub fn display_value_from_buffer(
        &self,
        display_buffer: &[u64],
        include_hidden_columns: bool,
    ) -> Result<Value> {
        let value = self.value.to_owned().into_array()?;
        let columns_to_show = if include_hidden_columns {
            (0..self.width()).collect::<Vec<_>>()
        } else {
            self.columns_to_show()
        };

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
    pub fn display_value_from_value(&self, include_hidden_columns: bool) -> Result<Value> {
        let columns_to_show = if include_hidden_columns {
            (0..self.width()).collect::<Vec<_>>()
        } else {
            self.columns_to_show()
        };

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
        let mut x = pos.x as u32;
        let y = pos.y as u32;

        // if the x position is out of bounds, return a blank value
        if x >= output_size.w.get() {
            return Ok(&CellValue::Blank);
        }

        // add x adjustment for hidden columns
        x = self.get_column_index_from_display_index(x, true);

        let cell_value = self.value.get(x, y)?;

        Ok(cell_value)
    }

    /// Get the display value from the display buffer, falling back to the
    /// source value if the display buffer is not set.
    pub fn display_value(&self, include_hidden_columns: bool) -> Result<Value> {
        match self.display_buffer {
            Some(ref display_buffer) => {
                self.display_value_from_buffer(display_buffer, include_hidden_columns)
            }
            None => self.display_value_from_value(include_hidden_columns),
        }
    }

    /// Get the display value at a given position.
    pub fn display_value_at(&self, mut pos: Pos) -> Result<&CellValue> {
        // the source cell is HTML or image, then display the first cell or blank
        if self.is_html_or_image() {
            return Ok(if pos.x == 0 && pos.y == 0 {
                self.value.get(0, 0)?
            } else {
                &CellValue::Blank
            });
        }

        let show_name = self.get_show_name();
        let show_columns = self.get_show_columns();

        // if the position is the first cell and the name and ui are shown, return the name
        if pos.x == 0 && pos.y == 0 && show_name {
            return Ok(self.name.as_ref());
        }

        let header_y = if show_name { 1 } else { 0 };

        // if the position is the first cell and the header is shown, return the header
        if pos.y == header_y
            && show_columns
            && let Some(header) = self.display_header_at(pos.x as u32)
        {
            return Ok(header.name.as_ref());
        }

        pos.y -= self.y_adjustment(true);

        match self.display_buffer {
            Some(ref display_buffer) => self.display_value_from_buffer_at(display_buffer, pos),
            None => self.display_value_from_value_at(pos),
        }
    }

    /// Get the indices of the columns to show.
    pub fn columns_to_show(&self) -> Vec<usize> {
        let result = self
            .column_headers
            .to_owned()
            .unwrap_or_else(|| self.default_header(None))
            .iter()
            .enumerate()
            .filter(|(_, c)| c.display)
            .map(|(index, _)| index)
            .collect::<Vec<_>>();

        // handles single value case (which does not work properly)
        if result.is_empty() { vec![0] } else { result }
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
            .filter(|(i, _)| columns_to_show.contains(i))
            .map(|(_, v)| v)
            .collect::<Vec<CellValue>>()
    }

    /// Transmute an index from the display buffer to the source index.
    pub fn get_row_index_from_display_index(&self, index: u64) -> u64 {
        match self.display_buffer {
            Some(ref display_buffer) => *display_buffer.get(index as usize).unwrap_or(&index),
            None => index,
        }
    }

    /// Get the reverse lookup display buffer.
    pub fn get_reverse_display_buffer(&self) -> Option<Vec<u64>> {
        self.display_buffer.as_ref().and_then(|display_buffer| {
            let max_row_idx = display_buffer.iter().max().copied().unwrap_or(0);
            if max_row_idx == 0 {
                return None;
            }

            let mut reverse_display_buffer = vec![u64::MAX; (max_row_idx + 1) as usize];
            for (display_idx, &row_idx) in display_buffer.iter().enumerate() {
                reverse_display_buffer[row_idx as usize] = display_idx as u64;
            }
            Some(reverse_display_buffer)
        })
    }

    /// Get the display index from the reverse display buffer.
    pub fn get_display_index_from_reverse_display_buffer(
        &self,
        index: u64,
        reverse_display_buffer: Option<&Vec<u64>>,
    ) -> u64 {
        match reverse_display_buffer {
            Some(reverse_display_buffer) => {
                if (index as usize) < reverse_display_buffer.len() {
                    match reverse_display_buffer[index as usize] {
                        u64::MAX => index,
                        display_index => display_index,
                    }
                } else {
                    index
                }
            }
            None => index,
        }
    }
}

#[cfg(test)]
mod test {
    use crate::{
        ArraySize, CellValue, Pos, SheetPos,
        controller::{
            GridController,
            transaction_types::{JsCellValueResult, JsCodeResult},
        },
        grid::{
            CodeCellLanguage, DataTable,
            data_table::test_util::{new_data_table, test_csv_values},
        },
        test_util::*,
    };

    #[test]
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
            None,
            false,
        );
        let transaction_id = gc.last_transaction().unwrap().id;
        gc.calculation_complete(JsCodeResult {
            transaction_id: transaction_id.to_string(),
            success: true,
            output_value: Some(JsCellValueResult("<html></html>".to_string(), 1)),
            ..Default::default()
        })
        .unwrap();
        gc.set_chart_size(sheet_pos, 10, 10, None, false);

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

            let title = Some(format!("Remove column {remove_at}"));
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
        let remove_city = remove_column(0, 1, &mut data_table);
        assert_eq!(remove_city, vec!["region", "country", "population", ""]);

        let remove_region = remove_column(1, 1, &mut data_table);
        assert_eq!(remove_region, vec!["city", "country", "population", ""]);

        let remove_county = remove_column(2, 1, &mut data_table);
        assert_eq!(remove_county, vec!["city", "region", "population", ""]);

        let remove_population = remove_column(3, 1, &mut data_table);
        assert_eq!(remove_population, vec!["city", "region", "country", ""]);

        // "Southborough", "MA", "United States", "1000"
        let remove_city = remove_column(0, 2, &mut data_table);
        assert_eq!(remove_city, vec!["MA", "United States", "1000", ""]);

        let remove_city = remove_column(1, 2, &mut data_table);
        assert_eq!(
            remove_city,
            vec!["Southborough", "United States", "1000", ""]
        );

        let remove_city = remove_column(2, 2, &mut data_table);
        assert_eq!(remove_city, vec!["Southborough", "MA", "1000", ""]);

        let remove_city = remove_column(3, 2, &mut data_table);
        assert_eq!(remove_city, vec!["Southborough", "MA", "United States", ""]);
    }

    #[test]
    fn test_display_value_from_value_at() {
        let (_, mut data_table) = new_data_table();
        data_table.apply_first_row_as_header();

        // Test normal access
        let value = data_table
            .display_value_from_value_at(Pos::new(0, 1))
            .unwrap();
        assert_eq!(value.to_string(), "Southborough");

        // Test with hidden column
        let mut columns = data_table.column_headers.clone().unwrap();
        columns[0].display = false; // Hide the first column
        data_table.column_headers = Some(columns);

        // Should still get correct value even with hidden column
        let value = data_table
            .display_value_from_value_at(Pos::new(0, 1))
            .unwrap();
        assert_eq!(value.to_string(), "MA");

        // Test out of bounds x position
        let value = data_table
            .display_value_from_value_at(Pos::new(10, 1))
            .unwrap();
        assert_eq!(value, &CellValue::Blank);
    }

    #[test]
    fn test_display_value_from_value_single_formula() {
        let mut gc = test_create_gc();
        let sheet_id = first_sheet_id(&gc);

        // Use array formula {256;512} to ensure it stays as DataTable (1x1 formulas become CellValue::Code)
        let dt = test_create_formula(&mut gc, pos![sheet_id!a1], "{256;512}");

        let display_value = dt.display_value(false).unwrap().into_array().unwrap();
        assert_eq!(display_value.size(), ArraySize::new(1, 2).unwrap());
        assert_eq!(
            display_value.get(0, 0).unwrap().to_display(),
            "256".to_string()
        );
        assert_eq!(
            display_value.get(0, 1).unwrap().to_display(),
            "512".to_string()
        );
    }
}
