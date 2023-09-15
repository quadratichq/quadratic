use wasm_bindgen::prelude::wasm_bindgen;

use crate::{
    controller::{transactions::TransactionSummary, GridController},
    grid::{CodeCellValue, SheetId},
    Pos,
};

#[wasm_bindgen]
impl GridController {
    /// Returns [`TransactionSummary`]
    #[wasm_bindgen(js_name = "setCodeResults")]
    pub fn js_set_code_cell_value(
        &mut self,
        sheet_id: String,
        pos: Pos,
        code_cell: Option<String>,
    ) -> TransactionSummary {
        let sheet_id = SheetId::from_str(&sheet_id).unwrap();
        let sheet = self.sheet(sheet_id);

        sheet.set_code_cell_value(pos, code_cell);
    }
}
