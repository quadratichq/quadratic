//! Shared core functionality for Quadratic.

#[macro_use]
pub mod util;

mod a1;
mod array_size;
mod cell_labels;
mod color;
mod copy_formats;
mod fills;
mod ids;
mod language;
mod messages;
mod pos;
mod rect;
mod ref_adjust;
mod renderer_constants;
pub mod serialization;
mod sheet_offsets;
mod sheet_rect;
mod test_util;

pub use a1::*;
pub use array_size::*;
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
pub use renderer_constants::*;
pub use sheet_offsets::*;
pub use sheet_rect::*;
pub use test_util::*;
