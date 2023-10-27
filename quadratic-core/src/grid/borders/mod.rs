pub use cell::{CellBorders, CellSide};
pub use legacy::{LegacyCellBorder, LegacyCellBorders};
pub use render::{get_render_horizontal_borders, get_render_vertical_borders};
pub use sheet::{generate_borders, set_region_borders, SheetBorders};
pub use style::{BorderSelection, BorderStyle, CellBorderLine};

mod cell;
mod compute_indices;
mod legacy;
mod render;
mod sheet;
mod style;
