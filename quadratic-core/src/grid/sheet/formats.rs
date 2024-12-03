use crate::{controller::operations::operation::Operation, grid::formats::SheetFormatUpdates};

use super::*;

impl Sheet {
    /// Returns the dirty hashes and rows changed for the formats
    fn formats_transaction_changes(
        &self,
        formats: &SheetFormatUpdates,
    ) -> (HashSet<Pos>, HashSet<i64>) {
        let mut dirty_hashes = HashSet::new();
        let mut rows_changed = HashSet::new();

        let columns_bounds = |start: i64, end: i64, ignore_formatting: bool| {
            self.columns_bounds(start, end, ignore_formatting)
        };
        let rows_bounds = |start: i64, end: i64, ignore_formatting: bool| {
            self.rows_bounds(start, end, ignore_formatting)
        };

        if let Some(align) = formats.align.as_ref() {
            align
                .to_rects_with_bounds(columns_bounds, rows_bounds, true)
                .for_each(|(x1, y1, x2, y2, _)| {
                    for y in y1..=y2 {
                        rows_changed.insert(y);
                        for x in x1..=x2 {
                            let mut quadrant = Pos { x, y };
                            quadrant.to_quadrant();
                            dirty_hashes.insert(quadrant);
                        }
                    }
                });
        }
        if let Some(vertical_align) = formats.vertical_align.as_ref() {
            vertical_align
                .to_rects_with_bounds(columns_bounds, rows_bounds, true)
                .for_each(|(x1, y1, x2, y2, _)| {
                    for y in y1..=y2 {
                        for x in x1..=x2 {
                            let mut quadrant = Pos { x, y };
                            quadrant.to_quadrant();
                            dirty_hashes.insert(quadrant);
                        }
                    }
                });
        }
        if let Some(numeric_format) = formats.numeric_format.as_ref() {
            numeric_format
                .to_rects_with_bounds(columns_bounds, rows_bounds, true)
                .for_each(|(x1, y1, x2, y2, _)| {
                    for y in y1..=y2 {
                        for x in x1..=x2 {
                            let mut quadrant = Pos { x, y };
                            quadrant.to_quadrant();
                            dirty_hashes.insert(quadrant);
                        }
                    }
                });
        }
        if let Some(numeric_decimals) = formats.numeric_decimals.as_ref() {
            numeric_decimals
                .to_rects_with_bounds(columns_bounds, rows_bounds, true)
                .for_each(|(x1, y1, x2, y2, _)| {
                    for y in y1..=y2 {
                        for x in x1..=x2 {
                            let mut quadrant = Pos { x, y };
                            quadrant.to_quadrant();
                            dirty_hashes.insert(quadrant);
                        }
                    }
                });
        }
        if let Some(numeric_commas) = formats.numeric_commas.as_ref() {
            numeric_commas
                .to_rects_with_bounds(columns_bounds, rows_bounds, true)
                .for_each(|(x1, y1, x2, y2, _)| {
                    for y in y1..=y2 {
                        for x in x1..=x2 {
                            let mut quadrant = Pos { x, y };
                            quadrant.to_quadrant();
                            dirty_hashes.insert(quadrant);
                        }
                    }
                });
        }
        if let Some(bold) = formats.bold.as_ref() {
            bold.to_rects_with_bounds(columns_bounds, rows_bounds, true)
                .for_each(|(x1, y1, x2, y2, _)| {
                    for y in y1..=y2 {
                        for x in x1..=x2 {
                            let mut quadrant = Pos { x, y };
                            quadrant.to_quadrant();
                            dirty_hashes.insert(quadrant);
                        }
                    }
                });
        }
        if let Some(italic) = formats.italic.as_ref() {
            italic
                .to_rects_with_bounds(columns_bounds, rows_bounds, true)
                .for_each(|(x1, y1, x2, y2, _)| {
                    for y in y1..=y2 {
                        for x in x1..=x2 {
                            let mut quadrant = Pos { x, y };
                            quadrant.to_quadrant();
                            dirty_hashes.insert(quadrant);
                        }
                    }
                });
        }
        if let Some(fill_color) = formats.fill_color.as_ref() {
            fill_color
                .to_rects_with_bounds(columns_bounds, rows_bounds, true)
                .for_each(|(x1, y1, x2, y2, _)| {
                    for y in y1..=y2 {
                        for x in x1..=x2 {
                            let mut quadrant = Pos { x, y };
                            quadrant.to_quadrant();
                            dirty_hashes.insert(quadrant);
                        }
                    }
                });
        }
        if let Some(date_time) = formats.date_time.as_ref() {
            date_time
                .to_rects_with_bounds(columns_bounds, rows_bounds, true)
                .for_each(|(x1, y1, x2, y2, _)| {
                    for y in y1..=y2 {
                        for x in x1..=x2 {
                            let mut quadrant = Pos { x, y };
                            quadrant.to_quadrant();
                            dirty_hashes.insert(quadrant);
                        }
                    }
                });
        }
        if let Some(underline) = formats.underline.as_ref() {
            underline
                .to_rects_with_bounds(columns_bounds, rows_bounds, true)
                .for_each(|(x1, y1, x2, y2, _)| {
                    for y in y1..=y2 {
                        for x in x1..=x2 {
                            let mut quadrant = Pos { x, y };
                            quadrant.to_quadrant();
                            dirty_hashes.insert(quadrant);
                        }
                    }
                });
        }

        (dirty_hashes, rows_changed)
    }

    /// Sets formats using SheetFormatUpdates.
    ///
    /// Returns (reverse_operations, dirty_hashes, resize_rows)
    pub fn set_formats_a1(
        &mut self,
        formats: &SheetFormatUpdates,
    ) -> (Vec<Operation>, HashSet<Pos>, HashSet<i64>) {
        let reverse_formats = self.formats.apply_updates(formats);
        let reverse_op = Operation::SetCellFormatsA1 {
            sheet_id: self.id,
            formats: reverse_formats,
        };
        let (dirty_hashes, rows_changed) = self.formats_transaction_changes(formats);
        (vec![reverse_op], dirty_hashes, rows_changed)
    }
}

#[cfg(test)]
#[serial_test::parallel]
mod tests {
    use crate::grid::Contiguous2D;

    use super::*;

    #[test]
    fn test_formats_transaction_changes() {
        let mut sheet = Sheet::test();

        // Add some data to create non-empty bounds
        sheet.set_cell_value(pos![A1], CellValue::Text("test".to_string()));
        sheet.set_cell_value(pos![E5], CellValue::Text("test".to_string()));
        sheet.recalculate_bounds();

        // Create format updates with alignment
        let mut formats = SheetFormatUpdates::default();
        let mut bold = Contiguous2D::new();
        bold.set_rect(1, 1, Some(5), Some(5), Some(Some(true)));
        formats.bold = Some(bold);

        // Get the changes
        let (dirty_hashes, rows_changed) = sheet.formats_transaction_changes(&formats);

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
    }
}
