//! CellsTextHash - spatial hash for efficient text rendering
//!
//! Groups cells into 15×30 regions for:
//! - Hash-level visibility culling (check hundreds, not millions)
//! - Incremental updates (only rebuild dirty hashes)
//! - Batched mesh caching per hash
//! - Lazy loading: only load hashes within viewport + padding

use std::collections::HashMap;

use crate::text::{BitmapFonts, CellLabel};

/// Hash dimensions (matches client: CellsTypes.ts)
pub const HASH_WIDTH: i64 = 15;  // columns per hash
pub const HASH_HEIGHT: i64 = 30; // rows per hash

/// Cell dimensions in pixels (default)
pub const DEFAULT_CELL_WIDTH: f32 = 100.0;
pub const DEFAULT_CELL_HEIGHT: f32 = 21.0;

/// Number of hashes to load beyond the visible viewport (for preloading)
pub const HASH_PADDING: i64 = 2;

/// Maximum texture pages we support
const MAX_TEXTURE_PAGES: usize = 8;

/// A spatial hash containing labels for a 15×30 cell region
pub struct CellsTextHash {
    /// Hash coordinates (not pixel coordinates)
    pub hash_x: i64,
    pub hash_y: i64,

    /// Labels indexed by (col, row) within this hash
    labels: HashMap<(i64, i64), CellLabel>,

    /// Whether this hash needs to rebuild its mesh cache
    dirty: bool,

    /// Cached batched vertex data per texture page
    cached_vertices: [Vec<f32>; MAX_TEXTURE_PAGES],
    cached_indices: [Vec<u16>; MAX_TEXTURE_PAGES],

    /// Bounds in world coordinates (for visibility culling)
    pub world_x: f32,
    pub world_y: f32,
    pub world_width: f32,
    pub world_height: f32,
}

impl CellsTextHash {
    /// Create a new hash for the given hash coordinates
    pub fn new(hash_x: i64, hash_y: i64) -> Self {
        // Calculate world bounds
        let world_x = (hash_x * HASH_WIDTH) as f32 * DEFAULT_CELL_WIDTH;
        let world_y = (hash_y * HASH_HEIGHT) as f32 * DEFAULT_CELL_HEIGHT;
        let world_width = HASH_WIDTH as f32 * DEFAULT_CELL_WIDTH;
        let world_height = HASH_HEIGHT as f32 * DEFAULT_CELL_HEIGHT;

        Self {
            hash_x,
            hash_y,
            labels: HashMap::new(),
            dirty: true,
            cached_vertices: std::array::from_fn(|_| Vec::new()),
            cached_indices: std::array::from_fn(|_| Vec::new()),
            world_x,
            world_y,
            world_width,
            world_height,
        }
    }

    /// Add or update a label at the given cell position
    pub fn add_label(&mut self, col: i64, row: i64, label: CellLabel) {
        self.labels.insert((col, row), label);
        self.dirty = true;
    }

    /// Remove a label at the given cell position
    pub fn remove_label(&mut self, col: i64, row: i64) -> Option<CellLabel> {
        let result = self.labels.remove(&(col, row));
        if result.is_some() {
            self.dirty = true;
        }
        result
    }

    /// Get a label at the given cell position
    pub fn get_label(&self, col: i64, row: i64) -> Option<&CellLabel> {
        self.labels.get(&(col, row))
    }

    /// Get a mutable label at the given cell position
    pub fn get_label_mut(&mut self, col: i64, row: i64) -> Option<&mut CellLabel> {
        self.labels.get_mut(&(col, row))
    }

    /// Check if this hash is empty
    pub fn is_empty(&self) -> bool {
        self.labels.is_empty()
    }

    /// Get the number of labels in this hash
    pub fn label_count(&self) -> usize {
        self.labels.len()
    }

    /// Mark this hash as dirty (needs rebuild)
    pub fn mark_dirty(&mut self) {
        self.dirty = true;
    }

    /// Check if this hash is dirty
    pub fn is_dirty(&self) -> bool {
        self.dirty
    }

    /// Check if this hash intersects the given viewport bounds
    pub fn intersects_viewport(&self, min_x: f32, max_x: f32, min_y: f32, max_y: f32) -> bool {
        let hash_right = self.world_x + self.world_width;
        let hash_bottom = self.world_y + self.world_height;

        !(hash_right < min_x || self.world_x > max_x || hash_bottom < min_y || self.world_y > max_y)
    }

    /// Rebuild cached mesh data if dirty
    pub fn rebuild_if_dirty(&mut self, fonts: &BitmapFonts) {
        if !self.dirty {
            return;
        }

        // Clear cached data
        for i in 0..MAX_TEXTURE_PAGES {
            self.cached_vertices[i].clear();
            self.cached_indices[i].clear();
        }

        // Track vertex offsets per texture page
        let mut vertex_offsets: [u16; MAX_TEXTURE_PAGES] = [0; MAX_TEXTURE_PAGES];

        // Collect meshes from all labels
        for label in self.labels.values_mut() {
            let meshes = label.get_meshes(fonts);

            for mesh in meshes {
                if mesh.is_empty() {
                    continue;
                }

                let tex_id = mesh.texture_uid as usize;
                if tex_id >= MAX_TEXTURE_PAGES {
                    continue;
                }

                let mesh_vertices = mesh.get_vertex_data();
                let mesh_indices = mesh.get_index_data();
                let offset = vertex_offsets[tex_id];

                // Add vertices to cache
                self.cached_vertices[tex_id].extend_from_slice(&mesh_vertices);

                // Add indices with offset applied
                for &i in mesh_indices {
                    self.cached_indices[tex_id].push(i + offset);
                }

                // Update offset (each vertex has 8 floats: x,y,u,v,r,g,b,a)
                vertex_offsets[tex_id] += (mesh_vertices.len() / 8) as u16;
            }
        }

        self.dirty = false;
    }

    /// Get cached vertices for a texture page
    pub fn get_cached_vertices(&self, texture_id: usize) -> &[f32] {
        if texture_id < MAX_TEXTURE_PAGES {
            &self.cached_vertices[texture_id]
        } else {
            &[]
        }
    }

    /// Get cached indices for a texture page
    pub fn get_cached_indices(&self, texture_id: usize) -> &[u16] {
        if texture_id < MAX_TEXTURE_PAGES {
            &self.cached_indices[texture_id]
        } else {
            &[]
        }
    }

    /// Check if there's cached data for a texture page
    pub fn has_cached_data(&self, texture_id: usize) -> bool {
        texture_id < MAX_TEXTURE_PAGES && !self.cached_vertices[texture_id].is_empty()
    }
}

/// Get hash coordinates for a cell position
pub fn get_hash_coords(col: i64, row: i64) -> (i64, i64) {
    (
        col.div_euclid(HASH_WIDTH),
        row.div_euclid(HASH_HEIGHT),
    )
}

/// Get hash key from hash coordinates
pub fn hash_key(hash_x: i64, hash_y: i64) -> u64 {
    // Combine hash coordinates into a single key
    // Using bit manipulation to support negative coordinates
    let x_bits = (hash_x as i32) as u32;
    let y_bits = (hash_y as i32) as u32;
    ((x_bits as u64) << 32) | (y_bits as u64)
}

/// Represents the range of visible hashes (inclusive bounds)
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct VisibleHashBounds {
    pub min_hash_x: i64,
    pub max_hash_x: i64,
    pub min_hash_y: i64,
    pub max_hash_y: i64,
}

impl VisibleHashBounds {
    /// Create bounds from viewport world coordinates
    /// Includes HASH_PADDING extra hashes on each side for preloading
    pub fn from_viewport(
        vp_x: f32,
        vp_y: f32,
        vp_width: f32,
        vp_height: f32,
    ) -> Self {
        // Convert world coordinates to cell coordinates
        let min_col = (vp_x / DEFAULT_CELL_WIDTH).floor() as i64;
        let max_col = ((vp_x + vp_width) / DEFAULT_CELL_WIDTH).ceil() as i64;
        let min_row = (vp_y / DEFAULT_CELL_HEIGHT).floor() as i64;
        let max_row = ((vp_y + vp_height) / DEFAULT_CELL_HEIGHT).ceil() as i64;

        // Convert to hash coordinates and add padding
        let (min_hash_x, min_hash_y) = get_hash_coords(min_col, min_row);
        let (max_hash_x, max_hash_y) = get_hash_coords(max_col, max_row);

        Self {
            min_hash_x: min_hash_x - HASH_PADDING,
            max_hash_x: max_hash_x + HASH_PADDING,
            min_hash_y: min_hash_y - HASH_PADDING,
            max_hash_y: max_hash_y + HASH_PADDING,
        }
    }

    /// Check if a hash coordinate is within bounds
    pub fn contains(&self, hash_x: i64, hash_y: i64) -> bool {
        hash_x >= self.min_hash_x
            && hash_x <= self.max_hash_x
            && hash_y >= self.min_hash_y
            && hash_y <= self.max_hash_y
    }

    /// Iterate over all hash coordinates in bounds
    pub fn iter(&self) -> impl Iterator<Item = (i64, i64)> + '_ {
        (self.min_hash_y..=self.max_hash_y)
            .flat_map(move |y| (self.min_hash_x..=self.max_hash_x).map(move |x| (x, y)))
    }

    /// Get the number of hashes in bounds
    pub fn count(&self) -> usize {
        let width = (self.max_hash_x - self.min_hash_x + 1).max(0) as usize;
        let height = (self.max_hash_y - self.min_hash_y + 1).max(0) as usize;
        width * height
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_get_hash_coords() {
        // Positive coordinates
        assert_eq!(get_hash_coords(0, 0), (0, 0));
        assert_eq!(get_hash_coords(14, 29), (0, 0));
        assert_eq!(get_hash_coords(15, 30), (1, 1));
        assert_eq!(get_hash_coords(30, 60), (2, 2));

        // Negative coordinates
        assert_eq!(get_hash_coords(-1, -1), (-1, -1));
        assert_eq!(get_hash_coords(-15, -30), (-1, -1));
        assert_eq!(get_hash_coords(-16, -31), (-2, -2));
    }

    #[test]
    fn test_intersects_viewport() {
        let hash = CellsTextHash::new(0, 0);

        // Hash at (0,0) covers world coords (0,0) to (1500, 630)
        assert!(hash.intersects_viewport(0.0, 100.0, 0.0, 100.0));
        assert!(hash.intersects_viewport(-100.0, 100.0, -100.0, 100.0));
        assert!(!hash.intersects_viewport(2000.0, 3000.0, 0.0, 100.0));
    }
}
