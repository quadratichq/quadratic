mod cell;
mod compute_indices;
mod legacy;
mod render;
mod sheet;
mod style;

pub use legacy::{LegacyCellBorder, LegacyCellBorders};
pub use render::get_render_vertical_borders;
pub use sheet::{generate_sheet_borders, set_region_borders, SheetBorders};
pub use style::{BorderSelection, BorderStyle, CellBorderLine};
