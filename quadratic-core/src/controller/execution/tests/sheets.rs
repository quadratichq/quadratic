#[cfg(test)]
mod tests {
    use crate::controller::GridController;

    #[test]
    fn test_add_sheet() {
        let mut gc = GridController::new();
        let summary = gc.add_sheet(None);
        assert_eq!(gc.grid.sheets().len(), 2);
        assert_eq!(summary.save, true);
        assert_eq!(summary.sheet_list_modified, true);
        gc.undo(None);
        assert_eq!(gc.grid.sheets().len(), 1);
        assert_eq!(summary.save, true);
        assert_eq!(summary.sheet_list_modified, true);
    }

    #[test]
    fn test_delete_sheet() {
        let mut gc = GridController::new();
        let sheet_id = gc.sheet_ids()[0];
        let summary = gc.delete_sheet(sheet_id, None);
        assert_eq!(gc.grid.sheets().len(), 1);
        assert_eq!(summary.save, true);
        assert_eq!(summary.sheet_list_modified, true);
        gc.undo(None);
        assert_eq!(gc.grid.sheets().len(), 1);
        assert_eq!(gc.grid.sheets()[0].id, sheet_id);
        assert_eq!(summary.save, true);
        assert_eq!(summary.sheet_list_modified, true);
    }

    #[test]
    fn test_execute_operation_set_sheet_name() {
        let mut gc = GridController::new();
        let sheet_id = gc.sheet_ids()[0];
        let name = "new name".to_string();
        let summary = gc.set_sheet_name(sheet_id, name.clone(), None);
        assert_eq!(gc.grid.sheets()[0].name, name);
        assert_eq!(summary.save, true);
        assert_eq!(summary.sheet_list_modified, true);
        gc.undo(None);
        assert_eq!(gc.grid.sheets()[0].name, "Sheet 1".to_string());
        assert_eq!(summary.save, true);
        assert_eq!(summary.sheet_list_modified, true);
    }

    #[test]
    fn test_set_sheet_color() {
        let mut gc = GridController::new();
        let sheet_id = gc.sheet_ids()[0];
        let color = Some("red".to_string());
        let summary = gc.set_sheet_color(sheet_id, color.clone(), None);
        assert_eq!(gc.grid.sheets()[0].color, color);
        assert_eq!(summary.save, true);
        assert_eq!(summary.sheet_list_modified, true);
        gc.undo(None);
        assert_eq!(gc.grid.sheets()[0].color, None);
        assert_eq!(summary.save, true);
        assert_eq!(summary.sheet_list_modified, true);
    }

    #[test]
    fn test_sheet_reorder() {
        let mut gc = GridController::new();
        let sheet_id = gc.sheet_ids()[0];
        gc.add_sheet(None);
        assert_eq!(gc.grid.sheets().len(), 2);
        let sheet_id2 = gc.sheet_ids()[1];
        let summary = gc.move_sheet(sheet_id, None, None);
        assert_eq!(gc.grid.sheets()[0].id, sheet_id2);
        assert_eq!(gc.grid.sheets()[1].id, sheet_id);
        assert_eq!(summary.save, true);
        assert_eq!(summary.sheet_list_modified, true);
        gc.undo(None);
        assert_eq!(gc.grid.sheets()[0].id, sheet_id);
        assert_eq!(gc.grid.sheets()[1].id, sheet_id2);
        assert_eq!(summary.save, true);
        assert_eq!(summary.sheet_list_modified, true);
        let summary = gc.move_sheet(sheet_id2, Some(sheet_id), None);
        assert_eq!(gc.grid.sheets()[0].id, sheet_id2);
        assert_eq!(gc.grid.sheets()[1].id, sheet_id);
        assert_eq!(summary.save, true);
        assert_eq!(summary.sheet_list_modified, true);
        gc.undo(None);
        assert_eq!(gc.grid.sheets()[0].id, sheet_id);
        assert_eq!(gc.grid.sheets()[1].id, sheet_id2);
        assert_eq!(summary.save, true);
        assert_eq!(summary.sheet_list_modified, true);
    }
}
