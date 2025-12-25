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

    /// Glyph data
    glyphs: Vec<GlyphData>,

    /// Font name used
    font_name: String,
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
            glyphs: Vec::new(),
            font_name: String::new(),
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

        if self.text.is_empty() {
            self.text_width = 0.0;
            self.text_height = 0.0;
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
        let mut max_height = 0.0f32;

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

            self.glyphs.push(GlyphData {
                x: pos_x + char_data.x_offset,
                y: char_data.y_offset,
                width: char_data.frame.width,
                height: char_data.frame.height,
                uvs: char_data.uvs,
                texture_uid: char_data.texture_uid,
            });

            pos_x += char_data.x_advance;
            max_height = max_height.max(char_data.frame.height);
            prev_char_code = Some(char_code);
        }

        self.text_width = pos_x * scale;
        self.text_height = max_height * scale;
    }

    /// Build the mesh for rendering
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
        let offset_y = -self.text_height * anchor_y;

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
