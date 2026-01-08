use crate::ArraySize;

use super::*;

pub const CATEGORY: FormulaFunctionCategory = FormulaFunctionCategory {
    include_in_docs: false,
    include_in_completions: false,
    name: "Operators",
    docs: None,
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
                let v = match b {
                    Some(b) => CellValue::add(*span, *a, *b),
                    None => CellValue::add(*span, *a, Spanned {
                        span: *span,
                        inner: &0.into(),
                    })
                };
                match v {
                    Ok(spanned) => spanned.inner,
                    Err(e) => CellValue::Error(Box::new(e)),
                }
            }
        ),
        formula_fn!(
            #[operator]
            #[zip_map]
            fn "-"(span: Span, [a]: (Spanned<CellValue>), [b]: (Option<Spanned<CellValue>>)) {
                let v = match b {
                    Some(b) => CellValue::sub(*span, *a, *b),
                    None => CellValue::neg(*a),
                };
                match v {
                    Ok(spanned) => spanned.inner,
                    Err(e) => CellValue::Error(Box::new(e)),
                }
            }
        ),
        formula_fn!(
            #[operator]
            #[zip_map]
            fn "*"(span: Span, [a]: (Spanned<CellValue>), [b]: (Spanned<CellValue>)) {
                match CellValue::mul(*span, *a, *b) {
                    Ok(spanned) => spanned.inner,
                    Err(e) => CellValue::Error(Box::new(e)),
                }
            }
        ),
        formula_fn!(
            #[operator]
            #[zip_map]
            fn "/"(span: Span, [dividend]: (Spanned<CellValue>), [divisor]: (Spanned<CellValue>)) {
                match CellValue::checked_div(*span, *dividend, *divisor) {
                    Ok(spanned) => spanned.inner,
                    Err(e) => CellValue::Error(Box::new(e)),
                }
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
    use crate::{controller::GridController, formulas::tests::*, values::Duration};

    #[test]
    fn test_formula_comparison_ops() {
        fn assert_all_compare_ops_work(lesser: &str, greater: &str) {
            let g = GridController::new();
            let eval =
                |lhs: &str, op: &str, rhs: &str| eval_to_string(&g, &format!("{lhs} {op} {rhs}"));

            assert_eq!(eval(lesser, "<", greater), "TRUE");
            assert_eq!(eval(greater, "<", lesser), "FALSE");
            assert_eq!(eval(greater, "<", greater), "FALSE");

            assert_eq!(eval(lesser, ">", greater), "FALSE");
            assert_eq!(eval(greater, ">", lesser), "TRUE");
            assert_eq!(eval(greater, ">", greater), "FALSE");

            assert_eq!(eval(lesser, "<=", greater), "TRUE");
            assert_eq!(eval(greater, "<=", lesser), "FALSE");
            assert_eq!(eval(greater, "<=", greater), "TRUE");

            assert_eq!(eval(lesser, ">=", greater), "FALSE");
            assert_eq!(eval(greater, ">=", lesser), "TRUE");
            assert_eq!(eval(greater, ">=", greater), "TRUE");

            assert_eq!(eval(lesser, "=", greater), "FALSE");
            assert_eq!(eval(lesser, "==", greater), "FALSE");
            assert_eq!(eval(greater, "=", greater), "TRUE");
            assert_eq!(eval(greater, "==", greater), "TRUE");

            assert_eq!(eval(lesser, "<>", greater), "TRUE");
            assert_eq!(eval(lesser, "!=", greater), "TRUE");
            assert_eq!(eval(greater, "<>", greater), "FALSE");
            assert_eq!(eval(greater, "!=", greater), "FALSE");
        }

        // Test numbers
        assert_all_compare_ops_work("1", "2");

        // Test strings (case-insensitive)
        assert_all_compare_ops_work("'abc'", "'def'");
        assert_all_compare_ops_work("'ABC'", "'def'");
        assert_all_compare_ops_work("'abc'", "'DEF'");
        assert_all_compare_ops_work("'ABC'", "'DEF'");
    }

    #[test]
    #[allow(clippy::identity_op)]
    fn test_formula_math_operators__() {
        let g = GridController::new();

        assert_eq!(
            (1 * -6 + -2 - 1 * (-3_i32).pow(2_u32.pow(3))).to_string(),
            // TODO: `-3 ^ 2` should be parsed as `-(3 ^ 2)`, not `(-3) ^ 2`
            eval_to_string(&g, "1 * -6 + -2 - 1 * -3 ^ 2 ^ 3"),
        );
        assert_eq!((1.0 / 2.0).to_string(), eval_to_string(&g, "1/2"));
        assert_eq!(RunErrorMsg::DivideByZero, eval_to_err(&g, "1 / 0").msg);
        assert_eq!(RunErrorMsg::DivideByZero, eval_to_err(&g, "0/ 0").msg);
    }

    #[test]
    fn test_formula_math_operators_on_empty_string() {
        // Empty string should coerce to zero

        let g = GridController::new();

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
    fn test_formula_datetime_add() {
        let mut g = GridController::new();
        let sheet_id = g.sheet_ids()[0];

        for (a, b, expected) in [
            (val("10"), val("51"), Ok("61")),
            (val("10"), val("-51"), Ok("-41")),
            (val("oh"), val("dear"), Err(false)),
            (
                dur(Duration::from_days(1000.0)),
                dur(Duration::from_milliseconds(250.0)),
                Ok("1000d 0h 0m 0.25s"),
            ),
            (
                date("1983-09-26"),
                dur(Duration::from_years(41)),
                Ok("2024-09-26"),
            ),
            (
                date("1983-09-26"),
                dur(Duration::from_years(41)
                    + Duration::from_months(6)
                    + Duration::from_hours(4.0)),
                Ok("2025-03-26 04:00:00"),
            ),
            (date("1983-09-26"), date("2024-01-01"), Err(true)),
            (time("2:30"), time("1:30"), Err(true)),
            (
                time("2:30"),
                dur(Duration::from_years(41)
                    + Duration::from_months(6)
                    + Duration::from_hours(4.0)),
                Ok("06:30:00"),
            ),
            (date("1983-09-26"), time("2:30"), Ok("1983-09-26 02:30:00")),
            (datetime("2024-01-01T12:00:00"), time("3:00"), Err(true)),
            (
                datetime("2024-01-01T12:00:00"),
                date("2001-01-01"),
                Err(true),
            ),
            (
                datetime("2024-01-01T12:00:00"),
                dur(Duration::from_minutes(30.0)),
                Ok("2024-01-01 12:30:00"),
            ),
            // casting numbers to days or hours
            (date("2024-01-01"), val("16"), Ok("2024-01-17")),
            (date("2024-01-17"), val("-16"), Ok("2024-01-01")),
            (
                datetime("2024-01-17T16:30:00"),
                val("-16.5"),
                Ok("2024-01-01 04:30:00"),
            ),
            (time("12:30"), val("-16.5"), Ok("20:00:00")),
            (dur(Duration::from_hours(12.0)), val("4"), Ok("4d 12h")),
        ] {
            println!("A1 = {a}");
            println!("A2 = {b}");
            g.sheet_mut(sheet_id).set_value(pos![A1], a);
            g.sheet_mut(sheet_id).set_value(pos![A2], b);

            for formula_str in ["=A1+A2", "=A2+A1"] {
                match expected {
                    Ok(s) => assert_eq!(eval_to_string(&g, formula_str), s),
                    Err(e) => expect_bad_op(eval_to_err(&g, formula_str).msg, "add", e),
                }
            }
        }
    }

    #[test]
    fn test_formula_datetime_subtract() {
        let mut g = GridController::new();
        let sheet_id = g.sheet_ids()[0];

        // Test error message formatting
        g.sheet_mut(sheet_id).set_value(
            pos![A1],
            dur(Duration::from_years(41) + Duration::from_months(6) + Duration::from_hours(4.0)),
        );
        g.sheet_mut(sheet_id)
            .set_value(pos![A2], date("1983-09-26"));
        assert_eq!(
            eval_to_err(&g, "=A1-A2").msg.to_string(),
            "Cannot subtract duration and date",
        );
        g.sheet_mut(sheet_id).set_value(pos![A1], time("1:30"));
        assert_eq!(
            eval_to_err(&g, "=A1-A2").msg.to_string(),
            "Cannot subtract time and date; use a duration such as '1y 5d 12h 30m' instead",
        );

        for (a, b, expected) in [
            (val("10"), val("51"), Ok("-41")),
            (val("10"), val("-51"), Ok("61")),
            (val("oh"), val("dear"), Err(false)),
            (
                dur(Duration::from_days(1000.0)),
                dur(Duration::from_milliseconds(250.0)),
                Ok("999d 23h 59m 59.75s"),
            ),
            (
                dur(Duration::from_milliseconds(250.0)),
                dur(Duration::from_days(1000.0)),
                Ok("-999d -23h -59m -59.75s"),
            ),
            (
                date("1983-09-26"),
                dur(-Duration::from_years(41)),
                Ok("2024-09-26"),
            ),
            (
                date("2024-09-26"),
                dur(Duration::from_years(41)),
                Ok("1983-09-26"),
            ),
            (
                datetime("2025-03-26T04:00:00"),
                date("1983-09-26"),
                Ok("15157d 4h"),
            ),
            (
                dur(Duration::from_years(41)
                    + Duration::from_months(6)
                    + Duration::from_hours(4.0)),
                date("1983-09-26"),
                Err(false),
            ),
            (date("1983-09-26"), date("2024-01-01"), Ok("-14707")),
            (date("2024-01-01"), date("1983-09-26"), Ok("14707")),
            (time("2:30"), time("1:30"), Ok("1h")),
            (time("1:30"), time("2:30"), Ok("-1h")),
            (
                time("2:30"),
                dur(Duration::from_years(41)
                    + Duration::from_months(6)
                    + Duration::from_hours(4.0)),
                Ok("22:30:00"),
            ),
            (
                dur(Duration::from_years(41)
                    + Duration::from_months(6)
                    + Duration::from_hours(4.0)),
                time("2:30"),
                Err(false),
            ),
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
                dur(Duration::from_minutes(30.0)),
                Ok("2024-01-01 11:30:00"),
            ),
            (
                dur(Duration::from_minutes(30.0)),
                datetime("2024-01-01T12:00:00"),
                Err(false),
            ),
            // casting numbers to days or hours
            (date("2024-01-17"), val("16"), Ok("2024-01-01")),
            (val("16"), date("2024-01-01"), Err(false)),
            (date("2024-01-01"), val("-16"), Ok("2024-01-17")),
            (val("-16"), date("2024-01-01"), Err(false)),
            (
                datetime("2024-01-01T04:30:00"),
                val("-16.5"),
                Ok("2024-01-17 16:30:00"),
            ),
            (val("-16.5"), datetime("2024-01-01T04:30:00"), Err(false)),
            (time("12:30"), val("16.5"), Ok("20:00:00")),
            (val("16.5"), time("12:30"), Err(false)),
            (dur(Duration::from_hours(12.0)), val("4"), Ok("-3d -12h")),
            (val("4"), dur(Duration::from_hours(12.0)), Ok("3d 12h")),
        ] {
            println!("A1 = {a}");
            println!("A2 = {b}");
            g.sheet_mut(sheet_id).set_value(pos![A1], a);
            g.sheet_mut(sheet_id).set_value(pos![A2], b);

            match expected {
                Ok(s) => assert_eq!(eval_to_string(&g, "=A1-A2"), s),
                Err(e) => expect_bad_op(eval_to_err(&g, "=A1-A2").msg, "subtract", e),
            }
        }
    }

    #[test]
    fn test_formula_datetime_multiply() {
        let mut g = GridController::new();
        let sheet_id = g.sheet_ids()[0];

        for (a, b, expected) in [
            (val("oh"), val("dear"), Err(false)),
            (
                dur(Duration::from_days(1000.0)),
                dur(Duration::from_milliseconds(250.0)),
                Err(false),
            ),
            (
                date("1983-09-26"),
                dur(Duration::from_years(41)),
                Err(false),
            ),
            (
                date("1983-09-26"),
                dur(Duration::from_years(41)
                    + Duration::from_months(6)
                    + Duration::from_hours(4.0)),
                Err(false),
            ),
            (date("1983-09-26"), date("2024-01-01"), Err(false)),
            (time("2:30"), time("1:30"), Err(false)),
            (
                time("2:30"),
                dur(Duration::from_years(41)
                    + Duration::from_months(6)
                    + Duration::from_hours(4.0)),
                Err(false),
            ),
            (date("1983-09-26"), time("2:30"), Err(false)),
            (datetime("2024-01-01T12:00:00"), time("3:00"), Err(false)),
            (
                datetime("2024-01-01T12:00:00"),
                date("2001-01-01"),
                Err(false),
            ),
            (
                datetime("2024-01-01T12:00:00"),
                dur(Duration::from_minutes(30.0)),
                Err(false),
            ),
            // multiplying date/time/datetime/duration types by numbers
            (date("2024-01-01"), val("16"), Err(true)),
            (date("2024-01-17"), val("-16"), Err(true)),
            (datetime("2024-01-17T16:30:00"), val("-16.5"), Err(true)),
            (time("12:30"), val("-16.5"), Err(true)),
            (
                dur(Duration::from_hours(12.0) + Duration::from_minutes(30.0)),
                val("4"),
                Ok("2d 2h"),
            ),
            (
                val("4"),
                dur(Duration::from_hours(12.0) + Duration::from_minutes(30.0)),
                Ok("2d 2h"),
            ),
        ] {
            println!("A1 = {a}");
            println!("A2 = {b}");
            g.sheet_mut(sheet_id).set_value(pos![A1], a);
            g.sheet_mut(sheet_id).set_value(pos![A2], b);

            for formula_str in ["=A1*A2", "=A2*A1"] {
                match expected {
                    Ok(s) => assert_eq!(eval_to_string(&g, formula_str), s),
                    Err(e) => expect_bad_op(eval_to_err(&g, formula_str).msg, "multiply", e),
                }
            }
        }
    }

    #[test]
    fn test_formula_datetime_divide() {
        let mut g = GridController::new();
        let sheet_id = g.sheet_ids()[0];

        for (a, b, expected) in [
            (val("oh"), val("dear"), Err(false)),
            (
                dur(Duration::from_days(1000.0)),
                dur(Duration::from_milliseconds(250.0)),
                Err(false),
            ),
            (
                dur(Duration::from_milliseconds(250.0)),
                dur(Duration::from_days(1000.0)),
                Err(false),
            ),
            (
                date("1983-09-26"),
                dur(-Duration::from_years(41)),
                Err(false),
            ),
            (
                date("2024-09-26"),
                dur(Duration::from_years(41)),
                Err(false),
            ),
            (
                datetime("2025-03-26T04:00:00"),
                date("1983-09-26"),
                Err(false),
            ),
            (
                dur(Duration::from_years(41)
                    + Duration::from_months(6)
                    + Duration::from_hours(4.0)),
                date("1983-09-26"),
                Err(false),
            ),
            (date("1983-09-26"), date("2024-01-01"), Err(false)),
            (date("2024-01-01"), date("1983-09-26"), Err(false)),
            (time("2:30"), time("1:30"), Err(false)),
            (time("1:30"), time("2:30"), Err(false)),
            (
                time("2:30"),
                dur(Duration::from_years(41)
                    + Duration::from_months(6)
                    + Duration::from_hours(4.0)),
                Err(false),
            ),
            (
                dur(Duration::from_years(41)
                    + Duration::from_months(6)
                    + Duration::from_hours(4.0)),
                time("2:30"),
                Err(false),
            ),
            (date("1983-09-26"), time("2:30"), Err(false)),
            (time("2:30"), date("1983-09-26"), Err(false)),
            (datetime("2024-01-01T12:00:00"), time("3:00"), Err(false)),
            (time("3:00"), datetime("2024-01-01T12:00:00"), Err(false)),
            (
                datetime("2024-01-01T12:00:00"),
                date("2001-01-01"),
                Err(false),
            ),
            (
                date("2001-01-01"),
                datetime("2024-01-01T12:00:00"),
                Err(false),
            ),
            (
                datetime("2024-01-01T12:00:00"),
                dur(Duration::from_minutes(30.0)),
                Err(false),
            ),
            (
                dur(Duration::from_minutes(30.0)),
                datetime("2024-01-01T12:00:00"),
                Err(false),
            ),
            // dividing date/time/datetime/duration types by numbers
            (date("2024-01-17"), val("16"), Err(true)),
            (val("16"), date("2024-01-01"), Err(false)),
            (date("2024-01-17"), val("-16"), Err(true)),
            (val("-16"), date("2024-01-17"), Err(false)),
            (datetime("2024-01-01T04:30:00"), val("-16.5"), Err(true)),
            (val("-16.5"), datetime("2024-01-01T04:30:00"), Err(false)),
            (time("12:30"), val("16.5"), Err(true)),
            (val("16.5"), time("12:30"), Err(false)),
            (dur(Duration::from_hours(12.0)), val("4"), Ok("3h")),
            (val("4"), dur(Duration::from_hours(12.0)), Err(false)),
        ] {
            println!("A1 = {a}");
            println!("A2 = {b}");
            g.sheet_mut(sheet_id).set_value(pos![A1], a);
            g.sheet_mut(sheet_id).set_value(pos![A2], b);

            match expected {
                Ok(s) => assert_eq!(eval_to_string(&g, "=A1/A2"), s),
                Err(e) => expect_bad_op(eval_to_err(&g, "=A1/A2").msg, "divide", e),
            }
        }

        // Test division by zero
        let a = dur(Duration::from_hours(12.0));
        let b = val("0");
        println!("A1 = {a}");
        println!("A2 = {b}");
        g.sheet_mut(sheet_id).set_value(pos![A1], a);
        g.sheet_mut(sheet_id).set_value(pos![A2], b);
        assert_eq!(eval_to_err(&g, "=A1/A2").msg, RunErrorMsg::DivideByZero);
    }

    /// Parses a cell value from a string such as `hello` (string) or `31`
    /// (number). Does not parse durations.
    fn val(s: &str) -> CellValue {
        CellValue::parse_from_str(s)
    }

    /// Creates a duration CellValue directly.
    fn dur(d: Duration) -> CellValue {
        CellValue::Duration(d)
    }

    #[track_caller]
    fn expect_bad_op(e: RunErrorMsg, expected_op: &str, is_duration_msg_expected: bool) {
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
