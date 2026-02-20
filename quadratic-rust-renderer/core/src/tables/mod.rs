//! Table (code cell output) rendering
//!
//! Tables are code cell outputs that display data in a grid format.
//! This module handles:
//! - Table data structures (bounds, render data)
//! - Table caching for efficient lookup
//! - Platform-agnostic rendering via RenderContext

mod bounds;
mod cache;
mod render;
mod table_data;
mod table_outline;

pub use bounds::TableBounds;
pub use cache::TableCache;
pub use render::{build_table_render_output, TableRenderOutput};
pub use table_data::TableData;
pub use table_outline::{TableOutline, TableOutlines};

// Table colors (matches CSS theme)

/// Primary color for active tables (matches CSS --primary)
pub const TABLE_PRIMARY_COLOR: [f32; 4] = [0.141, 0.388, 0.922, 1.0];

/// Muted color for inactive tables
pub const TABLE_MUTED_COLOR: [f32; 4] = [0.392, 0.439, 0.533, 1.0];

/// White color for column header backgrounds
pub const TABLE_WHITE: [f32; 4] = [1.0, 1.0, 1.0, 1.0];

/// White text color (for table name on colored background)
pub const TABLE_WHITE_TEXT: [f32; 4] = [1.0, 1.0, 1.0, 1.0];

/// Foreground text color for column headers
pub const TABLE_FOREGROUND_TEXT: [f32; 4] = [0.008, 0.031, 0.090, 1.0];
