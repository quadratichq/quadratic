use std::collections::{BTreeMap, HashMap};

use serde::{Deserialize, Serialize};

use super::block::SameValue;
use super::column::ColumnData;
use super::js_types::JsRenderBorder;
use super::legacy;
use crate::controller::Operation;
use crate::Pos;
use crate::Rect;

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct SheetBorders {
    /// Horizontal borders, stored transposed so that each `ColumnData` actually
    /// holds the data for one row.
    horizontal: BTreeMap<i64, ColumnData<SameValue<BorderType>>>,
    /// Vertical borders, stored normally so that each `ColumnData` holds data
    /// for one column.
    vertical: BTreeMap<i64, ColumnData<SameValue<BorderType>>>,
}
impl SheetBorders {
    pub fn new() -> Self {
        SheetBorders {
            horizontal: BTreeMap::new(),
            vertical: BTreeMap::new(),
        }
    }

    fn set_horizontal_border(&mut self, rect: Rect, border_type: &BorderType) {
        // The horizontal borders structure is transposed, so this code is
        // intentionally swapping X and Y everywhere.
        for y in rect.y_range() {
            self.horizontal
                .entry(y)
                .or_default()
                .set_range(rect.x_range(), border_type.clone());
        }
    }
    fn set_vertical_border(&mut self, rect: Rect, border_type: &BorderType) {
        for x in rect.x_range() {
            self.vertical
                .entry(x)
                .or_default()
                .set_range(rect.y_range(), border_type.clone());
        }
    }

    pub fn get_horizontal_borders(self, rect: Rect) -> Vec<Operation> {
        let operations: Vec<Operation> = Vec::new();
        // The horizontal borders structure is transposed, so this code is
        // intentionally swapping X and Y everywhere.
        for y in rect.y_range() {
            self.horizontal.range(rect.x_range()).for_each(|block| {
                let rect = Rect::new_span(Pos::new(y, block.start()), Pos::new(y, block.end()));

                operations.push(Operation::SetBorders { sheet_id: block.1., region: (), change_border: (), border_type: () })
            });
        }
    }



    pub fn set_borders(
        &mut self,
        region: Rect,
        change_border: BorderChange,
        border_type: BorderType,
    ) {
        match change_border {
            BorderChange::All => {
                self.set_horizontal_border(region, &border_type);
                self.set_vertical_border(region, &border_type);
            }
            BorderChange::Inside => {
                self.set_horizontal_border(
                    Rect::new_span(
                        Pos::new(region.min.x + 1, region.min.y),
                        Pos::new(region.max.x - 1, region.max.y),
                    ),
                    &border_type,
                );
                self.set_vertical_border(
                    Rect::new_span(
                        Pos::new(region.min.x, region.min.y + 1),
                        Pos::new(region.max.x, region.max.y - 1),
                    ),
                    &border_type,
                );
            }
            BorderChange::Outside => {}
            BorderChange::Horizontal => {}
            BorderChange::Vertical => {}
            BorderChange::Left => {}
            BorderChange::Top => {}
            BorderChange::Right => {}
            BorderChange::Bottom => {}
            BorderChange::Clear => {}
        }
    }

    pub fn get_render_horizontal_borders(&self) -> Vec<JsRenderBorder> {
        self.horizontal
            .iter()
            .flat_map(|(&y, row)| {
                row.blocks().map(move |block| JsRenderBorder {
                    x: block.start(),
                    y,
                    w: Some(block.len()),
                    h: None,
                    style: block.content().value.clone(),
                })
            })
            .collect()
    }
    pub fn get_render_vertical_borders(&self) -> Vec<JsRenderBorder> {
        self.vertical
            .iter()
            .flat_map(|(&x, column)| {
                column.blocks().map(move |block| JsRenderBorder {
                    x,
                    y: block.start(),
                    w: None,
                    h: Some(block.len()),
                    style: block.content().value.clone(),
                })
            })
            .collect()
    }

    pub fn export_to_js_file(&self) -> Vec<legacy::JsBorders> {
        let mut ret: HashMap<(i64, i64), CellBorders> = HashMap::new();
        for (&x, column) in &self.vertical {
            for (y, border) in column.values() {
                ret.entry((x, y)).or_default().h = Some(border);
            }
        }
        for (&y, row) in &self.horizontal {
            for (x, border) in row.values() {
                ret.entry((x, y)).or_default().v = Some(border);
            }
        }
        ret.into_iter()
            .map(|((x, y), CellBorders { h, v })| legacy::JsBorders {
                x,
                y,
                horizontal: h,
                vertical: v,
            })
            .collect()
    }
}

#[derive(Serialize, Deserialize, Debug, Default, Clone)]
#[cfg_attr(feature = "js", derive(ts_rs::TS))]
pub struct CellBorders {
    #[serde(skip_serializing_if = "Option::is_none")]
    pub h: Option<BorderType>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub v: Option<BorderType>,
}

#[derive(Serialize, Deserialize, Debug, Clone, PartialEq, Eq, Hash)]
#[cfg_attr(feature = "js", derive(ts_rs::TS))]
pub struct BorderType {
    #[serde(skip_serializing_if = "Option::is_none")]
    pub color: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none", rename = "type")]
    pub style: Option<CellBorderStyle>,
}
#[derive(Serialize, Deserialize, Debug, Copy, Clone, PartialEq, Eq, Hash)]
#[cfg_attr(feature = "js", derive(ts_rs::TS))]
#[serde(rename_all = "lowercase")]
pub enum CellBorderStyle {
    Line1,
    Line2,
    Line3,
    Dotted,
    Dashed,
    Double,
}

#[derive(Serialize, Deserialize, Debug, Clone, PartialEq, Eq, Hash)]
#[cfg_attr(feature = "js", derive(ts_rs::TS))]
#[serde(rename_all = "lowercase")]
pub enum BorderChange {
    All,
    Inside,
    Outside,
    Horizontal,
    Vertical,
    Left,
    Top,
    Right,
    Bottom,
    Clear,
}
