use anyhow::{anyhow, Result};
use smallvec::SmallVec;

use super::{transactions::TransactionSummary, GridController};
use crate::{
    grid::{Sheet, SheetId},
    Array, CellValue, Pos, Rect,
};

impl GridController {
    pub fn expand_down(
        &mut self,
        sheet_id: SheetId,
        rect: Rect,
        to: i64,
        _shrink_horizontal: Option<i64>,
        cursor: Option<String>,
    ) -> Result<TransactionSummary> {
        let range = Rect {
            min: Pos {
                x: rect.min.x,
                y: rect.max.y + 1,
            },
            max: Pos {
                x: rect.max.x,
                y: to,
            },
        };

        self.expand(sheet_id, &rect, &range, cursor)
    }

    pub fn expand_right(
        &mut self,
        sheet_id: SheetId,
        rect: Rect,
        to: i64,
        to_vertical: Option<i64>,
        cursor: Option<String>,
    ) -> Result<TransactionSummary> {
        let to_vertical = to_vertical.unwrap_or(rect.max.y);
        let range = Rect {
            min: Pos {
                x: rect.max.x + 1,
                y: rect.min.y,
            },
            max: Pos {
                x: to,
                y: to_vertical,
            },
        };

        self.expand(sheet_id, &rect, &range, cursor)
    }

    pub fn expand_left(
        &mut self,
        sheet_id: SheetId,
        rect: Rect,
        to: i64,
        to_vertical: Option<i64>,
        cursor: Option<String>,
    ) -> Result<TransactionSummary> {
        let to_vertical = to_vertical.unwrap_or(rect.max.y);
        let range = Rect {
            min: Pos {
                x: to,
                y: rect.min.y,
            },
            max: Pos {
                x: rect.min.x - 1,
                y: to_vertical,
            },
        };

        self.expand(sheet_id, &rect, &range, cursor)
    }

    pub fn expand(
        &mut self,
        sheet_id: SheetId,
        rect: &Rect,
        range: &Rect,
        cursor: Option<String>,
    ) -> Result<TransactionSummary> {
        let sheet = self.sheet(sheet_id);
        let selection_values = cell_values_in_rect(&rect, &sheet)?;
        let values = set_cell_projections(&selection_values, &range);

        let array = Array::new_row_major(range.size(), values)
            .map_err(|e| anyhow!("Could not create array of size {:?}: {:?}", range.size(), e))?;

        Ok(self.set_cells(sheet_id, range.min, array, cursor))
    }
}

pub fn cell_values_in_rect(&rect: &Rect, sheet: &Sheet) -> Result<Array> {
    let values = rect
        .y_range()
        .map(|y| {
            rect.x_range()
                .map(|x| {
                    sheet
                        .get_cell_value(Pos { x, y })
                        .unwrap_or_else(|| CellValue::Blank)
                })
                .collect::<Vec<CellValue>>()
        })
        .flatten()
        .collect();

    Array::new_row_major(rect.size(), values)
        .map_err(|e| anyhow!("Could not create array of size {:?}: {:?}", rect.size(), e))
}

pub fn project_cell_value<'a>(selection: &'a Array, pos: Pos, rect: &'a Rect) -> &'a CellValue {
    let x = (pos.x - rect.min.x) as u32 % selection.width();
    let y = (pos.y - rect.min.y) as u32 % selection.height();

    selection.get(x, y).unwrap_or_else(|_| &CellValue::Blank)
}

pub fn set_cell_projections(projection: &Array, rect: &Rect) -> SmallVec<[CellValue; 1]> {
    rect.y_range()
        .map(|y| {
            rect.x_range()
                .map(|x| project_cell_value(&projection, Pos { x, y }, &rect).to_owned())
                .collect::<Vec<CellValue>>()
        })
        .flatten()
        .collect()
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::array;

    fn test_setup() -> (GridController, Sheet, Rect) {
        let mut grid_controller = GridController::new();
        let sheet_id = grid_controller.grid.sheets()[0].id;

        let rect = Rect {
            min: Pos { x: 0, y: 0 },
            max: Pos { x: 2, y: 1 },
        };
        grid_controller.set_cell_value(sheet_id, Pos { x: 0, y: 0 }, CellValue::Number(1.0), None);
        grid_controller.set_cell_value(sheet_id, Pos { x: 1, y: 0 }, CellValue::Number(2.0), None);
        grid_controller.set_cell_value(sheet_id, Pos { x: 2, y: 0 }, CellValue::Number(3.0), None);
        grid_controller.set_cell_value(sheet_id, Pos { x: 0, y: 1 }, CellValue::Number(4.0), None);
        grid_controller.set_cell_value(sheet_id, Pos { x: 1, y: 1 }, CellValue::Number(5.0), None);
        grid_controller.set_cell_value(sheet_id, Pos { x: 2, y: 1 }, CellValue::Number(6.0), None);

        let sheet = grid_controller.sheet(sheet_id);
        (grid_controller.clone(), sheet.clone(), rect)
    }

    fn test_setup_not_anchored() -> (GridController, Sheet, Rect) {
        let mut grid_controller = GridController::new();
        let sheet_id = grid_controller.grid.sheets()[0].id;

        let rect = Rect {
            min: Pos { x: 2, y: 2 },
            max: Pos { x: 4, y: 3 },
        };
        grid_controller.set_cell_value(sheet_id, Pos { x: 2, y: 2 }, CellValue::Number(1.0), None);
        grid_controller.set_cell_value(sheet_id, Pos { x: 3, y: 2 }, CellValue::Number(2.0), None);
        grid_controller.set_cell_value(sheet_id, Pos { x: 4, y: 2 }, CellValue::Number(3.0), None);
        grid_controller.set_cell_value(sheet_id, Pos { x: 2, y: 3 }, CellValue::Number(4.0), None);
        grid_controller.set_cell_value(sheet_id, Pos { x: 3, y: 3 }, CellValue::Number(5.0), None);
        grid_controller.set_cell_value(sheet_id, Pos { x: 4, y: 3 }, CellValue::Number(6.0), None);

        let sheet = grid_controller.sheet(sheet_id);
        (grid_controller.clone(), sheet.clone(), rect)
    }

    #[test]
    fn test_cell_values_in_rect() {
        let (_, sheet, rect) = test_setup();
        let result = cell_values_in_rect(&rect, &sheet).unwrap();
        let expected = array![
            1, 2, 3;
            4, 5, 6;
        ];

        assert_eq!(result, expected);
    }

    #[test]
    fn test_project_cell_value() {
        let (_, sheet, rect) = test_setup();
        let selection = cell_values_in_rect(&rect, &sheet).unwrap();
        let func = |pos| project_cell_value(&selection, pos, &rect);

        assert_eq!(func(Pos { x: 3, y: 0 }), &CellValue::Number(1.0));
        assert_eq!(func(Pos { x: 4, y: 0 }), &CellValue::Number(2.0));
        assert_eq!(func(Pos { x: 5, y: 0 }), &CellValue::Number(3.0));
        assert_eq!(func(Pos { x: 3, y: 1 }), &CellValue::Number(4.0));
        assert_eq!(func(Pos { x: 4, y: 1 }), &CellValue::Number(5.0));
        assert_eq!(func(Pos { x: 5, y: 1 }), &CellValue::Number(6.0));
    }

    #[test]
    fn test_project_cell_value_not_anchored() {
        let (_, sheet, rect) = test_setup_not_anchored();
        let selection = cell_values_in_rect(&rect, &sheet).unwrap();
        let func = |pos| project_cell_value(&selection, pos, &rect);

        assert_eq!(func(Pos { x: 5, y: 2 }), &CellValue::Number(1.0));
        assert_eq!(func(Pos { x: 6, y: 2 }), &CellValue::Number(2.0));
        assert_eq!(func(Pos { x: 7, y: 2 }), &CellValue::Number(3.0));
        assert_eq!(func(Pos { x: 5, y: 3 }), &CellValue::Number(4.0));
        assert_eq!(func(Pos { x: 6, y: 3 }), &CellValue::Number(5.0));
        assert_eq!(func(Pos { x: 7, y: 3 }), &CellValue::Number(6.0));
    }

    #[test]
    fn test_expand_right() {
        let (mut grid_controller, sheet, rect) = test_setup();
        let result = grid_controller
            .expand_right(sheet.id, rect, 10, None, None)
            .unwrap();
        let expected = Rect {
            min: Pos { x: 3, y: 0 },
            max: Pos { x: 10, y: 1 },
        };
        assert_eq!(result.cell_regions_modified[0].1, expected);
    }

    #[test]
    fn test_expand_right_not_anchored() {
        let (mut grid_controller, sheet, rect) = test_setup_not_anchored();
        let result = grid_controller
            .expand_right(sheet.id, rect, 12, None, None)
            .unwrap();
        let expected = Rect {
            min: Pos { x: 5, y: 2 },
            max: Pos { x: 12, y: 3 },
        };
        assert_eq!(result.cell_regions_modified[0].1, expected);
    }

    #[test]
    fn test_expand_down() {
        let (mut grid_controller, sheet, rect) = test_setup();
        let result = grid_controller
            .expand_down(sheet.id, rect, 10, None, None)
            .unwrap();
        let expected = Rect {
            min: Pos { x: 0, y: 2 },
            max: Pos { x: 2, y: 10 },
        };
        assert_eq!(result.cell_regions_modified[0].1, expected);
    }

    #[test]
    fn test_expand_left() {
        let (mut grid_controller, sheet, rect) = test_setup();
        let result = grid_controller
            .expand_left(sheet.id, rect, -10, None, None)
            .unwrap();
        let expected = Rect {
            min: Pos { x: -10, y: 0 },
            max: Pos { x: -1, y: 1 },
        };
        assert_eq!(result.cell_regions_modified[0].1, expected);
    }
}
