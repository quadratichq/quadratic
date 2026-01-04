//! Layout state

use std::collections::HashSet;

use quadratic_core_shared::{
    GridBounds, Pos, RenderCell, RenderCodeCell, RenderFill, SheetFill, SheetId, SheetOffsets,
};
use quadratic_renderer_core::{hash_key, RenderBatch};

use crate::sheets::text::{BitmapFonts, CellLabel, CellsTextHash};
use crate::sheets::Sheets;
use crate::ui::UILayout;
use crate::viewport::Viewport;

/// Layout state - owns all sheet data and performs layout calculations
pub struct LayoutState {
    /// Viewport state
    pub viewport: Viewport,

    /// All sheets
    pub sheets: Sheets,

    /// Global UI layout
    pub ui: UILayout,

    /// Bitmap fonts for text layout
    pub fonts: BitmapFonts,

    /// Whether running
    pub running: bool,

    /// Whether headings are visible
    pub show_headings: bool,

    /// Frame sequence number
    sequence: u64,

    /// Pending hash requests
    pending_hash_requests: HashSet<(i64, i64)>,
}

impl LayoutState {
    pub fn new() -> Self {
        Self {
            viewport: Viewport::new(800.0, 600.0),
            sheets: Sheets::default(),
            ui: UILayout::new(),
            fonts: BitmapFonts::new(),
            running: false,
            show_headings: true,
            sequence: 0,
            pending_hash_requests: HashSet::new(),
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
    // Viewport
    // =========================================================================

    pub fn set_viewport(&mut self, x: f32, y: f32, scale: f32) {
        self.viewport.set_position(x, y);
        self.viewport.set_scale(scale);
    }

    pub fn resize_viewport(&mut self, width: f32, height: f32, dpr: f32) {
        self.viewport.resize(width, height, dpr);
    }

    // =========================================================================
    // Sheets
    // =========================================================================

    pub fn set_sheet(&mut self, sheet_id: SheetId, offsets: SheetOffsets, bounds: GridBounds) {
        self.sheets.set_sheet(sheet_id, offsets, bounds);
        self.viewport.dirty = true;
        self.ui.grid_lines.dirty = true;
        self.ui.headings.dirty = true;
    }

    pub fn set_current_sheet(&mut self, sheet_id: SheetId) {
        if self.sheets.set_current_sheet(sheet_id) {
            self.viewport.dirty = true;
            self.ui.grid_lines.dirty = true;
            self.ui.headings.dirty = true;
        }
    }

    pub fn current_sheet_id(&self) -> Option<SheetId> {
        self.sheets.current_sheet_id()
    }

    // =========================================================================
    // Fonts
    // =========================================================================

    pub fn add_font(&mut self, font: crate::sheets::text::BitmapFont) {
        self.fonts.add(font);
    }

    pub fn has_fonts(&self) -> bool {
        !self.fonts.is_empty()
    }

    // =========================================================================
    // Labels
    // =========================================================================

    pub fn set_labels_for_hash(&mut self, hash_x: i64, hash_y: i64, cells: Vec<RenderCell>) {
        // Clear pending
        self.pending_hash_requests.remove(&(hash_x, hash_y));

        let Some(sheet) = self.sheets.current_sheet_mut() else {
            return;
        };

        let key = hash_key(hash_x, hash_y);
        let offsets = sheet.sheet_offsets.clone();

        // Clear old content
        sheet.clear_content_for_hash(hash_x, hash_y);
        if let Some(old_hash) = sheet.hashes.remove(&key) {
            sheet.label_count = sheet.label_count.saturating_sub(old_hash.label_count());
        }

        // Create new hash
        let mut hash = CellsTextHash::new(hash_x, hash_y, &offsets);

        for cell in &cells {
            if cell.value.is_empty() && cell.special.is_none() {
                continue;
            }

            let mut label = CellLabel::from_render_cell(cell);
            label.update_bounds(&offsets);
            // Layout immediately to calculate overflow values.
            // This is needed so update_clip_bounds() can properly detect overflow
            // when checking for neighbor clipping.
            label.layout(&self.fonts);

            hash.add_label(cell.x, cell.y, label);
            sheet.add_content(cell.x, cell.y);
            sheet.label_count += 1;
        }

        sheet.hashes.insert(key, hash);
        self.viewport.dirty = true;
    }

    // =========================================================================
    // Fills
    // =========================================================================

    pub fn set_fills_for_hash(&mut self, hash_x: i64, hash_y: i64, fills: Vec<RenderFill>) {
        if let Some(sheet) = self.sheets.current_sheet_mut() {
            let offsets = sheet.sheet_offsets.clone();
            sheet.fills.set_hash_fills(hash_x, hash_y, fills, &offsets);
        }
        self.viewport.dirty = true;
    }

    pub fn set_meta_fills(&mut self, fills: Vec<SheetFill>) {
        if let Some(sheet) = self.sheets.current_sheet_mut() {
            sheet.fills.set_meta_fills(fills);
        }
        self.viewport.dirty = true;
    }

    // =========================================================================
    // Tables
    // =========================================================================

    pub fn set_code_cells(&mut self, _sheet_id: SheetId, _code_cells: Vec<RenderCodeCell>) {
        // TODO: Implement table layout
    }

    pub fn update_code_cell(&mut self, _sheet_id: SheetId, _pos: Pos, _code_cell: Option<RenderCodeCell>) {
        // TODO: Implement table layout
    }

    pub fn set_active_table(&mut self, _sheet_id: SheetId, _pos: Option<Pos>) {
        // TODO: Implement table layout
    }

    // =========================================================================
    // Hash Management
    // =========================================================================

    pub fn get_unrequested_hashes(&mut self) -> Vec<Pos> {
        let Some(sheet) = self.sheets.current_sheet() else {
            return Vec::new();
        };

        let offsets = &sheet.sheet_offsets;
        let hash_bounds = self.viewport.visible_hash_bounds(offsets);

        let mut needed = Vec::new();

        for (hash_x, hash_y) in hash_bounds.iter() {
            let key = hash_key(hash_x, hash_y);

            if sheet.hashes.contains_key(&key) {
                continue;
            }
            if self.pending_hash_requests.contains(&(hash_x, hash_y)) {
                continue;
            }

            needed.push(Pos::new(hash_x, hash_y));
            self.pending_hash_requests.insert((hash_x, hash_y));

            // Limit batch size
            if needed.len() >= 20 {
                break;
            }
        }

        needed
    }

    // =========================================================================
    // Clip Bounds Calculation
    // =========================================================================

    /// Update clip bounds for all visible hashes.
    /// Similar to TypeScript's checkClip method in CellsTextHash.
    ///
    /// For each label:
    /// - Find neighbor to the left: if they have right overflow, clip them at our left edge
    /// - Find neighbor to the right: if they have left overflow, clip them at our right edge
    /// - If we have left overflow extending into neighbor, clip ourselves at neighbor's right edge
    /// - If we have right overflow extending into neighbor, clip ourselves at neighbor's left edge
    ///
    /// This is only run when there are dirty hashes that need processing.
    fn update_clip_bounds(&mut self) {
        // Only run clip bounds calculation if there are dirty hashes
        // This prevents running every frame when nothing has changed
        let has_dirty_hashes = self.sheets.current_sheet().map_or(false, |sheet| {
            sheet.hashes.values().any(|h| h.is_dirty())
        });
        if !has_dirty_hashes {
            return;
        }
        use quadratic_renderer_core::get_hash_coords;

        let Some(sheet) = self.sheets.current_sheet_mut() else {
            return;
        };

        let offsets = sheet.sheet_offsets.clone();
        let hash_bounds = self.viewport.visible_hash_bounds(&offsets);

        // We need multiple passes to handle cross-hash clipping:
        // 1. First, collect all label data from visible hashes
        // 2. Then calculate clip updates
        // 3. Finally, apply updates

        struct LabelInfo {
            hash_key: u64,
            col: i64,
            row: i64,
            cell_left: f32,
            cell_right: f32,
            overflow_left: f32,
            overflow_right: f32,
        }

        struct ClipUpdate {
            hash_key: u64,
            col: i64,
            row: i64,
            clip_left: Option<f32>,
            clip_right: Option<f32>,
        }

        // Collect label info from all visible hashes
        let mut label_infos: Vec<LabelInfo> = Vec::new();

        for (hx, hy) in hash_bounds.iter() {
            let key = hash_key(hx, hy);
            if let Some(hash) = sheet.hashes.get(&key) {
                for (_, label) in hash.labels_iter() {
                    let overflow_right = label.overflow_right();
                    let overflow_left = label.overflow_left();

                    // Log labels with overflow
                    if overflow_right > 0.0 || overflow_left > 0.0 {
                        log::debug!(
                            "[update_clip_bounds] Label ({}, {}): overflow_left={:.1}, overflow_right={:.1}, cell_left={:.1}, cell_right={:.1}",
                            label.col(),
                            label.row(),
                            overflow_left,
                            overflow_right,
                            label.cell_left(),
                            label.cell_right()
                        );
                    }

                    label_infos.push(LabelInfo {
                        hash_key: key,
                        col: label.col(),
                        row: label.row(),
                        cell_left: label.cell_left(),
                        cell_right: label.cell_right(),
                        overflow_left,
                        overflow_right,
                    });
                }
            }
        }

        // Calculate clip updates
        let mut updates: Vec<ClipUpdate> = Vec::new();

        for info in &label_infos {
            let mut clip_left: Option<f32> = None;
            let mut clip_right: Option<f32> = None;

            // Check neighbor to the LEFT
            if let Some(neighbor_col) = sheet.find_content_left(info.col, info.row) {
                let (neighbor_hash_x, neighbor_hash_y) = get_hash_coords(neighbor_col, info.row);
                let neighbor_key = hash_key(neighbor_hash_x, neighbor_hash_y);

                if let Some(neighbor_hash) = sheet.hashes.get(&neighbor_key) {
                    if let Some(neighbor_label) = neighbor_hash.get_label(neighbor_col, info.row) {
                        let neighbor_cell_right = neighbor_label.cell_right();
                        let neighbor_overflow_right = neighbor_label.overflow_right();

                        // If neighbor has right overflow extending into our cell, clip them
                        if neighbor_overflow_right > 0.0 {
                            let neighbor_text_right = neighbor_cell_right + neighbor_overflow_right;
                            if neighbor_text_right > info.cell_left {
                                updates.push(ClipUpdate {
                                    hash_key: neighbor_key,
                                    col: neighbor_col,
                                    row: info.row,
                                    clip_left: None,
                                    clip_right: Some(info.cell_left),
                                });
                            }
                        }

                        // If WE have left overflow extending into neighbor, clip ourselves
                        if info.overflow_left > 0.0 {
                            let text_left = info.cell_left - info.overflow_left;
                            if text_left < neighbor_cell_right {
                                clip_left = Some(neighbor_cell_right);
                            }
                        }
                    }
                }
            }

            // Check neighbor to the RIGHT
            if let Some(neighbor_col) = sheet.find_content_right(info.col, info.row) {
                let (neighbor_hash_x, neighbor_hash_y) = get_hash_coords(neighbor_col, info.row);
                let neighbor_key = hash_key(neighbor_hash_x, neighbor_hash_y);

                if let Some(neighbor_hash) = sheet.hashes.get(&neighbor_key) {
                    if let Some(neighbor_label) = neighbor_hash.get_label(neighbor_col, info.row) {
                        let neighbor_cell_left = neighbor_label.cell_left();
                        let neighbor_overflow_left = neighbor_label.overflow_left();

                        // If neighbor has left overflow extending into our cell, clip them
                        if neighbor_overflow_left > 0.0 {
                            let neighbor_text_left = neighbor_cell_left - neighbor_overflow_left;
                            if neighbor_text_left < info.cell_right {
                                updates.push(ClipUpdate {
                                    hash_key: neighbor_key,
                                    col: neighbor_col,
                                    row: info.row,
                                    clip_left: Some(info.cell_right),
                                    clip_right: None,
                                });
                            }
                        }

                        // If WE have right overflow extending into neighbor, clip ourselves
                        if info.overflow_right > 0.0 {
                            let text_right = info.cell_right + info.overflow_right;
                            if text_right > neighbor_cell_left {
                                clip_right = Some(neighbor_cell_left);
                            }
                        }
                    }
                }
            }

            // Add our own update if we need clipping
            if clip_left.is_some() || clip_right.is_some() {
                updates.push(ClipUpdate {
                    hash_key: info.hash_key,
                    col: info.col,
                    row: info.row,
                    clip_left,
                    clip_right,
                });
            }
        }

        // Apply all updates - only mark hash dirty if clips actually changed
        for update in updates {
            if let Some(hash) = sheet.hashes.get_mut(&update.hash_key) {
                let mut hash_needs_rebuild = false;
                if let Some(label) = hash.get_label_mut(update.col, update.row) {
                    // Check if clip_left would change
                    if let Some(cl) = update.clip_left {
                        if label.clip_left() != Some(cl) {
                            log::debug!(
                                "[update_clip_bounds] Setting clip_left={:.1} on label ({}, {})",
                                cl, update.col, update.row
                            );
                            label.set_clip_left(cl);
                            hash_needs_rebuild = true;
                        }
                    }
                    // Check if clip_right would change
                    if let Some(cr) = update.clip_right {
                        if label.clip_right() != Some(cr) {
                            log::debug!(
                                "[update_clip_bounds] Setting clip_right={:.1} on label ({}, {})",
                                cr, update.col, update.row
                            );
                            label.set_clip_right(cr);
                            hash_needs_rebuild = true;
                        }
                    }
                }
                // Mark hash as dirty so it gets rebuilt with the new clip bounds
                if hash_needs_rebuild {
                    hash.mark_dirty();
                }
            }
        }
    }

    // =========================================================================
    // Layout & Render Batch Generation
    // =========================================================================

    /// Generate a RenderBatch containing only dirty/changed data.
    /// Returns None if nothing has changed.
    pub fn generate_render_batch(&mut self) -> Option<RenderBatch> {
        let bounds = self.viewport.visible_bounds();
        let offsets = self.sheets.current_sheet_offsets();

        // Track if we have any dirty content
        let mut has_dirty_content = false;

        // Update clip bounds for text overflow before rebuilding hashes.
        // This must be done BEFORE hash.rebuild() so that clipping is applied
        // when generating text geometry.
        self.update_clip_bounds();

        // Update UI (this sets dirty flags internally)
        self.ui.update(&self.viewport, &offsets);

        // Build render batch
        let mut batch = RenderBatch {
            sequence: self.sequence,
            viewport_scale: self.viewport.scale(),
            viewport_x: bounds.left,
            viewport_y: bounds.top,
            viewport_width: bounds.width,
            viewport_height: bounds.height,
            ..Default::default()
        };

        // Grid lines - only include if dirty
        if let Some(buffer) = self.ui.grid_lines.take_buffer() {
            log::debug!("[generate_render_batch] Including grid lines buffer");
            batch.grid_lines = Some(buffer);
            has_dirty_content = true;
        }

        // Cursor - only include if dirty
        if let Some(data) = self.ui.cursor.take_render_data() {
            log::debug!("[generate_render_batch] Including cursor data");
            batch.cursor = Some(data);
            has_dirty_content = true;
        }

        // Process visible hashes - ONLY include dirty ones
        if let Some(sheet) = self.sheets.current_sheet_mut() {
            let hash_bounds = self.viewport.visible_hash_bounds(&offsets);

            for (hash_x, hash_y) in hash_bounds.iter() {
                let key = hash_key(hash_x, hash_y);

                // Text hashes - ONLY include if dirty
                if let Some(hash) = sheet.hashes.get_mut(&key) {
                    if hash.is_dirty() {
                        log::info!(
                            "[generate_render_batch] Rebuilding dirty hash ({}, {}) with {} labels",
                            hash_x, hash_y, hash.label_count()
                        );
                        // Rebuild and add to batch
                        let render_data = hash.rebuild(&self.fonts);
                        batch.hashes.push(render_data);
                        has_dirty_content = true;
                    }
                    // If not dirty, renderer already has this data cached - don't resend
                }

                // Fill hashes - rebuild if dirty but don't add to batch yet
                // (fills are handled differently)
                if let Some(fill_hash) = sheet.fills.hashes_mut().get_mut(&key) {
                    if fill_hash.is_dirty() {
                        fill_hash.rebuild_if_dirty(&offsets);
                        has_dirty_content = true;
                    }
                }
            }

            // Meta fills - only include if they changed
            // TODO: Track meta fills dirty state properly
        }

        // Mark clean
        self.viewport.mark_clean();
        self.ui.mark_clean();

        // Only return a batch if something was dirty
        if has_dirty_content {
            self.sequence += 1;
            batch.sequence = self.sequence;
            Some(batch)
        } else {
            None
        }
    }

    // =========================================================================
    // Hash Management
    // =========================================================================

    pub fn mark_hash_dirty(&mut self, hash_x: i64, hash_y: i64) {
        if let Some(sheet) = self.sheets.current_sheet_mut() {
            let key = hash_key(hash_x, hash_y);
            if let Some(hash) = sheet.hashes.get_mut(&key) {
                hash.mark_dirty();
            }
        }
    }

    // =========================================================================
    // Queries
    // =========================================================================

    pub fn get_column_max_width(&self, column: i64) -> f32 {
        self.sheets
            .current_sheet()
            .map(|sheet| {
                sheet
                    .hashes
                    .values()
                    .map(|h| h.get_column_max_width(column))
                    .fold(0.0f32, |a, b| a.max(b))
            })
            .unwrap_or(0.0)
    }

    pub fn get_row_max_height(&self, row: i64) -> f32 {
        self.sheets
            .current_sheet()
            .map(|sheet| {
                sheet
                    .hashes
                    .values()
                    .map(|h| h.get_row_max_height(row))
                    .fold(0.0f32, |a, b| a.max(b))
            })
            .unwrap_or(0.0)
    }

    pub fn get_heading_dimensions(&self) -> (f32, f32) {
        if self.show_headings {
            self.ui.headings.heading_size()
        } else {
            (0.0, 0.0)
        }
    }
}

impl Default for LayoutState {
    fn default() -> Self {
        Self::new()
    }
}
