#[cfg(test)]
mod ControllerTests {
    use crate::{
        controller::{GridController, TransactionSummary},
        Rect,
    };
    use crate::{
        grid::{SheetId, TextColor},
        CellValue, Pos,
    };

    #[test]
    fn test_set_cell_value_undo_redo() {
        let mut g = GridController::new();
        let sheet_id = g.grid.sheets()[0].id;
        let pos = Pos { x: 3, y: 6 };
        let get_the_cell =
            |g: &GridController| g.sheet(sheet_id).get_cell_value(pos).unwrap_or_default();
        let expected_summary = Some(TransactionSummary {
            cell_regions_modified: vec![(sheet_id, Rect::single_pos(pos))],
            ..Default::default()
        });

        assert_eq!(get_the_cell(&g), CellValue::Blank);
        g.set_cell_value(sheet_id, pos, "a".into(), None);
        assert_eq!(get_the_cell(&g), "a".into());
        g.set_cell_value(sheet_id, pos, "b".into(), None);
        assert_eq!(get_the_cell(&g), "b".into());
        assert!(g.undo(None) == expected_summary);
        assert_eq!(get_the_cell(&g), "a".into());
        assert!(g.redo(None) == expected_summary);
        assert_eq!(get_the_cell(&g), "b".into());
        assert!(g.undo(None) == expected_summary);
        assert_eq!(get_the_cell(&g), "a".into());
        assert!(g.undo(None) == expected_summary);
        assert_eq!(get_the_cell(&g), CellValue::Blank);
        assert!(g.undo(None).is_none());
        assert_eq!(get_the_cell(&g), CellValue::Blank);
        assert!(g.redo(None) == expected_summary);
        assert_eq!(get_the_cell(&g), "a".into());
        assert!(g.redo(None) == expected_summary);
        assert_eq!(get_the_cell(&g), "b".into());
        assert!(g.redo(None).is_none());
        assert_eq!(get_the_cell(&g), "b".into());
    }

    #[test]
    fn test_set_cell_text_color_undo_redo() {
        let mut g = GridController::new();
        let sheet_id = g.grid.sheets()[0].id;
        let pos1 = Pos { x: 3, y: 6 };
        let pos2 = Pos { x: 5, y: 8 };
        let pos3 = Pos { x: 9, y: 6 };
        let rect1 = Rect::new_span(pos1, pos2);
        let rect2 = Rect::new_span(pos2, pos3);

        let get = |g: &GridController, pos: Pos| {
            g.sheet(sheet_id)
                .get_formatting_value::<TextColor>(pos)
                .unwrap_or_default()
        };

        let expected_summary = |rect| TransactionSummary {
            cell_regions_modified: vec![(sheet_id, rect)],
            ..Default::default()
        };

        assert_eq!(get(&g, pos1), "");
        assert_eq!(get(&g, pos2), "");
        assert_eq!(get(&g, pos3), "");
        assert_eq!(
            g.set_cell_text_color(sheet_id, rect1, Some("blue".to_string()), None),
            expected_summary(rect1),
        );
        println!("{:#?}", g);
        assert_eq!(get(&g, pos1), "blue");
        assert_eq!(get(&g, pos2), "blue");
        assert_eq!(get(&g, pos3), "");
        assert_eq!(
            g.set_cell_text_color(sheet_id, rect2, Some("red".to_string()), None),
            expected_summary(rect2),
        );
        assert_eq!(get(&g, pos1), "blue");
        assert_eq!(get(&g, pos2), "red");
        assert_eq!(get(&g, pos3), "red");
        assert_eq!(g.undo(None), Some(expected_summary(rect2)));
        assert_eq!(get(&g, pos1), "blue");
        assert_eq!(get(&g, pos2), "blue");
        assert_eq!(get(&g, pos3), "");
        assert_eq!(g.undo(None), Some(expected_summary(rect1)));
        assert_eq!(get(&g, pos1), "");
        assert_eq!(get(&g, pos2), "");
        assert_eq!(get(&g, pos3), "");
        assert_eq!(g.redo(None), Some(expected_summary(rect1)));
        assert_eq!(get(&g, pos1), "blue");
        assert_eq!(get(&g, pos2), "blue");
        assert_eq!(get(&g, pos3), "");
        assert_eq!(g.redo(None), Some(expected_summary(rect2)));
        assert_eq!(get(&g, pos1), "blue");
        assert_eq!(get(&g, pos2), "red");
        assert_eq!(get(&g, pos3), "red");
    }

    #[test]
    fn test_add_delete_reorder_sheets() {
        let mut g = GridController::new();
        g.add_sheet(None);
        g.add_sheet(None);
        let old_sheet_ids = g.sheet_ids();
        let s1 = old_sheet_ids[0];
        let s2 = old_sheet_ids[1];
        let s3 = old_sheet_ids[2];

        let mut test_reorder = |a, b, expected: [SheetId; 3]| {
            g.move_sheet(a, b, None);
            assert_eq!(expected.to_vec(), g.sheet_ids());
            g.undo(None);
            assert_eq!(old_sheet_ids, g.sheet_ids());
        };

        test_reorder(s1, Some(s2), [s1, s2, s3]);
        test_reorder(s1, Some(s3), [s2, s1, s3]);
        test_reorder(s1, None, [s2, s3, s1]);
        test_reorder(s2, Some(s1), [s2, s1, s3]);
        test_reorder(s2, Some(s3), [s1, s2, s3]);
        test_reorder(s2, None, [s1, s3, s2]);
        test_reorder(s3, Some(s1), [s3, s1, s2]);
        test_reorder(s3, Some(s2), [s1, s3, s2]);
        test_reorder(s3, None, [s1, s2, s3]);

        let mut test_delete = |a, expected: [SheetId; 2]| {
            g.delete_sheet(a, None);
            assert_eq!(expected.to_vec(), g.sheet_ids());
            g.undo(None);
            assert_eq!(old_sheet_ids, g.sheet_ids());
        };

        test_delete(s1, [s2, s3]);
        test_delete(s2, [s1, s3]);
        test_delete(s3, [s1, s2]);
    }

    #[test]
    fn test_duplicate_sheet() {
        let mut g = GridController::new();
        let old_sheet_ids = g.sheet_ids();
        let s1 = old_sheet_ids[0];

        g.set_sheet_name(s1, String::from("Nice Name"), None);
        g.duplicate_sheet(s1, None);
        let sheet_ids = g.sheet_ids();
        let s2 = sheet_ids[1];

        let sheet1 = g.sheet(s1);
        let sheet2 = g.sheet(s2);

        assert_eq!(sheet2.name, format!("{} Copy", sheet1.name));
    }

    #[test]
    fn test_delete_last_sheet() {
        let mut g = GridController::new();
        let sheet_ids = g.sheet_ids();
        let first_sheet_id = sheet_ids[0].clone();

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

    // fn test_render_fill() {
    //     let mut g = GridController::new();
    //     let sheet_id = g.sheet_ids()[0];
    //     g.grid.set_cell_fill_color(
    //         &sheet_id,
    //         &Rect {
    //             min: Pos { x: 1, y: 1 },
    //             max: Pos { x: 10, y: 10 },
    //         },
    //         "blue".to_string(),
    //     );
    //     g.grid.set_cell_fill_color(
    //         &sheet_id,
    //         &Rect {
    //             min: Pos { x: 1, y: 15 },
    //             max: Pos { x: 10, y: 20 },
    //         },
    //         "blue".to_string(),
    //     );
    //     g.grid.set_cell_fill_color(
    //         &sheet_id,
    //         &Rect {
    //             min: Pos { x: 1, y: 10 },
    //             max: Pos { x: 10, y: 15 },
    //         },
    //         "blue".to_string(),
    //     );
    //     let render_fills = g.sheet(sheet_id).get_render_fills(Rect {
    //         min: Pos { x: -100, y: -100 },
    //         max: Pos { x: 100, y: 100 },
    //     });
    //     assert_eq!(10, render_fills.len())
    // }
}
