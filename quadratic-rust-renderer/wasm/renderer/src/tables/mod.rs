//! Table rendering module.
//!
//! Handles rendering of data table headers (table name row and column headers).
//! This mirrors the TypeScript Tables/TableHeader implementation.

mod table_cache;
mod table_render_data;
mod table_rendering;

pub use table_cache::TableCache;
pub use table_render_data::TableRenderData;
pub use table_rendering::{build_table_meshes, render_tables};
