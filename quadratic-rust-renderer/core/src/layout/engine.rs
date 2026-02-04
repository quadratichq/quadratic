//! Layout engine for generating render batches

use quadratic_core::grid::SheetId;

use crate::render::CoreState;
use crate::sheets::text::BitmapFont;
use crate::types::{
    CursorRenderData, FillBuffer, HashRenderData, HeadingsRenderData, LineBuffer, RenderBatch,
    TableRenderData,
};

/// Layout engine that generates render batches
///
/// The layout engine maintains render state and generates pre-computed
/// geometry for the render worker.
pub struct LayoutEngine {
    /// Core state (viewport, sheets, UI, fonts)
    state: CoreState,

    /// Batch sequence number
    batch_sequence: u64,

    /// Whether the engine is running
    running: bool,
}

impl LayoutEngine {
    pub fn new() -> Self {
        Self {
            state: CoreState::new(),
            batch_sequence: 0,
            running: false,
        }
    }

    /// Get reference to core state
    pub fn state(&self) -> &CoreState {
        &self.state
    }

    /// Get mutable reference to core state
    pub fn state_mut(&mut self) -> &mut CoreState {
        &mut self.state
    }

    // =========================================================================
    // Lifecycle
    // =========================================================================

    /// Start the engine
    pub fn start(&mut self) {
        self.running = true;
    }

    /// Stop the engine
    pub fn stop(&mut self) {
        self.running = false;
    }

    /// Check if running
    pub fn is_running(&self) -> bool {
        self.running
    }

    // =========================================================================
    // Viewport
    // =========================================================================

    /// Set viewport position and scale
    pub fn set_viewport(&mut self, x: f32, y: f32, scale: f32) {
        self.state.set_viewport(x, y, scale);
    }

    /// Resize viewport
    pub fn resize_viewport(&mut self, width: f32, height: f32, dpr: f32) {
        self.state.resize_viewport(width, height, dpr);
    }

    // =========================================================================
    // Fonts
    // =========================================================================

    /// Add a font
    pub fn add_font(&mut self, font: BitmapFont) {
        self.state.add_font(font);
    }

    /// Check if fonts are loaded
    pub fn has_fonts(&self) -> bool {
        self.state.has_fonts()
    }

    // =========================================================================
    // Sheet Data
    // =========================================================================

    /// Set current sheet
    pub fn set_current_sheet(&mut self, id: SheetId) {
        self.state.set_current_sheet(id);
    }

    /// Get current sheet ID
    pub fn current_sheet_id(&self) -> Option<SheetId> {
        self.state.current_sheet_id()
    }

    /// Get hashes that need to be requested from core
    pub fn get_unrequested_hashes(&self) -> Vec<quadratic_core::Pos> {
        let offsets = self.state.get_sheet_offsets();
        let bounds = self.state.viewport.visible_hash_bounds(&offsets);

        if let Some(sheet) = self.state.sheets.current_sheet() {
            sheet
                .text
                .get_unrequested_hashes(&bounds)
                .into_iter()
                .map(|(x, y)| quadratic_core::Pos { x, y })
                .collect()
        } else {
            Vec::new()
        }
    }

    // =========================================================================
    // Batch Generation
    // =========================================================================

    /// Generate a render batch
    ///
    /// Returns None if:
    /// - Engine is not running
    /// - No fonts loaded
    /// - Nothing is dirty
    pub fn generate_render_batch(&mut self) -> Option<RenderBatch> {
        if !self.running {
            return None;
        }

        if !self.has_fonts() {
            return None;
        }

        // Update UI content
        self.state.update_content();

        if !self.state.is_dirty() {
            return None;
        }

        self.batch_sequence += 1;

        let batch = RenderBatch {
            sequence: self.batch_sequence,
            viewport_scale: self.state.viewport.scale(),
            viewport_x: self.state.viewport.x(),
            viewport_y: self.state.viewport.y(),
            viewport_width: self.state.viewport.width(),
            viewport_height: self.state.viewport.height(),
            hashes: self.generate_hash_data(),
            grid_lines: self.generate_grid_lines(),
            cursor: self.generate_cursor(),
            headings: self.generate_headings(),
            tables: self.generate_tables(),
            meta_fills: self.generate_meta_fills(),
            background: self.generate_background(),
        };

        self.state.mark_clean();

        Some(batch)
    }

    fn generate_hash_data(&self) -> Vec<HashRenderData> {
        // TODO: Generate text meshes for visible hashes
        Vec::new()
    }

    fn generate_grid_lines(&self) -> Option<LineBuffer> {
        self.state.ui.grid_lines.get_buffer()
    }

    fn generate_cursor(&self) -> Option<CursorRenderData> {
        self.state.ui.cursor.get_render_data()
    }

    fn generate_headings(&self) -> Option<HeadingsRenderData> {
        if self.state.show_headings {
            self.state.ui.headings.get_render_data()
        } else {
            None
        }
    }

    fn generate_tables(&self) -> Vec<TableRenderData> {
        // TODO: Generate table header data
        Vec::new()
    }

    fn generate_meta_fills(&self) -> Option<FillBuffer> {
        // TODO: Generate meta fills
        None
    }

    fn generate_background(&self) -> Option<FillBuffer> {
        // Generate white background for visible area
        let bounds = self.state.viewport.visible_bounds();

        let mut buffer = FillBuffer::new();
        buffer.add_rect(
            bounds.left.max(0.0),
            bounds.top.max(0.0),
            bounds.width,
            bounds.height,
            [1.0, 1.0, 1.0, 1.0], // White
        );

        Some(buffer)
    }

    // =========================================================================
    // Queries
    // =========================================================================

    /// Get max content width for a column
    pub fn get_column_max_width(&self, column: i64) -> f32 {
        self.state
            .sheets
            .current_sheet()
            .map(|s| s.get_column_max_width(column))
            .unwrap_or(0.0)
    }

    /// Get max content height for a row
    pub fn get_row_max_height(&self, row: i64) -> f32 {
        self.state
            .sheets
            .current_sheet()
            .map(|s| s.get_row_max_height(row))
            .unwrap_or(0.0)
    }
}

impl Default for LayoutEngine {
    fn default() -> Self {
        Self::new()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_layout_engine_new() {
        let engine = LayoutEngine::new();
        assert!(!engine.is_running());
        assert!(!engine.has_fonts());
        assert!(engine.current_sheet_id().is_none());
    }

    #[test]
    fn test_layout_engine_default() {
        let engine = LayoutEngine::default();
        assert!(!engine.is_running());
    }

    #[test]
    fn test_start_stop() {
        let mut engine = LayoutEngine::new();

        assert!(!engine.is_running());

        engine.start();
        assert!(engine.is_running());

        engine.stop();
        assert!(!engine.is_running());
    }

    #[test]
    fn test_generate_batch_requires_running() {
        let mut engine = LayoutEngine::new();

        // Not running - should return None
        assert!(engine.generate_render_batch().is_none());

        engine.start();
        // Running but no fonts - should still return None
        assert!(engine.generate_render_batch().is_none());
    }

    #[test]
    fn test_set_viewport() {
        let mut engine = LayoutEngine::new();
        engine.set_viewport(100.0, 200.0, 2.0);

        assert_eq!(engine.state().viewport.x(), 100.0);
        assert_eq!(engine.state().viewport.y(), 200.0);
        assert_eq!(engine.state().viewport.scale(), 2.0);
    }

    #[test]
    fn test_resize_viewport() {
        let mut engine = LayoutEngine::new();
        engine.resize_viewport(1024.0, 768.0, 2.0);

        assert_eq!(engine.state().viewport.width(), 1024.0);
        assert_eq!(engine.state().viewport.height(), 768.0);
        assert_eq!(engine.state().viewport.dpr(), 2.0);
    }

    #[test]
    fn test_set_current_sheet() {
        let mut engine = LayoutEngine::new();
        let sheet_id = SheetId::TEST;

        assert!(engine.current_sheet_id().is_none());

        engine.set_current_sheet(sheet_id);
        assert_eq!(engine.current_sheet_id(), Some(sheet_id));
    }

    #[test]
    fn test_has_fonts() {
        let engine = LayoutEngine::new();
        assert!(!engine.has_fonts());
    }

    #[test]
    fn test_state_access() {
        let mut engine = LayoutEngine::new();

        // Can access state
        let _ = engine.state();
        let _ = engine.state_mut();
    }

    #[test]
    fn test_get_unrequested_hashes_no_sheet() {
        let engine = LayoutEngine::new();
        let hashes = engine.get_unrequested_hashes();
        assert!(hashes.is_empty());
    }

    #[test]
    fn test_get_unrequested_hashes_with_sheet() {
        let mut engine = LayoutEngine::new();
        let sheet_id = SheetId::TEST;
        engine.set_current_sheet(sheet_id);

        // With a sheet but no text hashes, should still work
        let hashes = engine.get_unrequested_hashes();
        // Result depends on viewport and offsets
        let _ = hashes;
    }

    #[test]
    fn test_column_max_width_no_sheet() {
        let engine = LayoutEngine::new();
        assert_eq!(engine.get_column_max_width(1), 0.0);
    }

    #[test]
    fn test_row_max_height_no_sheet() {
        let engine = LayoutEngine::new();
        assert_eq!(engine.get_row_max_height(1), 0.0);
    }

    #[test]
    fn test_column_max_width_with_sheet() {
        let mut engine = LayoutEngine::new();
        let sheet_id = SheetId::TEST;
        engine.set_current_sheet(sheet_id);

        // With sheet but no content, should be 0
        assert_eq!(engine.get_column_max_width(1), 0.0);
    }

    #[test]
    fn test_row_max_height_with_sheet() {
        let mut engine = LayoutEngine::new();
        let sheet_id = SheetId::TEST;
        engine.set_current_sheet(sheet_id);

        // With sheet but no content, should be 0
        assert_eq!(engine.get_row_max_height(1), 0.0);
    }
}
