//! Font types and manager trait
//!
//! Shared types for font management across rendering backends.
//! This provides a unified interface for managing bitmap fonts (MSDF)
//! and their associated textures.

use serde::{Deserialize, Serialize};
use std::collections::HashMap;

/// Unique identifier for a font texture page
pub type FontTextureId = u32;

/// Font texture metadata
#[derive(Debug, Clone, Copy)]
pub struct FontTextureInfo {
    /// Width in pixels
    pub width: u32,
    /// Height in pixels
    pub height: u32,
}

/// Character data for rendering
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BitmapChar {
    /// Texture UID (identifies which texture page this char is on)
    pub texture_uid: FontTextureId,

    /// Horizontal advance (how far to move for next character)
    pub x_advance: f32,

    /// X offset from cursor position
    pub x_offset: f32,

    /// Y offset from cursor position
    pub y_offset: f32,

    /// Original width of the character
    pub orig_width: f32,

    /// Height of the texture
    pub texture_height: f32,

    /// Kerning pairs (char code -> adjustment)
    pub kerning: HashMap<u32, f32>,

    /// UV coordinates [u0, v0, u1, v1, u2, v2, u3, v3] for the 4 corners
    pub uvs: [f32; 8],

    /// Frame in the texture atlas
    pub frame: CharFrame,
}

/// Frame rectangle in the texture atlas
#[derive(Debug, Clone, Copy, Serialize, Deserialize)]
pub struct CharFrame {
    pub x: f32,
    pub y: f32,
    pub width: f32,
    pub height: f32,
}

/// Bitmap font data
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BitmapFont {
    /// Font name (e.g., "OpenSans", "OpenSans-Bold")
    pub font: String,

    /// Font size the atlas was generated at
    pub size: f32,

    /// Line height
    pub line_height: f32,

    /// MSDF distance field range (typically 4)
    #[serde(default = "default_distance_range")]
    pub distance_range: f32,

    /// Character data indexed by char code
    pub chars: HashMap<u32, BitmapChar>,
}

fn default_distance_range() -> f32 {
    4.0
}

impl BitmapFont {
    /// Get character data for a char code
    pub fn get_char(&self, char_code: u32) -> Option<&BitmapChar> {
        self.chars.get(&char_code)
    }

    /// Calculate scale factor for a target font size
    pub fn scale_for_size(&self, target_size: f32) -> f32 {
        target_size / self.size
    }

    /// Get all unique texture UIDs used by this font
    pub fn get_required_texture_uids(&self) -> Vec<FontTextureId> {
        let mut uids: Vec<FontTextureId> = self.chars.values().map(|c| c.texture_uid).collect();
        uids.sort();
        uids.dedup();
        uids
    }
}

/// Backend-agnostic font manager
///
/// Stores font metadata and texture information.
/// Backend-specific texture handles are stored separately by each renderer.
#[derive(Default)]
pub struct FontManager {
    /// Fonts indexed by name
    fonts: HashMap<String, BitmapFont>,
    /// Texture metadata indexed by texture UID
    texture_info: HashMap<FontTextureId, FontTextureInfo>,
}

impl FontManager {
    /// Create a new empty font manager
    pub fn new() -> Self {
        Self {
            fonts: HashMap::new(),
            texture_info: HashMap::new(),
        }
    }

    /// Add a font to the collection
    pub fn add_font(&mut self, font: BitmapFont) {
        log::info!("Added font: {} with {} chars", font.font, font.chars.len());
        self.fonts.insert(font.font.clone(), font);
    }

    /// Get a font by name
    pub fn get_font(&self, name: &str) -> Option<&BitmapFont> {
        self.fonts.get(name)
    }

    /// Check if any fonts are loaded
    pub fn has_fonts(&self) -> bool {
        !self.fonts.is_empty()
    }

    /// Check if the font collection is empty
    pub fn is_empty(&self) -> bool {
        self.fonts.is_empty()
    }

    /// Get all unique texture UIDs required by all fonts
    pub fn get_required_texture_uids(&self) -> Vec<FontTextureId> {
        let mut uids: Vec<FontTextureId> = self
            .fonts
            .values()
            .flat_map(|f| f.get_required_texture_uids())
            .collect();
        uids.sort();
        uids.dedup();
        uids
    }

    /// Register a texture with its metadata
    pub fn register_texture(&mut self, texture_id: FontTextureId, width: u32, height: u32) {
        self.texture_info
            .insert(texture_id, FontTextureInfo { width, height });
    }

    /// Check if a texture is registered
    pub fn has_texture(&self, texture_id: FontTextureId) -> bool {
        self.texture_info.contains_key(&texture_id)
    }

    /// Get texture info by ID
    pub fn get_texture_info(&self, texture_id: FontTextureId) -> Option<FontTextureInfo> {
        self.texture_info.get(&texture_id).copied()
    }

    /// Unregister a texture
    pub fn unregister_texture(&mut self, texture_id: FontTextureId) -> bool {
        self.texture_info.remove(&texture_id).is_some()
    }

    /// Get the number of registered textures
    pub fn texture_count(&self) -> usize {
        self.texture_info.len()
    }

    /// Get the number of loaded fonts
    pub fn font_count(&self) -> usize {
        self.fonts.len()
    }

    /// Check if all required textures are loaded
    pub fn all_textures_loaded(&self) -> bool {
        if self.fonts.is_empty() {
            return false;
        }
        self.get_required_texture_uids()
            .iter()
            .all(|uid| self.texture_info.contains_key(uid))
    }

    /// Clear all fonts and texture registrations
    pub fn clear(&mut self) {
        self.fonts.clear();
        self.texture_info.clear();
    }

    /// Get the font name for a given style (OpenSans variants)
    pub fn get_font_name(bold: bool, italic: bool) -> String {
        let bold_str = if bold { "Bold" } else { "" };
        let italic_str = if italic { "Italic" } else { "" };
        let separator = if bold || italic { "-" } else { "" };
        format!("OpenSans{separator}{bold_str}{italic_str}")
    }
}

/// Extract char code from a character
pub fn extract_char_code(c: char) -> u32 {
    c as u32
}

/// Split text into characters (handles grapheme clusters for emoji)
pub fn split_text_to_characters(text: &str) -> Vec<char> {
    text.chars().collect()
}
