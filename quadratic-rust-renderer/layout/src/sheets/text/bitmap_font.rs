//! Bitmap font metrics for text layout
//!
//! This module handles font metrics for layout. The format matches the JSON
//! produced by the TypeScript font loader (parseBMFontXML).

use serde::{Deserialize, Serialize};
use std::collections::HashMap;

/// Character frame in the texture atlas
#[derive(Debug, Clone, Copy, Serialize, Deserialize)]
pub struct CharFrame {
    pub x: f32,
    pub y: f32,
    pub width: f32,
    pub height: f32,
}

/// Character data from bitmap font (matches TypeScript BitmapChar)
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CharData {
    /// Texture UID (identifies which texture page this char is on)
    pub texture_uid: u32,

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
    #[serde(default)]
    pub kerning: HashMap<u32, f32>,

    /// UV coordinates [u0, v0, u1, v1, u2, v2, u3, v3] for the 4 corners
    #[serde(default)]
    pub uvs: Vec<f32>,

    /// Frame in the texture atlas
    pub frame: CharFrame,
}

/// Bitmap font definition (matches TypeScript BitmapFontJson)
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

    /// Character data indexed by char code (as number key in JSON)
    pub chars: HashMap<u32, CharData>,
}

fn default_distance_range() -> f32 {
    4.0
}

impl BitmapFont {
    /// Get the font name
    pub fn name(&self) -> &str {
        &self.font
    }

    /// Get character data by char code
    pub fn get_char(&self, char_code: u32) -> Option<&CharData> {
        self.chars.get(&char_code)
    }

    /// Get kerning between two characters
    pub fn get_kerning(&self, first: u32, second: u32) -> f32 {
        self.chars
            .get(&first)
            .and_then(|c| c.kerning.get(&second))
            .copied()
            .unwrap_or(0.0)
    }

    /// Get line height
    pub fn line_height(&self) -> f32 {
        self.line_height
    }

    /// Calculate scale factor for a target font size
    pub fn scale_for_size(&self, target_size: f32) -> f32 {
        target_size / self.size
    }
}

/// Collection of bitmap fonts
#[derive(Default)]
pub struct BitmapFonts {
    fonts: HashMap<String, BitmapFont>,
    font_indices: HashMap<String, usize>,
    next_index: usize,
}

impl BitmapFonts {
    pub fn new() -> Self {
        Self::default()
    }

    /// Add a font
    pub fn add(&mut self, font: BitmapFont) {
        let name = font.font.clone();
        let index = self.next_index;
        self.next_index += 1;
        self.font_indices.insert(name.clone(), index);
        self.fonts.insert(name, font);
    }

    /// Get a font by name
    pub fn get(&self, name: &str) -> Option<&BitmapFont> {
        self.fonts.get(name)
    }

    /// Get font index for texture UID calculation
    pub fn font_index(&self, name: &str) -> Option<usize> {
        self.font_indices.get(name).copied()
    }

    pub fn is_empty(&self) -> bool {
        self.fonts.is_empty()
    }

    /// Count the number of fonts
    pub fn count(&self) -> usize {
        self.fonts.len()
    }

    /// Get default font (OpenSans or first available)
    pub fn default_font(&self) -> Option<&BitmapFont> {
        self.fonts.get("OpenSans").or_else(|| self.fonts.values().next())
    }

    /// Get font name for a given style
    pub fn get_font_name(bold: bool, italic: bool) -> String {
        let bold_str = if bold { "Bold" } else { "" };
        let italic_str = if italic { "Italic" } else { "" };
        let separator = if bold || italic { "-" } else { "" };
        format!("OpenSans{separator}{bold_str}{italic_str}")
    }
}
