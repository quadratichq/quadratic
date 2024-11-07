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
        let cell_value = self.value.get(pos.x as u32, *y as u32)?;

        Ok(cell_value)
    }

    /// Get the display value from the source valuer.
    pub fn display_value_from_value(&self) -> Result<Value> {
        let columns_to_show = self.columns_to_show();

        let values = self
            .value
            .to_owned()
            .into_array()?
            .rows()
            .map(|row| {
                row.to_vec()
                    .into_iter()
                    .enumerate()
                    .filter(|(i, _)| columns_to_show.contains(&i))
                    .map(|(_, v)| v)
                    .collect::<Vec<CellValue>>()
            })
            .collect::<Vec<Vec<CellValue>>>();
        let array = Array::from(values);

        Ok(array.into())
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

        if pos.y == 0 && self.show_header {
            if let Some(columns) = &self.columns {
                if let Some(column) = columns.get(pos.x as usize) {
                    return Ok(column.name.as_ref());
                }
            }
        }

        if !self.header_is_first_row && self.show_header {
            pos.y -= 1;
        }

        match self.display_buffer {
            Some(ref display_buffer) => self.display_value_from_buffer_at(display_buffer, pos),
            None => Ok(self.value.get(pos.x as u32, pos.y as u32)?),
        }
    }

    /// Get the indices of the columns to show.
    pub fn columns_to_show(&self) -> Vec<usize> {
        self.columns
            .iter()
            .flatten()
            .enumerate()
            .filter(|(_, c)| c.display)
            .map(|(index, _)| index)
            .collect::<Vec<_>>()
    }

    /// For a given row of CellValues, return only the columns that should be displayed
    pub fn display_columns(&self, columns_to_show: &[usize], row: &[CellValue]) -> Vec<CellValue> {
        row.to_vec()
            .into_iter()
            .enumerate()
            .filter(|(i, _)| columns_to_show.contains(&i))
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
            CodeCellLanguage,
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
        )
    }

    #[test]
    #[parallel]
    fn test_hide_column() {
        let (_, mut data_table) = new_data_table();
        data_table.apply_first_row_as_header();
        let mut columns = data_table.columns.clone().unwrap();
        columns[0].display = false;
        data_table.columns = Some(columns);

        pretty_print_data_table(&data_table, None, None);

        let mut values = test_csv_values();
        values[0].remove(0);

        assert_data_table_row(&data_table, 0, values[0].clone());
    }
}
