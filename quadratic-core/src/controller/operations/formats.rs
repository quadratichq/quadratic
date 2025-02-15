use super::operation::Operation;
use crate::{
    a1::A1Selection,
    controller::GridController,
    grid::{
        formats::{FormatUpdate, SheetFormatUpdates},
        sheet::borders::BorderSelection,
    },
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
        if let Some(border_ops) = self.set_borders_a1_selection_operations(
            selection.clone(),
            BorderSelection::All,
            None,
            false,
        ) {
            ops.extend(border_ops);
        }
        ops
    }
}

#[cfg(test)]
mod tests {
    use crate::grid::{sheet::borders::BorderStyle, SheetId};

    use super::*;

    #[test]
    fn test_clear_format_selection_operations() {
        let mut gc = GridController::test();

        gc.set_borders(
            A1Selection::test_a1("A1"),
            BorderSelection::All,
            Some(BorderStyle::default()),
            None,
        );

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
        assert!(!borders.is_empty());
    }
}
