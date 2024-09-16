use crate::ArraySize;

use super::*;

pub const CATEGORY: FormulaFunctionCategory = FormulaFunctionCategory {
    include_in_docs: false,
    include_in_completions: false,
    name: "Operators",
    docs: "",
    get_functions,
};

fn get_functions() -> Vec<FormulaFunction> {
    vec![
        // Comparison operators
        formula_fn!(#[operator] #[zip_map] fn "="([a]: CellValue, [b]: CellValue) { a.eq(b)? }),
        formula_fn!(#[operator] #[zip_map] fn "=="([a]: CellValue, [b]: CellValue) { a.eq(b)? }),
        formula_fn!(#[operator] #[zip_map] fn "<>"([a]: CellValue, [b]: CellValue) { !a.eq(b)? }),
        formula_fn!(#[operator] #[zip_map] fn "!="([a]: CellValue, [b]: CellValue) { !a.eq(b)? }),
        formula_fn!(#[operator] #[zip_map] fn "<"([a]: CellValue, [b]: CellValue) { a.lt(b)? }),
        formula_fn!(#[operator] #[zip_map] fn ">"([a]: CellValue, [b]: CellValue) { a.gt(b)? }),
        formula_fn!(#[operator] #[zip_map] fn "<="([a]: CellValue, [b]: CellValue) { a.lte(b)? }),
        formula_fn!(#[operator] #[zip_map] fn ">="([a]: CellValue, [b]: CellValue) { a.gte(b)? }),
        // Mathematical operators
        formula_fn!(
            #[operator]
            #[zip_map]
            fn "+"(span: Span, [a]: (Spanned<CellValue>), [b]: (Option<Spanned<CellValue>>)) {
                let a = a.cloned();
                let b = match b {
                    Some(v) => v.cloned(),
                    None => Spanned {
                        span: *span,
                        inner: 0.into(),
                    },
                };
                CellValue::add(*span, a, b)?.inner
            }
        ),
        formula_fn!(
            #[operator]
            #[zip_map]
            fn "-"(span: Span, [a]: (Spanned<CellValue>), [b]: (Option<Spanned<CellValue>>)) {
                let a = a.cloned();
                match b {
                    Some(b) => CellValue::sub(*span,a, b.cloned())?.inner,
                    None => CellValue::neg(a)?.inner,
                }
            }
        ),
        formula_fn!(
            #[operator]
            #[zip_map]
            fn "*"([a]: f64, [b]: f64) {
                a * b
            }
        ),
        formula_fn!(
            #[operator]
            #[zip_map]
            fn "/"(span: Span, [dividend]: f64, [divisor]: f64) {
                util::checked_div(span, dividend, divisor)
            }
        ),
        formula_fn!(
            #[operator]
            #[zip_map]
            fn "^"([base]: f64, [exponent]: f64) {
                base.powf(exponent)
            }
        ),
        formula_fn!(
            #[operator]
            #[zip_map]
            fn "%"([percentage]: f64) {
                percentage / 100.0
            }
        ),
        formula_fn!(
            #[operator]
            fn ".."(start: (Spanned<i64>), end: (Spanned<i64>)) {
                let span = Span::merge(start.span, end.span);
                let a = start.inner;
                let b = end.inner;
                let len = (a - b).unsigned_abs() as u32 + 1;
                if len as f64 > crate::limits::INTEGER_RANGE_LIMIT {
                    return Err(RunErrorMsg::ArrayTooBig.with_span(span));
                }
                let range = if a < b { a..=b } else { b..=a };
                let width = 1;
                let height = len;
                let array_size = ArraySize::new_or_err(width, height)?;
                Array::new_row_major(array_size, range.map(CellValue::from).collect())?
            }
        ),
        // String operators
        formula_fn!(
            #[operator]
            #[zip_map]
            fn "&"([a]: String, [b]: String) {
                a + &b
            }
        ),
    ]
}

#[cfg(test)]
mod tests {
    use crate::formulas::tests::*;
    use serial_test::parallel;
    use std::str::FromStr;

    #[test]
    #[parallel]
    #[allow(clippy::identity_op)]
    fn test_formula_math_operators() {
        let g = Grid::new();

        assert_eq!(
            (1 * -6 + -2 - 1 * (-3_i32).pow(2_u32.pow(3))).to_string(),
            eval_to_string(&g, "1 * -6 + -2 - 1 * -3 ^ 2 ^ 3"),
        );
        assert_eq!((1.0 / 2.0).to_string(), eval_to_string(&g, "1/2"));
        assert_eq!(RunErrorMsg::DivideByZero, eval_to_err(&g, "1 / 0").msg);
        assert_eq!(RunErrorMsg::DivideByZero, eval_to_err(&g, "0/ 0").msg);
    }

    #[test]
    #[parallel]
    fn test_formula_math_operators_on_empty_string() {
        // Empty string should coerce to zero

        let g = Grid::new();

        // Test addition
        assert_eq!("2", eval_to_string(&g, "C6 + 2"));
        assert_eq!("2", eval_to_string(&g, "2 + C6"));

        // Test multiplication
        assert_eq!("0", eval_to_string(&g, "2 * C6"));
        assert_eq!("0", eval_to_string(&g, "C6 * 2"));

        // Test comparisons (very cursed)
        assert_eq!("FALSE", eval_to_string(&g, "1 < C6"));
        assert_eq!("FALSE", eval_to_string(&g, "0 < C6"));
        assert_eq!("TRUE", eval_to_string(&g, "0 <= C6"));
        assert_eq!("TRUE", eval_to_string(&g, "-1 < C6"));
        assert_eq!("TRUE", eval_to_string(&g, "0 = C6"));
        assert_eq!("FALSE", eval_to_string(&g, "1 = C6"));

        // Test string concatenation
        assert_eq!("apple", eval_to_string(&g, "C6 & \"apple\" & D6"));
    }

    #[test]
    #[parallel]
    fn test_formula_datetime_operators() {
        let mut g = Grid::new();

        let val = CellValue::parse_from_str;
        let date = |s| CellValue::from(chrono::NaiveDate::from_str(s).unwrap());
        let time = |s| CellValue::from(chrono::NaiveTime::from_str(s).unwrap());
        let datetime = |s| CellValue::from(chrono::NaiveDateTime::from_str(s).unwrap());

        // Test addition
        for (a, b, expected) in [
            (val("10"), val("51"), Ok("61")),
            (val("10"), val("-51"), Ok("-41")),
            (val("oh"), val("dear"), Err(false)),
            (val("1000d"), val("250 ms"), Ok("1000d 0h 0m 0.25s")),
            (date("1983-09-26"), val("41y"), Ok("2024-09-26")),
            (
                date("1983-09-26"),
                val("41y6mo4h"),
                Ok("2025-03-26 04:00:00"),
            ),
            (
                val("41y6mo4h"),
                date("1983-09-26"),
                Ok("2025-03-26 04:00:00"),
            ),
            (date("1983-09-26"), val("2024-01-01"), Err(true)),
            (date("1983-09-26"), date("2024-01-01"), Err(true)),
            (time("2:30"), time("1:30"), Err(true)),
            (time("2:30"), val("41y6mo4h"), Ok("06:30:00")),
            (date("1983-09-26"), time("2:30"), Ok("1983-09-26 02:30:00")),
            (date("1983-09-26"), time("2:30"), Ok("1983-09-26 02:30:00")),
            (datetime("2024-01-01T12:00:00"), time("3:00"), Err(true)),
            (
                datetime("2024-01-01T12:00:00"),
                date("2001-01-01"),
                Err(true),
            ),
            (
                datetime("2024-01-01T12:00:00"),
                val("30m"),
                Ok("2024-01-01 12:30:00"),
            ),
        ] {
            println!("A1 = {a}");
            println!("A2 = {b}");
            g.sheets_mut()[0].set_cell_value(pos![A1], a);
            g.sheets_mut()[0].set_cell_value(pos![A2], b);

            for formula_str in ["=A1+A2", "=A2+A1"] {
                match expected {
                    Ok(s) => assert_eq!(eval_to_string(&g, formula_str), s),
                    Err(e) => expect_bad_op_err(eval_to_err(&g, formula_str).msg, "add", e),
                }
            }
        }

        // Test subtraction
        for (a, b, expected) in [
            (val("10"), val("51"), Ok("-41")),
            (val("10"), val("-51"), Ok("61")),
            (val("oh"), val("dear"), Err(false)),
            (val("1000d"), val("250 ms"), Ok("999d 23h 59m 59.75s")),
            (val("250 ms"), val("1000d"), Ok("-999d -23h -59m -59.75s")),
            (date("1983-09-26"), val("-41y"), Ok("2024-09-26")),
            (date("2024-09-26"), val("41y"), Ok("1983-09-26")),
            (
                datetime("2025-03-26T04:00:00"),
                date("1983-09-26"),
                Ok("15157d 4h"),
            ),
            (val("41y6mo4h"), date("1983-09-26"), Err(false)),
            (date("1983-09-26"), date("2024-01-01"), Ok("-14707d")),
            (date("2024-01-01"), date("1983-09-26"), Ok("14707d")),
            (time("2:30"), time("1:30"), Ok("1h")),
            (time("1:30"), time("2:30"), Ok("-1h")),
            (time("2:30"), val("41y6mo4h"), Ok("22:30:00")),
            (val("41y6mo4h"), time("2:30"), Err(false)),
            (date("1983-09-26"), time("2:30"), Err(true)),
            (time("2:30"), date("1983-09-26"), Err(true)),
            (datetime("2024-01-01T12:00:00"), time("3:00"), Err(true)),
            (time("3:00"), datetime("2024-01-01T12:00:00"), Err(true)),
            (
                datetime("2024-01-01T12:00:00"),
                date("2001-01-01"),
                Ok("8400d 12h"),
            ),
            (
                date("2001-01-01"),
                datetime("2024-01-01T12:00:00"),
                Ok("-8400d -12h"),
            ),
            (
                datetime("2024-01-01T12:00:00"),
                val("30m"),
                Ok("2024-01-01 11:30:00"),
            ),
            (val("30m"), datetime("2024-01-01T12:00:00"), Err(false)),
        ] {
            println!("A1 = {a}");
            println!("A2 = {b}");
            g.sheets_mut()[0].set_cell_value(pos![A1], a);
            g.sheets_mut()[0].set_cell_value(pos![A2], b);

            match expected {
                Ok(s) => assert_eq!(eval_to_string(&g, "=A1-A2"), s),
                Err(e) => expect_bad_op_err(eval_to_err(&g, "=A1-A2").msg, "subtract", e),
            }
        }
    }

    fn expect_bad_op_err(e: RunErrorMsg, expected_op: &str, is_duration_msg_expected: bool) {
        let RunErrorMsg::BadOp {
            op,
            use_duration_instead,
            ..
        } = e
        else {
            panic!("expected BadOp; got {e}");
        };

        assert_eq!(op, expected_op);
        assert_eq!(use_duration_instead, is_duration_msg_expected);
    }
}
