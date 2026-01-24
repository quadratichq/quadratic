//! Bitmap font for MSDF text rendering

use serde::{Deserialize, Serialize};
use std::collections::HashMap;

/// Frame rectangle in the texture atlas
#[derive(Debug, Clone, Copy, Serialize, Deserialize, Default)]
pub struct CharFrame {
    pub x: f32,
    pub y: f32,
    pub width: f32,
    pub height: f32,
}

/// Character data for a bitmap font
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BitmapChar {
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
    pub uvs: [f32; 8],

    /// Frame in the texture atlas
    #[serde(default)]
    pub frame: CharFrame,
}

/// Bitmap font for MSDF text rendering
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BitmapFont {
    /// Font name (e.g., "OpenSans", "OpenSans-Bold")
    pub font: String,

    /// Font size (atlas size the font was generated at)
    pub size: f32,

    /// Line height
    #[serde(alias = "lineHeight")]
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
    /// Get font name
    pub fn name(&self) -> &str {
        &self.font
    }

    /// Get font size
    pub fn size(&self) -> f32 {
        self.size
    }

    /// Get line height
    pub fn line_height(&self) -> f32 {
        self.line_height
    }

    /// Get character data
    pub fn get_char(&self, char_code: u32) -> Option<&BitmapChar> {
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

    /// Calculate scale factor for a target font size
    pub fn scale_for_size(&self, target_size: f32) -> f32 {
        target_size / self.size
    }

    /// Get all unique texture UIDs used by this font
    pub fn get_required_texture_uids(&self) -> Vec<u32> {
        let mut uids: Vec<u32> = self.chars.values().map(|c| c.texture_uid).collect();
        uids.sort();
        uids.dedup();
        uids
    }

    /// Check if this font matches a style
    pub fn matches(&self, bold: bool, italic: bool) -> bool {
        let name_lower = self.font.to_lowercase();
        let is_bold = name_lower.contains("bold");
        let is_italic = name_lower.contains("italic");
        is_bold == bold && is_italic == italic
    }
}

/// Collection of bitmap fonts indexed by name
#[derive(Debug, Clone, Default, Serialize, Deserialize)]
pub struct BitmapFonts {
    fonts: HashMap<String, BitmapFont>,
}

impl BitmapFonts {
    /// Create a new empty font collection
    pub fn new() -> Self {
        Self::default()
    }

    /// Add a font to the collection
    pub fn add(&mut self, font: BitmapFont) {
        self.fonts.insert(font.font.clone(), font);
    }

    /// Get a font by name
    pub fn get(&self, name: &str) -> Option<&BitmapFont> {
        self.fonts.get(name)
    }

    /// Get all loaded font names
    pub fn font_names(&self) -> Vec<&str> {
        self.fonts.keys().map(|s| s.as_str()).collect()
    }

    /// Check if the collection is empty
    pub fn is_empty(&self) -> bool {
        self.fonts.is_empty()
    }

    /// Count the number of fonts
    pub fn count(&self) -> usize {
        self.fonts.len()
    }

    /// Get default font (OpenSans or first available)
    pub fn default_font(&self) -> Option<&BitmapFont> {
        self.fonts
            .get("OpenSans")
            .or_else(|| self.fonts.values().next())
    }

    /// Get all unique texture UIDs required by all fonts
    pub fn get_required_texture_uids(&self) -> Vec<u32> {
        let mut uids: Vec<u32> = self
            .fonts
            .values()
            .flat_map(|f| f.get_required_texture_uids())
            .collect();
        uids.sort();
        uids.dedup();
        uids
    }

    /// Get the font name for a given style (OpenSans variants)
    pub fn get_font_name(bold: bool, italic: bool) -> String {
        let bold_str = if bold { "Bold" } else { "" };
        let italic_str = if italic { "Italic" } else { "" };
        let separator = if bold || italic { "-" } else { "" };
        format!("OpenSans{separator}{bold_str}{italic_str}")
    }

    /// Get a font matching the style
    pub fn get_font_for_style(&self, bold: bool, italic: bool) -> Option<&BitmapFont> {
        let name = Self::get_font_name(bold, italic);
        self.fonts.get(&name).or_else(|| self.default_font())
    }
}

// =============================================================================
// Character utilities
// =============================================================================

/// Extract char code from a character
pub fn extract_char_code(c: char) -> u32 {
    c as u32
}

/// Split text into characters
///
/// For now this is simple char iteration. In the future this could
/// handle grapheme clusters for proper emoji support.
pub fn split_text_to_characters(text: &str) -> Vec<char> {
    text.chars().collect()
}
