use std::collections::HashMap;

use serde::{Deserialize, Serialize};

use crate::border_style::BorderStyle;
use crate::grid::block::SameValue;
use crate::grid::borders::cell::{CellBorders, CellSide};
use crate::grid::ColumnData;
use crate::Pos;

#[derive(Serialize, Deserialize, Debug, Clone, Default, PartialEq)]
pub struct SheetBorders {
    pub per_cell: IdSpaceBorders,
    pub render_lookup: GridSpaceBorders,
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
