//! Cursor layout

use quadratic_core_shared::{A1Selection, SheetOffsets};
use quadratic_renderer_core::{CursorRenderData, FillBuffer};

/// Cursor colors
const CURSOR_FILL_COLOR: [f32; 4] = [0.227, 0.506, 0.894, 0.1]; // Blue with alpha
const CURSOR_BORDER_COLOR: [f32; 4] = [0.227, 0.506, 0.894, 1.0]; // Blue solid
const BORDER_WIDTH: f32 = 2.0;

/// Cursor layout
#[derive(Default)]
pub struct CursorLayout {
    pub dirty: bool,

    /// Selected cell (1-indexed)
    selected_col: i64,
    selected_row: i64,

    /// Selection range (1-indexed)
    selection: Option<(i64, i64, i64, i64)>, // start_col, start_row, end_col, end_row

    /// A1Selection for complex selections
    a1_selection: Option<A1Selection>,

    /// Cached render data
    cached_data: Option<CursorRenderData>,
}

impl CursorLayout {
    pub fn new() -> Self {
        Self {
            dirty: true,
            selected_col: 1,
            selected_row: 1,
            selection: None,
            a1_selection: None,
            cached_data: None,
        }
    }

    pub fn set_selected_cell(&mut self, col: i64, row: i64) {
        self.selected_col = col;
        self.selected_row = row;
        self.dirty = true;
    }

    pub fn set_selection(&mut self, start_col: i64, start_row: i64, end_col: i64, end_row: i64) {
        self.selection = Some((start_col, start_row, end_col, end_row));
        self.dirty = true;
    }

    pub fn set_a1_selection(&mut self, selection: A1Selection) {
        self.a1_selection = Some(selection);
        self.dirty = true;
    }

    pub fn update(&mut self, offsets: &SheetOffsets) {
        if !self.dirty {
            return;
        }

        let mut fill_buffer = FillBuffer::new();
        let mut border_buffer = FillBuffer::new();

        // Get selection bounds
        let (start_col, start_row, end_col, end_row) = self
            .selection
            .unwrap_or((self.selected_col, self.selected_row, self.selected_col, self.selected_row));

        // Calculate rectangle bounds
        let (x1, _) = offsets.column_position_size(start_col);
        let (x2, w2) = offsets.column_position_size(end_col);
        let (y1, _) = offsets.row_position_size(start_row);
        let (y2, h2) = offsets.row_position_size(end_row);

        let x = x1 as f32;
        let y = y1 as f32;
        let width = (x2 + w2 - x1) as f32;
        let height = (y2 + h2 - y1) as f32;

        // Add fill
        fill_buffer.add_rect(x, y, width, height, CURSOR_FILL_COLOR);

        // Add border (as four rectangles)
        // Top
        border_buffer.add_rect(x, y, width, BORDER_WIDTH, CURSOR_BORDER_COLOR);
        // Bottom
        border_buffer.add_rect(x, y + height - BORDER_WIDTH, width, BORDER_WIDTH, CURSOR_BORDER_COLOR);
        // Left
        border_buffer.add_rect(x, y, BORDER_WIDTH, height, CURSOR_BORDER_COLOR);
        // Right
        border_buffer.add_rect(x + width - BORDER_WIDTH, y, BORDER_WIDTH, height, CURSOR_BORDER_COLOR);

        self.cached_data = Some(CursorRenderData {
            fill: Some(fill_buffer),
            border: Some(border_buffer),
        });

        self.dirty = false;
    }

    pub fn get_render_data(&self) -> Option<&CursorRenderData> {
        self.cached_data.as_ref()
    }

    pub fn take_render_data(&mut self) -> Option<CursorRenderData> {
        self.cached_data.take()
    }
}
