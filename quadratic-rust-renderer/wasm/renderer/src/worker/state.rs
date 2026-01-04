//! Renderer State
//!
//! Core state for the renderer. Holds:
//! - Viewport (camera/zoom/pan)
//! - Sheets (each sheet owns its fills, hashes, labels)
//! - UI (global elements like grid lines, cursor, headings)
//! - Fonts (shared bitmap fonts for text rendering)

use std::collections::HashSet;

use quadratic_core_shared::{
    GridBounds, Pos, RenderCell, RenderCodeCell, RenderFill, SheetFill, SheetId, SheetOffsets,
};

use crate::sheets::text::{
    BitmapFont, BitmapFonts, EmojiSprites, SpriteCacheManager, VisibleHashBounds, hash_key,
};
use crate::sheets::{Sheet, Sheets};
use crate::ui::ui::UI;
use crate::viewport::Viewport;
use crate::worker::BatchCache;

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

    /// Emoji spritesheets for emoji rendering (shared across all sheets)
    pub emoji_sprites: EmojiSprites,

    /// Sprite cache manager for zoomed-out rendering
    pub sprite_cache: SpriteCacheManager,

    /// Whether the renderer is running
    pub running: bool,

    /// Whether to render headings
    pub show_headings: bool,

    /// Debug: show colored overlay on text that was recalculated this frame
    pub debug_show_text_updates: bool,

    /// Hashes that have been requested but not yet received
    pending_hash_requests: HashSet<(i64, i64)>,

    /// Cache for RenderBatch from the layout worker
    pub batch_cache: BatchCache,
}

impl RendererState {
    /// Create a new renderer state
    pub fn new(width: f32, height: f32) -> Self {
        Self {
            viewport: Viewport::new(width, height),
            sheets: Sheets::default(),
            ui: UI::default(),
            fonts: BitmapFonts::default(),
            emoji_sprites: EmojiSprites::new(),
            sprite_cache: SpriteCacheManager::new(),
            running: false,
            show_headings: true,
            debug_show_text_updates: false,
            pending_hash_requests: HashSet::new(),
            batch_cache: BatchCache::new(),
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
    pub fn set_sheet(&mut self, sheet_id: SheetId, offsets: SheetOffsets, bounds: GridBounds) {
        self.sheets.set_sheet(sheet_id, offsets, bounds);
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
        self.fonts.add(font);
    }

    pub fn has_fonts(&self) -> bool {
        !self.fonts.is_empty()
    }

    pub fn get_required_texture_uids(&self) -> Vec<u32> {
        self.fonts.get_required_texture_uids()
    }

    // =========================================================================
    // Emoji Sprites
    // =========================================================================

    /// Load emoji mapping from JSON string
    pub fn load_emoji_mapping(&mut self, json: &str) -> Result<(), String> {
        self.emoji_sprites.load_mapping(json)
    }

    // =========================================================================
    // Fills (delegated to current sheet)
    // =========================================================================

    pub fn set_fills_for_hash(&mut self, hash_x: i64, hash_y: i64, fills: Vec<RenderFill>) {
        if let Some(sheet) = self.sheets.current_sheet_mut() {
            let offsets = sheet.sheet_offsets.clone();
            sheet.fills.set_hash_fills(hash_x, hash_y, fills, &offsets);
        }
        // Mark viewport dirty to trigger re-render with new fill data
        self.viewport.dirty = true;
    }

    pub fn set_meta_fills(&mut self, fills: Vec<SheetFill>) {
        if let Some(sheet) = self.sheets.current_sheet_mut() {
            sheet.fills.set_meta_fills(fills);
        }
        // Mark viewport dirty to trigger re-render with new meta fill data
        self.viewport.dirty = true;
    }

    // =========================================================================
    // Tables (delegated to current or specific sheet)
    // =========================================================================

    /// Set all code cells (tables) for a sheet
    pub fn set_code_cells(&mut self, sheet_id: SheetId, code_cells: Vec<RenderCodeCell>) {
        if let Some(sheet) = self.sheets.get_mut(&sheet_id) {
            let offsets = sheet.sheet_offsets.clone();
            sheet.tables.set_tables(code_cells.clone(), &offsets);
        }
        // Mark viewport dirty to trigger re-render with new table data
        self.viewport.dirty = true;
    }

    /// Update a single code cell (table)
    pub fn update_code_cell(
        &mut self,
        sheet_id: SheetId,
        pos: Pos,
        code_cell: Option<RenderCodeCell>,
    ) {
        if let Some(sheet) = self.sheets.get_mut(&sheet_id) {
            let offsets = sheet.sheet_offsets.clone();
            sheet.tables.update_table(pos, code_cell, &offsets);
        }
        // Mark viewport dirty to trigger re-render with updated table
        self.viewport.dirty = true;
    }

    /// Set the active (selected) table for a sheet
    pub fn set_active_table(&mut self, sheet_id: SheetId, pos: Option<Pos>) {
        if let Some(sheet) = self.sheets.get_mut(&sheet_id) {
            sheet.tables.set_active_table(pos);
        }
        // Mark viewport dirty to trigger re-render with updated active state
        self.viewport.dirty = true;
    }

    // =========================================================================
    // Labels (delegated to current sheet)
    // =========================================================================

    pub fn set_labels_for_hash(&mut self, hash_x: i64, hash_y: i64, cells: Vec<RenderCell>) {
        // Clear pending request status for this hash
        self.clear_pending_hash(hash_x, hash_y);

        // NOTE: The Layout Worker does all the heavy text layout and sends
        // pre-computed RenderBatch to us. The Render Worker only needs to:
        // 1. Track loaded hashes (to avoid re-requesting)
        // 2. Track label count (for stats)
        //
        // We intentionally skip:
        // - CellLabel creation and layout (Layout Worker handles this)
        // - Emoji page loading (Layout Worker handles this)
        // - Clip bounds calculation (Layout Worker handles this)
        // - Content cache for overflow clipping (Layout Worker handles this)

        if let Some(sheet) = self.sheets.current_sheet_mut() {
            // Count cells with content (for stats)
            let cell_count = cells
                .iter()
                .filter(|cell| !cell.value.is_empty() || cell.special.is_some())
                .count();

            // Mark hash as loaded (prevents re-requesting)
            // Rendering uses batch_cache, not stored labels
            sheet.mark_hash_loaded(hash_x, hash_y);
            sheet.label_count += cell_count;
        }

        // Mark viewport dirty to trigger re-render with new data from batch_cache
        self.viewport.dirty = true;
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
            self.current_sheet_offsets(),
        );

        let mut needed: Vec<i32> = Vec::new();

        if let Some(sheet) = self.sheets.current_sheet() {
            for (hash_x, hash_y) in hash_bounds.iter() {
                let key = hash_key(hash_x, hash_y);
                if !sheet.loaded_hashes.contains(&key) {
                    needed.push(hash_x as i32);
                    needed.push(hash_y as i32);
                }
            }
        }

        needed
    }

    /// Maximum number of hashes to request in a single batch
    /// This prevents overwhelming the system when zoomed out very far
    const MAX_HASH_REQUEST_BATCH: usize = 20;

    /// Get needed hashes that haven't been requested yet (as Pos for requesting)
    pub fn get_unrequested_hashes(&mut self) -> Vec<Pos> {
        let bounds = self.viewport.visible_bounds();
        let hash_bounds = VisibleHashBounds::from_viewport(
            bounds.left,
            bounds.top,
            bounds.width,
            bounds.height,
            self.current_sheet_offsets(),
        );

        let mut needed: Vec<Pos> = Vec::new();
        let mut skipped_loaded = 0;
        let mut skipped_pending = 0;

        if let Some(sheet) = self.sheets.current_sheet() {
            for (hash_x, hash_y) in hash_bounds.iter() {
                let key = hash_key(hash_x, hash_y);

                // Track why we skip hashes
                if sheet.loaded_hashes.contains(&key) {
                    skipped_loaded += 1;
                    continue;
                }
                if self.pending_hash_requests.contains(&(hash_x, hash_y)) {
                    skipped_pending += 1;
                    continue;
                }
                // NOTE: Removed bounds check - it was causing hashes beyond reported bounds
                // to be skipped (e.g., row 200+ when bounds.max.y was incorrect).
                // The Layout Worker handles hash requests without this restriction.

                needed.push(Pos::new(hash_x, hash_y));
                // Mark as pending
                self.pending_hash_requests.insert((hash_x, hash_y));

                // Limit batch size to prevent overwhelming the system
                if needed.len() >= Self::MAX_HASH_REQUEST_BATCH {
                    break;
                }
            }

            // Log filtering stats
            if !needed.is_empty() {
                log::info!(
                    "[rust_renderer] get_unrequested_hashes: requesting {} hashes, skipped {} (loaded), {} (pending)",
                    needed.len(),
                    skipped_loaded,
                    skipped_pending,
                );
            }
        }

        needed
    }

    /// Clear pending status for a hash (called when hash data is received)
    pub fn clear_pending_hash(&mut self, hash_x: i64, hash_y: i64) {
        self.pending_hash_requests.remove(&(hash_x, hash_y));
    }

    /// Get the current sheet ID (if any)
    /// Note: This can return Some even if the sheet hasn't been created yet
    pub fn current_sheet_id(&self) -> Option<SheetId> {
        self.sheets.current.clone()
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
    ///
    /// Returns (atlas_font_size, distance_range) where:
    /// - atlas_font_size: The font size the atlas was generated at (e.g., 42.0 for OpenSans)
    /// - distance_range: MSDF distance field range (typically 4.0)
    ///
    /// Note: font_scale is now calculated per-label based on label.font_size / atlas_font_size
    /// to properly support different font sizes in the same sheet.
    pub fn get_text_params(&self) -> (f32, f32) {
        self.fonts
            .get("OpenSans")
            .map(|f| (f.size, f.distance_range))
            .unwrap_or((42.0, 4.0))
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
            sheet.loaded_hashes.clear();
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
    }

    pub fn mark_labels_hash_dirty(&mut self, _hash_x: i64, _hash_y: i64) {
        // No-op: Layout worker handles dirty tracking, renderer receives pre-built data via BatchCache
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
