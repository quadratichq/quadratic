use super::{transactions::TransactionSummary, GridController};
use crate::controller::operations::Operation;
use crate::grid::generate_sheet_borders;
use crate::{
    grid::{BorderSelection, BorderStyle, SheetId},
    Rect,
};

impl GridController {
    pub fn set_borders(
        &mut self,
        sheet_id: SheetId,
        rect: Rect,
        selections: Vec<BorderSelection>,
        style: Option<BorderStyle>,
        cursor: Option<String>,
    ) -> TransactionSummary {
        let region = self.region(sheet_id, rect);
        let sheet = self.sheet(sheet_id);
        let borders = generate_sheet_borders(sheet, &region, selections, style);
        let ops = vec![Operation::SetBorders { region, borders }];
        self.transact_forward(ops, cursor)
    }
}
