use rust_decimal::prelude::*;

use super::Sheet;
use crate::{
    CellValue,
    a1::{A1Context, A1Selection},
    grid::js_types::JsSummarizeSelectionResult,
    util::round,
};

const MAX_SUMMARIZE_SELECTION_SIZE: i64 = 50000;

impl Sheet {
    /// Returns the summary of values in the Grid. If there is there is less
    /// than two values, then returns None.
    pub fn summarize_selection(
        &self,
        selection: A1Selection,
        max_decimals: i64,
        a1_context: &A1Context,
    ) -> Option<JsSummarizeSelectionResult> {
        // sum and count
        let mut count: i64 = 0;
        let mut sum = Decimal::zero();

        let values = self.selection_values(
            &selection,
            Some(MAX_SUMMARIZE_SELECTION_SIZE),
            false,
            false,
            true,
            a1_context,
        )?;
        values.iter().for_each(|(_pos, value)| match value {
            CellValue::Number(n) => {
                sum += n;
                count += 1;
            }
            CellValue::Blank => {}
            _ => {
                count += 1;
            }
        });

        if count <= 1 {
            return None;
        }

        let average: Decimal = sum / Decimal::from(count);

        Some(JsSummarizeSelectionResult {
            count,
            sum: sum.to_f64().map(|num| round(num, max_decimals)),
            average: average.to_f64().map(|num| round(num, max_decimals)),
        })
    }
}

#[cfg(test)]
mod tests {
    use crate::grid::Sheet;
    use crate::grid::sheet::summarize::MAX_SUMMARIZE_SELECTION_SIZE;
    use crate::{SheetRect, a1::A1Selection};

    #[test]
    fn summarize_rects() {
        let mut sheet = Sheet::test();

        sheet.test_set_value_number(1, 1, "12.12");
        sheet.test_set_value_number(1, 2, "12313");
        sheet.test_set_value_number(1, 3, "0");

        // span of 10 cells, 3 have numeric values
        let selection = A1Selection::from_rect(SheetRect::new(1, 1, 1, 10, sheet.id));
        let a1_context = sheet.expensive_make_a1_context();
        let result = sheet
            .summarize_selection(selection, 9, &a1_context)
            .unwrap();
        assert_eq!(result.count, 3);
        assert_eq!(result.sum, Some(12325.12));
        assert_eq!(result.average, Some(4108.373333333));

        // returns zeros for an empty selection
        let selection = A1Selection::from_rect(SheetRect::new(100, 100, 1000, 105, sheet.id));
        let result = sheet.summarize_selection(selection, 9, &a1_context);
        assert_eq!(result, None);
    }

    #[test]
    fn summarize_rounding() {
        let mut sheet = Sheet::test();
        sheet.test_set_value_number(1, 1, "9.1234567891");
        sheet.test_set_value_number(1, 2, "12313");
        sheet.test_set_value_number(1, 3, "0");
        sheet.test_set_code_run_array(1, 4, vec!["1", "2", "3"], true);
        let selection = A1Selection::from_rect(SheetRect::new(1, 1, 1, 10, sheet.id));
        let a1_context = sheet.expensive_make_a1_context();
        let result = sheet
            .summarize_selection(selection, 9, &a1_context)
            .unwrap();
        assert_eq!(result.count, 6);
        assert_eq!(result.sum, Some(12328.123456789));
        assert_eq!(result.average, Some(2054.687242798));
    }

    #[test]
    fn summary_too_large() {
        let mut sheet = Sheet::test();

        // returns none if selection is too large (MAX_SUMMARIZE_SELECTION_SIZE)
        let selection = A1Selection::all(sheet.id);
        for i in 0..MAX_SUMMARIZE_SELECTION_SIZE + 1 {
            sheet.test_set_value_number(100, 100 + i, "1");
        }
        let a1_context = sheet.expensive_make_a1_context();
        let result = sheet.summarize_selection(selection, 9, &a1_context);
        assert!(result.is_none());
    }

    #[test]
    fn summarize_trailing_zeros() {
        let mut sheet = Sheet::test();
        sheet.test_set_value_number(-1, -1, "0.00100000000000");
        sheet.test_set_value_number(-1, 0, "0.00500000000000");
        let selection = A1Selection::from_rect(SheetRect::new(-1, -1, -1, 1, sheet.id));
        let a1_context = sheet.expensive_make_a1_context();
        let result = sheet
            .summarize_selection(selection, 9, &a1_context)
            .unwrap();
        assert_eq!(result.count, 2);
        assert_eq!(result.sum, Some(0.006));
        assert_eq!(result.average, Some(0.003));
    }

    #[test]
    fn summarize_columns() {
        let mut sheet = Sheet::test();
        for y in 1..11 {
            sheet.test_set_value_number(1, y, "2");
            sheet.test_set_value_number(2, y, "2");
        }
        sheet.test_set_code_run_array(1, 20, vec!["1", "2", "", "3"], true);
        let selection = A1Selection::test_a1("A:B");
        let a1_context = sheet.expensive_make_a1_context();
        let result = sheet
            .summarize_selection(selection, 9, &a1_context)
            .unwrap();
        assert_eq!(result.count, 23);
        assert_eq!(result.sum, Some(46.0));
        assert_eq!(result.average, Some(2.0));
    }

    #[test]
    fn summarize_rows() {
        let mut sheet = Sheet::test();
        for y in 1..11 {
            sheet.test_set_value_number(y, 1, "2");
            sheet.test_set_value_number(y, 2, "2");
        }
        sheet.test_set_code_run_array(20, 1, vec!["1", "2", "", "3"], false);
        let selection = A1Selection::test_a1("1:2");
        let a1_context = sheet.expensive_make_a1_context();
        let result = sheet
            .summarize_selection(selection, 9, &a1_context)
            .unwrap();
        assert_eq!(result.count, 23);
        assert_eq!(result.sum, Some(46.0));
        assert_eq!(result.average, Some(2.0));
    }

    #[test]
    fn summarize_all() {
        let mut sheet = Sheet::test();
        for i in 1..11 {
            for j in 1..11 {
                sheet.test_set_value_number(i, j, "2");
            }
        }
        sheet.test_set_code_run_array(20, 20, vec!["1", "2", "3"], false);
        let selection = A1Selection::all(sheet.id);
        let a1_context = sheet.expensive_make_a1_context();
        let result = sheet
            .summarize_selection(selection, 9, &a1_context)
            .unwrap();
        assert_eq!(result.count, 103);
        assert_eq!(result.sum, Some(206.0));
        assert_eq!(result.average, Some(2.0));
    }

    #[test]
    fn test_summarize_table() {
        let mut sheet = Sheet::test();
        sheet.test_set_code_run_array_2d(1, 1, 2, 2, vec!["1", "2", "3", "4"]);

        let a1_context = sheet.expensive_make_a1_context();
        let selection = A1Selection::test_a1_context("Table1", &a1_context);
        let result = sheet
            .summarize_selection(selection, 9, &a1_context)
            .unwrap();
        assert_eq!(result.count, 4);
        assert_eq!(result.sum, Some(10.0));
        assert_eq!(result.average, Some(2.5));

        let selection = A1Selection::test_a1_context("Table1[Column 2]", &a1_context);
        let result = sheet
            .summarize_selection(selection, 9, &a1_context)
            .unwrap();
        assert_eq!(result.count, 2);
        assert_eq!(result.sum, Some(6.0));
        assert_eq!(result.average, Some(3.0));

        let selection = A1Selection::test_a1_context("Table1[[Column 1]:[Column 2]]", &a1_context);
        let result = sheet
            .summarize_selection(selection, 9, &a1_context)
            .unwrap();
        assert_eq!(result.count, 4);
        assert_eq!(result.sum, Some(10.0));
        assert_eq!(result.average, Some(2.5));
    }
}
