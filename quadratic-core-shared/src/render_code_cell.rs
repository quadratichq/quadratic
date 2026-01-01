//! Render code cell types for table heading rendering.
//!
//! These types are used for efficient bincode communication between
//! quadratic-core and quadratic-rust-renderer for rendering table headers.

use bincode::{Decode, Encode};

use crate::CodeCellLanguage;

/// State of a render code cell.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Default, Encode, Decode)]
pub enum RenderCodeCellState {
    #[default]
    NotYetRun,
    RunError,
    SpillError,
    Success,
    Html,
    Image,
}

/// Column header for a data table.
#[derive(Debug, Clone, PartialEq, Eq, Encode, Decode)]
pub struct RenderColumnHeader {
    /// Display name of the column.
    pub name: String,
    /// Whether this column is visible.
    pub display: bool,
    /// Index into the value array (for sorting, etc.).
    pub value_index: u32,
}

/// A code cell/table for rendering.
///
/// This contains all information needed to render table headers (name row
/// and column headers), similar to JsRenderCodeCell in TypeScript.
#[derive(Debug, Clone, PartialEq, Encode, Decode)]
pub struct RenderCodeCell {
    /// Anchor column position.
    pub x: i32,
    /// Anchor row position.
    pub y: i32,
    /// Width in cells.
    pub w: u32,
    /// Height in cells.
    pub h: u32,

    /// Programming language of the code cell.
    pub language: CodeCellLanguage,
    /// Current state of the code cell.
    pub state: RenderCodeCellState,

    /// Display name of the table.
    pub name: String,
    /// Column headers for the table.
    pub columns: Vec<RenderColumnHeader>,

    /// Whether the first row of data is used as headers.
    pub first_row_header: bool,
    /// Whether to show the table name row.
    pub show_name: bool,
    /// Whether to show the column headers row.
    pub show_columns: bool,
    /// Whether this is a code cell (vs. import/data table).
    pub is_code: bool,
    /// Whether this cell outputs HTML.
    pub is_html: bool,
    /// Whether this cell outputs an image.
    pub is_html_image: bool,
    /// Whether alternating row colors are enabled.
    pub alternating_colors: bool,
}

impl Default for RenderCodeCell {
    fn default() -> Self {
        Self {
            x: 0,
            y: 0,
            w: 1,
            h: 1,
            language: CodeCellLanguage::default(),
            state: RenderCodeCellState::default(),
            name: String::new(),
            columns: Vec::new(),
            first_row_header: false,
            show_name: true,
            show_columns: true,
            is_code: false,
            is_html: false,
            is_html_image: false,
            alternating_colors: false,
        }
    }
}

impl RenderCodeCell {
    /// Returns the y offset for data rows (accounting for name and column header rows).
    pub fn y_adjustment(&self) -> u32 {
        let mut adjustment = 0;
        if self.show_name {
            adjustment += 1;
        }
        if self.show_columns {
            adjustment += 1;
        }
        adjustment
    }

    /// Returns the row index of the table name (if shown).
    pub fn name_row(&self) -> Option<i32> {
        if self.show_name {
            Some(self.y)
        } else {
            None
        }
    }

    /// Returns the row index of the column headers (if shown).
    pub fn column_headers_row(&self) -> Option<i32> {
        if self.show_columns {
            Some(self.y + if self.show_name { 1 } else { 0 })
        } else {
            None
        }
    }

    /// Returns the visible columns (those with display = true).
    pub fn visible_columns(&self) -> impl Iterator<Item = &RenderColumnHeader> {
        self.columns.iter().filter(|c| c.display)
    }

    /// Returns whether this table should render headers.
    pub fn has_headers(&self) -> bool {
        (self.show_name || self.show_columns)
            && self.state != RenderCodeCellState::SpillError
            && self.state != RenderCodeCellState::RunError
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_y_adjustment() {
        let mut cell = RenderCodeCell::default();
        cell.show_name = true;
        cell.show_columns = true;
        assert_eq!(cell.y_adjustment(), 2);

        cell.show_name = false;
        assert_eq!(cell.y_adjustment(), 1);

        cell.show_columns = false;
        assert_eq!(cell.y_adjustment(), 0);
    }

    #[test]
    fn test_visible_columns() {
        let mut cell = RenderCodeCell::default();
        cell.columns = vec![
            RenderColumnHeader {
                name: "A".into(),
                display: true,
                value_index: 0,
            },
            RenderColumnHeader {
                name: "B".into(),
                display: false,
                value_index: 1,
            },
            RenderColumnHeader {
                name: "C".into(),
                display: true,
                value_index: 2,
            },
        ];

        let visible: Vec<_> = cell.visible_columns().collect();
        assert_eq!(visible.len(), 2);
        assert_eq!(visible[0].name, "A");
        assert_eq!(visible[1].name, "C");
    }
}
