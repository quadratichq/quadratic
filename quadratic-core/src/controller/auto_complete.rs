use anyhow::{anyhow, Result};
use smallvec::SmallVec;

use super::{
    formatting::CellFmtArray,
    transactions::{Operation, Transaction, TransactionSummary},
    GridController,
};
use crate::{
    grid::{RegionRef, Sheet, SheetId},
    Array, CellValue, Pos, Rect,
};

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
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

        // expand values
        let selection_values = cell_values_in_rect(&rect, &sheet)?;
        let cell_values = set_cell_projections(&selection_values, direction, &range);
        let values = Array::new_row_major(range.size(), cell_values)
            .map_err(|e| anyhow!("Could not create array of size {:?}: {:?}", range.size(), e))?;
        let transaction_summary = self.set_cells(sheet_id, range.min, values, cursor.clone());

        // expand formats
        let mut ops = self.expand_height(sheet_id, direction, rect, range);
        // let mut ops_width = self.expand_width(sheet_id, direction, rect, range);
        // ops.append(&mut ops_width);

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
        crate::util::dbgjs(format!("expand_height"));
        // Get the formats of the selected rectangle
        let mut selection_formats = self.get_all_cell_formats(sheet_id, *rect);
        let rect_height = rect.height() as i64;
        let range_height = range.height() as i64;
        let height_steps = (((range_height + rect_height + 1) / rect_height) as f32).floor() as i64;

        let max_height = |height: i64| match direction {
            ExpandDirection::Down => height.min(range.max.y),
            _ => height.max(range.min.y),
        };

        let calc_step = |height, step| match direction {
            ExpandDirection::Down => height + (rect_height * step),
            _ => height - (rect_height * step),
        };

        (1..height_steps)
            .map(|step| {
                let new_rect = Rect::new_span(
                    (rect.min.x, max_height(calc_step(rect.min.y, step))).into(),
                    (rect.max.x, max_height(calc_step(rect.max.y, step))).into(),
                );

                // hack to get the formats of the last row for an edge case
                if new_rect.max.y == new_rect.min.y && direction == ExpandDirection::Up {
                    let rect = Rect::new_span(rect.max, (rect.max.x - 1, rect.max.y - 1).into());
                    selection_formats = self.get_all_cell_formats(sheet_id, rect);
                }

                let region = self.region(sheet_id, new_rect);
                let ops = apply_formats(region, &selection_formats);
                self.transact_forward(Transaction {
                    ops: ops.clone(),
                    cursor: None,
                });
                ops
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

/// For a given selection (source data), project the cell value at the given Pos.
pub fn project_cell_value<'a>(
    selection: &'a Array,
    direction: ExpandDirection,
    pos: Pos,
    range: &'a Rect,
) -> &'a CellValue {
    let x_diff = match direction {
        ExpandDirection::Left => {
            ((pos.x - range.max.x as i64) % selection.width() as i64) + selection.width() as i64 - 1
        }
        _ => (pos.x - range.min.x) % selection.width() as i64,
    };

    let y_diff = match direction {
        ExpandDirection::Up => pos.y + range.max.y + 1,
        _ => pos.y - range.min.y,
    };

    let x = x_diff as u32;
    let y = y_diff as u32 % selection.height();
    selection.get(x, y).unwrap_or_else(|_| &CellValue::Blank)
}

/// Set the cell values in the given Rect to the given Array.
///
/// TODO(ddimaria): instead of injecting this into an array, would it be better
/// to just set the values directly in the sheet?
pub fn set_cell_projections(
    projection: &Array,
    direction: ExpandDirection,
    range: &Rect,
) -> SmallVec<[CellValue; 1]> {
    range
        .y_range()
        .map(|y| {
            range
                .x_range()
                .map(|x| {
                    project_cell_value(&projection, direction, Pos { x, y }, &range).to_owned()
                })
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
    use tabled::{
        builder::Builder,
        settings::Color,
        settings::{Modify, Style},
    };

    fn test_setup_rect(rect: &Rect) -> (GridController, SheetId) {
        let mut grid_controller = GridController::new();
        let sheet_id = grid_controller.grid.sheets()[0].id;
        let vals = vec!["a", "h", "x", "g", "f", "z", "r", "b"];
        let bolds = vec![true, false, false, true, false, true, true, false];
        let mut count = 0;

        rect.y_range().for_each(|y| {
            rect.x_range().for_each(|x| {
                let pos = Pos { x, y };
                grid_controller.set_cell_value(sheet_id, pos, vals[count].into(), None);

                if bolds[count] == true {
                    grid_controller.set_cell_bold(
                        sheet_id,
                        Rect::single_pos(pos),
                        Some(true),
                        None,
                    );
                }

                count += 1;
            });
        });

        // crate::util::dbgjs(sheet.get_formatting_value::<Bold>(Pos { x: 0, y: 0 }));

        (grid_controller.clone(), sheet_id)
    }

    fn test_setup() -> (GridController, SheetId, Rect) {
        let mut grid_controller = GridController::new();
        let sheet_id = grid_controller.grid.sheets()[0].id;
        let rect = Rect::new_span(Pos { x: -1, y: 0 }, Pos { x: 2, y: 1 });

        grid_controller.set_cell_value(sheet_id, Pos { x: -1, y: 0 }, "a".into(), None);
        grid_controller.set_cell_value(sheet_id, Pos { x: 0, y: 0 }, "h".into(), None);
        grid_controller.set_cell_value(sheet_id, Pos { x: 1, y: 0 }, "x".into(), None);
        grid_controller.set_cell_value(sheet_id, Pos { x: 2, y: 0 }, "g".into(), None);
        grid_controller.set_cell_value(sheet_id, Pos { x: -1, y: 1 }, "f".into(), None);
        grid_controller.set_cell_value(sheet_id, Pos { x: 0, y: 1 }, "z".into(), None);
        grid_controller.set_cell_value(sheet_id, Pos { x: 1, y: 1 }, "r".into(), None);
        grid_controller.set_cell_value(sheet_id, Pos { x: 2, y: 1 }, "b".into(), None);

        grid_controller.set_cell_bold(
            sheet_id,
            Rect::single_pos(Pos { x: 0, y: 0 }),
            Some(true),
            None,
        );

        // crate::util::dbgjs(sheet.get_formatting_value::<Bold>(Pos { x: 0, y: 0 }));

        (grid_controller.clone(), sheet_id, rect)
    }

    fn to_text_cell_value(value: &str) -> CellValue {
        CellValue::Text(value.into())
    }

    fn to_number_cell_value(value: &str) -> CellValue {
        CellValue::Number(BigDecimal::from_str(value).unwrap())
    }

    fn assert_cell_value(
        grid_controller: &GridController,
        sheet_id: SheetId,
        x: i64,
        y: i64,
        value: CellValue,
    ) {
        let sheet = grid_controller.grid().sheet_from_id(sheet_id);
        let cell_value = sheet.get_cell_value(Pos { x, y });
        assert_eq!(
            cell_value,
            Some(value.clone()),
            "Cell at ({}, {}) does not have the value {:?}, it's actually {:?}",
            x,
            y,
            value,
            cell_value
        );
    }

    fn assert_cell_value_number(
        grid_controller: &GridController,
        sheet_id: SheetId,
        x: i64,
        y: i64,
        value: &str,
    ) {
        assert_cell_value(grid_controller, sheet_id, x, y, to_number_cell_value(value));
    }

    fn assert_cell_value_text(
        grid_controller: &GridController,
        sheet_id: SheetId,
        x: i64,
        y: i64,
        value: &str,
    ) {
        assert_cell_value(grid_controller, sheet_id, x, y, to_text_cell_value(value));
    }

    fn assert_cell_format_bold(
        grid_controller: &GridController,
        sheet_id: SheetId,
        x: i64,
        y: i64,
    ) {
        let sheet = grid_controller.grid().sheet_from_id(sheet_id);
        let has_bold = sheet.get_formatting_value::<Bold>(Pos { x, y }).is_some();
        assert!(has_bold, "Cell at ({}, {}) is not bold", x, y);
    }

    fn assert_cell_format_not_bold(
        grid_controller: &GridController,
        sheet_id: SheetId,
        x: i64,
        y: i64,
    ) {
        let sheet = grid_controller.grid().sheet_from_id(sheet_id);
        let has_bold = sheet.get_formatting_value::<Bold>(Pos { x, y }).is_some();
        assert!(!has_bold, "Cell at ({}, {}) is bold", x, y);
    }

    fn table(grid_controller: GridController, sheet_id: SheetId, range: &Rect) {
        let sheet = grid_controller.grid().sheet_from_id(sheet_id);
        let mut vals = vec![];
        let mut builder = Builder::default();
        let columns = (range.x_range())
            .map(|i| i.to_string())
            .collect::<Vec<String>>();
        let mut blank = vec!["".to_string()];
        blank.extend(columns.clone());
        builder.set_header(blank.into_iter());
        let mut bolds = vec![];
        let mut count_x = 0;
        let mut count_y = 0;

        range.y_range().for_each(|y| {
            vals.push(y.to_string());
            range.x_range().for_each(|x| {
                let pos: Pos = Pos { x, y };

                if sheet.get_formatting_value::<Bold>(pos).is_some() {
                    bolds.push((count_y + 1, count_x + 1));
                }

                vals.push(
                    sheet
                        .get_cell_value(pos)
                        .unwrap_or(CellValue::Blank)
                        .to_string(),
                );
                count_x += 1;
            });
            builder.push_record(vals.clone());
            vals.clear();
            count_x = 0;
            count_y += 1;
        });

        let mut table = builder.build();
        table.with(Style::modern());

        bolds.iter().for_each(|coords| {
            table.with(
                Modify::new((coords.0, coords.1))
                    .with(Color::BOLD)
                    .with(Color::FG_BRIGHT_RED),
            );
        });
        println!("\nsheet: {}\n{}", sheet.id, table);
    }

    pub fn table_modified(
        grid_controller: GridController,
        sheet_id: SheetId,
        modified: &Rect,
        selected: &Rect,
    ) {
        let range = Rect::new_span(
            Pos {
                x: modified.min.x - selected.width() as i64,
                y: modified.min.y - selected.height() as i64,
            },
            Pos {
                x: modified.max.x + selected.width() as i64,
                y: modified.max.y + selected.height() as i64,
            },
        );

        table(grid_controller, sheet_id, &range);
    }

    #[test]
    fn test_cell_values_in_rect() {
        let (grid_controller, sheet_id, rect) = test_setup();
        let sheet = grid_controller.grid().sheet_from_id(sheet_id);
        let result = cell_values_in_rect(&rect, &sheet).unwrap();
        let expected = array![
            1, 2, 3;
            4, 5, 6;
        ];

        assert_eq!(result, expected);
    }

    #[test]
    fn test_project_cell_value() {
        let (grid_controller, sheet_id, rect) = test_setup();
        let sheet = grid_controller.grid().sheet_from_id(sheet_id);
        let selection = cell_values_in_rect(&rect, &sheet).unwrap();
        let func = |pos| project_cell_value(&selection, ExpandDirection::Right, pos, &rect);

        assert_eq!(func(Pos { x: 3, y: 0 }), &to_text_cell_value("1"));
        assert_eq!(func(Pos { x: 4, y: 0 }), &to_text_cell_value("2"));
        assert_eq!(func(Pos { x: 5, y: 0 }), &to_text_cell_value("3"));
        assert_eq!(func(Pos { x: 3, y: 1 }), &to_text_cell_value("4"));
        assert_eq!(func(Pos { x: 4, y: 1 }), &to_text_cell_value("5"));
        assert_eq!(func(Pos { x: 5, y: 1 }), &to_text_cell_value("6"));
    }

    #[test]
    fn test_expand_up() {
        let selected: Rect = Rect::new_span(Pos { x: -1, y: 0 }, Pos { x: 2, y: 1 });
        let (mut grid_controller, sheet_id) = test_setup_rect(&selected);
        let result = grid_controller
            .expand_up(sheet_id, selected, -10, None, None)
            .unwrap();

        let expected = Rect::new_span(Pos { x: -1, y: -10 }, Pos { x: 2, y: -1 });
        assert_eq!(result.cell_regions_modified[0].1, expected);

        assert_cell_value_text(&grid_controller, sheet_id, -1, -1, "f");
        assert_cell_value_text(&grid_controller, sheet_id, -1, -2, "a");
        assert_cell_value_text(&grid_controller, sheet_id, -1, -3, "f");
        assert_cell_value_text(&grid_controller, sheet_id, -1, -4, "a");
        assert_cell_value_text(&grid_controller, sheet_id, 0, -1, "z");
        assert_cell_value_text(&grid_controller, sheet_id, 0, -2, "h");
        assert_cell_value_text(&grid_controller, sheet_id, 0, -3, "z");
        assert_cell_value_text(&grid_controller, sheet_id, 0, -4, "h");
        assert_cell_value_text(&grid_controller, sheet_id, 1, -1, "r");
        assert_cell_value_text(&grid_controller, sheet_id, 1, -2, "x");
        assert_cell_value_text(&grid_controller, sheet_id, 1, -3, "r");
        assert_cell_value_text(&grid_controller, sheet_id, 1, -4, "x");

        assert_cell_format_bold(&grid_controller, sheet_id, 0, -1);
        assert_cell_format_bold(&grid_controller, sheet_id, 1, -1);
        assert_cell_format_bold(&grid_controller, sheet_id, -1, -2);
        assert_cell_format_bold(&grid_controller, sheet_id, 2, -2);
        assert_cell_format_bold(&grid_controller, sheet_id, 0, -3);
        assert_cell_format_bold(&grid_controller, sheet_id, 1, -3);
        assert_cell_format_bold(&grid_controller, sheet_id, -1, -4);
        assert_cell_format_bold(&grid_controller, sheet_id, 2, -4);

        table_modified(
            grid_controller.clone(),
            sheet_id,
            &result.cell_regions_modified[0].1,
            &selected,
        );

        assert_cell_format_not_bold(&grid_controller, sheet_id, -1, -11);
        assert_cell_format_not_bold(&grid_controller, sheet_id, 0, -11);
        assert_cell_format_not_bold(&grid_controller, sheet_id, 1, -11);
        assert_cell_format_not_bold(&grid_controller, sheet_id, 2, -11);
    }

    #[test]
    fn test_expand_down() {
        let selected: Rect = Rect::new_span(Pos { x: -1, y: 0 }, Pos { x: 2, y: 1 });
        let (mut grid_controller, sheet_id) = test_setup_rect(&selected);
        let result = grid_controller
            .expand_down(sheet_id, selected, 10, None, None)
            .unwrap();

        let expected = Rect::new_span(Pos { x: -1, y: 2 }, Pos { x: 2, y: 10 });
        assert_eq!(result.cell_regions_modified[0].1, expected);

        assert_cell_value_text(&grid_controller, sheet_id, -1, 2, "a");
        assert_cell_value_text(&grid_controller, sheet_id, -1, 3, "f");
        assert_cell_value_text(&grid_controller, sheet_id, -1, 4, "a");
        assert_cell_value_text(&grid_controller, sheet_id, -1, 5, "f");
        assert_cell_value_text(&grid_controller, sheet_id, 0, 2, "h");
        assert_cell_value_text(&grid_controller, sheet_id, 0, 3, "z");
        assert_cell_value_text(&grid_controller, sheet_id, 0, 4, "h");
        assert_cell_value_text(&grid_controller, sheet_id, 0, 5, "z");
        assert_cell_value_text(&grid_controller, sheet_id, 1, 2, "x");
        assert_cell_value_text(&grid_controller, sheet_id, 1, 3, "r");
        assert_cell_value_text(&grid_controller, sheet_id, 1, 4, "x");
        assert_cell_value_text(&grid_controller, sheet_id, 1, 5, "r");

        assert_cell_format_bold(&grid_controller, sheet_id, -1, 2);
        assert_cell_format_bold(&grid_controller, sheet_id, 2, 2);
        assert_cell_format_bold(&grid_controller, sheet_id, 0, 3);
        assert_cell_format_bold(&grid_controller, sheet_id, 1, 3);
        assert_cell_format_bold(&grid_controller, sheet_id, -1, 4);
        assert_cell_format_bold(&grid_controller, sheet_id, 2, 4);
        assert_cell_format_bold(&grid_controller, sheet_id, 0, 5);
        assert_cell_format_bold(&grid_controller, sheet_id, 1, 5);
        assert_cell_format_bold(&grid_controller, sheet_id, -1, 10);
        assert_cell_format_bold(&grid_controller, sheet_id, 2, 10);

        assert_cell_format_not_bold(&grid_controller, sheet_id, -1, 11);
        assert_cell_format_not_bold(&grid_controller, sheet_id, 0, 11);
        assert_cell_format_not_bold(&grid_controller, sheet_id, 1, 11);
        assert_cell_format_not_bold(&grid_controller, sheet_id, 2, 11);
    }

    #[test]
    fn test_expand_left() {
        let selected: Rect = Rect::new_span(Pos { x: -1, y: 0 }, Pos { x: 2, y: 1 });
        let (mut grid_controller, sheet_id) = test_setup_rect(&selected);
        let result = grid_controller
            .expand_left(sheet_id, selected, -10, None, None)
            .unwrap();

        let expected = Rect::new_span(Pos { x: -10, y: 0 }, Pos { x: -2, y: 1 });
        assert_eq!(result.cell_regions_modified[0].1, expected);

        assert_cell_value_text(&grid_controller, sheet_id, -2, 0, "g");
        assert_cell_value_text(&grid_controller, sheet_id, -3, 0, "x");
        assert_cell_value_text(&grid_controller, sheet_id, -4, 0, "h");
        assert_cell_value_text(&grid_controller, sheet_id, -5, 0, "a");
        assert_cell_value_text(&grid_controller, sheet_id, -6, 0, "g");
        assert_cell_value_text(&grid_controller, sheet_id, -7, 0, "x");
        assert_cell_value_text(&grid_controller, sheet_id, -2, 1, "b");
        assert_cell_value_text(&grid_controller, sheet_id, -3, 1, "r");
        assert_cell_value_text(&grid_controller, sheet_id, -4, 1, "z");
        assert_cell_value_text(&grid_controller, sheet_id, -5, 1, "f");
        assert_cell_value_text(&grid_controller, sheet_id, -6, 1, "b");
        assert_cell_value_text(&grid_controller, sheet_id, -7, 1, "r");

        assert_cell_format_bold(&grid_controller, sheet_id, -2, 0);
        assert_cell_format_bold(&grid_controller, sheet_id, -5, 0);
        assert_cell_format_bold(&grid_controller, sheet_id, -3, 1);
        assert_cell_format_bold(&grid_controller, sheet_id, -4, 1);
        assert_cell_format_bold(&grid_controller, sheet_id, -6, 0);
        assert_cell_format_bold(&grid_controller, sheet_id, -9, 0);
        assert_cell_format_bold(&grid_controller, sheet_id, -7, 1);
        assert_cell_format_bold(&grid_controller, sheet_id, -8, 1);
    }

    #[test]
    fn test_expand_right() {
        let selected: Rect = Rect::new_span(Pos { x: -1, y: 0 }, Pos { x: 2, y: 1 });
        let (mut grid_controller, sheet_id) = test_setup_rect(&selected);
        let result = grid_controller
            .expand_right(sheet_id, selected, 12, None, None)
            .unwrap();

        let expected = Rect::new_span(Pos { x: 3, y: 0 }, Pos { x: 12, y: 1 });
        assert_eq!(result.cell_regions_modified[0].1, expected);

        assert_cell_value_text(&grid_controller, sheet_id, 3, 0, "a");
        assert_cell_value_text(&grid_controller, sheet_id, 4, 0, "h");
        assert_cell_value_text(&grid_controller, sheet_id, 5, 0, "x");
        assert_cell_value_text(&grid_controller, sheet_id, 6, 0, "g");
        assert_cell_value_text(&grid_controller, sheet_id, 7, 0, "a");
        assert_cell_value_text(&grid_controller, sheet_id, 8, 0, "h");
        assert_cell_value_text(&grid_controller, sheet_id, 3, 1, "f");
        assert_cell_value_text(&grid_controller, sheet_id, 4, 1, "z");
        assert_cell_value_text(&grid_controller, sheet_id, 5, 1, "r");
        assert_cell_value_text(&grid_controller, sheet_id, 6, 1, "b");
        assert_cell_value_text(&grid_controller, sheet_id, 7, 1, "f");
        assert_cell_value_text(&grid_controller, sheet_id, 8, 1, "z");

        assert_cell_format_bold(&grid_controller, sheet_id, 3, 0);
        assert_cell_format_bold(&grid_controller, sheet_id, 6, 0);
        assert_cell_format_bold(&grid_controller, sheet_id, 4, 1);
        assert_cell_format_bold(&grid_controller, sheet_id, 5, 1);
        assert_cell_format_bold(&grid_controller, sheet_id, 7, 0);
        assert_cell_format_bold(&grid_controller, sheet_id, 10, 0);
        assert_cell_format_bold(&grid_controller, sheet_id, 8, 1);
        assert_cell_format_bold(&grid_controller, sheet_id, 0, 1);
    }
}
