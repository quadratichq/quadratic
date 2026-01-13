use crate::{
    CellValue,
    cell_values::CellValues,
    clear_option::ClearOption,
    controller::operations::operation::Operation,
    grid::formats::{SheetFormatUpdates, SheetFormatUpdatesType},
};

use super::*;

impl Sheet {
    fn format_transaction_changes<T: std::fmt::Debug + Clone + PartialEq>(
        &self,
        format: SheetFormatUpdatesType<T>,
        needs_resize: bool,
        dirty_hashes: &mut HashSet<Pos>,
        rows_to_resize: &mut HashSet<i64>,
    ) {
        let sheet_bounds =
            |ignore_formatting: bool| -> Option<Rect> { self.bounds(ignore_formatting).into() };
        let columns_bounds = |start: i64, end: i64, ignore_formatting: bool| {
            self.columns_bounds(start, end, ignore_formatting)
        };
        let rows_bounds = |start: i64, end: i64, ignore_formatting: bool| {
            self.rows_bounds(start, end, ignore_formatting)
        };
        if let Some(format) = format {
            format
                .to_rects_with_grid_bounds(&sheet_bounds, &columns_bounds, &rows_bounds, true)
                .for_each(|(x1, y1, x2, y2, _)| {
                    let rect = Rect::new(x1, y1, x2, y2);
                    dirty_hashes.extend(rect.to_hashes());
                    if needs_resize {
                        // Get all rows with content in the rect that need resizing
                        let rows_with_content: Vec<i64> = self
                            .columns
                            .get_nondefault_rects_in_rect(rect)
                            .flat_map(|(rect, _)| rect.y_range())
                            .chain(
                                self.data_tables
                                    .get_nondefault_rects_in_rect(rect)
                                    .flat_map(|rect| rect.y_range()),
                            )
                            .collect();
                        rows_to_resize.extend(rows_with_content);
                    }
                });
        }
    }

    fn wrap_transaction_changes(
        &self,
        wrap: SheetFormatUpdatesType<CellWrap>,
        dirty_hashes: &mut HashSet<Pos>,
        rows_to_resize: &mut HashSet<i64>,
    ) {
        let sheet_bounds =
            |ignore_formatting: bool| -> Option<Rect> { self.bounds(ignore_formatting).into() };
        let columns_bounds = |start: i64, end: i64, ignore_formatting: bool| {
            self.columns_bounds(start, end, ignore_formatting)
        };
        let rows_bounds = |start: i64, end: i64, ignore_formatting: bool| {
            self.rows_bounds(start, end, ignore_formatting)
        };
        if let Some(wrap) = wrap {
            wrap.to_rects_with_grid_bounds(sheet_bounds, columns_bounds, rows_bounds, true)
                .for_each(|(x1, y1, x2, y2, value)| {
                    let rect = Rect::new(x1, y1, x2, y2);
                    dirty_hashes.extend(rect.to_hashes());

                    // check if new formats is wrap
                    if value == ClearOption::Some(CellWrap::Wrap) {
                        for y in y1..=y2 {
                            if self.row_bounds(y, true).is_some() {
                                rows_to_resize.insert(y);
                            }
                        }
                    }
                });
        }
    }

    /// Returns the dirty hashes, rows changed, fill bounds, and whether meta fills changed
    fn formats_transaction_changes(
        &self,
        formats: &SheetFormatUpdates,
        reverse_formats: &SheetFormatUpdates,
    ) -> (HashSet<Pos>, HashSet<i64>, Option<Rect>, bool) {
        let mut dirty_hashes = HashSet::new();
        let mut rows_to_resize = HashSet::new();

        self.format_transaction_changes(
            formats.align.to_owned(),
            false,
            &mut dirty_hashes,
            &mut rows_to_resize,
        );
        self.format_transaction_changes(
            formats.vertical_align.to_owned(),
            false,
            &mut dirty_hashes,
            &mut rows_to_resize,
        );
        self.format_transaction_changes(
            formats.numeric_format.to_owned(),
            true,
            &mut dirty_hashes,
            &mut rows_to_resize,
        );
        self.format_transaction_changes(
            formats.numeric_decimals.to_owned(),
            true,
            &mut dirty_hashes,
            &mut rows_to_resize,
        );
        self.format_transaction_changes(
            formats.numeric_commas.to_owned(),
            true,
            &mut dirty_hashes,
            &mut rows_to_resize,
        );
        self.format_transaction_changes(
            formats.bold.to_owned(),
            true,
            &mut dirty_hashes,
            &mut rows_to_resize,
        );
        self.format_transaction_changes(
            formats.italic.to_owned(),
            true,
            &mut dirty_hashes,
            &mut rows_to_resize,
        );
        self.format_transaction_changes(
            formats.text_color.to_owned(),
            false,
            &mut dirty_hashes,
            &mut rows_to_resize,
        );
        self.format_transaction_changes(
            formats.date_time.to_owned(),
            true,
            &mut dirty_hashes,
            &mut rows_to_resize,
        );
        self.format_transaction_changes(
            formats.underline.to_owned(),
            true,
            &mut dirty_hashes,
            &mut rows_to_resize,
        );
        self.format_transaction_changes(
            formats.strike_through.to_owned(),
            false,
            &mut dirty_hashes,
            &mut rows_to_resize,
        );
        self.format_transaction_changes(
            formats.font_size.to_owned(),
            true,
            &mut dirty_hashes,
            &mut rows_to_resize,
        );

        // for wrap, we need to check if the new formats is wrap or old is wrap
        // no need to resize rows if wrap is not present in both new and old formats
        self.wrap_transaction_changes(
            formats.wrap.to_owned(),
            &mut dirty_hashes,
            &mut rows_to_resize,
        );
        self.wrap_transaction_changes(
            reverse_formats.wrap.to_owned(),
            &mut dirty_hashes,
            &mut rows_to_resize,
        );

        // Get finite bounds from new fills
        let new_fill_bounds = formats
            .fill_color
            .as_ref()
            .and_then(|fc| fc.finite_bounds());

        // Get finite bounds from old fills that were replaced (from reverse_formats)
        // This ensures finite fill hashes are marked dirty when meta fills overwrite them
        let old_fill_bounds = reverse_formats
            .fill_color
            .as_ref()
            .and_then(|fc| fc.finite_bounds());

        // Combine both bounds - we need to update both old and new fill locations
        let fill_bounds = match (new_fill_bounds, old_fill_bounds) {
            (Some(new_bounds), Some(old_bounds)) => Some(new_bounds.union(&old_bounds)),
            (Some(bounds), None) | (None, Some(bounds)) => Some(bounds),
            (None, None) => None,
        };

        // Check if any fill has infinite bounds (meta fills: row/column/sheet fills)
        let has_meta_fills = formats
            .fill_color
            .as_ref()
            .map(|fc| {
                fc.to_rects()
                    .any(|(_, _, x2, y2, _)| x2.is_none() || y2.is_none())
            })
            .unwrap_or(false);

        (dirty_hashes, rows_to_resize, fill_bounds, has_meta_fills)
    }

    /// Sets formats using SheetFormatUpdates.
    ///
    /// Returns (reverse_operations, dirty_hashes, rows_to_resize, fill_bounds, has_meta_fills)
    pub fn set_formats_a1(
        &mut self,
        formats: &SheetFormatUpdates,
    ) -> (
        Vec<Operation>,
        HashSet<Pos>,
        HashSet<i64>,
        Option<Rect>,
        bool,
    ) {
        let reverse_formats = self.formats.apply_updates(formats);

        let (mut dirty_hashes, rows_to_resize, fill_bounds, has_meta_fills) =
            self.formats_transaction_changes(formats, &reverse_formats);

        // Clear related inline formatting from RichText cells
        let (richtext_ops, richtext_modified_positions) =
            self.clear_richtext_formatting_for_formats(formats);

        // Add modified RichText positions to dirty hashes
        for pos in richtext_modified_positions {
            let mut hash_pos = pos;
            hash_pos.to_quadrant();
            dirty_hashes.insert(hash_pos);
        }

        // Order matters: RichText restore ops go first so that after reversing
        // (in to_undo_transaction), they execute AFTER the format restore.
        // This prevents the format restore from clearing the just-restored RichText formatting.
        let mut reverse_ops = richtext_ops;
        reverse_ops.push(Operation::SetCellFormatsA1 {
            sheet_id: self.id,
            formats: reverse_formats,
        });

        (
            reverse_ops,
            dirty_hashes,
            rows_to_resize,
            fill_bounds,
            has_meta_fills,
        )
    }

    /// Checks if the format update is a "clear all formatting" operation.
    /// This is detected when all text formatting fields are set to Some(None).
    fn is_clear_all_formatting(formats: &SheetFormatUpdates) -> bool {
        // Get the format update for any position to check if it's a clear operation
        if let Some(rect) = formats.to_bounding_rect() {
            let update = formats.format_update(rect.min);
            // Check if it's clearing formatting (all text format fields set to Some(None))
            update.bold == Some(None)
                && update.italic == Some(None)
                && update.underline == Some(None)
                && update.strike_through == Some(None)
                && update.text_color == Some(None)
        } else {
            false
        }
    }

    /// Collects RichText cell positions affected by format updates for specific format types.
    /// Only returns positions that actually contain RichText cells, avoiding large intermediate
    /// allocations when formatting is applied to large ranges.
    fn collect_affected_richtext_positions<T: std::fmt::Debug + Clone + PartialEq>(
        &self,
        format: &SheetFormatUpdatesType<T>,
        positions: &mut HashSet<Pos>,
    ) {
        let sheet_bounds =
            |ignore_formatting: bool| -> Option<Rect> { self.bounds(ignore_formatting).into() };
        let columns_bounds = |start: i64, end: i64, ignore_formatting: bool| {
            self.columns_bounds(start, end, ignore_formatting)
        };
        let rows_bounds = |start: i64, end: i64, ignore_formatting: bool| {
            self.rows_bounds(start, end, ignore_formatting)
        };

        if let Some(format) = format {
            for (x1, y1, x2, y2, _) in
                format.to_rects_with_grid_bounds(&sheet_bounds, &columns_bounds, &rows_bounds, true)
            {
                for x in x1..=x2 {
                    for y in y1..=y2 {
                        let pos = Pos { x, y };
                        // Only collect positions with RichText cells
                        if let Some(cell_value) = self.cell_value(pos)
                            && matches!(cell_value, CellValue::RichText(_))
                        {
                            positions.insert(pos);
                        }
                    }
                }
            }
        }
    }

    /// Clears inline formatting from RichText cells when cell-level formatting is applied.
    /// Returns (reverse_operations, modified_positions) where:
    /// - reverse_operations: Operations to restore the original RichText values
    /// - modified_positions: Positions of cells that were modified (for dirty hashes)
    ///
    /// This handles the case where applying cell-level formatting (e.g., bold) should
    /// clear the corresponding inline formatting from RichText spans.
    fn clear_richtext_formatting_for_formats(
        &mut self,
        formats: &SheetFormatUpdates,
    ) -> (Vec<Operation>, Vec<Pos>) {
        let is_clear_all = Self::is_clear_all_formatting(formats);
        let has_bold = formats.bold.is_some();
        let has_italic = formats.italic.is_some();
        let has_strike_through = formats.strike_through.is_some();
        let has_text_color = formats.text_color.is_some();
        let has_underline = formats.underline.is_some();

        // If no relevant formatting is being applied, return early
        if !is_clear_all
            && !has_bold
            && !has_italic
            && !has_strike_through
            && !has_text_color
            && !has_underline
        {
            return (vec![], vec![]);
        }

        // Collect all positions that might be affected
        let mut affected_positions: HashSet<Pos> = HashSet::new();

        if is_clear_all {
            // For clear all, we need RichText positions from any format type
            // Use bold as a representative since clear formatting sets all
            self.collect_affected_richtext_positions(&formats.bold, &mut affected_positions);
        } else {
            // Collect RichText positions for each format type being changed
            if has_bold {
                self.collect_affected_richtext_positions(&formats.bold, &mut affected_positions);
            }
            if has_italic {
                self.collect_affected_richtext_positions(&formats.italic, &mut affected_positions);
            }
            if has_strike_through {
                self.collect_affected_richtext_positions(
                    &formats.strike_through,
                    &mut affected_positions,
                );
            }
            if has_text_color {
                self.collect_affected_richtext_positions(
                    &formats.text_color,
                    &mut affected_positions,
                );
            }
            if has_underline {
                self.collect_affected_richtext_positions(
                    &formats.underline,
                    &mut affected_positions,
                );
            }
        }

        // Process each RichText cell position (already filtered by collect_affected_richtext_positions)
        let mut reverse_ops = Vec::new();
        let mut modified_positions = Vec::new();

        for pos in affected_positions {
            // Get the RichText cell value (we know it exists from the collection step)
            let Some(cell_value) = self.cell_value(pos) else {
                continue;
            };
            let CellValue::RichText(_) = &cell_value else {
                continue;
            };

            // Clone the original value for the reverse operation
            let old_value = cell_value.clone();
            let mut new_value = cell_value;

            // Clear the appropriate formatting based on what's being changed
            let mut changed = false;

            if is_clear_all {
                changed = new_value.clear_all_richtext_formatting();
            } else {
                if has_bold && new_value.clear_richtext_bold() {
                    changed = true;
                }
                if has_italic && new_value.clear_richtext_italic() {
                    changed = true;
                }
                if has_strike_through && new_value.clear_richtext_strike_through() {
                    changed = true;
                }
                if has_text_color && new_value.clear_richtext_text_color() {
                    changed = true;
                }
                if has_underline && new_value.clear_richtext_underline() {
                    changed = true;
                }
            }

            if changed {
                // Update the cell value
                self.set_value(pos, new_value);

                // Track modified position for dirty hashes
                modified_positions.push(pos);

                // Create reverse operation to restore the original value
                let sheet_pos = pos.to_sheet_pos(self.id);
                reverse_ops.push(Operation::SetCellValues {
                    sheet_pos,
                    values: CellValues::from(old_value),
                });
            }
        }

        (reverse_ops, modified_positions)
    }
}

#[cfg(test)]
mod tests {
    use crate::{
        clear_option::ClearOption,
        grid::{
            formats::FormatUpdate,
            {CellAlign, Contiguous2D},
        },
    };

    use super::*;
    use crate::cellvalue::TextSpan;

    #[test]
    fn test_set_formats_a1() {
        let mut sheet = Sheet::test();

        // Add some data to create non-empty bounds
        sheet.set_value(pos![A1], CellValue::Text("test".to_string()));
        sheet.set_value(pos![C3], CellValue::Text("test".to_string()));
        let a1_context = sheet.expensive_make_a1_context();
        sheet.recalculate_bounds(&a1_context);

        // Create format updates with bold and fill_color
        let mut formats = SheetFormatUpdates::default();

        let mut bold = Contiguous2D::new();
        bold.set_rect(1, 1, Some(3), Some(3), Some(ClearOption::Some(true)));
        formats.bold = Some(bold);

        let mut fill_color = Contiguous2D::new();
        fill_color.set_rect(
            1,
            1,
            Some(3),
            Some(3),
            Some(ClearOption::Some("rgb(255, 0, 0)".to_string())),
        );
        formats.fill_color = Some(fill_color);

        // Apply formats
        let (reverse_ops, dirty_hashes, rows_to_resize, fill_bounds, has_meta_fills) =
            sheet.set_formats_a1(&formats);

        // Verify reverse operation
        assert_eq!(reverse_ops.len(), 1);
        let reverse_op = &reverse_ops[0];
        match reverse_op {
            Operation::SetCellFormatsA1 {
                sheet_id,
                formats: reverse_formats,
            } => {
                assert_eq!(sheet_id, &sheet.id);
                // Reverse formats should have None values (clearing the formats we set)
                assert!(reverse_formats.bold.is_some());
                assert!(reverse_formats.fill_color.is_some());
            }
            _ => panic!("Expected SetCellFormatsA1 operation"),
        }

        // Verify dirty hashes contains the affected quadrant
        assert!(!dirty_hashes.is_empty());
        assert!(dirty_hashes.contains(&Pos { x: 0, y: 0 }));

        // Verify rows_to_resize contains rows with content (bold triggers resize)
        assert!(rows_to_resize.contains(&1));
        assert!(rows_to_resize.contains(&3));

        // Verify fill_bounds is some (finite fills applied)
        assert!(fill_bounds.is_some());
        assert!(!has_meta_fills);

        // Verify formats were actually applied
        assert_eq!(sheet.formats.bold.get(pos![A1]), Some(true));
        assert_eq!(
            sheet.formats.fill_color.get(pos![A1]),
            Some("rgb(255, 0, 0)".to_string())
        );
    }

    #[test]
    fn test_set_formats_a1_no_fill_color() {
        let mut sheet = Sheet::test();

        // Add some data
        sheet.set_value(pos![A1], CellValue::Text("test".to_string()));
        let a1_context = sheet.expensive_make_a1_context();
        sheet.recalculate_bounds(&a1_context);

        // Create format updates with only alignment (no fill)
        let mut formats = SheetFormatUpdates::default();
        let mut align = Contiguous2D::new();
        align.set_rect(
            1,
            1,
            Some(1),
            Some(1),
            Some(ClearOption::Some(CellAlign::Center)),
        );
        formats.align = Some(align);

        // Apply formats
        let (_, _, _, fill_bounds, has_meta_fills) = sheet.set_formats_a1(&formats);

        // Verify no fill changes occurred
        assert!(fill_bounds.is_none());
        assert!(!has_meta_fills);
    }

    #[test]
    fn test_formats_transaction_changes() {
        let mut sheet = Sheet::test();

        // Add some data to create non-empty bounds
        sheet.set_value(pos![A1], CellValue::Text("test".to_string()));
        sheet.set_value(pos![E5], CellValue::Text("test".to_string()));
        let a1_context = sheet.expensive_make_a1_context();
        sheet.recalculate_bounds(&a1_context);

        // Create format updates with alignment
        let mut formats = SheetFormatUpdates::default();
        let mut reverse_formats = SheetFormatUpdates::default();

        let mut align = Contiguous2D::new();
        align.set_rect(
            1,
            1,
            Some(5),
            Some(5),
            Some(ClearOption::Some(CellAlign::Center)),
        );
        formats.align = Some(align);

        let mut reverse_align = Contiguous2D::new();
        reverse_align.set_rect(1, 1, Some(5), Some(5), None);
        reverse_formats.align = Some(reverse_align);

        let mut wrap = Contiguous2D::new();
        wrap.set_rect(
            1,
            1,
            Some(5),
            Some(5),
            Some(ClearOption::Some(CellWrap::Wrap)),
        );
        formats.wrap = Some(wrap);

        let mut reverse_wrap = Contiguous2D::new();
        reverse_wrap.set_rect(1, 1, Some(5), Some(5), None);
        reverse_formats.wrap = Some(reverse_wrap);

        let mut bold = Contiguous2D::new();
        bold.set_rect(1, 1, Some(5), Some(5), Some(ClearOption::Some(true)));
        formats.bold = Some(bold);

        let mut reverse_bold = Contiguous2D::new();
        reverse_bold.set_rect(1, 1, Some(5), Some(5), None);
        reverse_formats.bold = Some(reverse_bold);

        let mut fill_color = Contiguous2D::new();
        fill_color.set_rect(
            1,
            1,
            Some(5),
            Some(5),
            Some(ClearOption::Some("rgb(231, 76, 60)".to_string())),
        );
        formats.fill_color = Some(fill_color);

        let mut reverse_fill_color = Contiguous2D::new();
        reverse_fill_color.set_rect(1, 1, Some(5), Some(5), None);
        reverse_formats.fill_color = Some(reverse_fill_color);

        // Get the changes
        let (dirty_hashes, rows_changed, fills_changed, has_meta_fills) =
            sheet.formats_transaction_changes(&formats, &reverse_formats);

        // Expected quadrants (converted to quadrant coordinates)
        let expected_quadrants: HashSet<Pos> = [
            Pos { x: 0, y: 0 }, // Quadrant containing (1,1)
        ]
        .into_iter()
        .collect();

        // Expected rows that changed
        let expected_rows: HashSet<i64> = [1, 5].into_iter().collect();

        assert_eq!(dirty_hashes, expected_quadrants);
        assert_eq!(rows_changed, expected_rows);
        assert!(fills_changed.is_some());
        assert!(!has_meta_fills); // finite fill, not a meta fill
    }

    #[test]
    fn test_cell_bold_clears_richtext_bold() {
        let mut sheet = Sheet::test();

        // Create a RichText cell with bold spans
        let rich_text = CellValue::RichText(vec![
            TextSpan {
                text: "bold".to_string(),
                bold: Some(true),
                ..Default::default()
            },
            TextSpan {
                text: " normal".to_string(),
                ..Default::default()
            },
            TextSpan {
                text: " not-bold".to_string(),
                bold: Some(false),
                italic: Some(true), // This should be preserved
                ..Default::default()
            },
        ]);
        sheet.set_value(pos![A1], rich_text);
        let a1_context = sheet.expensive_make_a1_context();
        sheet.recalculate_bounds(&a1_context);

        // Apply bold formatting at cell level
        let mut formats = SheetFormatUpdates::default();
        let mut bold = Contiguous2D::new();
        bold.set_rect(1, 1, Some(1), Some(1), Some(ClearOption::Some(true)));
        formats.bold = Some(bold);

        let (reverse_ops, _, _, _, _) = sheet.set_formats_a1(&formats);

        // Verify the RichText spans had bold cleared
        let cell = sheet.cell_value(pos![A1]).unwrap();
        if let CellValue::RichText(spans) = cell {
            assert!(spans[0].bold.is_none(), "First span bold should be cleared");
            assert!(
                spans[1].bold.is_none(),
                "Second span bold should remain None"
            );
            assert!(spans[2].bold.is_none(), "Third span bold should be cleared");
            // Italic should be preserved
            assert_eq!(spans[2].italic, Some(true), "Italic should be preserved");
        } else {
            panic!("Expected RichText");
        }

        // Verify reverse operations include SetCellValues
        assert!(
            reverse_ops.len() >= 2,
            "Should have format and cell value reverse ops"
        );
        let has_cell_value_op = reverse_ops
            .iter()
            .any(|op| matches!(op, Operation::SetCellValues { .. }));
        assert!(
            has_cell_value_op,
            "Should have SetCellValues reverse operation"
        );
    }

    #[test]
    fn test_cell_italic_clears_richtext_italic() {
        let mut sheet = Sheet::test();

        // Create a RichText cell with italic spans
        let rich_text = CellValue::RichText(vec![TextSpan {
            text: "italic text".to_string(),
            italic: Some(true),
            bold: Some(true), // This should be preserved
            ..Default::default()
        }]);
        sheet.set_value(pos![A1], rich_text);
        let a1_context = sheet.expensive_make_a1_context();
        sheet.recalculate_bounds(&a1_context);

        // Apply italic formatting at cell level
        let mut formats = SheetFormatUpdates::default();
        let mut italic = Contiguous2D::new();
        italic.set_rect(1, 1, Some(1), Some(1), Some(ClearOption::Some(true)));
        formats.italic = Some(italic);

        sheet.set_formats_a1(&formats);

        // Verify the RichText spans had italic cleared
        let cell = sheet.cell_value(pos![A1]).unwrap();
        if let CellValue::RichText(spans) = cell {
            assert!(spans[0].italic.is_none(), "Italic should be cleared");
            assert_eq!(spans[0].bold, Some(true), "Bold should be preserved");
        } else {
            panic!("Expected RichText");
        }
    }

    #[test]
    fn test_cell_strikethrough_clears_richtext_strikethrough() {
        let mut sheet = Sheet::test();

        // Create a RichText cell with strikethrough spans
        let rich_text = CellValue::RichText(vec![TextSpan {
            text: "strikethrough text".to_string(),
            strike_through: Some(true),
            ..Default::default()
        }]);
        sheet.set_value(pos![A1], rich_text);
        let a1_context = sheet.expensive_make_a1_context();
        sheet.recalculate_bounds(&a1_context);

        // Apply strikethrough formatting at cell level
        let mut formats = SheetFormatUpdates::default();
        let mut strike = Contiguous2D::new();
        strike.set_rect(1, 1, Some(1), Some(1), Some(ClearOption::Some(true)));
        formats.strike_through = Some(strike);

        sheet.set_formats_a1(&formats);

        // Verify the RichText spans had strikethrough cleared
        let cell = sheet.cell_value(pos![A1]).unwrap();
        if let CellValue::RichText(spans) = cell {
            assert!(
                spans[0].strike_through.is_none(),
                "Strikethrough should be cleared"
            );
        } else {
            panic!("Expected RichText");
        }
    }

    #[test]
    fn test_cell_text_color_clears_richtext_text_color() {
        let mut sheet = Sheet::test();

        // Create a RichText cell with text color spans
        let rich_text = CellValue::RichText(vec![
            TextSpan {
                text: "red".to_string(),
                text_color: Some("red".to_string()),
                ..Default::default()
            },
            TextSpan {
                text: " blue".to_string(),
                text_color: Some("blue".to_string()),
                ..Default::default()
            },
        ]);
        sheet.set_value(pos![A1], rich_text);
        let a1_context = sheet.expensive_make_a1_context();
        sheet.recalculate_bounds(&a1_context);

        // Apply text color formatting at cell level
        let mut formats = SheetFormatUpdates::default();
        let mut text_color = Contiguous2D::new();
        text_color.set_rect(
            1,
            1,
            Some(1),
            Some(1),
            Some(ClearOption::Some("green".to_string())),
        );
        formats.text_color = Some(text_color);

        sheet.set_formats_a1(&formats);

        // Verify the RichText spans had text color cleared
        let cell = sheet.cell_value(pos![A1]).unwrap();
        if let CellValue::RichText(spans) = cell {
            assert!(
                spans[0].text_color.is_none(),
                "First span text_color should be cleared"
            );
            assert!(
                spans[1].text_color.is_none(),
                "Second span text_color should be cleared"
            );
        } else {
            panic!("Expected RichText");
        }
    }

    #[test]
    fn test_clear_formatting_clears_all_richtext_spans() {
        let mut sheet = Sheet::test();

        // Create a RichText cell with various formatting
        let rich_text = CellValue::RichText(vec![TextSpan {
            text: "formatted".to_string(),
            bold: Some(true),
            italic: Some(true),
            underline: Some(true),
            strike_through: Some(true),
            text_color: Some("red".to_string()),
            font_size: Some(14),
            link: Some("https://example.com".to_string()), // Link should be preserved
        }]);
        sheet.set_value(pos![A1], rich_text);
        let a1_context = sheet.expensive_make_a1_context();
        sheet.recalculate_bounds(&a1_context);

        // Apply clear formatting (all text formats set to Some(None))
        let formats = SheetFormatUpdates::from_selection(
            &crate::a1::A1Selection::test_a1_sheet_id("A1", sheet.id),
            FormatUpdate::cleared(),
        );

        sheet.set_formats_a1(&formats);

        // Verify all formatting was cleared from RichText spans
        let cell = sheet.cell_value(pos![A1]).unwrap();
        if let CellValue::RichText(spans) = cell {
            assert!(spans[0].bold.is_none(), "Bold should be cleared");
            assert!(spans[0].italic.is_none(), "Italic should be cleared");
            assert!(spans[0].underline.is_none(), "Underline should be cleared");
            assert!(
                spans[0].strike_through.is_none(),
                "Strikethrough should be cleared"
            );
            assert!(
                spans[0].text_color.is_none(),
                "Text color should be cleared"
            );
            assert!(spans[0].font_size.is_none(), "Font size should be cleared");
            // Link should be preserved
            assert_eq!(
                spans[0].link,
                Some("https://example.com".to_string()),
                "Link should be preserved"
            );
            // Text should be preserved
            assert_eq!(spans[0].text, "formatted", "Text should be preserved");
        } else {
            panic!("Expected RichText");
        }
    }

    #[test]
    fn test_multiple_richtext_cells_formatting_cleared() {
        let mut sheet = Sheet::test();

        // Create multiple RichText cells
        let rich1 = CellValue::RichText(vec![TextSpan {
            text: "cell1".to_string(),
            bold: Some(true),
            ..Default::default()
        }]);
        let rich2 = CellValue::RichText(vec![TextSpan {
            text: "cell2".to_string(),
            bold: Some(false),
            ..Default::default()
        }]);
        sheet.set_value(pos![A1], rich1);
        sheet.set_value(pos![A2], rich2);
        let a1_context = sheet.expensive_make_a1_context();
        sheet.recalculate_bounds(&a1_context);

        // Apply bold formatting to range A1:A2
        let mut formats = SheetFormatUpdates::default();
        let mut bold = Contiguous2D::new();
        bold.set_rect(1, 1, Some(1), Some(2), Some(ClearOption::Some(true)));
        formats.bold = Some(bold);

        let (reverse_ops, _, _, _, _) = sheet.set_formats_a1(&formats);

        // Verify both cells had bold cleared
        let cell1 = sheet.cell_value(pos![A1]).unwrap();
        let cell2 = sheet.cell_value(pos![A2]).unwrap();

        if let CellValue::RichText(spans) = cell1 {
            assert!(spans[0].bold.is_none(), "A1 bold should be cleared");
        } else {
            panic!("Expected RichText for A1");
        }

        if let CellValue::RichText(spans) = cell2 {
            assert!(spans[0].bold.is_none(), "A2 bold should be cleared");
        } else {
            panic!("Expected RichText for A2");
        }

        // Should have 2 SetCellValues reverse operations (one for each cell)
        let cell_value_ops: Vec<_> = reverse_ops
            .iter()
            .filter(|op| matches!(op, Operation::SetCellValues { .. }))
            .collect();
        assert_eq!(
            cell_value_ops.len(),
            2,
            "Should have 2 SetCellValues reverse ops"
        );
    }

    #[test]
    fn test_non_richtext_cells_unaffected() {
        let mut sheet = Sheet::test();

        // Create a plain text cell
        sheet.set_value(pos![A1], CellValue::Text("plain text".to_string()));
        let a1_context = sheet.expensive_make_a1_context();
        sheet.recalculate_bounds(&a1_context);

        // Apply bold formatting at cell level
        let mut formats = SheetFormatUpdates::default();
        let mut bold = Contiguous2D::new();
        bold.set_rect(1, 1, Some(1), Some(1), Some(ClearOption::Some(true)));
        formats.bold = Some(bold);

        let (reverse_ops, _, _, _, _) = sheet.set_formats_a1(&formats);

        // Verify the cell is still plain text
        let cell = sheet.cell_value(pos![A1]).unwrap();
        assert_eq!(cell, CellValue::Text("plain text".to_string()));

        // Should only have the format reverse operation, no cell value ops
        let cell_value_ops: Vec<_> = reverse_ops
            .iter()
            .filter(|op| matches!(op, Operation::SetCellValues { .. }))
            .collect();
        assert!(
            cell_value_ops.is_empty(),
            "Should not have SetCellValues for plain text"
        );
    }

    #[test]
    fn test_richtext_no_change_if_no_formatting_to_clear() {
        let mut sheet = Sheet::test();

        // Create a RichText cell with only links (no text formatting)
        let rich_text =
            CellValue::RichText(vec![TextSpan::link("click here", "https://example.com")]);
        sheet.set_value(pos![A1], rich_text.clone());
        let a1_context = sheet.expensive_make_a1_context();
        sheet.recalculate_bounds(&a1_context);

        // Apply bold formatting at cell level
        let mut formats = SheetFormatUpdates::default();
        let mut bold = Contiguous2D::new();
        bold.set_rect(1, 1, Some(1), Some(1), Some(ClearOption::Some(true)));
        formats.bold = Some(bold);

        let (reverse_ops, _, _, _, _) = sheet.set_formats_a1(&formats);

        // Should not have SetCellValues since no bold was present to clear
        let cell_value_ops: Vec<_> = reverse_ops
            .iter()
            .filter(|op| matches!(op, Operation::SetCellValues { .. }))
            .collect();
        assert!(
            cell_value_ops.is_empty(),
            "Should not have SetCellValues when no formatting to clear"
        );

        // Verify the cell is unchanged
        let cell = sheet.cell_value(pos![A1]).unwrap();
        assert_eq!(cell, rich_text);
    }

    #[test]
    fn test_bold_across_mixed_cell_types() {
        use crate::number::decimal_from_str;

        let mut sheet = Sheet::test();

        // A1: RichText WITH bold formatting (should be cleared)
        let rich_with_bold = CellValue::RichText(vec![TextSpan {
            text: "bold text".to_string(),
            bold: Some(true),
            italic: Some(true), // Should be preserved
            ..Default::default()
        }]);
        sheet.set_value(pos![A1], rich_with_bold);

        // A2: RichText WITHOUT bold formatting (no change expected)
        let rich_without_bold = CellValue::RichText(vec![TextSpan {
            text: "italic only".to_string(),
            italic: Some(true),
            ..Default::default()
        }]);
        sheet.set_value(pos![A2], rich_without_bold.clone());

        // A3: Plain Text (no change expected)
        let plain_text = CellValue::Text("plain text".to_string());
        sheet.set_value(pos![A3], plain_text.clone());

        // A4: Number (no change expected)
        let number = CellValue::Number(decimal_from_str("42").unwrap());
        sheet.set_value(pos![A4], number.clone());

        // A5: RichText with bold=false (explicit not-bold, should be cleared)
        let rich_not_bold = CellValue::RichText(vec![TextSpan {
            text: "not bold".to_string(),
            bold: Some(false),
            ..Default::default()
        }]);
        sheet.set_value(pos![A5], rich_not_bold);

        let a1_context = sheet.expensive_make_a1_context();
        sheet.recalculate_bounds(&a1_context);

        // Apply bold formatting to range A1:A5
        let mut formats = SheetFormatUpdates::default();
        let mut bold = Contiguous2D::new();
        bold.set_rect(1, 1, Some(1), Some(5), Some(ClearOption::Some(true)));
        formats.bold = Some(bold);

        let (reverse_ops, _, _, _, _) = sheet.set_formats_a1(&formats);

        // Verify A1: RichText bold should be cleared, italic preserved
        let cell1 = sheet.cell_value(pos![A1]).unwrap();
        if let CellValue::RichText(spans) = cell1 {
            assert!(spans[0].bold.is_none(), "A1 bold should be cleared");
            assert_eq!(spans[0].italic, Some(true), "A1 italic should be preserved");
        } else {
            panic!("A1 should still be RichText");
        }

        // Verify A2: RichText without bold should be unchanged
        let cell2 = sheet.cell_value(pos![A2]).unwrap();
        assert_eq!(cell2, rich_without_bold, "A2 should be unchanged");

        // Verify A3: Plain Text should be unchanged
        let cell3 = sheet.cell_value(pos![A3]).unwrap();
        assert_eq!(cell3, plain_text, "A3 plain text should be unchanged");

        // Verify A4: Number should be unchanged
        let cell4 = sheet.cell_value(pos![A4]).unwrap();
        assert_eq!(cell4, number, "A4 number should be unchanged");

        // Verify A5: RichText with bold=false should have bold cleared
        let cell5 = sheet.cell_value(pos![A5]).unwrap();
        if let CellValue::RichText(spans) = cell5 {
            assert!(spans[0].bold.is_none(), "A5 bold should be cleared");
        } else {
            panic!("A5 should still be RichText");
        }

        // Should have exactly 2 SetCellValues reverse ops (for A1 and A5 which had bold)
        let cell_value_ops: Vec<_> = reverse_ops
            .iter()
            .filter(|op| matches!(op, Operation::SetCellValues { .. }))
            .collect();
        assert_eq!(
            cell_value_ops.len(),
            2,
            "Should have 2 SetCellValues reverse ops (A1 and A5 had bold to clear)"
        );
    }

    #[test]
    fn test_undo_restores_partial_bold_richtext() {
        use crate::a1::A1Selection;
        use crate::controller::GridController;

        let mut gc = GridController::test();
        let sheet_id = gc.sheet_ids()[0];

        // Create a RichText cell with partial bold: "Hello <bold>world</bold>!"
        let spans = vec![
            TextSpan {
                text: "Hello ".to_string(),
                ..Default::default()
            },
            TextSpan {
                text: "world".to_string(),
                bold: Some(true),
                ..Default::default()
            },
            TextSpan {
                text: "!".to_string(),
                ..Default::default()
            },
        ];

        // Set the cell value using set_cell_rich_text
        gc.set_cell_rich_text(
            crate::SheetPos {
                x: 1,
                y: 1,
                sheet_id,
            },
            spans.clone(),
            None,
        );

        // Verify the cell has the RichText with partial bold
        let cell = gc.sheet(sheet_id).cell_value(pos![A1]).unwrap();
        if let CellValue::RichText(cell_spans) = &cell {
            assert_eq!(
                cell_spans[1].bold,
                Some(true),
                "Bold should be set initially"
            );
        } else {
            panic!("Should be RichText");
        }

        // Apply bold formatting at cell level
        let selection = A1Selection::test_a1_sheet_id("A1", sheet_id);
        gc.set_bold(&selection, Some(true), None, false).unwrap();

        // Verify the RichText bold was cleared
        let cell = gc.sheet(sheet_id).cell_value(pos![A1]).unwrap();
        if let CellValue::RichText(cell_spans) = &cell {
            assert!(
                cell_spans[1].bold.is_none(),
                "Bold should be cleared after cell-level bold"
            );
        } else {
            panic!("Should still be RichText");
        }

        // Undo
        gc.undo(1, None, false);

        // Verify the RichText bold is restored
        let cell = gc.sheet(sheet_id).cell_value(pos![A1]).unwrap();
        if let CellValue::RichText(cell_spans) = &cell {
            assert_eq!(
                cell_spans[1].bold,
                Some(true),
                "Bold should be restored after undo"
            );
        } else {
            panic!("Should still be RichText after undo");
        }

        // Redo
        gc.redo(1, None, false);

        // Verify the RichText bold is cleared again
        let cell = gc.sheet(sheet_id).cell_value(pos![A1]).unwrap();
        if let CellValue::RichText(cell_spans) = &cell {
            assert!(
                cell_spans[1].bold.is_none(),
                "Bold should be cleared again after redo"
            );
        } else {
            panic!("Should still be RichText after redo");
        }
    }
}
