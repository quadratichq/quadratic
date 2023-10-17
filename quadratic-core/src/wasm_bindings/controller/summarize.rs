use crate::wasm_bindings::BigDecimal;
use crate::Pos;
use crate::{grid::SheetId, wasm_bindings::GridController, CellValue, Rect};
use bigdecimal::ToPrimitive;
use bigdecimal::Zero;
use std::str::FromStr;
use wasm_bindgen::prelude::wasm_bindgen;

const MAXIMUM_SUMMARIZE_SELECTION_SIZE: u32 = 50000;

#[wasm_bindgen]
pub struct SummarizeSelectionResult {
    pub count: i64,
    pub sum: Option<f64>,
    pub average: Option<f64>,
}

#[wasm_bindgen]
impl GridController {
    #[wasm_bindgen(js_name = "summarizeSelection")]
    pub async fn js_summarize_selection(
        &mut self,
        sheet_id: String,
        rect: &Rect,
    ) -> Option<SummarizeSelectionResult> {
        // don't allow too large of a selection
        if (rect.width() * rect.height()) > MAXIMUM_SUMMARIZE_SELECTION_SIZE {
            return None;
        }

        let sheet_id = SheetId::from_str(&sheet_id).expect("invalid sheet id");
        let sheet = self.grid().sheet_from_id(sheet_id);

        let mut count = 0;
        let mut sum = BigDecimal::zero();
        for x in rect.x_range() {
            for y in rect.y_range() {
                // if value is not an error or blank, count it
                if let Some(cell) = sheet.get_cell_value(Pos { x, y }) {
                    match cell {
                        CellValue::Blank => continue,
                        // CellValue::Error(_) => continue, // should we count errors?
                        CellValue::Number(n) => {
                            count += 1;
                            sum += n;
                        }
                        _ => {
                            count += 1;
                        }
                    }
                }
            }
        }

        // average
        let average: BigDecimal = if count > 0 {
            &sum / count
        } else {
            BigDecimal::zero()
        };

        Some(SummarizeSelectionResult {
            count,
            sum: sum.to_f64(),
            average: average.to_f64(),
        })
    }
}
