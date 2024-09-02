pub use crate::border_style::{BorderSelection, BorderStyle, CellBorderLine};
pub use cell::{CellBorders, CellSide};
pub use legacy::{LegacyCellBorder, LegacyCellBorders};
pub use sheet::{IdSpaceBorders, SheetBorders};

#[cfg(test)]
pub use sheet::debug::print_borders;

mod cell;
mod legacy;
mod sheet;
