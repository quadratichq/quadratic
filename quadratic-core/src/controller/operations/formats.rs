use super::operation::Operation;
use crate::{
    controller::GridController,
    grid::{
        formats::format_update::{FormatUpdate, SheetFormatUpdates},
        sheet::borders::BorderStyleCellUpdate,
    },
    A1Selection, RunLengthEncoding,
};

impl GridController {
    pub(crate) fn clear_format_selection_operations(
        &self,
        selection: &A1Selection,
    ) -> Vec<Operation> {
        let sheet_id = selection.sheet_id;
        let subspaces = selection.subspaces();
        let rle_len = subspaces.rle_len();

        vec![
            Operation::SetCellFormatsA1 {
                sheet_id,
                formats: SheetFormatUpdates::from_selection(selection, FormatUpdate::cleared()),
            },
            Operation::SetBordersA1 {
                sheet_id,
                subspaces, // TODO: this should similarly be a `Contiguous2D` thing
                borders: RunLengthEncoding::repeat(BorderStyleCellUpdate::clear(false), rle_len),
            },
        ]
    }
}

#[cfg(test)]
#[serial_test::parallel]
mod tests {
    use super::*;
    use crate::SheetRect;

    #[test]
    fn clear_format_selection_operations() {
        let gc = GridController::test();
        let sheet_id = gc.sheet_ids()[0];
        let selection = A1Selection::from_rect(SheetRect::from_numbers(1, 1, 1, 1, sheet_id));
        let ops = gc.clear_format_selection_operations(&selection);
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
                Operation::SetBordersA1 {
                    sheet_id,
                    subspaces: selection.subspaces(), // TODO: also use contiguous blocks here
                    borders: RunLengthEncoding::repeat(BorderStyleCellUpdate::clear(false), 1),
                },
            ]
        );
    }
}
