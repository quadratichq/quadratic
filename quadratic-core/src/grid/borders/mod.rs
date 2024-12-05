//! This is deprecated from the old Borders format. We keep a subset of the old
//! code to convert files with old borders.

pub use crate::grid::sheet::borders::{BorderSelection, BorderStyle, CellBorderLine};
pub use cell::{CellBorders, CellSide};
pub use sheet::{IdSpaceBorders, SheetBorders};

mod cell;
mod sheet;
