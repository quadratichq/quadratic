use super::{transactions::TransactionSummary, GridController};
use crate::{grid::SheetId, wasm_bindings::js, CellValue, Pos, Rect};

impl GridController {
    pub fn expand_down(
        &mut self,
        sheet_id: SheetId,
        _rect: Rect,
        _to: u32,
        _shrink_horizontal: Option<u32>,
        cursor: Option<String>,
    ) -> TransactionSummary {
        js::log(&format!("rect: {:?}", _rect));

        return self.set_cell_value(
            sheet_id,
            Pos { x: 1, y: 1 },
            CellValue::Text("1".into()),
            cursor,
        );
    }
}

#[cfg(test)]
mod tests {
    #[test]
    fn test_expand_down() {}
}
