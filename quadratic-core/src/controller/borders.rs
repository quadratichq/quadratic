use super::operation::Operation;
use super::transaction_in_progress::TransactionType;
use super::GridController;
use crate::controller::transaction_summary::TransactionSummary;
use crate::grid::generate_borders;
use crate::grid::{BorderSelection, BorderStyle};
use crate::SheetRect;

impl GridController {
    pub async fn set_borders(
        &mut self,
        sheet_rect: SheetRect,
        selections: Vec<BorderSelection>,
        style: Option<BorderStyle>,
        cursor: Option<String>,
    ) -> TransactionSummary {
        let sheet = self.sheet(sheet_rect.sheet_id);
        let borders = generate_borders(sheet, &sheet_rect.into(), selections, style);
        let ops = vec![Operation::SetBorders {
            sheet_rect,
            borders,
        }];
        self.set_in_progress_transaction(ops, cursor, false, TransactionType::Normal)
    }
}

#[cfg(test)]
mod tests {
    use crate::{color::Rgba, grid::CellBorderLine, Pos};

    use super::*;

    #[test]
    fn test_set_borders() {
        let mut grid_controller = GridController::new();
        let sheet_id = grid_controller.grid.sheets()[0].id;
        let sheet_rect = SheetRect::single_pos(Pos { x: 0, y: 0 }, sheet_id);
        let selections = vec![BorderSelection::Top, BorderSelection::Left];
        let style = Some(BorderStyle {
            color: Rgba::default(),
            line: CellBorderLine::Line1,
        });

        tokio_test::block_on(grid_controller.set_borders(sheet_rect, selections, style, None));

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
}
