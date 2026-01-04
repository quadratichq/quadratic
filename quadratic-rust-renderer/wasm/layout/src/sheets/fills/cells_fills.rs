//! CellsFills - manages all fills for a sheet

use std::collections::HashMap;

use quadratic_core_shared::{RenderFill, SheetFill, SheetOffsets};
use quadratic_renderer_core::{hash_key, FillBuffer};

use super::CellsFillsHash;
use crate::utils::color::parse_color_string;
use crate::viewport::Viewport;

/// Manages all fills for a sheet
pub struct CellsFills {
    /// Hash-based fills
    hashes: HashMap<u64, CellsFillsHash>,

    /// Meta fills (infinite row/column/sheet fills)
    meta_fills: Vec<SheetFill>,

    /// Whether meta fills have been loaded
    meta_fills_loaded: bool,
}

impl CellsFills {
    pub fn new() -> Self {
        Self {
            hashes: HashMap::new(),
            meta_fills: Vec::new(),
            meta_fills_loaded: false,
        }
    }

    pub fn meta_fills_loaded(&self) -> bool {
        self.meta_fills_loaded
    }

    /// Set meta fills
    pub fn set_meta_fills(&mut self, fills: Vec<SheetFill>) {
        self.meta_fills = fills;
        self.meta_fills_loaded = true;
    }

    /// Set fills for a specific hash
    pub fn set_hash_fills(
        &mut self,
        hash_x: i64,
        hash_y: i64,
        fills: Vec<RenderFill>,
        offsets: &SheetOffsets,
    ) {
        let key = hash_key(hash_x, hash_y);

        if fills.is_empty() {
            // Remove empty hashes but mark as loaded
            self.hashes.remove(&key);
            // Insert empty hash to mark as loaded
            let hash = CellsFillsHash::new(hash_x, hash_y, offsets);
            self.hashes.insert(key, hash);
        } else {
            let mut hash = CellsFillsHash::new(hash_x, hash_y, offsets);
            hash.set_fills(fills);
            self.hashes.insert(key, hash);
        }
    }

    /// Mark a hash as dirty
    pub fn mark_hash_dirty(&mut self, hash_x: i64, hash_y: i64) {
        let key = hash_key(hash_x, hash_y);
        if let Some(hash) = self.hashes.get_mut(&key) {
            hash.mark_dirty();
        }
    }

    /// Unload a hash
    pub fn unload_hash(&mut self, hash_x: i64, hash_y: i64) {
        let key = hash_key(hash_x, hash_y);
        self.hashes.remove(&key);
    }

    /// Check if a hash is loaded
    pub fn has_hash(&self, hash_x: i64, hash_y: i64) -> bool {
        let key = hash_key(hash_x, hash_y);
        self.hashes.contains_key(&key)
    }

    pub fn hash_count(&self) -> usize {
        self.hashes.len()
    }

    pub fn fill_count(&self) -> usize {
        self.hashes.values().map(|h| h.fill_count()).sum()
    }

    /// Get needed hashes for current viewport
    pub fn get_needed_hashes(&self, viewport: &Viewport, offsets: &SheetOffsets) -> Vec<i32> {
        let hash_bounds = viewport.visible_hash_bounds(offsets);
        let mut needed = Vec::new();

        for (hash_x, hash_y) in hash_bounds.iter() {
            if !self.has_hash(hash_x, hash_y) {
                needed.push(hash_x as i32);
                needed.push(hash_y as i32);
            }
        }

        needed
    }

    /// Build meta fills buffer for current viewport
    pub fn build_meta_fills_buffer(
        &self,
        viewport: &Viewport,
        offsets: &SheetOffsets,
    ) -> Option<FillBuffer> {
        if self.meta_fills.is_empty() {
            return None;
        }

        let bounds = viewport.visible_bounds();
        let mut buffer = FillBuffer::new();

        for fill in &self.meta_fills {
            let color = parse_color_string(&fill.color);

            // SheetFill uses x, y, w, h format
            // w=None means full width, h=None means full height
            let x = fill.x as i64;
            let y = fill.y as i64;

            match (fill.w, fill.h) {
                (Some(w), Some(h)) => {
                    // Specific rectangle
                    let (px, _) = offsets.column_position_size(x);
                    let (py, _) = offsets.row_position_size(y);
                    let (px_end, pw_end) = offsets.column_position_size(x + w as i64 - 1);
                    let (py_end, ph_end) = offsets.row_position_size(y + h as i64 - 1);
                    buffer.add_rect(
                        px as f32,
                        py as f32,
                        (px_end + pw_end - px) as f32,
                        (py_end + ph_end - py) as f32,
                        color,
                    );
                }
                (Some(_w), None) => {
                    // Column fill (full height)
                    let (px, width) = offsets.column_position_size(x);
                    buffer.add_rect(
                        px as f32,
                        bounds.top.max(0.0),
                        width as f32,
                        bounds.height,
                        color,
                    );
                }
                (None, Some(_h)) => {
                    // Row fill (full width)
                    let (py, height) = offsets.row_position_size(y);
                    buffer.add_rect(
                        bounds.left.max(0.0),
                        py as f32,
                        bounds.width,
                        height as f32,
                        color,
                    );
                }
                (None, None) => {
                    // Full sheet fill
                    buffer.add_rect(
                        bounds.left.max(0.0),
                        bounds.top.max(0.0),
                        bounds.width,
                        bounds.height,
                        color,
                    );
                }
            }
        }

        if buffer.is_empty() {
            None
        } else {
            Some(buffer)
        }
    }

    /// Get mutable access to hashes for rebuilding
    pub fn hashes_mut(&mut self) -> &mut HashMap<u64, CellsFillsHash> {
        &mut self.hashes
    }

    /// Get immutable access to hashes
    pub fn hashes(&self) -> &HashMap<u64, CellsFillsHash> {
        &self.hashes
    }
}

impl Default for CellsFills {
    fn default() -> Self {
        Self::new()
    }
}
