//! The current selected cells in a sheet.

use crate::{Rect, grid::SheetId};
use serde::{Deserialize, Serialize};
use ts_rs::TS;

// mod selection_create;

/// **Deprecated** Nov 2024 in favor of [`crate::A1Selection`].
#[derive(Serialize, Deserialize, Debug, Clone, PartialEq, Eq, Hash, TS)]
pub struct OldSelection {
    pub sheet_id: SheetId,

    // cursor position
    pub x: i64,
    pub y: i64,

    pub rects: Option<Vec<Rect>>,
    pub rows: Option<Vec<i64>>,
    pub columns: Option<Vec<i64>>,
    pub all: bool,
}

impl Default for OldSelection {
    fn default() -> Self {
        OldSelection {
            sheet_id: SheetId::default(),
            x: 1,
            y: 1,
            rects: None,
            rows: None,
            columns: None,
            all: false,
        }
    }
}
