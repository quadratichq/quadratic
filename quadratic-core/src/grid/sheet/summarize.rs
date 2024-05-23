use super::Sheet;
use crate::{
    selection::Selection, util::round,
    wasm_bindings::controller::summarize::SummarizeSelectionResult, CellValue, Pos,
};
use bigdecimal::{BigDecimal, ToPrimitive, Zero};

const MAX_SUMMARIZE_SELECTION_SIZE: i64 = 50000;

impl Sheet {
    pub fn summarize_selection(
        &self,
        selection: Selection,
        max_decimals: i64,
    ) -> Option<SummarizeSelectionResult> {
        // sum and count
        let mut count: i64 = 0;
        let mut sum = BigDecimal::zero();

        // helper function to add an entry to the sum and count; returns true if
        // the count exceeds the maximum allowed
        let mut add_entry = |entry: &CellValue| -> bool {
            match entry {
                CellValue::Number(n) => {
                    sum += n;
                    count += 1;
                }
                _ => {
                    count += 1;
                }
            }
            count > MAX_SUMMARIZE_SELECTION_SIZE
        };

        if selection.all == true {
            for (_x, column) in self.columns.iter() {
                for (_y, entry) in column.values.iter() {
                    if add_entry(entry) {
                        return None;
                    }
                }
            }
        } else if let Some(columns) = selection.columns {
            for column in columns.iter() {
                for (_y, entry) in self.columns.get(column).unwrap().values.iter() {
                    if add_entry(entry) {
                        return None;
                    }
                }
            }
        } else if let Some(rows) = selection.rows {
            for (_x, column) in self.columns.iter() {
                for (y, entry) in column.values.iter() {
                    if rows.contains(y) {
                        if add_entry(entry) {
                            return None;
                        }
                    }
                }
            }
        } else if let Some(rects) = selection.rects {
            for rect in rects.iter() {
                for x in rect.min.x..=rect.max.x {
                    for y in rect.min.y..=rect.max.y {
                        if let Some(entry) = self.cell_value(Pos { x, y }) {
                            if add_entry(&entry) {
                                return None;
                            }
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
    use std::str::FromStr;

    use bigdecimal::BigDecimal;

    use crate::grid::sheet::summarize::MAX_SUMMARIZE_SELECTION_SIZE;
    use crate::grid::Sheet;
    use crate::selection::Selection;
    // create a test grid and test that the summarize function works
    use crate::{CellValue, Pos, Rect};

    fn set_value(sheet: &mut Sheet, x: i64, y: i64, n: &str) {
        sheet.set_cell_value(
            Pos { x, y },
            CellValue::Number(BigDecimal::from_str(n).unwrap()),
        );
    }

    #[test]
    fn test_summarize_rects() {
        let mut sheet = Sheet::test();

        set_value(&mut sheet, 1, 1, "12.12");
        set_value(&mut sheet, 1, 2, "12313");
        set_value(&mut sheet, 1, 3, "0");

        // span of 10 cells, 3 have numeric values
        let rect = Rect::new_span(Pos { x: 1, y: 1 }, Pos { x: 1, y: 10 });
        let selection = Selection {
            sheet_id: sheet.id.clone(),
            all: false,
            columns: None,
            rows: None,
            rects: Some(vec![rect]),
        };
        let result = sheet.summarize_selection(selection, 9).unwrap();
        assert_eq!(result.count, 3);
        assert_eq!(result.sum, Some(12325.12));
        assert_eq!(result.average, Some(4108.373333333));

        // returns zeros for an empty selection
        let rect = Rect::new_span(Pos { x: 100, y: 100 }, Pos { x: 1000, y: 105 });
        let selection = Selection {
            sheet_id: sheet.id.clone(),
            all: false,
            columns: None,
            rows: None,
            rects: Some(vec![rect]),
        };
        let result = sheet.summarize_selection(selection, 9).unwrap();
        assert_eq!(result.count, 0);
        assert_eq!(result.sum, Some(0.0));
        assert_eq!(result.average, Some(0.0));
    }

    #[test]
    fn test_summarize_rounding() {
        let mut sheet = Sheet::test();
        set_value(&mut sheet, 1, 1, "9.1234567891");
        let rect = Rect::new_span(Pos { x: 1, y: 1 }, Pos { x: 1, y: 10 });
        let selection = Selection {
            sheet_id: sheet.id.clone(),
            all: false,
            columns: None,
            rows: None,
            rects: Some(vec![rect]),
        };
        let result = sheet.summarize_selection(selection, 9).unwrap();
        assert_eq!(result.count, 3);
        assert_eq!(result.sum, Some(12322.123456789));
        assert_eq!(result.average, Some(4107.374485596));
    }

    #[test]
    fn test_summary_too_large() {
        let mut sheet = Sheet::test();

        // returns none if selection is too large (MAX_SUMMARIZE_SELECTION_SIZE)
        let rect = Rect::new_span(
            Pos { x: 100, y: 100 },
            Pos {
                x: 1,
                y: 100 + MAX_SUMMARIZE_SELECTION_SIZE + 1,
            },
        );
        let selection = Selection {
            sheet_id: sheet.id.clone(),
            all: false,
            columns: None,
            rows: None,
            rects: Some(vec![rect]),
        };
        for i in 0..MAX_SUMMARIZE_SELECTION_SIZE + 1 {
            set_value(&mut sheet, 100, 100 + i, "1");
        }
        let result = sheet.summarize_selection(selection, 9);
        assert!(result.is_none());
    }

    // // trailing zeros
    // set_value(&mut gc, -1, -1, "0.00100000000000");
    // let rect = Rect::new_span(Pos { x: -1, y: -1 }, Pos { x: -1, y: -10 });
    // let result = gc
    //     .js_summarize_selection(sheet_id.to_string(), &rect, 9)
    //     .unwrap();
    // assert_eq!(result.count, 1);
    // assert_eq!(result.sum, Some(0.001));
    // assert_eq!(result.average, Some(0.001));
}
