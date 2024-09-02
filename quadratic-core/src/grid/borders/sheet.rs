use std::collections::HashMap;
use std::ops::Range;

use serde::{Deserialize, Serialize};

use crate::border_style::BorderStyle;
use crate::grid::block::SameValue;
use crate::grid::borders::cell::{CellBorders, CellSide};
use crate::grid::ColumnData;
use crate::{Pos, Rect};

#[derive(Serialize, Deserialize, Debug, Clone, Default, PartialEq)]
pub struct SheetBorders {
    pub per_cell: IdSpaceBorders,
    pub render_lookup: GridSpaceBorders,
}

impl SheetBorders {
    fn get_rect(&self, rect: &Rect) -> SheetBorders {
        let mut sheet_borders = SheetBorders::default();
        let cloned_id_space = self.per_cell.clone_rect(rect);
        sheet_borders.per_cell.replace_rect(&cloned_id_space, rect);
        let cloned_render_lookup = self.render_lookup.clone_rect(rect);
        sheet_borders
            .render_lookup
            .replace_rect(&cloned_render_lookup, rect);
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

    pub fn try_get_cell_border(&self, pos: Pos) -> Option<CellBorders> {
        let column_borders = self.borders.get(&pos.x)?;
        column_borders.get(pos.y)
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
