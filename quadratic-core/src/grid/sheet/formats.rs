use crate::{
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
                        let rows = self.get_rows_with_wrap_in_rect(rect, false);
                        rows_to_resize.extend(rows);
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

    /// Returns the dirty hashes and rows changed for the formats
    fn formats_transaction_changes(
        &self,
        formats: &SheetFormatUpdates,
        reverse_formats: &SheetFormatUpdates,
    ) -> (HashSet<Pos>, HashSet<i64>, bool) {
        let mut dirty_hashes = HashSet::new();
        let mut rows_to_resize = HashSet::new();
        let mut fills_changed = false;

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
            false,
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

        if formats.fill_color.is_some() {
            fills_changed = true;
        }

        (dirty_hashes, rows_to_resize, fills_changed)
    }

    /// Sets formats using SheetFormatUpdates.
    ///
    /// Returns (reverse_operations, dirty_hashes, rows_to_resize)
    pub fn set_formats_a1(
        &mut self,
        formats: &SheetFormatUpdates,
    ) -> (Vec<Operation>, HashSet<Pos>, HashSet<i64>, bool) {
        let reverse_formats = self.formats.apply_updates(formats);

        let (dirty_hashes, rows_to_resize, fills_changed) =
            self.formats_transaction_changes(formats, &reverse_formats);

        let reverse_op = Operation::SetCellFormatsA1 {
            sheet_id: self.id,
            formats: reverse_formats,
        };

        (
            vec![reverse_op],
            dirty_hashes,
            rows_to_resize,
            fills_changed,
        )
    }
}

#[cfg(test)]
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
