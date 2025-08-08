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
        transaction.add_from_code_run(
            data_table_pos.to_multi_pos(sheet.id),
            self.is_image(),
            self.is_html(),
        );

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
                                self.display_value_ref_at((x - 1, y - 1).into())
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
            false,
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
                                    self.display_value_ref_at((x_u32, y_u32).into())
                                        .is_some_and(|cell_value| {
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
pub mod test {
    use crate::{
        Pos,
        a1::A1Selection,
        controller::user_actions::import::tests::simple_csv_at,
        grid::js_types::JsHashesDirty,
        wasm_bindings::js::{clear_js_calls, expect_js_call, expect_js_call_count},
    };

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
