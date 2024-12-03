use crate::controller::active_transactions::pending_transaction::PendingTransaction;
use crate::controller::operations::operation::Operation;
use crate::controller::GridController;

impl GridController {
    // Supports deprecated SetCellFormats operation.
    // pub(crate) fn execute_set_cell_formats(
    //     &mut self,
    //     transaction: &mut PendingTransaction,
    //     op: Operation,
    // ) {
    //     if let Operation::SetCellFormats { sheet_rect, attr } = op {
    //         let old_attr = match attr.clone() {
    //             CellFmtArray::Align(align) => CellFmtArray::Align(
    //                 self.set_cell_formats_for_type::<CellAlign>(&sheet_rect, align),
    //             ),
    //             CellFmtArray::VerticalAlign(vertical_align) => CellFmtArray::VerticalAlign(
    //                 self.set_cell_formats_for_type::<CellVerticalAlign>(
    //                     &sheet_rect,
    //                     vertical_align,
    //                 ),
    //             ),
    //             CellFmtArray::Wrap(wrap) => CellFmtArray::Wrap(
    //                 self.set_cell_formats_for_type::<CellWrap>(&sheet_rect, wrap),
    //             ),
    //             CellFmtArray::NumericFormat(num_fmt) => CellFmtArray::NumericFormat(
    //                 self.set_cell_formats_for_type::<NumericFormat>(&sheet_rect, num_fmt),
    //             ),
    //             CellFmtArray::NumericDecimals(num_decimals) => CellFmtArray::NumericDecimals(
    //                 self.set_cell_formats_for_type::<NumericDecimals>(&sheet_rect, num_decimals),
    //             ),
    //             CellFmtArray::NumericCommas(num_commas) => CellFmtArray::NumericCommas(
    //                 self.set_cell_formats_for_type::<NumericCommas>(&sheet_rect, num_commas),
    //             ),
    //             CellFmtArray::Bold(bold) => {
    //                 CellFmtArray::Bold(self.set_cell_formats_for_type::<Bold>(&sheet_rect, bold))
    //             }
    //             CellFmtArray::Italic(italic) => CellFmtArray::Italic(
    //                 self.set_cell_formats_for_type::<Italic>(&sheet_rect, italic),
    //             ),
    //             CellFmtArray::TextColor(text_color) => CellFmtArray::TextColor(
    //                 self.set_cell_formats_for_type::<TextColor>(&sheet_rect, text_color),
    //             ),
    //             CellFmtArray::FillColor(fill_color) => CellFmtArray::FillColor(
    //                 self.set_cell_formats_for_type::<FillColor>(&sheet_rect, fill_color),
    //             ),
    //             CellFmtArray::RenderSize(output_size) => CellFmtArray::RenderSize(
    //                 self.set_cell_formats_for_type::<RenderSize>(&sheet_rect, output_size),
    //             ),
    //             CellFmtArray::DateTime(date_time) => CellFmtArray::DateTime(
    //                 self.set_cell_formats_for_type::<DateTimeFormatting>(&sheet_rect, date_time),
    //             ),
    //             CellFmtArray::Underline(underline) => CellFmtArray::Underline(
    //                 self.set_cell_formats_for_type::<Underline>(&sheet_rect, underline),
    //             ),
    //             CellFmtArray::StrikeThrough(strike_through) => CellFmtArray::StrikeThrough(
    //                 self.set_cell_formats_for_type::<StrikeThrough>(&sheet_rect, strike_through),
    //             ),
    //         };
    //         if old_attr == attr {
    //             return;
    //         }

    //         if !transaction.is_server() {
    //             match &attr {
    //                 CellFmtArray::RenderSize(_) => {
    //                     // RenderSize is always sent as a 1,1 rect. TODO: we need to refactor formats to make it less generic.
    //                     if let Some(sheet) = self.grid.try_sheet(sheet_rect.sheet_id) {
    //                         if let Some(code_run) =
    //                             sheet.code_run((sheet_rect.min.x, sheet_rect.min.y).into())
    //                         {
    //                             if code_run.is_html() {
    //                                 self.send_html_output_rect(&sheet_rect);
    //                             } else if code_run.is_image() {
    //                                 self.send_image(
    //                                     (sheet_rect.min.x, sheet_rect.min.y, sheet_rect.sheet_id)
    //                                         .into(),
    //                                 );
    //                             }
    //                         }
    //                     }
    //                 }
    //                 CellFmtArray::FillColor(_) => self.send_fill_cells(&sheet_rect),
    //                 _ => {
    //                     self.send_updated_bounds_rect(&sheet_rect, true);
    //                     transaction.add_dirty_hashes_from_sheet_rect(sheet_rect);
    //                     if matches!(
    //                         attr,
    //                         CellFmtArray::Wrap(_)
    //                             | CellFmtArray::NumericFormat(_)
    //                             | CellFmtArray::NumericDecimals(_)
    //                             | CellFmtArray::NumericCommas(_)
    //                             | CellFmtArray::Bold(_)
    //                             | CellFmtArray::Italic(_)
    //                     ) && transaction.is_user()
    //                     {
    //                         if let Some(sheet) = self.try_sheet(sheet_rect.sheet_id) {
    //                             let rows = sheet.get_rows_with_wrap_in_rect(&sheet_rect.into());
    //                             if !rows.is_empty() {
    //                                 let resize_rows = transaction
    //                                     .resize_rows
    //                                     .entry(sheet_rect.sheet_id)
    //                                     .or_default();
    //                                 resize_rows.extend(rows);
    //                             }
    //                         }
    //                     }
    //                 }
    //             };
    //         }

    //         transaction.generate_thumbnail |= self.thumbnail_dirty_sheet_rect(sheet_rect);

    //         transaction
    //             .forward_operations
    //             .push(Operation::SetCellFormats { sheet_rect, attr });

    //         transaction
    //             .reverse_operations
    //             .push(Operation::SetCellFormats {
    //                 sheet_rect,
    //                 attr: old_attr,
    //             });
    //     }
    // }

    /// Executes SetCellFormatsSelection operation.
    pub fn execute_set_cell_formats_selection(
        &mut self,
        transaction: &mut PendingTransaction,
        op: Operation,
    ) {
        if let Operation::SetCellFormatsSelection { selection, formats } = op {
            if let Some(sheet) = self.try_sheet_mut(selection.sheet_id) {
                let (reverse_operations, hashes, rows) =
                    sheet.set_formats_selection(&selection, &formats);
                if reverse_operations.is_empty() {
                    return;
                }

                if !transaction.is_server() {
                    self.send_updated_bounds_selection(&selection, true);

                    if !rows.is_empty() && transaction.is_user() {
                        let resize_rows = transaction
                            .resize_rows
                            .entry(selection.sheet_id)
                            .or_default();
                        resize_rows.extend(rows);
                    }
                }

                if (cfg!(target_family = "wasm") || cfg!(test)) && !transaction.is_server() {
                    let dirty_hashes = transaction
                        .dirty_hashes
                        .entry(selection.sheet_id)
                        .or_default();
                    dirty_hashes.extend(hashes);
                }

                transaction.generate_thumbnail |= self.thumbnail_dirty_selection(&selection);

                transaction
                    .forward_operations
                    .push(Operation::SetCellFormatsSelection { selection, formats });

                transaction
                    .reverse_operations
                    .extend(reverse_operations.iter().cloned());
            }
        }
    }

    pub fn execute_set_cell_formats_a1(
        &mut self,
        transaction: &mut PendingTransaction,
        op: Operation,
    ) {
        unwrap_op!(let SetCellFormatsA1 { sheet_id,formats } = op);

        transaction.generate_thumbnail |= self.thumbnail_dirty_formats(sheet_id, &formats);

        let Some(sheet) = self.try_sheet_mut(sheet_id) else {
            return; // sheet may have been deleted
        };

        let (reverse_operations, hashes, rows) = sheet.set_formats_a1(&formats);
        if reverse_operations.is_empty() {
            return;
        }

        if !transaction.is_server() {
            // todo...
            // self.send_updated_bounds_a1_subspaces(sheet_id, &subspaces, true);

            if !rows.is_empty() && transaction.is_user() {
                let resize_rows = transaction.resize_rows.entry(sheet_id).or_default();
                resize_rows.extend(rows);
            }
        }

        if (cfg!(target_family = "wasm") || cfg!(test)) && !transaction.is_server() {
            let dirty_hashes = transaction.dirty_hashes.entry(sheet_id).or_default();
            dirty_hashes.extend(hashes);
        }

        transaction
            .forward_operations
            .push(Operation::SetCellFormatsA1 { sheet_id, formats });

        transaction
            .reverse_operations
            .extend(reverse_operations.iter().cloned());
    }
}

#[cfg(test)]
mod test {
    use chrono::Utc;
    use serial_test::serial;

    use super::*;
    use crate::grid::{CodeCellLanguage, CodeCellValue, CodeRun, CodeRunResult, RenderSize};
    use crate::wasm_bindings::js::expect_js_call;
    use crate::{CellValue, Pos, SheetRect, Value};

    #[test]
    #[serial]
    fn execute_set_formats_render_size() {
        let mut gc = GridController::test();
        let sheet_id = gc.sheet_ids()[0];
        let sheet = gc.sheet_mut(sheet_id);

        sheet.test_set_code_run_single(
            0,
            0,
            crate::CellValue::Code(CodeCellValue {
                language: CodeCellLanguage::Javascript,
                code: "code".to_string(),
            }),
        );
        sheet.set_code_run(
            Pos { x: 0, y: 0 },
            Some(CodeRun {
                formatted_code_string: None,
                spill_error: false,
                output_type: None,
                std_err: None,
                std_out: None,
                result: CodeRunResult::Ok(Value::Single(CellValue::Image("image".to_string()))),
                cells_accessed: Default::default(),
                return_type: None,
                line_number: None,
                last_modified: Utc::now(),
            }),
        );

        gc.set_cell_render_size(
            SheetRect::from_numbers(0, 0, 1, 1, sheet_id),
            Some(RenderSize {
                w: "1".to_string(),
                h: "2".to_string(),
            }),
            None,
        );
        let args = format!(
            "{},{},{},{:?},{:?},{:?}",
            sheet_id,
            0,
            0,
            true,
            Some("1".to_string()),
            Some("2".to_string())
        );
        expect_js_call("jsSendImage", args, true);
    }
}
