use std::collections::HashMap;
use std::ops::Range;

use serde::{Deserialize, Serialize};

use crate::grid::block::SameValue;
use crate::grid::borders::cell::{CellBorders, CellSide};
use crate::grid::borders::compute_indices;
use crate::grid::borders::style::{BorderSelection, BorderStyle};
use crate::grid::{ColumnData, Sheet};
use crate::{Pos, Rect};

pub fn generate_borders(
    sheet: &Sheet,
    rect: &Rect,
    selections: Vec<BorderSelection>,
    style: Option<BorderStyle>,
) -> SheetBorders {
    generate_borders_full(sheet, rect, selections, vec![style])
}

pub fn generate_borders_full(
    sheet: &Sheet,
    rect: &Rect,
    selections: Vec<BorderSelection>,
    styles: Vec<Option<BorderStyle>>,
) -> SheetBorders {
    let mut id_space_borders = sheet.borders.per_cell.clone_rect(rect);
    let mut render_borders = sheet.borders.render_lookup.clone_rect(rect);

    // if Clear then set style to None
    let styles = if selections.len() == 1 && selections[0] == BorderSelection::Clear {
        vec![None]
    } else {
        styles
    };

    for style in styles.iter() {
        let horizontal = compute_indices::horizontal(rect, selections.clone());
        let vertical = compute_indices::vertical(rect, selections.clone());

        for &horizontal_border_index in &horizontal {
            let above_index = horizontal_border_index - 1;

            id_space_borders.set_horizontal_border(rect.x_range(), above_index, *style);
            render_borders.set_horizontal_border(horizontal_border_index, rect.x_range(), *style);
        }

        for &vertical_border in &vertical {
            let column_left = vertical_border - 1;

            id_space_borders.set_vertical_border(
                Some(column_left),
                Some(vertical_border),
                rect.y_range(),
                *style,
            );
            render_borders.set_vertical_border(vertical_border, rect.y_range(), *style);
        }
    }
    SheetBorders {
        per_cell: id_space_borders,
        render_lookup: render_borders,
    }
}

pub fn set_rect_borders(sheet: &mut Sheet, rect: &Rect, borders: SheetBorders) -> SheetBorders {
    sheet.borders.set_rect(rect, borders)
}

#[cfg(test)]
pub fn set_rect_border_selection(
    sheet: &mut Sheet,
    rect: &Rect,
    selections: Vec<BorderSelection>,
    style: Option<BorderStyle>,
) -> SheetBorders {
    let borders = generate_borders(sheet, rect, selections, style);
    set_rect_borders(sheet, rect, borders)
}

pub fn get_rect_borders(sheet: &Sheet, rect: &Rect) -> SheetBorders {
    sheet.borders.get_rect(rect)
}

pub fn get_cell_borders_in_rect(sheet: &Sheet, rect: Rect) -> Vec<(i64, i64, Option<CellBorders>)> {
    let mut borders = vec![];
    let mut id_space_borders = sheet.borders().per_cell.to_owned();

    for (i, x) in rect.x_range().enumerate() {
        for (j, y) in rect.y_range().enumerate() {
            let border = id_space_borders.get_cell_border(Pos { x, y });
            borders.push((i as i64, j as i64, border));
        }
    }

    borders
}

#[derive(Serialize, Deserialize, Debug, Clone, Default, PartialEq)]
pub struct SheetBorders {
    pub per_cell: IdSpaceBorders,
    pub(super) render_lookup: GridSpaceBorders,
}

impl SheetBorders {
    pub fn new() -> Self {
        Self::default()
    }

    fn set_rect(&mut self, rect: &Rect, borders: SheetBorders) -> SheetBorders {
        let mut previous_borders = SheetBorders::default();

        let replaced_id_space = self.per_cell.replace_rect(&borders.per_cell, rect);
        previous_borders
            .per_cell
            .replace_rect(&replaced_id_space, rect);

        let replaced_grid_space = self
            .render_lookup
            .replace_rect(&borders.render_lookup, rect);
        previous_borders
            .render_lookup
            .replace_rect(&replaced_grid_space, rect);

        previous_borders
    }

    fn get_rect(&self, rect: &Rect) -> SheetBorders {
        let mut sheet_borders = SheetBorders::default();
        let cloned_id_space = self.per_cell.clone_rect(rect);
        sheet_borders.per_cell.replace_rect(&cloned_id_space, rect);
        sheet_borders
    }
}

#[derive(Debug, Clone, Default, PartialEq)]
pub struct IdSpaceBorders {
    pub borders: HashMap<i64, ColumnData<SameValue<CellBorders>>>,
}

impl Serialize for IdSpaceBorders {
    fn serialize<S>(&self, serializer: S) -> Result<S::Ok, S::Error>
    where
        S: serde::Serializer,
    {
        let map: HashMap<String, ColumnData<SameValue<CellBorders>>> = self
            .borders
            .iter()
            .map(|(id, idx)| (id.to_string(), idx.to_owned()))
            .collect();
        map.serialize(serializer)
    }
}

impl<'de> Deserialize<'de> for IdSpaceBorders {
    fn deserialize<D>(deserializer: D) -> Result<Self, D::Error>
    where
        D: serde::Deserializer<'de>,
    {
        let map =
            HashMap::<&'de str, ColumnData<SameValue<CellBorders>>>::deserialize(deserializer)?;
        let mut ret = IdSpaceBorders {
            borders: HashMap::new(),
        };
        for (k, v) in map {
            ret.borders.insert(k.parse::<i64>().unwrap(), v);
        }
        Ok(ret)
    }
}

impl IdSpaceBorders {
    fn clone_rect(&self, rect: &Rect) -> Self {
        let mut cloned = Self::default();
        cloned.replace_rect(self, rect);
        cloned
    }

    fn replace_rect(&mut self, source: &Self, rect: &Rect) -> Self {
        let mut previous = Self::default();
        for x in rect.x_range() {
            let replacement = source.clone_blocks(x, rect.y_range().clone());
            let dest_column = self.borders.entry(x).or_default();
            let previous_column = previous.borders.entry(x).or_default();

            let replaced = dest_column.clone_range(&replacement, rect.y_range());
            for old_block in replaced {
                previous_column.set_range(old_block.range(), old_block.content.value);
            }
        }
        previous
    }

    fn clone_blocks(&self, x: i64, range: Range<i64>) -> ColumnData<SameValue<CellBorders>> {
        let mut column = ColumnData::new();
        if let Some(source_column) = self.borders.get(&x) {
            column.clone_range(source_column, range);
        }
        column
    }

    fn set_horizontal_border(
        &mut self,
        columns: Range<i64>,
        row_index_above: i64,
        style: Option<BorderStyle>,
    ) {
        let row_index_below = row_index_above + 1;
        for x in columns {
            self.set_cell_border(
                Pos {
                    x,
                    y: row_index_above,
                },
                CellSide::Bottom,
                style,
            );
            self.set_cell_border(
                Pos {
                    x,
                    y: row_index_below,
                },
                CellSide::Top,
                style,
            );
        }
    }

    fn set_vertical_border(
        &mut self,
        column_left: Option<i64>,
        column_right: Option<i64>,
        rows: Range<i64>,
        style: Option<BorderStyle>,
    ) {
        for row_index in rows {
            if let Some(column_left) = column_left {
                self.set_cell_border(
                    Pos {
                        x: column_left,
                        y: row_index,
                    },
                    CellSide::Right,
                    style,
                );
            }
            if let Some(column_right) = column_right {
                self.set_cell_border(
                    Pos {
                        x: column_right,
                        y: row_index,
                    },
                    CellSide::Left,
                    style,
                );
            }
        }
    }

    pub fn set_cell_border(&mut self, pos: Pos, side: CellSide, style: Option<BorderStyle>) {
        let column_borders = self.borders.entry(pos.x).or_default();
        let new_borders = CellBorders::combine(column_borders.get(pos.y), side, style);

        if new_borders.is_empty() {
            column_borders.set(pos.y, None);
        } else {
            column_borders.set(pos.y, Some(new_borders));
        }
    }

    pub fn get_cell_border(&mut self, pos: Pos) -> Option<CellBorders> {
        let column_borders = self.borders.entry(pos.x).or_default();
        column_borders.get(pos.y)
    }
}

#[derive(Serialize, Deserialize, Debug, Clone, Default, PartialEq)]
pub struct GridSpaceBorders {
    pub(super) vertical: HashMap<i64, ColumnData<SameValue<BorderStyle>>>,
    pub(super) horizontal: HashMap<i64, ColumnData<SameValue<BorderStyle>>>,
}

impl GridSpaceBorders {
    fn clone_rect(&self, rect: &Rect) -> GridSpaceBorders {
        let mut cloned = Self::default();
        cloned.replace_rect(self, rect);
        cloned
    }

    fn replace_rect(&mut self, source: &Self, rect: &Rect) -> Self {
        let mut previous = Self::default();

        // Vertical borders
        for x in rect.x_range().chain([rect.x_range().end]) {
            if let Some(source_column) = source.vertical.get(&x) {
                let current_column = self.vertical.entry(x).or_default();
                let previous_column = previous.vertical.entry(x).or_default();

                let replaced_styles = current_column.clone_range(source_column, rect.y_range());
                for old_style in replaced_styles {
                    previous_column.set_range(old_style.range(), old_style.content.value);
                }
            }
        }

        // Horizontal
        for y in rect.y_range().chain([rect.y_range().end]) {
            if let Some(source_column) = source.horizontal.get(&y) {
                let current_column = self.horizontal.entry(y).or_default();
                let previous_column = previous.horizontal.entry(y).or_default();

                let replaced_styles = current_column.clone_range(source_column, rect.x_range());
                for old_style in replaced_styles {
                    previous_column.set_range(old_style.range(), old_style.content.value);
                }
            }
        }
        previous
    }

    fn set_vertical_border(&mut self, index: i64, y_range: Range<i64>, style: Option<BorderStyle>) {
        let column = self.vertical.entry(index).or_default();
        match style {
            Some(style) => column.set_range(y_range, style),
            None => column.remove_range(y_range),
        };
    }

    fn set_horizontal_border(
        &mut self,
        index: i64,
        x_range: Range<i64>,
        style: Option<BorderStyle>,
    ) {
        let row = self.horizontal.entry(index).or_default();
        match style {
            Some(style) => row.set_range(x_range, style),
            None => row.remove_range(x_range),
        };
    }
}

#[cfg(test)]
pub mod debug {
    #![allow(dead_code)]

    use crate::{Pos, Rect};

    use super::*;

    pub trait GetCellBorders {
        fn get_cell_borders(&self, pos: Pos) -> Option<CellBorders>;
    }

    impl GetCellBorders for SheetBorders {
        fn get_cell_borders(&self, pos: Pos) -> Option<CellBorders> {
            self.per_cell.get_cell_borders(pos)
        }
    }

    impl GetCellBorders for IdSpaceBorders {
        fn get_cell_borders(&self, pos: Pos) -> Option<CellBorders> {
            let column = self.borders.get(&pos.x);
            column.and_then(|column| column.get(pos.y))
        }
    }

    pub fn print_borders<T: GetCellBorders>(rect: Rect, sheet_borders: &T) {
        for row in rect.y_range() {
            print_tops(rect, sheet_borders, row);
            println!();
            print_middles(rect, sheet_borders, row);
            println!();
            print_bottoms(rect, sheet_borders, row);
            println!();
        }
    }

    fn print_tops<T: GetCellBorders>(rect: Rect, sheet_borders: &T, row: i64) {
        for col in rect.x_range() {
            let pos = Pos { x: col, y: row };
            let borders = sheet_borders.get_cell_borders(pos);
            if borders.is_some_and(|borders| borders.contains(&CellSide::Top)) {
                print!(" _____ ");
            } else {
                print!("       ");
            }
        }
    }

    fn print_middles<T: GetCellBorders>(rect: Rect, sheet_borders: &T, row: i64) {
        for col in rect.x_range() {
            let pos = Pos { x: col, y: row };
            let borders = sheet_borders.get_cell_borders(pos);
            if borders.is_some_and(|borders| borders.contains(&CellSide::Left)) {
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

    fn print_bottoms<T: GetCellBorders>(rect: Rect, sheet_borders: &T, row: i64) {
        for col in rect.x_range() {
            let pos = Pos { x: col, y: row };
            let borders = sheet_borders.get_cell_borders(pos);
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
    use debug::GetCellBorders;

    use crate::color::Rgba;
    use crate::grid::borders::style::CellBorderLine;
    use crate::grid::SheetId;
    use crate::{Pos, Rect};

    use super::*;

    /// Convenience for asserting expected borders more tersely
    macro_rules! assert_borders {
        ($sheet_borders: expr, $column_ids: expr, $cell: expr, None, $message: literal) => {
            let actual = $sheet_borders.get_cell_borders($cell);
            let expected = None;
            assert_eq!(actual, expected, $message);
        };
        ($sheet_borders: expr, $column_ids: expr, $cell: expr, $borders: tt, $message: literal) => {
            let actual = $sheet_borders.get_cell_borders($cell);
            let expected = Some(CellBorders::new(&$borders));
            assert_eq!(actual, expected, $message);
        };
    }

    /// Convenience for asserting exact borders; no other borders should exist
    macro_rules! assert_borders_eq {
        ($sheet_borders: expr, $column_ids: expr, $cell_borders: tt, $message: literal) => {
            for (cell, expected_borders) in &$cell_borders {
                let actual = $sheet_borders.get_cell_borders(*cell);
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

        let selection = vec![BorderSelection::All];

        let style = BorderStyle {
            color: Rgba::from_str("#000000").unwrap(),
            line: CellBorderLine::Line1,
        };

        let _prev_borders = set_rect_border_selection(&mut sheet, &rect, selection, Some(style));

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

        let selection = vec![BorderSelection::Outer];

        let style = BorderStyle {
            color: Rgba::from_str("#000000").unwrap(),
            line: CellBorderLine::Line1,
        };

        let _prev_borders = set_rect_border_selection(&mut sheet, &rect, selection, Some(style));

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

        let selection_1 = vec![BorderSelection::All];
        let selection_2 = vec![BorderSelection::All];

        let style = BorderStyle {
            color: Rgba::from_str("#000000").unwrap(),
            line: CellBorderLine::Line1,
        };

        let _prev_borders_1 =
            set_rect_border_selection(&mut sheet, &rect_1, selection_1, Some(style));

        let _prev_borders_2 = set_rect_border_selection(&mut sheet, &rect_2, selection_2, None);

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

        let selection_1 = vec![BorderSelection::All];
        let selection_2 = vec![BorderSelection::All];

        let style = BorderStyle {
            color: Rgba::from_str("#000000").unwrap(),
            line: CellBorderLine::Line1,
        };

        let _prev_borders_1 =
            set_rect_border_selection(&mut sheet, &rect_1, selection_1, Some(style));
        let prev_borders_2 = set_rect_border_selection(&mut sheet, &rect_2, selection_2, None);

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

        let selection_1 = vec![BorderSelection::All];
        let selection_2 = vec![BorderSelection::Horizontal];

        let style_1 = BorderStyle {
            color: Rgba::from_str("#000000").unwrap(),
            line: CellBorderLine::Line1,
        };
        let style_2 = BorderStyle {
            color: Rgba::from_str("#FFFFFF").unwrap(),
            line: CellBorderLine::Dotted,
        };

        let _prev_borders_1 =
            set_rect_border_selection(&mut sheet, &rect_1, selection_1, Some(style_1));

        let _prev_borders_2 =
            set_rect_border_selection(&mut sheet, &rect_2, selection_2, Some(style_2));

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

        let selection_1 = vec![BorderSelection::All];
        let selection_2 = vec![BorderSelection::Horizontal];

        let style_1 = BorderStyle {
            color: Rgba::from_str("#000000").unwrap(),
            line: CellBorderLine::Line1,
        };
        let style_2 = BorderStyle {
            color: Rgba::from_str("#FFFFFF").unwrap(),
            line: CellBorderLine::Dotted,
        };

        let _prev_borders_1 =
            set_rect_border_selection(&mut sheet, &rect_1, selection_1, Some(style_1));
        let prev_borders_2 =
            set_rect_border_selection(&mut sheet, &rect_2, selection_2, Some(style_2));

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
