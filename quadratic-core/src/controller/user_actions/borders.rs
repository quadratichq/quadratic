use crate::{
    controller::{active_transactions::transaction_name::TransactionName, GridController},
    grid::sheet::borders::{BorderSelection, BorderStyle},
    A1Selection,
};

impl GridController {
    pub fn set_borders(
        &mut self,
        selection: A1Selection,
        border_selection: BorderSelection,
        style: Option<BorderStyle>,
        cursor: Option<String>,
    ) {
        if let Some(ops) =
            self.set_borders_a1_selection_operations(selection, border_selection, style)
        {
            self.start_user_transaction(ops, cursor, TransactionName::SetBorders);
        }
    }
}

#[cfg(test)]
mod tests {
    use crate::grid::sheet::borders::{BorderSelection, BorderStyle};

    use super::*;

    use serial_test::serial;

    #[test]
    #[serial]
    fn set_borders() {
        let mut gc = GridController::test();
        let sheet_id = gc.sheet_ids()[0];

        gc.set_borders(
            A1Selection::test_a1("A1:C3"),
            BorderSelection::All,
            Some(BorderStyle::default()),
            None,
        );

        let sheet = gc.sheet(sheet_id);
        let borders = sheet.borders.borders_in_sheet().unwrap();
        assert_eq!(borders.horizontal.unwrap().len(), 4);
        assert_eq!(borders.vertical.unwrap().len(), 4);
    }
}
