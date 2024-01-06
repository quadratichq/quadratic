use anyhow::{anyhow, Result};

use crate::{
    controller::execution::run_code::get_cells::{GetCellResponse, GetCellsResponse},
    Array, CellValue, Pos, Rect,
};

use super::Sheet;

impl Sheet {
    pub fn get_cells_response(&self, rect: Rect) -> GetCellsResponse {
        let mut response = vec![];
        for y in rect.y_range() {
            for x in rect.x_range() {
                if let Some(cell) = self.display_value(Pos { x, y }) {
                    response.push(GetCellResponse {
                        x,
                        y,
                        value: cell.to_edit(),
                    });
                } else {
                    response.push(GetCellResponse {
                        x,
                        y,
                        value: "".into(),
                    });
                }
            }
        }
        GetCellsResponse { response }
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
                        self.display_value(Pos { x, y })
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
    pub fn has_cell_value_in_rect(&self, rect: &Rect, skip: Option<Pos>) -> bool {
        for x in rect.x_range() {
            if let Some(column) = self.get_column(x) {
                for y in rect.y_range() {
                    let cell_pos = Pos { x, y };
                    if column.values.get(y).is_some_and(|cell| {
                        Some(cell_pos) != skip && !cell.is_blank_or_empty_string()
                    }) {
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
    use super::*;
    use crate::{grid::Sheet, CellValue, Pos, Rect};

    #[test]
    fn test_has_cell_values_in_rect() {
        let mut sheet = Sheet::test();
        let rect = Rect::from_numbers(0, 0, 10, 10);
        assert!(!sheet.has_cell_value_in_rect(&rect, None));
        sheet.set_cell_value(Pos { x: 0, y: 0 }, CellValue::Number(1.into()));
        assert!(sheet.has_cell_value_in_rect(&rect, None));
        assert!(!sheet.has_cell_value_in_rect(&rect, Some(Pos { x: 0, y: 0 })));
    }

    #[test]
    fn test_get_cells_response() {
        let mut sheet = Sheet::test();
        sheet.set_cell_value(Pos { x: 0, y: 0 }, CellValue::Number(1.into()));
        sheet.set_cell_value(Pos { x: 1, y: 0 }, CellValue::Number(2.into()));
        sheet.set_cell_value(Pos { x: 0, y: 1 }, CellValue::Number(3.into()));
        sheet.set_cell_value(Pos { x: 1, y: 1 }, CellValue::Number(4.into()));
        let response = sheet.get_cells_response(Rect::from_numbers(0, 0, 2, 2));
        assert_eq!(
            response,
            GetCellsResponse {
                response: vec![
                    GetCellResponse {
                        x: 0,
                        y: 0,
                        value: "1".into(),
                    },
                    GetCellResponse {
                        x: 1,
                        y: 0,
                        value: "2".into(),
                    },
                    GetCellResponse {
                        x: 0,
                        y: 1,
                        value: "3".into(),
                    },
                    GetCellResponse {
                        x: 1,
                        y: 1,
                        value: "4".into(),
                    },
                ],
            }
        );
    }
}
