//! Table render data - cached rendering information for a single table.
//!
//! This is analogous to the TypeScript Table class, storing precomputed
//! bounds and rendering data for efficient drawing.

use quadratic_core_shared::{RenderCodeCell, SheetOffsets};

use crate::sheets::text::LabelMesh;

/// Rectangle bounds in world coordinates.
#[derive(Debug, Clone, Copy, Default)]
pub struct TableBounds {
    pub x: f32,
    pub y: f32,
    pub width: f32,
    pub height: f32,
}

impl TableBounds {
    pub fn new(x: f32, y: f32, width: f32, height: f32) -> Self {
        Self {
            x,
            y,
            width,
            height,
        }
    }

    pub fn left(&self) -> f32 {
        self.x
    }

    pub fn top(&self) -> f32 {
        self.y
    }

    pub fn right(&self) -> f32 {
        self.x + self.width
    }

    pub fn bottom(&self) -> f32 {
        self.y + self.height
    }

    /// Check if this bounds intersects with another.
    pub fn intersects(&self, other: &TableBounds) -> bool {
        self.left() < other.right()
            && self.right() > other.left()
            && self.top() < other.bottom()
            && self.bottom() > other.top()
    }

    /// Check if a point is inside this bounds.
    pub fn contains_point(&self, x: f32, y: f32) -> bool {
        x >= self.left() && x <= self.right() && y >= self.top() && y <= self.bottom()
    }
}

/// Cached rendering data for a single table.
#[derive(Debug)]
pub struct TableRenderData {
    /// The code cell data from core.
    pub code_cell: RenderCodeCell,

    /// Whether this table is currently active (selected).
    active: bool,

    /// Full table bounds in world coordinates.
    pub table_bounds: TableBounds,

    /// Table name row bounds (if show_name is true).
    pub name_bounds: Option<TableBounds>,

    /// Column headers row bounds (if show_columns is true).
    pub column_headers_bounds: Option<TableBounds>,

    /// Individual column bounds (for column header rendering).
    pub column_bounds: Vec<TableBounds>,

    /// Cached text mesh for table name.
    pub name_mesh: Option<LabelMesh>,

    /// Cached text meshes for column headers.
    pub column_meshes: Vec<LabelMesh>,

    /// Whether the cached meshes need to be rebuilt.
    dirty: bool,
}

impl TableRenderData {
    /// Create new table render data from a code cell.
    pub fn new(code_cell: RenderCodeCell) -> Self {
        Self {
            code_cell,
            active: false,
            table_bounds: TableBounds::default(),
            name_bounds: None,
            column_headers_bounds: None,
            column_bounds: Vec::new(),
            name_mesh: None,
            column_meshes: Vec::new(),
            dirty: true,
        }
    }

    /// Update bounds based on sheet offsets.
    pub fn update_bounds(&mut self, offsets: &SheetOffsets) {
        use quadratic_core_shared::RenderCodeCellState;

        let cell = &self.code_cell;
        let x = cell.x as i64;
        let y = cell.y as i64;

        // Handle spill error - show only 1 cell (matches TypeScript behavior)
        let is_spill_error = cell.state == RenderCodeCellState::SpillError;
        let w = if is_spill_error { 1 } else { cell.w as i64 };
        let h = if is_spill_error { 1 } else { cell.h as i64 };

        // Calculate full table bounds
        let (left, _) = offsets.column_position_size(x);
        let (top, _) = offsets.row_position_size(y);
        let (right, _) = offsets.column_position_size(x + w);
        let (bottom, _) = offsets.row_position_size(y + h);

        let left = left as f32;
        let top = top as f32;
        let right = right as f32;
        let bottom = bottom as f32;

        self.table_bounds = TableBounds::new(left, top, right - left, bottom - top);

        // Calculate name row bounds
        if cell.show_name {
            let name_height = offsets.row_height(y) as f32;
            self.name_bounds = Some(TableBounds::new(left, top, right - left, name_height));
        } else {
            self.name_bounds = None;
        }

        // Calculate column headers row bounds
        if cell.show_columns {
            let headers_y = if cell.show_name { y + 1 } else { y };
            let (headers_top, _) = offsets.row_position_size(headers_y);
            let headers_top = headers_top as f32;
            let headers_height = offsets.row_height(headers_y) as f32;
            self.column_headers_bounds =
                Some(TableBounds::new(left, headers_top, right - left, headers_height));

            // Calculate individual column bounds
            // Use value_index to get the correct column width from offsets
            self.column_bounds.clear();
            let mut col_x = left;
            for column in cell.columns.iter() {
                if column.display {
                    let col_width = offsets.column_width(x + column.value_index as i64) as f32;
                    self.column_bounds
                        .push(TableBounds::new(col_x, headers_top, col_width, headers_height));
                    col_x += col_width;
                }
            }
        } else {
            self.column_headers_bounds = None;
            self.column_bounds.clear();
        }

        self.dirty = true;
    }

    /// Set whether this table is active.
    pub fn set_active(&mut self, active: bool) {
        if self.active != active {
            self.active = active;
            self.dirty = true;
        }
    }

    /// Check if this table is active.
    pub fn is_active(&self) -> bool {
        self.active
    }

    /// Check if render data needs rebuild.
    pub fn is_dirty(&self) -> bool {
        self.dirty
    }

    /// Mark as clean after rebuilding.
    pub fn mark_clean(&mut self) {
        self.dirty = false;
    }

    /// Mark as needing rebuild.
    pub fn mark_dirty(&mut self) {
        self.dirty = true;
    }

    /// Get the header height (name row + column headers row).
    pub fn header_height(&self) -> f32 {
        let mut height = 0.0;
        if let Some(bounds) = &self.name_bounds {
            height += bounds.height;
        }
        if let Some(bounds) = &self.column_headers_bounds {
            height += bounds.height;
        }
        height
    }

    /// Check if a point is in the table name area.
    pub fn point_in_name(&self, x: f32, y: f32) -> bool {
        self.name_bounds
            .as_ref()
            .is_some_and(|b| b.contains_point(x, y))
    }

    /// Check if a point is in the column headers area.
    pub fn point_in_column_headers(&self, x: f32, y: f32) -> bool {
        self.column_headers_bounds
            .as_ref()
            .is_some_and(|b| b.contains_point(x, y))
    }

    /// Get the column index at the given x position (if in column headers).
    pub fn column_at_x(&self, x: f32) -> Option<usize> {
        for (i, bounds) in self.column_bounds.iter().enumerate() {
            if x >= bounds.left() && x < bounds.right() {
                return Some(i);
            }
        }
        None
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use quadratic_core_shared::{CodeCellLanguage, RenderCodeCellState, RenderColumnHeader};

    fn make_test_code_cell() -> RenderCodeCell {
        RenderCodeCell {
            x: 2,
            y: 3,
            w: 4,
            h: 6,
            language: CodeCellLanguage::Python,
            state: RenderCodeCellState::Success,
            name: "TestTable".to_string(),
            columns: vec![
                RenderColumnHeader {
                    name: "A".into(),
                    display: true,
                    value_index: 0,
                },
                RenderColumnHeader {
                    name: "B".into(),
                    display: true,
                    value_index: 1,
                },
                RenderColumnHeader {
                    name: "C".into(),
                    display: false,
                    value_index: 2,
                },
                RenderColumnHeader {
                    name: "D".into(),
                    display: true,
                    value_index: 3,
                },
            ],
            first_row_header: false,
            show_name: true,
            show_columns: true,
            is_code: true,
            is_html: false,
            is_html_image: false,
            alternating_colors: true,
        }
    }

    #[test]
    fn test_bounds_calculation() {
        let cell = make_test_code_cell();
        let mut render_data = TableRenderData::new(cell);

        let offsets = SheetOffsets::default();
        render_data.update_bounds(&offsets);

        // Should have name bounds
        assert!(render_data.name_bounds.is_some());

        // Should have column headers bounds
        assert!(render_data.column_headers_bounds.is_some());

        // Should have 3 visible columns (A, B, D)
        assert_eq!(render_data.column_bounds.len(), 3);
    }

    #[test]
    fn test_active_state() {
        let cell = make_test_code_cell();
        let mut render_data = TableRenderData::new(cell);

        assert!(!render_data.is_active());

        render_data.set_active(true);
        assert!(render_data.is_active());
        assert!(render_data.is_dirty());

        render_data.mark_clean();
        assert!(!render_data.is_dirty());
    }
}
