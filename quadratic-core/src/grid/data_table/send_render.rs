use std::collections::HashSet;

use crate::{
    ClearOption, Pos, Rect, SheetPos,
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

        if transaction.is_user() {
            let sheet_rows = sheet.get_rows_with_wrap_in_rect(&data_table_rect.into(), true);
            let table_rows =
                self.get_rows_with_wrap_in_rect(&data_table_pos, &data_table_rect.into(), true);
            if !sheet_rows.is_empty() || !table_rows.is_empty() {
                let resize_rows = transaction
                    .resize_rows
                    .entry(data_table_rect.sheet_id)
                    .or_default();
                resize_rows.extend(sheet_rows);
                resize_rows.extend(table_rows);
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

    fn has_content_in_row(&self, row: i64) -> bool {
        let data_table_rect = self.output_rect((0, 0).into(), false);
        for x in data_table_rect.x_range() {
            if let Some(cell_value) = self.cell_value_at(x as u32, row as u32) {
                if !cell_value.is_blank_or_empty_string() {
                    return true;
                }
            }
        }
        false
    }

    /// Returns the rows with wrap in the given rect.
    pub(crate) fn get_rows_with_wrap_in_rect(
        &self,
        data_table_pos: &Pos,
        rect: &Rect,
        include_blanks: bool,
    ) -> Vec<i64> {
        let mut rows = vec![];
        let formats_x_offset = data_table_pos.x - 1;
        let formats_y_offset = data_table_pos.y - 1 + self.y_adjustment(true);
        for y in rect.y_range() {
            for x in rect.x_range() {
                let check_value = include_blanks
                    || self
                        .cell_value_at((x - data_table_pos.x) as u32, (y - data_table_pos.y) as u32)
                        .is_some_and(|cell_value| !cell_value.is_blank_or_empty_string());

                let check_wrap = self.formats.as_ref().is_some_and(|formats| {
                    formats
                        .wrap
                        .get((x - formats_x_offset, y - formats_y_offset).into())
                        .is_some_and(|wrap| wrap == CellWrap::Wrap)
                });

                if check_value && check_wrap {
                    rows.push(y);
                    break;
                }
            }
        }
        rows
    }

    fn format_transaction_changes<T: std::fmt::Debug + Clone + PartialEq>(
        &self,
        data_table_pos: Pos,
        format: SheetFormatUpdatesType<T>,
        needs_resize: bool,
        dirty_hashes: &mut HashSet<Pos>,
        resize_rows: &mut HashSet<i64>,
    ) {
        // 1-based for formatting, just max bounds are needed to finitize formatting bounds
        let data_table_formats_rect = self.output_rect((1, 1).into(), true);
        if let Some(format) = format {
            format
                .to_rects_with_rect_bounds(data_table_formats_rect)
                .for_each(|(x1, y1, x2, y2, _)| {
                    let formats_rect = Rect::new(x1, y1, x2, y2);
                    let formats_rect_x_offset = data_table_pos.x - 1;
                    let formats_rect_y_offset = data_table_pos.y - 1 + self.y_adjustment(true);
                    let actual_rect_on_sheet =
                        formats_rect.translate(formats_rect_x_offset, formats_rect_y_offset);

                    dirty_hashes.extend(actual_rect_on_sheet.to_hashes());

                    if needs_resize {
                        let rows = self.get_rows_with_wrap_in_rect(
                            &data_table_pos,
                            &actual_rect_on_sheet,
                            false,
                        );
                        resize_rows.extend(rows);
                    }
                });
        }
    }

    fn wrap_transaction_changes(
        &self,
        data_table_pos: Pos,
        wrap: SheetFormatUpdatesType<CellWrap>,
        dirty_hashes: &mut HashSet<Pos>,
        resize_rows: &mut HashSet<i64>,
    ) {
        // 1-based for formatting, just max bounds are needed to finitize formatting bounds
        let data_table_formats_rect = self.output_rect((1, 1).into(), true);
        if let Some(wrap) = wrap {
            wrap.to_rects_with_rect_bounds(data_table_formats_rect)
                .for_each(|(x1, y1, x2, y2, value)| {
                    let formats_rect = Rect::new(x1, y1, x2, y2);
                    let formats_rect_x_offset = data_table_pos.x - 1;
                    let formats_rect_y_offset = data_table_pos.y - 1 + self.y_adjustment(true);
                    let actual_rect_on_sheet =
                        formats_rect.translate(formats_rect_x_offset, formats_rect_y_offset);

                    dirty_hashes.extend(actual_rect_on_sheet.to_hashes());

                    // check if new formats is wrap
                    if value == ClearOption::Some(CellWrap::Wrap) {
                        for y in y1..=y2 {
                            if self.has_content_in_row(y) {
                                resize_rows.insert(y + formats_rect_y_offset);
                            }
                        }
                    }
                });
        }
    }

    /// Returns the dirty hashes and rows changed for the formats
    pub(crate) fn mark_formats_dirty(
        &self,
        transaction: &mut PendingTransaction,
        data_table_pos: SheetPos,
        formats: &SheetFormatUpdates,
        reverse_formats: &SheetFormatUpdates,
    ) {
        if !(cfg!(target_family = "wasm") || cfg!(test)) || transaction.is_server() {
            return;
        }

        let sheet_id = data_table_pos.sheet_id;
        let data_table_pos = data_table_pos.into();

        let mut dirty_hashes = HashSet::new();
        let mut resize_rows = HashSet::new();

        self.format_transaction_changes(
            data_table_pos,
            formats.align.to_owned(),
            false,
            &mut dirty_hashes,
            &mut resize_rows,
        );
        self.format_transaction_changes(
            data_table_pos,
            formats.vertical_align.to_owned(),
            false,
            &mut dirty_hashes,
            &mut resize_rows,
        );
        self.format_transaction_changes(
            data_table_pos,
            formats.numeric_format.to_owned(),
            true,
            &mut dirty_hashes,
            &mut resize_rows,
        );
        self.format_transaction_changes(
            data_table_pos,
            formats.numeric_decimals.to_owned(),
            true,
            &mut dirty_hashes,
            &mut resize_rows,
        );
        self.format_transaction_changes(
            data_table_pos,
            formats.numeric_commas.to_owned(),
            true,
            &mut dirty_hashes,
            &mut resize_rows,
        );
        self.format_transaction_changes(
            data_table_pos,
            formats.bold.to_owned(),
            true,
            &mut dirty_hashes,
            &mut resize_rows,
        );
        self.format_transaction_changes(
            data_table_pos,
            formats.italic.to_owned(),
            true,
            &mut dirty_hashes,
            &mut resize_rows,
        );
        self.format_transaction_changes(
            data_table_pos,
            formats.text_color.to_owned(),
            false,
            &mut dirty_hashes,
            &mut resize_rows,
        );
        self.format_transaction_changes(
            data_table_pos,
            formats.date_time.to_owned(),
            true,
            &mut dirty_hashes,
            &mut resize_rows,
        );
        self.format_transaction_changes(
            data_table_pos,
            formats.underline.to_owned(),
            false,
            &mut dirty_hashes,
            &mut resize_rows,
        );
        self.format_transaction_changes(
            data_table_pos,
            formats.strike_through.to_owned(),
            false,
            &mut dirty_hashes,
            &mut resize_rows,
        );

        // for wrap, we need to check if the new formats is wrap or old is wrap
        // no need to resize rows if wrap is not present in both new and old formats
        self.wrap_transaction_changes(
            data_table_pos,
            formats.wrap.to_owned(),
            &mut dirty_hashes,
            &mut resize_rows,
        );
        self.wrap_transaction_changes(
            data_table_pos,
            reverse_formats.wrap.to_owned(),
            &mut dirty_hashes,
            &mut resize_rows,
        );

        if !transaction.is_server() {
            if !dirty_hashes.is_empty() {
                let dirty_hashes_transaction =
                    transaction.dirty_hashes.entry(sheet_id).or_default();
                dirty_hashes_transaction.extend(dirty_hashes);
            }

            if !resize_rows.is_empty() && transaction.is_user() {
                let resize_rows_transaction = transaction.resize_rows.entry(sheet_id).or_default();
                resize_rows_transaction.extend(resize_rows);
            }

            if formats.fill_color.is_some() {
                transaction.add_fill_cells(sheet_id);
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
