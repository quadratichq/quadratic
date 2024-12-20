use crate::{
    clear_option::ClearOption, controller::operations::operation::Operation,
    grid::formats::SheetFormatUpdates,
};

use super::*;

impl Sheet {
    /// Returns the dirty hashes and rows changed for the formats
    fn formats_transaction_changes(
        &self,
        formats: &SheetFormatUpdates,
        reverse_formats: &SheetFormatUpdates,
    ) -> (HashSet<Pos>, HashSet<i64>, bool) {
        let mut dirty_hashes = HashSet::new();
        let mut resize_rows = HashSet::new();
        let mut fills_changed = false;

        let sheet_bounds =
            |ignore_formatting: bool| -> Option<Rect> { self.bounds(ignore_formatting).into() };

        let columns_bounds = |start: i64, end: i64, ignore_formatting: bool| {
            self.columns_bounds(start, end, ignore_formatting)
        };

        let rows_bounds = |start: i64, end: i64, ignore_formatting: bool| {
            self.rows_bounds(start, end, ignore_formatting)
        };

        if let Some(align) = formats.align.as_ref() {
            align
                .to_rects_with_bounds(sheet_bounds, columns_bounds, rows_bounds, true)
                .for_each(|(x1, y1, x2, y2, _)| {
                    dirty_hashes.extend(Rect::new(x1, y1, x2, y2).to_hashes());
                });
        }
        if let Some(vertical_align) = formats.vertical_align.as_ref() {
            vertical_align
                .to_rects_with_bounds(sheet_bounds, columns_bounds, rows_bounds, true)
                .for_each(|(x1, y1, x2, y2, _)| {
                    dirty_hashes.extend(Rect::new(x1, y1, x2, y2).to_hashes());
                });
        }

        // for wrap, we need to check if the new formats is wrap or old is wrap
        // no need to resize rows if wrap is not present in both new and old formats
        if let Some(wrap) = formats.wrap.as_ref() {
            wrap.to_rects_with_bounds(sheet_bounds, columns_bounds, rows_bounds, true)
                .for_each(|(x1, y1, x2, y2, value)| {
                    dirty_hashes.extend(Rect::new(x1, y1, x2, y2).to_hashes());

                    // check if new formats is wrap
                    if value == ClearOption::Some(CellWrap::Wrap) {
                        for y in y1..=y2 {
                            if self.row_bounds(y, true).is_some() {
                                resize_rows.insert(y);
                            }
                        }
                    }
                });
        }
        if let Some(wrap) = reverse_formats.wrap.as_ref() {
            wrap.to_rects_with_bounds(sheet_bounds, columns_bounds, rows_bounds, true)
                .for_each(|(_, y1, _, y2, value)| {
                    // check if old formats is wrap
                    if value == ClearOption::Some(CellWrap::Wrap) {
                        for y in y1..=y2 {
                            if self.row_bounds(y, true).is_some() {
                                resize_rows.insert(y);
                            }
                        }
                    }
                });
        }

        if let Some(numeric_format) = formats.numeric_format.as_ref() {
            numeric_format
                .to_rects_with_bounds(sheet_bounds, columns_bounds, rows_bounds, true)
                .for_each(|(x1, y1, x2, y2, _)| {
                    let rect = Rect::new(x1, y1, x2, y2);
                    let rows = self.get_rows_with_wrap_in_rect(&rect, false);
                    resize_rows.extend(rows);
                    dirty_hashes.extend(rect.to_hashes());
                });
        }
        if let Some(numeric_decimals) = formats.numeric_decimals.as_ref() {
            numeric_decimals
                .to_rects_with_bounds(sheet_bounds, columns_bounds, rows_bounds, true)
                .for_each(|(x1, y1, x2, y2, _)| {
                    let rect = Rect::new(x1, y1, x2, y2);
                    let rows = self.get_rows_with_wrap_in_rect(&rect, false);
                    resize_rows.extend(rows);
                    dirty_hashes.extend(rect.to_hashes());
                });
        }
        if let Some(numeric_commas) = formats.numeric_commas.as_ref() {
            numeric_commas
                .to_rects_with_bounds(sheet_bounds, columns_bounds, rows_bounds, true)
                .for_each(|(x1, y1, x2, y2, _)| {
                    let rect = Rect::new(x1, y1, x2, y2);
                    let rows = self.get_rows_with_wrap_in_rect(&rect, false);
                    resize_rows.extend(rows);
                    dirty_hashes.extend(rect.to_hashes());
                });
        }
        if let Some(bold) = formats.bold.as_ref() {
            bold.to_rects_with_bounds(sheet_bounds, columns_bounds, rows_bounds, true)
                .for_each(|(x1, y1, x2, y2, _)| {
                    let rect = Rect::new(x1, y1, x2, y2);
                    let rows = self.get_rows_with_wrap_in_rect(&rect, false);
                    resize_rows.extend(rows);
                    dirty_hashes.extend(rect.to_hashes());
                });
        }
        if let Some(italic) = formats.italic.as_ref() {
            italic
                .to_rects_with_bounds(sheet_bounds, columns_bounds, rows_bounds, true)
                .for_each(|(x1, y1, x2, y2, _)| {
                    let rect = Rect::new(x1, y1, x2, y2);
                    let rows = self.get_rows_with_wrap_in_rect(&rect, false);
                    resize_rows.extend(rows);
                    dirty_hashes.extend(rect.to_hashes());
                });
        }
        if let Some(text_color) = formats.text_color.as_ref() {
            text_color
                .to_rects_with_bounds(sheet_bounds, columns_bounds, rows_bounds, true)
                .for_each(|(x1, y1, x2, y2, _)| {
                    dirty_hashes.extend(Rect::new(x1, y1, x2, y2).to_hashes());
                });
        }
        if formats.fill_color.is_some() {
            fills_changed = true;
        }
        if let Some(date_time) = formats.date_time.as_ref() {
            date_time
                .to_rects_with_bounds(sheet_bounds, columns_bounds, rows_bounds, true)
                .for_each(|(x1, y1, x2, y2, _)| {
                    let rect = Rect::new(x1, y1, x2, y2);
                    let rows = self.get_rows_with_wrap_in_rect(&rect, false);
                    resize_rows.extend(rows);
                    dirty_hashes.extend(rect.to_hashes());
                });
        }
        if let Some(underline) = formats.underline.as_ref() {
            underline
                .to_rects_with_bounds(sheet_bounds, columns_bounds, rows_bounds, true)
                .for_each(|(x1, y1, x2, y2, _)| {
                    dirty_hashes.extend(Rect::new(x1, y1, x2, y2).to_hashes());
                });
        }
        if let Some(strike_through) = formats.strike_through.as_ref() {
            strike_through
                .to_rects_with_bounds(sheet_bounds, columns_bounds, rows_bounds, true)
                .for_each(|(x1, y1, x2, y2, _)| {
                    dirty_hashes.extend(Rect::new(x1, y1, x2, y2).to_hashes());
                });
        }

        (dirty_hashes, resize_rows, fills_changed)
    }

    /// Sets formats using SheetFormatUpdates.
    ///
    /// Returns (reverse_operations, dirty_hashes, resize_rows)
    pub fn set_formats_a1(
        &mut self,
        formats: &SheetFormatUpdates,
    ) -> (Vec<Operation>, HashSet<Pos>, HashSet<i64>, bool) {
        let reverse_formats = self.formats.apply_updates(formats);

        let (dirty_hashes, resize_rows, fills_changed) =
            self.formats_transaction_changes(formats, &reverse_formats);

        let reverse_op = Operation::SetCellFormatsA1 {
            sheet_id: self.id,
            formats: reverse_formats,
        };

        (vec![reverse_op], dirty_hashes, resize_rows, fills_changed)
    }
}

#[cfg(test)]
#[serial_test::parallel]
mod tests {
    use crate::{
        clear_option::ClearOption,
        grid::{CellAlign, Contiguous2D},
    };

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
        let (dirty_hashes, rows_changed, fills_changed) =
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
        assert!(fills_changed);
    }
}
