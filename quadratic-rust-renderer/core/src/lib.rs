//! Quadratic Renderer Core
//!
//! Platform-agnostic rendering and layout engine for Quadratic spreadsheet.
//! This crate contains no WASM-specific code and can be used on any platform.
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
//! - `renderer-wasm`: Browser GPU rendering worker (WebGPU + WebGL2 via wgpu)
//! - `layout-wasm`: Browser layout worker
//! - `native`: Server-side rendering for thumbnails/exports

#![warn(rust_2018_idioms, clippy::semicolon_if_nothing_returned)]
#![allow(dead_code)] // Some scaffolding not yet used

// Core rendering abstractions
pub mod render_context;
pub mod primitives;

// Data and layout
pub mod layout;
pub mod render;
pub mod sheets;
pub mod tables;
pub mod types;
pub mod ui;
pub mod viewport;

// GPU backend (unified for native + WASM via wgpu)
#[cfg(feature = "wgpu")]
pub mod wgpu_backend;

pub mod font_loader;

// Console logger for WASM (uses browser console)
#[cfg(feature = "js")]
pub mod console_logger;

// Re-exports for convenience

// Core rendering
pub use render_context::{CommandBuffer, DrawCommand, RenderContext, RenderError, TextureId};
pub use primitives::{
    colors, from_hex, from_rgba, parse_color, parse_color_opt, Color, Lines, NativeLines, Rect,
    Rects, TextureInfo, TextureRegistry, DEFAULT_COLOR,
};

// Sheets and hashing
pub use sheets::{
    BitmapFonts, HorizontalLine, Sheet, Sheets, TextCache, TextCacheEntry, TextCacheKey, TextHash,
    VisibleHashBounds, render_horizontal_lines, render_text_hash,
};
pub use sheets::hash::{get_hash_coords, hash_key, HASH_HEIGHT, HASH_PADDING, HASH_WIDTH, SPRITE_SCALE_THRESHOLD};

// Layout and state
pub use layout::LayoutEngine;
pub use render::CoreState;

// Tables
pub use tables::{
    build_table_render_output, TableBounds, TableCache, TableData, TableOutline, TableOutlines,
    TableRenderOutput,
};

// Types (legacy, some may overlap with sheets::hash)
pub use types::{
    BorderLineStyle, CursorRenderData, EmojiSpriteData, FillBuffer,
    HashRenderData, HeadingsRenderData, HorizontalBorder, HorizontalLineData, LineBuffer,
    RenderBatch, SheetBorders, TableRenderData, TextBuffer, VerticalBorder,
};

// UI and viewport
pub use ui::UI;
pub use viewport::Viewport;

#[cfg(feature = "wgpu")]
pub use wgpu_backend::{WgpuBackend, WgpuRenderContext, WgpuRenderer};
