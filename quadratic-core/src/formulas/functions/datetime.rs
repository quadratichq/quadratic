use chrono::{Datelike, Months, NaiveDate, Timelike};
use rust_decimal::prelude::*;

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

                    let hour = hour.checked_add(minute.div_euclid(60))?;
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
        // Extracting individual values
        formula_fn!(
            /// Returns the year portion of a date or duration.
            ///
            /// - The year portion of a date or date time is typically between
            ///   `1900` and `2100`.
            /// - The year portion of a time is always `0`.
            /// - The year portion of a duration is rounded down, and may be
            ///   negative. For example, the year portion of `1y 4mo` is `1` and
            ///   the year portion of `-1y -4mo` is `-2`.
            /// - The year portion of a number of days is not well-defined, so
            ///   an error is returned.
            #[examples(
                "YEAR(DATE(2024, 4, 8)) = 2024",
                "YEAR(TIME(30, 16, 45)) = 0",
                "YEAR(DURATION.HMS(6, 10, 15)) = 0",
                "YEAR(DURATION.YMD(1, 2, 3)) = 1",
                "YEAR(DURATION.YMD(-1, -2, 3)) = -2",
                "YEAR(DURATION.YMD(1, 2, 3) + DURATION.HMS(6, 10, 15)) = 1",
                "YEAR(DURATION.YMD(1, 2, 3) - DURATION.HMS(6, 10, 15)) = 1",
                "YEAR(-DURATION.YMD(1, 2, 3) + DURATION.HMS(6, 10, 15)) = -2",
                "YEAR(-DURATION.YMD(1, 2, 3) - DURATION.HMS(6, 10, 15)) = -2"
            )]
            #[zip_map]
            fn YEAR([date]: (Spanned<CellValue>)) {
                match &date.inner {
                    CellValue::Blank => 0,
                    CellValue::DateTime(dt) => dt.year(),
                    CellValue::Date(d) => d.year(),
                    CellValue::Time(_t) => 0,
                    CellValue::Duration(d) => d.years(),
                    CellValue::Text(s) => {
                        if let Some(CellValue::DateTime(dt)) = CellValue::unpack_date_time(s) {
                            dt.year()
                        } else if let Some(CellValue::Date(d)) = CellValue::unpack_date(s) {
                            d.year()
                        } else {
                            return Err(RunErrorMsg::Expected {
                                expected: "date or duration".into(),
                                got: Some(date.inner.type_name().into()),
                            }
                            .with_span(date.span));
                        }
                    }
                    _ => {
                        return Err(RunErrorMsg::Expected {
                            expected: "date or duration".into(),
                            got: Some(date.inner.type_name().into()),
                        }
                        .with_span(date.span));
                    }
                }
            }
        ),
        formula_fn!(
            /// Returns the month portion of a date or duration.
            ///
            /// - The month portion of a date or date time is always between `1`
            ///   and `12` (inclusive).
            /// - The month portion of a time is always `0`.
            /// - The month portion of a duration is always between `0` and
            ///   `11`, even if the duration is negative. For example, the month
            ///   portion of `1y 4mo` is `4` and the month portion of `-1y -4mo`
            ///   is `8`.
            /// - The month portion of a number of days is not well-defined, so
            ///   an error is returned.
            #[examples(
                "MONTH(DATE(2024, 4, 8)) = 4",
                "MONTH(TIME(30, 16, 45)) = 0",
                "MONTH(DURATION.HMS(6, 10, 15)) = 0",
                "MONTH(DURATION.YMD(1, 2, 3)) = 2",
                "MONTH(DURATION.YMD(-1, -2, 3)) = 10",
                "MONTH(DURATION.YMD(1, 2, 3) + DURATION.HMS(6, 10, 15)) = 1",
                "MONTH(DURATION.YMD(1, 2, 3) - DURATION.HMS(6, 10, 15)) = 1",
                "MONTH(-DURATION.YMD(1, 2, 3) + DURATION.HMS(6, 10, 15)) = 1",
                "MONTH(-DURATION.YMD(1, 2, 3) - DURATION.HMS(6, 10, 15)) = 1"
            )]
            #[zip_map]
            fn MONTH([date]: (Spanned<CellValue>)) {
                match &date.inner {
                    CellValue::Blank => 0,
                    CellValue::DateTime(dt) => dt.month(),
                    CellValue::Date(d) => d.month(),
                    CellValue::Time(_t) => 0,
                    CellValue::Duration(d) => d.subyear_months() as u32,
                    CellValue::Text(s) => {
                        if let Some(CellValue::DateTime(dt)) = CellValue::unpack_date_time(s) {
                            dt.month()
                        } else if let Some(CellValue::Date(d)) = CellValue::unpack_date(s) {
                            d.month()
                        } else {
                            return Err(RunErrorMsg::Expected {
                                expected: "date or duration".into(),
                                got: Some(date.inner.type_name().into()),
                            }
                            .with_span(date.span));
                        }
                    }
                    _ => {
                        return Err(RunErrorMsg::Expected {
                            expected: "date or duration".into(),
                            got: Some(date.inner.type_name().into()),
                        }
                        .with_span(date.span));
                    }
                }
            }
        ),
        formula_fn!(
            /// Returns the day portion of a date or duration.
            ///
            /// - The day portion of a date or date time is always between `1`
            ///   and `31` (inclusive).
            /// - The day portion of a time is always `0`.
            /// - The day portion of a duration is rounded down, and may be
            ///   negative.
            /// - The day portion of a number of days is equal to its integer
            ///   part when rounded down.
            #[examples(
                "DAY(DATE(2024, 4, 8)) = 8",
                "DAY(TIME(30, 16, 45)) = 0",
                "DAY(DURATION.HMS(6, 10, 15)) = 0",
                "DAY(DURATION.YMD(1, 2, 3)) = 3",
                "DAY(DURATION.YMD(-1, -2, 3)) = 3",
                "DAY(DURATION.YMD(1, 2, 3) + DURATION.HMS(6, 10, 15)) = 3",
                "DAY(DURATION.YMD(1, 2, 3) - DURATION.HMS(6, 10, 15)) = 2",
                "DAY(-DURATION.YMD(1, 2, 3) + DURATION.HMS(6, 10, 15)) = -3",
                "DAY(-DURATION.YMD(1, 2, 3) - DURATION.HMS(6, 10, 15)) = -4"
            )]
            #[zip_map]
            fn DAY([date]: (Spanned<CellValue>)) {
                match &date.inner {
                    CellValue::Blank => 0,
                    CellValue::Number(n) => {
                        let mut rounded = *n;
                        rounded.rescale(0);
                        rounded
                            .to_i64()
                            .ok_or(RunErrorMsg::Overflow.with_span(date.span))?
                    }
                    CellValue::DateTime(dt) => dt.day() as i64,
                    CellValue::Date(d) => d.day() as i64,
                    CellValue::Time(_t) => 0,
                    CellValue::Duration(d) => d.days(),
                    CellValue::Text(s) => {
                        if let Some(CellValue::DateTime(dt)) = CellValue::unpack_date_time(s) {
                            dt.day() as i64
                        } else if let Some(CellValue::Date(d)) = CellValue::unpack_date(s) {
                            d.day() as i64
                        } else {
                            return Err(RunErrorMsg::Expected {
                                expected: "date, duration, or number".into(),
                                got: Some(date.inner.type_name().into()),
                            }
                            .with_span(date.span));
                        }
                    }
                    _ => {
                        return Err(RunErrorMsg::Expected {
                            expected: "date, duration, or number".into(),
                            got: Some(date.inner.type_name().into()),
                        }
                        .with_span(date.span));
                    }
                }
            }
        ),
        formula_fn!(
            /// Returns the hour portion of a time or duration.
            ///
            /// - The hour portion of a date is always zero.
            /// - The hour portion of a time or date time is always between `0`
            ///   and `23` (inclusive).
            /// - The hour portion of a duration is always between `0` and `23`
            ///   (inclusive), even if the duration is negative.
            /// - The hour portion of a number of days is equal to its
            ///   fractional part, times `24`, rounded down. It is always
            ///   between `0` and `23` (inclusive), even if the original number
            ///   is negative.
            #[examples(
                "HOUR(TIME(30, 16, 45)) = 6",
                "HOUR(TIME(30, 0, -1)) = 5",
                "HOUR(TIME(0, 0, 0)) = 0",
                "HOUR(TIME(0, 0, -1)) = 23",
                "HOUR(789.084) = 2",
                "HOUR(-789.084) = 57",
                "HOUR(DURATION.HMS(6, 10, 15)) = 6",
                "HOUR(DURATION.YMD(1, 2, 3)) = 0",
                "HOUR(DURATION.YMD(1, 2, 3) + DURATION.HMS(6, 10, 15)) = 6",
                "HOUR(DURATION.YMD(1, 2, 3) - DURATION.HMS(6, 10, 15)) = 17",
                "HOUR(-DURATION.YMD(1, 2, 3) + DURATION.HMS(6, 10, 15)) = 6",
                "HOUR(-DURATION.YMD(1, 2, 3) - DURATION.HMS(6, 10, 15)) = 17"
            )]
            #[zip_map]
            fn HOUR([time]: (Spanned<CellValue>)) {
                match &time.inner {
                    CellValue::Blank => 0,
                    CellValue::Number(n) => (n * Decimal::from(24))
                        .floor()
                        .to_i64()
                        .ok_or(RunErrorMsg::Overflow.with_span(time.span))?
                        .rem_euclid(24) as u32,
                    CellValue::DateTime(dt) => dt.hour(),
                    CellValue::Date(_d) => 0,
                    CellValue::Time(t) => t.hour(),
                    CellValue::Duration(d) => d.subday_hours() as u32,
                    CellValue::Text(s) => {
                        // Check time first (most specific for time extraction)
                        if let Some(CellValue::Time(t)) = CellValue::unpack_time(s) {
                            t.hour()
                        // Check date-only before datetime (date-only should return 0)
                        } else if let Some(CellValue::Date(_)) = CellValue::unpack_date(s) {
                            0
                        // Check datetime last (has both date and time components)
                        } else if let Some(CellValue::DateTime(dt)) = CellValue::unpack_date_time(s)
                        {
                            dt.hour()
                        } else {
                            return Err(RunErrorMsg::Expected {
                                expected: "time, duration, or number".into(),
                                got: Some(time.inner.type_name().into()),
                            }
                            .with_span(time.span));
                        }
                    }
                    _ => {
                        return Err(RunErrorMsg::Expected {
                            expected: "time, duration, or number".into(),
                            got: Some(time.inner.type_name().into()),
                        }
                        .with_span(time.span));
                    }
                }
            }
        ),
        formula_fn!(
            /// Returns the minute portion of a time or duration.
            ///
            /// - The minute portion of a date is always zero.
            /// - The minute portion of a time or date time is always between
            ///   `0` and `59` (inclusive).
            /// - The minute portion of a duration is always between `0` and
            ///   `59` (inclusive), even if the duration is negative.
            /// - The minute portion of a number of days is equal to its
            ///   fractional part, times `1440`, rounded down. It is always
            ///   between `0` and `59` (inclusive), even if the original number
            ///   is negative.
            #[examples(
                "MINUTE(TIME(30, 16, 45)) = 16",
                "MINUTE(TIME(30, 0, -1)) = 59",
                "MINUTE(TIME(0, 0, 0)) = 0",
                "MINUTE(TIME(0, 0, -1)) = 59",
                "MINUTE(789.001389) = 2",
                "MINUTE(-789.001389) = 57",
                "MINUTE(DURATION.HMS(6, 10, 15)) = 10",
                "MINUTE(DURATION.YMD(1, 2, 3)) = 0",
                "MINUTE(DURATION.YMD(1, 2, 3) + DURATION.HMS(6, 10, 15)) = 10",
                "MINUTE(DURATION.YMD(1, 2, 3) - DURATION.HMS(6, 10, 15)) = 49",
                "MINUTE(-DURATION.YMD(1, 2, 3) + DURATION.HMS(6, 10, 15)) = 10",
                "MINUTE(-DURATION.YMD(1, 2, 3) - DURATION.HMS(6, 10, 15)) = 49"
            )]
            #[zip_map]
            fn MINUTE([time]: (Spanned<CellValue>)) {
                match &time.inner {
                    CellValue::Blank => 0,
                    CellValue::Number(n) => (n * Decimal::from(1_440))
                        .floor()
                        .to_i64()
                        .ok_or(RunErrorMsg::Overflow.with_span(time.span))?
                        .rem_euclid(60) as u32,
                    CellValue::DateTime(dt) => dt.minute(),
                    CellValue::Date(_d) => 0,
                    CellValue::Time(t) => t.minute(),
                    CellValue::Duration(d) => d.subhour_minutes() as u32,
                    CellValue::Text(s) => {
                        // Check time first (most specific for time extraction)
                        if let Some(CellValue::Time(t)) = CellValue::unpack_time(s) {
                            t.minute()
                        // Check date-only before datetime (date-only should return 0)
                        } else if let Some(CellValue::Date(_)) = CellValue::unpack_date(s) {
                            0
                        // Check datetime last (has both date and time components)
                        } else if let Some(CellValue::DateTime(dt)) = CellValue::unpack_date_time(s)
                        {
                            dt.minute()
                        } else {
                            return Err(RunErrorMsg::Expected {
                                expected: "time, duration, or number".into(),
                                got: Some(time.inner.type_name().into()),
                            }
                            .with_span(time.span));
                        }
                    }
                    _ => {
                        return Err(RunErrorMsg::Expected {
                            expected: "time, duration, or number".into(),
                            got: Some(time.inner.type_name().into()),
                        }
                        .with_span(time.span));
                    }
                }
            }
        ),
        formula_fn!(
            /// Returns the second portion of a time or duration.
            ///
            /// - The second portion of a date is always zero.
            /// - The second portion of a time or date time is always between
            ///   `0` and `59` (inclusive).
            /// - The second portion of a duration is always between `0` and
            ///   `59` (inclusive), even if the duration is negative.
            /// - The second portion of a number of days is equal to its
            ///   fractional part, times `86400`, rounded down. It is always
            ///   between `0` and `59` (inclusive), even if the original number
            ///   is negative.
            #[examples(
                "SECOND(TIME(30, 16, 45)) = 45",
                "SECOND(TIME(30, 0, -1)) = 59",
                "SECOND(TIME(0, 0, 0)) = 0",
                "SECOND(TIME(0, 0, -1)) = 59",
                "SECOND(0.5557291667) = 15",
                "SECOND(-0.5557291667) = 44",
                "SECOND(DURATION.HMS(6, 10, 15)) = 15",
                "SECOND(DURATION.YMD(1, 2, 3)) = 0",
                "SECOND(DURATION.YMD(1, 2, 3) + DURATION.HMS(6, 10, 15)) = 15",
                "SECOND(DURATION.YMD(1, 2, 3) - DURATION.HMS(6, 10, 15)) = 45",
                "SECOND(-DURATION.YMD(1, 2, 3) + DURATION.HMS(6, 10, 15)) = 15",
                "SECOND(-DURATION.YMD(1, 2, 3) - DURATION.HMS(6, 10, 15)) = 45"
            )]
            #[zip_map]
            fn SECOND([time]: (Spanned<CellValue>)) {
                match &time.inner {
                    CellValue::Blank => 0,
                    CellValue::Number(n) => (n * Decimal::from(86_400))
                        .floor()
                        .to_i64()
                        .ok_or(RunErrorMsg::Overflow.with_span(time.span))?
                        .rem_euclid(60) as u32,
                    CellValue::DateTime(dt) => dt.second(),
                    CellValue::Date(_d) => 0,
                    CellValue::Time(t) => t.second(),
                    CellValue::Duration(d) => d.subminute_seconds() as u32,
                    CellValue::Text(s) => {
                        // Check time first (most specific for time extraction)
                        if let Some(CellValue::Time(t)) = CellValue::unpack_time(s) {
                            t.second()
                        // Check date-only before datetime (date-only should return 0)
                        } else if let Some(CellValue::Date(_)) = CellValue::unpack_date(s) {
                            0
                        // Check datetime last (has both date and time components)
                        } else if let Some(CellValue::DateTime(dt)) = CellValue::unpack_date_time(s)
                        {
                            dt.second()
                        } else {
                            return Err(RunErrorMsg::Expected {
                                expected: "time, duration, or number".into(),
                                got: Some(time.inner.type_name().into()),
                            }
                            .with_span(time.span));
                        }
                    }
                    _ => {
                        return Err(RunErrorMsg::Expected {
                            expected: "time, duration, or number".into(),
                            got: Some(time.inner.type_name().into()),
                        }
                        .with_span(time.span));
                    }
                }
            }
        ),
        // Arithmetic
        formula_fn!(
            /// Adds a number of months to a date.
            ///
            /// If the date goes past the end of the month, the last day in the
            /// month is returned.
            #[examples("EDATE(DATE(2024, 04, 08), 8)")]
            #[zip_map]
            fn EDATE(span: Span, [day]: NaiveDate, [months_offset]: i64) {
                add_months_offset_to_day(day, months_offset)
                    .ok_or_else(|| RunErrorMsg::Overflow.with_span(span))?
            }
        ),
        formula_fn!(
            /// Returns the last day of the month that is `months_offset` months
            /// after `day`.
            ///
            /// - If `months_offset` is zero, then the value returned is the
            ///   last day of the month containing `day`.
            /// - If `months_offset` is positive, then the day returned is that
            ///   many months later.
            /// - If `months_offset` is negative, then the day returned is that
            ///   many months earlier.
            #[examples("EOMONTH(DATE(2024, 04, 08))", "EOMONTH(DATE(2024, 04, 08), 8)")]
            #[zip_map]
            fn EOMONTH(span: Span, [day]: NaiveDate, [months_offset]: (Option<i64>)) {
                let day = add_months_offset_to_day(day, months_offset.unwrap_or(0))
                    .ok_or_else(|| RunErrorMsg::Overflow.with_span(span))?;

                // Find last day of month
                (1..=31).rev().find_map(|i| day.with_day(i))
            }
        ),
    ]
}

/// Adds a number of months to a date, or returns `None` in the case of
/// overflow.
///
/// If the date goes past the end of the month, the last day in the month is
/// returned.
fn add_months_offset_to_day(day: NaiveDate, months: i64) -> Option<NaiveDate> {
    if let Ok(m) = u32::try_from(months) {
        day.checked_add_months(Months::new(m))
    } else if let Ok(m) = u32::try_from(months.saturating_neg()) {
        day.checked_sub_months(Months::new(m))
    } else {
        None
    }
}

#[cfg(test)]
mod tests {
    use crate::{controller::GridController, formulas::tests::*};

    #[test]
    fn test_formula_now_today() {
        // Hopefully we get a date time! There's not really anything else we can
        // do to test this without duplicating the code in `fn NOW()`.
        let g = GridController::new();
        assert!(matches!(
            eval(&g, "NOW()"),
            Value::Single(CellValue::DateTime(_)),
        ));

        // Hopefully we get a date!
        let g = GridController::new();
        assert!(matches!(
            eval(&g, "TODAY()"),
            Value::Single(CellValue::Date(_)),
        ));
    }

    #[test]
    fn test_formula_date() {
        let g = GridController::new();
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
        let g = GridController::new();
        assert_eq!(eval_to_string(&g, "TIME(2, 30, 45)"), "02:30:45");
        assert_eq!(eval_to_string(&g, "TIME(2, 30, -45)"), "02:29:15");
        assert_eq!(eval_to_string(&g, "TIME(2, -30, 45)"), "01:30:45");
        assert_eq!(eval_to_string(&g, "TIME(2, -30, -45)"), "01:29:15");
        assert_eq!(eval_to_string(&g, "TIME(-1, 0, 0)"), "23:00:00");
        assert_eq!(eval_to_string(&g, "TIME(999, 72, 235)"), "16:15:55");
    }

    #[test]
    fn test_formula_duration_ymd() {
        let g = GridController::new();
        assert_eq!(eval_to_string(&g, "DURATION.YMD(5, -3, 50)"), "4y 9mo 50d");
        assert_eq!(eval_to_string(&g, "DURATION.YMD(0, 0, 60)"), "60d");
        assert_eq!(eval_to_string(&g, "DURATION.YMD(-5, 0, 999)"), "-5y 999d");
        assert_eq!(eval_to_string(&g, "DURATION.YMD(5, 0, -999)"), "5y -999d");
        assert_eq!(eval_to_string(&g, "DURATION.YMD(1, 18, 0)"), "2y 6mo");
    }

    #[test]
    fn test_formula_duration_hms() {
        let g = GridController::new();
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

    #[test]
    fn test_formula_year() {
        let g = GridController::new();
        assert_eq!(eval_to_string(&g, "YEAR(DATE(2024, 4, 8))"), "2024");
        assert_eq!(eval_to_string(&g, "YEAR(TIME(30, 16, 45))"), "0");
        assert_eq!(eval_to_string(&g, "YEAR(DURATION.HMS(6, 10, 15))"), "0");
        assert_eq!(eval_to_string(&g, "YEAR(DURATION.YMD(1, 2, 3))"), "1");
        assert_eq!(eval_to_string(&g, "YEAR(DURATION.YMD(-1, -2, 3))"), "-2");
        assert_eq!(
            eval_to_string(&g, "YEAR(DURATION.YMD(1, 2, 3) + DURATION.HMS(6, 10, 15))"),
            "1",
        );
        assert_eq!(
            eval_to_string(&g, "YEAR(DURATION.YMD(1, 2, 3) - DURATION.HMS(6, 10, 15))"),
            "1",
        );
        assert_eq!(
            eval_to_string(&g, "YEAR(-DURATION.YMD(1, 2, 3) + DURATION.HMS(6, 10, 15))"),
            "-2",
        );
        assert_eq!(
            eval_to_string(&g, "YEAR(-DURATION.YMD(1, 2, 3) - DURATION.HMS(6, 10, 15))"),
            "-2",
        );
    }

    #[test]
    fn test_formula_month() {
        let g = GridController::new();
        assert_eq!(eval_to_string(&g, "MONTH(DATE(2024, 4, 8))"), "4");
        assert_eq!(eval_to_string(&g, "MONTH(TIME(30, 16, 45))"), "0");
        assert_eq!(eval_to_string(&g, "MONTH(DURATION.HMS(6, 10, 15))"), "0");
        assert_eq!(eval_to_string(&g, "MONTH(DURATION.YMD(1, 2, 3))"), "2");
        assert_eq!(eval_to_string(&g, "MONTH(DURATION.YMD(-1, -2, 3))"), "10");
        assert_eq!(
            eval_to_string(&g, "MONTH(DURATION.YMD(1, 2, 3) + DURATION.HMS(6, 10, 15))"),
            "2",
        );
        assert_eq!(
            eval_to_string(&g, "MONTH(DURATION.YMD(1, 2, 3) - DURATION.HMS(6, 10, 15))"),
            "2",
        );
        assert_eq!(
            eval_to_string(
                &g,
                "MONTH(-DURATION.YMD(1, 2, 3) + DURATION.HMS(6, 10, 15))",
            ),
            "10",
        );
        assert_eq!(
            eval_to_string(
                &g,
                "MONTH(-DURATION.YMD(1, 2, 3) - DURATION.HMS(6, 10, 15))",
            ),
            "10",
        );
    }

    #[test]
    fn test_formula_day() {
        let g = GridController::new();
        assert_eq!(eval_to_string(&g, "DAY(DATE(2024, 4, 8))"), "8");
        assert_eq!(eval_to_string(&g, "DAY(TIME(30, 16, 45))"), "0");
        assert_eq!(eval_to_string(&g, "DAY(DURATION.HMS(6, 10, 15))"), "0");
        assert_eq!(eval_to_string(&g, "DAY(DURATION.YMD(1, 2, 3))"), "3");
        assert_eq!(eval_to_string(&g, "DAY(DURATION.YMD(-1, -2, 3))"), "3");
        assert_eq!(
            eval_to_string(&g, "DAY(DURATION.YMD(1, 2, 3) + DURATION.HMS(6, 10, 15))"),
            "3",
        );
        assert_eq!(
            eval_to_string(&g, "DAY(DURATION.YMD(1, 2, 3) - DURATION.HMS(6, 10, 15))"),
            "2",
        );
        assert_eq!(
            eval_to_string(&g, "DAY(-DURATION.YMD(1, 2, 3) + DURATION.HMS(6, 10, 15))"),
            "-3",
        );
        assert_eq!(
            eval_to_string(&g, "DAY(-DURATION.YMD(1, 2, 3) - DURATION.HMS(6, 10, 15))"),
            "-4",
        );
    }

    #[test]
    fn test_formula_hour() {
        let g = GridController::new();
        assert_eq!(eval_to_string(&g, "HOUR(TIME(30, 16, 45))"), "6");
        assert_eq!(eval_to_string(&g, "HOUR(TIME(30, 0, -1))"), "5");
        assert_eq!(eval_to_string(&g, "HOUR(TIME(0, 0, 0))"), "0");
        assert_eq!(eval_to_string(&g, "HOUR(TIME(0, 0, -1))"), "23");
        assert_eq!(eval_to_string(&g, "HOUR(789.084)"), "2");
        assert_eq!(eval_to_string(&g, "HOUR(-789.084)"), "21");
        assert_eq!(eval_to_string(&g, "HOUR(DURATION.HMS(6, 10, 15))"), "6");
        assert_eq!(eval_to_string(&g, "HOUR(DURATION.YMD(1, 2, 3))"), "0");
        assert_eq!(
            eval_to_string(&g, "HOUR(DURATION.YMD(1, 2, 3) + DURATION.HMS(6, 10, 15))"),
            "6",
        );
        assert_eq!(
            eval_to_string(&g, "HOUR(DURATION.YMD(1, 2, 3) - DURATION.HMS(6, 10, 15))"),
            "17",
        );
        assert_eq!(
            eval_to_string(&g, "HOUR(-DURATION.YMD(1, 2, 3) + DURATION.HMS(6, 10, 15))"),
            "6",
        );
        assert_eq!(
            eval_to_string(&g, "HOUR(-DURATION.YMD(1, 2, 3) - DURATION.HMS(6, 10, 15))"),
            "17",
        );
    }

    #[test]
    fn test_formula_minute() {
        let g = GridController::new();

        assert_eq!(eval_to_string(&g, "MINUTE(TIME(30, 16, 45))"), "16");
        assert_eq!(eval_to_string(&g, "MINUTE(TIME(30, 0, -1))"), "59");
        assert_eq!(eval_to_string(&g, "MINUTE(TIME(0, 0, 0))"), "0");
        assert_eq!(eval_to_string(&g, "MINUTE(TIME(0, 0, -1))"), "59");
        assert_eq!(eval_to_string(&g, "MINUTE(789.001389)"), "2");
        assert_eq!(eval_to_string(&g, "MINUTE(-789.001389)"), "57");
        assert_eq!(eval_to_string(&g, "MINUTE(DURATION.HMS(6, 10, 15))"), "10");
        assert_eq!(eval_to_string(&g, "MINUTE(DURATION.YMD(1, 2, 3))"), "0");
        assert_eq!(
            eval_to_string(
                &g,
                "MINUTE(DURATION.YMD(1, 2, 3) + DURATION.HMS(6, 10, 15))"
            ),
            "10",
        );
        assert_eq!(
            eval_to_string(
                &g,
                "MINUTE(DURATION.YMD(1, 2, 3) - DURATION.HMS(6, 10, 15))"
            ),
            "49",
        );
        assert_eq!(
            eval_to_string(
                &g,
                "MINUTE(-DURATION.YMD(1, 2, 3) + DURATION.HMS(6, 10, 15))"
            ),
            "10",
        );
        assert_eq!(
            eval_to_string(
                &g,
                "MINUTE(-DURATION.YMD(1, 2, 3) - DURATION.HMS(6, 10, 15))"
            ),
            "49",
        );
    }

    #[test]
    fn test_formula_second() {
        let g = GridController::new();
        assert_eq!(eval_to_string(&g, "SECOND(TIME(30, 16, 45))"), "45");
        assert_eq!(eval_to_string(&g, "SECOND(TIME(30, 0, -1))"), "59");
        assert_eq!(eval_to_string(&g, "SECOND(TIME(0, 0, 0))"), "0");
        assert_eq!(eval_to_string(&g, "SECOND(TIME(0, 0, -1))"), "59");
        assert_eq!(eval_to_string(&g, "SECOND(0.5557291667)"), "15");
        assert_eq!(eval_to_string(&g, "SECOND(-0.5557291667)"), "44");
        assert_eq!(eval_to_string(&g, "SECOND(DURATION.HMS(6, 10, 15))"), "15");
        assert_eq!(eval_to_string(&g, "SECOND(DURATION.YMD(1, 2, 3))"), "0");
        assert_eq!(
            eval_to_string(
                &g,
                "SECOND(DURATION.YMD(1, 2, 3) + DURATION.HMS(6, 10, 15))"
            ),
            "15",
        );
        assert_eq!(
            eval_to_string(
                &g,
                "SECOND(DURATION.YMD(1, 2, 3) - DURATION.HMS(6, 10, 15))"
            ),
            "45",
        );
        assert_eq!(
            eval_to_string(
                &g,
                "SECOND(-DURATION.YMD(1, 2, 3) + DURATION.HMS(6, 10, 15))"
            ),
            "15",
        );
        assert_eq!(
            eval_to_string(
                &g,
                "SECOND(-DURATION.YMD(1, 2, 3) - DURATION.HMS(6, 10, 15))"
            ),
            "45",
        );
    }

    #[test]
    fn test_formula_eomonth() {
        let year = 2006; // not before or after a leap year
        let g = GridController::new();
        for (month, expected_final_day) in [(1, 31), (2, 28), (3, 31), (4, 30), (11, 30), (12, 31)]
        {
            for init_day in [1, 2, expected_final_day - 1, expected_final_day] {
                let formula = format!("EOMONTH(DATE({year}, {month}, {init_day}))");
                let expected = format!("{year}-{month:02}-{expected_final_day:02}");
                assert_eq!(expected, eval_to_string(&g, &formula));
            }

            let init_day = 20;
            for month_offset in [-5, -2, 0, 2, 5] {
                let new_month = month - month_offset;
                let formula =
                    format!("EOMONTH(DATE({year}, {new_month}, {init_day}), {month_offset})");
                let expected = format!("{year}-{month:02}-{expected_final_day:02}");
                assert_eq!(expected, eval_to_string(&g, &formula));
            }
        }

        // Test with leap year
        assert_eq!(
            "2008-02-29",
            eval_to_string(&g, "EOMONTH(DATE(2008, 02, 15))"),
        );
        assert_eq!(
            "2008-02-29",
            eval_to_string(&g, "EOMONTH(DATE(2008, 01, 15), 1)"),
        );
    }

    #[test]
    fn test_formula_edate() {
        let g = GridController::new();
        assert_eq!(
            "2008-02-29",
            eval_to_string(&g, "EDATE(DATE(2008, 01, 31), 1)"),
        );
        assert_eq!(
            "2008-03-31",
            eval_to_string(&g, "EDATE(DATE(2008, 01, 31), 2)"),
        );
        assert_eq!(
            "2008-02-28",
            eval_to_string(&g, "EDATE(DATE(2008, 01, 28), 1)"),
        );
        assert_eq!(
            "2008-03-28",
            eval_to_string(&g, "EDATE(DATE(2008, 01, 28), 2)"),
        );
        assert_eq!(
            "2008-02-29",
            eval_to_string(&g, "EDATE(DATE(2008, 03, 30), -1)"),
        );
    }

    #[test]
    fn test_formula_edate_with_string() {
        let g = GridController::new();
        // Test EDATE with string date input (ISO format)
        assert_eq!("2008-02-29", eval_to_string(&g, "EDATE(\"2008-01-31\", 1)"));
        assert_eq!("2024-07-15", eval_to_string(&g, "EDATE(\"2024-04-15\", 3)"),);
        assert_eq!(
            "2024-01-15",
            eval_to_string(&g, "EDATE(\"2024-04-15\", -3)"),
        );
        // Test with MM/DD/YYYY format (2024 is a leap year)
        assert_eq!("2024-02-29", eval_to_string(&g, "EDATE(\"01/31/2024\", 1)"),);
        // Test with non-leap year
        assert_eq!("2023-02-28", eval_to_string(&g, "EDATE(\"01/31/2023\", 1)"),);
    }

    #[test]
    fn test_formula_eomonth_with_string() {
        let g = GridController::new();
        // Test EOMONTH with string date input (returns last day of month)
        assert_eq!("2024-01-31", eval_to_string(&g, "EOMONTH(\"2024-01-15\")"),);
        // With offset 1, returns last day of February (leap year)
        assert_eq!(
            "2024-02-29",
            eval_to_string(&g, "EOMONTH(\"2024-01-15\", 1)"),
        );
        assert_eq!(
            "2024-04-30",
            eval_to_string(&g, "EOMONTH(\"2024-01-15\", 3)"),
        );
    }

    #[test]
    fn test_formula_year_with_string() {
        let g = GridController::new();
        // Test YEAR with string date input
        assert_eq!("2024", eval_to_string(&g, "YEAR(\"2024-04-08\")"));
        assert_eq!("2024", eval_to_string(&g, "YEAR(\"04/08/2024\")"));
        assert_eq!("2024", eval_to_string(&g, "YEAR(\"2024-12-25 14:30:00\")"));
    }

    #[test]
    fn test_formula_month_with_string() {
        let g = GridController::new();
        // Test MONTH with string date input
        assert_eq!("4", eval_to_string(&g, "MONTH(\"2024-04-08\")"));
        assert_eq!("12", eval_to_string(&g, "MONTH(\"12/25/2024\")"));
        assert_eq!("6", eval_to_string(&g, "MONTH(\"2024-06-15 10:30:00\")"));
    }

    #[test]
    fn test_formula_day_with_string() {
        let g = GridController::new();
        // Test DAY with string date input
        assert_eq!("8", eval_to_string(&g, "DAY(\"2024-04-08\")"));
        assert_eq!("25", eval_to_string(&g, "DAY(\"12/25/2024\")"));
        assert_eq!("15", eval_to_string(&g, "DAY(\"2024-06-15 10:30:00\")"));
    }

    #[test]
    fn test_formula_hour_with_string() {
        let g = GridController::new();
        // Test HOUR with string datetime input
        assert_eq!("14", eval_to_string(&g, "HOUR(\"2024-04-08 14:30:45\")"));
        // Test HOUR with string time input
        assert_eq!("16", eval_to_string(&g, "HOUR(\"4:30 PM\")"));
        assert_eq!("9", eval_to_string(&g, "HOUR(\"09:15:30\")"));
        // Test HOUR with date-only string (should return 0)
        assert_eq!("0", eval_to_string(&g, "HOUR(\"2024-04-08\")"));
    }

    #[test]
    fn test_formula_minute_with_string() {
        let g = GridController::new();
        // Test MINUTE with string datetime input
        assert_eq!("30", eval_to_string(&g, "MINUTE(\"2024-04-08 14:30:45\")"));
        // Test MINUTE with string time input
        assert_eq!("45", eval_to_string(&g, "MINUTE(\"2:45 PM\")"));
        assert_eq!("15", eval_to_string(&g, "MINUTE(\"09:15:30\")"));
        // Test MINUTE with date-only string (should return 0)
        assert_eq!("0", eval_to_string(&g, "MINUTE(\"2024-04-08\")"));
    }

    #[test]
    fn test_formula_second_with_string() {
        let g = GridController::new();
        // Test SECOND with string datetime input
        assert_eq!("45", eval_to_string(&g, "SECOND(\"2024-04-08 14:30:45\")"));
        // Test SECOND with string time input
        assert_eq!("30", eval_to_string(&g, "SECOND(\"09:15:30\")"));
        // Test SECOND with date-only string (should return 0)
        assert_eq!("0", eval_to_string(&g, "SECOND(\"2024-04-08\")"));
    }
}
