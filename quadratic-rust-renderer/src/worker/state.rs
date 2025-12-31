//! Renderer State
//!
//! Core state for the renderer. Holds:
//! - Viewport (camera/zoom/pan)
//! - Sheets (each sheet owns its fills, hashes, labels)
//! - UI (global elements like grid lines, cursor, headings)
//! - Fonts (shared bitmap fonts for text rendering)

use quadratic_core_shared::{RenderCell, RenderFill, SheetFill, SheetId, SheetOffsets};

use crate::sheets::text::{
    BitmapFont, BitmapFonts, CellLabel, CellsTextHash, VisibleHashBounds, hash_key,
};
use crate::sheets::{Sheet, Sheets};
use crate::ui::ui::UI;
use crate::viewport::Viewport;

/// Core renderer state
pub struct RendererState {
    /// Viewport (camera/zoom/pan state)
    pub viewport: Viewport,

    /// All sheets (each owns its fills, hashes, labels)
    pub sheets: Sheets,

    /// Global UI elements (grid lines, cursor, headings)
    pub ui: UI,

    /// Bitmap fonts for text rendering (shared across all sheets)
    pub fonts: BitmapFonts,

    /// Whether the renderer is running
    pub running: bool,

    /// Whether to render headings
    pub show_headings: bool,

    /// Debug: show colored overlay on text that was recalculated this frame
    pub debug_show_text_updates: bool,
}

impl RendererState {
    /// Create a new renderer state
    pub fn new(width: f32, height: f32) -> Self {
        Self {
            viewport: Viewport::new(width, height),
            sheets: Sheets::default(),
            ui: UI::default(),
            fonts: BitmapFonts::default(),
            running: false,
            show_headings: true,
            debug_show_text_updates: false,
        }
    }

    // =========================================================================
    // Lifecycle
    // =========================================================================

    pub fn start(&mut self) {
        self.running = true;
    }

    pub fn stop(&mut self) {
        self.running = false;
    }

    pub fn is_running(&self) -> bool {
        self.running
    }

    // =========================================================================
    // Sheet Management
    // =========================================================================

    /// Set a sheet (creates or updates)
    pub fn set_sheet(&mut self, sheet_id: SheetId, offsets: SheetOffsets) {
        self.sheets.set_sheet(sheet_id, offsets);
        // Mark dirty to trigger rerender
        self.viewport.dirty = true;
        self.ui.grid_lines.dirty = true;
        self.ui.headings.set_dirty();
    }

    /// Set the current active sheet
    pub fn set_current_sheet(&mut self, sheet_id: SheetId) {
        if self.sheets.set_current_sheet(sheet_id) {
            // Sheet changed - mark things dirty
            self.viewport.dirty = true;
            self.ui.grid_lines.dirty = true;
            self.ui.headings.set_dirty();
        }
    }

    /// Get current sheet offsets
    pub fn current_sheet_offsets(&self) -> &SheetOffsets {
        self.sheets.current_sheet_offsets()
    }

    /// Get current sheet mutably
    pub fn current_sheet_mut(&mut self) -> Option<&mut Sheet> {
        self.sheets.current_sheet_mut()
    }

    // =========================================================================
    // Viewport
    // =========================================================================

    pub fn resize_viewport(&mut self, width: f32, height: f32, dpr: f32) {
        self.viewport.resize(width, height, dpr);
    }

    pub fn set_viewport(&mut self, x: f32, y: f32, scale: f32) {
        self.viewport.set_position(x, y);
        self.viewport.set_scale(scale);
    }

    pub fn get_scale(&self) -> f32 {
        self.viewport.scale()
    }

    pub fn get_x(&self) -> f32 {
        self.viewport.x()
    }

    pub fn get_y(&self) -> f32 {
        self.viewport.y()
    }

    // =========================================================================
    // Headings
    // =========================================================================

    pub fn set_show_headings(&mut self, show: bool) {
        self.show_headings = show;
    }

    pub fn get_show_headings(&self) -> bool {
        self.show_headings
    }

    pub fn set_debug_show_text_updates(&mut self, show: bool) {
        self.debug_show_text_updates = show;
    }

    // =========================================================================
    // Fonts
    // =========================================================================

    pub fn add_font(&mut self, font: BitmapFont) {
        log::info!("Added font: {} with {} chars", font.font, font.chars.len());
        self.fonts.add(font);
    }

    pub fn has_fonts(&self) -> bool {
        !self.fonts.is_empty()
    }

    pub fn get_required_texture_uids(&self) -> Vec<u32> {
        self.fonts.get_required_texture_uids()
    }

    // =========================================================================
    // Fills (delegated to current sheet)
    // =========================================================================

    pub fn set_fills_for_hash(&mut self, hash_x: i64, hash_y: i64, fills: Vec<RenderFill>) {
        if let Some(sheet) = self.sheets.current_sheet_mut() {
            let offsets = sheet.sheet_offsets.clone();
            sheet.fills.set_hash_fills(hash_x, hash_y, fills, &offsets);
        }
    }

    pub fn set_meta_fills(&mut self, fills: Vec<SheetFill>) {
        if let Some(sheet) = self.sheets.current_sheet_mut() {
            sheet.fills.set_meta_fills(fills);
        }
    }

    // =========================================================================
    // Labels (delegated to current sheet)
    // =========================================================================

    pub fn set_labels_for_hash(&mut self, hash_x: i64, hash_y: i64, cells: Vec<RenderCell>) {
        if let Some(sheet) = self.sheets.current_sheet_mut() {
            let key = hash_key(hash_x, hash_y);

            // Remove existing hash
            if let Some(old_hash) = sheet.hashes.remove(&key) {
                sheet.label_count = sheet.label_count.saturating_sub(old_hash.label_count());
            }

            // Layout labels
            let offsets = &sheet.sheet_offsets;
            let fonts = &self.fonts;

            let labels: Vec<(i64, i64, CellLabel)> = cells
                .iter()
                .filter(|cell| !cell.value.is_empty() || cell.special.is_some())
                .map(|cell| {
                    let mut label = CellLabel::from_render_cell(cell);
                    label.update_bounds(offsets);
                    label.layout(fonts);
                    (cell.x, cell.y, label)
                })
                .collect();

            // Create new hash
            let mut hash = CellsTextHash::new(hash_x, hash_y, offsets);
            for (x, y, label) in labels {
                hash.add_label(x, y, label);
                sheet.label_count += 1;
            }

            if !hash.is_empty() {
                sheet.hashes.insert(key, hash);
            }
        }
    }

    // =========================================================================
    // Hash Management
    // =========================================================================

    pub fn get_visible_hash_bounds(&self) -> [i32; 4] {
        let bounds = self.viewport.visible_bounds();
        let hash_bounds = VisibleHashBounds::from_viewport(
            bounds.left,
            bounds.top,
            bounds.width,
            bounds.height,
            self.viewport.scale(),
            self.current_sheet_offsets(),
        );

        [
            hash_bounds.min_hash_x as i32,
            hash_bounds.max_hash_x as i32,
            hash_bounds.min_hash_y as i32,
            hash_bounds.max_hash_y as i32,
        ]
    }

    pub fn get_needed_label_hashes(&self) -> Vec<i32> {
        let bounds = self.viewport.visible_bounds();
        let hash_bounds = VisibleHashBounds::from_viewport(
            bounds.left,
            bounds.top,
            bounds.width,
            bounds.height,
            self.viewport.scale(),
            self.current_sheet_offsets(),
        );

        let mut needed: Vec<i32> = Vec::new();

        if let Some(sheet) = self.sheets.current_sheet() {
            for (hash_x, hash_y) in hash_bounds.iter() {
                let key = hash_key(hash_x, hash_y);
                if !sheet.hashes.contains_key(&key) {
                    needed.push(hash_x as i32);
                    needed.push(hash_y as i32);
                }
            }
        }

        needed
    }

    pub fn get_needed_fill_hashes(&self) -> Vec<i32> {
        if let Some(sheet) = self.sheets.current_sheet() {
            sheet
                .fills
                .get_needed_hashes(&self.viewport, &sheet.sheet_offsets)
        } else {
            Vec::new()
        }
    }

    // =========================================================================
    // Dirty Flags
    // =========================================================================

    pub fn set_viewport_dirty(&mut self) {
        self.viewport.dirty = true;
    }

    pub fn is_dirty(&self) -> bool {
        self.viewport.dirty || self.ui.is_dirty()
    }

    pub fn mark_clean(&mut self) {
        self.viewport.mark_clean();
        self.ui.mark_clean();
    }

    // =========================================================================
    // Content Update
    // =========================================================================

    pub fn update_content(&mut self) {
        let offsets = self.current_sheet_offsets().clone();
        self.ui.update(&self.viewport, &offsets);
    }

    /// Create a screen-space orthographic projection matrix
    pub fn create_screen_space_matrix(&self, width: f32, height: f32) -> [f32; 16] {
        let sx = 2.0 / width;
        let sy = -2.0 / height;
        let tx = -1.0;
        let ty = 1.0;

        [
            sx, 0.0, 0.0, 0.0, 0.0, sy, 0.0, 0.0, 0.0, 0.0, 1.0, 0.0, tx, ty, 0.0, 1.0,
        ]
    }

    /// Get text rendering parameters for the default font
    pub fn get_text_params(&self) -> (f32, f32) {
        self.fonts
            .get("OpenSans")
            .map(|f| {
                let render_size = 14.0;
                (render_size / f.size, f.distance_range)
            })
            .unwrap_or((14.0 / 42.0, 4.0))
    }

    // =========================================================================
    // Sheet Offsets
    // =========================================================================

    pub fn set_sheet_offsets(&mut self, sheet_id: SheetId, offsets: SheetOffsets) {
        if let Some(sheet) = self.sheets.get_mut(&sheet_id) {
            sheet.sheet_offsets = offsets;
            // Mark dirty to trigger rerender with new offsets
            self.viewport.dirty = true;
            self.ui.grid_lines.dirty = true;
            self.ui.headings.set_dirty();
        }
    }

    pub fn remove_sheet(&mut self, sheet_id: SheetId) {
        self.sheets.remove_sheet(sheet_id);
    }

    pub fn get_sheet_offsets(&self) -> &SheetOffsets {
        self.current_sheet_offsets()
    }

    // =========================================================================
    // Headings (delegated to UI)
    // =========================================================================

    pub fn get_heading_width(&self) -> f32 {
        self.ui.headings.heading_size().width
    }

    pub fn get_heading_height(&self) -> f32 {
        self.ui.headings.heading_size().height
    }

    pub fn set_selected_columns(&mut self, selections: &[i32]) {
        // Convert pairs of i32 to Vec<(i64, i64)>
        let pairs: Vec<(i64, i64)> = selections
            .chunks(2)
            .filter_map(|chunk| {
                if chunk.len() == 2 {
                    Some((chunk[0] as i64, chunk[1] as i64))
                } else {
                    None
                }
            })
            .collect();
        self.ui.headings.set_selected_columns(pairs);
    }

    pub fn set_selected_rows(&mut self, selections: &[i32]) {
        // Convert pairs of i32 to Vec<(i64, i64)>
        let pairs: Vec<(i64, i64)> = selections
            .chunks(2)
            .filter_map(|chunk| {
                if chunk.len() == 2 {
                    Some((chunk[0] as i64, chunk[1] as i64))
                } else {
                    None
                }
            })
            .collect();
        self.ui.headings.set_selected_rows(pairs);
    }

    pub fn set_headings_dpr(&mut self, dpr: f32) {
        self.ui.headings.set_dpr(dpr);
    }

    pub fn set_headings_dirty(&mut self) {
        self.ui.headings.set_dirty();
    }

    pub fn set_grid_lines_dirty(&mut self) {
        self.ui.grid_lines.dirty = true;
    }

    pub fn set_cursor_dirty(&mut self) {
        self.ui.cursor.dirty = true;
    }

    pub fn get_debug_show_text_updates(&self) -> bool {
        self.debug_show_text_updates
    }

    // =========================================================================
    // Cursor (delegated to UI)
    // =========================================================================

    pub fn set_cursor(&mut self, col: i64, row: i64) {
        self.ui.cursor.set_selected_cell(col, row);
    }

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

    pub fn set_a1_selection(&mut self, selection: quadratic_core_shared::A1Selection) {
        self.ui.cursor.set_a1_selection(selection);
    }

    // =========================================================================
    // Label Hash Management
    // =========================================================================

    pub fn add_label(&mut self, _text: &str, _col: i64, _row: i64) {
        // Simplified - use set_labels_for_hash for bulk operations
    }

    pub fn add_styled_label(
        &mut self,
        _text: &str,
        _col: i64,
        _row: i64,
        _font_size: Option<f32>,
        _bold: bool,
        _italic: bool,
        _color_r: f32,
        _color_g: f32,
        _color_b: f32,
        _align: Option<i32>,
        _valign: Option<i32>,
    ) {
        // Simplified - use set_labels_for_hash for bulk operations
    }

    pub fn clear_labels(&mut self) {
        if let Some(sheet) = self.sheets.current_sheet_mut() {
            sheet.hashes.clear();
            sheet.label_count = 0;
        }
    }

    pub fn get_label_count(&self) -> usize {
        self.sheets.current_sheet().map_or(0, |s| s.label_count)
    }

    pub fn get_needed_hashes(&self) -> Vec<i32> {
        self.get_needed_label_hashes()
    }

    pub fn add_labels_batch(
        &mut self,
        _hash_x: i64,
        _hash_y: i64,
        _texts: Vec<String>,
        _cols: &[i32],
        _rows: &[i32],
        _colors: Option<Vec<u8>>,
    ) {
        // Deprecated: use set_labels_for_hash with RenderCell data
        log::warn!("add_labels_batch is deprecated, use set_labels_for_hash");
    }

    pub fn mark_labels_hash_dirty(&mut self, hash_x: i64, hash_y: i64) {
        if let Some(sheet) = self.sheets.current_sheet_mut() {
            let key = hash_key(hash_x, hash_y);
            if let Some(hash) = sheet.hashes.get_mut(&key) {
                hash.mark_dirty();
            }
        }
    }

    pub fn get_offscreen_label_hashes(&self) -> Vec<i32> {
        // TODO: implement proper offscreen tracking
        Vec::new()
    }

    pub fn unload_label_hash(&mut self, hash_x: i64, hash_y: i64) {
        if let Some(sheet) = self.sheets.current_sheet_mut() {
            sheet.remove_hash(hash_x, hash_y);
        }
    }

    pub fn has_label_hash(&self, hash_x: i64, hash_y: i64) -> bool {
        self.sheets
            .current_sheet()
            .map_or(false, |s| s.has_hash(hash_x, hash_y))
    }

    pub fn get_label_hash_count(&self) -> usize {
        self.sheets.current_sheet().map_or(0, |s| s.hash_count())
    }

    // =========================================================================
    // Fill Hash Management
    // =========================================================================

    pub fn fills_meta_loaded(&self) -> bool {
        self.sheets
            .current_sheet()
            .map_or(false, |s| s.fills.meta_fills_loaded())
    }

    pub fn mark_fills_hash_dirty(&mut self, hash_x: i64, hash_y: i64) {
        if let Some(sheet) = self.sheets.current_sheet_mut() {
            sheet.fills.mark_hash_dirty(hash_x, hash_y);
        }
    }

    pub fn get_offscreen_fill_hashes(&self) -> Vec<i32> {
        // TODO: implement proper offscreen tracking
        Vec::new()
    }

    pub fn unload_fill_hash(&mut self, hash_x: i64, hash_y: i64) {
        if let Some(sheet) = self.sheets.current_sheet_mut() {
            sheet.fills.unload_hash(hash_x, hash_y);
        }
    }

    pub fn has_fill_hash(&self, hash_x: i64, hash_y: i64) -> bool {
        self.sheets
            .current_sheet()
            .map_or(false, |s| s.fills.has_hash(hash_x, hash_y))
    }

    pub fn get_fill_hash_count(&self) -> usize {
        self.sheets
            .current_sheet()
            .map_or(0, |s| s.fills.hash_count())
    }

    pub fn get_fill_count(&self) -> usize {
        self.sheets
            .current_sheet()
            .map_or(0, |s| s.fills.fill_count())
    }

    // =========================================================================
    // Stats / Debug
    // =========================================================================

    pub fn get_sprite_memory_bytes(&self) -> usize {
        // TODO: implement sprite memory tracking
        0
    }

    pub fn get_sprite_count(&self) -> usize {
        // TODO: implement sprite count
        0
    }

    pub fn add_test_fills(&mut self) {
        // No-op for now
    }

    pub fn add_test_labels(&mut self) {
        // No-op for now
    }

    pub fn get_column_max_width(&self, _col: i64) -> f32 {
        // TODO: implement via Sheet
        0.0
    }

    pub fn get_row_max_height(&self, _row: i64) -> f32 {
        // TODO: implement via Sheet
        0.0
    }

    pub fn get_offscreen_hashes(&self) -> Vec<i32> {
        self.get_offscreen_label_hashes()
    }

    pub fn remove_hash(&mut self, hash_x: i32, hash_y: i32) {
        self.unload_label_hash(hash_x as i64, hash_y as i64);
    }

    pub fn has_hash(&self, hash_x: i32, hash_y: i32) -> bool {
        self.has_label_hash(hash_x as i64, hash_y as i64)
    }

    pub fn get_hash_count(&self) -> usize {
        self.get_label_hash_count()
    }

    // =========================================================================
    // Methods that need updating in renderer.rs
    // (These provide access to data that was previously on RendererState directly)
    // =========================================================================

    /// Get the heading dimensions (headings are updated in update_content())
    pub fn get_heading_dimensions(&self) -> (f32, f32) {
        (self.get_heading_width(), self.get_heading_height())
    }

    pub fn process_dirty_hashes(&mut self, _budget_ms: f32) -> (usize, usize) {
        // TODO: implement hash processing
        (0, 0)
    }

    pub fn force_dirty(&mut self) {
        self.viewport.dirty = true;
        self.ui.grid_lines.dirty = true;
        self.ui.cursor.dirty = true;
        self.ui.headings.set_dirty();
    }

    pub fn get_heading_text_params(&self) -> (f32, f32) {
        self.get_text_params()
    }
}
