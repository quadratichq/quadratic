//! Shared Renderer State
//!
//! Contains all state shared between WebGL and WebGPU renderers.
//! This eliminates duplication of viewport, cells, fonts, and hash management.

use std::collections::HashMap;

use quadratic_core_shared::{
    CellAlign, CellVerticalAlign, CellWrap, RenderCell, RenderCellSpecial, RenderFill,
    RenderNumber, NumericFormat, NumericFormatKind, SheetFill,
};

use crate::cells::CellsSheet;
use crate::content::Content;
use crate::fills::CellsFills;
use crate::headings::GridHeadings;
use crate::text::cell_label::{TextAlign, VerticalAlign};
use crate::text::{
    BitmapFont, BitmapFonts, CellLabel, CellsTextHash, VisibleHashBounds, get_hash_coords, hash_key,
};
use crate::viewport::Viewport;

/// Shared state between WebGL and WebGPU renderers
///
/// This struct contains all the non-rendering-specific state that is
/// identical between the two renderer backends.
pub struct RendererState {
    /// Viewport (camera/zoom/pan state)
    pub viewport: Viewport,

    /// Current sheet being rendered
    pub cells_sheet: CellsSheet,

    /// Renderable content (grid lines, cursor)
    pub content: Content,

    /// Cell fills (background colors)
    pub fills: CellsFills,

    /// Bitmap fonts for text rendering
    pub fonts: BitmapFonts,

    /// Spatial hashes containing cell labels (15×30 cell regions)
    /// Key is computed from (hash_x, hash_y) coordinates
    pub hashes: HashMap<u64, CellsTextHash>,

    /// Total label count (cached for stats)
    pub label_count: usize,

    /// Whether the renderer is running
    pub running: bool,

    /// Grid headings (column/row headers)
    pub headings: GridHeadings,

    /// Whether to render headings
    pub show_headings: bool,
}

impl RendererState {
    /// Create a new renderer state
    pub fn new(width: f32, height: f32) -> Self {
        let sheet_id = "test".to_string();
        Self {
            viewport: Viewport::new(width, height),
            cells_sheet: CellsSheet::new(sheet_id.clone()),
            content: Content::new(),
            fills: CellsFills::new(sheet_id),
            fonts: BitmapFonts::new(),
            hashes: HashMap::new(),
            label_count: 0,
            running: false,
            headings: GridHeadings::new(),
            show_headings: true,
        }
    }

    // =========================================================================
    // Lifecycle
    // =========================================================================

    /// Start the renderer
    pub fn start(&mut self) {
        self.running = true;
    }

    /// Stop the renderer
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

    /// Resize the viewport
    pub fn resize_viewport(&mut self, width: f32, height: f32, dpr: f32) {
        self.viewport.resize(width, height, dpr);
    }

    /// Pan the viewport
    pub fn pan(&mut self, dx: f32, dy: f32) {
        self.viewport.pan(dx, dy);
    }

    /// Zoom the viewport
    pub fn zoom(&mut self, factor: f32, center_x: f32, center_y: f32) {
        self.viewport.zoom(factor, center_x, center_y);
    }

    /// Set viewport position directly
    pub fn set_viewport(&mut self, x: f32, y: f32, scale: f32) {
        self.viewport.set_position(x, y);
        self.viewport.set_scale(scale);
    }

    /// Get current scale
    pub fn get_scale(&self) -> f32 {
        self.viewport.scale()
    }

    /// Get viewport X
    pub fn get_x(&self) -> f32 {
        self.viewport.x()
    }

    /// Get viewport Y
    pub fn get_y(&self) -> f32 {
        self.viewport.y()
    }

    // =========================================================================
    // Headings
    // =========================================================================

    /// Toggle headings visibility
    pub fn set_show_headings(&mut self, show: bool) {
        self.show_headings = show;
    }

    /// Get headings visibility
    pub fn get_show_headings(&self) -> bool {
        self.show_headings
    }

    /// Get heading size (row header width in pixels)
    pub fn get_heading_width(&self) -> f32 {
        self.headings.heading_size().width
    }

    /// Get heading size (column header height in pixels)
    pub fn get_heading_height(&self) -> f32 {
        self.headings.heading_size().height
    }

    /// Set selected columns for heading highlight
    /// Takes flat array of [start1, end1, start2, end2, ...] pairs (1-indexed)
    pub fn set_selected_columns(&mut self, selections: &[i32]) {
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
        self.headings.set_selected_columns(pairs);
    }

    /// Set selected rows for heading highlight
    /// Takes flat array of [start1, end1, start2, end2, ...] pairs (1-indexed)
    pub fn set_selected_rows(&mut self, selections: &[i32]) {
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
        self.headings.set_selected_rows(pairs);
    }

    /// Set device pixel ratio for headings (affects font size)
    pub fn set_headings_dpr(&mut self, dpr: f32) {
        self.headings.set_dpr(dpr);
    }

    // =========================================================================
    // Fills (cell backgrounds)
    // =========================================================================

    /// Check if meta fills have been loaded
    pub fn fills_meta_loaded(&self) -> bool {
        self.fills.meta_fills_loaded()
    }

    /// Set fills for a specific hash
    /// fills: Vec of RenderFill structs
    pub fn set_fills_for_hash(&mut self, hash_x: i64, hash_y: i64, fills: Vec<RenderFill>) {
        self.fills
            .set_hash_fills(hash_x, hash_y, fills, &self.cells_sheet.sheet_offsets);
    }

    /// Set meta fills (infinite row/column/sheet fills)
    pub fn set_meta_fills(&mut self, fills: Vec<SheetFill>) {
        self.fills.set_meta_fills(fills);
    }

    /// Mark a fills hash as dirty (needs reload when visible)
    pub fn mark_fills_hash_dirty(&mut self, hash_x: i64, hash_y: i64) {
        self.fills.mark_hash_dirty(hash_x, hash_y);
    }

    /// Get fill hashes that need to be loaded (visible but not yet loaded)
    /// Returns flat array of [hash_x, hash_y, hash_x, hash_y, ...]
    pub fn get_needed_fill_hashes(&self) -> Vec<i32> {
        self.fills
            .get_needed_hashes(&self.viewport, &self.cells_sheet.sheet_offsets)
    }

    /// Get fill hashes that can be unloaded (outside viewport)
    /// Returns flat array of [hash_x, hash_y, hash_x, hash_y, ...]
    pub fn get_offscreen_fill_hashes(&self) -> Vec<i32> {
        self.fills
            .get_offscreen_hashes(&self.viewport, &self.cells_sheet.sheet_offsets)
    }

    /// Unload a fill hash to free memory
    pub fn unload_fill_hash(&mut self, hash_x: i64, hash_y: i64) {
        self.fills.unload_hash(hash_x, hash_y);
    }

    /// Check if a fill hash is loaded
    pub fn has_fill_hash(&self, hash_x: i64, hash_y: i64) -> bool {
        self.fills.has_hash(hash_x, hash_y)
    }

    /// Get number of loaded fill hashes
    pub fn get_fill_hash_count(&self) -> usize {
        self.fills.hash_count()
    }

    /// Get total fill count
    pub fn get_fill_count(&self) -> usize {
        self.fills.fill_count()
    }

    /// Mark fills as dirty when viewport changes
    pub fn set_fills_dirty(&mut self) {
        self.fills.mark_meta_dirty();
    }

    /// Add test fills for development/debugging
    /// This creates various fills to verify rendering works correctly
    pub fn add_test_fills(&mut self) {
        // Cell-based fills in hash (0, 0) - various colors
        let hash_0_0_fills = vec![
            // Red fill at A1 (1x1)
            RenderFill {
                x: 1,
                y: 1,
                w: 1,
                h: 1,
                color: "#ff0000".to_string(),
            },
            // Green fill at B2:C3 (2x2)
            RenderFill {
                x: 2,
                y: 2,
                w: 2,
                h: 2,
                color: "#00ff00".to_string(),
            },
            // Blue fill at E5:G7 (3x3)
            RenderFill {
                x: 5,
                y: 5,
                w: 3,
                h: 3,
                color: "#0000ff".to_string(),
            },
            // Semi-transparent yellow at A10:D12
            RenderFill {
                x: 1,
                y: 10,
                w: 4,
                h: 3,
                color: "rgba(255, 255, 0, 0.5)".to_string(),
            },
            // Orange fill at J1:K2
            RenderFill {
                x: 10,
                y: 1,
                w: 2,
                h: 2,
                color: "#ff8800".to_string(),
            },
        ];
        self.set_fills_for_hash(0, 0, hash_0_0_fills);

        // Cell-based fills in hash (1, 0) - more fills
        let hash_1_0_fills = vec![
            // Purple fill at P5:R8 (in hash 1,0)
            RenderFill {
                x: 16,
                y: 5,
                w: 3,
                h: 4,
                color: "#800080".to_string(),
            },
            // Cyan fill at T10:V15
            RenderFill {
                x: 20,
                y: 10,
                w: 3,
                h: 6,
                color: "#00ffff".to_string(),
            },
        ];
        self.set_fills_for_hash(1, 0, hash_1_0_fills);

        // Meta fills (infinite)
        let meta_fills = vec![
            // Light pink infinite column starting at column 30 (width 2)
            SheetFill {
                x: 30,
                y: 1,
                w: Some(2),
                h: None, // Infinite height
                color: "#ffcccc".to_string(),
            },
            // Light blue infinite row at row 25 (height 1)
            SheetFill {
                x: 1,
                y: 25,
                w: None, // Infinite width
                h: Some(1),
                color: "#ccccff".to_string(),
            },
        ];
        self.set_meta_fills(meta_fills);

        log::info!(
            "Added test fills: {} hashes, {} total fills",
            self.fills.hash_count(),
            self.fills.fill_count()
        );
    }

    /// Add test labels for development/debugging
    /// This creates various cell labels to verify text rendering works correctly
    pub fn add_test_labels(&mut self) {
        // Labels in hash (0, 0) - basic text with various styles
        let hash_0_0_labels = vec![
            // Simple text at A1
            RenderCell {
                x: 1,
                y: 1,
                value: "Hello World".to_string(),
                ..Default::default()
            },
            // Bold text at B2
            RenderCell {
                x: 2,
                y: 2,
                value: "Bold Text".to_string(),
                bold: Some(true),
                ..Default::default()
            },
            // Italic text at C3
            RenderCell {
                x: 3,
                y: 3,
                value: "Italic Text".to_string(),
                italic: Some(true),
                ..Default::default()
            },
            // Bold + Italic at D4
            RenderCell {
                x: 4,
                y: 4,
                value: "Bold & Italic".to_string(),
                bold: Some(true),
                italic: Some(true),
                ..Default::default()
            },
            // Colored text at E5
            RenderCell {
                x: 5,
                y: 5,
                value: "Red Text".to_string(),
                text_color: Some("#ff0000".to_string()),
                ..Default::default()
            },
            // Center aligned at F6
            RenderCell {
                x: 6,
                y: 6,
                value: "Centered".to_string(),
                align: Some(CellAlign::Center),
                ..Default::default()
            },
            // Right aligned at G7
            RenderCell {
                x: 7,
                y: 7,
                value: "Right".to_string(),
                align: Some(CellAlign::Right),
                ..Default::default()
            },
            // Larger font at H8
            RenderCell {
                x: 8,
                y: 8,
                value: "Large Font".to_string(),
                font_size: Some(20),
                ..Default::default()
            },
            // Number at I9
            RenderCell {
                x: 9,
                y: 9,
                value: "12345.67".to_string(),
                align: Some(CellAlign::Right),
                number: Some(RenderNumber {
                    decimals: Some(2),
                    commas: Some(true),
                    format: Some(NumericFormat {
                        kind: NumericFormatKind::Number,
                        symbol: None,
                    }),
                }),
                ..Default::default()
            },
            // Currency at J10
            RenderCell {
                x: 10,
                y: 10,
                value: "$1,234.56".to_string(),
                align: Some(CellAlign::Right),
                text_color: Some("#006600".to_string()),
                number: Some(RenderNumber {
                    decimals: Some(2),
                    commas: Some(true),
                    format: Some(NumericFormat {
                        kind: NumericFormatKind::Currency,
                        symbol: Some("$".to_string()),
                    }),
                }),
                ..Default::default()
            },
            // Wrapped text at A15 (wider cell would show wrap)
            RenderCell {
                x: 1,
                y: 15,
                value: "This is a long text that should wrap".to_string(),
                wrap: Some(CellWrap::Wrap),
                ..Default::default()
            },
            // Clipped text at B15
            RenderCell {
                x: 2,
                y: 15,
                value: "Clipped text overflow".to_string(),
                wrap: Some(CellWrap::Clip),
                ..Default::default()
            },
            // Top aligned at A20
            RenderCell {
                x: 1,
                y: 20,
                value: "Top".to_string(),
                vertical_align: Some(CellVerticalAlign::Top),
                ..Default::default()
            },
            // Middle aligned at B20
            RenderCell {
                x: 2,
                y: 20,
                value: "Middle".to_string(),
                vertical_align: Some(CellVerticalAlign::Middle),
                ..Default::default()
            },
            // Bottom aligned at C20
            RenderCell {
                x: 3,
                y: 20,
                value: "Bottom".to_string(),
                vertical_align: Some(CellVerticalAlign::Bottom),
                ..Default::default()
            },
            // Spill error at D20
            RenderCell {
                x: 4,
                y: 20,
                value: String::new(),
                special: Some(RenderCellSpecial::SpillError),
                text_color: Some("#cc0000".to_string()),
                ..Default::default()
            },
            // Run error at E20
            RenderCell {
                x: 5,
                y: 20,
                value: String::new(),
                special: Some(RenderCellSpecial::RunError),
                text_color: Some("#cc0000".to_string()),
                ..Default::default()
            },
        ];
        self.set_labels_for_hash(0, 0, hash_0_0_labels);

        // Labels in hash (1, 0) - more examples
        let hash_1_0_labels = vec![
            // Blue text
            RenderCell {
                x: 16,
                y: 5,
                value: "Blue Text".to_string(),
                text_color: Some("#0000ff".to_string()),
                bold: Some(true),
                ..Default::default()
            },
            // Purple italic
            RenderCell {
                x: 17,
                y: 6,
                value: "Purple Italic".to_string(),
                text_color: Some("#800080".to_string()),
                italic: Some(true),
                ..Default::default()
            },
            // Table name style
            RenderCell {
                x: 18,
                y: 1,
                value: "TableName".to_string(),
                bold: Some(true),
                table_name: Some(true),
                ..Default::default()
            },
            // Column header style
            RenderCell {
                x: 18,
                y: 2,
                value: "Column A".to_string(),
                bold: Some(true),
                column_header: Some(true),
                ..Default::default()
            },
            RenderCell {
                x: 19,
                y: 2,
                value: "Column B".to_string(),
                bold: Some(true),
                column_header: Some(true),
                ..Default::default()
            },
        ];
        self.set_labels_for_hash(1, 0, hash_1_0_labels);

        log::info!(
            "Added test labels: {} hashes, {} total labels",
            self.get_label_hash_count(),
            self.get_label_count()
        );
    }

    // =========================================================================
    // Deceleration (momentum scrolling)
    // =========================================================================

    /// Called when drag/pan starts - stops any active deceleration
    pub fn on_drag_start(&mut self) {
        self.viewport.on_drag_start();
    }

    /// Called during drag/pan - records position for velocity calculation
    /// time: Current time in milliseconds (from performance.now())
    pub fn on_drag_move(&mut self, time: f64) {
        self.viewport.on_drag_move(time);
    }

    /// Called when drag/pan ends - calculates velocity and starts deceleration
    /// time: Current time in milliseconds
    pub fn on_drag_end(&mut self, time: f64) {
        self.viewport.on_drag_end(time);
    }

    /// Called on wheel event - stops deceleration
    pub fn on_wheel_event(&mut self) {
        self.viewport.on_wheel();
    }

    /// Update deceleration and apply velocity to viewport
    /// Call this each frame with elapsed time in milliseconds
    /// Returns true if the viewport was moved
    pub fn update_decelerate(&mut self, elapsed: f32) -> bool {
        self.viewport.update_decelerate(elapsed)
    }

    /// Check if deceleration or snap-back is currently active
    pub fn is_decelerating(&self) -> bool {
        self.viewport.is_decelerating() || self.viewport.is_snapping_back()
    }

    /// Manually activate deceleration with a specific velocity
    /// vx, vy: velocity in px/ms
    pub fn activate_decelerate(&mut self, vx: f32, vy: f32) {
        self.viewport.activate_decelerate(vx, vy);
    }

    /// Reset/stop deceleration
    pub fn reset_decelerate(&mut self) {
        self.viewport.reset_decelerate();
    }

    // =========================================================================
    // Dirty Flags
    // =========================================================================

    /// Mark the viewport as dirty (forces a render next frame)
    pub fn set_viewport_dirty(&mut self) {
        self.viewport.dirty = true;
    }

    /// Mark grid lines as dirty
    pub fn set_grid_lines_dirty(&mut self) {
        self.content.grid_lines.dirty = true;
    }

    /// Mark cursor as dirty
    pub fn set_cursor_dirty(&mut self) {
        self.content.cursor.dirty = true;
    }

    /// Mark headings as dirty
    pub fn set_headings_dirty(&mut self) {
        self.headings.set_dirty();
    }

    /// Check if any component is dirty and needs rendering
    pub fn is_dirty(&self) -> bool {
        self.viewport.dirty
            || self.content.is_dirty()
            || self.headings.is_dirty()
            || self.any_visible_hash_dirty()
            || self.fills.is_dirty(&self.viewport)
    }

    // =========================================================================
    // Cursor
    // =========================================================================

    /// Set cursor position
    pub fn set_cursor(&mut self, col: i64, row: i64) {
        self.content.cursor.set_selected_cell(col, row);
    }

    /// Set cursor selection range
    pub fn set_cursor_selection(
        &mut self,
        start_col: i64,
        start_row: i64,
        end_col: i64,
        end_row: i64,
    ) {
        self.content
            .cursor
            .set_selection(start_col, start_row, end_col, end_row);
    }

    // =========================================================================
    // Fonts
    // =========================================================================

    /// Add a font from parsed BitmapFont
    pub fn add_font(&mut self, font: BitmapFont) {
        log::info!("Added font: {} with {} chars", font.font, font.chars.len());
        self.fonts.add(font);
    }

    /// Check if fonts are loaded
    pub fn has_fonts(&self) -> bool {
        !self.fonts.is_empty()
    }

    /// Get required texture UIDs from fonts
    pub fn get_required_texture_uids(&self) -> Vec<u32> {
        self.fonts.get_required_texture_uids()
    }

    // =========================================================================
    // Labels
    // =========================================================================

    /// Add a cell label (text content)
    /// col and row are 1-indexed cell coordinates
    pub fn add_label(&mut self, text: &str, col: i64, row: i64) {
        let mut label = CellLabel::new(text.to_string(), col, row);
        label.update_bounds(&self.cells_sheet.sheet_offsets);
        label.layout(&self.fonts);

        self.insert_label(col, row, label);
    }

    /// Add a styled cell label
    /// col and row are 1-indexed cell coordinates
    pub fn add_styled_label(
        &mut self,
        text: &str,
        col: i64,
        row: i64,
        font_size: f32,
        bold: bool,
        italic: bool,
        color_r: f32,
        color_g: f32,
        color_b: f32,
        align: u8,  // 0 = left, 1 = center, 2 = right
        valign: u8, // 0 = top, 1 = middle, 2 = bottom
    ) {
        let mut label = CellLabel::new(text.to_string(), col, row);
        label.update_bounds(&self.cells_sheet.sheet_offsets);
        label.font_size = font_size;
        label.bold = bold;
        label.italic = italic;
        label.color = [color_r, color_g, color_b, 1.0];
        label.align = match align {
            1 => TextAlign::Center,
            2 => TextAlign::Right,
            _ => TextAlign::Left,
        };
        label.vertical_align = match valign {
            0 => VerticalAlign::Top,
            1 => VerticalAlign::Middle,
            _ => VerticalAlign::Bottom,
        };
        label.layout(&self.fonts);

        self.insert_label(col, row, label);
    }

    /// Insert a label into the correct spatial hash
    fn insert_label(&mut self, col: i64, row: i64, label: CellLabel) {
        let (hash_x, hash_y) = get_hash_coords(col, row);
        let key = hash_key(hash_x, hash_y);

        let hash = self
            .hashes
            .entry(key)
            .or_insert_with(|| CellsTextHash::new(hash_x, hash_y, &self.cells_sheet.sheet_offsets));
        hash.add_label(col, row, label);
        self.label_count += 1;
    }

    /// Clear all labels
    pub fn clear_labels(&mut self) {
        self.hashes.clear();
        self.label_count = 0;
    }

    /// Get total label count
    pub fn get_label_count(&self) -> usize {
        self.label_count
    }

    // =========================================================================
    // Label Hash Management (bincode-based loading)
    // =========================================================================

    /// Set labels for a specific hash from bincode-decoded RenderCell data
    ///
    /// This is the main entry point for loading cell labels from core.
    /// It converts each RenderCell to an internal CellLabel, computes bounds,
    /// and performs layout.
    pub fn set_labels_for_hash(&mut self, hash_x: i64, hash_y: i64, cells: Vec<RenderCell>) {
        let key = hash_key(hash_x, hash_y);

        // Remove existing hash if present
        if let Some(old_hash) = self.hashes.remove(&key) {
            self.label_count = self.label_count.saturating_sub(old_hash.label_count());
        }

        // Create new hash
        let mut hash = CellsTextHash::new(hash_x, hash_y, &self.cells_sheet.sheet_offsets);

        // Convert each RenderCell to CellLabel and add to hash
        for cell in cells {
            // Skip empty values (no text to render)
            if cell.value.is_empty() && cell.special.is_none() {
                continue;
            }

            let mut label = CellLabel::from_render_cell(&cell);
            label.update_bounds(&self.cells_sheet.sheet_offsets);
            label.layout(&self.fonts);

            hash.add_label(cell.x, cell.y, label);
            self.label_count += 1;
        }

        // Only insert if hash has labels
        if !hash.is_empty() {
            self.hashes.insert(key, hash);
        }
    }

    /// Mark a labels hash as dirty (needs reload when visible)
    pub fn mark_labels_hash_dirty(&mut self, hash_x: i64, hash_y: i64) {
        let key = hash_key(hash_x, hash_y);
        if let Some(hash) = self.hashes.get_mut(&key) {
            hash.mark_dirty();
        } else {
            // Hash doesn't exist yet - it will be loaded when visible
            // We could track dirty hashes that aren't loaded yet, but
            // for now we just let the normal loading flow handle it
        }
    }

    /// Get label hashes that need to be loaded (visible but not yet loaded)
    /// Returns flat array of [hash_x, hash_y, hash_x, hash_y, ...]
    pub fn get_needed_label_hashes(&self) -> Vec<i32> {
        self.get_needed_hashes()
    }

    /// Get label hashes that can be unloaded (outside viewport)
    /// Returns flat array of [hash_x, hash_y, hash_x, hash_y, ...]
    pub fn get_offscreen_label_hashes(&self) -> Vec<i32> {
        self.get_offscreen_hashes()
    }

    /// Unload a label hash to free memory
    pub fn unload_label_hash(&mut self, hash_x: i64, hash_y: i64) {
        self.remove_hash(hash_x as i32, hash_y as i32);
    }

    /// Check if a label hash is loaded
    pub fn has_label_hash(&self, hash_x: i64, hash_y: i64) -> bool {
        self.has_hash(hash_x as i32, hash_y as i32)
    }

    /// Get number of loaded label hashes
    pub fn get_label_hash_count(&self) -> usize {
        self.get_hash_count()
    }

    // =========================================================================
    // Lazy Loading / Hash Management
    // =========================================================================

    /// Get visible hash bounds for the current viewport
    /// Returns: [min_hash_x, max_hash_x, min_hash_y, max_hash_y]
    pub fn get_visible_hash_bounds(&self) -> [i32; 4] {
        let bounds = self.viewport.visible_bounds();
        let hash_bounds = VisibleHashBounds::from_viewport(
            bounds.left,
            bounds.top,
            bounds.width,
            bounds.height,
            self.viewport.scale(),
            &self.cells_sheet.sheet_offsets,
        );

        [
            hash_bounds.min_hash_x as i32,
            hash_bounds.max_hash_x as i32,
            hash_bounds.min_hash_y as i32,
            hash_bounds.max_hash_y as i32,
        ]
    }

    /// Get list of hashes that need to be loaded (visible but not yet loaded)
    /// Returns: Vec of (hash_x, hash_y) pairs
    pub fn get_needed_hashes(&self) -> Vec<i32> {
        let bounds = self.viewport.visible_bounds();
        let hash_bounds = VisibleHashBounds::from_viewport(
            bounds.left,
            bounds.top,
            bounds.width,
            bounds.height,
            self.viewport.scale(),
            &self.cells_sheet.sheet_offsets,
        );

        let mut needed: Vec<i32> = Vec::new();

        for (hash_x, hash_y) in hash_bounds.iter() {
            let key = hash_key(hash_x, hash_y);
            if !self.hashes.contains_key(&key) {
                needed.push(hash_x as i32);
                needed.push(hash_y as i32);
            }
        }

        needed
    }

    /// Get list of loaded hashes that are outside the visible bounds
    /// These can be unloaded to save memory
    pub fn get_offscreen_hashes(&self) -> Vec<i32> {
        let bounds = self.viewport.visible_bounds();
        let hash_bounds = VisibleHashBounds::from_viewport(
            bounds.left,
            bounds.top,
            bounds.width,
            bounds.height,
            self.viewport.scale(),
            &self.cells_sheet.sheet_offsets,
        );

        let mut offscreen: Vec<i32> = Vec::new();

        for hash in self.hashes.values() {
            if !hash_bounds.contains(hash.hash_x, hash.hash_y) {
                offscreen.push(hash.hash_x as i32);
                offscreen.push(hash.hash_y as i32);
            }
        }

        offscreen
    }

    /// Remove a hash (for memory management when hash goes offscreen)
    pub fn remove_hash(&mut self, hash_x: i32, hash_y: i32) {
        let key = hash_key(hash_x as i64, hash_y as i64);
        if let Some(hash) = self.hashes.remove(&key) {
            self.label_count = self.label_count.saturating_sub(hash.label_count());
        }
    }

    /// Check if a hash is loaded
    pub fn has_hash(&self, hash_x: i32, hash_y: i32) -> bool {
        let key = hash_key(hash_x as i64, hash_y as i64);
        self.hashes.contains_key(&key)
    }

    /// Get number of loaded hashes
    pub fn get_hash_count(&self) -> usize {
        self.hashes.len()
    }

    /// Get total sprite cache memory usage in bytes
    pub fn get_sprite_memory_bytes(&self) -> usize {
        self.hashes
            .values()
            .map(|hash| hash.sprite_memory_bytes())
            .sum()
    }

    /// Get number of active sprite caches
    pub fn get_sprite_count(&self) -> usize {
        self.hashes
            .values()
            .filter(|hash| hash.has_sprite_cache())
            .count()
    }

    // =========================================================================
    // Frame Update Helpers
    // =========================================================================

    /// Update content based on viewport and sheet offsets
    pub fn update_content(&mut self) {
        self.content
            .update(&self.viewport, &self.cells_sheet.sheet_offsets);
        // Pass viewport.dirty so fills know to rebuild meta fills when viewport moves
        // (meta fills are clipped to viewport bounds)
        self.fills
            .update(&self.viewport, &self.cells_sheet.sheet_offsets, self.viewport.dirty);
    }

    /// Update headings and return (width, height) if shown
    pub fn update_headings(&mut self) -> (f32, f32) {
        if self.show_headings {
            let scale = self.viewport.effective_scale();
            let canvas_width = self.viewport.width();
            let canvas_height = self.viewport.height();

            self.headings.update(
                self.viewport.x(),
                self.viewport.y(),
                scale,
                canvas_width,
                canvas_height,
                &self.cells_sheet.sheet_offsets,
            );

            let size = self.headings.heading_size();
            (size.width, size.height)
        } else {
            (0.0, 0.0)
        }
    }

    /// Check if any visible hash is dirty
    pub fn any_visible_hash_dirty(&self) -> bool {
        if self.hashes.is_empty() {
            return false;
        }

        let bounds = self.viewport.visible_bounds();

        let padding = 100.0;
        let min_x = bounds.left - padding;
        let max_x = bounds.left + bounds.width + padding;
        let min_y = bounds.top - padding;
        let max_y = bounds.top + bounds.height + padding;

        for hash in self.hashes.values() {
            if hash.intersects_viewport(min_x, max_x, min_y, max_y) && hash.is_dirty() {
                return true;
            }
        }
        false
    }

    /// Mark everything as clean after rendering
    pub fn mark_clean(&mut self) {
        self.viewport.mark_clean();
        self.content.mark_clean();
        self.headings.mark_clean();
    }

    /// Create a screen-space orthographic projection matrix
    /// Maps (0, 0) at top-left to (width, height) at bottom-right
    pub fn create_screen_space_matrix(&self, width: f32, height: f32) -> [f32; 16] {
        let sx = 2.0 / width;
        let sy = -2.0 / height; // Negative to flip Y
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

    /// Get text rendering parameters for headings
    pub fn get_heading_text_params(&self) -> (f32, f32) {
        let heading_font_size = 10.0 * self.headings.dpr();
        self.fonts
            .get("OpenSans")
            .map(|f| (heading_font_size / f.size, f.distance_range))
            .unwrap_or((heading_font_size / 42.0, 4.0))
    }
}
