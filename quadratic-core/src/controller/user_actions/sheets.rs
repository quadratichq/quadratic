use crate::{
    controller::{active_transactions::transaction_name::TransactionName, GridController},
    grid::SheetId,
};

impl GridController {
    pub fn set_sheet_name(&mut self, sheet_id: SheetId, name: String, cursor: Option<String>) {
        let ops = self.set_sheet_name_operations(sheet_id, name);
        self.start_user_transaction(ops, cursor, TransactionName::SetSheetMetadata);
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

    pub fn add_sheet(&mut self, cursor: Option<String>) {
        let ops = self.add_sheet_operations(None);
        self.start_user_transaction(ops, cursor, TransactionName::SheetAdd);
    }

    pub fn add_sheet_with_name(&mut self, name: String, cursor: Option<String>) {
        let ops = self.add_sheet_operations(Some(name));
        self.start_user_transaction(ops, cursor, TransactionName::SheetAdd);
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
    pub fn duplicate_sheet(&mut self, sheet_id: SheetId, cursor: Option<String>) {
        let ops = self.duplicate_sheet_operations(sheet_id);
        self.start_user_transaction(ops, cursor, TransactionName::DuplicateSheet);
    }
}

#[cfg(test)]
mod test {
    use crate::{
        color::Rgba,
        controller::GridController,
        grid::{BorderSelection, BorderStyle, CellBorderLine, CodeCellLanguage, SheetId},
        wasm_bindings::{
            controller::sheet_info::SheetInfo,
            js::{clear_js_calls, expect_js_call},
        },
        CellValue, SheetPos, SheetRect,
    };
    use bigdecimal::BigDecimal;
    use serial_test::serial;

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
    #[serial]
    fn test_duplicate_sheet() {
        clear_js_calls();

        let mut gc = GridController::test();
        let sheet_id = gc.sheet_ids()[0];

        gc.set_sheet_name(sheet_id, "Nice Name".into(), None);
        gc.set_code_cell(
            SheetPos {
                sheet_id,
                x: 0,
                y: 0,
            },
            CodeCellLanguage::Formula,
            "10 + 10".to_string(),
            None,
        );
        gc.set_cell_fill_color((1, 1, 1, 1, sheet_id).into(), Some("red".to_string()), None);
        gc.set_borders(
            SheetRect::single_pos((2, 2).into(), sheet_id),
            vec![BorderSelection::Top, BorderSelection::Left],
            Some(BorderStyle {
                color: Rgba::default(),
                line: CellBorderLine::Line1,
            }),
            None,
        );

        gc.duplicate_sheet(sheet_id, None);
        assert_eq!(gc.grid.sheets().len(), 2);
        assert_eq!(gc.grid.sheets()[1].name, "Nice Name Copy");
        let duplicated_sheet_id = gc.grid.sheets()[1].id;
        let sheet_info = SheetInfo::from(gc.sheet(duplicated_sheet_id));
        expect_js_call(
            "jsAddSheet",
            format!("{},{}", serde_json::to_string(&sheet_info).unwrap(), true),
            false,
        );
        // should send sheet fills for the duplicated sheet
        expect_js_call(
            "jsSheetFills",
            format!(
                "{},{}",
                duplicated_sheet_id, r#"[{"x":1,"y":1,"w":1,"h":1,"color":"red"}]"#
            ),
            false,
        );
        // should send borders for the duplicated sheet
        let borders = gc.sheet(duplicated_sheet_id).render_borders();
        expect_js_call(
            "jsSheetBorders",
            format!(
                "{},{}",
                duplicated_sheet_id,
                serde_json::to_string(&borders).unwrap()
            ),
            false,
        );
        // code cells should rerun and send updated code cell
        let sheet_pos = SheetPos {
            sheet_id,
            x: 0,
            y: 0,
        };
        let code_cell = gc
            .sheet(duplicated_sheet_id)
            .edit_code_value(sheet_pos.into())
            .unwrap();
        let render_code_cell = gc
            .sheet(duplicated_sheet_id)
            .get_render_code_cell(sheet_pos.into())
            .unwrap();
        expect_js_call(
            "jsUpdateCodeCell",
            format!(
                "{},{},{},{:?},{:?}",
                sheet_id,
                sheet_pos.x,
                sheet_pos.y,
                Some(serde_json::to_string(&code_cell).unwrap()),
                Some(serde_json::to_string(&render_code_cell).unwrap())
            ),
            true,
        );

        gc.undo(None);
        assert_eq!(gc.grid.sheets().len(), 1);
        expect_js_call(
            "jsDeleteSheet",
            format!("{},{}", duplicated_sheet_id, true),
            true,
        );

        gc.duplicate_sheet(sheet_id, None);
        assert_eq!(gc.grid.sheets().len(), 2);
        let duplicated_sheet_id2 = gc.grid.sheets()[1].id;
        let sheet_info = SheetInfo::from(gc.sheet(duplicated_sheet_id2));
        expect_js_call(
            "jsAddSheet",
            format!("{},{}", serde_json::to_string(&sheet_info).unwrap(), true),
            true,
        );

        gc.duplicate_sheet(sheet_id, None);
        assert_eq!(gc.grid.sheets().len(), 3);
        assert_eq!(gc.grid.sheets()[1].name, "Nice Name Copy (1)");
        assert_eq!(gc.grid.sheets()[2].name, "Nice Name Copy");
        let duplicated_sheet_id3 = gc.grid.sheets()[1].id;
        let sheet_info = SheetInfo::from(gc.sheet(duplicated_sheet_id3));
        expect_js_call(
            "jsAddSheet",
            format!("{},{}", serde_json::to_string(&sheet_info).unwrap(), true),
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
            format!("{},{}", serde_json::to_string(&sheet_info).unwrap(), true),
            true,
        );
    }

    #[test]
    #[serial]
    fn test_duplicate_sheet_code_rerun() {
        clear_js_calls();

        let mut gc = GridController::test();
        let sheet_id = gc.sheet_ids()[0];

        gc.set_cell_value(
            SheetPos {
                sheet_id,
                x: 0,
                y: 0,
            },
            "1".to_string(),
            None,
        );
        gc.set_cell_value(
            SheetPos {
                sheet_id,
                x: 0,
                y: 1,
            },
            "1".to_string(),
            None,
        );
        gc.set_code_cell(
            SheetPos {
                sheet_id,
                x: 1,
                y: 0,
            },
            CodeCellLanguage::Formula,
            "A0 + A1".to_string(),
            None,
        );
        assert_eq!(
            gc.sheet(sheet_id).get_code_cell_value((1, 0).into()),
            Some(CellValue::Number(BigDecimal::from(2)))
        );

        gc.duplicate_sheet(sheet_id, None);
        assert_eq!(gc.grid.sheets().len(), 2);
        assert_eq!(gc.grid.sheets()[1].name, "Sheet 1 Copy");
        let duplicated_sheet_id = gc.grid.sheets()[1].id;
        let sheet_info = SheetInfo::from(gc.sheet(duplicated_sheet_id));
        expect_js_call(
            "jsAddSheet",
            format!("{},{}", serde_json::to_string(&sheet_info).unwrap(), true),
            true,
        );

        // update dependent cell value in original sheet
        // only the original sheet's code result should update
        gc.set_cell_value(
            SheetPos {
                sheet_id,
                x: 0,
                y: 0,
            },
            "2".to_string(),
            None,
        );
        assert_eq!(
            gc.sheet(sheet_id).get_code_cell_value((1, 0).into()),
            Some(CellValue::Number(BigDecimal::from(3)))
        );
        assert_eq!(
            gc.sheet(duplicated_sheet_id)
                .get_code_cell_value((1, 0).into()),
            Some(CellValue::Number(BigDecimal::from(2)))
        );

        // update dependent cell value in duplicate sheet
        // only the duplicate sheet's code result should update
        gc.set_cell_value(
            SheetPos {
                sheet_id: duplicated_sheet_id,
                x: 0,
                y: 0,
            },
            "3".to_string(),
            None,
        );
        assert_eq!(
            gc.sheet(sheet_id).get_code_cell_value((1, 0).into()),
            Some(CellValue::Number(BigDecimal::from(3)))
        );
        assert_eq!(
            gc.sheet(duplicated_sheet_id)
                .get_code_cell_value((1, 0).into()),
            Some(CellValue::Number(BigDecimal::from(4)))
        );
    }
}
