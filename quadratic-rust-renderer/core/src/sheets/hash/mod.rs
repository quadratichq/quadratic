//! Spatial hashing for efficient rendering
//!
//! Cells are grouped into hash regions for:
//! - Visibility culling (check hundreds of hashes, not millions of cells)
//! - Incremental updates (only rebuild dirty hashes)
//! - Lazy loading (only load hashes within viewport + padding)
//! - Sprite caching (pre-render to texture when zoomed out)

mod constants;
mod coords;
mod text_hash;

pub use constants::{
    DEFAULT_CELL_HEIGHT, DEFAULT_CELL_WIDTH, HASH_HEIGHT, HASH_PADDING, HASH_WIDTH,
    MAX_TEXTURE_PAGES, MIN_SPRITE_DIMENSION, SPRITE_SCALE_THRESHOLD, SPRITE_TARGET_WIDTH,
};
pub use coords::{get_hash_coords, hash_key, VisibleHashBounds};
pub use text_hash::TextHash;
