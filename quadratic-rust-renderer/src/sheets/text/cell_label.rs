//! Cell label - text layout for a single cell
//!
//! Simplified version of CellLabel from TypeScript.
//! Handles basic text layout with alignment and wrapping.

use quadratic_core_shared::{
    CellAlign, CellVerticalAlign, CellWrap, RenderCell, RenderCellFormatSpan,
    RenderCellLinkSpan, SheetOffsets,
};

use super::super::fills::parse_color_string;

use super::bitmap_font::{BitmapFonts, extract_char_code, split_text_to_characters};
use super::emoji_sprites::{is_potential_emoji, EmojiSprites};
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

    /// Per-character color [r, g, b, a] (may differ from cell color due to format spans)
    color: [f32; 4],

    /// Width to next character (for underline/strikethrough calculation)
    x_advance: f32,
}

/// Emoji character data (position info for sprite rendering)
#[derive(Debug, Clone)]
pub struct EmojiCharData {
    /// The emoji string (may be multi-codepoint)
    pub emoji: String,
    /// Position in world coordinates (computed during layout)
    pub x: f32,
    pub y: f32,
    /// Size in world coordinates
    pub width: f32,
    pub height: f32,
    /// Line number (for alignment offset)
    line: usize,
    /// Position in unscaled coordinates (for alignment calculation)
    position_x: f32,
    /// Y position in unscaled coordinates (matching text baseline)
    position_y: f32,
}

/// Line thickness for underline/strikethrough (matching TypeScript)
const HORIZONTAL_LINE_THICKNESS: f32 = 1.0;

/// Underline offset from baseline (matching TypeScript UNDERLINE_OFFSET = 52 / LINE_HEIGHT * scale)
const UNDERLINE_OFFSET_RATIO: f32 = 52.0 / 64.0; // 52/64 based on font metrics

/// Strikethrough offset from baseline (matching TypeScript STRIKE_THROUGH_OFFSET = 32)
const STRIKE_THROUGH_OFFSET_RATIO: f32 = 32.0 / 64.0;

/// A horizontal line (underline or strikethrough)
#[derive(Debug, Clone)]
pub struct HorizontalLine {
    /// X position (world coordinates)
    pub x: f32,
    /// Y position (world coordinates)
    pub y: f32,
    /// Width
    pub width: f32,
    /// Height (thickness)
    pub height: f32,
    /// Color [r, g, b, a]
    pub color: [f32; 4],
}

/// Formatting information for a single character
#[derive(Debug, Clone)]
struct CharFormatting {
    bold: bool,
    italic: bool,
    underline: bool,
    strike_through: bool,
    color: [f32; 4],
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

    /// Underline
    pub underline: bool,

    /// Strike-through
    pub strike_through: bool,

    /// Format spans for RichText inline styling
    format_spans: Vec<RenderCellFormatSpan>,

    /// Link spans for RichText hyperlinks
    link_spans: Vec<RenderCellLinkSpan>,

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

    /// Emoji character data (rendered as sprites, not MSDF text)
    emoji_chars: Vec<EmojiCharData>,

    /// Line widths for alignment
    line_widths: Vec<f32>,

    /// Horizontal alignment offsets per line
    horizontal_align_offsets: Vec<f32>,

    /// Cached mesh data (built once, reused every frame)
    cached_meshes: Vec<LabelMesh>,

    /// Cached horizontal lines (underline/strikethrough)
    cached_horizontal_lines: Vec<HorizontalLine>,

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
            underline: false,
            strike_through: false,
            format_spans: Vec::new(),
            link_spans: Vec::new(),
            text_x: 0.0,
            text_y: 0.0,
            text_width: 0.0,
            text_height: 0.0,
            unwrapped_text_width: 0.0,
            text_height_with_descenders: DEFAULT_CELL_HEIGHT,
            glyph_height: LINE_HEIGHT,
            chars: Vec::new(),
            emoji_chars: Vec::new(),
            line_widths: Vec::new(),
            horizontal_align_offsets: Vec::new(),
            cached_meshes: Vec::new(),
            cached_horizontal_lines: Vec::new(),
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
        label.underline = cell.underline.unwrap_or(false);
        label.strike_through = cell.strike_through.unwrap_or(false);
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

        // Copy format spans for RichText styling
        label.format_spans = cell.format_spans.clone();

        // Copy link spans for RichText hyperlinks
        label.link_spans = cell.link_spans.clone();

        label
    }

    /// Check if this cell has format spans (requiring per-character font/color handling)
    fn has_format_spans(&self) -> bool {
        !self.format_spans.is_empty()
    }

    /// Get bold/italic style for a specific character, merging cell defaults with span overrides
    /// This is a static helper that takes refs to avoid borrow issues
    fn get_style_for_char_static(
        char_index: usize,
        cell_bold: bool,
        cell_italic: bool,
        format_spans: &[RenderCellFormatSpan],
    ) -> (bool, bool) {
        let mut bold = cell_bold;
        let mut italic = cell_italic;

        // Find span containing this character and apply overrides
        for span in format_spans {
            if char_index >= span.start as usize && char_index < span.end as usize {
                if let Some(b) = span.bold {
                    bold = b;
                }
                if let Some(i) = span.italic {
                    italic = i;
                }
                break; // Spans don't overlap
            }
        }

        (bold, italic)
    }

    /// Get the color for a specific character, merging cell default with span override
    /// This is a static helper that takes refs to avoid borrow issues
    fn get_color_for_char_static(
        char_index: usize,
        cell_color: [f32; 4],
        format_spans: &[RenderCellFormatSpan],
    ) -> [f32; 4] {
        // Find span containing this character
        for span in format_spans {
            if char_index >= span.start as usize && char_index < span.end as usize {
                if let Some(ref color_str) = span.text_color {
                    return parse_color_string(color_str);
                }
                break;
            }
        }

        // Use cell default color
        cell_color
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
        self.layout_with_emojis(fonts, None);
    }

    /// Process text and calculate glyph positions, with emoji sprite support
    pub fn layout_with_emojis(&mut self, fonts: &BitmapFonts, emoji_sprites: Option<&EmojiSprites>) {
        self.chars.clear();
        self.emoji_chars.clear();
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

        // Get base font for scale calculation
        let base_font_name = self.font_name();
        let base_font = match fonts.get(&base_font_name) {
            Some(f) => f,
            None => {
                log::warn!("Font not found: {}", base_font_name);
                return;
            }
        };

        let scale = base_font.scale_for_size(self.font_size);
        let line_height = (self.font_size / DEFAULT_FONT_SIZE) * LINE_HEIGHT / scale;
        let max_width = if self.wrap == CellWrap::Wrap {
            Some((self.cell_width - CELL_TEXT_MARGIN_LEFT * 3.0) / scale)
        } else {
            None
        };

        let characters = split_text_to_characters(&self.text);
        let has_spans = self.has_format_spans();

        let mut pos_x = 0.0f32;
        let mut pos_y = 0.0f32;
        let mut line = 0usize;
        let mut last_line_width = 0.0f32;
        let mut max_line_width = 0.0f32;
        let mut prev_char_code: Option<u32> = None;
        let mut last_break_pos: i32 = -1;
        let mut last_break_width = 0.0f32;

        // Track maximum descender extension for glyph height calculation
        let mut max_descender_extension = 0.0f32;
        let font_line_height = base_font.line_height();

        // Use index-based loop to allow resetting index on word wrap
        let mut i = 0usize;
        while i < characters.len() {
            let c = characters[i];
            let char_code = extract_char_code(c);

            // Handle whitespace for word wrapping
            if c.is_whitespace() {
                last_break_pos = i as i32;
                last_break_width = last_line_width;
            }

            // Handle newlines
            if c == '\r' || c == '\n' {
                self.line_widths.push(last_line_width);
                max_line_width = max_line_width.max(last_line_width);
                line += 1;
                pos_x = 0.0;
                pos_y += line_height;
                prev_char_code = None;
                last_break_pos = -1;
                last_line_width = 0.0;
                i += 1;
                continue;
            }

            // Check if this is a potential emoji
            if is_potential_emoji(c) {
                // Try to match an emoji from the spritesheet
                if let Some(sprites) = emoji_sprites {
                    // Try to find an emoji starting at this position
                    // We need to look ahead to handle multi-codepoint emojis
                    if let Some((emoji_str, emoji_len)) =
                        Self::try_extract_emoji(&characters, i, sprites)
                    {
                        // Emoji size matches line height - the SCALE_EMOJI (0.81) was already
                        // applied during spritesheet generation, so we use line_height directly
                        let emoji_size = line_height;

                        // Use line_height as the advance width to match text flow
                        let advance = line_height;

                        log::debug!(
                            "[CellLabel] Found emoji '{}' at pos {} with size {}",
                            emoji_str,
                            pos_x,
                            emoji_size
                        );

                        // Store emoji character data
                        self.emoji_chars.push(EmojiCharData {
                            emoji: emoji_str,
                            x: 0.0, // Will be computed in finalize
                            y: 0.0,
                            width: emoji_size,
                            height: emoji_size,
                            line,
                            position_x: pos_x,
                            position_y: pos_y,  // Store Y position like regular chars
                        });

                        pos_x += advance;
                        last_line_width = pos_x;
                        prev_char_code = None;
                        i += emoji_len;
                        continue;
                    } else {
                        log::debug!(
                            "[CellLabel] Potential emoji char '{}' (U+{:04X}) not found in spritesheet",
                            c,
                            c as u32
                        );
                    }
                }
            }

            // Get the font for this character (may vary due to format spans)
            let char_font = if has_spans {
                let (bold, italic) = Self::get_style_for_char_static(
                    i,
                    self.bold,
                    self.italic,
                    &self.format_spans,
                );
                let font_name = BitmapFonts::get_font_name(bold, italic);
                fonts.get(&font_name).unwrap_or(base_font)
            } else {
                base_font
            };

            // Get character data from the appropriate font
            let char_data = match char_font.get_char(char_code) {
                Some(c) => c,
                None => {
                    i += 1;
                    continue;
                }
            };

            // Apply kerning (only within same font)
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

            // Get color for this character (may vary due to format spans)
            let char_color = if has_spans {
                Self::get_color_for_char_static(i, self.color, &self.format_spans)
            } else {
                self.color
            };

            // Store character render data
            let char_render = CharRenderData {
                position_x: pos_x + char_data.x_offset,
                position_y: pos_y + char_data.y_offset,
                line,
                frame_width: char_data.frame.width,
                frame_height: char_data.frame.height,
                uvs: char_data.uvs,
                texture_uid: char_data.texture_uid,
                color: char_color,
                x_advance: char_data.x_advance,
            };

            self.chars.push(char_render);

            pos_x += char_data.x_advance;
            prev_char_code = Some(char_code);

            // Check for word wrap
            if let Some(max_w) = max_width {
                if pos_x > max_w && char_data.x_advance < max_w {
                    // Need to wrap - figure out where to break
                    let break_at = if last_break_pos >= 0 {
                        last_break_pos as usize
                    } else {
                        i
                    };

                    // Calculate how many chars to remove from self.chars
                    let chars_to_remove = if last_break_pos >= 0 {
                        i - break_at
                    } else {
                        1
                    };

                    // Remove characters after break point
                    for _ in 0..chars_to_remove {
                        self.chars.pop();
                    }

                    // Push line width
                    let width_to_push = if last_break_pos >= 0 {
                        last_break_width
                    } else {
                        last_line_width
                    };
                    self.line_widths.push(width_to_push);
                    max_line_width = max_line_width.max(width_to_push);

                    // Start new line
                    line += 1;
                    pos_x = 0.0;
                    pos_y += line_height;
                    prev_char_code = None;
                    last_line_width = 0.0;

                    // Reset index to reprocess from break point
                    // If we broke at a space, skip it and start from next char
                    i = if last_break_pos >= 0 {
                        (last_break_pos + 1) as usize
                    } else {
                        i // Re-process current char on new line
                    };
                    last_break_pos = -1;
                    continue;
                }
            }

            last_line_width = pos_x;
            i += 1;
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

    /// Try to extract an emoji starting at position `start_idx`
    /// Returns (emoji_string, num_characters_consumed) if found
    fn try_extract_emoji(
        characters: &[char],
        start_idx: usize,
        sprites: &EmojiSprites,
    ) -> Option<(String, usize)> {
        // Try increasingly longer sequences to find the longest matching emoji
        let max_len = (characters.len() - start_idx).min(12); // Most emojis are < 12 codepoints
        let mut best_match: Option<(String, usize)> = None;

        let mut emoji_str = String::new();
        for len in 1..=max_len {
            emoji_str.push(characters[start_idx + len - 1]);

            if sprites.has_emoji(&emoji_str) {
                best_match = Some((emoji_str.clone(), len));
            }
        }

        best_match
    }

    /// Get emoji characters with computed world positions
    /// Call this after layout() and before rendering
    pub fn get_emoji_chars(&self, fonts: &BitmapFonts) -> Vec<EmojiCharData> {
        if self.emoji_chars.is_empty() {
            return Vec::new();
        }

        let font_name = self.font_name();
        let font = match fonts.get(&font_name) {
            Some(f) => f,
            None => return Vec::new(),
        };

        let scale = font.scale_for_size(self.font_size);
        let mut result = Vec::with_capacity(self.emoji_chars.len());

        for emoji in &self.emoji_chars {
            let align_offset = self
                .horizontal_align_offsets
                .get(emoji.line)
                .copied()
                .unwrap_or(0.0);

            // Scale width and height to world coordinates
            let width = emoji.width * scale;
            let height = emoji.height * scale;

            // Calculate horizontal position (same as TypeScript)
            let left = self.text_x + (emoji.position_x + align_offset) * scale + OPEN_SANS_FIX_X;
            let x = left + width / 2.0;

            // Calculate vertical position
            // TypeScript uses: y = charTop + (charBottom - charTop) / 2
            // where charTop = yPos and charBottom = yPos + textureFrame.height * scale
            // For emojis, we position so the center is at the line's vertical center
            let line_top = self.text_y + emoji.position_y * scale + OPEN_SANS_FIX_Y;

            // The center should be positioned at top + height/2 to give correct top-left
            // when rendering subtracts height/2
            let y = line_top + height / 2.0;

            result.push(EmojiCharData {
                emoji: emoji.emoji.clone(),
                x,
                y,
                width,
                height,
                line: emoji.line,
                position_x: emoji.position_x,
                position_y: emoji.position_y,
            });
        }

        result
    }

    /// Get all emoji strings contained in this label
    /// Used for determining which emoji pages need to be loaded
    pub fn get_emoji_strings(&self) -> Vec<&str> {
        self.emoji_chars.iter().map(|e| e.emoji.as_str()).collect()
    }

    /// Check if this label contains any emojis
    pub fn has_emojis(&self) -> bool {
        !self.emoji_chars.is_empty()
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

            // Use per-character color (may differ from cell color due to format spans)
            mesh.add_glyph(x, y, width, height, &char_data.uvs, char_data.color);
        }

        self.cached_meshes = meshes.into_values().collect();

        // Build horizontal lines (underline/strikethrough)
        self.build_horizontal_lines(scale);
    }

    /// Build horizontal lines for underline and strikethrough
    fn build_horizontal_lines(&mut self, scale: f32) {
        self.cached_horizontal_lines.clear();

        if self.chars.is_empty() {
            return;
        }

        // Collect runs of underlined and strikethrough characters
        #[derive(Debug)]
        struct LineRun {
            start_char_idx: usize,
            end_char_idx: usize,
            line: usize,
            is_underline: bool, // true = underline, false = strikethrough
        }

        let mut runs: Vec<LineRun> = Vec::new();

        // Track current runs
        let mut current_underline_start: Option<usize> = None;
        let mut current_underline_line = 0usize;
        let mut current_strike_start: Option<usize> = None;
        let mut current_strike_line = 0usize;

        for i in 0..=self.chars.len() {
            let (has_underline, has_strike, char_line, _char_color) = if i < self.chars.len() {
                let formatting = self.get_char_formatting(i);
                (
                    formatting.underline,
                    formatting.strike_through,
                    self.chars[i].line,
                    self.chars[i].color,
                )
            } else {
                (false, false, usize::MAX, [0.0, 0.0, 0.0, 1.0])
            };

            // Handle underline runs
            if has_underline && current_underline_start.is_none() {
                current_underline_start = Some(i);
                current_underline_line = char_line;
            } else if (!has_underline || char_line != current_underline_line)
                && current_underline_start.is_some()
            {
                runs.push(LineRun {
                    start_char_idx: current_underline_start.unwrap(),
                    end_char_idx: i - 1,
                    line: current_underline_line,
                    is_underline: true,
                });
                current_underline_start = if has_underline { Some(i) } else { None };
                current_underline_line = char_line;
            }

            // Handle strikethrough runs
            if has_strike && current_strike_start.is_none() {
                current_strike_start = Some(i);
                current_strike_line = char_line;
            } else if (!has_strike || char_line != current_strike_line)
                && current_strike_start.is_some()
            {
                runs.push(LineRun {
                    start_char_idx: current_strike_start.unwrap(),
                    end_char_idx: i - 1,
                    line: current_strike_line,
                    is_underline: false,
                });
                current_strike_start = if has_strike { Some(i) } else { None };
                current_strike_line = char_line;
            }
        }

        // Convert runs to horizontal lines
        let line_height_scaled = LINE_HEIGHT * (self.font_size / DEFAULT_FONT_SIZE);

        for run in runs {
            if run.start_char_idx >= self.chars.len() || run.end_char_idx >= self.chars.len() {
                continue;
            }

            let start_char = &self.chars[run.start_char_idx];
            let end_char = &self.chars[run.end_char_idx];

            // Calculate x position (including alignment offset)
            let start_align_offset = self
                .horizontal_align_offsets
                .get(start_char.line)
                .copied()
                .unwrap_or(0.0);
            let end_align_offset = self
                .horizontal_align_offsets
                .get(end_char.line)
                .copied()
                .unwrap_or(0.0);

            let start_x =
                self.text_x + (start_char.position_x + start_align_offset) * scale + OPEN_SANS_FIX_X;
            // End x should include the character width
            let end_x = self.text_x
                + (end_char.position_x + end_char.x_advance + end_align_offset) * scale
                + OPEN_SANS_FIX_X;

            // Calculate y position based on line type
            let base_y = self.text_y + (run.line as f32 * line_height_scaled) + OPEN_SANS_FIX_Y;
            let y = if run.is_underline {
                // Underline is near the bottom of the line
                base_y + line_height_scaled * UNDERLINE_OFFSET_RATIO
            } else {
                // Strikethrough is in the middle of the line
                base_y + line_height_scaled * STRIKE_THROUGH_OFFSET_RATIO
            };

            // Get color from the first character in the run
            let color = start_char.color;

            self.cached_horizontal_lines.push(HorizontalLine {
                x: start_x,
                y,
                width: (end_x - start_x).max(1.0),
                height: HORIZONTAL_LINE_THICKNESS,
                color,
            });
        }
    }

    /// Get character formatting for a specific index
    fn get_char_formatting(&self, char_idx: usize) -> CharFormatting {
        let mut formatting = CharFormatting {
            bold: self.bold,
            italic: self.italic,
            underline: self.underline,
            strike_through: self.strike_through,
            color: self.color,
        };

        // Apply format spans
        for span in &self.format_spans {
            if char_idx >= span.start as usize && char_idx < span.end as usize {
                if let Some(bold) = span.bold {
                    formatting.bold = bold;
                }
                if let Some(italic) = span.italic {
                    formatting.italic = italic;
                }
                if let Some(underline) = span.underline {
                    formatting.underline = underline;
                }
                if let Some(strike_through) = span.strike_through {
                    formatting.strike_through = strike_through;
                }
                if let Some(ref color_str) = span.text_color {
                    formatting.color = parse_color_string(color_str);
                }
            }
        }

        // Check for link spans (links are underlined by default)
        for span in &self.link_spans {
            if char_idx >= span.start as usize && char_idx < span.end as usize {
                formatting.underline = true;
                // Links are typically blue, but we keep the text color
                break;
            }
        }

        formatting
    }

    /// Get cached horizontal lines (underline/strikethrough)
    pub fn get_horizontal_lines(&mut self, fonts: &BitmapFonts) -> &[HorizontalLine] {
        if self.mesh_dirty {
            self.rebuild_mesh_cache(fonts);
            self.mesh_dirty = false;
        }
        &self.cached_horizontal_lines
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

            // Use per-character color (may differ from cell color due to format spans)
            mesh.add_glyph(x, y, width, height, &char_data.uvs, char_data.color);
        }

        meshes.into_values().collect()
    }
}
