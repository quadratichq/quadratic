use super::operation::Operation;
use crate::{
    controller::GridController,
    grid::formats::{FormatUpdate, SheetFormatUpdates},
    A1Selection,
};

impl GridController {
    pub(crate) fn clear_format_selection_operations(
        &self,
        selection: &A1Selection,
    ) -> Vec<Operation> {
        let sheet_id = selection.sheet_id;
        dbgjs!("operations/formats.rs - SetBordersA1");
        vec![
            Operation::SetCellFormatsA1 {
                sheet_id,
                formats: SheetFormatUpdates::from_selection(selection, FormatUpdate::cleared()),
            },
            // Operation::SetBordersA1 {
            //     sheet_id,
            //     borders: RunLengthEncoding::repeat(BorderStyleCellUpdate::clear(false), rle_len),
            // },
        ]
    }
}

#[cfg(test)]
#[serial_test::parallel]
mod tests {

    use crate::SheetRect;

    use super::*;

    #[test]
    fn clear_format_selection_operations() {
        let gc = GridController::test();
        let sheet_id = gc.sheet_ids()[0];
        let selection = A1Selection::from_rect(SheetRect::from_numbers(1, 1, 1, 1, sheet_id));
        let ops = gc.clear_format_selection_operations(&selection);
        dbgjs!("borders in clear_format_selection_operations");
        assert_eq!(
            ops,
            vec![
                Operation::SetCellFormatsA1 {
                    sheet_id,
                    formats: SheetFormatUpdates::from_selection(
                        &selection,
                        FormatUpdate::cleared()
                    ),
                },
                // Operation::SetBordersA1 {
                //     sheet_id,
                //     borders: RunLengthEncoding::repeat(BorderStyleCellUpdate::clear(false), 1),
                // },
            ]
        );
    }
}
