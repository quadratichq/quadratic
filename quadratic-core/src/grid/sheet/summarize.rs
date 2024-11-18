use super::Sheet;
use crate::{
    selection::OldSelection, util::round,
    wasm_bindings::controller::summarize::SummarizeSelectionResult, CellValue,
};
use bigdecimal::{BigDecimal, ToPrimitive, Zero};

const MAX_SUMMARIZE_SELECTION_SIZE: i64 = 50000;

impl Sheet {
    /// Returns the summary of values in the Grid. If there is there is less
    /// than two values, then returns None.
    pub fn summarize_selection(
        &self,
        selection: OldSelection,
        max_decimals: i64,
    ) -> Option<SummarizeSelectionResult> {
        todo!()
        // // sum and count
        // let mut count: i64 = 0;
        // let mut sum = BigDecimal::zero();

        // let values =
        //     self.selection(&selection, Some(MAX_SUMMARIZE_SELECTION_SIZE), false, false)?;
        // values.iter().for_each(|(_pos, value)| match value {
        //     CellValue::Number(n) => {
        //         sum += n;
        //         count += 1;
        //     }
        //     CellValue::Blank => {}
        //     CellValue::Code(_) => {}
        //     _ => {
        //         count += 1;
        //     }
        // });

        // if count <= 1 {
        //     return None;
        // }

        // let average: BigDecimal = &sum / count;

        // Some(SummarizeSelectionResult {
        //     count,
        //     sum: sum.to_f64().map(|num| round(num, max_decimals)),
        //     average: average.to_f64().map(|num| round(num, max_decimals)),
        // })
    }
}

#[cfg(test)]
mod tests {
    use crate::grid::sheet::summarize::MAX_SUMMARIZE_SELECTION_SIZE;
    use crate::grid::Sheet;
    use crate::selection::OldSelection;
    use crate::{Pos, Rect};
    use serial_test::parallel;

    #[test]
    #[parallel]
    fn summarize_rects() {
        let mut sheet = Sheet::test();

        sheet.test_set_value_number(1, 1, "12.12");
        sheet.test_set_value_number(1, 2, "12313");
        sheet.test_set_value_number(1, 3, "0");

        // span of 10 cells, 3 have numeric values
        let rect = Rect::new_span(Pos { x: 1, y: 1 }, Pos { x: 1, y: 10 });
        let selection = OldSelection {
            sheet_id: sheet.id,
            x: 0,
            y: 0,
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
        let selection = OldSelection {
            sheet_id: sheet.id,
            x: 0,
            y: 0,
            all: false,
            columns: None,
            rows: None,
            rects: Some(vec![rect]),
        };
        let result = sheet.summarize_selection(selection, 9);
        assert_eq!(result, None);
    }

    #[test]
    #[parallel]
    fn summarize_rounding() {
        let mut sheet = Sheet::test();
        sheet.test_set_value_number(1, 1, "9.1234567891");
        sheet.test_set_value_number(1, 2, "12313");
        sheet.test_set_value_number(1, 3, "0");
        sheet.test_set_code_run_array(1, 4, vec!["1", "2", "3"], true);
        let rect = Rect::new_span(Pos { x: 1, y: 1 }, Pos { x: 1, y: 10 });
        let selection = OldSelection {
            sheet_id: sheet.id,
            x: 0,
            y: 0,
            all: false,
            columns: None,
            rows: None,
            rects: Some(vec![rect]),
        };
        let result = sheet.summarize_selection(selection, 9).unwrap();
        assert_eq!(result.count, 6);
        assert_eq!(result.sum, Some(12328.123456789));
        assert_eq!(result.average, Some(2054.687242798));
    }

    #[test]
    #[parallel]
    fn summary_too_large() {
        let mut sheet = Sheet::test();

        // returns none if selection is too large (MAX_SUMMARIZE_SELECTION_SIZE)
        let selection = OldSelection {
            sheet_id: sheet.id,
            x: 0,
            y: 0,
            all: true,
            columns: None,
            rows: None,
            rects: None,
        };
        for i in 0..MAX_SUMMARIZE_SELECTION_SIZE + 1 {
            sheet.test_set_value_number(100, 100 + i, "1");
        }
        let result = sheet.summarize_selection(selection, 9);
        assert!(result.is_none());
    }

    #[test]
    #[parallel]
    fn summarize_trailing_zeros() {
        let mut sheet = Sheet::test();
        sheet.test_set_value_number(-1, -1, "0.00100000000000");
        sheet.test_set_value_number(-1, 0, "0.00500000000000");
        let rect = Rect::new_span(Pos { x: -1, y: -1 }, Pos { x: -1, y: 1 });
        let selection = OldSelection {
            sheet_id: sheet.id,
            x: 0,
            y: 0,
            all: false,
            columns: None,
            rows: None,
            rects: Some(vec![rect]),
        };
        let result = sheet.summarize_selection(selection, 9).unwrap();
        assert_eq!(result.count, 2);
        assert_eq!(result.sum, Some(0.006));
        assert_eq!(result.average, Some(0.003));
    }

    #[test]
    #[parallel]
    fn summarize_columns() {
        let mut sheet = Sheet::test();
        for i in 0..10 {
            sheet.test_set_value_number(1, i, "2");
            sheet.test_set_value_number(-1, i, "2");
        }
        sheet.test_set_code_run_array(-1, -10, vec!["1", "2", "", "3"], true);
        let selection = OldSelection {
            sheet_id: sheet.id,
            x: 0,
            y: 0,
            all: false,
            columns: Some(vec![-2, -1, 0, 1, 2]),
            rows: None,
            rects: None,
        };
        let result = sheet.summarize_selection(selection, 9).unwrap();
        assert_eq!(result.count, 23);
        assert_eq!(result.sum, Some(46.0));
        assert_eq!(result.average, Some(2.0));
    }

    #[test]
    #[parallel]
    fn summarize_rows() {
        let mut sheet = Sheet::test();
        for i in 0..10 {
            sheet.test_set_value_number(i, 1, "2");
            sheet.test_set_value_number(i, -1, "2");
        }
        sheet.test_set_code_run_array(-10, -1, vec!["1", "2", "", "3"], true);
        let selection = OldSelection {
            sheet_id: sheet.id,
            x: 0,
            y: 0,
            all: false,
            columns: None,
            rows: Some(vec![-2, -1, 0, 1, 2]),
            rects: None,
        };
        let result = sheet.summarize_selection(selection, 9).unwrap();
        assert_eq!(result.count, 23);
        assert_eq!(result.sum, Some(46.0));
        assert_eq!(result.average, Some(2.0));
    }

    #[test]
    #[parallel]
    fn summarize_all() {
        let mut sheet = Sheet::test();
        for i in 0..10 {
            for j in 0..10 {
                sheet.test_set_value_number(i, j, "2");
            }
        }
        sheet.test_set_code_run_array(-20, -20, vec!["1", "2", "3"], false);
        let selection = OldSelection {
            sheet_id: sheet.id,
            x: 0,
            y: 0,
            all: true,
            columns: None,
            rows: None,
            rects: None,
        };
        let result = sheet.summarize_selection(selection, 9).unwrap();
        assert_eq!(result.count, 103);
        assert_eq!(result.sum, Some(206.0));
        assert_eq!(result.average, Some(2.0));
    }
}
