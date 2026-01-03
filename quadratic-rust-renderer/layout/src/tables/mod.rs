//! Tables module - layout for code cells/tables
//!
//! Handles table header rendering and column layout.

use std::collections::HashMap;

use quadratic_core_shared::{Pos, RenderCodeCell, SheetOffsets};
use quadratic_rust_renderer_shared::TableRenderData;

/// Table layout data
pub struct TableLayout {
    /// Position of the table
    pub pos: Pos,

    /// The code cell data
    pub data: RenderCodeCell,

    /// Whether this table is active (selected)
    pub active: bool,
}

/// Table cache for a sheet
#[derive(Default)]
pub struct TableCache {
    tables: HashMap<Pos, TableLayout>,
    active_table: Option<Pos>,
}

impl TableCache {
    pub fn new() -> Self {
        Self::default()
    }

    /// Set all tables
    pub fn set_tables(&mut self, code_cells: Vec<RenderCodeCell>, _offsets: &SheetOffsets) {
        self.tables.clear();
        for cell in code_cells {
            let pos = Pos::new(cell.x as i64, cell.y as i64);
            self.tables.insert(
                pos,
                TableLayout {
                    pos,
                    data: cell,
                    active: self.active_table == Some(pos),
                },
            );
        }
    }

    /// Update a single table
    pub fn update_table(
        &mut self,
        pos: Pos,
        code_cell: Option<RenderCodeCell>,
        _offsets: &SheetOffsets,
    ) {
        if let Some(cell) = code_cell {
            self.tables.insert(
                pos,
                TableLayout {
                    pos,
                    data: cell,
                    active: self.active_table == Some(pos),
                },
            );
        } else {
            self.tables.remove(&pos);
        }
    }

    /// Set the active table
    pub fn set_active_table(&mut self, pos: Option<Pos>) {
        // Deactivate old
        if let Some(old_pos) = self.active_table {
            if let Some(table) = self.tables.get_mut(&old_pos) {
                table.active = false;
            }
        }

        self.active_table = pos;

        // Activate new
        if let Some(new_pos) = pos {
            if let Some(table) = self.tables.get_mut(&new_pos) {
                table.active = true;
            }
        }
    }

    /// Get all table render data for current viewport
    pub fn get_render_data(
        &self,
        _offsets: &SheetOffsets,
        _fonts: &crate::sheets::text::BitmapFonts,
    ) -> Vec<TableRenderData> {
        // TODO: Implement table layout and render data generation
        Vec::new()
    }

    pub fn is_empty(&self) -> bool {
        self.tables.is_empty()
    }

    pub fn len(&self) -> usize {
        self.tables.len()
    }
}
