//! Hash constants for spatial hashing
//!
//! These values define the size of spatial hash regions and rendering thresholds.

/// Columns per hash region
pub const HASH_WIDTH: i64 = 50;

/// Rows per hash region
pub const HASH_HEIGHT: i64 = 100;

/// Number of hashes to load beyond visible viewport (for preloading)
pub const HASH_PADDING: i64 = 1;

/// Default cell width in pixels
pub const DEFAULT_CELL_WIDTH: f32 = 100.0;

/// Default cell height in pixels
pub const DEFAULT_CELL_HEIGHT: f32 = 21.0;

/// Maximum texture pages supported for font atlases
/// With global texture ID scheme: fontIndex * 16 + localPageId
/// Supporting 4 fonts with up to 16 pages each = 64 max
pub const MAX_TEXTURE_PAGES: usize = 64;

/// Scale threshold below which we switch from MSDF text to sprite rendering.
///
/// When viewport_scale < SPRITE_SCALE_THRESHOLD, use pre-rendered sprite cache.
/// MSDF text handles 25-100% zoom; sprites handle <25% zoom.
///
/// At 25% zoom on 2x DPR, a 5000px hash displays at:
///   5000 * 0.25 * 2 = 2500 device pixels (manageable sprite size)
pub const SPRITE_SCALE_THRESHOLD: f32 = 0.25;

/// Target width for sprite cache textures.
/// Higher resolution = more GPU memory but sharper text when zoomed out.
pub const SPRITE_TARGET_WIDTH: u32 = 2048;

/// Minimum sprite dimension (don't create tiny textures)
pub const MIN_SPRITE_DIMENSION: u32 = 64;
