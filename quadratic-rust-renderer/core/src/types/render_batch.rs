//! Render batch types for Layout → Render worker communication
//!
//! The RenderBatch contains all pre-computed geometry for a single frame.
//! It's designed for efficient transfer via postMessage with Transferable buffers.

use bincode::{Decode, Encode};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;

use super::buffer_types::*;

/// Complete render data for one frame
///
/// This is the main data structure passed from Layout Worker to Render Worker.
/// All Vec<f32>/Vec<u32> fields can be transferred as ArrayBuffer for zero-copy.
#[derive(Debug, Clone, Default, Serialize, Deserialize, Encode, Decode)]
pub struct RenderBatch {
    /// Frame sequence number for ordering/debugging
    pub sequence: u64,

    /// Viewport info (for sprite cache decisions in render worker)
    pub viewport_scale: f32,
    pub viewport_x: f32,
    pub viewport_y: f32,
    pub viewport_width: f32,
    pub viewport_height: f32,

    /// Per-hash render data (text, fills, emoji)
    pub hashes: Vec<HashRenderData>,

    /// Grid lines
    pub grid_lines: Option<LineBuffer>,

    /// Cursor
    pub cursor: Option<CursorRenderData>,

    /// Headings (column/row headers)
    pub headings: Option<HeadingsRenderData>,

    /// Table headers
    pub tables: Vec<TableRenderData>,

    /// Meta fills (infinite row/column/sheet fills)
    pub meta_fills: Option<FillBuffer>,

    /// Background (in-bounds area)
    pub background: Option<FillBuffer>,
}

/// Pre-computed render data for a single hash region
#[derive(Default, Debug, Clone, Serialize, Deserialize, Encode, Decode)]
pub struct HashRenderData {
    pub hash_x: i64,
    pub hash_y: i64,

    /// World bounds for culling and sprite generation
    pub world_x: f32,
    pub world_y: f32,
    pub world_width: f32,
    pub world_height: f32,

    /// Text buffers grouped by (texture_uid, font_size)
    pub text_buffers: Vec<TextBuffer>,

    /// Fill rectangles
    pub fills: Option<FillBuffer>,

    /// Horizontal lines (underline/strikethrough) as triangles
    pub horizontal_lines: Option<FillBuffer>,

    /// Emoji sprite instances grouped by texture_uid
    pub emoji_sprites: HashMap<u32, Vec<EmojiSpriteData>>,

    /// Whether this hash's sprite cache needs regeneration
    pub sprite_dirty: bool,
}

impl HashRenderData {
    pub fn new(hash_x: i64, hash_y: i64) -> Self {
        Self {
            hash_x,
            hash_y,
            world_x: 0.0,
            world_y: 0.0,
            world_width: 0.0,
            world_height: 0.0,
            text_buffers: Vec::new(),
            fills: None,
            horizontal_lines: None,
            emoji_sprites: HashMap::new(),
            sprite_dirty: true,
        }
    }

    pub fn has_content(&self) -> bool {
        !self.text_buffers.is_empty() || self.fills.is_some() || !self.emoji_sprites.is_empty()
    }
}

/// Cursor render data
#[derive(Debug, Clone, Default, Serialize, Deserialize, Encode, Decode)]
pub struct CursorRenderData {
    /// Fill rectangles for selection
    pub fill: Option<FillBuffer>,
    /// Border rectangles
    pub border: Option<FillBuffer>,
}

/// Headings (column/row headers) render data
#[derive(Debug, Clone, Default, Serialize, Deserialize, Encode, Decode)]
pub struct HeadingsRenderData {
    /// Corner rectangle (top-left)
    pub corner: FillBuffer,
    /// Column header backgrounds
    pub column_bg: FillBuffer,
    /// Row header backgrounds
    pub row_bg: FillBuffer,
    /// Column header text
    pub column_text: Vec<TextBuffer>,
    /// Row header text
    pub row_text: Vec<TextBuffer>,
    /// Divider lines
    pub dividers: LineBuffer,
    /// Heading dimensions for viewport offset
    pub heading_width: f32,
    pub heading_height: f32,
}

/// Table header render data
#[derive(Debug, Clone, Default, Serialize, Deserialize, Encode, Decode)]
pub struct TableRenderData {
    /// Table position
    pub x: f32,
    pub y: f32,
    /// Name bar background
    pub name_bg: FillBuffer,
    /// Column header backgrounds
    pub column_bg: FillBuffer,
    /// Table outlines
    pub outlines: FillBuffer,
    /// Header separator lines
    pub header_lines: FillBuffer,
    /// Text meshes for name and column headers
    pub text: Vec<TextBuffer>,
}
