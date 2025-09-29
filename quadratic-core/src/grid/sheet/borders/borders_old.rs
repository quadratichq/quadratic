//! Supports Old borders types used by Operation::SetBordersSelection. Delete
//! when that Operation is removed.

use serde::{Deserialize, Serialize};
use std::collections::HashMap;

use crate::grid::block::SameValue;
use crate::grid::column::ColumnData;
use crate::{RunLengthEncoding, grid::sheet::borders::BorderStyleTimestamp};

use super::{BorderStyle, BorderStyleCell};

#[derive(Default, Serialize, Deserialize, Debug, Clone, PartialEq)]
pub struct OldBorders {
    // sheet-wide formatting
    pub(crate) all: BorderStyleCell,
    pub(crate) columns: HashMap<i64, BorderStyleCell>,
    pub(crate) rows: HashMap<i64, BorderStyleCell>,

    // cell-specific formatting (vertical) first key = x-coordinate; column-data key is y-coordinate
    pub(crate) left: HashMap<i64, ColumnData<SameValue<BorderStyleTimestamp>>>,
    pub(crate) right: HashMap<i64, ColumnData<SameValue<BorderStyleTimestamp>>>,

    // cell-specific formatting (horizontal); first key = y-coordinate; column-data key is x-coordinate
    pub(crate) top: HashMap<i64, ColumnData<SameValue<BorderStyleTimestamp>>>,
    pub(crate) bottom: HashMap<i64, ColumnData<SameValue<BorderStyleTimestamp>>>,
}

impl OldBorders {
    /// Sets the border for a cell. This is used in the upgrade_border for going
    /// from v1_6 to v1_7.
    pub(crate) fn set(
        &mut self,
        x: i64,
        y: i64,
        top: Option<BorderStyle>,
        bottom: Option<BorderStyle>,
        left: Option<BorderStyle>,
        right: Option<BorderStyle>,
    ) {
        if let Some(top) = top {
            self.top.entry(y).or_default().set(x, Some(top.into()));
        }
        if let Some(bottom) = bottom {
            self.bottom
                .entry(y)
                .or_default()
                .set(x, Some(bottom.into()));
        }
        if let Some(left) = left {
            self.left.entry(x).or_default().set(y, Some(left.into()));
        }
        if let Some(right) = right {
            self.right.entry(x).or_default().set(y, Some(right.into()));
        }
    }
}

pub type BorderStyleCellUpdates = RunLengthEncoding<BorderStyleCellUpdate>;

#[derive(Default, Serialize, Deserialize, Debug, Clone, Copy, PartialEq, Eq)]
pub struct BorderStyleCellUpdate {
    #[serde(
        default,
        skip_serializing_if = "Option::is_none",
        with = "::serde_with::rust::double_option"
    )]
    pub top: Option<Option<BorderStyleTimestamp>>,

    #[serde(
        default,
        skip_serializing_if = "Option::is_none",
        with = "::serde_with::rust::double_option"
    )]
    pub bottom: Option<Option<BorderStyleTimestamp>>,

    #[serde(
        default,
        skip_serializing_if = "Option::is_none",
        with = "::serde_with::rust::double_option"
    )]
    pub left: Option<Option<BorderStyleTimestamp>>,

    #[serde(
        default,
        skip_serializing_if = "Option::is_none",
        with = "::serde_with::rust::double_option"
    )]
    pub right: Option<Option<BorderStyleTimestamp>>,
}

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

#[derive(Serialize, Deserialize, Debug, Clone, Default, PartialEq)]
pub struct GridSpaceBorders {
    pub(super) vertical: HashMap<i64, ColumnData<SameValue<BorderStyle>>>,
    pub(super) horizontal: HashMap<i64, ColumnData<SameValue<BorderStyle>>>,
}

#[derive(Clone, Copy, Debug, PartialEq, Eq, Hash, Serialize, Deserialize)]
#[cfg_attr(feature = "js", derive(ts_rs::TS))]
#[serde(rename_all = "lowercase")]
#[repr(u8)]
pub enum CellSide {
    Left = 0,
    Top = 1,
    Right = 2,
    Bottom = 3,
}

#[derive(Serialize, Deserialize, Debug, Clone, PartialEq, Eq, Default, Copy)]
pub struct CellBorders {
    pub borders: [Option<BorderStyle>; 4],
}
