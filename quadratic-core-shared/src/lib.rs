//! Shared types for quadratic-core and quadratic-rust-renderer communication.
//!
//! This crate provides lightweight, WASM-compatible types that are shared between
//! the core computation engine and the renderer. These types are optimized for
//! efficient binary serialization using bincode.

pub mod color;
pub mod constants;
pub mod formatting;
pub mod ids;
pub mod messages;
pub mod pos;
pub mod rect;
pub mod serialization;

// Re-export commonly used types at the crate root
pub use color::Rgba;
pub use constants::{CELL_SHEET_HEIGHT, CELL_SHEET_WIDTH};
pub use formatting::{CellAlign, CellVerticalAlign, CellWrap, NumericFormat, NumericFormatKind};
pub use ids::SheetId;
pub use messages::{CoreToRenderer, RendererToCore};
pub use pos::{Pos, SheetPos};
pub use rect::{Rect, SheetRect};
pub use serialization::{deserialize, serialize};
