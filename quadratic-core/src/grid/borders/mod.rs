pub use cell::{CellBorders, CellSide};
pub use legacy::{LegacyCellBorder, LegacyCellBorders};
pub use render::{get_render_horizontal_borders, get_render_vertical_borders};
pub use sheet::{
    generate_borders, get_cell_borders_in_rect, get_region_borders, set_region_borders,
    IdSpaceBorders, SheetBorders,
};
pub use style::{BorderSelection, BorderStyle, CellBorderLine};

#[cfg(test)]
pub use sheet::debug::print_borders;

mod cell;
mod compute_indices;
mod legacy;
mod render;
mod sheet;
mod style;
