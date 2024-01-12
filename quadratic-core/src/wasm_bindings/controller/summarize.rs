use crate::util::round;
use crate::Pos;
use crate::{wasm_bindings::GridController, CellValue, Rect};
use bigdecimal::{BigDecimal, ToPrimitive, Zero};
use wasm_bindgen::prelude::wasm_bindgen;

const MAX_SUMMARIZE_SELECTION_SIZE: u32 = 50000;

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
        max_decimals: i64,
    ) -> Option<SummarizeSelectionResult> {
        // don't allow too large of a selection
        if rect.len() > MAX_SUMMARIZE_SELECTION_SIZE {
            return None;
        }

        let Some(sheet) = self.try_sheet_from_string_id(sheet_id) else {
            return None;
        };

        // sum and count
        let mut count = 0;
        let mut sum = BigDecimal::zero();
        for x in rect.x_range() {
            for y in rect.y_range() {
                if let Some(cell) = sheet.display_value(Pos { x, y }) {
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
            sum: sum.to_f64().map(|num| round(num, max_decimals)),
            average: average.to_f64().map(|num| round(num, max_decimals)),
        })
    }
}

#[cfg(test)]
mod tests {
    // create a test grid and test that the summarize function works
    use crate::wasm_bindings::GridController;
    use crate::{Pos, Rect, SheetPos};

    // TODO(ddimaria): move to a shared util
    fn set_value(gc: &mut GridController, x: i64, y: i64, value: &str) {
        let sheet_id = gc.sheet_ids()[0];
        gc.set_cell_value(SheetPos { x, y, sheet_id }, String::from(value), None);
    }

    #[test]
    fn test_summarize() {
        let mut gc = GridController::default();
        let sheet_id = gc.sheet_ids()[0];

        set_value(&mut gc, 1, 1, "12.12");
        set_value(&mut gc, 1, 2, "12313");
        set_value(&mut gc, 1, 3, "0");

        // span of 10 cells, 3 have numeric values
        let rect = Rect::new_span(Pos { x: 1, y: 1 }, Pos { x: 1, y: 10 });
        let result = gc
            .js_summarize_selection(sheet_id.to_string(), &rect, 9)
            .unwrap();
        assert_eq!(result.count, 3);
        assert_eq!(result.sum, Some(12325.12));
        assert_eq!(result.average, Some(4108.373333333));

        // returns zeros for an empty selection
        let rect = Rect::new_span(Pos { x: 100, y: 100 }, Pos { x: 1000, y: 105 });
        let result = gc
            .js_summarize_selection(sheet_id.to_string(), &rect, 9)
            .unwrap();
        assert_eq!(result.count, 0);
        assert_eq!(result.sum, Some(0.0));
        assert_eq!(result.average, Some(0.0));

        // returns none if selection is too large (MAX_SUMMARIZE_SELECTION_SIZE)
        let rect = Rect::new_span(Pos { x: 100, y: 100 }, Pos { x: 10000, y: 10000 });
        let result = gc.js_summarize_selection(sheet_id.to_string(), &rect, 9);
        assert!(result.is_none());

        // rounding
        set_value(&mut gc, 1, 1, "9.1234567891");
        let rect = Rect::new_span(Pos { x: 1, y: 1 }, Pos { x: 1, y: 10 });
        let result = gc
            .js_summarize_selection(sheet_id.to_string(), &rect, 9)
            .unwrap();
        assert_eq!(result.count, 3);
        assert_eq!(result.sum, Some(12322.123456789));
        assert_eq!(result.average, Some(4107.374485596));

        // trailing zeros
        set_value(&mut gc, -1, -1, "0.00100000000000");
        let rect = Rect::new_span(Pos { x: -1, y: -1 }, Pos { x: -1, y: -10 });
        let result = gc
            .js_summarize_selection(sheet_id.to_string(), &rect, 9)
            .unwrap();
        assert_eq!(result.count, 1);
        assert_eq!(result.sum, Some(0.001));
        assert_eq!(result.average, Some(0.001));
    }
}
