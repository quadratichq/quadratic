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
    pub fn display_value_from_buffer(&self, display_buffer: &[u64]) -> Result<Value> {
        let value = self.value.to_owned().into_array()?;
        let columns_to_show = self
            .columns
            .iter()
            .flatten()
            .enumerate()
            .filter(|(_, c)| c.display)
            .map(|(index, _)| index)
            .collect::<Vec<_>>();

        let values = display_buffer
            .iter()
            .filter_map(|index| {
                value
                    .get_row(*index as usize)
                    .map(|row| {
                        row.to_vec()
                            .into_iter()
                            .enumerate()
                            .filter(|(i, _)| columns_to_show.contains(&i))
                            .map(|(_, v)| v)
                            .collect::<Vec<CellValue>>()
                    })
                    .ok()
            })
            .collect::<Vec<Vec<CellValue>>>();

        let array = Array::from(values);

        Ok(array.into())
    }

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

    pub fn display_value(&self) -> Result<Value> {
        match self.display_buffer {
            Some(ref display_buffer) => self.display_value_from_buffer(display_buffer),
            None => Ok(self.value.to_owned()),
        }
    }

    pub fn display_value_at(&self, mut pos: Pos) -> Result<&CellValue> {
        // println!("pos: {:?}", pos);
        // println!("self.columns: {:?}", self.columns);

        if pos.y == 0 && self.show_header {
            if let Some(columns) = &self.columns {
                // println!("columns: {:?}", columns);
                if let Some(column) = columns.get(pos.x as usize) {
                    // println!("column: {:?}", column);
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
}

#[cfg(test)]
pub mod test {}
