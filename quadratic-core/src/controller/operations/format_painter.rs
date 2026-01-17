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
    pub fn apply_format_painter_operations(
        &self,
        source_selection: &A1Selection,
        target_selection: &A1Selection,
    ) -> Result<Vec<Operation>> {
        let mut ops = vec![];

        // Get the source sheet
        let source_sheet = self
            .try_sheet(source_selection.sheet_id)
            .ok_or_else(|| anyhow::anyhow!("Source sheet not found"))?;

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

        // Tile the formats across the target area
        for ty in 0..target_height {
            for tx in 0..target_width {
                // Calculate source position using modulo for tiling
                let sx = (tx % source_width) as i64 + source_rect.min.x;
                let sy = (ty % source_height) as i64 + source_rect.min.y;
                let source_pos = Pos { x: sx, y: sy };

                // Calculate target position
                let target_x = target_rect.min.x + tx as i64;
                let target_y = target_rect.min.y + ty as i64;
                let target_pos = Pos {
                    x: target_x,
                    y: target_y,
                };

                // Copy format from source to target position
                let format_update = source_formats.format_update(source_pos);
                if !format_update.is_default() {
                    tiled_formats.set_format_cell(target_pos, format_update);
                }

                // Copy borders from source to target position
                if let Some(ref borders) = source_borders {
                    if let Some(ref top) = borders.top
                        && let Some(border) = top.get(source_pos)
                    {
                        tiled_borders
                            .top
                            .get_or_insert_default()
                            .set(target_pos, Some(border));
                    }
                    if let Some(ref bottom) = borders.bottom
                        && let Some(border) = bottom.get(source_pos)
                    {
                        tiled_borders
                            .bottom
                            .get_or_insert_default()
                            .set(target_pos, Some(border));
                    }
                    if let Some(ref left) = borders.left
                        && let Some(border) = left.get(source_pos)
                    {
                        tiled_borders
                            .left
                            .get_or_insert_default()
                            .set(target_pos, Some(border));
                    }
                    if let Some(ref right) = borders.right
                        && let Some(border) = right.get(source_pos)
                    {
                        tiled_borders
                            .right
                            .get_or_insert_default()
                            .set(target_pos, Some(border));
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
