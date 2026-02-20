//! Table data - cached information for a single table

use quadratic_core::sheet_offsets::SheetOffsets;

use crate::types::{RenderCodeCell, RenderCodeCellState};

use super::bounds::TableBounds;
use super::{TABLE_MUTED_COLOR, TABLE_PRIMARY_COLOR};

/// Cached data for a single table (bounds, state, etc.)
#[derive(Debug)]
pub struct TableData {
    /// The code cell data from core
    pub code_cell: RenderCodeCell,

    /// Whether this table is currently active (selected)
    active: bool,

    /// Full table bounds in world coordinates
    pub table_bounds: TableBounds,

    /// Table name row bounds (if show_name is true)
    pub name_bounds: Option<TableBounds>,

    /// Column headers row bounds (if show_columns is true)
    pub column_headers_bounds: Option<TableBounds>,

    /// Individual column bounds (for column header rendering)
    pub column_bounds: Vec<TableBounds>,

    /// Whether the cached data needs rebuild
    dirty: bool,
}

impl TableData {
    /// Create new table data from a code cell
    pub fn new(code_cell: RenderCodeCell) -> Self {
        Self {
            code_cell,
            active: false,
            table_bounds: TableBounds::default(),
            name_bounds: None,
            column_headers_bounds: None,
            column_bounds: Vec::new(),
            dirty: true,
        }
    }

    /// Update bounds based on sheet offsets
    pub fn update_bounds(&mut self, offsets: &SheetOffsets) {
        let cell = &self.code_cell;
        let x = cell.x as i64;
        let y = cell.y as i64;

        // Handle spill error - show only 1 cell
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
            self.column_headers_bounds = Some(TableBounds::new(
                left,
                headers_top,
                right - left,
                headers_height,
            ));

            // Calculate individual column bounds
            self.column_bounds.clear();
            let mut col_x = left;
            for column in cell.columns.iter() {
                if column.display {
                    let col_width = offsets.column_width(x + column.value_index as i64) as f32;
                    self.column_bounds.push(TableBounds::new(
                        col_x,
                        headers_top,
                        col_width,
                        headers_height,
                    ));
                    col_x += col_width;
                }
            }
        } else {
            self.column_headers_bounds = None;
            self.column_bounds.clear();
        }

        self.dirty = true;
    }

    /// Set whether this table is active
    pub fn set_active(&mut self, active: bool) {
        if self.active != active {
            self.active = active;
            self.dirty = true;
        }
    }

    /// Check if this table is active
    pub fn is_active(&self) -> bool {
        self.active
    }

    /// Get the outline color based on active state
    pub fn outline_color(&self) -> [f32; 4] {
        if self.active {
            TABLE_PRIMARY_COLOR
        } else {
            TABLE_MUTED_COLOR
        }
    }

    /// Check if render data needs rebuild
    pub fn is_dirty(&self) -> bool {
        self.dirty
    }

    /// Mark as clean after rebuilding
    pub fn mark_clean(&mut self) {
        self.dirty = false;
    }

    /// Mark as needing rebuild
    pub fn mark_dirty(&mut self) {
        self.dirty = true;
    }

    /// Get the header height (name row + column headers row)
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

    /// Check if a point is in the table name area
    pub fn point_in_name(&self, x: f32, y: f32) -> bool {
        self.name_bounds
            .as_ref()
            .is_some_and(|b| b.contains_point(x, y))
    }

    /// Check if a point is in the column headers area
    pub fn point_in_column_headers(&self, x: f32, y: f32) -> bool {
        self.column_headers_bounds
            .as_ref()
            .is_some_and(|b| b.contains_point(x, y))
    }

    /// Get the column index at the given x position
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
    use crate::types::CodeCellLanguage;

    fn create_test_code_cell() -> RenderCodeCell {
        RenderCodeCell {
            x: 1,
            y: 1,
            w: 3,
            h: 5,
            language: CodeCellLanguage::Python,
            state: RenderCodeCellState::Success,
            spill_error: None,
            name: "TestTable".to_string(),
            columns: vec![],
            first_row_header: false,
            sort: None,
            sort_dirty: false,
            alternating_colors: false,
            is_code: true,
            is_html: false,
            is_html_image: false,
            show_name: true,
            show_columns: true,
            last_modified: 0,
        }
    }

    #[test]
    fn test_table_data_new() {
        let code_cell = create_test_code_cell();
        let data = TableData::new(code_cell);

        assert!(data.is_dirty());
        assert!(!data.is_active());
        assert_eq!(data.code_cell.name, "TestTable");
    }

    #[test]
    fn test_set_active() {
        let code_cell = create_test_code_cell();
        let mut data = TableData::new(code_cell);
        data.mark_clean();

        assert!(!data.is_active());

        data.set_active(true);
        assert!(data.is_active());
        assert!(data.is_dirty());

        data.mark_clean();
        data.set_active(false);
        assert!(!data.is_active());
        assert!(data.is_dirty());
    }

    #[test]
    fn test_set_active_no_change() {
        let code_cell = create_test_code_cell();
        let mut data = TableData::new(code_cell);
        data.mark_clean();

        data.set_active(false); // Already false
        assert!(!data.is_dirty());
    }

    #[test]
    fn test_outline_color() {
        let code_cell = create_test_code_cell();
        let mut data = TableData::new(code_cell);

        let inactive_color = data.outline_color();

        data.set_active(true);
        let active_color = data.outline_color();

        assert_ne!(inactive_color, active_color);
    }

    #[test]
    fn test_mark_dirty_clean() {
        let code_cell = create_test_code_cell();
        let mut data = TableData::new(code_cell);

        data.mark_clean();
        assert!(!data.is_dirty());

        data.mark_dirty();
        assert!(data.is_dirty());
    }

    #[test]
    fn test_header_height_no_headers() {
        let mut code_cell = create_test_code_cell();
        code_cell.show_name = false;
        code_cell.show_columns = false;
        let data = TableData::new(code_cell);

        assert_eq!(data.header_height(), 0.0);
    }

    #[test]
    fn test_point_in_name_no_bounds() {
        let mut code_cell = create_test_code_cell();
        code_cell.show_name = false;
        let data = TableData::new(code_cell);

        assert!(!data.point_in_name(50.0, 50.0));
    }

    #[test]
    fn test_point_in_column_headers_no_bounds() {
        let mut code_cell = create_test_code_cell();
        code_cell.show_columns = false;
        let data = TableData::new(code_cell);

        assert!(!data.point_in_column_headers(50.0, 50.0));
    }

    #[test]
    fn test_column_at_x_empty() {
        let code_cell = create_test_code_cell();
        let data = TableData::new(code_cell);

        // No column bounds set
        assert!(data.column_at_x(50.0).is_none());
    }

    #[test]
    fn test_update_bounds() {
        let code_cell = create_test_code_cell();
        let mut data = TableData::new(code_cell);
        let offsets = SheetOffsets::default();

        data.mark_clean();
        data.update_bounds(&offsets);

        assert!(data.is_dirty());
        // Bounds should be non-zero
        assert!(data.table_bounds.width > 0.0);
        assert!(data.table_bounds.height > 0.0);
    }
}
