//! Quadratic Renderer Core
//!
//! Platform-agnostic rendering and layout engine for Quadratic spreadsheet.
//!
//! ## Architecture
//!
//! - `render_context`: Common rendering interface (RenderContext trait)
//! - `primitives`: Backend-agnostic drawing primitives (Rects, Lines, etc.)
//! - `types`: Shared data types (RenderBatch, buffers, etc.)
//! - `viewport`: Camera/viewport state and math
//! - `sheets`: Sheet data management (cells, fills, text)
//! - `ui`: UI elements (cursor, grid lines, headings)
//! - `layout`: Text layout and mesh generation
//! - `render`: Render state management
//! - `wgpu_backend`: GPU rendering via wgpu (optional)
//!
//! ## Usage
//!
//! The core library is used by:
//! - `native`: Server-side rendering for thumbnails/exports/screenshots

#![warn(rust_2018_idioms, clippy::semicolon_if_nothing_returned)]

// Core rendering abstractions
pub mod primitives;
pub mod render_context;

// Constants
pub mod constants;

// Data and layout
pub mod layout;
pub mod render;
pub mod sheets;
pub mod tables;
pub mod types;
pub mod ui;
pub mod viewport;

// GPU backend via wgpu
#[cfg(feature = "wgpu")]
pub mod wgpu_backend;

pub mod emoji_loader;
pub mod font_loader;
pub mod request;

// Re-exports for convenience

// Core rendering
pub use primitives::{
    colors, from_hex, from_rgba, parse_color, parse_color_opt, Color, LineScaling, Lines,
    NativeLines, Rect, Rects, TextureInfo, TextureRegistry, DEFAULT_COLOR,
};
pub use render_context::{CommandBuffer, DrawCommand, RenderContext, RenderError, TextureId};

// Sheets and hashing
pub use constants::{HASH_HEIGHT, HASH_PADDING, HASH_WIDTH, SPRITE_SCALE_THRESHOLD};
pub use sheets::hash::{get_hash_coords, hash_key};
pub use sheets::{
    render_horizontal_lines, render_text_hash, BitmapFonts, HorizontalLine, Sheet, Sheets,
    TextCache, TextCacheEntry, TextCacheKey, TextHash, VisibleHashBounds,
};

// Cell label layout
pub use sheets::text::{
    is_potential_emoji, CellLabel, EmojiCharData, EmojiLookup, LabelMesh, NoEmoji, TextVertex,
    CELL_TEXT_MARGIN_LEFT, CELL_VERTICAL_PADDING, DEFAULT_CELL_HEIGHT, DEFAULT_FONT_SIZE,
    LINE_HEIGHT, OPEN_SANS_FIX_X, OPEN_SANS_FIX_Y,
};

// Text label (UI text)
pub use sheets::text::{TextAnchor, TextLabel, HEADING_FONT_SIZE};

// Text hash (spatial hashing for text layout)
pub use sheets::text::hash_coords;

// Layout and state
pub use layout::{
    calculate_clip_bounds, calculate_clip_updates, ClipBoundsUpdate, LabelOverflowInfo,
    LayoutEngine,
};
pub use render::CoreState;

// Tables
pub use tables::{
    build_table_render_output, TableBounds, TableCache, TableData, TableOutline, TableOutlines,
    TableRenderOutput,
};

// Grid render request (shared by native and WASM)
pub use request::{
    build_render_request, ChartImage, GridExclusionZone, RenderRequest, SelectionRange,
    TableNameIcon,
};

// Types
pub use types::{
    // Color parsing for conditional formats
    parse_color as parse_color_to_rgba,
    BorderLineStyle,
    CursorRenderData,
    EmojiSpriteData,
    FillBuffer,
    // Re-exports from quadratic-core
    GridBounds,
    HashRenderData,
    HeadingsRenderData,
    HorizontalBorder,
    HorizontalLineData,
    LineBuffer,
    Pos,
    RenderBatch,
    // Render types with Rgba colors
    RenderCell,
    RenderCellFormatSpan,
    RenderCellLinkSpan,
    RenderCellSpecial,
    RenderCodeCell,
    RenderCodeCellState,
    RenderFill,
    SheetBorders,
    SheetBordersRender,
    SheetId,
    SheetOffsets,
    TableRenderData,
    TextBuffer,
    VerticalBorder,
};

// UI and viewport
pub use ui::{GridLines, GRID_LINE_COLOR, UI};
pub use viewport::Viewport;

#[cfg(feature = "wgpu")]
pub use wgpu_backend::{WgpuBackend, WgpuRenderContext, WgpuRenderer};
