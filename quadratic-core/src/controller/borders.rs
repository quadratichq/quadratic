use super::operation::Operation;
use super::transactions::TransactionType;
use super::GridController;
use crate::controller::transaction_summary::TransactionSummary;
use crate::grid::generate_borders;
use crate::{
    grid::{BorderSelection, BorderStyle, SheetId},
    Rect,
};

impl GridController {
    pub async fn set_borders(
        &mut self,
        sheet_id: SheetId,
        rect: Rect,
        selections: Vec<BorderSelection>,
        style: Option<BorderStyle>,
        cursor: Option<String>,
    ) -> TransactionSummary {
        let region = self.region(sheet_id, rect);
        let sheet = self.sheet(sheet_id);
        let borders = generate_borders(sheet, &region, selections, style);
        let ops = vec![Operation::SetBorders { region, borders }];
        self.set_in_progress_transaction(ops, cursor, false, TransactionType::Normal)
    }
}

#[cfg(test)]
mod tests {
    use crate::{color::Rgba, grid::CellBorderLine};

    use super::*;

    #[test]
    fn test_set_borders() {
        let mut grid_controller = GridController::new();
        let sheet_id = grid_controller.grid.sheets()[0].id;
        let rect = Rect::single_pos((0, 0).into());
        let selections = vec![BorderSelection::Top, BorderSelection::Left];
        let style = Some(BorderStyle {
            color: Rgba::default(),
            line: CellBorderLine::Line1,
        });

        tokio_test::block_on(grid_controller.set_borders(sheet_id, rect, selections, style, None));

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
