use crate::{
    controller::{GridController, active_transactions::transaction_name::TransactionName},
    grid::{SheetId, js_types::JsSheetNameToColor},
};

impl GridController {
    pub fn set_sheet_name(&mut self, sheet_id: SheetId, name: String, cursor: Option<String>) {
        let ops = self.set_sheet_name_operations(sheet_id, name);
        self.start_user_transaction(ops, cursor, TransactionName::SetSheetMetadata);
    }

    pub fn server_set_sheet_name(&mut self, sheet_id: SheetId, name: String) {
        let ops = self.set_sheet_name_operations(sheet_id, name);
        self.server_apply_transaction(ops, None);
    }

    pub fn set_sheet_color(
        &mut self,
        sheet_id: SheetId,
        color: Option<String>,
        cursor: Option<String>,
    ) {
        let ops = self.set_sheet_color_operations(sheet_id, color);
        self.start_user_transaction(ops, cursor, TransactionName::SetSheetMetadata);
    }

    pub fn set_sheet_colors(
        &mut self,
        sheet_name_to_color: Vec<JsSheetNameToColor>,
        cursor: Option<String>,
    ) {
        let ops = self.set_sheet_colors_operations(sheet_name_to_color);
        self.start_user_transaction(ops, cursor, TransactionName::SetSheetMetadata);
    }

    pub fn add_sheet(
        &mut self,
        name: Option<String>,
        insert_before_sheet_name: Option<String>,
        cursor: Option<String>,
    ) {
        let ops = self.add_sheet_operations(name, insert_before_sheet_name);
        self.start_user_transaction(ops, cursor, TransactionName::SheetAdd);
    }

    pub fn add_sheet_with_name(&mut self, name: String, cursor: Option<String>) {
        let ops = self.add_sheet_operations(Some(name), None);
        self.start_user_transaction(ops, cursor, TransactionName::SheetAdd);
    }

    pub fn server_add_sheet_with_name(&mut self, name: String) {
        let ops = self.add_sheet_operations(Some(name), None);
        self.server_apply_transaction(ops, None);
    }

    pub fn delete_sheet(&mut self, sheet_id: SheetId, cursor: Option<String>) {
        let ops = self.delete_sheet_operations(sheet_id);
        self.start_user_transaction(ops, cursor, TransactionName::SheetDelete);
    }
    pub fn move_sheet(
        &mut self,
        sheet_id: SheetId,
        to_before: Option<SheetId>,
        cursor: Option<String>,
    ) {
        let ops = self.move_sheet_operations(sheet_id, to_before);
        self.start_user_transaction(ops, cursor, TransactionName::SetSheetMetadata);
    }
    pub fn duplicate_sheet(
        &mut self,
        sheet_id: SheetId,
        name_of_new_sheet: Option<String>,
        cursor: Option<String>,
    ) {
        let ops = self.duplicate_sheet_operations(sheet_id, name_of_new_sheet);
        self.start_user_transaction(ops, cursor, TransactionName::DuplicateSheet);
    }
}

#[cfg(test)]
mod test {
    use crate::{
        CellValue, SheetPos,
        a1::A1Selection,
        constants::SHEET_NAME,
        controller::GridController,
        grid::{
            CodeCellLanguage, SheetId,
            js_types::{JsSheetNameToColor, JsUpdateCodeCell},
            sheet::borders::{BorderSelection, BorderStyle},
        },
        wasm_bindings::{
            controller::sheet_info::SheetInfo,
            js::{clear_js_calls, expect_js_call},
        },
    };

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
        assert_eq!(sheet.name, SHEET_NAME.to_owned() + "1");

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
    fn test_set_sheet_colors() {
        let mut g = GridController::test();
        let old_sheet_ids = g.sheet_ids();
        let s1 = old_sheet_ids[0];

        // Add a second sheet for testing multiple colors
        g.add_sheet_with_name("Sheet2".into(), None);
        let s2 = g.sheet_ids()[1];

        // Set initial colors
        g.set_sheet_color(s1, Some(String::from("blue")), None);
        g.set_sheet_color(s2, Some(String::from("green")), None);

        // Test setting multiple sheet colors at once
        let sheet_name_to_color = vec![
            JsSheetNameToColor {
                sheet_name: g.sheet(s1).name.clone(),
                color: String::from("red"),
            },
            JsSheetNameToColor {
                sheet_name: g.sheet(s2).name.clone(),
                color: String::from("yellow"),
            },
        ];
        g.set_sheet_colors(sheet_name_to_color, None);

        // Verify colors were set correctly
        assert_eq!(g.sheet(s1).color, Some(String::from("red")));
        assert_eq!(g.sheet(s2).color, Some(String::from("yellow")));

        // Test undo
        g.undo(None);
        assert_eq!(g.sheet(s1).color, Some(String::from("blue")));
        assert_eq!(g.sheet(s2).color, Some(String::from("green")));

        // Test redo
        g.redo(None);
        assert_eq!(g.sheet(s1).color, Some(String::from("red")));
        assert_eq!(g.sheet(s2).color, Some(String::from("yellow")));

        // Test setting colors for non-existent sheets (should not affect existing sheets)
        let invalid_sheet_name_to_color = vec![
            JsSheetNameToColor {
                sheet_name: "NonExistentSheet".to_string(),
                color: String::from("purple"),
            },
            JsSheetNameToColor {
                sheet_name: g.sheet(s1).name.clone(),
                color: String::from("orange"),
            },
        ];
        g.set_sheet_colors(invalid_sheet_name_to_color, None);

        // Only the existing sheet should be affected
        assert_eq!(g.sheet(s1).color, Some(String::from("orange")));
        assert_eq!(g.sheet(s2).color, Some(String::from("yellow")));

        // Test setting empty HashMap (should not change anything)
        let empty_sheet_name_to_color = vec![];
        g.set_sheet_colors(empty_sheet_name_to_color, None);

        // Colors should remain unchanged
        assert_eq!(g.sheet(s1).color, Some(String::from("orange")));
        assert_eq!(g.sheet(s2).color, Some(String::from("yellow")));
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
        g.add_sheet(None, None, None);
        g.move_sheet(SheetId::new(), None, None);
    }

    #[test]
    fn test_add_delete_reorder_sheets() {
        let mut g = GridController::test();
        g.add_sheet(None, None, None);
        g.add_sheet_with_name("test".into(), None);
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

    #[test]
    fn duplicate_sheet() {
        let mut gc = GridController::test();
        let sheet_id = gc.sheet_ids()[0];

        gc.set_sheet_name(sheet_id, "Nice Name".into(), None);
        gc.set_code_cell(
            SheetPos {
                sheet_id,
                x: 1,
                y: 1,
            },
            CodeCellLanguage::Formula,
            "10 + 10".to_string(),
            None,
            None,
        );
        gc.set_fill_color(&A1Selection::test_a1("A1"), Some("red".to_string()), None)
            .unwrap();

        gc.set_borders(
            A1Selection::test_a1("B2"),
            BorderSelection::Top,
            Some(BorderStyle::default()),
            None,
        );

        clear_js_calls();

        gc.duplicate_sheet(sheet_id, None, None);
        assert_eq!(gc.grid.sheets().len(), 2);
        assert_eq!(gc.grid.sheets()[1].name, "Nice Name Copy");

        let duplicated_sheet_id = gc.grid.sheets()[1].id;
        let sheet_info = SheetInfo::from(gc.sheet(duplicated_sheet_id));
        expect_js_call(
            "jsAddSheet",
            format!("{:?},{}", serde_json::to_vec(&sheet_info).unwrap(), true),
            false,
        );
        // should send sheet fills for the duplicated sheet
        let fills = gc.sheet(duplicated_sheet_id).get_all_render_fills();
        expect_js_call(
            "jsSheetFills",
            format!(
                "{},{:?}",
                duplicated_sheet_id,
                serde_json::to_vec(&fills).unwrap()
            ),
            false,
        );
        // should send borders for the duplicated sheet
        let borders = gc.sheet(duplicated_sheet_id).borders_in_sheet();
        let borders_str = serde_json::to_vec(&borders).unwrap();
        expect_js_call(
            "jsBordersSheet",
            format!("{duplicated_sheet_id},{borders_str:?}"),
            false,
        );
        // code cells should rerun and send updated code cell
        let sheet_pos = SheetPos {
            sheet_id,
            x: 1,
            y: 1,
        };

        let sheet = gc.sheet(duplicated_sheet_id);

        let update_code_cell = JsUpdateCodeCell {
            sheet_id: duplicated_sheet_id,
            pos: sheet_pos.into(),
            render_code_cell: sheet.get_render_code_cell(sheet_pos.into()),
        };

        expect_js_call(
            "jsUpdateCodeCells",
            format!("{:?}", serde_json::to_vec(&vec![update_code_cell]).unwrap()),
            true,
        );

        gc.undo(None);
        assert_eq!(gc.grid.sheets().len(), 1);
        expect_js_call(
            "jsDeleteSheet",
            format!("{},{}", duplicated_sheet_id, true),
            true,
        );

        gc.duplicate_sheet(sheet_id, None, None);
        assert_eq!(gc.grid.sheets().len(), 2);
        let duplicated_sheet_id2 = gc.grid.sheets()[1].id;
        let sheet_info = SheetInfo::from(gc.sheet(duplicated_sheet_id2));
        expect_js_call(
            "jsAddSheet",
            format!("{:?},{}", serde_json::to_vec(&sheet_info).unwrap(), true),
            true,
        );

        gc.duplicate_sheet(sheet_id, None, None);
        assert_eq!(gc.grid.sheets().len(), 3);
        assert_eq!(gc.grid.sheets()[1].name, "Nice Name Copy (1)");
        assert_eq!(gc.grid.sheets()[2].name, "Nice Name Copy");
        let duplicated_sheet_id3 = gc.grid.sheets()[1].id;
        let sheet_info = SheetInfo::from(gc.sheet(duplicated_sheet_id3));
        expect_js_call(
            "jsAddSheet",
            format!("{:?},{}", serde_json::to_vec(&sheet_info).unwrap(), true),
            true,
        );

        gc.undo(None);
        assert_eq!(gc.grid.sheets().len(), 2);
        assert_eq!(gc.grid.sheets()[1].name, "Nice Name Copy");
        expect_js_call(
            "jsDeleteSheet",
            format!("{},{}", duplicated_sheet_id3, true),
            true,
        );

        gc.redo(None);
        assert_eq!(gc.grid.sheets().len(), 3);
        assert_eq!(gc.grid.sheets()[1].name, "Nice Name Copy (1)");
        let sheet_info = SheetInfo::from(gc.sheet(duplicated_sheet_id3));
        expect_js_call(
            "jsAddSheet",
            format!("{:?},{}", serde_json::to_vec(&sheet_info).unwrap(), true),
            true,
        );
    }

    #[test]
    fn test_duplicate_sheet_code_rerun() {
        clear_js_calls();

        let mut gc = GridController::test();
        let sheet_id = gc.sheet_ids()[0];

        gc.set_cell_values(
            SheetPos {
                sheet_id,
                x: 1,
                y: 1,
            },
            vec![vec!["1".to_string()]],
            None,
        );
        gc.set_cell_values(
            SheetPos {
                sheet_id,
                x: 1,
                y: 2,
            },
            vec![vec!["1".to_string()]],
            None,
        );
        gc.set_code_cell(
            SheetPos {
                sheet_id,
                x: 2,
                y: 1,
            },
            CodeCellLanguage::Formula,
            "A1 + A2".to_string(),
            None,
            None,
        );
        assert_eq!(
            gc.sheet(sheet_id).get_code_cell_value((2, 1).into()),
            Some(CellValue::Number(2.into()))
        );

        gc.duplicate_sheet(sheet_id, None, None);
        assert_eq!(gc.grid.sheets().len(), 2);
        assert_eq!(gc.grid.sheets()[1].name, SHEET_NAME.to_owned() + "1 Copy");
        let duplicated_sheet_id = gc.grid.sheets()[1].id;
        let sheet_info = SheetInfo::from(gc.sheet(duplicated_sheet_id));
        expect_js_call(
            "jsAddSheet",
            format!("{:?},{}", serde_json::to_vec(&sheet_info).unwrap(), true),
            true,
        );

        // update dependent cell value in original sheet
        // only the original sheet's code result should update
        gc.set_cell_values(
            SheetPos {
                sheet_id,
                x: 1,
                y: 1,
            },
            vec![vec!["2".to_string()]],
            None,
        );
        assert_eq!(
            gc.sheet(sheet_id).get_code_cell_value((2, 1).into()),
            Some(CellValue::Number(3.into()))
        );
        assert_eq!(
            gc.sheet(duplicated_sheet_id)
                .get_code_cell_value((2, 1).into()),
            Some(CellValue::Number(2.into()))
        );

        // update dependent cell value in duplicate sheet
        // only the duplicate sheet's code result should update
        gc.set_cell_values(
            SheetPos {
                sheet_id: duplicated_sheet_id,
                x: 1,
                y: 1,
            },
            vec![vec!["3".to_string()]],
            None,
        );
        assert_eq!(
            gc.sheet(sheet_id).get_code_cell_value((2, 1).into()),
            Some(CellValue::Number(3.into()))
        );
        assert_eq!(
            gc.sheet(duplicated_sheet_id)
                .get_code_cell_value((2, 1).into()),
            Some(CellValue::Number(4.into()))
        );
    }
}
