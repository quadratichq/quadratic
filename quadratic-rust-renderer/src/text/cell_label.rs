//! Cell label - text layout for a single cell
//!
//! Simplified version of CellLabel from TypeScript.
//! Handles basic text layout with alignment and wrapping.

use quadratic_core_shared::{CellAlign, CellVerticalAlign, CellWrap, RenderCell, SheetOffsets};

use crate::fills::parse_color_string;

use super::bitmap_font::{BitmapFonts, extract_char_code, split_text_to_characters};
use super::label_mesh::LabelMesh;

/// Grid constants (matching TypeScript)
pub const CELL_TEXT_MARGIN_LEFT: f32 = 3.0;
pub const DEFAULT_FONT_SIZE: f32 = 14.0;
pub const LINE_HEIGHT: f32 = 16.0;
pub const DEFAULT_CELL_HEIGHT: f32 = 21.0;
pub const CELL_VERTICAL_PADDING: f32 = 2.5;

/// OpenSans rendering fix (magic numbers from TypeScript)
pub const OPEN_SANS_FIX_X: f32 = 1.8;
pub const OPEN_SANS_FIX_Y: f32 = -1.8;

/// Character render data (position and glyph info)
#[derive(Debug, Clone)]
struct CharRenderData {
    /// Position in unscaled coordinates
    position_x: f32,
    position_y: f32,

    /// Line number
    line: usize,

    /// Glyph frame dimensions
    frame_width: f32,
    frame_height: f32,

    /// UV coordinates
    uvs: [f32; 8],

    /// Texture UID
    texture_uid: u32,
}

/// Cell label - handles text layout for a single cell
pub struct CellLabel {
    /// Text content
    pub text: String,

    /// Cell column index (1-indexed for A1 notation)
    pub col: i64,

    /// Cell row index (1-indexed for A1 notation)
    pub row: i64,

    /// Cached cell position in world coordinates (computed from offsets)
    cell_x: f32,
    cell_y: f32,

    /// Cached cell dimensions (computed from offsets)
    cell_width: f32,
    cell_height: f32,

    /// Font settings
    pub font_size: f32,
    pub bold: bool,
    pub italic: bool,

    /// Text color [r, g, b, a]
    pub color: [f32; 4],

    /// Alignment
    pub align: CellAlign,
    pub vertical_align: CellVerticalAlign,

    /// Wrapping
    pub wrap: CellWrap,

    /// Computed text position
    text_x: f32,
    text_y: f32,

    /// Computed text dimensions
    text_width: f32,
    text_height: f32,

    /// Unwrapped text width - natural width of text ignoring wrap
    /// Used for column auto-resize. Includes text margins (3 * CELL_TEXT_MARGIN_LEFT)
    unwrapped_text_width: f32,

    /// Text height including descenders (g, y, p, q, j)
    /// Used for row auto-resize. Equals glyph_height + 2 * CELL_VERTICAL_PADDING
    text_height_with_descenders: f32,

    /// Maximum glyph height including descenders
    glyph_height: f32,

    /// Character render data
    chars: Vec<CharRenderData>,

    /// Line widths for alignment
    line_widths: Vec<f32>,

    /// Horizontal alignment offsets per line
    horizontal_align_offsets: Vec<f32>,

    /// Cached mesh data (built once, reused every frame)
    cached_meshes: Vec<LabelMesh>,

    /// Whether the mesh cache is valid
    mesh_dirty: bool,
}

impl CellLabel {
    /// Create a new cell label with column/row indices
    pub fn new(text: String, col: i64, row: i64) -> Self {
        Self {
            text,
            col,
            row,
            cell_x: 0.0,
            cell_y: 0.0,
            cell_width: 0.0,
            cell_height: 0.0,
            font_size: DEFAULT_FONT_SIZE,
            bold: false,
            italic: false,
            color: [0.0, 0.0, 0.0, 1.0], // Black
            align: CellAlign::Left,
            vertical_align: CellVerticalAlign::Bottom,
            wrap: CellWrap::Overflow,
            text_x: 0.0,
            text_y: 0.0,
            text_width: 0.0,
            text_height: 0.0,
            unwrapped_text_width: 0.0,
            text_height_with_descenders: DEFAULT_CELL_HEIGHT,
            glyph_height: LINE_HEIGHT,
            chars: Vec::new(),
            line_widths: Vec::new(),
            horizontal_align_offsets: Vec::new(),
            cached_meshes: Vec::new(),
            mesh_dirty: true,
        }
    }

    /// Create a CellLabel from a RenderCell (bincode-decoded data from core)
    ///
    /// This converts the core's RenderCell format into the renderer's internal
    /// CellLabel format, applying all styling and formatting options.
    pub fn from_render_cell(cell: &RenderCell) -> Self {
        use quadratic_core_shared::RenderCellSpecial;

        // Skip special cell types that don't need text rendering
        if let Some(ref special) = cell.special {
            match special {
                RenderCellSpecial::Chart | RenderCellSpecial::Checkbox => {
                    // These don't render text, return empty label
                    return Self::new(String::new(), cell.x, cell.y);
                }
                RenderCellSpecial::SpillError => {
                    return Self::new(" #SPILL".to_string(), cell.x, cell.y);
                }
                RenderCellSpecial::RunError => {
                    return Self::new(" #ERROR".to_string(), cell.x, cell.y);
                }
                _ => {}
            }
        }

        let mut label = Self::new(cell.value.clone(), cell.x, cell.y);

        // Apply text styling
        label.bold = cell.bold.unwrap_or(false);
        label.italic = cell.italic.unwrap_or(false);
        label.font_size = cell
            .font_size
            .map(|s| s as f32)
            .unwrap_or(DEFAULT_FONT_SIZE);

        // Apply text color
        if let Some(ref color_str) = cell.text_color {
            label.color = parse_color_string(color_str);
        }

        // Apply alignment (use core-shared types directly)
        label.align = cell.align.unwrap_or_default();
        label.vertical_align = cell.vertical_align.unwrap_or_default();
        label.wrap = cell.wrap.unwrap_or_default();

        label
    }

    /// Update cell bounds from sheet offsets
    /// Call this before layout() when offsets may have changed
    pub fn update_bounds(&mut self, offsets: &SheetOffsets) {
        let (x, width) = offsets.column_position_size(self.col);
        let (y, height) = offsets.row_position_size(self.row);
        self.cell_x = x as f32;
        self.cell_y = y as f32;
        self.cell_width = width as f32;
        self.cell_height = height as f32;
        self.mesh_dirty = true;
    }

    /// Get column index
    #[inline]
    pub fn col(&self) -> i64 {
        self.col
    }

    /// Get row index
    #[inline]
    pub fn row(&self) -> i64 {
        self.row
    }

    /// Get X position (for viewport culling)
    #[inline]
    pub fn x(&self) -> f32 {
        self.cell_x
    }

    /// Get Y position (for viewport culling)
    #[inline]
    pub fn y(&self) -> f32 {
        self.cell_y
    }

    /// Get width (for viewport culling)
    #[inline]
    pub fn width(&self) -> f32 {
        self.cell_width
    }

    /// Get height (for viewport culling)
    #[inline]
    pub fn height(&self) -> f32 {
        self.cell_height
    }

    /// Get unwrapped text width (for column auto-resize)
    /// This is the natural width of the text without wrapping, plus margins
    #[inline]
    pub fn unwrapped_text_width(&self) -> f32 {
        self.unwrapped_text_width
    }

    /// Get text height with descenders (for row auto-resize)
    /// This accounts for characters like g, y, p that extend below baseline
    #[inline]
    pub fn text_height_with_descenders(&self) -> f32 {
        self.text_height_with_descenders
    }

    /// Get the font name based on style
    fn font_name(&self) -> String {
        BitmapFonts::get_font_name(self.bold, self.italic)
    }

    /// Process text and calculate glyph positions
    pub fn layout(&mut self, fonts: &BitmapFonts) {
        self.chars.clear();
        self.line_widths.clear();
        self.horizontal_align_offsets.clear();
        self.mesh_dirty = true; // Mark mesh as needing rebuild

        if self.text.is_empty() {
            self.text_width = 0.0;
            self.text_height = LINE_HEIGHT;
            self.unwrapped_text_width = 0.0;
            self.glyph_height = LINE_HEIGHT;
            self.text_height_with_descenders = LINE_HEIGHT + CELL_VERTICAL_PADDING * 2.0;
            return;
        }

        let font_name = self.font_name();
        let font = match fonts.get(&font_name) {
            Some(f) => f,
            None => {
                log::warn!("Font not found: {}", font_name);
                return;
            }
        };

        let scale = font.scale_for_size(self.font_size);
        let line_height = (self.font_size / DEFAULT_FONT_SIZE) * LINE_HEIGHT / scale;
        let max_width = if self.wrap == CellWrap::Wrap {
            Some((self.cell_width - CELL_TEXT_MARGIN_LEFT * 3.0) / scale)
        } else {
            None
        };

        let characters = split_text_to_characters(&self.text);

        let mut pos_x = 0.0f32;
        let mut pos_y = 0.0f32;
        let mut line = 0usize;
        let mut last_line_width = 0.0f32;
        let mut max_line_width = 0.0f32;
        let mut prev_char_code: Option<u32> = None;
        let mut last_break_pos: Option<usize> = None;
        let mut last_break_width = 0.0f32;

        // Track maximum descender extension for glyph height calculation
        let mut max_descender_extension = 0.0f32;
        let font_line_height = font.line_height();

        for (i, c) in characters.iter().enumerate() {
            let char_code = extract_char_code(*c);

            // Handle whitespace for word wrapping
            if c.is_whitespace() {
                last_break_pos = Some(i);
                last_break_width = last_line_width;
            }

            // Handle newlines
            if *c == '\r' || *c == '\n' {
                self.line_widths.push(last_line_width);
                max_line_width = max_line_width.max(last_line_width);
                line += 1;
                pos_x = 0.0;
                pos_y += line_height;
                prev_char_code = None;
                last_break_pos = None;
                continue;
            }

            // Get character data
            let char_data = match font.get_char(char_code) {
                Some(c) => c,
                None => continue, // Skip unknown characters
            };

            // Apply kerning
            if let Some(prev) = prev_char_code {
                if let Some(kern) = char_data.kerning.get(&prev) {
                    pos_x += kern;
                }
            }

            // Track descender extension for glyph height
            let char_bottom = pos_y + char_data.y_offset + char_data.frame.height;
            let expected_line_bottom = (line + 1) as f32 * font_line_height;
            let descender_extension = (char_bottom - expected_line_bottom).max(0.0);
            max_descender_extension = max_descender_extension.max(descender_extension);

            // Store character render data
            let char_render = CharRenderData {
                position_x: pos_x + char_data.x_offset,
                position_y: pos_y + char_data.y_offset,
                line,
                frame_width: char_data.frame.width,
                frame_height: char_data.frame.height,
                uvs: char_data.uvs,
                texture_uid: char_data.texture_uid,
            };

            self.chars.push(char_render);

            pos_x += char_data.x_advance;
            prev_char_code = Some(char_code);

            // Check for word wrap
            if let Some(max_w) = max_width {
                if pos_x > max_w && char_data.x_advance < max_w {
                    // Need to wrap
                    let break_at = last_break_pos.unwrap_or(i);
                    let chars_to_remove = i - break_at;

                    // Remove characters after break point
                    for _ in 0..chars_to_remove {
                        self.chars.pop();
                    }

                    self.line_widths.push(if last_break_pos.is_some() {
                        last_break_width
                    } else {
                        last_line_width
                    });
                    max_line_width =
                        max_line_width.max(self.line_widths.last().copied().unwrap_or(0.0));

                    line += 1;
                    pos_x = 0.0;
                    pos_y += line_height;
                    prev_char_code = None;
                    last_break_pos = None;
                    continue;
                }
            }

            last_line_width = pos_x;
        }

        // Add final line width
        self.line_widths.push(last_line_width);
        max_line_width = max_line_width.max(last_line_width);

        // Calculate alignment offsets
        for line_width in &self.line_widths {
            let offset = match self.align {
                CellAlign::Left => 0.0,
                CellAlign::Center => (max_line_width - line_width) / 2.0,
                CellAlign::Right => max_line_width - line_width,
            };
            self.horizontal_align_offsets.push(offset);
        }

        // Store final dimensions
        self.text_width = max_line_width * scale + OPEN_SANS_FIX_X * 2.0;
        self.text_height = (self.font_size / DEFAULT_FONT_SIZE) * LINE_HEIGHT * (line + 1) as f32;

        // Calculate unwrapped text width (for column auto-resize)
        self.unwrapped_text_width = self.calculate_unwrapped_text_width(fonts);

        // Calculate glyph height including descenders (for row auto-resize)
        let calculated_text_height = line_height * (line + 1) as f32;
        self.glyph_height = (calculated_text_height + max_descender_extension) * scale;
        // Round to avoid floating point precision issues when comparing heights
        self.text_height_with_descenders =
            (self.glyph_height + CELL_VERTICAL_PADDING * 2.0).round();

        // Calculate text position based on alignment
        self.calculate_position(scale);
    }

    /// Calculate the unwrapped text width (ignoring wrap settings)
    /// Used for column auto-resize
    fn calculate_unwrapped_text_width(&self, fonts: &BitmapFonts) -> f32 {
        if self.text.is_empty() {
            return 0.0;
        }

        let font_name = self.font_name();
        let font = match fonts.get(&font_name) {
            Some(f) => f,
            None => return 0.0,
        };

        let scale = font.scale_for_size(self.font_size);
        let characters = split_text_to_characters(&self.text);

        let mut cur_unwrapped_width = 0.0f32;
        let mut max_unwrapped_width = 0.0f32;
        let mut prev_char_code: Option<u32> = None;

        for c in characters.iter() {
            // Handle newlines - they create new lines, so track max width
            if *c == '\r' || *c == '\n' {
                max_unwrapped_width = max_unwrapped_width.max(cur_unwrapped_width);
                cur_unwrapped_width = 0.0;
                prev_char_code = None;
                continue;
            }

            let char_code = extract_char_code(*c);

            // Get character data
            let char_data = match font.get_char(char_code) {
                Some(c) => c,
                None => continue, // Skip unknown characters
            };

            // Apply kerning
            if let Some(prev) = prev_char_code {
                if let Some(kern) = char_data.kerning.get(&prev) {
                    cur_unwrapped_width += kern;
                }
            }

            // Use max of xAdvance and frame width (matching TS implementation)
            cur_unwrapped_width += char_data.x_advance.max(char_data.frame.width);
            max_unwrapped_width = max_unwrapped_width.max(cur_unwrapped_width);
            prev_char_code = Some(char_code);
        }

        // Add margins (3 * CELL_TEXT_MARGIN_LEFT) and scale
        (max_unwrapped_width + 3.0 * CELL_TEXT_MARGIN_LEFT) * scale
    }

    /// Calculate the final text position based on alignment
    fn calculate_position(&mut self, _scale: f32) {
        // Horizontal positioning
        match self.align {
            CellAlign::Left => {
                self.text_x = self.cell_x;
            }
            CellAlign::Center => {
                self.text_x = self.cell_x + (self.cell_width - self.text_width) / 2.0;
            }
            CellAlign::Right => {
                self.text_x = self.cell_x + self.cell_width - self.text_width;
            }
        }

        // Vertical positioning
        let available_space = self.cell_height - self.text_height;
        let default_extra_space = DEFAULT_CELL_HEIGHT - LINE_HEIGHT;

        if available_space <= default_extra_space {
            // Center for small cells
            self.text_y = self.cell_y + (available_space / 2.0).max(0.0);
        } else {
            match self.vertical_align {
                CellVerticalAlign::Top => {
                    self.text_y = self.cell_y + 2.5; // CELL_VERTICAL_PADDING
                }
                CellVerticalAlign::Middle => {
                    self.text_y = self.cell_y + available_space / 2.0;
                }
                CellVerticalAlign::Bottom => {
                    self.text_y = self.cell_y + self.cell_height - self.text_height - 2.5;
                }
            }
        }
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

        if self.chars.is_empty() {
            return;
        }

        let font_name = self.font_name();
        let font = match fonts.get(&font_name) {
            Some(f) => f,
            None => return,
        };

        let scale = font.scale_for_size(self.font_size);

        // Group glyphs by texture
        let mut meshes: std::collections::HashMap<u32, LabelMesh> =
            std::collections::HashMap::new();

        for char_data in &self.chars {
            let align_offset = self
                .horizontal_align_offsets
                .get(char_data.line)
                .copied()
                .unwrap_or(0.0);

            let x = self.text_x + (char_data.position_x + align_offset) * scale + OPEN_SANS_FIX_X;
            let y = self.text_y + char_data.position_y * scale + OPEN_SANS_FIX_Y;
            let width = char_data.frame_width * scale;
            let height = char_data.frame_height * scale;

            // Clipping check
            let cell_right = self.cell_x + self.cell_width;
            let cell_bottom = self.cell_y + self.cell_height;

            if self.wrap == CellWrap::Clip {
                if x + width < self.cell_x || x > cell_right {
                    continue; // Clipped horizontally
                }
            }

            if y + height < self.cell_y || y > cell_bottom {
                continue; // Clipped vertically
            }

            // Get or create mesh for this texture
            let mesh = meshes.entry(char_data.texture_uid).or_insert_with(|| {
                LabelMesh::new(font_name.clone(), self.font_size, char_data.texture_uid)
            });

            mesh.add_glyph(x, y, width, height, &char_data.uvs, self.color);
        }

        self.cached_meshes = meshes.into_values().collect();
    }

    /// Build the label mesh with glyph data (legacy, non-cached)
    /// Prefer using get_meshes() for better performance
    #[allow(dead_code)]
    pub fn build_mesh(&self, fonts: &BitmapFonts) -> Vec<LabelMesh> {
        if self.chars.is_empty() {
            return Vec::new();
        }

        let font_name = self.font_name();
        let font = match fonts.get(&font_name) {
            Some(f) => f,
            None => return Vec::new(),
        };

        let scale = font.scale_for_size(self.font_size);

        // Group glyphs by texture
        let mut meshes: std::collections::HashMap<u32, LabelMesh> =
            std::collections::HashMap::new();

        for char_data in &self.chars {
            let align_offset = self
                .horizontal_align_offsets
                .get(char_data.line)
                .copied()
                .unwrap_or(0.0);

            let x = self.text_x + (char_data.position_x + align_offset) * scale + OPEN_SANS_FIX_X;
            let y = self.text_y + char_data.position_y * scale + OPEN_SANS_FIX_Y;
            let width = char_data.frame_width * scale;
            let height = char_data.frame_height * scale;

            // Clipping check
            let cell_right = self.cell_x + self.cell_width;
            let cell_bottom = self.cell_y + self.cell_height;

            if self.wrap == CellWrap::Clip {
                if x + width < self.cell_x || x > cell_right {
                    continue; // Clipped horizontally
                }
            }

            if y + height < self.cell_y || y > cell_bottom {
                continue; // Clipped vertically
            }

            // Get or create mesh for this texture
            let mesh = meshes.entry(char_data.texture_uid).or_insert_with(|| {
                LabelMesh::new(font_name.clone(), self.font_size, char_data.texture_uid)
            });

            mesh.add_glyph(x, y, width, height, &char_data.uvs, self.color);
        }

        meshes.into_values().collect()
    }
}
