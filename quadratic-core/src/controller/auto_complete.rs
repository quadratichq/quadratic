use anyhow::{anyhow, Result};
use smallvec::SmallVec;

use super::{
    formatting::CellFmtArray,
    transactions::{Operation, Transaction, TransactionSummary},
    GridController,
};
use crate::{
    grid::{Bold, RegionRef, Sheet, SheetId},
    Array, CellValue, Pos, Rect,
};

#[derive(Debug, Clone, Copy)]
pub enum ExpandDirection {
    Up,
    Down,
    Left,
    Right,
}

impl GridController {
    pub fn expand_up(
        &mut self,
        sheet_id: SheetId,
        rect: Rect,
        to: i64,
        shrink_horizontal: Option<i64>,
        cursor: Option<String>,
    ) -> Result<TransactionSummary> {
        let top = to;
        let bottom = rect.min.y - 1;
        let left = rect.min.x;
        let right = shrink_horizontal.unwrap_or(rect.max.x);
        let range = Rect::new_span((left, top).into(), (right, bottom).into());

        self.expand(sheet_id, ExpandDirection::Up, &rect, &range, cursor)
    }

    pub fn expand_down(
        &mut self,
        sheet_id: SheetId,
        rect: Rect,
        to: i64,
        shrink_horizontal: Option<i64>,
        cursor: Option<String>,
    ) -> Result<TransactionSummary> {
        let top = rect.max.y + 1;
        let bottom = to;
        let left = rect.min.x;
        let right = shrink_horizontal.unwrap_or(rect.max.x);
        let range = Rect::new_span((left, top).into(), (right, bottom).into());

        self.expand(sheet_id, ExpandDirection::Down, &rect, &range, cursor)
    }

    pub fn expand_right(
        &mut self,
        sheet_id: SheetId,
        rect: Rect,
        to: i64,
        to_vertical: Option<i64>,
        cursor: Option<String>,
    ) -> Result<TransactionSummary> {
        let top = to_vertical.map_or(rect.min.y, |y| y.min(rect.min.y));
        let bottom = to_vertical.map_or(rect.max.y, |y| y.max(rect.max.y));
        let left = rect.max.x + 1;
        let right = to;
        let range = Rect::new_span((left, top).into(), (right, bottom).into());

        self.expand(sheet_id, ExpandDirection::Right, &rect, &range, cursor)
    }

    pub fn expand_left(
        &mut self,
        sheet_id: SheetId,
        rect: Rect,
        to: i64,
        to_vertical: Option<i64>,
        cursor: Option<String>,
    ) -> Result<TransactionSummary> {
        let top = to_vertical.map_or(rect.min.y, |y| y.min(rect.min.y));
        let bottom = to_vertical.map_or(rect.max.y, |y| y.max(rect.max.y));
        let left = rect.min.x - 1;
        let right = to;
        let range = Rect::new_span((left, top).into(), (right, bottom).into());

        self.expand(sheet_id, ExpandDirection::Left, &rect, &range, cursor)
    }

    /// Expand the source `rect` to the expanded `range`.
    ///
    /// TODO(ddimaria): `self.set_cells` records a transaction, so this isn't a
    /// great user experience for combination expansions (e.g. expand right and down).
    /// In this or subsequent PRs, we should consider a way to batch these transactions
    /// (e.g. transaction queues).
    pub fn expand(
        &mut self,
        sheet_id: SheetId,
        direction: ExpandDirection,
        rect: &Rect,
        range: &Rect,
        cursor: Option<String>,
    ) -> Result<TransactionSummary> {
        let sheet = self.sheet(sheet_id);

        let selection_values = cell_values_in_rect(&rect, &sheet)?;
        let cell_values = set_cell_projections(&selection_values, &range);
        let values = Array::new_row_major(range.size(), cell_values)
            .map_err(|e| anyhow!("Could not create array of size {:?}: {:?}", range.size(), e))?;
        let transaction_summary = self.set_cells(sheet_id, range.min, values, cursor.clone());

        let mut ops = self.expand_height(sheet_id, direction, rect, range);
        let mut ops_width = self.expand_width(sheet_id, direction, rect, range);
        ops.append(&mut ops_width);

        // crate::util::dbgjs(selection_formats);

        self.transact_forward(Transaction { ops, cursor });

        Ok(transaction_summary)
    }

    // Apply the block of formats below the selection in increments of the
    // selected rectangle (i.e. if the selection is 2 x 2 and the range is
    // to 10 height, apply 4 blocks of format).
    pub fn expand_height(
        &mut self,
        sheet_id: SheetId,
        direction: ExpandDirection,
        rect: &Rect,
        range: &Rect,
    ) -> Vec<Operation> {
        // Get the formats of the selected rectangle
        let selection_formats = self.get_all_cell_formats(sheet_id, *rect);
        let rect_height = rect.height() as i64;
        let range_height = range.height() as i64 + rect_height;
        let height_steps = ((range_height / rect_height) as f32).ceil() as i64;
        let max_height = |height| range_height.min(height);
        let calc_step = |height, step| match direction {
            ExpandDirection::Down => height + (rect_height * step),
            _ => height - (rect_height * step) - 1,
        };

        (1..=height_steps + 1)
            .map(|step| {
                let rew_rect = Rect::new_span(
                    (rect.min.x, calc_step(rect.min.y, step)).into(),
                    (rect.max.x, max_height(calc_step(rect.max.y, step))).into(),
                );

                let region = self.region(sheet_id, rew_rect);
                apply_formats(region, &selection_formats)
            })
            .flatten()
            .collect()
    }

    // Apply the column of formats to the right of the selection in
    // increments of the column (i.e. if the selection is 2 x 2 and
    // the range is to 10 wide, apply 4 columns of format).
    pub fn expand_width(
        &mut self,
        sheet_id: SheetId,
        direction: ExpandDirection,
        rect: &Rect,
        range: &Rect,
    ) -> Vec<Operation> {
        // Get the formats of the entire column: min: (rect.min.x, rect.min.y), max: (rect.max.x, range.max.y).
        let formats = self.get_all_cell_formats(
            sheet_id,
            Rect {
                min: rect.min,
                max: (rect.max.x, range.max.y).into(),
            },
        );

        let rect_width = rect.width() as i64;
        let range_width = range.width() as i64 + rect_width;
        let width_steps = ((range_width / rect_width) as f32).ceil() as i64;
        let max_width = |width| range_width.min(width);
        let calc_step = |width, step| match direction {
            ExpandDirection::Left => width - (rect_width * step),
            _ => width + (rect_width * step),
        };

        // start with 1 to skip the source rect
        (1..=width_steps + 1)
            .map(|step| {
                let new_rect = Rect::new_span(
                    (calc_step(rect.min.x, step), rect.min.y).into(),
                    (max_width(calc_step(rect.max.x, step)), range.max.y).into(),
                );
                let region = self.region(sheet_id, new_rect);
                apply_formats(region, &formats)
            })
            .flatten()
            .collect()
    }
}

/// Apply formats to a given region.
///
/// TODO(ddimaria): this funcion is sufficiently generic that it could be moved
/// TODO(ddimaria): we could remove the clones below by modifying the Operation
/// calls to accept references since they don't mutate the region.
pub fn apply_formats(region: RegionRef, formats: &Vec<CellFmtArray>) -> Vec<Operation> {
    formats
        .iter()
        .map(|format| Operation::SetCellFormats {
            region: region.clone(),
            attr: format.clone(),
        })
        .collect()
}

/// Add the cell values to an Array for the given Rect.
///
/// TODO(ddimaria): determine if this should go in the cell.rs file or equiv
/// TODO(ddimaria): is this necessary as it's more performant to just pluck the data from the sheet direclty
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

// pub fn cell_formats_in_rect(&rect: &Rect, sheet: &Sheet) -> Result<Array> {
//     let values = rect
//         .y_range()
//         .map(|y| {
//             rect.x_range()
//                 .map(|x| {
//                     sheet
//                         .get_formatting_value::<Bold>(Pos { x, y })
//                 })
//                 .collect::<Vec<CellValue>>()
//         })
//         .flatten()
//         .collect();

//     Array::new_row_major(rect.size(), values)
//         .map_err(|e| anyhow!("Could not create array of size {:?}: {:?}", rect.size(), e))
// }

/// For a given selection (source data), project the cell value at the given Pos.
pub fn project_cell_value<'a>(selection: &'a Array, pos: Pos, rect: &'a Rect) -> &'a CellValue {
    let x = (pos.x - rect.min.x) as u32 % selection.width();
    let y = (pos.y - rect.min.y) as u32 % selection.height();

    selection.get(x, y).unwrap_or_else(|_| &CellValue::Blank)
}

// /// For a given selection (source data), project the cell value at the given Pos.
// pub fn project_cell_format<'a>(selection: &'a CellF, pos: Pos, rect: &'a Rect) -> &'a CellValue {
//     let x = (pos.x - rect.min.x) as u32 % selection.width();
//     let y = (pos.y - rect.min.y) as u32 % selection.height();

//     selection.get(x, y).unwrap_or_else(|_| &CellValue::Blank)
// }

/// Set the cell values in the given Rect to the given Array.
///
/// TODO(ddimaria): instead of injecting this into an array, would it be better
/// to just set the values directly in the sheet?
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
    use crate::{array, grid::Bold};
    use bigdecimal::BigDecimal;
    use std::str::FromStr;

    fn test_setup() -> (GridController, Sheet, Rect) {
        let mut grid_controller = GridController::new();
        let sheet_id = grid_controller.grid.sheets()[0].id;

        let rect = Rect {
            min: Pos { x: 0, y: 0 },
            max: Pos { x: 2, y: 1 },
        };
        grid_controller.set_cell_value(sheet_id, Pos { x: 0, y: 0 }, "1.0".into(), None);
        grid_controller.set_cell_value(sheet_id, Pos { x: 1, y: 0 }, "2.0".into(), None);
        grid_controller.set_cell_value(sheet_id, Pos { x: 2, y: 0 }, "3.0".into(), None);
        grid_controller.set_cell_value(sheet_id, Pos { x: 0, y: 1 }, "4.0".into(), None);
        grid_controller.set_cell_value(sheet_id, Pos { x: 1, y: 1 }, "5.0".into(), None);
        grid_controller.set_cell_value(sheet_id, Pos { x: 2, y: 1 }, "6.0".into(), None);

        grid_controller.set_cell_bold(
            sheet_id,
            Rect::single_pos(Pos { x: 0, y: 0 }),
            Some(true),
            None,
        );

        let sheet = grid_controller.sheet(sheet_id);

        crate::util::dbgjs(sheet.get_formatting_value::<Bold>(Pos { x: 0, y: 0 }));

        (grid_controller.clone(), sheet.clone(), rect)
    }

    fn to_cell_value(value: &str) -> CellValue {
        CellValue::Number(BigDecimal::from_str(value).unwrap())
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

        assert_eq!(func(Pos { x: 3, y: 0 }), &to_cell_value("1.0"));
        assert_eq!(func(Pos { x: 4, y: 0 }), &to_cell_value("2.0"));
        assert_eq!(func(Pos { x: 5, y: 0 }), &to_cell_value("3.0"));
        assert_eq!(func(Pos { x: 3, y: 1 }), &to_cell_value("4.0"));
        assert_eq!(func(Pos { x: 4, y: 1 }), &to_cell_value("5.0"));
        assert_eq!(func(Pos { x: 5, y: 1 }), &to_cell_value("6.0"));
    }

    #[test]
    fn test_expand_up() {
        let (mut grid_controller, sheet, rect) = test_setup();
        let result = grid_controller
            .expand_up(sheet.id, rect, -10, None, None)
            .unwrap();
        let expected = Rect {
            min: Pos { x: 0, y: -10 },
            max: Pos { x: 2, y: -1 },
        };
        assert_eq!(result.cell_regions_modified[0].1, expected);

        let result = grid_controller
            .expand_up(sheet.id, rect, -10, Some(1), None)
            .unwrap();
        let expected = Rect {
            min: Pos { x: 0, y: -10 },
            max: Pos { x: 1, y: -1 },
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

        let result = grid_controller
            .expand_down(sheet.id, rect, 10, Some(1), None)
            .unwrap();
        let expected = Rect {
            min: Pos { x: 0, y: 2 },
            max: Pos { x: 1, y: 10 },
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

        let result = grid_controller
            .expand_left(sheet.id, rect, -10, Some(10), None)
            .unwrap();
        let expected = Rect {
            min: Pos { x: -10, y: 0 },
            max: Pos { x: -1, y: 10 },
        };
        assert_eq!(result.cell_regions_modified[0].1, expected);
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

        let result = grid_controller
            .expand_right(sheet.id, rect, 10, Some(10), None)
            .unwrap();
        let expected = Rect {
            min: Pos { x: 3, y: 0 },
            max: Pos { x: 10, y: 10 },
        };
        assert_eq!(result.cell_regions_modified[0].1, expected);
    }
}
