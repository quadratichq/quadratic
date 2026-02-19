//! TextLabel - Simple text rendering for headings and other UI elements
//!
//! Unlike CellLabel which handles cell-specific logic (wrapping, alignment within cells),
//! TextLabel is a simpler primitive for rendering text at a specific position.

use super::bitmap_font::{extract_char_code, split_text_to_characters, BitmapFonts};
use super::label_mesh::LabelMesh;

/// Default font size for headings
pub const HEADING_FONT_SIZE: f32 = 10.0;

/// Text anchor point
#[derive(Debug, Clone, Copy, PartialEq, Eq, Default)]
pub enum TextAnchor {
    TopLeft,
    TopCenter,
    TopRight,
    #[default]
    CenterLeft,
    Center,
    CenterRight,
    BottomLeft,
    BottomCenter,
    BottomRight,
}

impl TextAnchor {
    /// Get the anchor offset multipliers (0.0 to 1.0 for x and y)
    pub fn offset_multipliers(&self) -> (f32, f32) {
        match self {
            TextAnchor::TopLeft => (0.0, 0.0),
            TextAnchor::TopCenter => (0.5, 0.0),
            TextAnchor::TopRight => (1.0, 0.0),
            TextAnchor::CenterLeft => (0.0, 0.5),
            TextAnchor::Center => (0.5, 0.5),
            TextAnchor::CenterRight => (1.0, 0.5),
            TextAnchor::BottomLeft => (0.0, 1.0),
            TextAnchor::BottomCenter => (0.5, 1.0),
            TextAnchor::BottomRight => (1.0, 1.0),
        }
    }
}

/// Character render data for a single glyph
#[derive(Debug, Clone)]
struct GlyphData {
    /// Position relative to text origin
    x: f32,
    y: f32,
    /// Glyph dimensions
    width: f32,
    height: f32,
    /// UV coordinates
    uvs: [f32; 8],
    /// Texture UID
    texture_uid: u32,
}

/// A simple text label for headings and UI elements
#[derive(Debug, Clone)]
pub struct TextLabel {
    /// Text content
    pub text: String,

    /// Position (before anchor adjustment)
    pub x: f32,
    pub y: f32,

    /// Font size
    pub font_size: f32,

    /// Bold style
    pub bold: bool,

    /// Italic style
    pub italic: bool,

    /// Text color [r, g, b, a]
    pub color: [f32; 4],

    /// Anchor point
    pub anchor: TextAnchor,

    /// Computed text dimensions
    text_width: f32,
    text_height: f32,

    /// Vertical center offset for proper centering
    /// This is the Y position of the text's visual center relative to origin
    vertical_center: f32,

    /// Glyph data
    glyphs: Vec<GlyphData>,

    /// Font name used
    font_name: String,

    /// Cached mesh data (built once, reused until dirty)
    cached_meshes: Vec<LabelMesh>,

    /// Whether the mesh cache needs rebuild
    mesh_dirty: bool,
}

impl TextLabel {
    /// Create a new text label
    pub fn new(text: String, x: f32, y: f32) -> Self {
        Self {
            text,
            x,
            y,
            font_size: HEADING_FONT_SIZE,
            bold: false,
            italic: false,
            color: [0.0, 0.0, 0.0, 1.0], // Black
            anchor: TextAnchor::Center,
            text_width: 0.0,
            text_height: 0.0,
            vertical_center: 0.0,
            glyphs: Vec::new(),
            font_name: String::new(),
            cached_meshes: Vec::new(),
            mesh_dirty: true,
        }
    }

    /// Create with specific font size
    pub fn with_font_size(mut self, size: f32) -> Self {
        self.font_size = size;
        self
    }

    /// Create with specific color
    pub fn with_color(mut self, color: [f32; 4]) -> Self {
        self.color = color;
        self
    }

    /// Create with specific anchor
    pub fn with_anchor(mut self, anchor: TextAnchor) -> Self {
        self.anchor = anchor;
        self
    }

    /// Create with bold style
    pub fn with_bold(mut self, bold: bool) -> Self {
        self.bold = bold;
        self
    }

    /// Create with italic style
    pub fn with_italic(mut self, italic: bool) -> Self {
        self.italic = italic;
        self
    }

    /// Get the computed text width
    pub fn width(&self) -> f32 {
        self.text_width
    }

    /// Get the computed text height
    pub fn height(&self) -> f32 {
        self.text_height
    }

    /// Get the font name based on style
    fn get_font_name(&self) -> String {
        BitmapFonts::get_font_name(self.bold, self.italic)
    }

    /// Layout the text and compute glyph positions
    pub fn layout(&mut self, fonts: &BitmapFonts) {
        self.glyphs.clear();
        self.font_name = self.get_font_name();
        self.mesh_dirty = true; // Mark mesh as needing rebuild

        if self.text.is_empty() {
            self.text_width = 0.0;
            self.text_height = 0.0;
            self.vertical_center = 0.0;
            self.cached_meshes.clear();
            return;
        }

        let font = match fonts.get(&self.font_name) {
            Some(f) => f,
            None => {
                log::warn!("Font not found: {}", self.font_name);
                return;
            }
        };

        let scale = font.scale_for_size(self.font_size);
        let characters = split_text_to_characters(&self.text);

        let mut pos_x = 0.0f32;
        let mut prev_char_code: Option<u32> = None;

        // Track actual bounding box (min/max Y of all glyphs)
        let mut min_y = f32::MAX;
        let mut max_y = f32::MIN;

        for c in &characters {
            let char_code = extract_char_code(*c);

            // Skip newlines for simple labels
            if *c == '\r' || *c == '\n' {
                continue;
            }

            let char_data = match font.get_char(char_code) {
                Some(c) => c,
                None => continue,
            };

            // Apply kerning
            if let Some(prev) = prev_char_code {
                if let Some(kern) = char_data.kerning.get(&prev) {
                    pos_x += kern;
                }
            }

            let glyph_top = char_data.y_offset;
            let glyph_bottom = glyph_top + char_data.frame.height;

            self.glyphs.push(GlyphData {
                x: pos_x + char_data.x_offset,
                y: glyph_top,
                width: char_data.frame.width,
                height: char_data.frame.height,
                uvs: char_data.uvs,
                texture_uid: char_data.texture_uid,
            });

            // Track bounding box
            min_y = min_y.min(glyph_top);
            max_y = max_y.max(glyph_bottom);

            pos_x += char_data.x_advance;
            prev_char_code = Some(char_code);
        }

        // Handle case where no glyphs were added
        if min_y == f32::MAX {
            min_y = 0.0;
            max_y = 0.0;
        }

        self.text_width = pos_x * scale;
        self.text_height = (max_y - min_y) * scale;
        // Calculate the vertical center position (scaled)
        // This is the Y position of the visual center relative to the text origin
        self.vertical_center = (min_y + max_y) / 2.0 * scale;
    }

    /// Get cached meshes, rebuilding if dirty
    /// This is the main method to call for rendering - uses caching
    pub fn get_meshes(&mut self, fonts: &BitmapFonts) -> &[LabelMesh] {
        if self.mesh_dirty {
            self.rebuild_mesh_cache(fonts);
            self.mesh_dirty = false;
        }
        &self.cached_meshes
    }

    /// Rebuild the mesh cache (internal)
    fn rebuild_mesh_cache(&mut self, fonts: &BitmapFonts) {
        self.cached_meshes.clear();

        if self.glyphs.is_empty() {
            return;
        }

        let font = match fonts.get(&self.font_name) {
            Some(f) => f,
            None => return,
        };

        let scale = font.scale_for_size(self.font_size);

        // Calculate anchor offset
        let (anchor_x, anchor_y) = self.anchor.offset_multipliers();
        let offset_x = -self.text_width * anchor_x;

        // For vertical centering:
        // - vertical_center is the Y position of the text's visual center
        // - For Center anchor (anchor_y = 0.5), we want to offset so the center is at self.y
        // - offset = -vertical_center for Center anchor
        // General: offset = -(vertical_center + text_height * (anchor_y - 0.5))
        let offset_y = -(self.vertical_center + self.text_height * (anchor_y - 0.5));

        // Group glyphs by texture
        let mut meshes: std::collections::HashMap<u32, LabelMesh> =
            std::collections::HashMap::new();

        for glyph in &self.glyphs {
            let x = self.x + glyph.x * scale + offset_x;
            let y = self.y + glyph.y * scale + offset_y;
            let width = glyph.width * scale;
            let height = glyph.height * scale;

            let mesh = meshes.entry(glyph.texture_uid).or_insert_with(|| {
                LabelMesh::new(self.font_name.clone(), self.font_size, glyph.texture_uid)
            });

            mesh.add_glyph(x, y, width, height, &glyph.uvs, self.color);
        }

        self.cached_meshes = meshes.into_values().collect();
    }

    /// Build the mesh for rendering (legacy, non-cached)
    /// Prefer using get_meshes() for better performance
    #[allow(dead_code)]
    pub fn build_mesh(&self, fonts: &BitmapFonts) -> Vec<LabelMesh> {
        if self.glyphs.is_empty() {
            return Vec::new();
        }

        let font = match fonts.get(&self.font_name) {
            Some(f) => f,
            None => return Vec::new(),
        };

        let scale = font.scale_for_size(self.font_size);

        // Calculate anchor offset
        let (anchor_x, anchor_y) = self.anchor.offset_multipliers();
        let offset_x = -self.text_width * anchor_x;
        let offset_y = -(self.vertical_center + self.text_height * (anchor_y - 0.5));

        // Group glyphs by texture
        let mut meshes: std::collections::HashMap<u32, LabelMesh> =
            std::collections::HashMap::new();

        for glyph in &self.glyphs {
            let x = self.x + glyph.x * scale + offset_x;
            let y = self.y + glyph.y * scale + offset_y;
            let width = glyph.width * scale;
            let height = glyph.height * scale;

            let mesh = meshes.entry(glyph.texture_uid).or_insert_with(|| {
                LabelMesh::new(self.font_name.clone(), self.font_size, glyph.texture_uid)
            });

            mesh.add_glyph(x, y, width, height, &glyph.uvs, self.color);
        }

        meshes.into_values().collect()
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::sheets::text::bitmap_font::{BitmapChar, BitmapFont, CharFrame};
    use std::collections::HashMap;

    fn create_test_char_frame() -> CharFrame {
        CharFrame {
            x: 10.0,
            y: 20.0,
            width: 30.0,
            height: 40.0,
        }
    }

    fn create_test_bitmap_char(char_code: u32, x_advance: f32) -> BitmapChar {
        let mut kerning = HashMap::new();
        if char_code == b'A' as u32 {
            kerning.insert(b'B' as u32, -2.0);
        }

        BitmapChar {
            texture_uid: 1,
            x_advance,
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
        chars.insert(b'A' as u32, create_test_bitmap_char(b'A' as u32, 10.0));
        chars.insert(b'B' as u32, create_test_bitmap_char(b'B' as u32, 12.0));
        chars.insert(b' ' as u32, create_test_bitmap_char(b' ' as u32, 5.0));

        BitmapFont {
            font: name.to_string(),
            size,
            line_height: size * 1.2,
            distance_range: 4.0,
            chars,
        }
    }

    fn create_test_fonts() -> BitmapFonts {
        let mut fonts = BitmapFonts::new();
        fonts.add(create_test_font("OpenSans", 16.0));
        fonts.add(create_test_font("OpenSans-Bold", 16.0));
        fonts.add(create_test_font("OpenSans-Italic", 16.0));
        fonts.add(create_test_font("OpenSans-BoldItalic", 16.0));
        fonts
    }

    // =========================================================================
    // TextAnchor tests
    // =========================================================================

    #[test]
    fn test_text_anchor_multipliers() {
        assert_eq!(TextAnchor::TopLeft.offset_multipliers(), (0.0, 0.0));
        assert_eq!(TextAnchor::TopCenter.offset_multipliers(), (0.5, 0.0));
        assert_eq!(TextAnchor::TopRight.offset_multipliers(), (1.0, 0.0));
        assert_eq!(TextAnchor::CenterLeft.offset_multipliers(), (0.0, 0.5));
        assert_eq!(TextAnchor::Center.offset_multipliers(), (0.5, 0.5));
        assert_eq!(TextAnchor::CenterRight.offset_multipliers(), (1.0, 0.5));
        assert_eq!(TextAnchor::BottomLeft.offset_multipliers(), (0.0, 1.0));
        assert_eq!(TextAnchor::BottomCenter.offset_multipliers(), (0.5, 1.0));
        assert_eq!(TextAnchor::BottomRight.offset_multipliers(), (1.0, 1.0));
    }

    #[test]
    fn test_text_anchor_default() {
        assert_eq!(TextAnchor::default(), TextAnchor::CenterLeft);
    }

    // =========================================================================
    // TextLabel construction tests
    // =========================================================================

    #[test]
    fn test_text_label_new() {
        let label = TextLabel::new("Test".to_string(), 100.0, 50.0);
        assert_eq!(label.text, "Test");
        assert_eq!(label.x, 100.0);
        assert_eq!(label.y, 50.0);
        assert_eq!(label.font_size, HEADING_FONT_SIZE);
        assert!(!label.bold);
        assert!(!label.italic);
        assert_eq!(label.color, [0.0, 0.0, 0.0, 1.0]);
        assert_eq!(label.anchor, TextAnchor::Center);
        assert_eq!(label.width(), 0.0);
        assert_eq!(label.height(), 0.0);
    }

    #[test]
    fn test_text_label_with_font_size() {
        let label = TextLabel::new("Test".to_string(), 0.0, 0.0).with_font_size(20.0);
        assert_eq!(label.font_size, 20.0);
    }

    #[test]
    fn test_text_label_with_color() {
        let color = [1.0, 0.5, 0.25, 0.8];
        let label = TextLabel::new("Test".to_string(), 0.0, 0.0).with_color(color);
        assert_eq!(label.color, color);
    }

    #[test]
    fn test_text_label_with_anchor() {
        let label = TextLabel::new("Test".to_string(), 0.0, 0.0).with_anchor(TextAnchor::TopLeft);
        assert_eq!(label.anchor, TextAnchor::TopLeft);
    }

    #[test]
    fn test_text_label_with_bold() {
        let label = TextLabel::new("Test".to_string(), 0.0, 0.0).with_bold(true);
        assert!(label.bold);

        let label2 = TextLabel::new("Test".to_string(), 0.0, 0.0).with_bold(false);
        assert!(!label2.bold);
    }

    #[test]
    fn test_text_label_builder_chain() {
        let label = TextLabel::new("Hello".to_string(), 10.0, 20.0)
            .with_font_size(24.0)
            .with_color([1.0, 0.0, 0.0, 1.0])
            .with_anchor(TextAnchor::TopRight)
            .with_bold(true);

        assert_eq!(label.text, "Hello");
        assert_eq!(label.x, 10.0);
        assert_eq!(label.y, 20.0);
        assert_eq!(label.font_size, 24.0);
        assert_eq!(label.color, [1.0, 0.0, 0.0, 1.0]);
        assert_eq!(label.anchor, TextAnchor::TopRight);
        assert!(label.bold);
    }

    // =========================================================================
    // Layout tests
    // =========================================================================

    #[test]
    fn test_layout_empty_text() {
        let fonts = create_test_fonts();
        let mut label = TextLabel::new("".to_string(), 0.0, 0.0);
        label.layout(&fonts);

        assert_eq!(label.width(), 0.0);
        assert_eq!(label.height(), 0.0);
    }

    #[test]
    fn test_layout_single_character() {
        let fonts = create_test_fonts();
        let mut label = TextLabel::new("A".to_string(), 0.0, 0.0);
        label.layout(&fonts);

        assert!(label.width() > 0.0);
        assert!(label.height() > 0.0);
    }

    #[test]
    fn test_layout_multiple_characters() {
        let fonts = create_test_fonts();
        let mut label = TextLabel::new("AB".to_string(), 0.0, 0.0);
        label.layout(&fonts);

        assert!(label.width() > 0.0);
        assert!(label.height() > 0.0);
    }

    #[test]
    fn test_layout_with_kerning() {
        let fonts = create_test_fonts();
        let mut label = TextLabel::new("AB".to_string(), 0.0, 0.0);
        label.layout(&fonts);

        let width_with_kerning = label.width();

        let mut label_no_kerning = TextLabel::new("A B".to_string(), 0.0, 0.0);
        label_no_kerning.layout(&fonts);

        assert!(width_with_kerning < label_no_kerning.width());
    }

    #[test]
    fn test_layout_different_font_sizes() {
        let fonts = create_test_fonts();

        let mut label_small = TextLabel::new("AB".to_string(), 0.0, 0.0).with_font_size(10.0);
        label_small.layout(&fonts);

        let mut label_large = TextLabel::new("AB".to_string(), 0.0, 0.0).with_font_size(20.0);
        label_large.layout(&fonts);

        assert!(label_large.width() > label_small.width());
        assert!(label_large.height() > label_small.height());
    }

    #[test]
    fn test_layout_skips_newlines() {
        let fonts = create_test_fonts();
        let mut label = TextLabel::new("A\nB".to_string(), 0.0, 0.0);
        label.layout(&fonts);

        let mut label_no_newline = TextLabel::new("AB".to_string(), 0.0, 0.0);
        label_no_newline.layout(&fonts);

        assert_eq!(label.width(), label_no_newline.width());
    }

    #[test]
    fn test_layout_missing_font() {
        let fonts = BitmapFonts::new();
        let mut label = TextLabel::new("Test".to_string(), 0.0, 0.0);
        label.layout(&fonts);

        assert_eq!(label.width(), 0.0);
        assert_eq!(label.height(), 0.0);
    }

    #[test]
    fn test_layout_bold_font() {
        let fonts = create_test_fonts();
        let mut label = TextLabel::new("AB".to_string(), 0.0, 0.0).with_bold(true);
        label.layout(&fonts);

        assert!(label.width() > 0.0);
        assert!(label.height() > 0.0);
    }

    #[test]
    fn test_layout_italic_font() {
        let fonts = create_test_fonts();
        let mut label = TextLabel::new("AB".to_string(), 0.0, 0.0).with_italic(true);
        label.layout(&fonts);

        assert!(label.width() > 0.0);
        assert!(label.height() > 0.0);
    }

    #[test]
    fn test_layout_bold_italic_font() {
        let fonts = create_test_fonts();
        let mut label = TextLabel::new("AB".to_string(), 0.0, 0.0)
            .with_bold(true)
            .with_italic(true);
        label.layout(&fonts);

        assert!(label.width() > 0.0);
        assert!(label.height() > 0.0);
    }

    // =========================================================================
    // Mesh building tests
    // =========================================================================

    #[test]
    fn test_get_meshes_empty_text() {
        let fonts = create_test_fonts();
        let mut label = TextLabel::new("".to_string(), 0.0, 0.0);
        label.layout(&fonts);

        let meshes = label.get_meshes(&fonts);
        assert!(meshes.is_empty());
    }

    #[test]
    fn test_get_meshes_single_character() {
        let fonts = create_test_fonts();
        let mut label = TextLabel::new("A".to_string(), 0.0, 0.0);
        label.layout(&fonts);

        let meshes = label.get_meshes(&fonts);
        assert!(!meshes.is_empty());
        assert_eq!(meshes.len(), 1);
        assert_eq!(meshes[0].glyph_count(), 1);
    }

    #[test]
    fn test_get_meshes_multiple_characters() {
        let fonts = create_test_fonts();
        let mut label = TextLabel::new("AB".to_string(), 0.0, 0.0);
        label.layout(&fonts);

        let meshes = label.get_meshes(&fonts);
        assert!(!meshes.is_empty());
        assert_eq!(meshes[0].glyph_count(), 2);
    }

    #[test]
    fn test_get_meshes_caching() {
        let fonts = create_test_fonts();
        let mut label = TextLabel::new("AB".to_string(), 0.0, 0.0);
        label.layout(&fonts);

        let meshes1 = {
            let meshes = label.get_meshes(&fonts);
            (meshes.len(), meshes[0].glyph_count())
        };

        let meshes2 = {
            let meshes = label.get_meshes(&fonts);
            (meshes.len(), meshes[0].glyph_count())
        };

        assert_eq!(meshes1.0, meshes2.0);
        assert_eq!(meshes1.1, meshes2.1);
    }

    #[test]
    fn test_get_meshes_different_anchors() {
        let fonts = create_test_fonts();

        let mut label_tl =
            TextLabel::new("AB".to_string(), 100.0, 50.0).with_anchor(TextAnchor::TopLeft);
        label_tl.layout(&fonts);
        let meshes_tl = label_tl.get_meshes(&fonts);

        let mut label_br =
            TextLabel::new("AB".to_string(), 100.0, 50.0).with_anchor(TextAnchor::BottomRight);
        label_br.layout(&fonts);
        let meshes_br = label_br.get_meshes(&fonts);

        assert!(!meshes_tl.is_empty());
        assert!(!meshes_br.is_empty());

        if !meshes_tl[0].vertices.is_empty() && !meshes_br[0].vertices.is_empty() {
            let v_tl = &meshes_tl[0].vertices[0];
            let v_br = &meshes_br[0].vertices[0];
            assert_ne!(v_tl.x, v_br.x);
            assert_ne!(v_tl.y, v_br.y);
        }
    }

    #[test]
    fn test_build_mesh_legacy() {
        let fonts = create_test_fonts();
        let mut label = TextLabel::new("AB".to_string(), 0.0, 0.0);
        label.layout(&fonts);

        let meshes = label.build_mesh(&fonts);
        assert!(!meshes.is_empty());
        assert_eq!(meshes[0].glyph_count(), 2);
    }

    #[test]
    fn test_build_mesh_empty_text() {
        let fonts = create_test_fonts();
        let mut label = TextLabel::new("".to_string(), 0.0, 0.0);
        label.layout(&fonts);

        let meshes = label.build_mesh(&fonts);
        assert!(meshes.is_empty());
    }

    #[test]
    fn test_get_meshes_with_color() {
        let fonts = create_test_fonts();
        let color = [0.5, 0.6, 0.7, 0.8];
        let mut label = TextLabel::new("A".to_string(), 0.0, 0.0).with_color(color);
        label.layout(&fonts);

        let meshes = label.get_meshes(&fonts);
        assert!(!meshes.is_empty());
        if !meshes[0].vertices.is_empty() {
            let vertex = &meshes[0].vertices[0];
            assert_eq!(vertex.r, color[0]);
            assert_eq!(vertex.g, color[1]);
            assert_eq!(vertex.b, color[2]);
            assert_eq!(vertex.a, color[3]);
        }
    }

    // =========================================================================
    // Width and height tests
    // =========================================================================

    #[test]
    fn test_width_after_layout() {
        let fonts = create_test_fonts();
        let mut label = TextLabel::new("AB".to_string(), 0.0, 0.0);

        assert_eq!(label.width(), 0.0);
        label.layout(&fonts);
        assert!(label.width() > 0.0);
    }

    #[test]
    fn test_height_after_layout() {
        let fonts = create_test_fonts();
        let mut label = TextLabel::new("AB".to_string(), 0.0, 0.0);

        assert_eq!(label.height(), 0.0);
        label.layout(&fonts);
        assert!(label.height() > 0.0);
    }

    #[test]
    fn test_width_scales_with_font_size() {
        let fonts = create_test_fonts();

        let mut label1 = TextLabel::new("AB".to_string(), 0.0, 0.0).with_font_size(10.0);
        label1.layout(&fonts);

        let mut label2 = TextLabel::new("AB".to_string(), 0.0, 0.0).with_font_size(20.0);
        label2.layout(&fonts);

        assert!(label2.width() > label1.width());
    }

    #[test]
    fn test_height_scales_with_font_size() {
        let fonts = create_test_fonts();

        let mut label1 = TextLabel::new("AB".to_string(), 0.0, 0.0).with_font_size(10.0);
        label1.layout(&fonts);

        let mut label2 = TextLabel::new("AB".to_string(), 0.0, 0.0).with_font_size(20.0);
        label2.layout(&fonts);

        assert!(label2.height() > label1.height());
    }
}
