use crate::wasm_bindings::BigDecimal;
use crate::{grid::SheetId, wasm_bindings::GridController, CellValue, Rect};
use bigdecimal::ToPrimitive;
use std::str::FromStr;
use wasm_bindgen::prelude::wasm_bindgen;

#[wasm_bindgen]
pub struct SummarizeSelectionResult {
    pub count: i64,
    pub sum: f64,
    pub average: f64,
}

#[wasm_bindgen]
impl GridController {
    #[wasm_bindgen(js_name = "summarizeSelection")]
    pub async fn js_summarize_selection(
        &mut self,
        sheet_id: String,
        rect: &Rect,
    ) -> Option<SummarizeSelectionResult> {
        // if the selection is too big to summarize, return None
        if rect.width() * rect.height() > 100000 {
            return None;
        }

        let sheet_id = SheetId::from_str(&sheet_id).unwrap();
        let sheet = self.grid().sheet_from_id(sheet_id);
        let values = sheet.cell_values_in_rect(*rect);

        // count & sum
        let mut count = 0;
        let mut sum = BigDecimal::from_str("0").unwrap();
        for value in values {
            // if value is not an error or blank, count it
            match value {
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

        // average
        let average: BigDecimal = if count > 0 {
            sum.clone() / count
        } else {
            BigDecimal::from_str("0").unwrap()
        };

        Some(SummarizeSelectionResult {
            count,
            sum: sum.to_f64().unwrap(),
            average: average.to_f64().unwrap(),
        })
    }
}
