//! Font manager for bitmap fonts

use super::BitmapFont;

/// Manages loaded bitmap fonts
pub struct FontManager {
    /// Loaded fonts
    fonts: Vec<BitmapFont>,
}

impl FontManager {
    pub fn new() -> Self {
        Self { fonts: Vec::new() }
    }

    /// Add a font
    pub fn add(&mut self, font: BitmapFont) {
        log::debug!("FontManager: Adding font '{}'", font.name());
        self.fonts.push(font);
    }

    /// Check if any fonts are loaded
    pub fn has_fonts(&self) -> bool {
        !self.fonts.is_empty()
    }

    /// Get number of fonts
    pub fn font_count(&self) -> usize {
        self.fonts.len()
    }

    /// Get a font by style
    pub fn get_font(&self, bold: bool, italic: bool) -> Option<&BitmapFont> {
        // First try exact match
        if let Some(font) = self.fonts.iter().find(|f| f.matches(bold, italic)) {
            return Some(font);
        }

        // Fall back to regular font
        self.fonts.first()
    }

    /// Get the default font (regular)
    pub fn default_font(&self) -> Option<&BitmapFont> {
        self.get_font(false, false)
    }

    /// Get atlas font size (from first font)
    pub fn atlas_font_size(&self) -> f32 {
        self.fonts.first().map(|f| f.size()).unwrap_or(14.0)
    }

    /// Get all required texture UIDs
    pub fn required_texture_uids(&self) -> Vec<u32> {
        self.fonts
            .iter()
            .flat_map(|f| f.get_required_texture_uids())
            .collect()
    }
}

impl Default for FontManager {
    fn default() -> Self {
        Self::new()
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::collections::HashMap;

    fn create_test_font(name: &str) -> BitmapFont {
        BitmapFont {
            font: name.to_string(),
            size: 32.0,
            line_height: 36.0,
            distance_range: 4.0,
            chars: HashMap::new(),
        }
    }

    #[test]
    fn test_font_manager_new() {
        let manager = FontManager::new();
        assert!(!manager.has_fonts());
        assert_eq!(manager.font_count(), 0);
    }

    #[test]
    fn test_font_manager_default() {
        let manager = FontManager::default();
        assert!(!manager.has_fonts());
    }

    #[test]
    fn test_add_font() {
        let mut manager = FontManager::new();
        let font = create_test_font("TestFont");

        manager.add(font);

        assert!(manager.has_fonts());
        assert_eq!(manager.font_count(), 1);
    }

    #[test]
    fn test_add_multiple_fonts() {
        let mut manager = FontManager::new();
        manager.add(create_test_font("Regular"));
        manager.add(create_test_font("Bold"));
        manager.add(create_test_font("Italic"));

        assert_eq!(manager.font_count(), 3);
    }

    #[test]
    fn test_get_font_regular() {
        let mut manager = FontManager::new();
        manager.add(create_test_font("OpenSans"));

        let font = manager.get_font(false, false);
        assert!(font.is_some());
    }

    #[test]
    fn test_get_font_bold() {
        let mut manager = FontManager::new();
        manager.add(create_test_font("OpenSans"));
        manager.add(create_test_font("OpenSans-Bold"));

        let font = manager.get_font(true, false);
        assert!(font.is_some());
        assert!(font.unwrap().name().contains("Bold"));
    }

    #[test]
    fn test_get_font_italic() {
        let mut manager = FontManager::new();
        manager.add(create_test_font("OpenSans"));
        manager.add(create_test_font("OpenSans-Italic"));

        let font = manager.get_font(false, true);
        assert!(font.is_some());
        assert!(font.unwrap().name().contains("Italic"));
    }

    #[test]
    fn test_get_font_fallback() {
        let mut manager = FontManager::new();
        manager.add(create_test_font("Regular"));

        // Requesting bold but only regular available - should fallback
        let font = manager.get_font(true, false);
        assert!(font.is_some());
        assert_eq!(font.unwrap().name(), "Regular");
    }

    #[test]
    fn test_get_font_empty() {
        let manager = FontManager::new();
        assert!(manager.get_font(false, false).is_none());
    }

    #[test]
    fn test_default_font() {
        let mut manager = FontManager::new();
        manager.add(create_test_font("TestFont"));

        let font = manager.default_font();
        assert!(font.is_some());
    }

    #[test]
    fn test_default_font_empty() {
        let manager = FontManager::new();
        assert!(manager.default_font().is_none());
    }

    #[test]
    fn test_atlas_font_size() {
        let mut manager = FontManager::new();

        // Default when no fonts
        assert_eq!(manager.atlas_font_size(), 14.0);

        manager.add(create_test_font("TestFont"));
        assert_eq!(manager.atlas_font_size(), 32.0); // From our test font
    }

    #[test]
    fn test_required_texture_uids_empty() {
        let manager = FontManager::new();
        assert!(manager.required_texture_uids().is_empty());
    }

    #[test]
    fn test_required_texture_uids() {
        use super::super::bitmap_font::{BitmapChar, CharFrame};

        let mut manager = FontManager::new();

        let mut chars = HashMap::new();
        chars.insert(
            65,
            BitmapChar {
                texture_uid: 1,
                x_advance: 10.0,
                x_offset: 0.0,
                y_offset: 0.0,
                orig_width: 10.0,
                texture_height: 32.0,
                kerning: HashMap::new(),
                uvs: [0.0; 8],
                frame: CharFrame::default(),
            },
        );
        chars.insert(
            66,
            BitmapChar {
                texture_uid: 2,
                x_advance: 10.0,
                x_offset: 0.0,
                y_offset: 0.0,
                orig_width: 10.0,
                texture_height: 32.0,
                kerning: HashMap::new(),
                uvs: [0.0; 8],
                frame: CharFrame::default(),
            },
        );

        let font = BitmapFont {
            font: "TestFont".to_string(),
            size: 32.0,
            line_height: 36.0,
            distance_range: 4.0,
            chars,
        };

        manager.add(font);

        let uids = manager.required_texture_uids();
        assert!(uids.contains(&1));
        assert!(uids.contains(&2));
    }

    #[test]
    fn test_get_font_bold_italic() {
        let mut manager = FontManager::new();
        manager.add(create_test_font("OpenSans"));
        manager.add(create_test_font("OpenSans-Bold"));
        manager.add(create_test_font("OpenSans-Italic"));
        manager.add(create_test_font("OpenSans-BoldItalic"));

        let font = manager.get_font(true, true);
        assert!(font.is_some());
        assert!(font.unwrap().name().contains("Bold"));
        assert!(font.unwrap().name().contains("Italic"));
    }

    #[test]
    fn test_get_font_case_insensitive() {
        let mut manager = FontManager::new();
        manager.add(create_test_font("OpenSans"));
        manager.add(create_test_font("OpenSans-BOLD"));
        manager.add(create_test_font("OpenSans-italic"));

        let bold_font = manager.get_font(true, false);
        assert!(bold_font.is_some());
        assert!(bold_font.unwrap().name().contains("BOLD"));

        let italic_font = manager.get_font(false, true);
        assert!(italic_font.is_some());
        assert!(italic_font.unwrap().name().contains("italic"));
    }

    #[test]
    fn test_get_font_first_match_wins() {
        let mut manager = FontManager::new();
        manager.add(create_test_font("First-Bold"));
        manager.add(create_test_font("Second-Bold"));

        let font = manager.get_font(true, false);
        assert!(font.is_some());
        assert_eq!(font.unwrap().name(), "First-Bold");
    }

    #[test]
    fn test_get_font_fallback_to_first_when_no_match() {
        let mut manager = FontManager::new();
        manager.add(create_test_font("Regular"));
        manager.add(create_test_font("Bold"));

        // Request italic but only regular and bold available
        let font = manager.get_font(false, true);
        assert!(font.is_some());
        assert_eq!(font.unwrap().name(), "Regular");
    }

    #[test]
    fn test_atlas_font_size_multiple_fonts() {
        let mut manager = FontManager::new();
        manager.add(BitmapFont {
            font: "SmallFont".to_string(),
            size: 16.0,
            line_height: 20.0,
            distance_range: 4.0,
            chars: HashMap::new(),
        });
        manager.add(BitmapFont {
            font: "LargeFont".to_string(),
            size: 48.0,
            line_height: 56.0,
            distance_range: 4.0,
            chars: HashMap::new(),
        });

        // Should return first font's size
        assert_eq!(manager.atlas_font_size(), 16.0);
    }

    #[test]
    fn test_required_texture_uids_multiple_fonts() {
        use super::super::bitmap_font::{BitmapChar, CharFrame};

        let mut manager = FontManager::new();

        // First font with texture UIDs 1 and 2
        let mut chars1 = HashMap::new();
        chars1.insert(
            65,
            BitmapChar {
                texture_uid: 1,
                x_advance: 10.0,
                x_offset: 0.0,
                y_offset: 0.0,
                orig_width: 10.0,
                texture_height: 32.0,
                kerning: HashMap::new(),
                uvs: [0.0; 8],
                frame: CharFrame::default(),
            },
        );
        chars1.insert(
            66,
            BitmapChar {
                texture_uid: 2,
                x_advance: 10.0,
                x_offset: 0.0,
                y_offset: 0.0,
                orig_width: 10.0,
                texture_height: 32.0,
                kerning: HashMap::new(),
                uvs: [0.0; 8],
                frame: CharFrame::default(),
            },
        );

        manager.add(BitmapFont {
            font: "Font1".to_string(),
            size: 32.0,
            line_height: 36.0,
            distance_range: 4.0,
            chars: chars1,
        });

        // Second font with texture UIDs 2 and 3 (overlapping with first)
        let mut chars2 = HashMap::new();
        chars2.insert(
            67,
            BitmapChar {
                texture_uid: 2,
                x_advance: 10.0,
                x_offset: 0.0,
                y_offset: 0.0,
                orig_width: 10.0,
                texture_height: 32.0,
                kerning: HashMap::new(),
                uvs: [0.0; 8],
                frame: CharFrame::default(),
            },
        );
        chars2.insert(
            68,
            BitmapChar {
                texture_uid: 3,
                x_advance: 10.0,
                x_offset: 0.0,
                y_offset: 0.0,
                orig_width: 10.0,
                texture_height: 32.0,
                kerning: HashMap::new(),
                uvs: [0.0; 8],
                frame: CharFrame::default(),
            },
        );

        manager.add(BitmapFont {
            font: "Font2".to_string(),
            size: 32.0,
            line_height: 36.0,
            distance_range: 4.0,
            chars: chars2,
        });

        let uids = manager.required_texture_uids();
        assert!(uids.contains(&1));
        assert!(uids.contains(&2));
        assert!(uids.contains(&3));
        // Note: required_texture_uids() doesn't deduplicate across fonts,
        // so UID 2 appears twice (once from each font)
        assert_eq!(uids.len(), 4);
    }

    #[test]
    fn test_required_texture_uids_empty_font() {
        use super::super::bitmap_font::{BitmapChar, CharFrame};

        let mut manager = FontManager::new();

        // Font with no chars
        manager.add(create_test_font("EmptyFont"));

        // Font with chars
        let mut chars = HashMap::new();
        chars.insert(
            65,
            BitmapChar {
                texture_uid: 5,
                x_advance: 10.0,
                x_offset: 0.0,
                y_offset: 0.0,
                orig_width: 10.0,
                texture_height: 32.0,
                kerning: HashMap::new(),
                uvs: [0.0; 8],
                frame: CharFrame::default(),
            },
        );

        manager.add(BitmapFont {
            font: "FontWithChars".to_string(),
            size: 32.0,
            line_height: 36.0,
            distance_range: 4.0,
            chars,
        });

        let uids = manager.required_texture_uids();
        assert_eq!(uids.len(), 1);
        assert!(uids.contains(&5));
    }

    #[test]
    fn test_font_count_after_add() {
        let mut manager = FontManager::new();
        assert_eq!(manager.font_count(), 0);

        manager.add(create_test_font("Font1"));
        assert_eq!(manager.font_count(), 1);

        manager.add(create_test_font("Font2"));
        assert_eq!(manager.font_count(), 2);
    }

    #[test]
    fn test_has_fonts_after_add() {
        let mut manager = FontManager::new();
        assert!(!manager.has_fonts());

        manager.add(create_test_font("Font1"));
        assert!(manager.has_fonts());
    }
}
