//! Cell fills (background colors) rendering

use crate::sheets::Sheet;
use crate::viewport::Viewport;

/// Get fill vertices for rendering
/// Note: This requires mutable access to rebuild dirty caches
pub fn get_fill_vertices(
    sheet: &mut Sheet,
    viewport: &Viewport,
) -> (Option<Vec<f32>>, Vec<Vec<f32>>) {
    let bounds = viewport.visible_bounds();
    let padding = 100.0;
    let min_x = bounds.left - padding;
    let max_x = bounds.right + padding;
    let min_y = bounds.top - padding;
    let max_y = bounds.bottom + padding;

    // Rebuild caches if needed (fills were marked dirty when set)
    let offsets = sheet.sheet_offsets.clone();
    sheet.fills.update(viewport, &offsets, true);

    // Meta fills (infinite backgrounds)
    let meta_vertices = sheet.fills.cached_meta_rects().vertices();
    let meta = if meta_vertices.is_empty() {
        None
    } else {
        Some(meta_vertices.to_vec())
    };

    // Hash fills (finite cell backgrounds)
    let mut hash_vertices = Vec::new();
    for hash in sheet.fills.fills_by_hash_values() {
        if !hash.intersects_viewport(min_x, max_x, min_y, max_y) {
            continue;
        }

        let vertices = hash.cached_rects().vertices();
        if !vertices.is_empty() {
            hash_vertices.push(vertices.to_vec());
        }
    }

    (meta, hash_vertices)
}
