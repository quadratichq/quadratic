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
    first_font_name: Option<String>,
}

impl BitmapFonts {
    /// Create a new empty font collection
    pub fn new() -> Self {
        Self::default()
    }

    /// Add a font to the collection
    pub fn add(&mut self, font: BitmapFont) {
        if self.first_font_name.is_none() {
            self.first_font_name = Some(font.font.clone());
        }
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
        self.fonts.get("OpenSans").or_else(|| {
            self.first_font_name
                .as_ref()
                .and_then(|name| self.fonts.get(name))
        })
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

#[cfg(test)]
mod tests {
    use super::*;

    // =========================================================================
    // Helper functions
    // =========================================================================

    fn create_test_char_frame() -> CharFrame {
        CharFrame {
            x: 10.0,
            y: 20.0,
            width: 30.0,
            height: 40.0,
        }
    }

    fn create_test_bitmap_char(char_code: u32) -> BitmapChar {
        let mut kerning = HashMap::new();
        kerning.insert(char_code + 1, -2.0);
        kerning.insert(char_code + 2, 1.5);

        BitmapChar {
            texture_uid: 1,
            x_advance: 10.0,
            x_offset: 1.0,
            y_offset: 2.0,
            orig_width: 8.0,
            texture_height: 16.0,
            kerning,
            uvs: [0.0, 0.0, 1.0, 0.0, 1.0, 1.0, 0.0, 1.0],
            frame: create_test_char_frame(),
        }
    }

    fn create_test_font(name: &str, size: f32) -> BitmapFont {
        let mut chars = HashMap::new();
        chars.insert(b'A' as u32, create_test_bitmap_char(b'A' as u32));
        chars.insert(b'B' as u32, create_test_bitmap_char(b'B' as u32));

        BitmapFont {
            font: name.to_string(),
            size,
            line_height: size * 1.2,
            distance_range: 4.0,
            chars,
        }
    }

    // =========================================================================
    // CharFrame tests
    // =========================================================================

    #[test]
    fn test_char_frame_default() {
        let frame = CharFrame::default();
        assert_eq!(frame.x, 0.0);
        assert_eq!(frame.y, 0.0);
        assert_eq!(frame.width, 0.0);
        assert_eq!(frame.height, 0.0);
    }

    #[test]
    fn test_char_frame_clone() {
        let frame = create_test_char_frame();
        let cloned = frame;
        assert_eq!(cloned.x, 10.0);
        assert_eq!(cloned.y, 20.0);
        assert_eq!(cloned.width, 30.0);
        assert_eq!(cloned.height, 40.0);
    }

    #[test]
    fn test_char_frame_copy() {
        let frame1 = create_test_char_frame();
        let frame2 = frame1;
        assert_eq!(frame1.x, frame2.x);
        assert_eq!(frame1.y, frame2.y);
    }

    // =========================================================================
    // BitmapChar tests
    // =========================================================================

    #[test]
    fn test_bitmap_char_creation() {
        let char_data = create_test_bitmap_char(b'A' as u32);
        assert_eq!(char_data.texture_uid, 1);
        assert_eq!(char_data.x_advance, 10.0);
        assert_eq!(char_data.x_offset, 1.0);
        assert_eq!(char_data.y_offset, 2.0);
        assert_eq!(char_data.orig_width, 8.0);
        assert_eq!(char_data.texture_height, 16.0);
        assert_eq!(char_data.kerning.len(), 2);
    }

    #[test]
    fn test_bitmap_char_kerning() {
        let char_data = create_test_bitmap_char(b'A' as u32);
        assert_eq!(char_data.kerning.get(&(b'B' as u32)), Some(&-2.0));
        assert_eq!(char_data.kerning.get(&(b'C' as u32)), Some(&1.5));
    }

    #[test]
    fn test_bitmap_char_uvs() {
        let char_data = create_test_bitmap_char(b'A' as u32);
        assert_eq!(char_data.uvs.len(), 8);
        assert_eq!(char_data.uvs[0], 0.0);
        assert_eq!(char_data.uvs[7], 1.0);
    }

    // =========================================================================
    // BitmapFont tests
    // =========================================================================

    #[test]
    fn test_bitmap_font_name() {
        let font = create_test_font("OpenSans", 16.0);
        assert_eq!(font.name(), "OpenSans");
    }

    #[test]
    fn test_bitmap_font_size() {
        let font = create_test_font("OpenSans", 16.0);
        assert_eq!(font.size(), 16.0);
    }

    #[test]
    fn test_bitmap_font_line_height() {
        let font = create_test_font("OpenSans", 16.0);
        assert_eq!(font.line_height(), 19.2);
    }

    #[test]
    fn test_bitmap_font_get_char() {
        let font = create_test_font("OpenSans", 16.0);
        let char_a = font.get_char(b'A' as u32);
        assert!(char_a.is_some());
        assert_eq!(char_a.unwrap().x_advance, 10.0);

        let char_z = font.get_char(b'Z' as u32);
        assert!(char_z.is_none());
    }

    #[test]
    fn test_bitmap_font_get_kerning() {
        let font = create_test_font("OpenSans", 16.0);
        let kerning = font.get_kerning(b'A' as u32, b'B' as u32);
        assert_eq!(kerning, -2.0);

        let kerning_nonexistent = font.get_kerning(b'A' as u32, b'Z' as u32);
        assert_eq!(kerning_nonexistent, 0.0);

        let kerning_no_first_char = font.get_kerning(b'Z' as u32, b'A' as u32);
        assert_eq!(kerning_no_first_char, 0.0);
    }

    #[test]
    fn test_bitmap_font_scale_for_size() {
        let font = create_test_font("OpenSans", 16.0);
        assert_eq!(font.scale_for_size(32.0), 2.0);
        assert_eq!(font.scale_for_size(8.0), 0.5);
        assert_eq!(font.scale_for_size(16.0), 1.0);
    }

    #[test]
    fn test_bitmap_font_get_required_texture_uids() {
        let mut font = create_test_font("OpenSans", 16.0);
        let mut char_c = create_test_bitmap_char(b'C' as u32);
        char_c.texture_uid = 2;
        font.chars.insert(b'C' as u32, char_c);

        let uids = font.get_required_texture_uids();
        assert_eq!(uids.len(), 2);
        assert_eq!(uids[0], 1);
        assert_eq!(uids[1], 2);
    }

    #[test]
    fn test_bitmap_font_get_required_texture_uids_deduplicates() {
        let mut font = create_test_font("OpenSans", 16.0);
        let mut char_c = create_test_bitmap_char(b'C' as u32);
        char_c.texture_uid = 1;
        font.chars.insert(b'C' as u32, char_c);

        let uids = font.get_required_texture_uids();
        assert_eq!(uids.len(), 1);
        assert_eq!(uids[0], 1);
    }

    #[test]
    fn test_bitmap_font_matches() {
        let font_regular = create_test_font("OpenSans", 16.0);
        assert!(font_regular.matches(false, false));
        assert!(!font_regular.matches(true, false));
        assert!(!font_regular.matches(false, true));

        let font_bold = create_test_font("OpenSans-Bold", 16.0);
        assert!(font_bold.matches(true, false));
        assert!(!font_bold.matches(false, false));
        assert!(!font_bold.matches(true, true));

        let font_italic = create_test_font("OpenSans-Italic", 16.0);
        assert!(font_italic.matches(false, true));
        assert!(!font_italic.matches(false, false));
        assert!(!font_italic.matches(true, true));

        let font_bold_italic = create_test_font("OpenSans-Bold-Italic", 16.0);
        assert!(font_bold_italic.matches(true, true));
        assert!(!font_bold_italic.matches(false, false));
        assert!(!font_bold_italic.matches(true, false));
        assert!(!font_bold_italic.matches(false, true));
    }

    #[test]
    fn test_bitmap_font_matches_case_insensitive() {
        let font_lowercase = create_test_font("opensans-bold", 16.0);
        assert!(font_lowercase.matches(true, false));

        let font_mixed = create_test_font("OpEnSaNs-BoLd", 16.0);
        assert!(font_mixed.matches(true, false));
    }

    #[test]
    fn test_bitmap_font_default_distance_range() {
        let font = create_test_font("OpenSans", 16.0);
        assert_eq!(font.distance_range, 4.0);
    }

    // =========================================================================
    // BitmapFonts tests
    // =========================================================================

    #[test]
    fn test_bitmap_fonts_new() {
        let fonts = BitmapFonts::new();
        assert!(fonts.is_empty());
        assert_eq!(fonts.count(), 0);
    }

    #[test]
    fn test_bitmap_fonts_default() {
        let fonts = BitmapFonts::default();
        assert!(fonts.is_empty());
    }

    #[test]
    fn test_bitmap_fonts_add() {
        let mut fonts = BitmapFonts::new();
        let font = create_test_font("OpenSans", 16.0);
        fonts.add(font);

        assert!(!fonts.is_empty());
        assert_eq!(fonts.count(), 1);
    }

    #[test]
    fn test_bitmap_fonts_add_multiple() {
        let mut fonts = BitmapFonts::new();
        fonts.add(create_test_font("OpenSans", 16.0));
        fonts.add(create_test_font("OpenSans-Bold", 16.0));
        fonts.add(create_test_font("OpenSans-Italic", 16.0));

        assert_eq!(fonts.count(), 3);
    }

    #[test]
    fn test_bitmap_fonts_get() {
        let mut fonts = BitmapFonts::new();
        let font = create_test_font("OpenSans", 16.0);
        fonts.add(font);

        let retrieved = fonts.get("OpenSans");
        assert!(retrieved.is_some());
        assert_eq!(retrieved.unwrap().name(), "OpenSans");

        let not_found = fonts.get("NonExistent");
        assert!(not_found.is_none());
    }

    #[test]
    fn test_bitmap_fonts_font_names() {
        let mut fonts = BitmapFonts::new();
        fonts.add(create_test_font("OpenSans", 16.0));
        fonts.add(create_test_font("OpenSans-Bold", 16.0));

        let names = fonts.font_names();
        assert_eq!(names.len(), 2);
        assert!(names.contains(&"OpenSans"));
        assert!(names.contains(&"OpenSans-Bold"));
    }

    #[test]
    fn test_bitmap_fonts_is_empty() {
        let mut fonts = BitmapFonts::new();
        assert!(fonts.is_empty());

        fonts.add(create_test_font("OpenSans", 16.0));
        assert!(!fonts.is_empty());
    }

    #[test]
    fn test_bitmap_fonts_count() {
        let mut fonts = BitmapFonts::new();
        assert_eq!(fonts.count(), 0);

        fonts.add(create_test_font("OpenSans", 16.0));
        assert_eq!(fonts.count(), 1);

        fonts.add(create_test_font("OpenSans-Bold", 16.0));
        assert_eq!(fonts.count(), 2);
    }

    #[test]
    fn test_bitmap_fonts_default_font_opensans() {
        let mut fonts = BitmapFonts::new();
        fonts.add(create_test_font("OpenSans", 16.0));
        fonts.add(create_test_font("OtherFont", 16.0));

        let default = fonts.default_font();
        assert!(default.is_some());
        assert_eq!(default.unwrap().name(), "OpenSans");
    }

    #[test]
    fn test_bitmap_fonts_default_font_first_available() {
        let mut fonts = BitmapFonts::new();
        fonts.add(create_test_font("OtherFont", 16.0));
        fonts.add(create_test_font("AnotherFont", 16.0));

        let default = fonts.default_font();
        assert!(default.is_some());
        assert_eq!(default.unwrap().name(), "OtherFont");
    }

    #[test]
    fn test_bitmap_fonts_default_font_empty() {
        let fonts = BitmapFonts::new();
        let default = fonts.default_font();
        assert!(default.is_none());
    }

    #[test]
    fn test_bitmap_fonts_get_required_texture_uids() {
        let mut fonts = BitmapFonts::new();
        let mut font1 = create_test_font("Font1", 16.0);
        let mut char_c = create_test_bitmap_char(b'C' as u32);
        char_c.texture_uid = 2;
        font1.chars.insert(b'C' as u32, char_c);
        fonts.add(font1);

        let mut font2 = create_test_font("Font2", 16.0);
        let mut char_d = create_test_bitmap_char(b'D' as u32);
        char_d.texture_uid = 3;
        font2.chars.insert(b'D' as u32, char_d);
        fonts.add(font2);

        let uids = fonts.get_required_texture_uids();
        assert_eq!(uids.len(), 3);
        assert_eq!(uids[0], 1);
        assert_eq!(uids[1], 2);
        assert_eq!(uids[2], 3);
    }

    #[test]
    fn test_bitmap_fonts_get_required_texture_uids_deduplicates() {
        let mut fonts = BitmapFonts::new();
        fonts.add(create_test_font("Font1", 16.0));
        fonts.add(create_test_font("Font2", 16.0));

        let uids = fonts.get_required_texture_uids();
        assert_eq!(uids.len(), 1);
        assert_eq!(uids[0], 1);
    }

    #[test]
    fn test_bitmap_fonts_get_font_name() {
        assert_eq!(BitmapFonts::get_font_name(false, false), "OpenSans");
        assert_eq!(BitmapFonts::get_font_name(true, false), "OpenSans-Bold");
        assert_eq!(BitmapFonts::get_font_name(false, true), "OpenSans-Italic");
        assert_eq!(
            BitmapFonts::get_font_name(true, true),
            "OpenSans-BoldItalic"
        );
    }

    #[test]
    fn test_bitmap_fonts_get_font_for_style() {
        let mut fonts = BitmapFonts::new();
        fonts.add(create_test_font("OpenSans", 16.0));
        fonts.add(create_test_font("OpenSans-Bold", 16.0));
        fonts.add(create_test_font("OpenSans-Italic", 16.0));
        fonts.add(create_test_font("OpenSans-BoldItalic", 16.0));

        let regular = fonts.get_font_for_style(false, false);
        assert!(regular.is_some());
        assert_eq!(regular.unwrap().name(), "OpenSans");

        let bold = fonts.get_font_for_style(true, false);
        assert!(bold.is_some());
        assert_eq!(bold.unwrap().name(), "OpenSans-Bold");

        let italic = fonts.get_font_for_style(false, true);
        assert!(italic.is_some());
        assert_eq!(italic.unwrap().name(), "OpenSans-Italic");

        let bold_italic = fonts.get_font_for_style(true, true);
        assert!(bold_italic.is_some());
        assert_eq!(bold_italic.unwrap().name(), "OpenSans-BoldItalic");
    }

    #[test]
    fn test_bitmap_fonts_get_font_for_style_fallback() {
        let mut fonts = BitmapFonts::new();
        fonts.add(create_test_font("OpenSans", 16.0));

        let bold = fonts.get_font_for_style(true, false);
        assert!(bold.is_some());
        assert_eq!(bold.unwrap().name(), "OpenSans");
    }

    #[test]
    fn test_bitmap_fonts_get_font_for_style_no_fonts() {
        let fonts = BitmapFonts::new();
        let font = fonts.get_font_for_style(false, false);
        assert!(font.is_none());
    }

    // =========================================================================
    // Utility function tests
    // =========================================================================

    #[test]
    fn test_extract_char_code() {
        assert_eq!(extract_char_code('A'), 65);
        assert_eq!(extract_char_code('a'), 97);
        assert_eq!(extract_char_code('0'), 48);
        assert_eq!(extract_char_code(' '), 32);
        assert_eq!(extract_char_code('€'), 8364);
    }

    #[test]
    fn test_split_text_to_characters() {
        let chars = split_text_to_characters("Hello");
        assert_eq!(chars.len(), 5);
        assert_eq!(chars[0], 'H');
        assert_eq!(chars[1], 'e');
        assert_eq!(chars[2], 'l');
        assert_eq!(chars[3], 'l');
        assert_eq!(chars[4], 'o');
    }

    #[test]
    fn test_split_text_to_characters_empty() {
        let chars = split_text_to_characters("");
        assert_eq!(chars.len(), 0);
    }

    #[test]
    fn test_split_text_to_characters_unicode() {
        let chars = split_text_to_characters("Hello 世界");
        assert_eq!(chars.len(), 8);
        assert_eq!(chars[5], ' ');
        assert_eq!(chars[6], '世');
        assert_eq!(chars[7], '界');
    }
}
