use std::collections::HashMap;
use std::ops::Range;
use std::time::Instant;

use itertools::Itertools;
use serde::{Deserialize, Serialize};

use crate::grid::block::SameValue;
use crate::grid::borders::cell::{CellBorders, CellSide};
use crate::grid::borders::compute_indices;
use crate::grid::borders::style::{BorderSelection, BorderStyle};
use crate::grid::{ColumnData, ColumnId, IdMap, RegionRef, RowId, Sheet};
use crate::{grid, Rect};

pub fn generate_borders(
    sheet: &Sheet,
    region: &RegionRef,
    selections: Vec<BorderSelection>,
    style: Option<BorderStyle>,
) -> SheetBorders {
    let timer = Instant::now();
    let mut id_space_borders = sheet.borders.per_cell.clone_region(&sheet.row_ids, region);
    let mut render_borders = sheet
        .borders
        .render_lookup
        .clone_rects(&sheet.region_rects(region).collect_vec());

    let elapsed = timer.elapsed();
    println!("clone: {elapsed:?}");

    let timer = Instant::now();
    for rect in sheet.region_rects(region) {
        let timer_2 = Instant::now();
        let horizontal = compute_indices::horizontal(rect, selections.clone());
        let vertical = compute_indices::vertical(rect, selections.clone());
        let elapsed = timer_2.elapsed();
        println!("  indices: {elapsed:?}");

        let timer_2 = Instant::now();
        for &horizontal_border_index in &horizontal {
            let above_index = horizontal_border_index - 1;
            let column_ids = rect
                .x_range()
                .filter_map(|index| sheet.get_column(index))
                .map(|column| column.id)
                .collect_vec();

            id_space_borders.set_horizontal_border(&column_ids, above_index, style);
            render_borders.set_horizontal_border(horizontal_border_index, rect.x_range(), style);
        }
        let elapsed = timer_2.elapsed();
        let num_calls = horizontal.len();
        println!("  horizontal ({num_calls}): {elapsed:?}");

        let timer_2 = Instant::now();
        for &vertical_border_index in &vertical {
            let column_left_index = vertical_border_index - 1;
            let column_left_id = sheet.get_column(column_left_index).map(|column| column.id);

            let column_right_index = vertical_border_index;
            let column_right_id = sheet.get_column(column_right_index).map(|column| column.id);

            let row_indices = rect.y_range().collect_vec();
            id_space_borders.set_vertical_border(
                column_left_id,
                column_right_id,
                &row_indices,
                style,
            );
            render_borders.set_vertical_border(vertical_border_index, rect.y_range(), style);
        }
        let elapsed = timer_2.elapsed();
        let num_calls = vertical.len();
        println!("  vertical ({num_calls}): {elapsed:?}");
    }
    let elapsed = timer.elapsed();
    println!("generate: {elapsed:?}");
    SheetBorders {
        per_cell: id_space_borders,
        render_lookup: render_borders,
    }
}

pub fn set_region_borders(
    sheet: &mut Sheet,
    regions: Vec<RegionRef>,
    borders: SheetBorders,
) -> SheetBorders {
    let rects = regions
        .iter()
        .flat_map(|region| sheet.region_rects(region))
        .collect_vec();
    let current_borders = &mut sheet.borders;
    current_borders.set_regions(&sheet.row_ids, regions, rects, borders)
}

#[cfg(test)]
pub fn set_region_border_selection(
    sheet: &mut Sheet,
    region: &RegionRef,
    selections: Vec<BorderSelection>,
    style: Option<BorderStyle>,
) -> SheetBorders {
    let borders = generate_borders(sheet, region, selections, style);
    set_region_borders(sheet, vec![region.clone()], borders)
}

#[derive(Serialize, Deserialize, Debug, Clone, Default, PartialEq)]
pub struct SheetBorders {
    per_cell: IdSpaceBorders,
    pub(super) render_lookup: GridSpaceBorders,
}

impl SheetBorders {
    pub fn new() -> Self {
        Self::default()
    }

    fn set_regions(
        &mut self,
        row_ids: &IdMap<RowId, i64>,
        regions: Vec<RegionRef>,
        rects: Vec<Rect>,
        borders: SheetBorders,
    ) -> SheetBorders {
        let mut previous_borders = SheetBorders::default();

        let timer = Instant::now();
        for region in regions {
            let replaced_id_space =
                self.per_cell
                    .replace_region(&borders.per_cell, row_ids, &region);
            previous_borders
                .per_cell
                .replace_region(&replaced_id_space, row_ids, &region);
        }

        let replaced_grid_space = self
            .render_lookup
            .replace_rects(&borders.render_lookup, &rects);
        previous_borders
            .render_lookup
            .replace_rects(&replaced_grid_space, &rects);

        let elapsed = timer.elapsed();
        println!("set_regions: {elapsed:?}");

        previous_borders
    }
}

#[derive(Serialize, Deserialize, Debug, Clone, Default, PartialEq)]
struct IdSpaceBorders {
    borders: HashMap<ColumnId, ColumnData<SameValue<CellBorders>>>,
}
impl IdSpaceBorders {
    fn clone_region(&self, row_ids: &IdMap<RowId, i64>, region: &RegionRef) -> Self {
        let mut cloned = Self::default();
        cloned.replace_region(self, row_ids, region);
        cloned
    }

    fn replace_region(
        &mut self,
        source: &Self,
        row_ids: &IdMap<RowId, i64>,
        region: &RegionRef,
    ) -> Self {
        let mut previous = Self::default();
        for column_id in &region.columns {
            let row_ranges = grid::sheet::row_ranges(&region.rows, row_ids);
            let replacement = source.clone_blocks(*column_id, row_ranges.clone());

            let mut dest_column = self.borders.entry(*column_id).or_default();
            let mut previous_column = previous.borders.entry(*column_id).or_default();

            // TODO(jrice): We need to improve ColumnData algorithms to make this simpler

            for range in row_ranges {
                for y in range {
                    let replaced = dest_column.set(y, replacement.get(y));
                    previous_column.set(y, replaced);
                }
            }
        }
        previous
    }

    fn clone_blocks(
        &self,
        column_id: ColumnId,
        row_ranges: Vec<Range<i64>>,
    ) -> ColumnData<SameValue<CellBorders>> {
        let mut column = ColumnData::new();
        if let Some(source_column) = self.borders.get(&column_id) {
            for block in row_ranges {
                for y in block {
                    column.set(y, source_column.get(y));
                }
            }
        }
        column
    }

    fn set_horizontal_border(
        &mut self,
        columns: &[ColumnId],
        row_index_above: i64,
        style: Option<BorderStyle>,
    ) {
        // let timer = Instant::now();
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
        let column_borders = self.borders.entry(column_id).or_default();

        let new_borders = CellBorders::combine(column_borders.get(row_index), side, style);

        if new_borders.is_empty() {
            column_borders.set(row_index, None);
        } else {
            column_borders.set(row_index, Some(new_borders));
        }
    }
}

#[derive(Serialize, Deserialize, Debug, Clone, Default, PartialEq)]
pub struct GridSpaceBorders {
    pub(super) vertical: HashMap<i64, ColumnData<SameValue<BorderStyle>>>,
    pub(super) horizontal: HashMap<i64, ColumnData<SameValue<BorderStyle>>>,
}
impl GridSpaceBorders {
    fn clone_rects(&self, rects: &[Rect]) -> GridSpaceBorders {
        let mut cloned = Self::default();
        cloned.replace_rects(self, rects);
        cloned
    }

    fn replace_rects(&mut self, source: &Self, rects: &[Rect]) -> Self {
        let mut previous = Self::default();
        for rect in rects {
            // Vertical borders
            for x in rect.x_range().chain([rect.x_range().end]) {
                for y in rect.y_range() {
                    let source_style = source.vertical.get(&x).map(|col| col.get(y)).flatten();
                    let prev_style = self.vertical.entry(x).or_default().set(y, source_style);
                    previous.vertical.entry(x).or_default().set(y, prev_style);
                }
            }

            // Horizontal
            for y in rect.y_range().chain([rect.y_range().end]) {
                for x in rect.x_range() {
                    let source_style = source.horizontal.get(&y).map(|col| col.get(x)).flatten();
                    let prev_style = self.horizontal.entry(y).or_default().set(x, source_style);
                    previous.horizontal.entry(y).or_default().set(x, prev_style);
                }
            }
        }
        previous
    }

    fn set_vertical_border(&mut self, index: i64, y_range: Range<i64>, style: Option<BorderStyle>) {
        // TODO(jrice): Again, need a block set algorithm for ColumnData
        y_range.for_each(|y| {
            self.vertical.entry(index).or_default().set(y, style);
        });
    }

    fn set_horizontal_border(
        &mut self,
        index: i64,
        x_range: Range<i64>,
        style: Option<BorderStyle>,
    ) {
        x_range.for_each(|x| {
            self.horizontal.entry(index).or_default().set(x, style);
        });
    }
}

#[cfg(test)]
pub mod debug {
    use super::*;
    use crate::{Pos, Rect};

    pub(in super::super) trait GetCellBorders {
        fn get_cell_borders(
            &self,
            pos: Pos,
            column_ids: &IdMap<ColumnId, i64>,
        ) -> Option<CellBorders>;
    }

    impl GetCellBorders for SheetBorders {
        fn get_cell_borders(
            &self,
            pos: Pos,
            column_ids: &IdMap<ColumnId, i64>,
        ) -> Option<CellBorders> {
            self.per_cell.get_cell_borders(pos, column_ids)
        }
    }

    impl GetCellBorders for IdSpaceBorders {
        fn get_cell_borders(
            &self,
            pos: Pos,
            column_ids: &IdMap<ColumnId, i64>,
        ) -> Option<CellBorders> {
            if let Some(column_id) = column_ids.id_at(pos.x) {
                let column = self.borders.get(&column_id);
                let result = column.and_then(|column| column.get(pos.y));
                result
            } else {
                None
            }
        }
    }

    pub(in super::super) fn print_borders<T: GetCellBorders>(
        rect: Rect,
        sheet_borders: &T,
        column_ids: &IdMap<ColumnId, i64>,
    ) {
        for row in rect.y_range() {
            print_tops(rect, sheet_borders, column_ids, row);
            println!();
            print_middles(rect, sheet_borders, column_ids, row);
            println!();
            print_bottoms(rect, sheet_borders, column_ids, row);
            println!();
        }
    }

    fn print_tops<T: GetCellBorders>(
        rect: Rect,
        sheet_borders: &T,
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

    fn print_middles<T: GetCellBorders>(
        rect: Rect,
        sheet_borders: &T,
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

    fn print_bottoms<T: GetCellBorders>(
        rect: Rect,
        sheet_borders: &T,
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
}

#[cfg(test)]
mod tests {
    use crate::color::Rgb;
    use crate::grid::borders::style::CellBorderLine;
    use crate::grid::SheetId;
    use crate::{Pos, Rect};
    use debug::{print_borders, GetCellBorders};

    use super::*;

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

        print_borders(
            Rect::new_span(Pos { x: 2, y: 9 }, Pos { x: 7, y: 14 }),
            &_prev_borders_1,
            &sheet.column_ids,
        );
        println!();
        print_borders(
            Rect::new_span(Pos { x: 2, y: 9 }, Pos { x: 7, y: 14 }),
            &sheet.borders,
            &sheet.column_ids,
        );
        println!();
        print_borders(
            Rect::new_span(Pos { x: 2, y: 9 }, Pos { x: 7, y: 14 }),
            &_prev_borders_2,
            &sheet.column_ids,
        );

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

        print_borders(
            Rect::new_span(Pos { x: 2, y: 9 }, Pos { x: 7, y: 14 }),
            &prev_borders_1,
            &sheet.column_ids,
        );
        println!();
        print_borders(
            Rect::new_span(Pos { x: 2, y: 9 }, Pos { x: 7, y: 14 }),
            &sheet.borders,
            &sheet.column_ids,
        );
        println!();
        print_borders(
            Rect::new_span(Pos { x: 2, y: 9 }, Pos { x: 7, y: 14 }),
            &prev_borders_2,
            &sheet.column_ids,
        );

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
