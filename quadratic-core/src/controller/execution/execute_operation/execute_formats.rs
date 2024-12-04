use crate::controller::active_transactions::pending_transaction::PendingTransaction;
use crate::controller::operations::operation::Operation;
use crate::controller::GridController;

impl GridController {
    pub fn execute_set_cell_formats_a1(
        &mut self,
        transaction: &mut PendingTransaction,
        op: Operation,
    ) {
        unwrap_op!(let SetCellFormatsA1 { sheet_id, formats } = op);

        transaction.generate_thumbnail |= self.thumbnail_dirty_formats(sheet_id, &formats);

        let Some(sheet) = self.try_sheet_mut(sheet_id) else {
            return; // sheet may have been deleted
        };

        let (reverse_operations, hashes, rows, html, fills_changed) =
            sheet.set_formats_a1(&formats);
        if reverse_operations.is_empty() {
            return;
        }

        if !transaction.is_server() {
            self.send_updated_bounds(sheet_id);

            if !hashes.is_empty() {
                let dirty_hashes = transaction.dirty_hashes.entry(sheet_id).or_default();
                dirty_hashes.extend(hashes);
            }

            if !rows.is_empty() && transaction.is_user() {
                let resize_rows = transaction.resize_rows.entry(sheet_id).or_default();
                resize_rows.extend(rows);
            }

            if !html.is_empty() {
                let html_cells = transaction.html_cells.entry(sheet_id).or_default();
                html_cells.extend(html);
            }

            if fills_changed {
                transaction.fill_cells.insert(sheet_id);
            }
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
    use crate::{A1Selection, CellValue, Pos, SheetRect, Value};

    #[test]
    #[serial]
    fn test_execute_set_formats_render_size() {
        let mut gc = GridController::test();
        let sheet_id = gc.sheet_ids()[0];
        let sheet = gc.sheet_mut(sheet_id);

        sheet.test_set_code_run_single(
            1,
            1,
            crate::CellValue::Code(CodeCellValue {
                language: CodeCellLanguage::Javascript,
                code: "code".to_string(),
            }),
        );
        sheet.set_code_run(
            Pos { x: 1, y: 1 },
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

        gc.set_render_size(
            &A1Selection::from_rect(SheetRect::from_numbers(1, 1, 2, 2, sheet_id)),
            Some(RenderSize {
                w: "1".to_string(),
                h: "2".to_string(),
            }),
            None,
        )
        .unwrap();
        let args = format!(
            "{},{},{},{:?},{:?},{:?}",
            sheet_id,
            1,
            1,
            true,
            Some("1".to_string()),
            Some("2".to_string())
        );
        expect_js_call("jsSendImage", args, true);
    }
}
