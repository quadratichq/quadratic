//! Cell fills (background colors) rendering
//!
//! Manages hash-based fill rendering for efficient culling and lazy loading.
//! Matches the client's CellsFills.ts architecture.
//!
//! ## Types of Fills
//!
//! - **Finite fills** (RenderFill): Cell-level backgrounds with specific bounds
//! - **Meta fills** (SheetFill): Infinite row/column/sheet backgrounds
//!
//! ## Architecture
//!
//! Fills are partitioned into 15×30 cell hashes (matching CellsTextHash).
//! Only hashes within the viewport + padding are loaded and rendered.

mod cells_fills_hash;

pub use cells_fills_hash::{
    CellsFillsHash, HASH_HEIGHT, HASH_WIDTH, fill_hash_key, get_fill_hash_coords,
};

use std::collections::{HashMap, HashSet};

use quadratic_core_shared::{RenderFill, SheetFill, SheetOffsets};

use crate::primitives::{Color, Rects};
use crate::viewport::Viewport;
use crate::RenderContext;

/// Base number of hashes to load beyond the visible viewport (for preloading)
const HASH_PADDING: i64 = 2;

/// Maximum hash padding to prevent excessive memory usage when very zoomed out
const MAX_HASH_PADDING: i64 = 10;

/// Grid background color (white)
const GRID_BACKGROUND: Color = [1.0, 1.0, 1.0, 1.0];

/// Manages all fills for a sheet
pub struct CellsFills {
    /// Sheet ID
    sheet_id: String,

    /// Hash-based finite fills
    fills_by_hash: HashMap<u64, CellsFillsHash>,

    /// Loaded hash tracking (for lazy loading)
    loaded_hashes: HashSet<u64>,

    /// Meta fills (infinite row/column/sheet fills)
    meta_fills: Vec<SheetFill>,

    /// Cached meta rectangles (rebuilt when viewport changes)
    cached_meta_rects: Rects,

    /// Whether meta fills have been loaded
    meta_fills_loaded: bool,

    /// Whether meta rects need rebuilding
    meta_dirty: bool,
}

impl CellsFills {
    /// Create a new empty fills manager
    pub fn new(sheet_id: String) -> Self {
        Self {
            sheet_id,
            fills_by_hash: HashMap::new(),
            loaded_hashes: HashSet::new(),
            meta_fills: Vec::new(),
            cached_meta_rects: Rects::new(),
            meta_fills_loaded: false,
            meta_dirty: false,
        }
    }

    /// Get the sheet ID
    pub fn sheet_id(&self) -> &str {
        &self.sheet_id
    }

    /// Check if meta fills have been loaded
    pub fn meta_fills_loaded(&self) -> bool {
        self.meta_fills_loaded
    }

    /// Set fills for a specific hash
    pub fn set_hash_fills(
        &mut self,
        hash_x: i64,
        hash_y: i64,
        fills: Vec<RenderFill>,
        offsets: &SheetOffsets,
    ) {
        let key = fill_hash_key(hash_x, hash_y);

        if fills.is_empty() {
            // Remove empty hashes
            self.fills_by_hash.remove(&key);
        } else {
            let hash = self
                .fills_by_hash
                .entry(key)
                .or_insert_with(|| CellsFillsHash::new(hash_x, hash_y, offsets));
            hash.set_fills(fills);
        }

        // Mark as loaded
        self.loaded_hashes.insert(key);
    }

    /// Set meta fills (infinite row/column/sheet fills)
    pub fn set_meta_fills(&mut self, fills: Vec<SheetFill>) {
        self.meta_fills = fills;
        self.meta_fills_loaded = true;
        self.meta_dirty = true;
    }

    /// Mark a hash as dirty (needs reload when visible)
    /// This is called when fills change outside the viewport.
    /// We only remove from loaded_hashes (so it gets re-requested) but keep
    /// the fills in fills_by_hash so they remain visible until the update arrives.
    /// This gives better UX - stale data is better than no data.
    pub fn mark_hash_dirty(&mut self, hash_x: i64, hash_y: i64) {
        let key = fill_hash_key(hash_x, hash_y);
        // Remove from loaded set so it will be re-requested when visible
        // But keep the cached fills so they remain visible until update arrives
        self.loaded_hashes.remove(&key);
    }

    /// Get hashes that need to be loaded (visible but not yet loaded)
    /// Returns flat array of [hash_x, hash_y, hash_x, hash_y, ...]
    pub fn get_needed_hashes(&self, viewport: &Viewport, offsets: &SheetOffsets) -> Vec<i32> {
        let bounds = self.get_visible_hash_bounds(viewport, offsets);
        let mut needed = Vec::new();

        for hash_y in bounds.min_hash_y..=bounds.max_hash_y {
            for hash_x in bounds.min_hash_x..=bounds.max_hash_x {
                let key = fill_hash_key(hash_x, hash_y);
                if !self.loaded_hashes.contains(&key) {
                    needed.push(hash_x as i32);
                    needed.push(hash_y as i32);
                }
            }
        }

        needed
    }

    /// Get hashes that are loaded but outside the visible bounds
    /// Returns flat array of [hash_x, hash_y, hash_x, hash_y, ...]
    pub fn get_offscreen_hashes(&self, viewport: &Viewport, offsets: &SheetOffsets) -> Vec<i32> {
        let bounds = self.get_visible_hash_bounds(viewport, offsets);
        let mut offscreen = Vec::new();

        for hash in self.fills_by_hash.values() {
            if !bounds.contains(hash.hash_x, hash.hash_y) {
                offscreen.push(hash.hash_x as i32);
                offscreen.push(hash.hash_y as i32);
            }
        }

        offscreen
    }

    /// Unload a hash to free memory
    pub fn unload_hash(&mut self, hash_x: i64, hash_y: i64) {
        let key = fill_hash_key(hash_x, hash_y);
        self.fills_by_hash.remove(&key);
        self.loaded_hashes.remove(&key);
    }

    /// Check if a hash is loaded
    pub fn has_hash(&self, hash_x: i64, hash_y: i64) -> bool {
        let key = fill_hash_key(hash_x, hash_y);
        self.loaded_hashes.contains(&key)
    }

    /// Get number of loaded hashes
    pub fn hash_count(&self) -> usize {
        self.fills_by_hash.len()
    }

    /// Get total fill count across all hashes
    pub fn fill_count(&self) -> usize {
        self.fills_by_hash.values().map(|h| h.fill_count()).sum()
    }

    /// Update and rebuild caches as needed
    /// viewport_dirty: true if the viewport has moved/zoomed since last frame
    pub fn update(&mut self, viewport: &Viewport, offsets: &SheetOffsets, viewport_dirty: bool) {
        // Rebuild any dirty hash caches
        for hash in self.fills_by_hash.values_mut() {
            hash.rebuild_if_dirty(offsets);
        }

        // Rebuild meta fills if dirty or viewport moved
        // Meta fills are clipped to viewport bounds, so they need recalculation on viewport change
        if self.meta_dirty || (viewport_dirty && !self.meta_fills.is_empty()) {
            self.rebuild_meta_rects(viewport, offsets);
            self.meta_dirty = false;
        }
    }

    /// Mark meta fills as needing rebuild (call when viewport changes)
    pub fn mark_meta_dirty(&mut self) {
        self.meta_dirty = true;
    }

    /// Render all fills (meta fills first, then hash fills)
    pub fn render(
        &mut self,
        ctx: &mut impl RenderContext,
        matrix: &[f32; 16],
        viewport: &Viewport,
        offsets: &SheetOffsets,
    ) {
        let bounds = viewport.visible_bounds();
        let padding = 100.0;
        let min_x = bounds.left - padding;
        let max_x = bounds.right + padding;
        let min_y = bounds.top - padding;
        let max_y = bounds.bottom + padding;

        // 1. Render meta fills (infinite backgrounds) - these go behind everything
        if !self.cached_meta_rects.is_empty() {
            self.cached_meta_rects.render(ctx, matrix);
        }

        // 2. Render hash fills (finite cell backgrounds)
        for hash in self.fills_by_hash.values_mut() {
            if !hash.intersects_viewport(min_x, max_x, min_y, max_y) {
                continue;
            }

            // Ensure cache is up to date
            hash.rebuild_if_dirty(offsets);
            hash.render(ctx, matrix);
        }
    }

    /// Check if any visible hash is dirty
    pub fn any_visible_hash_dirty(&self, viewport: &Viewport) -> bool {
        let bounds = viewport.visible_bounds();
        let padding = 100.0;
        let min_x = bounds.left - padding;
        let max_x = bounds.right + padding;
        let min_y = bounds.top - padding;
        let max_y = bounds.bottom + padding;

        for hash in self.fills_by_hash.values() {
            if hash.intersects_viewport(min_x, max_x, min_y, max_y) && hash.is_dirty() {
                return true;
            }
        }
        false
    }

    /// Check if fills need rendering (meta dirty or any visible hash dirty)
    pub fn is_dirty(&self, viewport: &Viewport) -> bool {
        self.meta_dirty || self.any_visible_hash_dirty(viewport)
    }

    /// Get the cached meta rects for external rendering (e.g., WebGPU)
    pub fn cached_meta_rects(&self) -> &Rects {
        &self.cached_meta_rects
    }

    /// Get an iterator over all fill hashes for external rendering (e.g., WebGPU)
    pub fn fills_by_hash_values(&self) -> impl Iterator<Item = &CellsFillsHash> {
        self.fills_by_hash.values()
    }

    /// Rebuild meta rectangles for the current viewport
    fn rebuild_meta_rects(&mut self, viewport: &Viewport, offsets: &SheetOffsets) {
        self.cached_meta_rects.clear();

        if self.meta_fills.is_empty() {
            return;
        }

        let bounds = viewport.visible_bounds();

        for fill in &self.meta_fills {
            let (offset_x, _) = offsets.column_position_size(fill.x as i64);
            let (offset_y, _) = offsets.row_position_size(fill.y as i64);

            // Skip if completely off-screen
            if offset_x > bounds.right as f64 || offset_y > bounds.bottom as f64 {
                continue;
            }

            let color = parse_color_string(&fill.color);

            // Infinite sheet (no w or h)
            if fill.w.is_none() && fill.h.is_none() {
                let x = (offset_x as f32).max(bounds.left);
                let y = (offset_y as f32).max(bounds.top);
                let width = bounds.width - (offset_x as f32 - bounds.left).max(0.0);
                let height = bounds.height - (offset_y as f32 - bounds.top).max(0.0);
                self.cached_meta_rects.add(x, y, width, height, color);
            }
            // Infinite column (has w, no h)
            else if fill.h.is_none() {
                if let Some(w) = fill.w {
                    let start_x = (offset_x as f32).max(bounds.left);
                    let start_y = (offset_y as f32).max(bounds.top);
                    let end_col = fill.x as i64 + w as i64;
                    let (end_pos, _) = offsets.column_position_size(end_col);
                    let mut end_x = end_pos as f32;
                    end_x = end_x.min(bounds.right);
                    let width = end_x - start_x;
                    let height = bounds.height - (start_y - bounds.top);
                    if width > 0.0 && height > 0.0 {
                        self.cached_meta_rects
                            .add(start_x, start_y, width, height, color);
                    }
                }
            }
            // Infinite row (has h, no w)
            else if fill.w.is_none() {
                if let Some(h) = fill.h {
                    let start_x = (offset_x as f32).max(bounds.left);
                    let start_y = (offset_y as f32).max(bounds.top);
                    let end_row = fill.y as i64 + h as i64;
                    let (end_pos, _) = offsets.row_position_size(end_row);
                    let mut end_y = end_pos as f32;
                    end_y = end_y.min(bounds.bottom);
                    let width = bounds.width - (start_x - bounds.left);
                    let height = end_y - start_y;
                    if width > 0.0 && height > 0.0 {
                        self.cached_meta_rects
                            .add(start_x, start_y, width, height, color);
                    }
                }
            }
        }
    }

    /// Calculate visible hash bounds with padding
    fn get_visible_hash_bounds(
        &self,
        viewport: &Viewport,
        offsets: &SheetOffsets,
    ) -> VisibleFillHashBounds {
        let bounds = viewport.visible_bounds();

        // Convert world coordinates to cell coordinates using offsets
        let (min_col, _) = offsets.column_from_x(bounds.left.max(0.0) as f64);
        let (max_col, _) = offsets.column_from_x(bounds.right.max(0.0) as f64);
        let (min_row, _) = offsets.row_from_y(bounds.top.max(0.0) as f64);
        let (max_row, _) = offsets.row_from_y(bounds.bottom.max(0.0) as f64);

        // Convert to hash coordinates
        let (min_hash_x, min_hash_y) = get_fill_hash_coords(min_col, min_row);
        let (max_hash_x, max_hash_y) = get_fill_hash_coords(max_col, max_row);

        // Calculate dynamic padding based on viewport scale
        let scale_clamped = viewport.scale().max(0.1);
        let dynamic_padding =
            ((HASH_PADDING as f32 / scale_clamped).ceil() as i64).min(MAX_HASH_PADDING);

        VisibleFillHashBounds {
            min_hash_x: min_hash_x - dynamic_padding,
            max_hash_x: max_hash_x + dynamic_padding,
            min_hash_y: min_hash_y - dynamic_padding,
            max_hash_y: max_hash_y + dynamic_padding,
        }
    }
}

/// Visible hash bounds for fills
#[derive(Debug, Clone, Copy)]
struct VisibleFillHashBounds {
    min_hash_x: i64,
    max_hash_x: i64,
    min_hash_y: i64,
    max_hash_y: i64,
}

impl VisibleFillHashBounds {
    fn contains(&self, hash_x: i64, hash_y: i64) -> bool {
        hash_x >= self.min_hash_x
            && hash_x <= self.max_hash_x
            && hash_y >= self.min_hash_y
            && hash_y <= self.max_hash_y
    }
}

/// Parse a color string to RGBA array
///
/// Supports formats:
/// - "blank" → grid background (white)
/// - "#RGB" → 3-digit hex
/// - "#RRGGBB" → 6-digit hex
/// - "#RRGGBBAA" → 8-digit hex with alpha
/// - "rgb(r,g,b)" → CSS rgb()
/// - "rgba(r,g,b,a)" → CSS rgba()
pub fn parse_color_string(color: &str) -> Color {
    let color = color.trim();

    // Handle "blank" as grid background
    if color == "blank" {
        return GRID_BACKGROUND;
    }

    // Handle hex colors
    if let Some(hex) = color.strip_prefix('#') {
        return parse_hex_color(hex);
    }

    // Handle rgb()/rgba()
    if let Some(rgb) = color.strip_prefix("rgb(").and_then(|s| s.strip_suffix(')')) {
        return parse_rgb_color(rgb, false);
    }
    if let Some(rgba) = color.strip_prefix("rgba(").and_then(|s| s.strip_suffix(')')) {
        return parse_rgb_color(rgba, true);
    }

    // Default to black if parsing fails
    [0.0, 0.0, 0.0, 1.0]
}

/// Parse hex color (3, 6, or 8 digits)
fn parse_hex_color(hex: &str) -> Color {
    let chars: Vec<char> = hex.chars().collect();

    match chars.len() {
        // #RGB
        3 => {
            let r = parse_hex_digit(chars[0]) as f32 / 15.0;
            let g = parse_hex_digit(chars[1]) as f32 / 15.0;
            let b = parse_hex_digit(chars[2]) as f32 / 15.0;
            [r, g, b, 1.0]
        }
        // #RRGGBB
        6 => {
            let r = parse_hex_pair(&chars[0..2]) as f32 / 255.0;
            let g = parse_hex_pair(&chars[2..4]) as f32 / 255.0;
            let b = parse_hex_pair(&chars[4..6]) as f32 / 255.0;
            [r, g, b, 1.0]
        }
        // #RRGGBBAA
        8 => {
            let r = parse_hex_pair(&chars[0..2]) as f32 / 255.0;
            let g = parse_hex_pair(&chars[2..4]) as f32 / 255.0;
            let b = parse_hex_pair(&chars[4..6]) as f32 / 255.0;
            let a = parse_hex_pair(&chars[6..8]) as f32 / 255.0;
            [r, g, b, a]
        }
        _ => [0.0, 0.0, 0.0, 1.0],
    }
}

/// Parse a single hex digit
fn parse_hex_digit(c: char) -> u8 {
    match c {
        '0'..='9' => c as u8 - b'0',
        'a'..='f' => c as u8 - b'a' + 10,
        'A'..='F' => c as u8 - b'A' + 10,
        _ => 0,
    }
}

/// Parse a hex pair (two digits)
fn parse_hex_pair(chars: &[char]) -> u8 {
    parse_hex_digit(chars[0]) * 16 + parse_hex_digit(chars[1])
}

/// Parse rgb() or rgba() color values
fn parse_rgb_color(values: &str, has_alpha: bool) -> Color {
    let parts: Vec<&str> = values.split(',').map(|s| s.trim()).collect();

    let r = parts
        .first()
        .and_then(|s| s.parse::<f32>().ok())
        .unwrap_or(0.0)
        / 255.0;
    let g = parts
        .get(1)
        .and_then(|s| s.parse::<f32>().ok())
        .unwrap_or(0.0)
        / 255.0;
    let b = parts
        .get(2)
        .and_then(|s| s.parse::<f32>().ok())
        .unwrap_or(0.0)
        / 255.0;
    let a = if has_alpha {
        parts
            .get(3)
            .and_then(|s| s.parse::<f32>().ok())
            .unwrap_or(1.0)
    } else {
        1.0
    };

    [r.clamp(0.0, 1.0), g.clamp(0.0, 1.0), b.clamp(0.0, 1.0), a.clamp(0.0, 1.0)]
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_parse_color_blank() {
        assert_eq!(parse_color_string("blank"), GRID_BACKGROUND);
    }

    #[test]
    fn test_parse_color_hex() {
        // 3-digit hex
        let color = parse_color_string("#f00");
        assert!((color[0] - 1.0).abs() < 0.01);
        assert!((color[1] - 0.0).abs() < 0.01);
        assert!((color[2] - 0.0).abs() < 0.01);

        // 6-digit hex
        let color = parse_color_string("#ff0000");
        assert!((color[0] - 1.0).abs() < 0.01);
        assert!((color[1] - 0.0).abs() < 0.01);
        assert!((color[2] - 0.0).abs() < 0.01);

        // 8-digit hex with alpha
        let color = parse_color_string("#ff000080");
        assert!((color[0] - 1.0).abs() < 0.01);
        assert!((color[3] - 0.5).abs() < 0.01);
    }

    #[test]
    fn test_parse_color_rgb() {
        let color = parse_color_string("rgb(255, 0, 0)");
        assert!((color[0] - 1.0).abs() < 0.01);
        assert!((color[1] - 0.0).abs() < 0.01);
        assert!((color[2] - 0.0).abs() < 0.01);
        assert!((color[3] - 1.0).abs() < 0.01);
    }

    #[test]
    fn test_parse_color_rgba() {
        let color = parse_color_string("rgba(255, 0, 0, 0.5)");
        assert!((color[0] - 1.0).abs() < 0.01);
        assert!((color[3] - 0.5).abs() < 0.01);
    }
}
