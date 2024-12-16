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
            self.set_borders_a1_selection_operations(selection, border_selection, style, true)
        {
            self.start_user_transaction(ops, cursor, TransactionName::SetBorders);
        }
    }
}

#[cfg(test)]
#[serial_test::parallel]
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

    #[test]
    fn test_clear_format_borders() {
        let mut gc = GridController::test();
        let sheet_id = gc.sheet_ids()[0];
        gc.set_borders(
            A1Selection::test_a1("A1:B2"),
            BorderSelection::All,
            Some(BorderStyle::default()),
            None,
        );
        let sheet = gc.sheet(sheet_id);
        assert!(sheet.borders.horizontal_borders().is_some());
        assert!(sheet.borders.vertical_borders().is_some());

        gc.clear_format_borders(&A1Selection::test_a1("A1:B2"), None);

        let sheet = gc.sheet(sheet_id);
        assert!(sheet.borders.horizontal_borders().is_none());
        assert!(sheet.borders.vertical_borders().is_none());
    }

    #[test]
    fn test_clear_borders_all() {
        let mut gc = GridController::test();
        let sheet_id = gc.sheet_ids()[0];
        gc.set_borders(
            A1Selection::test_a1("A1:B2"),
            BorderSelection::All,
            Some(BorderStyle::default()),
            None,
        );
        let sheet = gc.sheet(sheet_id);
        assert!(sheet.borders.horizontal_borders().is_some());
        assert!(sheet.borders.vertical_borders().is_some());

        gc.clear_format_borders(&A1Selection::test_a1("*"), None);

        let sheet = gc.sheet(sheet_id);
        assert!(sheet.borders.horizontal_borders().is_none());
        assert!(sheet.borders.vertical_borders().is_none());
    }

    #[test]
    fn test_clear_borders() {
        let mut gc = GridController::test();
        let sheet_id = gc.sheet_ids()[0];
        gc.set_borders(
            A1Selection::test_a1("B3:D5"),
            BorderSelection::All,
            Some(BorderStyle::default()),
            None,
        );
        let sheet = gc.sheet(sheet_id);
        assert!(sheet.borders.horizontal_borders().is_some());
        assert!(sheet.borders.vertical_borders().is_some());

        gc.set_borders(
            A1Selection::test_a1("B3:D5"),
            BorderSelection::Clear,
            None,
            None,
        );
        let sheet = gc.sheet(sheet_id);
        assert!(sheet.borders.horizontal_borders().is_none());
        assert!(sheet.borders.vertical_borders().is_none());
    }

    #[test]
    fn test_toggle_borders_single() {
        let mut gc = GridController::test();
        let sheet_id = gc.sheet_ids()[0];
        gc.set_borders(
            A1Selection::test_a1("B2"),
            BorderSelection::All,
            Some(BorderStyle::default()),
            None,
        );
        let sheet = gc.sheet(sheet_id);
        assert!(sheet.borders.horizontal_borders().is_some());
        assert!(sheet.borders.vertical_borders().is_some());

        gc.set_borders(A1Selection::test_a1("B2"), BorderSelection::All, None, None);
        let sheet = gc.sheet(sheet_id);
        assert!(sheet.borders.horizontal_borders().is_none());
        assert!(sheet.borders.vertical_borders().is_none());
    }

    #[test]
    fn test_toggle_borders_multiple() {
        let mut gc = GridController::test();
        let sheet_id = gc.sheet_ids()[0];
        gc.set_borders(
            A1Selection::test_a1("A1:B2"),
            BorderSelection::All,
            Some(BorderStyle::default()),
            None,
        );
        let sheet = gc.sheet(sheet_id);
        assert!(sheet.borders.horizontal_borders().is_some());
        assert!(sheet.borders.vertical_borders().is_some());

        gc.set_borders(
            A1Selection::test_a1("A1:B2"),
            BorderSelection::All,
            None,
            None,
        );
        let sheet = gc.sheet(sheet_id);
        assert!(sheet.borders.horizontal_borders().is_none());
        assert!(sheet.borders.vertical_borders().is_none());
    }

    #[test]
    fn test_toggle_borders_multiple_different_border_selection() {
        let mut gc = GridController::test();
        let sheet_id = gc.sheet_ids()[0];
        gc.set_borders(
            A1Selection::test_a1("A1:B2"),
            BorderSelection::Outer,
            Some(BorderStyle::default()),
            None,
        );
        let sheet = gc.sheet(sheet_id);
        assert!(sheet.borders.horizontal_borders().is_some());
        assert!(sheet.borders.vertical_borders().is_some());

        gc.set_borders(
            A1Selection::test_a1("A1:B2"),
            BorderSelection::All,
            Some(BorderStyle::default()),
            None,
        );
        let sheet = gc.sheet(sheet_id);
        assert!(sheet.borders.horizontal_borders().is_some());
        assert!(sheet.borders.vertical_borders().is_some());
    }
}
