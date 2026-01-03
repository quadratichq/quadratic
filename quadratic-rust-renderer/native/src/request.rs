//! Render request types

use quadratic_core_shared::SheetOffsets;

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
    pub fills: Vec<CellFill>,

    /// Cell text to render
    pub text: Vec<CellText>,

    /// Background color [r, g, b, a] (default white)
    pub background_color: Option<[f32; 4]>,

    /// Whether to render grid lines
    pub show_grid_lines: bool,
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
            text: Vec::new(),
            background_color: None,
            show_grid_lines: true,
        }
    }

    /// Calculate the viewport position and scale to fit the selection
    pub fn calculate_viewport(&self) -> (f32, f32, f32) {
        let (world_x, world_y, world_w, world_h) = self.selection.world_bounds(&self.offsets);

        // Calculate scale to fit selection in output size
        let scale_x = self.width as f32 / world_w;
        let scale_y = self.height as f32 / world_h;
        let auto_scale = scale_x.min(scale_y);

        // Use provided scale or auto-calculated
        let scale = self.scale.unwrap_or(auto_scale);

        // Center the selection in the viewport
        let scaled_w = world_w * scale;
        let scaled_h = world_h * scale;
        let offset_x = (self.width as f32 - scaled_w) / 2.0 / scale;
        let offset_y = (self.height as f32 - scaled_h) / 2.0 / scale;

        (world_x - offset_x, world_y - offset_y, scale)
    }

    /// Get background color (default white)
    pub fn background(&self) -> [f32; 4] {
        self.background_color.unwrap_or([1.0, 1.0, 1.0, 1.0])
    }
}

/// A cell fill (background color)
#[derive(Debug, Clone)]
pub struct CellFill {
    /// Column (1-indexed)
    pub col: i64,
    /// Row (1-indexed)
    pub row: i64,
    /// Fill color [r, g, b, a]
    pub color: [f32; 4],
}

impl CellFill {
    pub fn new(col: i64, row: i64, color: [f32; 4]) -> Self {
        Self { col, row, color }
    }
}

/// Cell text content
#[derive(Debug, Clone)]
pub struct CellText {
    /// Column (1-indexed)
    pub col: i64,
    /// Row (1-indexed)
    pub row: i64,
    /// Text content
    pub text: String,
    /// Text color [r, g, b, a]
    pub color: [f32; 4],
    /// Font size (default 14.0)
    pub font_size: f32,
    /// Bold
    pub bold: bool,
    /// Italic
    pub italic: bool,
}

impl CellText {
    pub fn new(col: i64, row: i64, text: impl Into<String>) -> Self {
        Self {
            col,
            row,
            text: text.into(),
            color: [0.0, 0.0, 0.0, 1.0], // Black
            font_size: 14.0,
            bold: false,
            italic: false,
        }
    }

    pub fn with_color(mut self, color: [f32; 4]) -> Self {
        self.color = color;
        self
    }

    pub fn with_font_size(mut self, size: f32) -> Self {
        self.font_size = size;
        self
    }

    pub fn bold(mut self) -> Self {
        self.bold = true;
        self
    }

    pub fn italic(mut self) -> Self {
        self.italic = true;
        self
    }
}
