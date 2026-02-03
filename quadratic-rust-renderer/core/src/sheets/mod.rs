//! Sheet data management
//!
//! This module manages sheet data including:
//! - Cell text and formatting
//! - Cell fills (backgrounds)
//! - Spatial hashing for efficient rendering
//! - Font management
//! - Platform-agnostic rendering via RenderContext

#[allow(clippy::module_inception)]
mod sheet;
#[allow(clippy::module_inception)]
mod sheets;

pub mod fills;
pub mod hash;
pub mod render;
pub mod text;

pub use sheet::Sheet;
pub use sheets::Sheets;

// Re-export commonly used hash types
pub use hash::{get_hash_coords, hash_key, VisibleHashBounds};

// Re-export TextHash from text module
pub use text::TextHash;

// Re-export commonly used text types
pub use text::{BitmapFonts, HorizontalLine, TextCache, TextCacheEntry, TextCacheKey};

// Re-export render functions
pub use render::{render_horizontal_lines, render_text_hash};
