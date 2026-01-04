//! Text rendering module
//!
//! Text layout is handled by the Layout Worker using CellLabel from quadratic-renderer-core.
//! The Render Worker receives pre-computed HashRenderData and renders it directly.
//!
//! This module re-exports the types needed for rendering.

pub mod emoji_sprites;
pub mod sprite_cache;

// A1 notation - use quadratic-core-shared's implementation
pub use quadratic_core_shared::column_name;

/// Convert row number to string (just the number itself)
#[inline]
pub fn row_name(row: i64) -> String {
    row.to_string()
}

// Hash constants and utilities from core
pub use quadratic_renderer_core::sheets::hash::{hash_key, VisibleHashBounds};
pub use emoji_sprites::EmojiSprites;

// Sprite cache for zoomed-out rendering
pub use sprite_cache::SpriteCacheManager;

// Re-export types from core that are actually used
pub use quadratic_renderer_core::{BitmapFonts, LabelMesh, TextAnchor, TextLabel};

// Re-export BitmapFont (used for font loading)
pub use quadratic_renderer_core::sheets::text::BitmapFont;
