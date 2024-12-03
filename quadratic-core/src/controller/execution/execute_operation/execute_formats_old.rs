use crate::grid::formats::{FormatUpdate, SheetFormatUpdates};

use super::*;

impl GridController {
    fn set_format(
        a1_formats: &mut SheetFormatUpdates,
        format: &FormatUpdate,
        x1: i64,
        y1: i64,
        x2: Option<i64>,
        y2: Option<i64>,
    ) {
        if let Some(align) = format.align {
            a1_formats
                .align
                .get_or_insert_default()
                .set_rect(x1, y1, x2, y2, Some(align));
        }
    }

    /// Executes SetCellFormatsSelection operation.
    pub fn execute_set_cell_formats_selection(
        &mut self,
        transaction: &mut PendingTransaction,
        op: Operation,
    ) {
        if let Operation::SetCellFormatsSelection { selection, formats } = op {
            let mut a1_formats = SheetFormatUpdates::default();
            let mut old_values = formats.formats.iter_values();
            if selection.all {
                if let Some(format) = old_values.next() {
                    GridController::set_format(&mut a1_formats, format, 1, 1, None, None);
                }
            }

            self.execute_set_cell_formats_a1(
                transaction,
                Operation::SetCellFormatsA1 {
                    sheet_id: selection.sheet_id,
                    formats: a1_formats,
                },
            );
        }
    }
}
