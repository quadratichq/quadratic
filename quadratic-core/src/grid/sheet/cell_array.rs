use anyhow::{anyhow, Result};

use crate::{
    controller::transaction_types::{CellForArray, CellsForArray},
    Array, CellValue, Pos, Rect,
};

use super::Sheet;

impl Sheet {
    pub fn cell_array(&self, rect: Rect) -> CellsForArray {
        let mut array = vec![];
        for y in rect.y_range() {
            for x in rect.x_range() {
                if let Some(cell) = self.get_cell_value(Pos { x, y }) {
                    array.push(CellForArray::new(x, y, Some(cell.to_edit())));
                } else {
                    array.push(CellForArray::new(x, y, None));
                }
            }
        }
        CellsForArray::new(array, false)
    }

    /// In a given rect, collect all cell values into an array.
    ///
    /// TODO(ddimaria): is this necessary as it's more performant to just pluck the data from the sheet directly
    /// davidfig: regrettably, the Array::new_row_major requires the ordering to be row-based and not column based.
    /// we would need to rework how Array works for this to be more performant.
    pub fn cell_values_in_rect(&self, &selection: &Rect) -> Result<Array> {
        let values = selection
            .y_range()
            .flat_map(|y| {
                selection
                    .x_range()
                    .map(|x| {
                        self.get_cell_value(Pos { x, y })
                            .unwrap_or_else(|| CellValue::Blank)
                    })
                    .collect::<Vec<CellValue>>()
            })
            .collect();

        Array::new_row_major(selection.size(), values).map_err(|e| {
            anyhow!(
                "Could not create array of size {:?}: {:?}",
                selection.size(),
                e
            )
        })
    }

    /// Returns whether a rect has any CellValue within it.
    pub fn has_cell_value_in_rect(&self, rect: &Rect) -> bool {
        for x in rect.x_range() {
            if let Some(column) = self.get_column(x) {
                for y in rect.y_range() {
                    if column
                        .values
                        .get(y)
                        .is_some_and(|cell| !cell.is_blank_or_empty_string())
                    {
                        return true;
                    }
                }
            }
        }
        false
    }
}

#[cfg(test)]
mod tests {
    use crate::{grid::Sheet, CellValue, Pos, Rect};

    #[test]
    fn test_has_cell_values_in_rect() {
        let mut sheet = Sheet::test();
        let rect = Rect::from_numbers(0, 0, 10, 10);
        assert!(!sheet.has_cell_value_in_rect(&rect));
        sheet.set_cell_value(Pos { x: 0, y: 0 }, CellValue::Number(1.into()));
        assert!(sheet.has_cell_value_in_rect(&rect));
    }
}
