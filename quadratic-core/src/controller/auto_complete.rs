use super::{transactions::TransactionSummary, GridController};
use crate::{grid::SheetId, Rect};

impl GridController {
    pub fn expand_down(
        &mut self,
        _sheet_id: SheetId,
        _rect: Rect,
        _to: u32,
        _shrink_horizontal: Option<u32>,
    ) -> TransactionSummary {
        TransactionSummary::default()
    }
}

#[cfg(test)]
mod tests {
    #[test]
    fn test_expand_down() {}
}
