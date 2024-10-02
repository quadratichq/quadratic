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
        // Current date/time
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
        // Constructors
        formula_fn!(
            /// Returns a specific date from a `year`, `month`, and `day`.
            ///
            /// `year`, `month`, and `day` must be numbers, and are rounded to
            /// the nearest integer.
            ///
            /// If `day` is outside the range of days in the given month, then
            /// it overflows and offsets the `month`. For example, `DATE(2024,
            /// 1, 99)` returns `2024-04-08`.
            ///
            /// If `month` is outside the range from `1` to `12` (inclusive),
            /// then it overflows and offsets the `year`. For example,
            /// `DATE(2024, 13, 1)` returns `2025-01-01` and `DATE(2024, 0, 1)`
            /// returns `2023-12-01`.
            ///
            /// _Note that February 29, 1900 does not exist._
            ///
            /// To construct a date time, simply add a date and time. For
            /// example, `DATE(1965, 3, 18) + TIME(8, 34, 51)` was the second
            /// (in UTC) that Alexei Leonov began the first-ever spacewalk.
            #[examples("DATE(2024, 04, 08)", "DATE(1995, 12, 25)", "DATE(1965, 3, 18)")]
            #[zip_map]
            fn DATE(span: Span, [year]: i64, [month]: i64, [day]: i64) {
                // IIFE to mimic try_block
                (|| {
                    let mut ret = chrono::NaiveDate::from_ymd_opt(year.try_into().ok()?, 1, 1)?;

                    ret = match month.checked_sub(1)? {
                        0 => ret,
                        m @ 1.. => {
                            ret.checked_add_months(chrono::Months::new(m.try_into().ok()?))?
                        }
                        m @ ..=-1 => {
                            ret.checked_sub_months(chrono::Months::new((-m).try_into().ok()?))?
                        }
                    };

                    ret = match day.checked_sub(1)? {
                        0 => ret,
                        d @ 1.. => ret.checked_add_days(chrono::Days::new(d.try_into().ok()?))?,
                        d @ ..=-1 => {
                            ret.checked_sub_days(chrono::Days::new((-d).try_into().ok()?))?
                        }
                    };

                    Some(ret)
                })()
                .ok_or(RunErrorMsg::Overflow.with_span(span))?
            }
        ),
        formula_fn!(
            /// Returns a specific time from an `hour`, `minute`, and `second`.
            ///
            /// `hour`, `minute`, and `second` must be numbers. `hour` and
            /// `minute` are rounded to the nearest integer, but `second` may
            /// have a fractional component.
            ///
            /// If `second` is outside the range from `0` to `59` inclusive,
            /// then it is divided by 60. The remainder is used for `second` and
            /// the quotient is added to `minute`. For example, `TIME(9, 0,
            /// 844)` returns `9:14:04 AM`.
            ///
            /// Similarly, if `minute` is outside the range from `0` to `59`
            /// inclusive, then it is divided by 60. The remainder is used for
            /// `minute` and the quotient is added to `hour`. For example,
            /// `TIME(16, 70, 45)` returns `5:10:45 PM` and `TIME(12, -1, -1)`
            /// returns `11:58:59 AM`.
            ///
            /// If `hour` is outside the range from `0` to `23`, then it is
            /// divided by 24. The quotient is discarded and the remainder is
            /// used for `hour`. For example, `TIME(-8, 30, 0)` returns `4:30:00
            /// PM`.
            ///
            /// To construct a date time, simply add a date and time. For
            /// example, `DATE(1969, 7, 21) + TIME(2, 56, 0)` was the minute (in
            /// UTC) that Neil Armstrong became the first person to walk on the
            /// surface of the moon.
            #[examples("TIME(8, 34, 51)", "TIME(2, 56, 0)", "TIME(2,30,59.99)")]
            #[zip_map]
            fn TIME(span: Span, [hour]: i64, [minute]: i64, [second]: f64) {
                const NANO_SECONDS_PER_SECOND: f64 = 1_000_000_000.0;

                (|| {
                    let minute = minute.checked_add(second.div_euclid(60.0) as i64)?;
                    let nanoseconds = ((second - second.floor()) * NANO_SECONDS_PER_SECOND) as u32;
                    let second = second.rem_euclid(60.0).floor() as u32;

                    let hour = hour.checked_add(minute.div_euclid(60) as i64)?;
                    let minute = minute.rem_euclid(60) as u32;

                    let hour = hour.rem_euclid(24) as u32;

                    chrono::NaiveTime::from_hms_nano_opt(hour, minute, second, nanoseconds)
                })()
                .ok_or(RunErrorMsg::Overflow.with_span(span))?
            }
        ),
        formula_fn!(
            /// Returns a duration of `years`, `months`, and `days`.
            ///
            /// `years`, `months`, and `days` must be numbers. `years` and
            /// `months` are rounded to the nearest integer, but `days` may have
            /// a fractional component.
            ///
            /// Months and years are combined, but days are not. For example,
            /// `DURATION.YMD(5, -3, 50)` returns `4y 9mo 50d`.
            ///
            /// To construct a duration longer than one day, simply construct
            /// another duration using `DURATION.YMD` and add it to this one.
            /// For example, `DURATION.YMD(1, 2, 3) + DURATION.HMS(4, 5, 6)`
            /// returns `1y 2mo 3d 4h 5m 6s`.
            #[name = "DURATION.YMD"]
            #[examples(
                "DURATION.YMD(0, 0, 60)",
                "DURATION.YMD(-5, 0, 0)",
                "DURATION.YMD(1, 6, 0)"
            )]
            #[zip_map]
            fn DURATION_YMD(span: Span, [years]: i64, [months]: i64, [days]: i64) {
                // IIFE to mimic try_block
                (|| {
                    Some(
                        Duration::from_years(years.try_into().ok()?)
                            + Duration::from_months(months.try_into().ok()?)
                            + Duration::from_days(days as f64),
                    )
                })()
                .ok_or(RunErrorMsg::Overflow.with_span(span))?
            }
        ),
        formula_fn!(
            /// Returns a duration of `hours`, `minutes`, and `seconds`.
            ///
            /// `hours`, `minutes`, and `seconds` must be numbers. `hours` and
            /// `minutes` are rounded to the nearest integer, but `seconds` may
            /// have a fractional component.
            ///
            /// Seconds, minutes, and hours are combined. For example,
            /// `DURATION.YMD(1, 72, 72)` returns `2h 13m 12s`.
            ///
            /// To construct a duration longer than one day, simply construct
            /// another duration using `DURATION.YMD` and add it to this one.
            /// For example, `DURATION.YMD(1, 2, 3) + DURATION.HMS(4, 5, 6)`
            /// returns `1y 2mo 3d 4h 5m 6s`.
            #[name = "DURATION.HMS"]
            #[examples(
                "DURATION.HMS(0, 2, 30)",
                "DURATION.HMS(6, 0, 0)",
                "DURATION.HMS(24, 0, 0)"
            )]
            #[zip_map]
            fn DURATION_HMS([hours]: i64, [minutes]: i64, [seconds]: f64) {
                Duration::from_hours(hours as f64)
                    + Duration::from_minutes(minutes as f64)
                    + Duration::from_seconds(seconds)
            }
        ),
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

    #[test]
    fn test_formula_date() {
        let g = Grid::new();
        assert_eq!(eval_to_string(&g, "DATE(2024, 4, 8)"), "2024-04-08"); // no wrapping
        assert_eq!(eval_to_string(&g, "DATE(2024, 13, 1)"), "2025-01-01"); // wrap month->year
        assert_eq!(eval_to_string(&g, "DATE(2024, 1, 99)"), "2024-04-08"); // wrap day->month
        assert_eq!(eval_to_string(&g, "DATE(2024, 0, 1)"), "2023-12-01"); // negative wrap month
        assert_eq!(eval_to_string(&g, "DATE(2024, 1, 0)"), "2023-12-31"); // negative wrap day->month->year
        assert_eq!(eval_to_string(&g, "DATE(2024, 0, 0)"), "2023-11-30"); // negative wrap month->year and day->month->year
        assert_eq!(eval_to_string(&g, "DATE(2024, -22, -16)"), "2022-01-15"); // lotsa negatives
        assert_eq!(eval_to_string(&g, "DATE(1900, 2, 29)"), "1900-03-01"); // no 1900-02-29!
    }

    #[test]
    fn test_formula_time() {
        let g = Grid::new();
        assert_eq!(eval_to_string(&g, "TIME(2, 30, 45)"), "02:30:45");
        assert_eq!(eval_to_string(&g, "TIME(2, 30, -45)"), "02:29:15");
        assert_eq!(eval_to_string(&g, "TIME(2, -30, 45)"), "01:30:45");
        assert_eq!(eval_to_string(&g, "TIME(2, -30, -45)"), "01:29:15");
        assert_eq!(eval_to_string(&g, "TIME(-1, 0, 0)"), "23:00:00");
        assert_eq!(eval_to_string(&g, "TIME(999, 72, 235)"), "16:15:55");
    }

    #[test]
    fn test_formula_duration_ymd() {
        let g = Grid::new();
        assert_eq!(eval_to_string(&g, "DURATION.YMD(5, -3, 50)"), "4y 9mo 50d");
        assert_eq!(eval_to_string(&g, "DURATION.YMD(0, 0, 60)"), "60d");
        assert_eq!(eval_to_string(&g, "DURATION.YMD(-5, 0, 999)"), "-5y 999d");
        assert_eq!(eval_to_string(&g, "DURATION.YMD(5, 0, -999)"), "5y -999d");
        assert_eq!(eval_to_string(&g, "DURATION.YMD(1, 18, 0)"), "2y 6mo");
    }

    #[test]
    fn test_formula_duration_hms() {
        let g = Grid::new();
        assert_eq!(eval_to_string(&g, "DURATION.HMS(6, 30, 0)"), "6h 30m");
        assert_eq!(eval_to_string(&g, "DURATION.HMS(0, 6, 30)"), "6m 30s");
        assert_eq!(eval_to_string(&g, "DURATION.HMS(0, 6, 30.2)"), "6m 30.2s");
        assert_eq!(eval_to_string(&g, "DURATION.HMS(0, 0, 0.123)"), "123ms");
        assert_eq!(
            eval_to_string(&g, "DURATION.HMS(999, -3, 50)"),
            "41d 14h 57m 50s",
        );
        assert_eq!(
            eval_to_string(&g, "DURATION.HMS(-5, 62, 30)"),
            "-3h -57m -30s",
        );
    }
}
