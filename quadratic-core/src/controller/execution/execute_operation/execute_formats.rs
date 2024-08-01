use crate::{
    controller::{
        active_transactions::pending_transaction::PendingTransaction,
        operations::operation::Operation, GridController,
    },
    grid::formatting::CellFmtArray,
    grid::*,
};

impl GridController {
    // Supports deprecated SetCellFormats operation.
    pub(crate) fn execute_set_cell_formats(
        &mut self,
        transaction: &mut PendingTransaction,
        op: Operation,
    ) {
        if let Operation::SetCellFormats { sheet_rect, attr } = op {
            let old_attr = match attr.clone() {
                CellFmtArray::Align(align) => CellFmtArray::Align(
                    self.set_cell_formats_for_type::<CellAlign>(&sheet_rect, align),
                ),
                CellFmtArray::VerticalAlign(vertical_align) => CellFmtArray::VerticalAlign(
                    self.set_cell_formats_for_type::<CellVerticalAlign>(
                        &sheet_rect,
                        vertical_align,
                    ),
                ),
                CellFmtArray::Wrap(wrap) => CellFmtArray::Wrap(
                    self.set_cell_formats_for_type::<CellWrap>(&sheet_rect, wrap),
                ),
                CellFmtArray::NumericFormat(num_fmt) => CellFmtArray::NumericFormat(
                    self.set_cell_formats_for_type::<NumericFormat>(&sheet_rect, num_fmt),
                ),
                CellFmtArray::NumericDecimals(num_decimals) => CellFmtArray::NumericDecimals(
                    self.set_cell_formats_for_type::<NumericDecimals>(&sheet_rect, num_decimals),
                ),
                CellFmtArray::NumericCommas(num_commas) => CellFmtArray::NumericCommas(
                    self.set_cell_formats_for_type::<NumericCommas>(&sheet_rect, num_commas),
                ),
                CellFmtArray::Bold(bold) => {
                    CellFmtArray::Bold(self.set_cell_formats_for_type::<Bold>(&sheet_rect, bold))
                }
                CellFmtArray::Italic(italic) => CellFmtArray::Italic(
                    self.set_cell_formats_for_type::<Italic>(&sheet_rect, italic),
                ),
                CellFmtArray::TextColor(text_color) => CellFmtArray::TextColor(
                    self.set_cell_formats_for_type::<TextColor>(&sheet_rect, text_color),
                ),
                CellFmtArray::FillColor(fill_color) => CellFmtArray::FillColor(
                    self.set_cell_formats_for_type::<FillColor>(&sheet_rect, fill_color),
                ),
                CellFmtArray::RenderSize(output_size) => CellFmtArray::RenderSize(
                    self.set_cell_formats_for_type::<RenderSize>(&sheet_rect, output_size),
                ),
            };

            if !transaction.is_server() {
                match &attr {
                    CellFmtArray::RenderSize(_) => {
                        // RenderSize is always sent as a 1,1 rect. TODO: we need to refactor formats to make it less generic.
                        if let Some(sheet) = self.grid.try_sheet(sheet_rect.sheet_id) {
                            if let Some(code_run) =
                                sheet.code_run((sheet_rect.min.x, sheet_rect.min.y).into())
                            {
                                if code_run.is_html() {
                                    self.send_html_output_rect(&sheet_rect);
                                } else if code_run.is_image() {
                                    self.send_image(
                                        (sheet_rect.min.x, sheet_rect.min.y, sheet_rect.sheet_id)
                                            .into(),
                                    );
                                }
                            }
                        }
                    }
                    CellFmtArray::FillColor(_) => self.send_fill_cells(&sheet_rect),
                    _ => {
                        self.send_updated_bounds_rect(&sheet_rect, true);
                        self.send_render_cells(&sheet_rect);
                        if matches!(
                            attr,
                            CellFmtArray::Wrap(_)
                                | CellFmtArray::NumericFormat(_)
                                | CellFmtArray::NumericDecimals(_)
                                | CellFmtArray::NumericCommas(_)
                                | CellFmtArray::Bold(_)
                                | CellFmtArray::Italic(_)
                        ) {
                            self.start_auto_resize_row_heights(
                                transaction,
                                sheet_rect.sheet_id,
                                sheet_rect.y_range().collect(),
                            );
                        }
                    }
                };
            }

            transaction.generate_thumbnail |= self.thumbnail_dirty_sheet_rect(&sheet_rect);

            transaction
                .forward_operations
                .push(Operation::SetCellFormats { sheet_rect, attr });

            transaction.reverse_operations.insert(
                0,
                Operation::SetCellFormats {
                    sheet_rect,
                    attr: old_attr,
                },
            );
        }
    }

    /// Executes SetCellFormatsSelection operation.
    pub fn execute_set_cell_formats_selection(
        &mut self,
        transaction: &mut PendingTransaction,
        op: Operation,
    ) {
        if let Operation::SetCellFormatsSelection { selection, formats } = op {
            if let Some(sheet) = self.try_sheet_mut(selection.sheet_id) {
                let reverse_operations = sheet.set_formats_selection(&selection, &formats);
                if !transaction.is_server() {
                    self.send_updated_bounds_selection(&selection, true);
                    if formats.formats.iter_values().any(|f| {
                        f.wrap.is_some()
                            || f.numeric_format.is_some()
                            || f.numeric_decimals.is_some()
                            || f.numeric_commas.is_some()
                            || f.bold.is_some()
                            || f.italic.is_some()
                    }) {
                        if let Some(sheet) = self.try_sheet(selection.sheet_id) {
                            let rows = sheet.get_rows_in_selection(&selection);
                            self.start_auto_resize_row_heights(
                                transaction,
                                selection.sheet_id,
                                rows,
                            );
                        }
                    }
                }

                transaction.generate_thumbnail |= self.thumbnail_dirty_selection(&selection);

                transaction
                    .forward_operations
                    .push(Operation::SetCellFormatsSelection { selection, formats });

                transaction
                    .reverse_operations
                    .splice(0..0, reverse_operations.iter().cloned());
            }
        }
    }
}

#[cfg(test)]
mod test {
    use super::*;
    use crate::{
        wasm_bindings::js::expect_js_call, CellValue, CodeCellValue, Pos, SheetRect, Value,
    };
    use chrono::Utc;
    use serial_test::serial;
    use std::collections::HashSet;

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
                cells_accessed: HashSet::new(),
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
