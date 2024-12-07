use super::operation::Operation;
use crate::{
    controller::GridController,
    grid::formats::{FormatUpdate, SheetFormatUpdates},
    A1Selection,
};

impl GridController {
    pub(crate) fn clear_format_borders_operations(
        &self,
        selection: &A1Selection,
    ) -> Vec<Operation> {
        let sheet_id = selection.sheet_id;
        let mut ops = vec![Operation::SetCellFormatsA1 {
            sheet_id,
            formats: SheetFormatUpdates::from_selection(selection, FormatUpdate::cleared()),
        }];
        ops.extend(self.clear_borders_a1_operations(selection));
        ops
    }
}

#[cfg(test)]
#[serial_test::parallel]
mod tests {
    use crate::grid::SheetId;

    use super::*;

    #[test]
    fn clear_format_selection_operations() {
        let gc = GridController::test();
        let sheet_id = SheetId::TEST;
        let selection = A1Selection::test_a1("A1");
        let ops = gc.clear_format_borders_operations(&selection);

        assert_eq!(ops.len(), 2);
        assert_eq!(
            ops.first().unwrap(),
            &Operation::SetCellFormatsA1 {
                sheet_id,
                formats: SheetFormatUpdates::from_selection(&selection, FormatUpdate::cleared()),
            }
        );
        let Operation::SetBordersA1 { sheet_id, borders } = ops.last().unwrap() else {
            panic!("last operation is not SetBordersA1");
        };
        assert_eq!(sheet_id, &SheetId::TEST);
        assert!(!borders.is_default());
    }
}
