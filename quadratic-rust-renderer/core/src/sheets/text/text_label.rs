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

    #[test]
    fn test_text_anchor_multipliers() {
        assert_eq!(TextAnchor::TopLeft.offset_multipliers(), (0.0, 0.0));
        assert_eq!(TextAnchor::Center.offset_multipliers(), (0.5, 0.5));
        assert_eq!(TextAnchor::BottomRight.offset_multipliers(), (1.0, 1.0));
    }

    #[test]
    fn test_text_label_new() {
        let label = TextLabel::new("Test".to_string(), 100.0, 50.0);
        assert_eq!(label.text, "Test");
        assert_eq!(label.x, 100.0);
        assert_eq!(label.y, 50.0);
        assert_eq!(label.font_size, HEADING_FONT_SIZE);
    }
}
