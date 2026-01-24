//! Table outline types for rendering
//!
//! These types represent table outlines (borders around code cells/data tables)
//! for rendering. They are platform-agnostic and can be populated from
//! quadratic-core's JsRenderCodeCell data.

use bincode::{Decode, Encode};
use quadratic_core::sheet_offsets::SheetOffsets;
use serde::{Deserialize, Serialize};

use super::{TABLE_MUTED_COLOR, TABLE_PRIMARY_COLOR, TABLE_WHITE};
use crate::types::{FillBuffer, LineBuffer};

/// A table outline for rendering
#[derive(Debug, Clone, Serialize, Deserialize, Encode, Decode)]
pub struct TableOutline {
    /// Anchor column (1-indexed)
    pub x: i64,
    /// Anchor row (1-indexed)
    pub y: i64,
    /// Width in cells
    pub w: u32,
    /// Height in cells (total including headers)
    pub h: u32,
    /// Whether to show the table name row
    pub show_name: bool,
    /// Whether to show the column headers row
    pub show_columns: bool,
    /// Whether this table is active (selected)
    pub active: bool,
    /// Table name (for rendering the name row)
    pub name: String,
    /// Whether the table is clipped at the top (don't draw top line)
    pub clipped_top: bool,
    /// Whether the table is clipped at the bottom (don't draw bottom line)
    pub clipped_bottom: bool,
    /// Whether the table is clipped at the left (don't draw left line)
    pub clipped_left: bool,
    /// Whether the table is clipped at the right (don't draw right line)
    pub clipped_right: bool,
}

impl TableOutline {
    pub fn new(x: i64, y: i64, w: u32, h: u32) -> Self {
        Self {
            x,
            y,
            w,
            h,
            show_name: false,
            show_columns: false,
            active: false,
            name: String::new(),
            clipped_top: false,
            clipped_bottom: false,
            clipped_left: false,
            clipped_right: false,
        }
    }

    pub fn with_name(mut self, name: impl Into<String>) -> Self {
        self.name = name.into();
        self.show_name = true;
        self
    }

    pub fn with_show_columns(mut self, show: bool) -> Self {
        self.show_columns = show;
        self
    }

    pub fn with_active(mut self, active: bool) -> Self {
        self.active = active;
        self
    }

    pub fn with_clipped_top(mut self, clipped: bool) -> Self {
        self.clipped_top = clipped;
        self
    }

    pub fn with_clipped_bottom(mut self, clipped: bool) -> Self {
        self.clipped_bottom = clipped;
        self
    }

    pub fn with_clipped_left(mut self, clipped: bool) -> Self {
        self.clipped_left = clipped;
        self
    }

    pub fn with_clipped_right(mut self, clipped: bool) -> Self {
        self.clipped_right = clipped;
        self
    }

    /// Get the outline color based on active state
    pub fn outline_color(&self) -> [f32; 4] {
        if self.active {
            TABLE_PRIMARY_COLOR
        } else {
            TABLE_MUTED_COLOR
        }
    }

    /// Get the number of header rows
    pub fn header_rows(&self) -> u32 {
        let mut rows = 0;
        if self.show_name {
            rows += 1;
        }
        if self.show_columns {
            rows += 1;
        }
        rows
    }
}

/// Collection of table outlines for a sheet
#[derive(Debug, Clone, Default, Serialize, Deserialize, Encode, Decode)]
pub struct TableOutlines {
    pub tables: Vec<TableOutline>,
}

impl TableOutlines {
    pub fn new() -> Self {
        Self::default()
    }

    pub fn is_empty(&self) -> bool {
        self.tables.is_empty()
    }

    pub fn add(&mut self, table: TableOutline) {
        self.tables.push(table);
    }

    /// Convert table outlines to render buffers
    ///
    /// Returns (outline_lines, name_backgrounds, column_backgrounds)
    pub fn to_render_buffers(
        &self,
        offsets: &SheetOffsets,
    ) -> (LineBuffer, FillBuffer, FillBuffer) {
        let mut outline_lines = LineBuffer::new();
        let mut name_backgrounds = FillBuffer::new();
        let mut column_backgrounds = FillBuffer::new();

        for table in &self.tables {
            // Calculate table bounds in world coordinates
            let (table_x, _) = offsets.column_position_size(table.x);
            let (table_y, _) = offsets.row_position_size(table.y);

            // Calculate table width and height
            let (end_x, end_w) = offsets.column_position_size(table.x + table.w as i64 - 1);
            let (end_y, end_h) = offsets.row_position_size(table.y + table.h as i64 - 1);

            let x = table_x as f32;
            let y = table_y as f32;
            let w = (end_x + end_w - table_x) as f32;
            let h = (end_y + end_h - table_y) as f32;

            let color = table.outline_color();

            // Draw outline lines centered on cell borders (0.5 pixels on each side)
            // Skip edges that are clipped to the viewport boundary
            if !table.clipped_top {
                outline_lines.add_line(x, y, x + w, y, color); // Top
            }
            if !table.clipped_left {
                outline_lines.add_line(x, y, x, y + h, color); // Left
            }
            if !table.clipped_bottom {
                outline_lines.add_line(x, y + h, x + w, y + h, color); // Bottom
            }
            if !table.clipped_right {
                outline_lines.add_line(x + w, y, x + w, y + h, color); // Right
            }

            // Add name row background if shown
            if table.show_name {
                let (_, name_h) = offsets.row_position_size(table.y);
                name_backgrounds.add_rect(x, y, w, name_h as f32, color);
            }

            // Add column header background if shown
            if table.show_columns {
                let header_row = if table.show_name {
                    table.y + 1
                } else {
                    table.y
                };
                let (header_y, header_h) = offsets.row_position_size(header_row);
                column_backgrounds.add_rect(x, header_y as f32, w, header_h as f32, TABLE_WHITE);

                // Add line at the bottom of column headers
                let line_y = (header_y + header_h) as f32;
                outline_lines.add_line(x, line_y, x + w, line_y, color);
            }
        }

        (outline_lines, name_backgrounds, column_backgrounds)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_table_outlines_to_render_buffers() {
        let mut outlines = TableOutlines::new();

        outlines.add(
            TableOutline::new(1, 1, 3, 5)
                .with_name("Test Table")
                .with_show_columns(true)
                .with_active(true),
        );

        let offsets = SheetOffsets::default();
        let (lines, name_bg, col_bg) = outlines.to_render_buffers(&offsets);

        // Should have outline lines + column header line
        assert!(!lines.vertices.is_empty());
        // Should have name background
        assert!(!name_bg.vertices.is_empty());
        // Should have column background
        assert!(!col_bg.vertices.is_empty());
    }
}
