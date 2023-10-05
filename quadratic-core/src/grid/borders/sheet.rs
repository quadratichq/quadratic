use std::collections::HashMap;

use itertools::Itertools;
use serde::{Deserialize, Serialize};

use crate::grid::block::SameValue;
use crate::grid::borders::cell::{CellBorders, CellSide};
use crate::grid::borders::compute_indices;
use crate::grid::borders::style::{BorderSelection, BorderStyle};
use crate::grid::{ColumnData, ColumnId, IdMap, RegionRef, RowId, Sheet};

pub fn generate_sheet_borders(
    sheet: &Sheet,
    region: &RegionRef,
    selections: Vec<BorderSelection>,
    style: Option<BorderStyle>,
) -> SheetBorders {
    let mut sheet_borders = sheet.borders.get_region(region, &sheet.row_ids);

    for rect in sheet.region_rects(region) {
        let horizontal = compute_indices::horizontal(rect, selections.clone());
        let vertical = compute_indices::vertical(rect, selections.clone());

        for horizontal_border_index in horizontal {
            let above_index = horizontal_border_index - 1;
            let column_ids = rect
                .x_range()
                .filter_map(|index| sheet.get_column(index))
                .map(|column| column.id)
                .collect_vec();

            sheet_borders.set_horizontal_border(&column_ids, above_index, style);
        }

        for vertical_border_index in vertical {
            let column_left_index = vertical_border_index - 1;
            let column_left_id = sheet.get_column(column_left_index).map(|column| column.id);

            let column_right_index = vertical_border_index;
            let column_right_id = sheet.get_column(column_right_index).map(|column| column.id);

            let row_indices = rect.y_range().collect_vec();
            sheet_borders.set_vertical_border(column_left_id, column_right_id, &row_indices, style);
        }
    }
    sheet_borders
}

pub fn set_region_borders(
    sheet: &mut Sheet,
    regions: Vec<RegionRef>,
    sheet_borders: SheetBorders,
) -> SheetBorders {
    let borders = &mut sheet.borders;
    borders.set_regions(&sheet.row_ids, regions, sheet_borders)
}

#[cfg(test)]
pub fn set_region_border_selection(
    sheet: &mut Sheet,
    region: &RegionRef,
    selections: Vec<BorderSelection>,
    style: Option<BorderStyle>,
) -> SheetBorders {
    let borders = generate_sheet_borders(sheet, region, selections, style);
    set_region_borders(sheet, vec![region.clone()], borders)
}

#[derive(Serialize, Deserialize, Debug, Clone, Default, PartialEq)]
pub struct SheetBorders {
    pub(super) cell_borders: HashMap<ColumnId, ColumnData<SameValue<CellBorders>>>,
}

impl SheetBorders {
    pub fn new() -> Self {
        Self {
            cell_borders: Default::default(),
        }
    }

    fn get_region(&self, region: &RegionRef, row_ids: &IdMap<RowId, i64>) -> SheetBorders {
        let mut cloned = SheetBorders::new();
        for column_id in &region.columns {
            for row_id in &region.rows {
                if let Some(row_index) = row_ids.index_of(*row_id) {
                    cloned.cell_borders.entry(*column_id).or_default().set(
                        row_index,
                        self.cell_borders
                            .get(column_id)
                            .and_then(|col| col.get(row_index)),
                    );
                }
            }
        }
        cloned
    }

    fn set_regions(
        &mut self,
        row_ids: &IdMap<RowId, i64>,
        regions: Vec<RegionRef>,
        borders: SheetBorders,
    ) -> SheetBorders {
        let mut previous_borders = SheetBorders::new();

        for region in regions {
            for &column_id in &region.columns {
                let new_col_borders = borders.cell_borders.get(&column_id);
                let existing_col_borders = self.cell_borders.entry(column_id).or_default();

                let mut replaced_column = ColumnData::new();
                region
                    .rows
                    .iter()
                    .filter_map(|&row_id| row_ids.index_of(row_id))
                    .map(|row_index| {
                        (
                            row_index,
                            existing_col_borders.set(
                                row_index,
                                new_col_borders.and_then(|col| col.get(row_index)),
                            ),
                        )
                    })
                    .for_each(|(row_index, value)| {
                        replaced_column.set(row_index, value);
                    });

                previous_borders
                    .cell_borders
                    .insert(column_id, replaced_column);
            }
        }

        previous_borders
    }

    fn set_horizontal_border(
        &mut self,
        columns: &[ColumnId],
        row_index_above: i64,
        style: Option<BorderStyle>,
    ) {
        let row_index_below = row_index_above + 1;
        for &column_id in columns {
            self.set_cell_border(column_id, row_index_above, CellSide::Bottom, style);
            self.set_cell_border(column_id, row_index_below, CellSide::Top, style);
        }
    }

    fn set_vertical_border(
        &mut self,
        column_left: Option<ColumnId>,
        column_right: Option<ColumnId>,
        row_indices: &[i64],
        style: Option<BorderStyle>,
    ) {
        for &row_index in row_indices {
            if let Some(column_left) = column_left {
                self.set_cell_border(column_left, row_index, CellSide::Right, style);
            }
            if let Some(column_right) = column_right {
                self.set_cell_border(column_right, row_index, CellSide::Left, style);
            }
        }
    }

    fn set_cell_border(
        &mut self,
        column_id: ColumnId,
        row_index: i64,
        side: CellSide,
        style: Option<BorderStyle>,
    ) {
        let column_borders = self.cell_borders.entry(column_id).or_default();

        let new_borders = CellBorders::combine(column_borders.get(row_index), side, style);

        if new_borders.is_empty() {
            column_borders.set(row_index, None);
        } else {
            column_borders.set(row_index, Some(new_borders));
        }
    }
}

#[cfg(test)]
mod tests {
    use crate::color::Rgb;
    use crate::grid::borders::style::CellBorderLine;
    use crate::grid::SheetId;
    use crate::{Pos, Rect};

    use super::*;

    impl SheetBorders {
        fn get_cell_borders(
            &self,
            pos: Pos,
            column_ids: &IdMap<ColumnId, i64>,
        ) -> Option<CellBorders> {
            if let Some(column_id) = column_ids.id_at(pos.x) {
                let column = self.cell_borders.get(&column_id);
                let result = column.and_then(|column| column.get(pos.y));
                result
            } else {
                None
            }
        }
    }

    fn print_tops(
        rect: Rect,
        sheet_borders: &SheetBorders,
        column_ids: &IdMap<ColumnId, i64>,
        row: i64,
    ) {
        for col in rect.x_range() {
            let pos = Pos { x: col, y: row };
            let borders = sheet_borders.get_cell_borders(pos, column_ids);
            if borders.is_some_and(|borders| borders.contains(&CellSide::Top)) {
                print!(" _____ ");
            } else {
                print!("       ");
            }
        }
    }

    fn print_middles(
        rect: Rect,
        sheet_borders: &SheetBorders,
        column_ids: &IdMap<ColumnId, i64>,
        row: i64,
    ) {
        for col in rect.x_range() {
            let pos = Pos { x: col, y: row };
            let borders = sheet_borders.get_cell_borders(pos, column_ids);
            if borders
                .clone()
                .is_some_and(|borders| borders.contains(&CellSide::Left))
            {
                print!("|");
            } else {
                print!(" ");
            }
            print!("{col:02?},{row:02?}");
            if borders.is_some_and(|borders| borders.contains(&CellSide::Right)) {
                print!("|");
            } else {
                print!(" ");
            }
        }
    }

    fn print_bottoms(
        rect: Rect,
        sheet_borders: &SheetBorders,
        column_ids: &IdMap<ColumnId, i64>,
        row: i64,
    ) {
        for col in rect.x_range() {
            let pos = Pos { x: col, y: row };
            let borders = sheet_borders.get_cell_borders(pos, column_ids);
            if borders.is_some_and(|borders| borders.contains(&CellSide::Bottom)) {
                print!(" ————— ");
            } else {
                print!("       ");
            }
        }
    }

    fn print_borders(rect: Rect, sheet_borders: &SheetBorders, column_ids: &IdMap<ColumnId, i64>) {
        for row in rect.y_range() {
            print_tops(rect, sheet_borders, column_ids, row);
            println!();
            print_middles(rect, sheet_borders, column_ids, row);
            println!();
            print_bottoms(rect, sheet_borders, column_ids, row);
            println!();
        }
    }

    /// Convenience for asserting expected borders more tersely
    macro_rules! assert_borders {
        ($sheet_borders: expr, $column_ids: expr, $cell: expr, None, $message: literal) => {
            let actual = $sheet_borders.get_cell_borders($cell, &$column_ids);
            let expected = None;
            assert_eq!(actual, expected, $message);
        };
        ($sheet_borders: expr, $column_ids: expr, $cell: expr, $borders: tt, $message: literal) => {
            let actual = $sheet_borders.get_cell_borders($cell, &$column_ids);
            let expected = Some(CellBorders::new(&$borders));
            assert_eq!(actual, expected, $message);
        };
    }

    /// Convenience for asserting exact borders; no other borders should exist
    macro_rules! assert_borders_eq {
        ($sheet_borders: expr, $column_ids: expr, $cell_borders: tt, $message: literal) => {
            for (cell, expected_borders) in &$cell_borders {
                let actual = $sheet_borders.get_cell_borders(*cell, &$column_ids);
                let expected = Some(CellBorders::new(&(*expected_borders)));
                assert_eq!(actual, expected, $message);
            }
            // TODO: Assert everywhere else is empty somehow
        };
    }

    #[test]
    fn all_borders() {
        let mut sheet = Sheet::new(SheetId::new(), "Test Sheet".to_string(), "".to_string());
        let rect = Rect::new_span(Pos { x: 3, y: 10 }, Pos { x: 6, y: 15 });
        let region = sheet.region(rect);

        let selection = vec![BorderSelection::All];

        let style = BorderStyle {
            color: Rgb::from_str("#000000").unwrap(),
            line: CellBorderLine::Line1,
        };

        let _prev_borders =
            set_region_border_selection(&mut sheet, &region, selection, Some(style));

        assert_borders!(
            sheet.borders,
            sheet.column_ids,
            Pos { x: 3, y: 10 },
            [
                (CellSide::Left, style),
                (CellSide::Right, style),
                (CellSide::Top, style),
                (CellSide::Bottom, style),
            ],
            "Inside top left should be fully surrounded"
        );

        assert_borders!(
            sheet.borders,
            sheet.column_ids,
            Pos { x: 3, y: 9 },
            None,
            "Outside left top should have no borders"
        );

        assert_borders!(
            sheet.borders,
            sheet.column_ids,
            Pos { x: 6, y: 9 },
            None,
            "Outside right top should have no borders"
        );

        assert_borders!(
            sheet.borders,
            sheet.column_ids,
            Pos { x: 7, y: 13 },
            None,
            "Outside right middle should have no borders"
        );

        assert_borders!(
            sheet.borders,
            sheet.column_ids,
            Pos { x: 2, y: 13 },
            None,
            "Outside left middle should have no borders"
        );
    }

    #[test]
    fn outer_borders() {
        let mut sheet = Sheet::new(SheetId::new(), "Test Sheet".to_string(), "".to_string());
        let rect = Rect::new_span(Pos { x: 3, y: 10 }, Pos { x: 5, y: 12 });
        let region = sheet.region(rect);

        let selection = vec![BorderSelection::Outer];

        let style = BorderStyle {
            color: Rgb::from_str("#000000").unwrap(),
            line: CellBorderLine::Line1,
        };

        let _prev_borders =
            set_region_border_selection(&mut sheet, &region, selection, Some(style));

        assert_borders!(
            sheet.borders,
            sheet.column_ids,
            Pos { x: 4, y: 11 },
            None,
            "Center should have no borders"
        );

        assert_borders!(
            sheet.borders,
            sheet.column_ids,
            Pos { x: 5, y: 12 },
            [(CellSide::Right, style), (CellSide::Bottom, style)],
            "Bottom right should have bottom and right borders"
        );
    }

    #[test]
    fn remove_subset_of_existing_borders() {
        let mut sheet = Sheet::new(SheetId::new(), "Test Sheet".to_string(), "".to_string());

        let rect_1 = Rect::new_span(Pos { x: 3, y: 10 }, Pos { x: 5, y: 12 });
        let rect_2 = Rect::new_span(Pos { x: 4, y: 11 }, Pos { x: 6, y: 13 });

        let region_1 = sheet.region(rect_1);
        let region_2 = sheet.region(rect_2);

        let selection_1 = vec![BorderSelection::All];
        let selection_2 = vec![BorderSelection::All];

        let style = BorderStyle {
            color: Rgb::from_str("#000000").unwrap(),
            line: CellBorderLine::Line1,
        };

        let _prev_borders_1 =
            set_region_border_selection(&mut sheet, &region_1, selection_1, Some(style));

        let _prev_borders_2 = set_region_border_selection(&mut sheet, &region_2, selection_2, None);

        assert_borders!(
            sheet.borders,
            sheet.column_ids,
            Pos { x: 3, y: 10 },
            [
                (CellSide::Left, style),
                (CellSide::Right, style),
                (CellSide::Top, style),
                (CellSide::Bottom, style),
            ],
            "Top left should have all borders"
        );

        assert_borders!(
            sheet.borders,
            sheet.column_ids,
            Pos { x: 3, y: 12 },
            [
                (CellSide::Left, style),
                (CellSide::Right, style),
                (CellSide::Top, style),
                (CellSide::Bottom, style),
            ],
            "Bottom left should have all borders"
        );

        assert_borders!(
            sheet.borders,
            sheet.column_ids,
            Pos { x: 4, y: 11 },
            None,
            "Middle should have no borders"
        );
    }

    #[test]
    fn remove_and_validate_previous_borders() {
        let mut sheet = Sheet::new(SheetId::new(), "Test Sheet".to_string(), "".to_string());

        let rect_1 = Rect::new_span(Pos { x: 3, y: 10 }, Pos { x: 5, y: 12 });
        let rect_2 = Rect::new_span(Pos { x: 4, y: 11 }, Pos { x: 6, y: 13 });

        let region_1 = sheet.region(rect_1);
        let region_2 = sheet.region(rect_2);

        let selection_1 = vec![BorderSelection::All];
        let selection_2 = vec![BorderSelection::All];

        let style = BorderStyle {
            color: Rgb::from_str("#000000").unwrap(),
            line: CellBorderLine::Line1,
        };

        let prev_borders_1 =
            set_region_border_selection(&mut sheet, &region_1, selection_1, Some(style));
        let prev_borders_2 = set_region_border_selection(&mut sheet, &region_2, selection_2, None);

        let expected_cell_borders = [
            (CellSide::Left, style),
            (CellSide::Right, style),
            (CellSide::Top, style),
            (CellSide::Bottom, style),
        ];

        assert_borders_eq!(
            prev_borders_2,
            sheet.column_ids,
            [
                (Pos { x: 4, y: 11 }, expected_cell_borders),
                (Pos { x: 5, y: 11 }, expected_cell_borders),
                (Pos { x: 4, y: 12 }, expected_cell_borders),
                (Pos { x: 5, y: 12 }, expected_cell_borders),
            ],
            "Removed section should have all borders"
        )
    }

    #[test]
    fn change_style_for_subset_of_existing_borders() {
        let mut sheet = Sheet::new(SheetId::new(), "Test Sheet".to_string(), "".to_string());

        let rect_1 = Rect::new_span(Pos { x: 3, y: 10 }, Pos { x: 5, y: 12 });
        let rect_2 = Rect::new_span(Pos { x: 4, y: 11 }, Pos { x: 6, y: 13 });

        let region_1 = sheet.region(rect_1);
        let region_2 = sheet.region(rect_2);

        let selection_1 = vec![BorderSelection::All];
        let selection_2 = vec![BorderSelection::Horizontal];

        let style_1 = BorderStyle {
            color: Rgb::from_str("#000000").unwrap(),
            line: CellBorderLine::Line1,
        };
        let style_2 = BorderStyle {
            color: Rgb::from_str("#FFFFFF").unwrap(),
            line: CellBorderLine::Dotted,
        };

        let _prev_borders_1 =
            set_region_border_selection(&mut sheet, &region_1, selection_1, Some(style_1));
        let _prev_borders_2 =
            set_region_border_selection(&mut sheet, &region_2, selection_2, Some(style_2));

        assert_borders!(
            sheet.borders,
            sheet.column_ids,
            Pos { x: 3, y: 10 },
            [
                (CellSide::Left, style_1),
                (CellSide::Right, style_1),
                (CellSide::Top, style_1),
                (CellSide::Bottom, style_1),
            ],
            "Top left should have all first style"
        );

        assert_borders!(
            sheet.borders,
            sheet.column_ids,
            Pos { x: 4, y: 11 },
            [
                (CellSide::Left, style_1),
                (CellSide::Right, style_1),
                (CellSide::Top, style_1),
                (CellSide::Bottom, style_2),
            ],
            "Middle should have second style on bottom"
        );

        assert_borders!(
            sheet.borders,
            sheet.column_ids,
            Pos { x: 5, y: 12 },
            [
                (CellSide::Left, style_1),
                (CellSide::Right, style_1),
                (CellSide::Top, style_2),
                (CellSide::Bottom, style_2),
            ],
            "Bottom right should have second style on top and bottom"
        );

        assert_borders!(
            sheet.borders,
            sheet.column_ids,
            Pos { x: 6, y: 12 },
            [(CellSide::Top, style_2), (CellSide::Bottom, style_2),],
            "Outside right should have nothing on sides"
        );
    }

    #[test]
    fn change_style_and_validate_previous_borders() {
        let mut sheet = Sheet::new(SheetId::new(), "Test Sheet".to_string(), "".to_string());

        let rect_1 = Rect::new_span(Pos { x: 3, y: 10 }, Pos { x: 5, y: 12 });
        let rect_2 = Rect::new_span(Pos { x: 4, y: 11 }, Pos { x: 6, y: 13 });

        let region_1 = sheet.region(rect_1);
        let region_2 = sheet.region(rect_2);

        let selection_1 = vec![BorderSelection::All];
        let selection_2 = vec![BorderSelection::Horizontal];

        let style_1 = BorderStyle {
            color: Rgb::from_str("#000000").unwrap(),
            line: CellBorderLine::Line1,
        };
        let style_2 = BorderStyle {
            color: Rgb::from_str("#FFFFFF").unwrap(),
            line: CellBorderLine::Dotted,
        };

        let prev_borders_1 =
            set_region_border_selection(&mut sheet, &region_1, selection_1, Some(style_1));
        let prev_borders_2 =
            set_region_border_selection(&mut sheet, &region_2, selection_2, Some(style_2));

        let expected_cell_borders = [
            (CellSide::Left, style_1),
            (CellSide::Right, style_1),
            (CellSide::Top, style_1),
            (CellSide::Bottom, style_1),
        ];

        assert_borders_eq!(
            prev_borders_2,
            sheet.column_ids,
            [
                (Pos { x: 4, y: 11 }, expected_cell_borders),
                (Pos { x: 5, y: 11 }, expected_cell_borders),
                (Pos { x: 4, y: 12 }, expected_cell_borders),
                (Pos { x: 5, y: 12 }, expected_cell_borders),
            ],
            "Removed section should have all borders"
        )
    }
}
