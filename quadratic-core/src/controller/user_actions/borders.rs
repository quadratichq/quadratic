use crate::controller::active_transactions::transaction_name::TransactionName;
use crate::controller::GridController;
use crate::grid::{BorderSelection, BorderStyle};
use crate::SheetRect;

impl GridController {
    pub fn set_borders(
        &mut self,
        sheet_rect: SheetRect,
        selections: Vec<BorderSelection>,
        style: Option<BorderStyle>,
        cursor: Option<String>,
    ) {
        let ops = self.set_borders_operations(sheet_rect, selections, style);
        self.start_user_transaction(ops, cursor, TransactionName::SetBorders);
    }
}

#[cfg(test)]
mod tests {
    use serial_test::serial;

    use crate::{
        color::Rgba,
        grid::{CellBorderLine, SheetId},
        selection::Selection,
        wasm_bindings::js::expect_js_call,
        Pos,
    };

    use super::*;

    #[test]
    fn test_set_borders() {
        let mut grid_controller = GridController::test();
        let sheet_id = grid_controller.grid.sheets()[0].id;
        let sheet_rect = SheetRect::single_pos(Pos { x: 0, y: 0 }, sheet_id);

        // apply top, left & right border
        let selections = vec![
            BorderSelection::Left,
            BorderSelection::Top,
            BorderSelection::Right,
        ];
        let style = Some(BorderStyle {
            color: Rgba::default(),
            line: CellBorderLine::Line1,
        });

        grid_controller.set_borders(sheet_rect, selections, style, None);

        let borders = grid_controller.grid.sheets()[0]
            .borders()
            .per_cell
            .borders
            .iter()
            .next()
            .unwrap()
            .1
            .blocks()
            .next()
            .unwrap()
            .content
            .value
            .borders;

        assert_eq!(borders.len(), 4);
        assert_eq!(borders[0], style);
        assert_eq!(borders[1], style);
        assert_eq!(borders[2], style);
        assert_eq!(borders[3], None);

        // toggle left border
        let selections = vec![BorderSelection::Left];

        grid_controller.set_borders(sheet_rect, selections, style, None);

        let borders = grid_controller.grid.sheets()[0]
            .borders()
            .per_cell
            .borders
            .iter()
            .next()
            .unwrap()
            .1
            .blocks()
            .next()
            .unwrap()
            .content
            .value
            .borders;

        assert_eq!(borders.len(), 4);
        assert_eq!(borders[0], None);
        assert_eq!(borders[1], style);
        assert_eq!(borders[2], style);
        assert_eq!(borders[3], None);

        // apply top & bottom border
        let selections = vec![BorderSelection::Bottom, BorderSelection::Top];

        grid_controller.set_borders(sheet_rect, selections, style, None);

        let borders = grid_controller.grid.sheets()[0]
            .borders()
            .per_cell
            .borders
            .iter()
            .next()
            .unwrap()
            .1
            .blocks()
            .next()
            .unwrap()
            .content
            .value
            .borders;

        assert_eq!(borders.len(), 4);
        assert_eq!(borders[0], None);
        assert_eq!(borders[1], style);
        assert_eq!(borders[2], style);
        assert_eq!(borders[3], style);

        // toggle top & right border
        let selections = vec![BorderSelection::Top, BorderSelection::Right];

        grid_controller.set_borders(sheet_rect, selections, style, None);

        let borders = grid_controller.grid.sheets()[0]
            .borders()
            .per_cell
            .borders
            .iter()
            .next()
            .unwrap()
            .1
            .blocks()
            .next()
            .unwrap()
            .content
            .value
            .borders;

        assert_eq!(borders.len(), 4);
        assert_eq!(borders[0], None);
        assert_eq!(borders[1], None);
        assert_eq!(borders[2], None);
        assert_eq!(borders[3], style);
    }

    #[test]
    fn test_set_borders_sheet_id_not_found() {
        let mut grid_controller = GridController::test();
        let sheet_rect = SheetRect::single_pos(Pos { x: 0, y: 0 }, SheetId::new());
        let selections = vec![BorderSelection::Top, BorderSelection::Left];
        let style = Some(BorderStyle {
            color: Rgba::default(),
            line: CellBorderLine::Line1,
        });
        grid_controller.set_borders(sheet_rect, selections, style, None);
    }

    #[test]
    #[serial]
    fn clear_borders() {
        let mut gc = GridController::test();
        let sheet_id = gc.sheet_ids()[0];
        let sheet_rect = SheetRect::single_pos(Pos { x: 0, y: 0 }, sheet_id);
        let selections = vec![BorderSelection::Top, BorderSelection::Left];
        let style = Some(BorderStyle {
            color: Rgba::default(),
            line: CellBorderLine::Line1,
        });
        gc.set_borders(sheet_rect, selections, style, None);

        let sheet = gc.sheet(sheet_id);
        let borders = sheet.render_borders();
        assert!(!borders.horizontal.is_empty());
        assert!(!borders.vertical.is_empty());
        expect_js_call(
            "jsSheetBorders",
            format!("{},{}", sheet.id, serde_json::to_string(&borders).unwrap()),
            true,
        );

        gc.clear_format(
            Selection {
                sheet_id: sheet_rect.sheet_id,
                rects: Some(vec![sheet_rect.into()]),
                ..Default::default()
            },
            None,
        )
        .unwrap();
        let sheet = gc.sheet(sheet_id);
        let borders = sheet.render_borders();
        assert!(borders.horizontal.is_empty());
        assert!(borders.vertical.is_empty());
        expect_js_call(
            "jsSheetBorders",
            format!("{},{}", sheet.id, serde_json::to_string(&borders).unwrap()),
            true,
        );
    }
}
