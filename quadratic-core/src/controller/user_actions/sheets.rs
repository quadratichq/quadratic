use crate::{
    controller::{transaction_summary::TransactionSummary, GridController},
    grid::SheetId,
};

impl GridController {
    pub fn set_sheet_name(
        &mut self,
        sheet_id: SheetId,
        name: String,
        cursor: Option<String>,
    ) -> TransactionSummary {
        let ops = self.set_sheet_name_operations(sheet_id, name);
        self.start_user_transaction(ops, cursor)
    }

    pub fn set_sheet_color(
        &mut self,
        sheet_id: SheetId,
        color: Option<String>,
        cursor: Option<String>,
    ) -> TransactionSummary {
        let ops = self.set_sheet_color_operations(sheet_id, color);
        self.start_user_transaction(ops, cursor)
    }

    pub fn add_sheet(&mut self, cursor: Option<String>) -> TransactionSummary {
        let ops = self.add_sheet_operations();
        self.start_user_transaction(ops, cursor)
    }
    pub fn delete_sheet(
        &mut self,
        sheet_id: SheetId,
        cursor: Option<String>,
    ) -> TransactionSummary {
        let ops = self.delete_sheet_operations(sheet_id);
        self.start_user_transaction(ops, cursor)
    }
    pub fn move_sheet(
        &mut self,
        sheet_id: SheetId,
        to_before: Option<SheetId>,
        cursor: Option<String>,
    ) -> TransactionSummary {
        let ops = self.move_sheet_operations(sheet_id, to_before);
        self.start_user_transaction(ops, cursor)
    }
    pub fn duplicate_sheet(
        &mut self,
        sheet_id: SheetId,
        cursor: Option<String>,
    ) -> TransactionSummary {
        let ops = self.duplicate_sheet_operations(sheet_id);
        self.start_user_transaction(ops, cursor)
    }
}

#[cfg(test)]
mod test {
    use crate::{controller::GridController, grid::SheetId};

    #[test]
    fn test_set_sheet_name() {
        let mut g = GridController::test();
        let old_sheet_ids = g.sheet_ids();
        let s1 = old_sheet_ids[0];

        g.set_sheet_name(s1, String::from("Nice Name"), None);
        let sheet = g.sheet(s1);
        assert_eq!(sheet.name, "Nice Name");

        g.undo(None);
        let sheet = g.sheet(s1);
        assert_eq!(sheet.name, "Sheet 1");

        g.redo(None);
        let sheet = g.sheet(s1);
        assert_eq!(sheet.name, "Nice Name");

        g.set_sheet_name(SheetId::new(), String::from("Should not do anything"), None);
        let sheet = g.sheet(s1);
        assert_eq!(sheet.name, "Nice Name");
    }

    #[test]
    fn test_set_sheet_color() {
        let mut g = GridController::test();
        let old_sheet_ids = g.sheet_ids();
        let s1 = old_sheet_ids[0];

        g.set_sheet_color(s1, Some(String::from("red")), None);
        let sheet = g.sheet(s1);
        assert_eq!(sheet.color, Some(String::from("red")));

        g.undo(None);
        let sheet = g.sheet(s1);
        assert_eq!(sheet.color, None);

        g.redo(None);
        let sheet = g.sheet(s1);
        assert_eq!(sheet.color, Some(String::from("red")));

        g.set_sheet_color(
            SheetId::new(),
            Some(String::from("Should not do anything")),
            None,
        );
        let sheet = g.sheet(s1);
        assert_eq!(sheet.color, Some(String::from("red")));

        g.set_sheet_color(
            SheetId::new(),
            Some(String::from("Should not do anything")),
            None,
        );
        let sheet = g.sheet(s1);
        assert_eq!(sheet.color, Some(String::from("red")));
    }

    #[test]
    fn test_delete_sheet() {
        let mut g = GridController::test();
        let old_sheet_ids = g.sheet_ids();
        let s1 = old_sheet_ids[0];

        g.delete_sheet(s1, None);
        assert_eq!(g.sheet_ids().len(), 1);
        assert_ne!(g.sheet_ids()[0], s1);

        g.undo(None);
        assert_eq!(g.sheet_ids(), old_sheet_ids);

        g.redo(None);
        assert_eq!(g.sheet_ids().len(), 1);
        assert_ne!(g.sheet_ids()[0], s1);

        g.delete_sheet(SheetId::new(), None);
        assert_eq!(g.sheet_ids().len(), 1);
        assert_ne!(g.sheet_ids()[0], s1);
    }

    #[test]
    fn test_move_sheet_sheet_does_not_exist() {
        let mut g = GridController::test();
        g.add_sheet(None);
        g.move_sheet(SheetId::new(), None, None);
    }

    #[test]
    fn test_add_delete_reorder_sheets() {
        let mut g = GridController::test();
        g.add_sheet(None);
        g.add_sheet(None);
        let old_sheet_ids = g.sheet_ids();
        let s1 = old_sheet_ids[0];
        let s2 = old_sheet_ids[1];
        let s3 = old_sheet_ids[2];

        fn test_reorder(
            g: &mut GridController,
            a: SheetId,
            b: Option<SheetId>,
            expected: [SheetId; 3],
            old_sheet_ids: &Vec<SheetId>,
        ) {
            g.move_sheet(a, b, None);
            assert_eq!(expected.to_vec(), g.sheet_ids());
            g.undo(None);
            assert_eq!(*old_sheet_ids, g.sheet_ids());
        }

        test_reorder(&mut g, s1, Some(s2), [s1, s2, s3], &old_sheet_ids);
        test_reorder(&mut g, s1, Some(s3), [s2, s1, s3], &old_sheet_ids);
        test_reorder(&mut g, s1, None, [s2, s3, s1], &old_sheet_ids);
        test_reorder(&mut g, s2, Some(s1), [s2, s1, s3], &old_sheet_ids);
        test_reorder(&mut g, s2, Some(s3), [s1, s2, s3], &old_sheet_ids);
        test_reorder(&mut g, s2, None, [s1, s3, s2], &old_sheet_ids);
        test_reorder(&mut g, s3, Some(s1), [s3, s1, s2], &old_sheet_ids);
        test_reorder(&mut g, s3, Some(s2), [s1, s3, s2], &old_sheet_ids);
        test_reorder(&mut g, s3, None, [s1, s2, s3], &old_sheet_ids);

        fn test_delete(
            g: &mut GridController,
            a: SheetId,
            expected: [SheetId; 2],
            old_sheet_ids: &Vec<SheetId>,
        ) {
            g.delete_sheet(a, None);
            assert_eq!(expected.to_vec(), g.sheet_ids());
            g.undo(None);
            assert_eq!(*old_sheet_ids, g.sheet_ids());
        }

        test_delete(&mut g, s1, [s2, s3], &old_sheet_ids);
        test_delete(&mut g, s2, [s1, s3], &old_sheet_ids);
        test_delete(&mut g, s3, [s1, s2], &old_sheet_ids);
    }

    #[test]
    fn test_duplicate_sheet() {
        let mut g = GridController::test();
        let old_sheet_ids = g.sheet_ids();
        let s1 = old_sheet_ids[0];

        g.set_sheet_name(s1, String::from("Nice Name"), None);
        g.duplicate_sheet(s1, None);
        let sheet_ids = g.sheet_ids();
        let s2 = sheet_ids[1];

        let sheet1 = g.sheet(s1);
        let sheet2 = g.sheet(s2);

        assert_eq!(sheet2.name, format!("{} Copy", sheet1.name));

        g.duplicate_sheet(SheetId::new(), None);
    }

    #[test]
    fn test_delete_last_sheet() {
        let mut g = GridController::test();
        let sheet_ids = g.sheet_ids();
        let first_sheet_id = sheet_ids[0];

        g.delete_sheet(first_sheet_id, None);
        let new_sheet_ids = g.sheet_ids();
        assert_eq!(new_sheet_ids.len(), 1);
        assert_ne!(new_sheet_ids[0], sheet_ids[0]);

        g.undo(None);
        let new_sheet_ids_2 = g.sheet_ids();
        assert_eq!(sheet_ids[0], new_sheet_ids_2[0]);

        g.redo(None);
        let new_sheet_ids_3 = g.sheet_ids();
        assert_eq!(new_sheet_ids[0], new_sheet_ids_3[0]);
    }
}
