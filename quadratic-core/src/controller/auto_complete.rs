use anyhow::{anyhow, Result};

use super::{
    formatting::CellFmtArray,
    transactions::{Operation, Transaction, TransactionSummary},
    GridController,
};
use crate::{
    grid::{
        series::{find_auto_complete, SeriesOptions},
        RegionRef, Sheet, SheetId,
    },
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
        let ops = self.expand_height(sheet_id, ExpandDirection::Up, &rect, &range)?;

        Ok(self.transact_forward(Transaction { ops, cursor }))
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
        let ops = self.expand_height(sheet_id, ExpandDirection::Down, &rect, &range)?;

        Ok(self.transact_forward(Transaction { ops, cursor }))
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
        let ops = self.expand_width(sheet_id, ExpandDirection::Right, &rect, &range)?;

        Ok(self.transact_forward(Transaction { ops, cursor }))
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
        let ops = self.expand_width(sheet_id, ExpandDirection::Left, &rect, &range)?;

        Ok(self.transact_forward(Transaction { ops, cursor }))
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
    ) -> Result<Vec<Operation>> {
        // get all values in the rect to set all values in the range
        let value_ops = rect
            .x_range()
            .flat_map(|x| {
                let new_rect = Rect::new_span((x, rect.min.y).into(), (x, rect.max.y).into());
                let row = Rect::new_span((x, range.min.y).into(), (x, range.max.y).into());
                let negative = direction == ExpandDirection::Up;
                self.apply_values(sheet_id, negative, &new_rect, &row)
            })
            .flatten()
            .collect::<Vec<_>>();

        // get formats
        let mut selection = rect
            .y_range()
            .map(|y| {
                let row = Rect::new_span((rect.min.x, y).into(), (rect.max.x, y).into());
                self.get_all_cell_formats(sheet_id, row)
            })
            .collect::<Vec<Vec<CellFmtArray>>>();

        let mut rows = range.y_range().collect::<Vec<i64>>();

        // reverse arrays if going up
        if direction == ExpandDirection::Up {
            selection.reverse();
            rows.reverse();
        }

        // apply formats
        let mut ops = rows
            .iter()
            .enumerate()
            .map(|(index, y)| {
                let row_index = index % selection.len();
                let row = Rect::new_span((rect.min.x, *y).into(), (rect.max.x, *y).into());
                let region = self.region(sheet_id, row);
                apply_formats(region, &selection[row_index])
            })
            .flatten()
            .collect::<Vec<Operation>>();

        ops.extend(value_ops);
        Ok(ops)
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
    ) -> Result<Vec<Operation>> {
        // get all values in the rect to set all values in the range
        let value_ops = range
            .y_range()
            .flat_map(|y| {
                let new_rect = Rect::new_span((rect.min.x, y).into(), (rect.max.x, y).into());
                let col = Rect::new_span((range.min.x, y).into(), (range.max.x, y).into());
                let negative = direction == ExpandDirection::Left;
                self.apply_values(sheet_id, negative, &new_rect, &col)
            })
            .flatten()
            .collect::<Vec<_>>();

        // get formats
        let mut selection = rect
            .x_range()
            .map(|x| {
                let col = Rect::new_span((x, range.min.y).into(), (x, range.max.y).into());
                self.get_all_cell_formats(sheet_id, col)
            })
            .collect::<Vec<Vec<CellFmtArray>>>();

        let mut cols = range.x_range().collect::<Vec<i64>>();

        // reverse arrays if going left
        if direction == ExpandDirection::Left {
            selection.reverse();
            cols.reverse();
        }

        // apply formats
        let mut ops = cols
            .iter()
            .enumerate()
            .map(|(index, x)| {
                let col_index = index % selection.len();
                let col = Rect::new_span((*x, range.min.y).into(), (*x, range.max.y).into());
                let region = self.region(sheet_id, col);
                apply_formats(region, &selection[col_index])
            })
            .flatten()
            .collect::<Vec<Operation>>();

        ops.extend(value_ops);
        Ok(ops)
    }

    pub fn apply_values(
        &mut self,
        sheet_id: SheetId,
        negative: bool,
        rect: &Rect,
        range: &Rect,
    ) -> Result<Vec<Operation>> {
        let sheet = self.sheet(sheet_id);
        let selection_values = cell_values_in_rect(&rect, &sheet)?;
        let series = find_auto_complete(SeriesOptions {
            series: selection_values
                .clone()
                .into_cell_values_vec()
                .into_iter()
                .collect::<Vec<CellValue>>(),
            spaces: (range.width() * range.height()) as i32,
            negative,
        });
        let array = Array::new_row_major(range.size(), series.into())
            .map_err(|e| anyhow!("Could not create array of size {:?}: {:?}", range.size(), e))?;
        Ok(self.set_cells_operations(sheet_id, range.min, array))
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

#[cfg(test)]
mod tests {
    use super::*;
    use crate::{array, grid::Bold};
    use tabled::{
        builder::Builder,
        settings::Color,
        settings::{Modify, Style},
    };

    fn test_setup_rect(rect: &Rect) -> (GridController, SheetId) {
        let vals = vec!["a", "h", "x", "g", "f", "z", "r", "b"];
        let bolds = vec![true, false, false, true, false, true, true, false];

        test_setup(rect, &vals, &bolds)
    }

    fn test_setup(
        selection: &Rect,
        vals: &Vec<&str>,
        bolds: &Vec<bool>,
    ) -> (GridController, SheetId) {
        let mut grid_controller = GridController::new();
        let sheet_id = grid_controller.grid.sheets()[0].id;
        let mut count = 0;

        selection.y_range().for_each(|y| {
            selection.x_range().for_each(|x| {
                let pos = Pos { x, y };
                grid_controller.set_cell_value(sheet_id, pos, vals[count].to_string(), None);

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

        (grid_controller.clone(), sheet_id)
    }

    fn to_text_cell_value(value: &str) -> CellValue {
        CellValue::Text(value.into())
    }

    // fn to_number_cell_value(value: &str) -> CellValue {
    //     CellValue::Number(BigDecimal::from_str(value).unwrap())
    // }

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

    // fn assert_cell_value_number(
    //     grid_controller: &GridController,
    //     sheet_id: SheetId,
    //     x: i64,
    //     y: i64,
    //     value: &str,
    // ) {
    //     assert_cell_value(grid_controller, sheet_id, x, y, to_number_cell_value(value));
    // }

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
        let selected: Rect = Rect::new_span(Pos { x: -1, y: 0 }, Pos { x: 2, y: 1 });
        let (grid_controller, sheet_id) = test_setup_rect(&selected);
        let sheet = grid_controller.grid().sheet_from_id(sheet_id);
        let result = cell_values_in_rect(&selected, &sheet).unwrap();
        let expected = array![
            1, 2, 3;
            4, 5, 6;
        ];

        assert_eq!(result, expected);
    }

    #[test]
    fn test_expand_up() {
        let selected: Rect = Rect::new_span(Pos { x: -1, y: 0 }, Pos { x: 2, y: 1 });
        let (mut grid_controller, sheet_id) = test_setup_rect(&selected);
        let result = grid_controller
            .expand_up(sheet_id, selected, -3, None, None)
            .unwrap();

        let expected = Rect::new_span(Pos { x: -1, y: -3 }, Pos { x: 2, y: -1 });
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
    fn test_expand_down_series() {
        let selected: Rect = Rect::new_span(Pos { x: -1, y: 0 }, Pos { x: 0, y: 3 });
        let vals = vec!["1", "5", "2", "6", "3", "7", "4", "8"];
        let bolds = vec![true, false, false, true, false, true, true, false];
        let (mut grid_controller, sheet_id) = test_setup(&selected, &vals, &bolds);

        let result = grid_controller
            .expand_down(sheet_id, selected, 10, None, None)
            .unwrap();

        table_modified(
            grid_controller.clone(),
            sheet_id,
            &result.cell_regions_modified[0].1,
            &selected,
        );

        // let expected = Rect::new_span(Pos { x: -1, y: 2 }, Pos { x: 2, y: 10 });
        // assert_eq!(result.cell_regions_modified[0].1, expected);

        // assert_cell_value_text(&grid_controller, sheet_id, -1, 2, "a");
        // assert_cell_value_text(&grid_controller, sheet_id, -1, 3, "f");
        // assert_cell_value_text(&grid_controller, sheet_id, -1, 4, "a");
        // assert_cell_value_text(&grid_controller, sheet_id, -1, 5, "f");
        // assert_cell_value_text(&grid_controller, sheet_id, 0, 2, "h");
        // assert_cell_value_text(&grid_controller, sheet_id, 0, 3, "z");
        // assert_cell_value_text(&grid_controller, sheet_id, 0, 4, "h");
        // assert_cell_value_text(&grid_controller, sheet_id, 0, 5, "z");
        // assert_cell_value_text(&grid_controller, sheet_id, 1, 2, "x");
        // assert_cell_value_text(&grid_controller, sheet_id, 1, 3, "r");
        // assert_cell_value_text(&grid_controller, sheet_id, 1, 4, "x");
        // assert_cell_value_text(&grid_controller, sheet_id, 1, 5, "r");

        // assert_cell_format_bold(&grid_controller, sheet_id, -1, 2);
        // assert_cell_format_bold(&grid_controller, sheet_id, 2, 2);
        // assert_cell_format_bold(&grid_controller, sheet_id, 0, 3);
        // assert_cell_format_bold(&grid_controller, sheet_id, 1, 3);
        // assert_cell_format_bold(&grid_controller, sheet_id, -1, 4);
        // assert_cell_format_bold(&grid_controller, sheet_id, 2, 4);
        // assert_cell_format_bold(&grid_controller, sheet_id, 0, 5);
        // assert_cell_format_bold(&grid_controller, sheet_id, 1, 5);
        // assert_cell_format_bold(&grid_controller, sheet_id, -1, 10);
        // assert_cell_format_bold(&grid_controller, sheet_id, 2, 10);

        // assert_cell_format_not_bold(&grid_controller, sheet_id, -1, 11);
        // assert_cell_format_not_bold(&grid_controller, sheet_id, 0, 11);
        // assert_cell_format_not_bold(&grid_controller, sheet_id, 1, 11);
        // assert_cell_format_not_bold(&grid_controller, sheet_id, 2, 11);
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

        assert_cell_format_not_bold(&grid_controller, sheet_id, -11, 0);
        assert_cell_format_not_bold(&grid_controller, sheet_id, -11, 1);
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
        assert_cell_format_bold(&grid_controller, sheet_id, 11, 0);
        assert_cell_format_bold(&grid_controller, sheet_id, 12, 1);

        assert_cell_format_not_bold(&grid_controller, sheet_id, 13, 0);
        assert_cell_format_not_bold(&grid_controller, sheet_id, 13, 1);
    }
}
