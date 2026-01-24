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
        log::info!("FontManager: Adding font '{}'", font.name());
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
