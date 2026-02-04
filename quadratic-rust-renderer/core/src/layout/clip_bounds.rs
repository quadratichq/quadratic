//! Clip bounds calculation for text overflow
//!
//! This module provides shared logic for calculating clip bounds when text
//! overflows cell boundaries and needs to be clipped by neighboring cells.
//!
//! Used by both the native renderer (for static screenshots) and the WASM
//! layout worker (for dynamic rendering).

use std::collections::HashMap;

use crate::sheets::text::CellLabel;

/// Calculate and apply clip bounds for a collection of labels.
///
/// This handles the case where text overflows its cell bounds and needs to be
/// clipped by neighboring content. The algorithm:
///
/// 1. For each label with overflow_right, find the nearest neighbor to the right
///    and clip at that neighbor's left edge
/// 2. For each label with overflow_left, find the nearest neighbor to the left
///    and clip at that neighbor's right edge
/// 3. Also clip neighbors that are being overlapped by our overflow
///
/// # Arguments
/// * `labels` - Mutable slice of CellLabels to process
///
/// # Example
/// ```ignore
/// let mut labels = vec![label1, label2, label3];
/// calculate_clip_bounds(&mut labels);
/// // labels now have clip_left/clip_right set based on neighbors
/// ```
pub fn calculate_clip_bounds(labels: &mut [CellLabel]) {
    if labels.is_empty() {
        return;
    }

    // Collect info about all labels (we need immutable access first)
    struct LabelInfo {
        index: usize,
        col: i64,
        row: i64,
        cell_left: f32,
        cell_right: f32,
        overflow_left: f32,
        overflow_right: f32,
    }

    let label_infos: Vec<LabelInfo> = labels
        .iter()
        .enumerate()
        .map(|(index, label)| LabelInfo {
            index,
            col: label.col(),
            row: label.row(),
            cell_left: label.cell_left(),
            cell_right: label.cell_right(),
            overflow_left: label.overflow_left(),
            overflow_right: label.overflow_right(),
        })
        .collect();

    // Build a map of (row, col) -> index for fast neighbor lookup
    let mut row_map: HashMap<i64, Vec<(i64, usize)>> = HashMap::new();

    for info in &label_infos {
        row_map
            .entry(info.row)
            .or_default()
            .push((info.col, info.index));
    }

    // Sort columns within each row for efficient neighbor search
    for cols in row_map.values_mut() {
        cols.sort_by_key(|(col, _)| *col);
    }

    // Calculate clip updates
    struct ClipUpdate {
        index: usize,
        clip_left: Option<f32>,
        clip_right: Option<f32>,
    }

    let mut updates: Vec<ClipUpdate> = Vec::new();

    for info in &label_infos {
        let mut clip_left: Option<f32> = None;
        let mut clip_right: Option<f32> = None;

        if let Some(row_cols) = row_map.get(&info.row) {
            // Find our position in the row
            let our_pos = row_cols
                .binary_search_by_key(&info.col, |(col, _)| *col)
                .ok();

            // Check neighbor to the LEFT
            if let Some(pos) = our_pos {
                if pos > 0 {
                    let (neighbor_col, neighbor_idx) = row_cols[pos - 1];
                    let neighbor = &label_infos[neighbor_idx];

                    // Skip if not actually adjacent (there might be empty cells between)
                    // For simplicity, we check any neighbor - not just immediate
                    if neighbor_col < info.col {
                        // If neighbor has right overflow extending into our cell
                        if neighbor.overflow_right > 0.0 {
                            let neighbor_text_right = neighbor.cell_right + neighbor.overflow_right;
                            if neighbor_text_right > info.cell_left {
                                // Clip the neighbor's right at our left edge
                                updates.push(ClipUpdate {
                                    index: neighbor_idx,
                                    clip_left: None,
                                    clip_right: Some(info.cell_left),
                                });
                            }
                        }

                        // If WE have left overflow extending into neighbor
                        if info.overflow_left > 0.0 {
                            let text_left = info.cell_left - info.overflow_left;
                            if text_left < neighbor.cell_right {
                                clip_left = Some(neighbor.cell_right);
                            }
                        }
                    }
                }
            }

            // Check neighbor to the RIGHT
            if let Some(pos) = our_pos {
                if pos + 1 < row_cols.len() {
                    let (neighbor_col, neighbor_idx) = row_cols[pos + 1];
                    let neighbor = &label_infos[neighbor_idx];

                    if neighbor_col > info.col {
                        // If neighbor has left overflow extending into our cell
                        if neighbor.overflow_left > 0.0 {
                            let neighbor_text_left = neighbor.cell_left - neighbor.overflow_left;
                            if neighbor_text_left < info.cell_right {
                                // Clip the neighbor's left at our right edge
                                updates.push(ClipUpdate {
                                    index: neighbor_idx,
                                    clip_left: Some(info.cell_right),
                                    clip_right: None,
                                });
                            }
                        }

                        // If WE have right overflow extending into neighbor
                        if info.overflow_right > 0.0 {
                            let text_right = info.cell_right + info.overflow_right;
                            if text_right > neighbor.cell_left {
                                clip_right = Some(neighbor.cell_left);
                            }
                        }
                    }
                }
            }
        }

        // Add our own update if we need clipping
        if clip_left.is_some() || clip_right.is_some() {
            updates.push(ClipUpdate {
                index: info.index,
                clip_left,
                clip_right,
            });
        }
    }

    // Apply updates
    for update in updates {
        let label = &mut labels[update.index];
        if let Some(cl) = update.clip_left {
            if label.clip_left() != Some(cl) {
                label.set_clip_left(cl);
            }
        }
        if let Some(cr) = update.clip_right {
            if label.clip_right() != Some(cr) {
                label.set_clip_right(cr);
            }
        }
    }
}

/// Information about a label's overflow state
#[derive(Debug, Clone)]
pub struct LabelOverflowInfo {
    /// Column index
    pub col: i64,
    /// Row index
    pub row: i64,
    /// Left edge of cell in world coordinates
    pub cell_left: f32,
    /// Right edge of cell in world coordinates
    pub cell_right: f32,
    /// How much text overflows to the left
    pub overflow_left: f32,
    /// How much text overflows to the right
    pub overflow_right: f32,
}

/// Clip update to apply to a label
#[derive(Debug, Clone)]
pub struct ClipBoundsUpdate {
    /// Column index
    pub col: i64,
    /// Row index
    pub row: i64,
    /// Clip boundary on the left (if any)
    pub clip_left: Option<f32>,
    /// Clip boundary on the right (if any)
    pub clip_right: Option<f32>,
}

/// Calculate clip updates for labels based on their overflow info.
///
/// This is a lower-level function that works with overflow info directly,
/// useful when you have a hash-based system where labels are stored
/// in different containers.
///
/// # Arguments
/// * `labels` - Slice of LabelOverflowInfo
/// * `find_content_left` - Function to find the nearest content cell to the left
/// * `find_content_right` - Function to find the nearest content cell to the right
/// * `get_neighbor_info` - Function to get overflow info for a neighbor cell
///
/// # Returns
/// Vector of ClipBoundsUpdate to apply
pub fn calculate_clip_updates<FL, FR, GN>(
    labels: &[LabelOverflowInfo],
    find_content_left: FL,
    find_content_right: FR,
    get_neighbor_info: GN,
) -> Vec<ClipBoundsUpdate>
where
    FL: Fn(i64, i64) -> Option<i64>,
    FR: Fn(i64, i64) -> Option<i64>,
    GN: Fn(i64, i64) -> Option<LabelOverflowInfo>,
{
    let mut updates: Vec<ClipBoundsUpdate> = Vec::new();

    for info in labels {
        let mut clip_left: Option<f32> = None;
        let mut clip_right: Option<f32> = None;

        // Check neighbor to the LEFT
        if let Some(neighbor_col) = find_content_left(info.col, info.row) {
            if let Some(neighbor) = get_neighbor_info(neighbor_col, info.row) {
                // If neighbor has right overflow extending into our cell
                if neighbor.overflow_right > 0.0 {
                    let neighbor_text_right = neighbor.cell_right + neighbor.overflow_right;
                    if neighbor_text_right > info.cell_left {
                        // Clip the neighbor's right at our left edge
                        updates.push(ClipBoundsUpdate {
                            col: neighbor_col,
                            row: info.row,
                            clip_left: None,
                            clip_right: Some(info.cell_left),
                        });
                    }
                }

                // If WE have left overflow extending into neighbor
                if info.overflow_left > 0.0 {
                    let text_left = info.cell_left - info.overflow_left;
                    if text_left < neighbor.cell_right {
                        clip_left = Some(neighbor.cell_right);
                    }
                }
            }
        }

        // Check neighbor to the RIGHT
        if let Some(neighbor_col) = find_content_right(info.col, info.row) {
            if let Some(neighbor) = get_neighbor_info(neighbor_col, info.row) {
                // If neighbor has left overflow extending into our cell
                if neighbor.overflow_left > 0.0 {
                    let neighbor_text_left = neighbor.cell_left - neighbor.overflow_left;
                    if neighbor_text_left < info.cell_right {
                        // Clip the neighbor's left at our right edge
                        updates.push(ClipBoundsUpdate {
                            col: neighbor_col,
                            row: info.row,
                            clip_left: Some(info.cell_right),
                            clip_right: None,
                        });
                    }
                }

                // If WE have right overflow extending into neighbor
                if info.overflow_right > 0.0 {
                    let text_right = info.cell_right + info.overflow_right;
                    if text_right > neighbor.cell_left {
                        clip_right = Some(neighbor.cell_left);
                    }
                }
            }
        }

        // Add our own update if we need clipping
        if clip_left.is_some() || clip_right.is_some() {
            updates.push(ClipBoundsUpdate {
                col: info.col,
                row: info.row,
                clip_left,
                clip_right,
            });
        }
    }

    updates
}

#[cfg(test)]
mod tests {
    use super::*;

    fn create_test_label(col: i64, row: i64, text: &str) -> CellLabel {
        CellLabel::new(text.to_string(), col, row)
    }

    #[test]
    fn test_calculate_clip_bounds_empty() {
        let mut labels: Vec<CellLabel> = Vec::new();
        calculate_clip_bounds(&mut labels);
        // Should not panic
    }

    #[test]
    fn test_calculate_clip_bounds_single_label() {
        let mut labels = vec![create_test_label(1, 1, "Hello")];
        calculate_clip_bounds(&mut labels);
        // Single label should have no clipping
        assert_eq!(labels[0].clip_left(), None);
        assert_eq!(labels[0].clip_right(), None);
    }

    #[test]
    fn test_label_overflow_info() {
        let info = LabelOverflowInfo {
            col: 1,
            row: 1,
            cell_left: 0.0,
            cell_right: 100.0,
            overflow_left: 0.0,
            overflow_right: 50.0,
        };

        assert_eq!(info.col, 1);
        assert_eq!(info.overflow_right, 50.0);
    }
}
