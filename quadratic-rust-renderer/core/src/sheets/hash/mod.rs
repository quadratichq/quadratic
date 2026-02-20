//! Spatial hashing for efficient rendering
//!
//! Cells are grouped into hash regions for:
//! - Visibility culling (check hundreds of hashes, not millions of cells)
//! - Incremental updates (only rebuild dirty hashes)
//! - Lazy loading (only load hashes within viewport + padding)
//! - Sprite caching (pre-render to texture when zoomed out)

mod coords;

pub use coords::{get_hash_coords, hash_key, VisibleHashBounds};
