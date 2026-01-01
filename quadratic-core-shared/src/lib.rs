//! Shared core functionality for Quadratic.

#[macro_use]
pub mod util;

pub mod a1;
mod array_size;
mod bounds;
mod cell_labels;
pub mod color;
mod copy_formats;
mod fills;
mod ids;
mod language;
mod messages;
mod pos;
mod rect;
mod ref_adjust;
mod render_code_cell;
mod renderer_constants;
pub mod serialization;
pub mod sheet_offsets;
mod sheet_rect;
mod test_util;
mod viewport;

pub use a1::*;
pub use array_size::*;
pub use bounds::*;
pub use cell_labels::*;
pub use color::*;
pub use copy_formats::*;
pub use fills::*;
pub use ids::*;
pub use language::*;
pub use messages::*;
pub use pos::*;
pub use rect::*;
pub use ref_adjust::*;
pub use render_code_cell::*;
pub use renderer_constants::*;
pub use sheet_offsets::*;
pub use sheet_rect::*;
pub use test_util::*;
pub use viewport::*;
