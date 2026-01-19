use super::operation::Operation;
use crate::{
    a1::A1Selection,
    controller::GridController,
    grid::{formats::FormatUpdate, sheet::borders::BorderSelection},
};

impl GridController {
    /// Generates operations to clear formatting and borders for a selection.
    ///
    /// If `skip_richtext_clearing` is true, the function will not generate
    /// operations to clear RichText inline formatting. This should be set to
    /// true when the cells are being deleted (since there's no point in
    /// clearing formatting on cells that will be removed, and doing so would
    /// overwrite the deletion with a modified RichText value).
    pub(crate) fn clear_format_borders_operations(
        &self,
        selection: &A1Selection,
        ignore_tables_having_anchoring_cell_in_selection: bool,
        skip_richtext_clearing: bool,
    ) -> Vec<Operation> {
        let mut ops = self.format_ops(
            selection,
            FormatUpdate::cleared(),
            ignore_tables_having_anchoring_cell_in_selection,
            skip_richtext_clearing,
        );
        ops.extend(self.set_borders_a1_selection_operations(
            selection.clone(),
            BorderSelection::All,
            None,
            false,
        ));
        ops
    }
}

#[cfg(test)]
mod tests {
    use crate::grid::{SheetId, formats::SheetFormatUpdates, sheet::borders::BorderStyle};

    use super::*;

    #[test]
    fn test_clear_format_selection_operations() {
        let mut gc = GridController::test();

        gc.set_borders(
            A1Selection::test_a1("A1"),
            BorderSelection::All,
            Some(BorderStyle::default()),
            None,
            false,
        );

        let sheet_id = SheetId::TEST;
        let selection = A1Selection::test_a1("A1");
        let ops = gc.clear_format_borders_operations(&selection, false, false);

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
