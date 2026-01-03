//! Cell label - text content and layout for a single cell

use quadratic_core_shared::{CellAlign, CellVerticalAlign, CellWrap, RenderCell, SheetOffsets};

use super::{BitmapFonts, LabelMeshes};

/// Default font size in pixels
const DEFAULT_FONT_SIZE: f32 = 14.0;

/// Cell padding
const CELL_PADDING_LEFT: f32 = 3.0;
const CELL_PADDING_RIGHT: f32 = 3.0;
const CELL_PADDING_TOP: f32 = 1.0;

/// Horizontal line (underline/strikethrough)
#[derive(Debug, Clone)]
pub struct HorizontalLine {
    pub x: f32,
    pub y: f32,
    pub width: f32,
    pub height: f32,
    pub color: [f32; 4],
}

/// A cell's text label with layout information
pub struct CellLabel {
    /// Cell position (1-indexed)
    col: i64,
    row: i64,

    /// Text content
    text: String,

    /// Style properties
    font_size: f32,
    bold: bool,
    italic: bool,
    color: [f32; 4],
    align: CellAlign,
    valign: CellVerticalAlign,
    wrap: CellWrap,
    underline: bool,
    strikethrough: bool,

    /// Cell bounds in world coordinates
    cell_x: f32,
    cell_y: f32,
    cell_width: f32,
    cell_height: f32,

    /// Computed text metrics
    text_width: f32,
    text_height: f32,

    /// Overflow amounts (for clipping)
    overflow_left: f32,
    overflow_right: f32,

    /// Clip bounds (set by neighbor checking)
    clip_left: Option<f32>,
    clip_right: Option<f32>,

    /// Whether layout is dirty
    dirty: bool,

    /// Cached meshes
    cached_meshes: LabelMeshes,

    /// Cached horizontal lines
    cached_lines: Vec<HorizontalLine>,
}

impl CellLabel {
    /// Create from RenderCell
    pub fn from_render_cell(cell: &RenderCell) -> Self {
        let color = parse_color(&cell.text_color);

        Self {
            col: cell.x,
            row: cell.y,
            text: cell.value.clone(),
            font_size: cell.font_size.map(|s| s as f32).unwrap_or(DEFAULT_FONT_SIZE),
            bold: cell.bold.unwrap_or(false),
            italic: cell.italic.unwrap_or(false),
            color,
            align: cell.align.unwrap_or(CellAlign::Left),
            valign: cell.vertical_align.unwrap_or(CellVerticalAlign::Top),
            wrap: cell.wrap.unwrap_or(CellWrap::Overflow),
            underline: cell.underline.unwrap_or(false),
            strikethrough: cell.strike_through.unwrap_or(false),
            cell_x: 0.0,
            cell_y: 0.0,
            cell_width: 0.0,
            cell_height: 0.0,
            text_width: 0.0,
            text_height: 0.0,
            overflow_left: 0.0,
            overflow_right: 0.0,
            clip_left: None,
            clip_right: None,
            dirty: true,
            cached_meshes: LabelMeshes::new(),
            cached_lines: Vec::new(),
        }
    }

    // Getters
    pub fn col(&self) -> i64 {
        self.col
    }
    pub fn row(&self) -> i64 {
        self.row
    }
    pub fn cell_left(&self) -> f32 {
        self.cell_x
    }
    pub fn cell_right(&self) -> f32 {
        self.cell_x + self.cell_width
    }
    pub fn overflow_left(&self) -> f32 {
        self.overflow_left
    }
    pub fn overflow_right(&self) -> f32 {
        self.overflow_right
    }
    pub fn unwrapped_text_width(&self) -> f32 {
        self.text_width
    }
    pub fn text_height_with_descenders(&self) -> f32 {
        self.text_height
    }

    /// Set clip bounds
    pub fn set_clip_left(&mut self, x: f32) {
        self.clip_left = Some(x);
        self.dirty = true;
    }

    pub fn set_clip_right(&mut self, x: f32) {
        self.clip_right = Some(x);
        self.dirty = true;
    }

    /// Update cell bounds from sheet offsets
    pub fn update_bounds(&mut self, offsets: &SheetOffsets) {
        let (x, width) = offsets.column_position_size(self.col);
        let (y, height) = offsets.row_position_size(self.row);

        self.cell_x = x as f32;
        self.cell_y = y as f32;
        self.cell_width = width as f32;
        self.cell_height = height as f32;
        self.dirty = true;
    }

    /// Perform text layout
    pub fn layout(&mut self, fonts: &BitmapFonts) {
        if !self.dirty {
            return;
        }

        self.cached_meshes.clear();
        self.cached_lines.clear();

        let Some(font) = self.get_font(fonts) else {
            return;
        };

        // Calculate font scale
        let font_scale = self.font_size / font.size;

        // Layout text
        let y = self.cell_y + CELL_PADDING_TOP + (font.line_height * font_scale);

        let mut total_width = 0.0;
        let mut prev_char: Option<u32> = None;

        // First pass: calculate total width
        for c in self.text.chars() {
            let char_code = c as u32;
            if let Some(glyph) = font.get_char(char_code) {
                if let Some(prev) = prev_char {
                    total_width += font.get_kerning(prev, char_code) * font_scale;
                }
                total_width += glyph.x_advance * font_scale;
                prev_char = Some(char_code);
            }
        }

        self.text_width = total_width;
        self.text_height = font.line_height * font_scale;

        // Calculate starting X based on alignment
        let available_width = self.cell_width - CELL_PADDING_LEFT - CELL_PADDING_RIGHT;
        let mut x = match self.align {
            CellAlign::Left => self.cell_x + CELL_PADDING_LEFT,
            CellAlign::Center => self.cell_x + (self.cell_width - total_width) / 2.0,
            CellAlign::Right => self.cell_x + self.cell_width - CELL_PADDING_RIGHT - total_width,
        };

        // Calculate overflow
        self.overflow_left = (self.cell_x - x).max(0.0);
        self.overflow_right = ((x + total_width) - (self.cell_x + self.cell_width)).max(0.0);

        // Get effective clip bounds
        let clip_left = self.clip_left.unwrap_or(f32::NEG_INFINITY);
        let clip_right = self.clip_right.unwrap_or(f32::INFINITY);

        // Second pass: generate geometry
        prev_char = None;
        for c in self.text.chars() {
            let char_code = c as u32;
            if let Some(glyph) = font.get_char(char_code) {
                if let Some(prev) = prev_char {
                    x += font.get_kerning(prev, char_code) * font_scale;
                }

                let glyph_x = x + glyph.x_offset * font_scale;
                let glyph_y = y + glyph.y_offset * font_scale - font.line_height * font_scale;
                let glyph_w = glyph.frame.width * font_scale;
                let glyph_h = glyph.frame.height * font_scale;

                // Clip check
                let glyph_right = glyph_x + glyph_w;
                if glyph_right > clip_left && glyph_x < clip_right {
                    // Use pre-computed UVs from font loader
                    // uvs format: [u0, v0, u1, v0, u1, v1, u0, v1] (4 corners)
                    let (u0, v0, u1, v1) = if glyph.uvs.len() >= 6 {
                        (glyph.uvs[0], glyph.uvs[1], glyph.uvs[2], glyph.uvs[5])
                    } else {
                        (0.0, 0.0, 1.0, 1.0)
                    };

                    let texture_uid = glyph.texture_uid;
                    let mesh = self.cached_meshes.get_or_create(texture_uid, self.font_size);
                    mesh.add_quad(glyph_x, glyph_y, glyph_w, glyph_h, u0, v0, u1, v1, self.color);
                }

                x += glyph.x_advance * font_scale;
                prev_char = Some(char_code);
            }
        }

        // Add horizontal lines
        if self.underline {
            let line_y = y + 2.0;
            let line_height = (self.font_size * 0.07).max(1.0);
            self.cached_lines.push(HorizontalLine {
                x: self.cell_x + CELL_PADDING_LEFT,
                y: line_y,
                width: total_width.min(available_width),
                height: line_height,
                color: self.color,
            });
        }

        if self.strikethrough {
            let line_y = y - self.text_height * 0.35;
            let line_height = (self.font_size * 0.07).max(1.0);
            self.cached_lines.push(HorizontalLine {
                x: self.cell_x + CELL_PADDING_LEFT,
                y: line_y,
                width: total_width.min(available_width),
                height: line_height,
                color: self.color,
            });
        }

        self.dirty = false;
    }

    /// Get the appropriate font based on style
    fn get_font<'a>(&self, fonts: &'a BitmapFonts) -> Option<&'a super::BitmapFont> {
        let font_name = match (self.bold, self.italic) {
            (true, true) => "OpenSans-BoldItalic",
            (true, false) => "OpenSans-Bold",
            (false, true) => "OpenSans-Italic",
            (false, false) => "OpenSans",
        };
        fonts.get(font_name).or_else(|| fonts.default_font())
    }

    /// Get cached meshes as TextBuffers
    pub fn get_text_buffers(&self) -> Vec<quadratic_rust_renderer_shared::TextBuffer> {
        self.cached_meshes.to_text_buffers()
    }

    /// Get horizontal lines
    pub fn get_horizontal_lines(&self) -> &[HorizontalLine] {
        &self.cached_lines
    }

    /// Get emoji strings (placeholder - full implementation would parse emojis)
    pub fn get_emoji_strings(&self) -> Vec<&str> {
        Vec::new() // TODO: Implement emoji detection
    }
}

fn parse_color(color: &Option<String>) -> [f32; 4] {
    color
        .as_ref()
        .map(|c| crate::utils::color::parse_color_string(c))
        .unwrap_or([0.0, 0.0, 0.0, 1.0])
}
