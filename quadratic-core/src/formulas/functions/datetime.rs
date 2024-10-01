use super::*;

pub const CATEGORY: FormulaFunctionCategory = FormulaFunctionCategory {
    include_in_docs: true,
    include_in_completions: true,
    name: "Date & time functions",
    docs: Some(include_str!("datetime_docs.md")),
    get_functions,
};

fn get_functions() -> Vec<FormulaFunction> {
    vec![
        formula_fn!(
            /// Returns the current local date and time.
            ///
            /// This depends on the time configuration of the computer where the
            /// formula is run, which may depend on timezone.
            #[examples("NOW()")]
            fn NOW() {
                CellValue::DateTime(chrono::Local::now().naive_local())
            }
        ),
        formula_fn!(
            /// Returns the current local date.
            ///
            /// This depends on the time configuration of the computer where the
            /// formula is run, which may depend on timezone.
            #[examples("TODAY()")]
            fn TODAY() {
                CellValue::Date(chrono::Local::now().date_naive())
            }
        ),
        formula_fn!(
            /// Returns a specific date from a `year`, `month`, and `day`.
            ///
            /// `year`, `month`, and `day` must be integers.
            ///
            /// If `day` is outside the range of days in the given month, then
            /// days are counted before or after the given month. For example,
            /// `DATE(2024, 1, 98)` returns `2024-04-08`.
            ///
            /// If `month` is outside the range from `1` to `12` (inclusive),
            /// then months are counted before or after the given year. For
            /// example, `DATE(2024, 13, 1)` returns `2025-01-01`.
            ///
            /// _Note that February 29, 1900 does not exist._
            #[examples("DATE(2024, 04, 08)", "DATE(1995, 12, 25)")]
            fn DATE() {
                todo!()
            }
        ),
        formula_fn!(
            /// Returns a specific time from an `hour`, `minute`, and `second`.
            ///
            /// `hour` and `minute` must be integers. `second` must be a number
            /// (but does not need to be an integer).
            ///
            /// If the number of seconds is outside the range from `0`
            /// (inclusive) to `60` (exclusive), then it carries over to some
            /// number of minutes.
            ///
            /// If the number of minutes is outside the range from `0` to `59`
            /// (inclusive), then it carries over to some number of hours.
            ///
            /// Any number for `hour` Negative numbers or numbers greater than
            /// 23 for `hour` wrap around so that the hour is always between 0
            /// and 23.
            #[examples("TIME()")]
            fn TIME() {
                CellValue::Date(chrono::Local::now().date_naive())
            }
        ),
        // formula_fn!(),
    ]
}

#[cfg(test)]
#[cfg_attr(test, serial_test::parallel)]
mod tests {
    use crate::formulas::tests::*;

    #[test]
    fn test_formula_now_today() {
        // Hopefully we get a date time! There's not really anything else we can
        // do to test this without duplicating the code in `fn NOW()`.
        let g = Grid::new();
        assert!(matches!(
            eval(&g, "NOW()"),
            Value::Single(CellValue::DateTime(_)),
        ));

        // Hopefully we get a date!
        let g = Grid::new();
        assert!(matches!(
            eval(&g, "TODAY()"),
            Value::Single(CellValue::Date(_)),
        ));
    }
}
