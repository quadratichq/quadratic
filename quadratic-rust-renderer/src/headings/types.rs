//! Shared types and constants for grid headings

/// Constants matching the TypeScript client
pub const CELL_WIDTH: f32 = 100.0;
pub const CELL_HEIGHT: f32 = 21.0;

/// Maximum percentage of cell width a label can occupy before skipping
pub const LABEL_MAXIMUM_WIDTH_PERCENT: f32 = 0.9;
pub const LABEL_MAXIMUM_HEIGHT_PERCENT: f32 = 0.5;

/// Padding for row labels (in CSS pixels)
pub const LABEL_PADDING_ROWS: f32 = 2.0;

/// Row digit offset (matches TypeScript ROW_DIGIT_OFFSET)
pub const ROW_DIGIT_OFFSET_X: f32 = 0.0;
pub const ROW_DIGIT_OFFSET_Y: f32 = -1.0;

/// Number of digits to use when calculating column label skip
pub const LABEL_DIGITS_TO_CALCULATE_SKIP: usize = 3;

/// Base font size for headings (before DPR scaling)
pub const BASE_HEADING_FONT_SIZE: f32 = 10.0;

/// Colors for headings
#[derive(Debug, Clone, Copy)]
pub struct HeadingColors {
    /// Background color for headers
    pub background: [f32; 4],
    /// Background color for corner
    pub corner_background: [f32; 4],
    /// Label text color
    pub label: [f32; 4],
    /// Grid line color
    pub grid_line: [f32; 4],
    /// Selected column/row highlight color
    pub selection: [f32; 4],
    /// Selection alpha
    pub selection_alpha: f32,
}

impl Default for HeadingColors {
    fn default() -> Self {
        Self {
            background: [0.96, 0.96, 0.96, 1.0],        // Light gray
            corner_background: [0.94, 0.94, 0.94, 1.0], // Slightly darker
            label: [0.137, 0.192, 0.263, 1.0], // #233143 (matches gridHeadingLabel in colors.ts)
            grid_line: [0.8, 0.8, 0.8, 1.0],   // Grid line gray
            selection: [0.2, 0.4, 0.8, 1.0],   // Blue selection
            selection_alpha: 0.3,
        }
    }
}

/// Computed heading sizes
#[derive(Debug, Clone, Copy, Default)]
pub struct HeadingSize {
    /// Width of row header area (pixels, scaled)
    pub width: f32,
    /// Height of column header area (pixels, scaled)
    pub height: f32,
    /// Unscaled width
    pub unscaled_width: f32,
    /// Unscaled height
    pub unscaled_height: f32,
}

/// Viewport state for update calculations
#[derive(Debug, Clone, Copy)]
pub struct ViewportState {
    pub viewport_x: f32,
    pub viewport_y: f32,
    pub scale: f32,
    pub canvas_width: f32,
    pub canvas_height: f32,
    pub dpr: f32,
    pub char_width: f32,
    pub char_height: f32,
}

impl ViewportState {
    /// Get the font size for headings
    /// Note: We don't multiply by DPR here because the screen-space matrix
    /// already maps to physical pixels. Font size 10 gives approximately
    /// the same size as CSS 10px.
    pub fn font_size(&self) -> f32 {
        BASE_HEADING_FONT_SIZE
    }

    /// Get the header height in screen pixels
    /// Note: We don't multiply by DPR - the screen-space coordinates
    /// are already in CSS pixels which matches the TypeScript behavior.
    pub fn header_height(&self) -> f32 {
        CELL_HEIGHT
    }
}
