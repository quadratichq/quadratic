//! Sheet - manages a single sheet's data
//!
//! Each sheet owns its own fills, loaded hash tracking, and table cache.
//!
//! Note: Cell labels, text layout, and overflow clipping are handled by the Layout Worker.
//! The renderer receives pre-computed HashRenderData via BatchCache.
//! This Sheet struct only tracks which hashes have been loaded.

use std::collections::HashSet;

use quadratic_core_shared::{GridBounds, SheetId, SheetOffsets};

use super::fills::CellsFills;
use super::text::hash_key;
use super::text::LabelMesh;
use crate::tables::TableCache;

/// Cached table render output to avoid regenerating vertices every frame
#[derive(Default)]
pub struct CachedTableRenderOutput {
    /// Table name background vertices
    pub name_bg_vertices: Vec<f32>,
    /// Column background vertices
    pub col_bg_vertices: Vec<f32>,
    /// Outline line vertices
    pub outline_vertices: Vec<f32>,
    /// Header line vertices
    pub header_line_vertices: Vec<f32>,
    /// Text meshes for table names and column headers
    pub text_meshes: Vec<LabelMesh>,
    /// Whether this cache is valid
    pub valid: bool,
    /// Viewport bounds when cache was generated (left, top, right, bottom)
    /// Used to detect when viewport expands to show potentially new tables
    pub viewport_bounds: (f32, f32, f32, f32),
}

/// Manages data for a single sheet
pub struct Sheet {
    /// Sheet ID
    pub sheet_id: SheetId,

    /// Sheet offsets for column widths and row heights
    pub sheet_offsets: SheetOffsets,

    /// Bounds of all data in the sheet (for limiting hash requests)
    pub bounds: GridBounds,

    /// Set of loaded hash keys (hash_x, hash_y encoded as u64)
    /// Used to track which hashes have been requested from the core worker
    pub loaded_hashes: HashSet<u64>,

    /// Cell fills (background colors)
    pub fills: CellsFills,

    /// Table cache for rendering table headers
    pub tables: TableCache,

    /// Cached table render output (vertices and meshes)
    pub cached_table_output: CachedTableRenderOutput,

    /// Total label count (cached for stats)
    pub label_count: usize,
}

impl Sheet {
    /// Create a new sheet with default offsets
    pub fn new(sheet_id: SheetId) -> Self {
        Self {
            sheet_id: sheet_id.clone(),
            sheet_offsets: SheetOffsets::default(),
            bounds: GridBounds::Empty,
            fills: CellsFills::new(sheet_id),
            loaded_hashes: HashSet::new(),
            tables: TableCache::new(),
            cached_table_output: CachedTableRenderOutput::default(),
            label_count: 0,
        }
    }

    /// Create a sheet from sheet info
    pub fn from_sheet_info(sheet_id: SheetId, offsets: SheetOffsets, bounds: GridBounds) -> Self {
        Self {
            sheet_id: sheet_id.clone(),
            sheet_offsets: offsets,
            bounds,
            fills: CellsFills::new(sheet_id),
            loaded_hashes: HashSet::new(),
            tables: TableCache::new(),
            cached_table_output: CachedTableRenderOutput::default(),
            label_count: 0,
        }
    }

    /// Update sheet offsets and bounds
    pub fn update_from_sheet_info(&mut self, offsets: SheetOffsets, bounds: GridBounds) {
        self.sheet_offsets = offsets;
        self.bounds = bounds;
        // Update table bounds when offsets change
        self.tables.update_bounds(&self.sheet_offsets);
    }

    /// Mark a hash as loaded
    pub fn mark_hash_loaded(&mut self, hash_x: i64, hash_y: i64) {
        let key = hash_key(hash_x, hash_y);
        self.loaded_hashes.insert(key);
    }

    /// Check if a hash is loaded
    pub fn has_hash(&self, hash_x: i64, hash_y: i64) -> bool {
        let key = hash_key(hash_x, hash_y);
        self.loaded_hashes.contains(&key)
    }

    /// Remove a hash from loaded set
    pub fn remove_hash(&mut self, hash_x: i64, hash_y: i64) {
        let key = hash_key(hash_x, hash_y);
        self.loaded_hashes.remove(&key);
    }

    /// Get number of loaded hashes
    pub fn hash_count(&self) -> usize {
        self.loaded_hashes.len()
    }

    /// Clear all data (for sheet switch)
    pub fn clear(&mut self) {
        self.loaded_hashes.clear();
        self.label_count = 0;
        self.fills = CellsFills::new(self.sheet_id.clone());
        self.tables.clear();
        self.cached_table_output = CachedTableRenderOutput::default();
    }

    /// Invalidate the cached table render output
    pub fn invalidate_table_cache(&mut self) {
        self.cached_table_output.valid = false;
    }
}
