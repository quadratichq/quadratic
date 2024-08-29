use borders_style::{BorderStyle, BorderStyleCell};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;

use crate::grid::{block::SameValue, ColumnData};

pub mod borders_set_get;
pub mod borders_style;

#[derive(Default, Serialize, Deserialize, Debug)]
pub struct Borders {
    // sheet-wide formatting
    pub(crate) all: BorderStyleCell,
    pub(crate) columns: HashMap<i64, BorderStyleCell>,
    pub(crate) rows: HashMap<i64, BorderStyleCell>,

    // cell-specific formatting
    pub(crate) top: HashMap<i64, ColumnData<SameValue<BorderStyle>>>,
    pub(crate) bottom: HashMap<i64, ColumnData<SameValue<BorderStyle>>>,

    // note, this ColumnData is actually horizontal
    pub(crate) left: HashMap<i64, ColumnData<SameValue<BorderStyle>>>,
    pub(crate) right: HashMap<i64, ColumnData<SameValue<BorderStyle>>>,
}
