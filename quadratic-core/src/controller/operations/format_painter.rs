use crate::Pos;
use crate::a1::A1Selection;
use crate::controller::GridController;
use crate::controller::operations::operation::Operation;
use crate::grid::formats::SheetFormatUpdates;
use crate::grid::sheet::borders::BordersUpdates;
use anyhow::Result;

impl GridController {
    /// Creates operations to apply format painter from source to target selection.
    /// The source formatting is tiled across the target selection if the target is larger.
    ///
    /// Performance: This iterates over source cells and tiles each one to target positions,
    /// rather than iterating over every target cell. This is O(source_area) lookups instead
    /// of O(target_area) lookups, which is much faster for large target selections with
    /// small source patterns.
    pub fn apply_format_painter_operations(
        &self,
        source_selection: &A1Selection,
        target_selection: &A1Selection,
    ) -> Result<Vec<Operation>> {
        let mut ops = vec![];

        // Validate both sheets exist
        let source_sheet = self
            .try_sheet(source_selection.sheet_id)
            .ok_or_else(|| anyhow::anyhow!("Source sheet not found"))?;
        if self.try_sheet(target_selection.sheet_id).is_none() {
            anyhow::bail!("Target sheet not found");
        }

        // Get the source rect (finite bounds)
        let source_rect = source_selection.largest_rect_finite(self.a1_context());
        let source_width = source_rect.width();
        let source_height = source_rect.height();

        if source_width == 0 || source_height == 0 {
            return Ok(ops);
        }

        // Get formats from source
        let source_formats =
            source_sheet
                .formats
                .to_clipboard(source_selection, source_sheet, self.a1_context())?;

        // Get borders from source
        let source_borders = source_sheet.borders.to_clipboard(source_selection);

        // Get the target rect
        let target_rect = target_selection.largest_rect_finite(self.a1_context());
        let target_width = target_rect.width();
        let target_height = target_rect.height();

        if target_width == 0 || target_height == 0 {
            return Ok(ops);
        }

        // Create tiled formats for the target
        let mut tiled_formats = SheetFormatUpdates::default();
        let mut tiled_borders = BordersUpdates::default();

        // Calculate number of tiles needed in each direction
        let tiles_x = target_width.div_ceil(source_width);
        let tiles_y = target_height.div_ceil(source_height);

        // Iterate over source cells and tile each to all matching target positions.
        // This is more efficient than iterating over every target cell because:
        // 1. We only do O(source_area) format lookups instead of O(target_area)
        // 2. Source cells without formatting are processed quickly (just one lookup)
        for sy in 0..source_height {
            for sx in 0..source_width {
                let source_x = source_rect.min.x + sx as i64;
                let source_y = source_rect.min.y + sy as i64;
                let source_pos = Pos {
                    x: source_x,
                    y: source_y,
                };

                // Get format once per source cell
                let format_update = source_formats.format_update(source_pos);
                let has_format = !format_update.is_default();

                // Check borders once per source cell
                let top_border = source_borders
                    .as_ref()
                    .and_then(|b| b.top.as_ref())
                    .and_then(|t| t.get(source_pos));
                let bottom_border = source_borders
                    .as_ref()
                    .and_then(|b| b.bottom.as_ref())
                    .and_then(|t| t.get(source_pos));
                let left_border = source_borders
                    .as_ref()
                    .and_then(|b| b.left.as_ref())
                    .and_then(|t| t.get(source_pos));
                let right_border = source_borders
                    .as_ref()
                    .and_then(|b| b.right.as_ref())
                    .and_then(|t| t.get(source_pos));

                let has_borders = top_border.is_some()
                    || bottom_border.is_some()
                    || left_border.is_some()
                    || right_border.is_some();

                // Skip source cells with no formatting or borders
                if !has_format && !has_borders {
                    continue;
                }

                // Tile this source cell to all matching target positions
                for tile_y in 0..tiles_y {
                    for tile_x in 0..tiles_x {
                        let target_x =
                            target_rect.min.x + sx as i64 + (tile_x * source_width) as i64;
                        let target_y =
                            target_rect.min.y + sy as i64 + (tile_y * source_height) as i64;

                        // Check if this tile position is within the target bounds
                        if target_x > target_rect.max.x || target_y > target_rect.max.y {
                            continue;
                        }

                        let target_pos = Pos {
                            x: target_x,
                            y: target_y,
                        };

                        // Apply format (clone needed since we apply to multiple targets)
                        if has_format {
                            tiled_formats.set_format_cell(target_pos, format_update.clone());
                        }

                        // Apply borders
                        if let Some(border) = top_border {
                            tiled_borders
                                .top
                                .get_or_insert_default()
                                .set(target_pos, Some(border));
                        }
                        if let Some(border) = bottom_border {
                            tiled_borders
                                .bottom
                                .get_or_insert_default()
                                .set(target_pos, Some(border));
                        }
                        if let Some(border) = left_border {
                            tiled_borders
                                .left
                                .get_or_insert_default()
                                .set(target_pos, Some(border));
                        }
                        if let Some(border) = right_border {
                            tiled_borders
                                .right
                                .get_or_insert_default()
                                .set(target_pos, Some(border));
                        }
                    }
                }
            }
        }

        // Add format operation if there are formats to apply
        if !tiled_formats.is_default() {
            ops.push(Operation::SetCellFormatsA1 {
                sheet_id: target_selection.sheet_id,
                formats: tiled_formats,
            });
        }

        // Add border operation if there are borders to apply
        if !tiled_borders.is_empty() {
            ops.push(Operation::SetBordersA1 {
                sheet_id: target_selection.sheet_id,
                borders: tiled_borders,
            });
        }

        Ok(ops)
    }
}

#[cfg(test)]
mod tests {
    use crate::Pos;
    use crate::a1::A1Selection;
    use crate::controller::GridController;
    use crate::grid::sheet::borders::{BorderSelection, BorderStyle};

    #[test]
    fn test_format_painter_basic() {
        let mut gc = GridController::test();
        let sheet_id = gc.sheet_ids()[0];

        // Set up source formatting at A1
        let sheet = gc.sheet_mut(sheet_id);
        sheet.formats.bold.set(Pos { x: 1, y: 1 }, Some(true));
        sheet
            .formats
            .fill_color
            .set(Pos { x: 1, y: 1 }, Some("red".to_string()));

        // Create selections
        let source_selection = A1Selection::test_a1("A1");
        let target_selection = A1Selection::test_a1("C3");

        // Apply format painter
        gc.apply_format_painter(&source_selection, &target_selection, None, false)
            .unwrap();

        // Verify target has the formatting
        let sheet = gc.sheet(sheet_id);
        assert_eq!(sheet.formats.bold.get(Pos { x: 3, y: 3 }), Some(true));
        assert_eq!(
            sheet.formats.fill_color.get(Pos { x: 3, y: 3 }),
            Some("red".to_string())
        );

        // Verify source still has formatting
        assert_eq!(sheet.formats.bold.get(Pos { x: 1, y: 1 }), Some(true));
    }

    #[test]
    fn test_format_painter_tiling() {
        let mut gc = GridController::test();
        let sheet_id = gc.sheet_ids()[0];

        // Set up 2x2 source formatting at A1:B2
        let sheet = gc.sheet_mut(sheet_id);
        sheet.formats.bold.set(Pos { x: 1, y: 1 }, Some(true));
        sheet.formats.italic.set(Pos { x: 2, y: 1 }, Some(true));
        sheet
            .formats
            .fill_color
            .set(Pos { x: 1, y: 2 }, Some("blue".to_string()));
        sheet
            .formats
            .fill_color
            .set(Pos { x: 2, y: 2 }, Some("green".to_string()));

        // Create selections - source is 2x2, target is 4x4
        let source_selection = A1Selection::test_a1("A1:B2");
        let target_selection = A1Selection::test_a1("D1:G4");

        // Apply format painter
        gc.apply_format_painter(&source_selection, &target_selection, None, false)
            .unwrap();

        // Verify tiling in target area
        let sheet = gc.sheet(sheet_id);

        // First tile (D1:E2)
        assert_eq!(sheet.formats.bold.get(Pos { x: 4, y: 1 }), Some(true));
        assert_eq!(sheet.formats.italic.get(Pos { x: 5, y: 1 }), Some(true));
        assert_eq!(
            sheet.formats.fill_color.get(Pos { x: 4, y: 2 }),
            Some("blue".to_string())
        );
        assert_eq!(
            sheet.formats.fill_color.get(Pos { x: 5, y: 2 }),
            Some("green".to_string())
        );

        // Second tile horizontally (F1:G2)
        assert_eq!(sheet.formats.bold.get(Pos { x: 6, y: 1 }), Some(true));
        assert_eq!(sheet.formats.italic.get(Pos { x: 7, y: 1 }), Some(true));
        assert_eq!(
            sheet.formats.fill_color.get(Pos { x: 6, y: 2 }),
            Some("blue".to_string())
        );
        assert_eq!(
            sheet.formats.fill_color.get(Pos { x: 7, y: 2 }),
            Some("green".to_string())
        );

        // Third tile vertically (D3:E4)
        assert_eq!(sheet.formats.bold.get(Pos { x: 4, y: 3 }), Some(true));
        assert_eq!(sheet.formats.italic.get(Pos { x: 5, y: 3 }), Some(true));
        assert_eq!(
            sheet.formats.fill_color.get(Pos { x: 4, y: 4 }),
            Some("blue".to_string())
        );
        assert_eq!(
            sheet.formats.fill_color.get(Pos { x: 5, y: 4 }),
            Some("green".to_string())
        );
    }

    #[test]
    fn test_format_painter_with_borders() {
        let mut gc = GridController::test();
        let sheet_id = gc.sheet_ids()[0];

        // Set up source border at A1
        gc.set_borders(
            A1Selection::test_a1("A1"),
            BorderSelection::All,
            Some(BorderStyle::default()),
            None,
            false,
        );

        // Create selections
        let source_selection = A1Selection::test_a1("A1");
        let target_selection = A1Selection::test_a1("C3");

        // Apply format painter
        gc.apply_format_painter(&source_selection, &target_selection, None, false)
            .unwrap();

        // Verify target has borders
        let sheet = gc.sheet(sheet_id);
        let target_pos = Pos { x: 3, y: 3 };
        assert!(sheet.borders.top.get(target_pos).is_some());
        assert!(sheet.borders.bottom.get(target_pos).is_some());
        assert!(sheet.borders.left.get(target_pos).is_some());
        assert!(sheet.borders.right.get(target_pos).is_some());
    }

    #[test]
    fn test_format_painter_undo() {
        let mut gc = GridController::test();
        let sheet_id = gc.sheet_ids()[0];

        // Set up source formatting at A1
        let sheet = gc.sheet_mut(sheet_id);
        sheet.formats.bold.set(Pos { x: 1, y: 1 }, Some(true));

        // Verify target has no formatting before
        assert_eq!(sheet.formats.bold.get(Pos { x: 3, y: 3 }), None);

        // Create selections
        let source_selection = A1Selection::test_a1("A1");
        let target_selection = A1Selection::test_a1("C3");

        // Apply format painter
        gc.apply_format_painter(&source_selection, &target_selection, None, false)
            .unwrap();

        // Verify target has the formatting
        let sheet = gc.sheet(sheet_id);
        assert_eq!(sheet.formats.bold.get(Pos { x: 3, y: 3 }), Some(true));

        // Undo
        gc.undo(1, None, false);

        // Verify target formatting is removed
        let sheet = gc.sheet(sheet_id);
        assert_eq!(sheet.formats.bold.get(Pos { x: 3, y: 3 }), None);

        // Verify source still has formatting
        assert_eq!(sheet.formats.bold.get(Pos { x: 1, y: 1 }), Some(true));
    }

    #[test]
    fn test_format_painter_empty_source() {
        let mut gc = GridController::test();

        // Create selections - source has no formatting
        let source_selection = A1Selection::test_a1("A1");
        let target_selection = A1Selection::test_a1("C3");

        // Apply format painter should succeed even with no source formatting
        let result = gc.apply_format_painter(&source_selection, &target_selection, None, false);
        assert!(result.is_ok());
    }

    #[test]
    fn test_format_painter_multiple_formats() {
        let mut gc = GridController::test();
        let sheet_id = gc.sheet_ids()[0];

        // Set up multiple formats at source
        let sheet = gc.sheet_mut(sheet_id);
        sheet.formats.bold.set(Pos { x: 1, y: 1 }, Some(true));
        sheet.formats.italic.set(Pos { x: 1, y: 1 }, Some(true));
        sheet
            .formats
            .text_color
            .set(Pos { x: 1, y: 1 }, Some("blue".to_string()));
        sheet
            .formats
            .fill_color
            .set(Pos { x: 1, y: 1 }, Some("yellow".to_string()));
        sheet.formats.font_size.set(Pos { x: 1, y: 1 }, Some(24));

        // Create selections
        let source_selection = A1Selection::test_a1("A1");
        let target_selection = A1Selection::test_a1("C3");

        // Apply format painter
        gc.apply_format_painter(&source_selection, &target_selection, None, false)
            .unwrap();

        // Verify all formats are applied to target
        let sheet = gc.sheet(sheet_id);
        let target_pos = Pos { x: 3, y: 3 };
        assert_eq!(sheet.formats.bold.get(target_pos), Some(true));
        assert_eq!(sheet.formats.italic.get(target_pos), Some(true));
        assert_eq!(
            sheet.formats.text_color.get(target_pos),
            Some("blue".to_string())
        );
        assert_eq!(
            sheet.formats.fill_color.get(target_pos),
            Some("yellow".to_string())
        );
        assert_eq!(sheet.formats.font_size.get(target_pos), Some(24));
    }
}
