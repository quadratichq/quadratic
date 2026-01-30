//! Shared constants for layout and rendering

/// Hash dimensions (matches client: CellsTypes.ts and core: renderer_constants.rs)
pub const HASH_WIDTH: i64 = 50; // columns per hash
pub const HASH_HEIGHT: i64 = 100; // rows per hash

/// Cell dimensions in pixels (default)
pub const DEFAULT_CELL_WIDTH: f32 = 100.0;
pub const DEFAULT_CELL_HEIGHT: f32 = 21.0;

/// Number of hashes to load beyond the visible viewport (for preloading)
pub const HASH_PADDING: i64 = 1;

/// Scale threshold below which we switch from MSDF text to sprite rendering.
/// When viewport_scale < SPRITE_SCALE_THRESHOLD, use the cached sprite.
/// 0.5 means sprite rendering activates when zoomed out to 50% or less.
pub const SPRITE_SCALE_THRESHOLD: f32 = 0.5;
