use crate::controller::{transaction_summary::TransactionSummary, GridController};
use crate::grid::{BorderSelection, BorderStyle};
use crate::SheetRect;

impl GridController {
    pub fn set_borders(
        &mut self,
        sheet_rect: SheetRect,
        selections: Vec<BorderSelection>,
        style: Option<BorderStyle>,
        cursor: Option<String>,
    ) -> TransactionSummary {
        let ops = self.set_borders_operations(sheet_rect, selections, style);
        self.start_user_transaction(ops, cursor)
    }
}

#[cfg(test)]
mod tests {
    use crate::{
        color::Rgba,
        grid::{CellBorderLine, SheetId},
        Pos,
    };

    use super::*;

    #[test]
    fn test_set_borders() {
        let mut grid_controller = GridController::test();
        let sheet_id = grid_controller.grid.sheets()[0].id;
        let sheet_rect = SheetRect::single_pos(Pos { x: 0, y: 0 }, sheet_id);
        let selections = vec![BorderSelection::Top, BorderSelection::Left];
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
        assert_eq!(borders[2], None);
        assert_eq!(borders[3], None);
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
}
