//! Cell label - text layout for a single cell
//!
//! This module handles text layout computation for cells, producing mesh data
//! that can be rendered by any consumer (WASM renderer, native, etc.).
//!
//! Simplified version of CellLabel from TypeScript.
//! Handles basic text layout with alignment and wrapping.

use quadratic_core::grid::formatting::{CellAlign, CellVerticalAlign, CellWrap};
use quadratic_core::sheet_offsets::SheetOffsets;

use crate::emoji_loader::EMOJI_Y_OFFSET_RATIO;
use crate::types::{RenderCell, RenderCellFormatSpan, RenderCellLinkSpan, RenderCellSpecial};

use super::bitmap_font::{extract_char_code, split_text_to_characters, BitmapFonts};
use super::horizontal_line::HorizontalLine;
use super::label_mesh::LabelMesh;

/// Grid constants (matching TypeScript)
pub const CELL_TEXT_MARGIN_LEFT: f32 = 3.0;
pub const DEFAULT_FONT_SIZE: f32 = 14.0;
pub const LINE_HEIGHT: f32 = 16.0;
pub const DEFAULT_CELL_HEIGHT: f32 = 21.0;
pub const CELL_VERTICAL_PADDING: f32 = 2.5;

/// Extra left padding for table name cells to make room for language icons
pub const TABLE_NAME_ICON_PADDING: f32 = 20.0;

/// OpenSans rendering fix (magic numbers from TypeScript)
pub const OPEN_SANS_FIX_X: f32 = 1.8;
pub const OPEN_SANS_FIX_Y: f32 = -1.8;

/// Line thickness for underline/strikethrough (matching TypeScript)
const HORIZONTAL_LINE_THICKNESS: f32 = 1.0;

/// Underline offset from baseline (matching TypeScript UNDERLINE_OFFSET = 52 / LINE_HEIGHT * scale)
const UNDERLINE_OFFSET_RATIO: f32 = 52.0 / 64.0;

/// Strikethrough offset from baseline (matching TypeScript STRIKE_THROUGH_OFFSET = 32)
const STRIKE_THROUGH_OFFSET_RATIO: f32 = 32.0 / 64.0;

// =============================================================================
// Emoji lookup trait
// =============================================================================

/// Trait for emoji lookup during layout
///
/// This allows the layout engine to check for emoji characters without
/// depending on WASM-specific sprite loading code.
pub trait EmojiLookup {
    /// Check if a character is potentially an emoji (fast heuristic)
    fn is_potential_emoji(&self, c: char) -> bool;

    /// Check if an emoji string exists in the spritesheet
    fn has_emoji(&self, emoji: &str) -> bool;
}

/// Check if a character is likely an emoji (basic heuristic)
///
/// This is a fast check to avoid HashMap lookups for regular ASCII characters.
/// Returns true if the character *might* be an emoji (requires further lookup).
pub fn is_potential_emoji(c: char) -> bool {
    let code = c as u32;

    matches!(
        code,
        0x1F300..=0x1F5FF  // Misc Symbols & Pictographs (includes skin tones)
            | 0x1F600..=0x1F64F  // Emoticons
            | 0x1F680..=0x1F6FF  // Transport & Map
            | 0x1F900..=0x1F9FF  // Supplemental Symbols
            | 0x1FA00..=0x1FAFF  // Extended-A
            | 0x2600..=0x27BF    // Misc Symbols + Dingbats
            | 0x1F1E0..=0x1F1FF  // Regional Indicators (flags)
            | 0x2190..=0x21FF    // Arrows
            | 0x2200..=0x22FF    // Math operators
            | 0x25A0..=0x25FF    // Geometric shapes
            | 0x00A9            // ©
            | 0x00AE            // ®
            | 0x2122            // ™
            | 0x203C            // ‼
            | 0x2049            // ⁉
            | 0xFE0F            // Variation selector (emoji presentation)
            | 0x200D            // Zero-width joiner (for ZWJ sequences)
    )
}

// =============================================================================
// Internal types
// =============================================================================

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

/// Formatting information for a single character
#[derive(Debug, Clone)]
struct CharFormatting {
    bold: bool,
    italic: bool,
    underline: bool,
    strike_through: bool,
    color: [f32; 4],
}

// =============================================================================
// CellLabel
// =============================================================================

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

    /// Whether this is a table name cell (needs extra left padding for icon)
    is_table_name: bool,

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

    // === Overflow and clipping for neighbor content ===

    /// How much text overflows to the left of the cell bounds
    overflow_left: f32,

    /// How much text overflows to the right of the cell bounds
    overflow_right: f32,

    /// Clip boundary from neighbor content to the left (in world coordinates)
    clip_left: Option<f32>,

    /// Clip boundary from neighbor content to the right (in world coordinates)
    clip_right: Option<f32>,
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
            is_table_name: false,
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
            overflow_left: 0.0,
            overflow_right: 0.0,
            clip_left: None,
            clip_right: None,
        }
    }

    /// Create a CellLabel from a RenderCell (bincode-decoded data from core)
    ///
    /// This converts the core's RenderCell format into the renderer's internal
    /// CellLabel format, applying all styling and formatting options.
    pub fn from_render_cell(cell: &RenderCell) -> Self {
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

        // Apply text color (already parsed to Rgba)
        if let Some(ref color) = cell.text_color {
            label.color = color.to_f32_array();
        }

        // Apply alignment
        label.align = cell.align.unwrap_or(CellAlign::Left);
        label.vertical_align = cell.vertical_align.unwrap_or(CellVerticalAlign::Top);

        // Determine wrap mode:
        // - Table name rows and column headers are always clipped
        // - Other table cells (column_header implies table) default to clip, can be wrap, but never overflow
        let is_table_name = cell.table_name.unwrap_or(false);
        let is_column_header = cell.column_header.unwrap_or(false);

        // Store table name flag for icon padding
        label.is_table_name = is_table_name;

        if is_table_name || is_column_header {
            // Table headers are always clipped
            label.wrap = CellWrap::Clip;
        } else {
            // Regular cells use their wrap setting
            label.wrap = cell.wrap.unwrap_or_default();
        }

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
    fn get_style_for_char_static(
        char_index: usize,
        cell_bold: bool,
        cell_italic: bool,
        format_spans: &[RenderCellFormatSpan],
    ) -> (bool, bool) {
        let mut bold = cell_bold;
        let mut italic = cell_italic;

        for span in format_spans {
            if char_index >= span.start as usize && char_index < span.end as usize {
                if let Some(b) = span.bold {
                    bold = b;
                }
                if let Some(i) = span.italic {
                    italic = i;
                }
                break;
            }
        }

        (bold, italic)
    }

    /// Get the color for a specific character, merging cell default with span override
    fn get_color_for_char_static(
        char_index: usize,
        cell_color: [f32; 4],
        format_spans: &[RenderCellFormatSpan],
    ) -> [f32; 4] {
        for span in format_spans {
            if char_index >= span.start as usize && char_index < span.end as usize {
                if let Some(ref color) = span.text_color {
                    return color.to_f32_array();
                }
                break;
            }
        }
        cell_color
    }

    /// Update cell bounds from sheet offsets
    pub fn update_bounds(&mut self, offsets: &SheetOffsets) {
        let (x, width) = offsets.column_position_size(self.col);
        let (y, height) = offsets.row_position_size(self.row);

        // Apply extra left padding for table names (to make room for language icons)
        let icon_padding = if self.is_table_name {
            TABLE_NAME_ICON_PADDING
        } else {
            0.0
        };

        self.cell_x = x as f32 + icon_padding;
        self.cell_y = y as f32;
        self.cell_width = (width as f32 - icon_padding).max(0.0);
        self.cell_height = height as f32;
        self.mesh_dirty = true;
    }

    // === Accessors ===

    #[inline]
    pub fn col(&self) -> i64 {
        self.col
    }

    #[inline]
    pub fn row(&self) -> i64 {
        self.row
    }

    #[inline]
    pub fn x(&self) -> f32 {
        self.cell_x
    }

    #[inline]
    pub fn y(&self) -> f32 {
        self.cell_y
    }

    #[inline]
    pub fn width(&self) -> f32 {
        self.cell_width
    }

    #[inline]
    pub fn height(&self) -> f32 {
        self.cell_height
    }

    #[inline]
    pub fn unwrapped_text_width(&self) -> f32 {
        self.unwrapped_text_width
    }

    #[inline]
    pub fn text_height_with_descenders(&self) -> f32 {
        self.text_height_with_descenders
    }

    /// Get the font name based on style
    fn font_name(&self) -> String {
        BitmapFonts::get_font_name(self.bold, self.italic)
    }

    // =========================================================================
    // Layout
    // =========================================================================

    /// Process text and calculate glyph positions (no emoji support)
    pub fn layout(&mut self, fonts: &BitmapFonts) {
        self.layout_with_emojis::<NoEmoji>(fonts, None);
    }

    /// Process text and calculate glyph positions, with emoji sprite support
    pub fn layout_with_emojis<E: EmojiLookup>(
        &mut self,
        fonts: &BitmapFonts,
        emoji_lookup: Option<&E>,
    ) {
        self.chars.clear();
        self.emoji_chars.clear();
        self.line_widths.clear();
        self.horizontal_align_offsets.clear();
        self.mesh_dirty = true;

        if self.text.is_empty() {
            self.text_width = 0.0;
            self.text_height = LINE_HEIGHT;
            self.unwrapped_text_width = 0.0;
            self.glyph_height = LINE_HEIGHT;
            self.text_height_with_descenders = LINE_HEIGHT + CELL_VERTICAL_PADDING * 2.0;
            return;
        }

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

        let mut max_descender_extension = 0.0f32;
        let font_line_height = base_font.line_height();

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
                if let Some(lookup) = emoji_lookup {
                    if let Some((emoji_str, emoji_len)) =
                        Self::try_extract_emoji(&characters, i, lookup)
                    {
                        let emoji_size = line_height;
                        let advance = line_height;

                        self.emoji_chars.push(EmojiCharData {
                            emoji: emoji_str,
                            x: 0.0,
                            y: 0.0,
                            width: emoji_size,
                            height: emoji_size,
                            line,
                            position_x: pos_x,
                            position_y: pos_y,
                        });

                        pos_x += advance;
                        last_line_width = pos_x;
                        prev_char_code = None;
                        i += emoji_len;
                        continue;
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

            let char_data = match char_font.get_char(char_code) {
                Some(c) => c,
                None => {
                    i += 1;
                    continue;
                }
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

            // Get color for this character
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
                    let break_at = if last_break_pos >= 0 {
                        last_break_pos as usize
                    } else {
                        i
                    };

                    let chars_to_remove = if last_break_pos >= 0 {
                        i - break_at
                    } else {
                        1
                    };

                    for _ in 0..chars_to_remove {
                        self.chars.pop();
                    }

                    let width_to_push = if last_break_pos >= 0 {
                        last_break_width
                    } else {
                        last_line_width
                    };
                    self.line_widths.push(width_to_push);
                    max_line_width = max_line_width.max(width_to_push);

                    line += 1;
                    pos_x = 0.0;
                    pos_y += line_height;
                    prev_char_code = None;
                    last_line_width = 0.0;

                    i = if last_break_pos >= 0 {
                        (last_break_pos + 1) as usize
                    } else {
                        i
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

        // Calculate unwrapped text width
        self.unwrapped_text_width = self.calculate_unwrapped_text_width(fonts);

        // Calculate glyph height including descenders
        let calculated_text_height = line_height * (line + 1) as f32;
        self.glyph_height = (calculated_text_height + max_descender_extension) * scale;
        self.text_height_with_descenders =
            (self.glyph_height + CELL_VERTICAL_PADDING * 2.0).round();

        // Calculate text position based on alignment
        self.calculate_position(scale);
    }

    /// Calculate the unwrapped text width (ignoring wrap settings)
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
            if *c == '\r' || *c == '\n' {
                max_unwrapped_width = max_unwrapped_width.max(cur_unwrapped_width);
                cur_unwrapped_width = 0.0;
                prev_char_code = None;
                continue;
            }

            let char_code = extract_char_code(*c);

            let char_data = match font.get_char(char_code) {
                Some(c) => c,
                None => continue,
            };

            if let Some(prev) = prev_char_code {
                if let Some(kern) = char_data.kerning.get(&prev) {
                    cur_unwrapped_width += kern;
                }
            }

            cur_unwrapped_width += char_data.x_advance.max(char_data.frame.width);
            max_unwrapped_width = max_unwrapped_width.max(cur_unwrapped_width);
            prev_char_code = Some(char_code);
        }

        (max_unwrapped_width + 3.0 * CELL_TEXT_MARGIN_LEFT) * scale
    }

    /// Try to extract an emoji starting at position `start_idx`
    fn try_extract_emoji<E: EmojiLookup>(
        characters: &[char],
        start_idx: usize,
        lookup: &E,
    ) -> Option<(String, usize)> {
        let max_len = (characters.len() - start_idx).min(12);
        let mut best_match: Option<(String, usize)> = None;

        let mut emoji_str = String::new();
        for len in 1..=max_len {
            emoji_str.push(characters[start_idx + len - 1]);

            if lookup.has_emoji(&emoji_str) {
                best_match = Some((emoji_str.clone(), len));
            }
        }

        best_match
    }

    /// Get emoji characters with computed world positions
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

        // Calculate scaled line height for Y offset (matching TypeScript)
        let scaled_line_height = (self.font_size / DEFAULT_FONT_SIZE) * LINE_HEIGHT;
        let y_offset = scaled_line_height * EMOJI_Y_OFFSET_RATIO;

        for emoji in &self.emoji_chars {
            let align_offset = self
                .horizontal_align_offsets
                .get(emoji.line)
                .copied()
                .unwrap_or(0.0);

            let width = emoji.width * scale;
            let height = emoji.height * scale;

            let left = self.text_x + (emoji.position_x + align_offset) * scale + OPEN_SANS_FIX_X;
            let x = left + width / 2.0;

            let line_top = self.text_y + emoji.position_y * scale + OPEN_SANS_FIX_Y + y_offset;
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
    pub fn get_emoji_strings(&self) -> Vec<&str> {
        self.emoji_chars.iter().map(|e| e.emoji.as_str()).collect()
    }

    /// Check if this label contains any emojis
    pub fn has_emojis(&self) -> bool {
        !self.emoji_chars.is_empty()
    }

    /// Calculate the final text position based on alignment
    fn calculate_position(&mut self, _scale: f32) {
        self.overflow_left = 0.0;
        self.overflow_right = 0.0;

        let cell_left = self.cell_x;
        let cell_right = self.cell_x + self.cell_width;

        // Horizontal positioning and overflow calculation
        match self.align {
            CellAlign::Left => {
                self.text_x = self.cell_x;
                let text_right = self.text_x + self.text_width;
                if text_right > cell_right {
                    self.overflow_right = text_right - cell_right;
                }
            }
            CellAlign::Center => {
                self.text_x = self.cell_x + (self.cell_width - self.text_width) / 2.0;
                let text_left = self.text_x;
                let text_right = self.text_x + self.text_width;
                if text_left < cell_left {
                    self.overflow_left = cell_left - text_left;
                }
                if text_right > cell_right {
                    self.overflow_right = text_right - cell_right;
                }
            }
            CellAlign::Right => {
                self.text_x = self.cell_x + self.cell_width - self.text_width;
                let text_left = self.text_x;
                if text_left < cell_left {
                    self.overflow_left = cell_left - text_left;
                }
            }
        }

        // Vertical positioning
        let available_space = self.cell_height - self.text_height;
        let default_extra_space = DEFAULT_CELL_HEIGHT - LINE_HEIGHT;

        if available_space <= default_extra_space {
            self.text_y = self.cell_y + (available_space / 2.0).max(0.0);
        } else {
            match self.vertical_align {
                CellVerticalAlign::Top => {
                    self.text_y = self.cell_y + CELL_VERTICAL_PADDING;
                }
                CellVerticalAlign::Middle => {
                    self.text_y = self.cell_y + available_space / 2.0;
                }
                CellVerticalAlign::Bottom => {
                    self.text_y =
                        self.cell_y + self.cell_height - self.text_height - CELL_VERTICAL_PADDING;
                }
            }
        }
    }

    // =========================================================================
    // Overflow and clipping
    // =========================================================================

    #[inline]
    pub fn overflow_left(&self) -> f32 {
        self.overflow_left
    }

    #[inline]
    pub fn overflow_right(&self) -> f32 {
        self.overflow_right
    }

    #[inline]
    pub fn has_overflow_left(&self) -> bool {
        self.overflow_left > 0.0
    }

    #[inline]
    pub fn has_overflow_right(&self) -> bool {
        self.overflow_right > 0.0
    }

    pub fn set_clip_left(&mut self, clip_x: f32) {
        self.clip_left = Some(clip_x);
        self.mesh_dirty = true;
    }

    pub fn set_clip_right(&mut self, clip_x: f32) {
        self.clip_right = Some(clip_x);
        self.mesh_dirty = true;
    }

    /// Get the current clip_left value
    #[inline]
    pub fn clip_left(&self) -> Option<f32> {
        self.clip_left
    }

    /// Get the current clip_right value
    #[inline]
    pub fn clip_right(&self) -> Option<f32> {
        self.clip_right
    }

    pub fn clear_clip_left(&mut self) {
        if self.clip_left.is_some() {
            self.clip_left = None;
            self.mesh_dirty = true;
        }
    }

    pub fn clear_clip_right(&mut self) {
        if self.clip_right.is_some() {
            self.clip_right = None;
            self.mesh_dirty = true;
        }
    }

    #[inline]
    pub fn effective_clip_left(&self) -> f32 {
        self.clip_left.unwrap_or(self.cell_x)
    }

    #[inline]
    pub fn effective_clip_right(&self) -> f32 {
        self.clip_right.unwrap_or(self.cell_x + self.cell_width)
    }

    #[inline]
    pub fn text_left(&self) -> f32 {
        self.text_x
    }

    #[inline]
    pub fn text_right(&self) -> f32 {
        self.text_x + self.text_width
    }

    #[inline]
    pub fn cell_left(&self) -> f32 {
        self.cell_x
    }

    #[inline]
    pub fn cell_right(&self) -> f32 {
        self.cell_x + self.cell_width
    }

    // =========================================================================
    // Mesh building
    // =========================================================================

    /// Get cached meshes, rebuilding if dirty
    pub fn get_meshes(&mut self, fonts: &BitmapFonts) -> &[LabelMesh] {
        if self.mesh_dirty {
            self.rebuild_mesh_cache(fonts);
            self.mesh_dirty = false;
        }
        &self.cached_meshes
    }

    /// Rebuild the mesh cache
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

        // Calculate effective clip boundaries
        let (clip_left, clip_right) = if self.wrap == CellWrap::Clip {
            (self.cell_x, self.cell_x + self.cell_width)
        } else {
            let left = self.clip_left.unwrap_or(f32::NEG_INFINITY);
            let right = self.clip_right.unwrap_or(f32::INFINITY);
            (left, right)
        };

        let cell_bottom = self.cell_y + self.cell_height;

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

            // Horizontal clipping
            if x < clip_left || x + width > clip_right {
                continue;
            }

            // Vertical clipping
            if y + height < self.cell_y || y > cell_bottom {
                continue;
            }

            let mesh = meshes.entry(char_data.texture_uid).or_insert_with(|| {
                LabelMesh::new(font_name.clone(), self.font_size, char_data.texture_uid)
            });

            mesh.add_glyph(x, y, width, height, &char_data.uvs, char_data.color);
        }

        self.cached_meshes = meshes.into_values().collect();

        // Build horizontal lines
        self.build_horizontal_lines(scale);
    }

    /// Build horizontal lines for underline and strikethrough
    fn build_horizontal_lines(&mut self, scale: f32) {
        self.cached_horizontal_lines.clear();

        if self.chars.is_empty() {
            return;
        }

        #[derive(Debug)]
        struct LineRun {
            start_char_idx: usize,
            end_char_idx: usize,
            line: usize,
            is_underline: bool,
        }

        let mut runs: Vec<LineRun> = Vec::new();

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
            let end_x = self.text_x
                + (end_char.position_x + end_char.x_advance + end_align_offset) * scale
                + OPEN_SANS_FIX_X;

            let base_y = self.text_y + (run.line as f32 * line_height_scaled) + OPEN_SANS_FIX_Y;
            let y = if run.is_underline {
                base_y + line_height_scaled * UNDERLINE_OFFSET_RATIO
            } else {
                base_y + line_height_scaled * STRIKE_THROUGH_OFFSET_RATIO
            };

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
                if let Some(ref color) = span.text_color {
                    formatting.color = color.to_f32_array();
                }
            }
        }

        // Check for link spans
        for span in &self.link_spans {
            if char_idx >= span.start as usize && char_idx < span.end as usize {
                formatting.underline = true;
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

    /// Get cached horizontal lines without rebuilding (for immutable access)
    /// Returns empty slice if cache is dirty
    pub fn get_cached_horizontal_lines(&self) -> &[HorizontalLine] {
        if self.mesh_dirty {
            &[]
        } else {
            &self.cached_horizontal_lines
        }
    }

    /// Get text buffers for transfer to renderer
    /// This builds meshes if dirty and converts to TextBuffer format
    pub fn get_text_buffers(&mut self, fonts: &BitmapFonts) -> Vec<crate::types::TextBuffer> {
        let meshes = self.get_meshes(fonts);
        meshes.iter().map(|m| m.to_text_buffer()).collect()
    }
}

// =============================================================================
// NoEmoji - dummy implementation for layout without emoji support
// =============================================================================

/// Dummy emoji lookup that never finds emojis
pub struct NoEmoji;

impl EmojiLookup for NoEmoji {
    fn is_potential_emoji(&self, _c: char) -> bool {
        false
    }

    fn has_emoji(&self, _emoji: &str) -> bool {
        false
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_is_potential_emoji() {
        assert!(is_potential_emoji('😀'));
        assert!(is_potential_emoji('🎉'));
        assert!(is_potential_emoji('❤'));
        assert!(!is_potential_emoji('A'));
        assert!(!is_potential_emoji('1'));
        assert!(!is_potential_emoji(' '));
    }

    #[test]
    fn test_cell_label_new() {
        let label = CellLabel::new("Hello".to_string(), 1, 1);
        assert_eq!(label.text, "Hello");
        assert_eq!(label.col, 1);
        assert_eq!(label.row, 1);
        assert_eq!(label.font_size, DEFAULT_FONT_SIZE);
    }
}
