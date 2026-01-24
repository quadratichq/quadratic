//! Render request types

use quadratic_core::grid::CodeCellLanguage;
use quadratic_core::sheet_offsets::SheetOffsets;
use quadratic_renderer_core::{RenderCell, RenderFill, SheetBorders, TableOutlines};

/// A rectangular exclusion zone where grid lines should not be drawn
/// (e.g., chart areas)
#[derive(Debug, Clone)]
pub struct GridExclusionZone {
    /// Left position in world coordinates
    pub left: f32,
    /// Top position in world coordinates
    pub top: f32,
    /// Right position in world coordinates
    pub right: f32,
    /// Bottom position in world coordinates
    pub bottom: f32,
}

/// A chart image to render (e.g., Python chart output)
#[derive(Debug, Clone)]
pub struct ChartImage {
    /// X position in cell coordinates
    pub x: i64,
    /// Y position in cell coordinates
    pub y: i64,
    /// Width in pixels (from chart_output)
    pub width: u32,
    /// Height in pixels (from chart_output)
    pub height: u32,
    /// Base64-encoded WebP image data
    pub image_data: String,
}

impl ChartImage {
    /// Decode the base64 image data to raw RGBA bytes
    pub fn decode_image(&self) -> anyhow::Result<(Vec<u8>, u32, u32)> {
        use base64::Engine;

        // Strip data URL prefix if present (e.g., "data:image/webp;base64,")
        let base64_data = if let Some(comma_pos) = self.image_data.find(',') {
            &self.image_data[comma_pos + 1..]
        } else {
            &self.image_data
        };

        // Decode base64
        let bytes = base64::engine::general_purpose::STANDARD
            .decode(base64_data)
            .map_err(|e| anyhow::anyhow!("Failed to decode base64: {}", e))?;

        // Load and decode the image (WebP or other format)
        let img = image::load_from_memory(&bytes)
            .map_err(|e| anyhow::anyhow!("Failed to decode image: {}", e))?;

        let rgba = img.into_rgba8();
        let (width, height) = (rgba.width(), rgba.height());

        Ok((rgba.into_raw(), width, height))
    }
}

/// A table name with language icon info
#[derive(Debug, Clone)]
pub struct TableNameIcon {
    /// X position in cell coordinates
    pub x: i64,
    /// Y position in cell coordinates
    pub y: i64,
    /// The language of the code cell
    pub language: CodeCellLanguage,
}

impl TableNameIcon {
    /// Get the icon filename for this language
    pub fn icon_filename(&self) -> Option<&'static str> {
        match &self.language {
            CodeCellLanguage::Python => Some("icon-python.png"),
            CodeCellLanguage::Formula => Some("icon-formula.png"),
            CodeCellLanguage::Javascript => Some("icon-javascript.png"),
            CodeCellLanguage::Connection { .. } => Some("icon-connection.png"),
            CodeCellLanguage::Import => None, // No icon for import
        }
    }

    /// Get a unique key for this language (for texture caching)
    pub fn language_key(&self) -> &'static str {
        match &self.language {
            CodeCellLanguage::Python => "python",
            CodeCellLanguage::Formula => "formula",
            CodeCellLanguage::Javascript => "javascript",
            CodeCellLanguage::Connection { .. } => "connection",
            CodeCellLanguage::Import => "import",
        }
    }
}

/// A range of cells to render (1-indexed, inclusive)
#[derive(Debug, Clone, Copy)]
pub struct SelectionRange {
    /// Start column (1-indexed)
    pub start_col: i64,
    /// Start row (1-indexed)
    pub start_row: i64,
    /// End column (1-indexed, inclusive)
    pub end_col: i64,
    /// End row (1-indexed, inclusive)
    pub end_row: i64,
}

impl SelectionRange {
    /// Create a new selection range
    pub fn new(start_col: i64, start_row: i64, end_col: i64, end_row: i64) -> Self {
        Self {
            start_col: start_col.min(end_col),
            start_row: start_row.min(end_row),
            end_col: start_col.max(end_col),
            end_row: start_row.max(end_row),
        }
    }

    /// Create a selection for a single cell
    pub fn single_cell(col: i64, row: i64) -> Self {
        Self::new(col, row, col, row)
    }

    /// Get the number of columns
    pub fn width(&self) -> i64 {
        self.end_col - self.start_col + 1
    }

    /// Get the number of rows
    pub fn height(&self) -> i64 {
        self.end_row - self.start_row + 1
    }

    /// Get world bounds using sheet offsets
    pub fn world_bounds(&self, offsets: &SheetOffsets) -> (f32, f32, f32, f32) {
        let (x, _) = offsets.column_position_size(self.start_col);
        let (y, _) = offsets.row_position_size(self.start_row);
        let (end_x, end_w) = offsets.column_position_size(self.end_col);
        let (end_y, end_h) = offsets.row_position_size(self.end_row);

        (
            x as f32,
            y as f32,
            (end_x + end_w - x) as f32,
            (end_y + end_h - y) as f32,
        )
    }
}

impl Default for SelectionRange {
    fn default() -> Self {
        Self::new(1, 1, 10, 10)
    }
}

/// Request to render a portion of a sheet
#[derive(Debug, Clone)]
pub struct RenderRequest {
    /// The cell range to render
    pub selection: SelectionRange,

    /// Output image width in pixels
    pub width: u32,

    /// Output image height in pixels
    pub height: u32,

    /// Optional scale factor (default 1.0)
    /// Values > 1.0 zoom in, < 1.0 zoom out
    pub scale: Option<f32>,

    /// Sheet offsets (column widths, row heights)
    pub offsets: SheetOffsets,

    /// Cell fills to render
    pub fills: Vec<RenderFill>,

    /// Cell text to render
    pub cells: Vec<RenderCell>,

    /// Cell borders to render
    pub borders: SheetBorders,

    /// Table outlines to render
    pub table_outlines: TableOutlines,

    /// Chart images to render (e.g., Python chart output)
    pub chart_images: Vec<ChartImage>,

    /// Table name icons to render (language icons for code cells)
    pub table_name_icons: Vec<TableNameIcon>,

    /// Background color [r, g, b, a] (default white)
    pub background_color: Option<[f32; 4]>,

    /// Whether to render grid lines
    pub show_grid_lines: bool,

    /// Exclusion zones where grid lines should not be drawn (e.g., chart areas)
    pub grid_exclusion_zones: Vec<GridExclusionZone>,
}

impl RenderRequest {
    /// Create a new render request with minimal parameters
    pub fn new(selection: SelectionRange, width: u32, height: u32) -> Self {
        Self {
            selection,
            width,
            height,
            scale: None,
            offsets: SheetOffsets::default(),
            fills: Vec::new(),
            cells: Vec::new(),
            borders: SheetBorders::new(),
            table_outlines: TableOutlines::new(),
            chart_images: Vec::new(),
            table_name_icons: Vec::new(),
            background_color: None,
            show_grid_lines: true,
            grid_exclusion_zones: Vec::new(),
        }
    }

    /// Calculate the viewport position and scale to fit the selection exactly
    pub fn calculate_viewport(&self) -> (f32, f32, f32) {
        let (world_x, world_y, world_w, world_h) = self.selection.world_bounds(&self.offsets);

        // Add 1-pixel buffer on each edge so lines are visible
        let buffer = 1.0;
        let total_buffer = buffer * 2.0; // left+right, top+bottom

        // Calculate scale to fit selection in output size minus buffers on both sides
        // When dimensions are calculated from aspect ratio, scale_x ≈ scale_y
        let scale_x = (self.width as f32 - total_buffer) / world_w;
        let scale_y = (self.height as f32 - total_buffer) / world_h;

        // Use provided scale or the minimum to ensure content fits
        let scale = self.scale.unwrap_or_else(|| scale_x.min(scale_y));

        // Offset viewport to create buffer (shift content right/down by 1 pixel)
        let viewport_x = world_x - buffer / scale;
        let viewport_y = world_y - buffer / scale;

        (viewport_x, viewport_y, scale)
    }

    /// Get background color (default white)
    pub fn background(&self) -> [f32; 4] {
        self.background_color.unwrap_or([1.0, 1.0, 1.0, 1.0])
    }
}
