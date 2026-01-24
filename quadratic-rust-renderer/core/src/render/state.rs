//! Core render state

use quadratic_core::grid::SheetId;

use crate::sheets::text::FontManager;
use crate::sheets::Sheets;
use crate::ui::UI;
use crate::viewport::Viewport;

/// Core rendering state
///
/// This struct holds all the state needed for rendering, independent of
/// the rendering backend (WebGL, WebGPU, native).
pub struct CoreState {
    /// Viewport (camera position, zoom, size)
    pub viewport: Viewport,

    /// Sheet data
    pub sheets: Sheets,

    /// UI elements (cursor, grid lines, headings)
    pub ui: UI,

    /// Font manager
    pub fonts: FontManager,

    /// Whether headings are visible
    pub show_headings: bool,

    /// Debug: show text update highlights
    pub debug_show_text_updates: bool,

    // Dirty flags
    viewport_dirty: bool,
    content_dirty: bool,
}

impl CoreState {
    pub fn new() -> Self {
        Self {
            viewport: Viewport::new(),
            sheets: Sheets::new(),
            ui: UI::new(),
            fonts: FontManager::new(),
            show_headings: true,
            debug_show_text_updates: false,
            viewport_dirty: true,
            content_dirty: true,
        }
    }

    // =========================================================================
    // Viewport
    // =========================================================================

    /// Set viewport position and scale
    pub fn set_viewport(&mut self, x: f32, y: f32, scale: f32) {
        self.viewport.set_viewport(x, y, scale);
        self.viewport_dirty = true;
    }

    /// Resize viewport
    pub fn resize_viewport(&mut self, width: f32, height: f32, dpr: f32) {
        self.viewport.resize(width, height, dpr);
        self.viewport_dirty = true;
    }

    /// Mark viewport as dirty
    pub fn set_viewport_dirty(&mut self) {
        self.viewport_dirty = true;
    }

    // =========================================================================
    // Sheets
    // =========================================================================

    /// Get current sheet ID
    pub fn current_sheet_id(&self) -> Option<SheetId> {
        self.sheets.current_sheet_id()
    }

    /// Set current sheet
    pub fn set_current_sheet(&mut self, id: SheetId) {
        self.sheets.set_current_sheet(id);
        self.content_dirty = true;
    }

    /// Get sheet offsets for current sheet
    pub fn get_sheet_offsets(&self) -> quadratic_core::sheet_offsets::SheetOffsets {
        self.sheets
            .current_sheet()
            .map(|s| s.offsets.clone())
            .unwrap_or_default()
    }

    // =========================================================================
    // Fonts
    // =========================================================================

    /// Add a font
    pub fn add_font(&mut self, font: crate::sheets::text::BitmapFont) {
        self.fonts.add(font);
        self.content_dirty = true;
    }

    /// Check if fonts are loaded
    pub fn has_fonts(&self) -> bool {
        self.fonts.has_fonts()
    }

    /// Get required texture UIDs
    pub fn get_required_texture_uids(&self) -> Vec<u32> {
        self.fonts.required_texture_uids()
    }

    /// Get text rendering parameters
    pub fn get_text_params(&self) -> (f32, f32) {
        // (atlas_font_size, distance_range)
        (self.fonts.atlas_font_size(), 4.0)
    }

    /// Get heading text rendering parameters
    pub fn get_heading_text_params(&self) -> (f32, f32) {
        // Same as regular text for now
        self.get_text_params()
    }

    // =========================================================================
    // UI State
    // =========================================================================

    /// Set headings visibility
    pub fn set_show_headings(&mut self, show: bool) {
        if self.show_headings != show {
            self.show_headings = show;
            self.ui.headings.set_visible(show);
            self.content_dirty = true;
        }
    }

    /// Get heading dimensions
    pub fn get_heading_dimensions(&self) -> (f32, f32) {
        if self.show_headings {
            (self.ui.headings.width(), self.ui.headings.height())
        } else {
            (0.0, 0.0)
        }
    }

    /// Set cursor position
    pub fn set_cursor(&mut self, col: i64, row: i64) {
        self.ui.cursor.set_selected_cell(col, row);
    }

    /// Set cursor selection
    pub fn set_cursor_selection(
        &mut self,
        start_col: i64,
        start_row: i64,
        end_col: i64,
        end_row: i64,
    ) {
        self.ui
            .cursor
            .set_selection(start_col, start_row, end_col, end_row);
    }

    /// Mark grid lines as dirty
    pub fn set_grid_lines_dirty(&mut self) {
        self.ui.grid_lines.mark_dirty();
    }

    /// Mark cursor as dirty
    pub fn set_cursor_dirty(&mut self) {
        self.ui.cursor.mark_dirty();
    }

    /// Mark headings as dirty
    pub fn set_headings_dirty(&mut self) {
        self.ui.headings.mark_dirty();
    }

    // =========================================================================
    // Content Update
    // =========================================================================

    /// Update UI content based on viewport
    pub fn update_content(&mut self) {
        let offsets = self.get_sheet_offsets();

        if self.viewport_dirty {
            self.ui.grid_lines.update(&self.viewport, &offsets);
            self.ui.cursor.update(&self.viewport, &offsets);
            if self.show_headings {
                self.ui.headings.update(&self.viewport, &offsets);
            }
        }
    }

    // =========================================================================
    // Dirty Tracking
    // =========================================================================

    /// Check if anything is dirty
    pub fn is_dirty(&self) -> bool {
        self.viewport_dirty
            || self.content_dirty
            || self.ui.grid_lines.is_dirty()
            || self.ui.cursor.is_dirty()
            || self.ui.headings.is_dirty()
    }

    /// Mark everything as clean
    pub fn mark_clean(&mut self) {
        self.viewport_dirty = false;
        self.content_dirty = false;
        self.viewport.mark_clean();
        self.ui.grid_lines.mark_clean();
        self.ui.cursor.mark_clean();
        self.ui.headings.mark_clean();
    }
}

impl Default for CoreState {
    fn default() -> Self {
        Self::new()
    }
}
