use crate::Pos;
use crate::{grid::SheetId, wasm_bindings::GridController, CellValue, Rect};
use bigdecimal::{BigDecimal, ToPrimitive, Zero};
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
    pub fn js_summarize_selection(
        &mut self,
        sheet_id: String,
        rect: &Rect,
    ) -> Option<SummarizeSelectionResult> {
        // don't allow too large of a selection
        if (rect.width() * rect.height()) > MAXIMUM_SUMMARIZE_SELECTION_SIZE {
            return None;
        }

        let sheet_id = SheetId::from_str(&sheet_id).expect("bad sheet ID");
        let sheet = self.grid().sheet_from_id(sheet_id);

        // sum and count
        let mut count = 0;
        let mut sum = BigDecimal::zero();
        for x in rect.x_range() {
            for y in rect.y_range() {
                if let Some(cell) = sheet.get_cell_value(Pos { x, y }) {
                    // if value is not an error or blank, count it
                    match cell {
                        CellValue::Blank => continue,
                        // CellValue::Error(_) => continue, // should we count errors?
                        CellValue::Number(n) => {
                            sum += n;
                            count += 1;
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

#[cfg(test)]
mod tests {
    // create a test grid and test that the summarize function works
    use crate::wasm_bindings::GridController;
    use crate::{Pos, Rect};

    #[tokio::test]
    async fn test_summarize() {
        let mut gc = GridController::default();
        let sheet_id = gc.sheet_ids()[0];

        gc.set_cell_value(sheet_id, Pos { x: 1, y: 1 }, String::from("12.12"), None)
            .await;
        gc.set_cell_value(sheet_id, Pos { x: 1, y: 2 }, String::from("12313"), None)
            .await;
        gc.set_cell_value(sheet_id, Pos { x: 1, y: 3 }, String::from("0"), None)
            .await;

        let rect = Rect::new_span(Pos { x: 1, y: 1 }, Pos { x: 1, y: 10 });
        let result = gc
            .js_summarize_selection(sheet_id.to_string(), &rect)
            .unwrap();

        assert_eq!(result.count, 3);
        assert_eq!(result.sum, Some(12325.12));
        assert_eq!(result.average, Some(4108.373333333333));

        let rect = Rect::new_span(Pos { x: 100, y: 100 }, Pos { x: 1000, y: 105 });
        let result = gc
            .js_summarize_selection(sheet_id.to_string(), &rect)
            .unwrap();

        assert_eq!(result.count, 0);
        assert_eq!(result.sum, Some(0.0));
        assert_eq!(result.average, Some(0.0));

        let rect = Rect::new_span(Pos { x: 100, y: 100 }, Pos { x: 10000, y: 10000 });
        let result = gc.js_summarize_selection(sheet_id.to_string(), &rect);
        assert!(result.is_none());
    }
}
