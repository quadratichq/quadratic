pub use cell::{CellBorders, CellSide};
pub use legacy::{LegacyCellBorder, LegacyCellBorders};
pub use render::{get_render_horizontal_borders, get_render_vertical_borders};
pub use sheet::{
    generate_borders, generate_borders_full, get_cell_borders_in_rect, get_rect_borders,
    set_rect_borders, IdSpaceBorders, SheetBorders,
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
