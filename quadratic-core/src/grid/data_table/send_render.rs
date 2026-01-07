use std::collections::HashSet;

use crate::{
    Pos, Rect, SheetPos,
    controller::active_transactions::pending_transaction::PendingTransaction,
    grid::{
        CellWrap, Sheet, SheetId,
        formats::{SheetFormatUpdates, SheetFormatUpdatesType},
    },
};

use super::DataTable;

use anyhow::Result;

impl DataTable {
    pub(crate) fn add_dirty_table(
        &self,
        transaction: &mut PendingTransaction,
        sheet: &Sheet,
        data_table_pos: Pos,
    ) -> Result<()> {
        transaction.add_from_code_run(sheet.id, data_table_pos, self.is_image(), self.is_html());

        if !(cfg!(target_family = "wasm") || cfg!(test)) || transaction.is_server() {
            return Ok(());
        }

        let data_table_sheet_pos = data_table_pos.to_sheet_pos(sheet.id);
        let data_table_rect = self.output_sheet_rect(data_table_sheet_pos, false);

        transaction.add_dirty_hashes_from_sheet_rect(data_table_rect);
        self.add_dirty_fills_and_borders(transaction, sheet.id);

        if transaction.is_user_ai() {
            let rows_to_resize = sheet.get_rows_with_wrap_in_rect(data_table_rect.into(), true);
            if !rows_to_resize.is_empty() {
                transaction
                    .resize_rows
                    .entry(data_table_rect.sheet_id)
                    .or_default()
                    .extend(rows_to_resize);
            }
        }

        Ok(())
    }

    pub(crate) fn add_dirty_fills_and_borders(
        &self,
        transaction: &mut PendingTransaction,
        sheet_id: SheetId,
    ) {
        if !(cfg!(target_family = "wasm") || cfg!(test)) || transaction.is_server() {
            return;
        }

        if self
            .formats
            .as_ref()
            .is_some_and(|formats| formats.has_fills())
        {
            transaction.add_fill_cells(sheet_id);
        }
        if !self
            .borders
            .as_ref()
            .is_none_or(|borders| borders.is_default())
        {
            transaction.add_borders(sheet_id);
        }
    }

    /// Returns the rows with wrap in the given rect.
    pub(crate) fn get_rows_with_wrap_in_display_rect(
        &self,
        data_table_pos: &Pos,
        display_rect: &Rect,
        include_blanks: bool,
        rows_to_resize: &mut HashSet<i64>,
    ) {
        let y_adjustment = self.y_adjustment(true);

        let data_table_rect =
            display_rect.translate(1 - data_table_pos.x, 1 - data_table_pos.y - y_adjustment);

        let reverse_display_buffer = self.get_reverse_display_buffer();

        if let Some(formats) = self.formats.as_ref() {
            for (rect, value) in formats.wrap.nondefault_rects_in_rect(data_table_rect) {
                if value != Some(CellWrap::Wrap) {
                    continue;
                }

                for y in rect.y_range() {
                    if let Ok(y_u64) = u64::try_from(y - 1) {
                        let actual_row = data_table_pos.y
                            + y_adjustment
                            + self.get_display_index_from_reverse_display_buffer(
                                y_u64,
                                reverse_display_buffer.as_ref(),
                            ) as i64;

                        if rows_to_resize.contains(&actual_row) {
                            continue;
                        }

                        let check_value = include_blanks
                            || rect.x_range().any(|x| {
                                self.cell_value_at((x - 1) as u32, (y - 1) as u32)
                                    .is_some_and(|cell_value| {
                                        !cell_value.is_blank_or_empty_string()
                                    })
                            });

                        if check_value {
                            rows_to_resize.insert(actual_row);
                        }
                    }
                }
            }
        }
    }

    /// Returns the rows with multi-line text (containing newlines) in the given display rect.
    pub(crate) fn get_rows_with_multiline_text_in_display_rect(
        &self,
        data_table_pos: &Pos,
        display_rect: &Rect,
        rows_to_resize: &mut HashSet<i64>,
    ) {
        let y_adjustment = self.y_adjustment(true);
        let reverse_display_buffer = self.get_reverse_display_buffer();

        // Iterate through the display rect and check for multi-line text
        for y in display_rect.y_range() {
            let data_y = y - data_table_pos.y - y_adjustment;
            if data_y < 0 {
                continue;
            }

            // Calculate the actual row in sheet coordinates
            let actual_row = data_table_pos.y
                + y_adjustment
                + self.get_display_index_from_reverse_display_buffer(
                    data_y as u64,
                    reverse_display_buffer.as_ref(),
                ) as i64;

            if rows_to_resize.contains(&actual_row) {
                continue;
            }

            // Check cells in this row for multi-line text
            for x in display_rect.x_range() {
                let data_x = x - data_table_pos.x;
                if data_x < 0 {
                    continue;
                }

                if let Some(crate::CellValue::Text(text)) =
                    self.cell_value_at(data_x as u32, data_y as u32)
                    && (text.contains('\n') || text.contains('\r'))
                {
                    rows_to_resize.insert(actual_row);
                    break;
                }
            }
        }
    }

    /// Returns the dirty hashes and rows changed for the formats
    pub(crate) fn mark_formats_dirty(
        &self,
        transaction: &mut PendingTransaction,
        data_table_pos: SheetPos,
        formats: &SheetFormatUpdates,
    ) {
        if !(cfg!(target_family = "wasm") || cfg!(test)) || transaction.is_server() {
            return;
        }

        let sheet_id = data_table_pos.sheet_id;
        let data_table_pos = data_table_pos.into();

        let mut dirty_hashes = HashSet::new();
        let mut rows_to_resize = HashSet::new();

        self.format_transaction_changes(
            data_table_pos,
            &formats.align,
            false,
            &mut dirty_hashes,
            &mut rows_to_resize,
        );
        self.format_transaction_changes(
            data_table_pos,
            &formats.vertical_align,
            false,
            &mut dirty_hashes,
            &mut rows_to_resize,
        );
        self.format_transaction_changes(
            data_table_pos,
            &formats.wrap,
            true,
            &mut dirty_hashes,
            &mut rows_to_resize,
        );
        self.format_transaction_changes(
            data_table_pos,
            &formats.numeric_format,
            true,
            &mut dirty_hashes,
            &mut rows_to_resize,
        );
        self.format_transaction_changes(
            data_table_pos,
            &formats.numeric_decimals,
            true,
            &mut dirty_hashes,
            &mut rows_to_resize,
        );
        self.format_transaction_changes(
            data_table_pos,
            &formats.numeric_commas,
            true,
            &mut dirty_hashes,
            &mut rows_to_resize,
        );
        self.format_transaction_changes(
            data_table_pos,
            &formats.bold,
            true,
            &mut dirty_hashes,
            &mut rows_to_resize,
        );
        self.format_transaction_changes(
            data_table_pos,
            &formats.italic,
            true,
            &mut dirty_hashes,
            &mut rows_to_resize,
        );
        self.format_transaction_changes(
            data_table_pos,
            &formats.text_color,
            false,
            &mut dirty_hashes,
            &mut rows_to_resize,
        );
        self.format_transaction_changes(
            data_table_pos,
            &formats.date_time,
            true,
            &mut dirty_hashes,
            &mut rows_to_resize,
        );
        self.format_transaction_changes(
            data_table_pos,
            &formats.underline,
            true,
            &mut dirty_hashes,
            &mut rows_to_resize,
        );
        self.format_transaction_changes(
            data_table_pos,
            &formats.strike_through,
            false,
            &mut dirty_hashes,
            &mut rows_to_resize,
        );
        self.format_transaction_changes(
            data_table_pos,
            &formats.font_size,
            true,
            &mut dirty_hashes,
            &mut rows_to_resize,
        );

        if !transaction.is_server() {
            if !dirty_hashes.is_empty() {
                let dirty_hashes_transaction =
                    transaction.dirty_hashes.entry(sheet_id).or_default();
                dirty_hashes_transaction.extend(dirty_hashes);
            }

            if !rows_to_resize.is_empty() && transaction.is_user_ai() {
                transaction
                    .resize_rows
                    .entry(sheet_id)
                    .or_default()
                    .extend(rows_to_resize);
            }

            if formats.fill_color.is_some() {
                transaction.add_fill_cells(sheet_id);
            }
        }
    }

    fn format_transaction_changes<T: std::fmt::Debug + Clone + PartialEq>(
        &self,
        data_table_pos: Pos,
        format: &SheetFormatUpdatesType<T>,
        needs_resize: bool,
        dirty_hashes: &mut HashSet<Pos>,
        rows_to_resize: &mut HashSet<i64>,
    ) {
        let y_adjustment = self.y_adjustment(true);

        // 1-based for formatting, just max bounds are needed to finitize formatting bounds
        let data_table_formats_rect = self.output_rect((1, 1).into(), true);

        let reverse_display_buffer = self.get_reverse_display_buffer();

        if let Some(format) = format {
            format
                .nondefault_rects_in_rect(data_table_formats_rect)
                .for_each(|(formats_rect, _value)| {
                    for x in formats_rect.x_range() {
                        if let Ok(actual_col) = u32::try_from(x - 1) {
                            let display_col = data_table_pos.x
                                + self.get_display_index_from_column_index(actual_col, false);

                            for y in formats_rect.y_range() {
                                if let Ok(actual_row) = u64::try_from(y - 1) {
                                    let display_row = data_table_pos.y
                                        + y_adjustment
                                        + self.get_display_index_from_reverse_display_buffer(
                                            actual_row,
                                            reverse_display_buffer.as_ref(),
                                        ) as i64;

                                    let mut hash: Pos = (display_col, display_row).into();
                                    hash.to_quadrant();
                                    dirty_hashes.insert(hash);
                                }
                            }
                        }
                    }

                    if needs_resize {
                        self.get_rows_with_wrap_in_formats_rect(
                            &data_table_pos,
                            formats_rect,
                            false,
                            rows_to_resize,
                        );
                    }
                });
        }
    }

    fn get_rows_with_wrap_in_formats_rect(
        &self,
        data_table_pos: &Pos,
        formats_rect: Rect,
        include_blanks: bool,
        rows_to_resize: &mut HashSet<i64>,
    ) {
        let y_adjustment = self.y_adjustment(true);

        let reverse_display_buffer = self.get_reverse_display_buffer();

        if let Some(formats) = self.formats.as_ref() {
            for (rect, value) in formats.wrap.nondefault_rects_in_rect(formats_rect) {
                if value != Some(CellWrap::Wrap) {
                    continue;
                }

                for y in rect.y_range() {
                    if let Ok(y_u32) = u32::try_from(y - 1) {
                        let actual_row = data_table_pos.y
                            + y_adjustment
                            + self.get_display_index_from_reverse_display_buffer(
                                y_u32 as u64,
                                reverse_display_buffer.as_ref(),
                            ) as i64;

                        if rows_to_resize.contains(&actual_row) {
                            continue;
                        }

                        let check_value = include_blanks
                            || rect.x_range().any(|x| {
                                u32::try_from(x - 1).ok().is_some_and(|x_u32| {
                                    self.cell_value_at(x_u32, y_u32).is_some_and(|cell_value| {
                                        !cell_value.is_blank_or_empty_string()
                                    })
                                })
                            });

                        if check_value {
                            rows_to_resize.insert(actual_row);
                        }
                    }
                }
            }
        }
    }
}

#[cfg(test)]
mod test {
    use std::collections::HashSet;

    use crate::{
        Array, Pos, Rect,
        a1::A1Selection,
        cellvalue::Import,
        controller::{GridController, user_actions::import::tests::simple_csv_at},
        grid::{DataTable, js_types::JsHashesDirty},
        wasm_bindings::js::{clear_js_calls, expect_js_call, expect_js_call_count},
    };

    fn create_data_table_with_values(values: Vec<Vec<&str>>) -> DataTable {
        let gc = GridController::test();
        let import = Import::new("test.csv".into());
        let array = Array::from_str_vec(values, false).unwrap();
        let context = gc.a1_context();
        DataTable::from((import, array, context))
    }

    #[test]
    fn test_get_rows_with_multiline_text_in_display_rect() {
        // Create a data table with multi-line text in various rows
        // The data table will have:
        // - Row 0 (name row): table name
        // - Row 1 (column headers): Column 1, Column 2, Column 3
        // - Row 2+ (data): the actual values
        let values = vec![
            vec!["normal", "also normal", "still normal"],    // data row 0
            vec!["has\nnewline", "normal", "normal"],         // data row 1 - has \n
            vec!["normal", "has\r\ncarriage", "normal"],      // data row 2 - has \r\n
            vec!["normal", "normal", "normal"],               // data row 3
            vec!["multi\nline\ntext", "normal", "another\nmultiline"], // data row 4 - has \n
        ];
        let data_table = create_data_table_with_values(values);

        // Data table at origin for simplicity
        let data_table_pos = Pos { x: 0, y: 0 };
        let y_adjustment = data_table.y_adjustment(true);

        // Display rect covering all data rows (starting after name and column headers)
        // Sheet coords: y=y_adjustment to y=y_adjustment+4 covers data rows 0-4
        let display_rect = Rect::new(0, y_adjustment, 2, y_adjustment + 4);
        let mut rows_to_resize = HashSet::new();
        data_table.get_rows_with_multiline_text_in_display_rect(
            &data_table_pos,
            &display_rect,
            &mut rows_to_resize,
        );

        // Data rows with newlines: 1, 2, 4
        // In sheet coords: y_adjustment + 1, y_adjustment + 2, y_adjustment + 4
        assert!(
            rows_to_resize.contains(&(y_adjustment + 1)),
            "Row with \\n should be included, got {:?}",
            rows_to_resize
        );
        assert!(
            rows_to_resize.contains(&(y_adjustment + 2)),
            "Row with \\r\\n should be included, got {:?}",
            rows_to_resize
        );
        assert!(
            rows_to_resize.contains(&(y_adjustment + 4)),
            "Row with multiple multiline cells should be included, got {:?}",
            rows_to_resize
        );
        assert_eq!(rows_to_resize.len(), 3, "Should have exactly 3 rows, got {:?}", rows_to_resize);
    }

    #[test]
    fn test_get_rows_with_multiline_text_partial_rect() {
        let values = vec![
            vec!["line1\nline2", "normal"],  // data row 0 - has \n
            vec!["normal", "normal"],        // data row 1
            vec!["normal", "multi\nline"],   // data row 2 - has \n
        ];
        let data_table = create_data_table_with_values(values);

        let data_table_pos = Pos { x: 0, y: 0 };
        let y_adjustment = data_table.y_adjustment(true);

        // Test with display rect covering only the first two data rows (0 and 1)
        let display_rect = Rect::new(0, y_adjustment, 1, y_adjustment + 1);
        let mut rows_to_resize = HashSet::new();
        data_table.get_rows_with_multiline_text_in_display_rect(
            &data_table_pos,
            &display_rect,
            &mut rows_to_resize,
        );

        // Only data row 0 should be included (has \n at position 0,0)
        // In sheet coords: y_adjustment + 0 = y_adjustment
        assert!(
            rows_to_resize.contains(&y_adjustment),
            "First data row should be included, got {:?}",
            rows_to_resize
        );
        assert_eq!(rows_to_resize.len(), 1, "Should have exactly 1 row, got {:?}", rows_to_resize);
    }

    #[test]
    fn test_get_rows_with_multiline_text_empty_result() {
        let values = vec![
            vec!["normal", "text"],
            vec!["also normal", "more text"],
        ];
        let data_table = create_data_table_with_values(values);

        let data_table_pos = Pos { x: 0, y: 0 };
        let y_adjustment = data_table.y_adjustment(true);

        let display_rect = Rect::new(0, y_adjustment, 1, y_adjustment + 1);
        let mut rows_to_resize = HashSet::new();
        data_table.get_rows_with_multiline_text_in_display_rect(
            &data_table_pos,
            &display_rect,
            &mut rows_to_resize,
        );

        assert!(rows_to_resize.is_empty(), "Should have no rows with multiline text, got {:?}", rows_to_resize);
    }

    #[test]
    fn test_get_rows_with_multiline_text_skips_existing_rows() {
        let values = vec![
            vec!["line1\nline2"],       // data row 0 - has \n
            vec!["another\nmultiline"], // data row 1 - has \n
        ];
        let data_table = create_data_table_with_values(values);

        let data_table_pos = Pos { x: 0, y: 0 };
        let y_adjustment = data_table.y_adjustment(true);

        // Display rect covering both data rows
        let display_rect = Rect::new(0, y_adjustment, 0, y_adjustment + 1);
        let mut rows_to_resize = HashSet::new();

        // Pre-populate with the first data row's sheet coordinate
        rows_to_resize.insert(y_adjustment);

        data_table.get_rows_with_multiline_text_in_display_rect(
            &data_table_pos,
            &display_rect,
            &mut rows_to_resize,
        );

        // Should still have both rows - the first was pre-existing, the second was added
        assert!(rows_to_resize.contains(&y_adjustment), "First row should still be present");
        assert!(rows_to_resize.contains(&(y_adjustment + 1)), "Second row should be added, got {:?}", rows_to_resize);
        assert_eq!(rows_to_resize.len(), 2, "Should have exactly 2 rows, got {:?}", rows_to_resize);
    }

    #[test]
    fn test_table_js_hashes_dirty() {
        clear_js_calls();

        let (mut gc, sheet_id, _, _) = simple_csv_at(pos![M20]);

        gc.set_bold(
            &A1Selection::test_a1_sheet_id("M22", sheet_id),
            Some(true),
            None,
            false,
        )
        .unwrap();

        expect_js_call_count("jsRenderCellSheets", 0, false);

        let dirty_hashes = vec![JsHashesDirty {
            sheet_id,
            hashes: vec![Pos { x: 0, y: 0 }],
        }];
        expect_js_call(
            "jsHashesDirty",
            format!("{:?}", serde_json::to_vec(&dirty_hashes).unwrap()),
            true,
        );

        gc.set_bold(
            &A1Selection::test_a1_sheet_id("P31", sheet_id),
            Some(true),
            None,
            false,
        )
        .unwrap();

        expect_js_call_count("jsRenderCellSheets", 0, false);
        let dirty_hashes = vec![JsHashesDirty {
            sheet_id,
            hashes: vec![Pos { x: 1, y: 1 }],
        }];
        expect_js_call(
            "jsHashesDirty",
            format!("{:?}", serde_json::to_vec(&dirty_hashes).unwrap()),
            true,
        );
    }
}
