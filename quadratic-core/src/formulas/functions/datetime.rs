use chrono::{Datelike, Months, NaiveDate, Timelike};
use rust_decimal::prelude::*;

/// Excel epoch base date (December 31, 1899).
/// Excel serial number 1 = January 1, 1900.
const EXCEL_EPOCH: (i32, u32, u32) = (1899, 12, 31);

/// Converts a NaiveDate to an Excel serial number.
/// Excel serial number 1 = January 1, 1900.
/// Note: Excel incorrectly treats 1900 as a leap year (Feb 29, 1900 = serial 60),
/// so we need to add 1 for dates after Feb 28, 1900.
fn date_to_excel_serial(date: NaiveDate) -> i64 {
    let base_date = NaiveDate::from_ymd_opt(EXCEL_EPOCH.0, EXCEL_EPOCH.1, EXCEL_EPOCH.2).unwrap();
    let days = (date - base_date).num_days();

    // Excel incorrectly includes Feb 29, 1900 (serial 60), so add 1 for dates >= March 1, 1900
    // March 1, 1900 is 60 real days after Dec 31, 1899, but should be serial 61
    if days >= 60 { days + 1 } else { days }
}

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
        // Date difference functions
        formula_fn!(
            /// Calculates the difference between two dates in various units.
            ///
            /// `unit` specifies the type of difference to calculate:
            /// - `"Y"` - Complete years between the dates
            /// - `"M"` - Complete months between the dates
            /// - `"D"` - Days between the dates
            /// - `"MD"` - Days between the dates, ignoring months and years
            /// - `"YM"` - Months between the dates, ignoring years
            /// - `"YD"` - Days between the dates, ignoring years
            ///
            /// Note: `start_date` must be less than or equal to `end_date`.
            #[examples(
                "DATEDIF(DATE(2020, 1, 1), DATE(2024, 4, 8), \"Y\")",
                "DATEDIF(DATE(2020, 1, 1), DATE(2024, 4, 8), \"M\")",
                "DATEDIF(DATE(2020, 1, 1), DATE(2024, 4, 8), \"D\")"
            )]
            #[zip_map]
            fn DATEDIF(span: Span, [start_date]: NaiveDate, [end_date]: NaiveDate, [unit]: String) {
                if start_date > end_date {
                    return Err(RunErrorMsg::Expected {
                        expected: "start_date <= end_date".into(),
                        got: Some("start_date > end_date".into()),
                    }
                    .with_span(span));
                }

                let unit_upper = unit.to_uppercase();
                match unit_upper.as_str() {
                    "Y" => {
                        // Complete years
                        let mut years = end_date.year() - start_date.year();
                        if (end_date.month(), end_date.day())
                            < (start_date.month(), start_date.day())
                        {
                            years -= 1;
                        }
                        years as i64
                    }
                    "M" => {
                        // Complete months
                        let mut months = (end_date.year() - start_date.year()) * 12
                            + (end_date.month() as i32 - start_date.month() as i32);
                        if end_date.day() < start_date.day() {
                            months -= 1;
                        }
                        months as i64
                    }
                    "D" => {
                        // Days between dates
                        (end_date - start_date).num_days()
                    }
                    "MD" => {
                        // Days, ignoring months and years
                        let mut day_diff = end_date.day() as i32 - start_date.day() as i32;
                        if day_diff < 0 {
                            // Get days in the previous month
                            let prev_month = if end_date.month() == 1 {
                                NaiveDate::from_ymd_opt(end_date.year() - 1, 12, 1)
                            } else {
                                NaiveDate::from_ymd_opt(end_date.year(), end_date.month() - 1, 1)
                            };
                            if let Some(prev) = prev_month {
                                let days_in_prev_month = (1..=31)
                                    .rev()
                                    .find_map(|d| prev.with_day(d))
                                    .map(|d| d.day())
                                    .unwrap_or(30);
                                day_diff += days_in_prev_month as i32;
                            }
                        }
                        day_diff as i64
                    }
                    "YM" => {
                        // Months, ignoring years
                        let mut months = end_date.month() as i32 - start_date.month() as i32;
                        if end_date.day() < start_date.day() {
                            months -= 1;
                        }
                        if months < 0 {
                            months += 12;
                        }
                        months as i64
                    }
                    "YD" => {
                        // Days, ignoring years
                        let start_in_end_year = NaiveDate::from_ymd_opt(
                            end_date.year(),
                            start_date.month(),
                            start_date.day(),
                        )
                        .or_else(|| {
                            // Handle Feb 29 in non-leap year
                            NaiveDate::from_ymd_opt(end_date.year(), start_date.month(), 28)
                        });
                        if let Some(start_adj) = start_in_end_year {
                            let mut days = (end_date - start_adj).num_days();
                            if days < 0 {
                                // Use previous year
                                let start_in_prev_year = NaiveDate::from_ymd_opt(
                                    end_date.year() - 1,
                                    start_date.month(),
                                    start_date.day(),
                                )
                                .or_else(|| {
                                    NaiveDate::from_ymd_opt(
                                        end_date.year() - 1,
                                        start_date.month(),
                                        28,
                                    )
                                });
                                if let Some(start_prev) = start_in_prev_year {
                                    days = (end_date - start_prev).num_days();
                                }
                            }
                            days
                        } else {
                            return Err(RunErrorMsg::Overflow.with_span(span));
                        }
                    }
                    _ => {
                        return Err(RunErrorMsg::Expected {
                            expected: "unit (Y, M, D, MD, YM, or YD)".into(),
                            got: Some(format!("\"{}\"", unit).into()),
                        }
                        .with_span(span));
                    }
                }
            }
        ),
        formula_fn!(
            /// Converts a date represented as text to an Excel serial number.
            ///
            /// The serial number is a numeric value where 1 represents January 1,
            /// 1900. This is useful for compatibility with other spreadsheet
            /// applications that use serial numbers for date calculations.
            #[examples(
                "DATEVALUE(\"2024-04-08\")",
                "DATEVALUE(\"04/08/2024\")",
                "DATEVALUE(\"April 8, 2024\")"
            )]
            #[zip_map]
            fn DATEVALUE(span: Span, [date_text]: (Spanned<CellValue>)) {
                let date = match &date_text.inner {
                    CellValue::Date(d) => *d,
                    CellValue::DateTime(dt) => dt.date(),
                    CellValue::Text(s) => {
                        if let Some(CellValue::Date(d)) = CellValue::unpack_date(s) {
                            d
                        } else if let Some(CellValue::DateTime(dt)) = CellValue::unpack_date_time(s)
                        {
                            dt.date()
                        } else {
                            return Err(RunErrorMsg::Expected {
                                expected: "date text".into(),
                                got: Some("invalid date string".into()),
                            }
                            .with_span(date_text.span));
                        }
                    }
                    _ => {
                        return Err(RunErrorMsg::Expected {
                            expected: "date or date text".into(),
                            got: Some(date_text.inner.type_name().into()),
                        }
                        .with_span(date_text.span));
                    }
                };
                date_to_excel_serial(date)
            }
        ),
        formula_fn!(
            /// Converts a time represented as text to a decimal number.
            ///
            /// The decimal number is a value between 0 and 1 representing the
            /// time as a fraction of a day. For example, 12:00 PM returns 0.5
            /// (half a day), and 6:00 AM returns 0.25 (quarter of a day).
            ///
            /// This is useful for compatibility with other spreadsheet
            /// applications that use decimal numbers for time calculations.
            #[examples(
                "TIMEVALUE(\"12:00 PM\")",
                "TIMEVALUE(\"06:00:00\")",
                "TIMEVALUE(\"2:30:45 PM\")"
            )]
            #[zip_map]
            fn TIMEVALUE([time_text]: (Spanned<CellValue>)) {
                let time = match &time_text.inner {
                    CellValue::Time(t) => *t,
                    CellValue::DateTime(dt) => dt.time(),
                    CellValue::Text(s) => {
                        if let Some(CellValue::Time(t)) = CellValue::unpack_time(s) {
                            t
                        } else if let Some(CellValue::DateTime(dt)) = CellValue::unpack_date_time(s)
                        {
                            dt.time()
                        } else {
                            return Err(RunErrorMsg::Expected {
                                expected: "time text".into(),
                                got: Some("invalid time string".into()),
                            }
                            .with_span(time_text.span));
                        }
                    }
                    _ => {
                        return Err(RunErrorMsg::Expected {
                            expected: "time or time text".into(),
                            got: Some(time_text.inner.type_name().into()),
                        }
                        .with_span(time_text.span));
                    }
                };

                // Convert time to fraction of a day
                // seconds_from_midnight / seconds_per_day
                let seconds_from_midnight = time.num_seconds_from_midnight() as f64
                    + (time.nanosecond() as f64 / 1_000_000_000.0);
                let seconds_per_day = 86_400.0;
                seconds_from_midnight / seconds_per_day
            }
        ),
        formula_fn!(
            /// Returns the number of days between two dates.
            ///
            /// The result is positive if `end_date` is after `start_date`,
            /// negative if `end_date` is before `start_date`, and zero if they
            /// are the same date.
            #[examples(
                "DAYS(DATE(2024, 4, 8), DATE(2024, 1, 1))",
                "DAYS(\"2024-12-31\", \"2024-01-01\")"
            )]
            #[zip_map]
            fn DAYS([end_date]: NaiveDate, [start_date]: NaiveDate) {
                (end_date - start_date).num_days()
            }
        ),
        formula_fn!(
            /// Returns the number of days between two dates based on a 360-day
            /// year (twelve 30-day months).
            ///
            /// This is commonly used in accounting and financial calculations.
            ///
            /// If `method` is `FALSE` or omitted, the US (NASD) method is used:
            /// - If the start day is 31, it becomes 30
            /// - If the end day is 31 and the start day is 30 or 31, the end day becomes 30
            ///
            /// If `method` is `TRUE`, the European method is used:
            /// - Both start and end days of 31 become 30
            #[examples(
                "DAYS360(DATE(2024, 1, 1), DATE(2024, 4, 8))",
                "DAYS360(DATE(2024, 1, 1), DATE(2024, 4, 8), TRUE)"
            )]
            #[zip_map]
            fn DAYS360([start_date]: NaiveDate, [end_date]: NaiveDate, [method]: (Option<bool>)) {
                let european = method.unwrap_or(false);

                let mut start_day = start_date.day() as i32;
                let mut end_day = end_date.day() as i32;
                let start_month = start_date.month() as i32;
                let end_month = end_date.month() as i32;
                let start_year = start_date.year();
                let end_year = end_date.year();

                if european {
                    // European method: both 31s become 30
                    if start_day == 31 {
                        start_day = 30;
                    }
                    if end_day == 31 {
                        end_day = 30;
                    }
                } else {
                    // US (NASD) method
                    // Check if start_date is last day of February
                    let is_start_last_day_of_feb = start_date.month() == 2
                        && start_day == last_day_of_month(start_date) as i32;
                    // Check if end_date is last day of February
                    let is_end_last_day_of_feb =
                        end_date.month() == 2 && end_day == last_day_of_month(end_date) as i32;

                    if is_start_last_day_of_feb && is_end_last_day_of_feb {
                        end_day = 30;
                    }
                    if is_start_last_day_of_feb {
                        start_day = 30;
                    }
                    if start_day == 31 {
                        start_day = 30;
                    }
                    if end_day == 31 && start_day >= 30 {
                        end_day = 30;
                    }
                }

                let days = (end_year - start_year) * 360
                    + (end_month - start_month) * 30
                    + (end_day - start_day);
                days as i64
            }
        ),
        formula_fn!(
            /// Returns the ISO week number of the year for a given date.
            ///
            /// ISO weeks start on Monday and the first week of the year contains
            /// the first Thursday. Week numbers range from 1 to 52 or 53.
            #[examples(
                "ISOWEEKNUM(DATE(2024, 1, 1))",
                "ISOWEEKNUM(DATE(2024, 4, 8))",
                "ISOWEEKNUM(\"2024-12-31\")"
            )]
            #[zip_map]
            fn ISOWEEKNUM([date]: NaiveDate) {
                date.iso_week().week() as i64
            }
        ),
        formula_fn!(
            /// Returns the day of the week corresponding to a date.
            ///
            /// The `return_type` parameter controls the numbering:
            /// - `1` (default): 1 = Sunday, 7 = Saturday
            /// - `2`: 1 = Monday, 7 = Sunday
            /// - `3`: 0 = Monday, 6 = Sunday
            /// - `11`: 1 = Monday, 7 = Sunday
            /// - `12`: 1 = Tuesday, 7 = Monday
            /// - `13`: 1 = Wednesday, 7 = Tuesday
            /// - `14`: 1 = Thursday, 7 = Wednesday
            /// - `15`: 1 = Friday, 7 = Thursday
            /// - `16`: 1 = Saturday, 7 = Friday
            /// - `17`: 1 = Sunday, 7 = Saturday
            #[examples(
                "WEEKDAY(DATE(2024, 4, 8))",
                "WEEKDAY(DATE(2024, 4, 8), 1)",
                "WEEKDAY(DATE(2024, 4, 8), 2)"
            )]
            #[zip_map]
            fn WEEKDAY(span: Span, [date]: NaiveDate, [return_type]: (Option<i64>)) {
                let return_type = return_type.unwrap_or(1);
                // chrono: Monday = 0, Sunday = 6 (weekday().num_days_from_monday())
                let day_from_monday = date.weekday().num_days_from_monday() as i64; // 0=Mon, 6=Sun

                // chrono: Monday = 0, ..., Sunday = 6
                match return_type {
                    1 | 17 => {
                        // 1=Sunday, 2=Monday, ..., 7=Saturday
                        // Transform: Sun(6)->1, Mon(0)->2, ..., Sat(5)->7
                        (day_from_monday + 1) % 7 + 1
                    }
                    2 | 11 => {
                        // 1=Monday, 2=Tuesday, ..., 7=Sunday
                        day_from_monday + 1
                    }
                    3 => {
                        // 0=Monday, 1=Tuesday, ..., 6=Sunday
                        day_from_monday
                    }
                    12 => {
                        // 1=Tuesday, 2=Wednesday, ..., 7=Monday
                        // Transform: Tue(1)->1, Wed(2)->2, ..., Mon(0)->7
                        (day_from_monday + 6) % 7 + 1
                    }
                    13 => {
                        // 1=Wednesday, 2=Thursday, ..., 7=Tuesday
                        (day_from_monday + 5) % 7 + 1
                    }
                    14 => {
                        // 1=Thursday, 2=Friday, ..., 7=Wednesday
                        (day_from_monday + 4) % 7 + 1
                    }
                    15 => {
                        // 1=Friday, 2=Saturday, ..., 7=Thursday
                        (day_from_monday + 3) % 7 + 1
                    }
                    16 => {
                        // 1=Saturday, 2=Sunday, ..., 7=Friday
                        (day_from_monday + 2) % 7 + 1
                    }
                    _ => {
                        return Err(RunErrorMsg::Expected {
                            expected: "return_type (1, 2, 3, or 11-17)".into(),
                            got: Some(format!("{}", return_type).into()),
                        }
                        .with_span(span));
                    }
                }
            }
        ),
        formula_fn!(
            /// Returns the week number of a specific date.
            ///
            /// The `return_type` parameter controls when weeks begin:
            /// - `1` (default): Week begins on Sunday. Week 1 contains January 1.
            /// - `2`: Week begins on Monday. Week 1 contains January 1.
            /// - `11`: Week begins on Monday. Week 1 contains January 1.
            /// - `12`: Week begins on Tuesday. Week 1 contains January 1.
            /// - `13`: Week begins on Wednesday. Week 1 contains January 1.
            /// - `14`: Week begins on Thursday. Week 1 contains January 1.
            /// - `15`: Week begins on Friday. Week 1 contains January 1.
            /// - `16`: Week begins on Saturday. Week 1 contains January 1.
            /// - `17`: Week begins on Sunday. Week 1 contains January 1.
            /// - `21`: ISO week number (week begins Monday, first week contains first Thursday).
            #[examples(
                "WEEKNUM(DATE(2024, 1, 1))",
                "WEEKNUM(DATE(2024, 4, 8))",
                "WEEKNUM(DATE(2024, 4, 8), 2)"
            )]
            #[zip_map]
            fn WEEKNUM(span: Span, [date]: NaiveDate, [return_type]: (Option<i64>)) {
                let return_type = return_type.unwrap_or(1);

                if return_type == 21 {
                    // ISO week number
                    return Ok(CellValue::from(date.iso_week().week() as i64));
                }

                // Determine which day starts the week (0=Monday, 6=Sunday in our internal representation)
                let week_start = match return_type {
                    1 | 17 => 6, // Sunday
                    2 | 11 => 0, // Monday
                    12 => 1,     // Tuesday
                    13 => 2,     // Wednesday
                    14 => 3,     // Thursday
                    15 => 4,     // Friday
                    16 => 5,     // Saturday
                    _ => {
                        return Err(RunErrorMsg::Expected {
                            expected: "return_type (1, 2, 11-17, or 21)".into(),
                            got: Some(format!("{}", return_type).into()),
                        }
                        .with_span(span));
                    }
                };

                // Calculate week number
                // Week 1 is the week containing January 1
                let jan1 = NaiveDate::from_ymd_opt(date.year(), 1, 1).unwrap();
                let jan1_weekday = jan1.weekday().num_days_from_monday() as i64;

                // Days from week_start to Jan 1's weekday
                let jan1_offset = (jan1_weekday - week_start + 7) % 7;

                // Days from Jan 1 to the given date
                let days_since_jan1 = (date - jan1).num_days();

                // Week number
                ((days_since_jan1 + jan1_offset) / 7 + 1) as i64
            }
        ),
        formula_fn!(
            /// Returns the number of whole workdays between two dates.
            ///
            /// Workdays exclude weekends (Saturday and Sunday) and optionally
            /// specified holidays.
            ///
            /// If `end_date` is before `start_date`, a negative number is returned.
            #[examples(
                "NETWORKDAYS(DATE(2024, 1, 1), DATE(2024, 1, 31))",
                "NETWORKDAYS(DATE(2024, 1, 1), DATE(2024, 1, 31), {DATE(2024, 1, 15)})"
            )]
            fn NETWORKDAYS(
                span: Span,
                start_date: (Spanned<CellValue>),
                end_date: (Spanned<CellValue>),
                holidays: (Option<Spanned<Array>>),
            ) {
                let start_date = parse_date_from_cell_value(&start_date)?;
                let end_date = parse_date_from_cell_value(&end_date)?;
                let holiday_set = parse_holidays_array(holidays, span)?;

                // Weekend mask: Saturday and Sunday
                let weekend = [false, false, false, false, false, true, true]; // Mon-Sun
                count_networkdays(start_date, end_date, &weekend, &holiday_set)
            }
        ),
        formula_fn!(
            /// Returns the number of whole workdays between two dates using
            /// custom weekend parameters.
            ///
            /// The `weekend` parameter can be:
            /// - A number from 1-7 or 11-17 specifying weekend days
            /// - A 7-character string of 1s and 0s (1=weekend, starting Monday)
            ///
            /// Weekend number meanings:
            /// - `1` (default): Saturday, Sunday
            /// - `2`: Sunday, Monday
            /// - `3`: Monday, Tuesday
            /// - `4`: Tuesday, Wednesday
            /// - `5`: Wednesday, Thursday
            /// - `6`: Thursday, Friday
            /// - `7`: Friday, Saturday
            /// - `11`: Sunday only
            /// - `12`: Monday only
            /// - `13`: Tuesday only
            /// - `14`: Wednesday only
            /// - `15`: Thursday only
            /// - `16`: Friday only
            /// - `17`: Saturday only
            #[name = "NETWORKDAYS.INTL"]
            #[examples(
                "NETWORKDAYS.INTL(DATE(2024, 1, 1), DATE(2024, 1, 31))",
                "NETWORKDAYS.INTL(DATE(2024, 1, 1), DATE(2024, 1, 31), 1)",
                "NETWORKDAYS.INTL(DATE(2024, 1, 1), DATE(2024, 1, 31), \"0000011\")"
            )]
            fn NETWORKDAYS_INTL(
                span: Span,
                start_date: (Spanned<CellValue>),
                end_date: (Spanned<CellValue>),
                weekend: (Option<Spanned<CellValue>>),
                holidays: (Option<Spanned<Array>>),
            ) {
                let start_date = parse_date_from_cell_value(&start_date)?;
                let end_date = parse_date_from_cell_value(&end_date)?;
                let holiday_set = parse_holidays_array(holidays, span)?;
                let weekend_mask = parse_weekend_param(weekend, span)?;
                count_networkdays(start_date, end_date, &weekend_mask, &holiday_set)
            }
        ),
        formula_fn!(
            /// Returns a date that is the indicated number of working days
            /// before or after a start date.
            ///
            /// Workdays exclude weekends (Saturday and Sunday) and optionally
            /// specified holidays.
            ///
            /// If `days` is negative, the date returned is before `start_date`.
            #[examples(
                "WORKDAY(DATE(2024, 1, 1), 10)",
                "WORKDAY(DATE(2024, 1, 1), -5)",
                "WORKDAY(DATE(2024, 1, 1), 10, {DATE(2024, 1, 15)})"
            )]
            fn WORKDAY(
                span: Span,
                start_date: (Spanned<CellValue>),
                days: i64,
                holidays: (Option<Spanned<Array>>),
            ) {
                let start_date = parse_date_from_cell_value(&start_date)?;
                let holiday_set = parse_holidays_array(holidays, span)?;

                // Weekend mask: Saturday and Sunday
                let weekend = [false, false, false, false, false, true, true]; // Mon-Sun
                calculate_workday(start_date, days, &weekend, &holiday_set)
                    .ok_or_else(|| RunErrorMsg::Overflow.with_span(span))?
            }
        ),
        formula_fn!(
            /// Returns a date that is the indicated number of working days
            /// before or after a start date, using custom weekend parameters.
            ///
            /// The `weekend` parameter can be:
            /// - A number from 1-7 or 11-17 specifying weekend days
            /// - A 7-character string of 1s and 0s (1=weekend, starting Monday)
            ///
            /// See `NETWORKDAYS.INTL` for weekend number meanings.
            #[name = "WORKDAY.INTL"]
            #[examples(
                "WORKDAY.INTL(DATE(2024, 1, 1), 10)",
                "WORKDAY.INTL(DATE(2024, 1, 1), 10, 1)",
                "WORKDAY.INTL(DATE(2024, 1, 1), 10, \"0000011\")"
            )]
            fn WORKDAY_INTL(
                span: Span,
                start_date: (Spanned<CellValue>),
                days: i64,
                weekend: (Option<Spanned<CellValue>>),
                holidays: (Option<Spanned<Array>>),
            ) {
                let start_date = parse_date_from_cell_value(&start_date)?;
                let holiday_set = parse_holidays_array(holidays, span)?;
                let weekend_mask = parse_weekend_param(weekend, span)?;
                calculate_workday(start_date, days, &weekend_mask, &holiday_set)
                    .ok_or_else(|| RunErrorMsg::Overflow.with_span(span))?
            }
        ),
        formula_fn!(
            /// Returns the fraction of the year represented by the number of
            /// whole days between two dates.
            ///
            /// The `basis` parameter specifies the day count basis:
            /// - `0` (default): US (NASD) 30/360
            /// - `1`: Actual/actual
            /// - `2`: Actual/360
            /// - `3`: Actual/365
            /// - `4`: European 30/360
            #[examples(
                "YEARFRAC(DATE(2024, 1, 1), DATE(2024, 7, 1))",
                "YEARFRAC(DATE(2024, 1, 1), DATE(2024, 7, 1), 0)",
                "YEARFRAC(DATE(2024, 1, 1), DATE(2024, 7, 1), 1)"
            )]
            #[zip_map]
            fn YEARFRAC(
                span: Span,
                [start_date]: NaiveDate,
                [end_date]: NaiveDate,
                [basis]: (Option<i64>),
            ) {
                let basis = basis.unwrap_or(0);

                // Ensure start_date <= end_date, swap if needed and track sign
                let (start, end, sign) = if start_date <= end_date {
                    (start_date, end_date, 1.0)
                } else {
                    (end_date, start_date, -1.0)
                };

                let result = match basis {
                    0 => {
                        // US (NASD) 30/360
                        let days = days360_us(start, end) as f64;
                        days / 360.0
                    }
                    1 => {
                        // Actual/actual
                        yearfrac_actual(start, end)
                    }
                    2 => {
                        // Actual/360
                        let days = (end - start).num_days() as f64;
                        days / 360.0
                    }
                    3 => {
                        // Actual/365
                        let days = (end - start).num_days() as f64;
                        days / 365.0
                    }
                    4 => {
                        // European 30/360
                        let days = days360_eu(start, end) as f64;
                        days / 360.0
                    }
                    _ => {
                        return Err(RunErrorMsg::Expected {
                            expected: "basis (0, 1, 2, 3, or 4)".into(),
                            got: Some(format!("{}", basis).into()),
                        }
                        .with_span(span));
                    }
                };

                result * sign
            }
        ),
    ]
}

/// Parses a date from a CellValue.
fn parse_date_from_cell_value(value: &Spanned<CellValue>) -> CodeResult<NaiveDate> {
    match &value.inner {
        CellValue::Date(d) => Ok(*d),
        CellValue::DateTime(dt) => Ok(dt.date()),
        CellValue::Text(s) => {
            if let Some(CellValue::Date(d)) = CellValue::unpack_date(s) {
                Ok(d)
            } else if let Some(CellValue::DateTime(dt)) = CellValue::unpack_date_time(s) {
                Ok(dt.date())
            } else {
                Err(RunErrorMsg::Expected {
                    expected: "date".into(),
                    got: Some("invalid date string".into()),
                }
                .with_span(value.span))
            }
        }
        _ => Err(RunErrorMsg::Expected {
            expected: "date".into(),
            got: Some(value.inner.type_name().into()),
        }
        .with_span(value.span)),
    }
}

/// Parses an optional holidays array into a HashSet of dates.
fn parse_holidays_array(
    holidays: Option<Spanned<Array>>,
    span: Span,
) -> CodeResult<std::collections::HashSet<NaiveDate>> {
    let Some(holidays) = holidays else {
        return Ok(std::collections::HashSet::new());
    };

    let mut holiday_set = std::collections::HashSet::new();
    for cell_value in holidays.inner.cell_values_slice() {
        match cell_value {
            CellValue::Date(d) => {
                holiday_set.insert(*d);
            }
            CellValue::DateTime(dt) => {
                holiday_set.insert(dt.date());
            }
            CellValue::Text(s) => {
                if let Some(CellValue::Date(d)) = CellValue::unpack_date(s) {
                    holiday_set.insert(d);
                } else if let Some(CellValue::DateTime(dt)) = CellValue::unpack_date_time(s) {
                    holiday_set.insert(dt.date());
                } else {
                    return Err(RunErrorMsg::Expected {
                        expected: "date".into(),
                        got: Some("invalid date string".into()),
                    }
                    .with_span(span));
                }
            }
            CellValue::Blank => {
                // Skip blank cells
            }
            _ => {
                return Err(RunErrorMsg::Expected {
                    expected: "date".into(),
                    got: Some(cell_value.type_name().into()),
                }
                .with_span(span));
            }
        }
    }
    Ok(holiday_set)
}

/// Parses the weekend parameter for NETWORKDAYS.INTL and WORKDAY.INTL.
/// Returns an array of 7 booleans where true = weekend (Mon to Sun).
fn parse_weekend_param(weekend: Option<Spanned<CellValue>>, _span: Span) -> CodeResult<[bool; 7]> {
    let Some(weekend) = weekend else {
        // Default: Saturday and Sunday
        return Ok([false, false, false, false, false, true, true]);
    };

    match &weekend.inner {
        CellValue::Number(n) => {
            let n = n.to_i64().ok_or_else(|| {
                RunErrorMsg::Expected {
                    expected: "weekend number (1-7 or 11-17)".into(),
                    got: Some("invalid number".into()),
                }
                .with_span(weekend.span)
            })?;

            // Map weekend number to weekend days
            // Numbers 1-7: two consecutive days
            // Numbers 11-17: single day
            match n {
                1 => Ok([false, false, false, false, false, true, true]), // Sat, Sun
                2 => Ok([true, false, false, false, false, false, true]), // Sun, Mon
                3 => Ok([true, true, false, false, false, false, false]), // Mon, Tue
                4 => Ok([false, true, true, false, false, false, false]), // Tue, Wed
                5 => Ok([false, false, true, true, false, false, false]), // Wed, Thu
                6 => Ok([false, false, false, true, true, false, false]), // Thu, Fri
                7 => Ok([false, false, false, false, true, true, false]), // Fri, Sat
                11 => Ok([false, false, false, false, false, false, true]), // Sun only
                12 => Ok([true, false, false, false, false, false, false]), // Mon only
                13 => Ok([false, true, false, false, false, false, false]), // Tue only
                14 => Ok([false, false, true, false, false, false, false]), // Wed only
                15 => Ok([false, false, false, true, false, false, false]), // Thu only
                16 => Ok([false, false, false, false, true, false, false]), // Fri only
                17 => Ok([false, false, false, false, false, true, false]), // Sat only
                _ => Err(RunErrorMsg::Expected {
                    expected: "weekend number (1-7 or 11-17)".into(),
                    got: Some(format!("{}", n).into()),
                }
                .with_span(weekend.span)),
            }
        }
        CellValue::Text(s) => {
            if s.len() != 7 || !s.chars().all(|c| c == '0' || c == '1') {
                return Err(RunErrorMsg::Expected {
                    expected: "7-character string of 0s and 1s".into(),
                    got: Some(format!("\"{}\"", s).into()),
                }
                .with_span(weekend.span));
            }

            // All 1s means all days are weekends, which is invalid
            if s == "1111111" {
                return Err(RunErrorMsg::Expected {
                    expected: "at least one workday".into(),
                    got: Some("all days are weekends".into()),
                }
                .with_span(weekend.span));
            }

            let mut result = [false; 7];
            for (i, c) in s.chars().enumerate() {
                result[i] = c == '1';
            }
            Ok(result)
        }
        CellValue::Blank => {
            // Default: Saturday and Sunday
            Ok([false, false, false, false, false, true, true])
        }
        _ => Err(RunErrorMsg::Expected {
            expected: "weekend number or string".into(),
            got: Some(weekend.inner.type_name().into()),
        }
        .with_span(weekend.span)),
    }
}

/// Counts the number of workdays between two dates.
fn count_networkdays(
    start_date: NaiveDate,
    end_date: NaiveDate,
    weekend: &[bool; 7],
    holidays: &std::collections::HashSet<NaiveDate>,
) -> i64 {
    if start_date > end_date {
        return -count_networkdays(end_date, start_date, weekend, holidays);
    }

    let mut count = 0i64;
    let mut current = start_date;
    while current <= end_date {
        let weekday = current.weekday().num_days_from_monday() as usize;
        if !weekend[weekday] && !holidays.contains(&current) {
            count += 1;
        }
        current = current.succ_opt().unwrap_or(current);
        if current == start_date {
            break; // Overflow protection
        }
    }
    count
}

/// Calculates the date after a given number of workdays.
fn calculate_workday(
    start_date: NaiveDate,
    days: i64,
    weekend: &[bool; 7],
    holidays: &std::collections::HashSet<NaiveDate>,
) -> Option<NaiveDate> {
    if days == 0 {
        return Some(start_date);
    }

    let direction: i64 = if days > 0 { 1 } else { -1 };
    let mut remaining = days.abs();
    let mut current = start_date;

    while remaining > 0 {
        current = if direction > 0 {
            current.succ_opt()?
        } else {
            current.pred_opt()?
        };

        let weekday = current.weekday().num_days_from_monday() as usize;
        if !weekend[weekday] && !holidays.contains(&current) {
            remaining -= 1;
        }
    }

    Some(current)
}

/// Calculates US (NASD) 30/360 day count.
fn days360_us(start: NaiveDate, end: NaiveDate) -> i64 {
    let mut start_day = start.day() as i32;
    let mut end_day = end.day() as i32;
    let start_month = start.month() as i32;
    let end_month = end.month() as i32;
    let start_year = start.year();
    let end_year = end.year();

    // Check if start_date is last day of February
    let is_start_last_day_of_feb =
        start.month() == 2 && start_day == last_day_of_month(start) as i32;
    // Check if end_date is last day of February
    let is_end_last_day_of_feb = end.month() == 2 && end_day == last_day_of_month(end) as i32;

    if is_start_last_day_of_feb && is_end_last_day_of_feb {
        end_day = 30;
    }
    if is_start_last_day_of_feb {
        start_day = 30;
    }
    if start_day == 31 {
        start_day = 30;
    }
    if end_day == 31 && start_day >= 30 {
        end_day = 30;
    }

    let days =
        (end_year - start_year) * 360 + (end_month - start_month) * 30 + (end_day - start_day);
    days as i64
}

/// Calculates European 30/360 day count.
fn days360_eu(start: NaiveDate, end: NaiveDate) -> i64 {
    let mut start_day = start.day() as i32;
    let mut end_day = end.day() as i32;
    let start_month = start.month() as i32;
    let end_month = end.month() as i32;
    let start_year = start.year();
    let end_year = end.year();

    if start_day == 31 {
        start_day = 30;
    }
    if end_day == 31 {
        end_day = 30;
    }

    let days =
        (end_year - start_year) * 360 + (end_month - start_month) * 30 + (end_day - start_day);
    days as i64
}

/// Calculates YEARFRAC using actual/actual basis.
fn yearfrac_actual(start: NaiveDate, end: NaiveDate) -> f64 {
    let days = (end - start).num_days() as f64;

    // Determine the denominator based on whether the period spans a leap year
    let start_year = start.year();
    let end_year = end.year();

    if start_year == end_year {
        // Same year - use that year's day count
        let year_days = if is_leap_year(start_year) {
            366.0
        } else {
            365.0
        };
        days / year_days
    } else {
        // Different years - calculate the weighted average
        let mut total_fraction = 0.0;

        // Days in start year
        let end_of_start_year = NaiveDate::from_ymd_opt(start_year, 12, 31).unwrap();
        let days_in_start_year = (end_of_start_year - start).num_days() as f64 + 1.0;
        let start_year_days = if is_leap_year(start_year) {
            366.0
        } else {
            365.0
        };
        total_fraction += days_in_start_year / start_year_days;

        // Full years in between
        for _year in (start_year + 1)..end_year {
            total_fraction += 1.0;
        }

        // Days in end year
        let start_of_end_year = NaiveDate::from_ymd_opt(end_year, 1, 1).unwrap();
        let days_in_end_year = (end - start_of_end_year).num_days() as f64;
        let end_year_days = if is_leap_year(end_year) { 366.0 } else { 365.0 };
        total_fraction += days_in_end_year / end_year_days;

        total_fraction
    }
}

/// Returns true if the given year is a leap year.
fn is_leap_year(year: i32) -> bool {
    (year % 4 == 0 && year % 100 != 0) || (year % 400 == 0)
}

/// Returns the last day of the month for the given date.
fn last_day_of_month(date: NaiveDate) -> u32 {
    (1..=31)
        .rev()
        .find_map(|d| date.with_day(d))
        .map(|d| d.day())
        .unwrap_or(28)
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

    #[test]
    fn test_formula_datedif() {
        let g = GridController::new();
        // Test complete years
        assert_eq!(
            "4",
            eval_to_string(&g, "DATEDIF(DATE(2020, 1, 1), DATE(2024, 4, 8), \"Y\")")
        );
        assert_eq!(
            "3",
            eval_to_string(&g, "DATEDIF(DATE(2020, 5, 1), DATE(2024, 4, 8), \"Y\")")
        );

        // Test complete months
        assert_eq!(
            "51",
            eval_to_string(&g, "DATEDIF(DATE(2020, 1, 1), DATE(2024, 4, 8), \"M\")")
        );
        assert_eq!(
            "3",
            eval_to_string(&g, "DATEDIF(DATE(2024, 1, 15), DATE(2024, 4, 20), \"M\")")
        );

        // Test days
        assert_eq!(
            "1559",
            eval_to_string(&g, "DATEDIF(DATE(2020, 1, 1), DATE(2024, 4, 8), \"D\")")
        );
        assert_eq!(
            "0",
            eval_to_string(&g, "DATEDIF(DATE(2024, 4, 8), DATE(2024, 4, 8), \"D\")")
        );

        // Test MD (days ignoring months and years)
        assert_eq!(
            "7",
            eval_to_string(&g, "DATEDIF(DATE(2020, 1, 1), DATE(2024, 4, 8), \"MD\")")
        );

        // Test YM (months ignoring years)
        assert_eq!(
            "3",
            eval_to_string(&g, "DATEDIF(DATE(2020, 1, 1), DATE(2024, 4, 8), \"YM\")")
        );

        // Test YD (days ignoring years)
        assert_eq!(
            "98",
            eval_to_string(&g, "DATEDIF(DATE(2020, 1, 1), DATE(2024, 4, 8), \"YD\")")
        );

        // Test case insensitivity
        assert_eq!(
            "4",
            eval_to_string(&g, "DATEDIF(DATE(2020, 1, 1), DATE(2024, 4, 8), \"y\")")
        );
    }

    #[test]
    fn test_formula_datevalue() {
        let g = GridController::new();
        // January 1, 1900 = serial 1
        assert_eq!("1", eval_to_string(&g, "DATEVALUE(\"1900-01-01\")"));
        // January 2, 1900 = serial 2
        assert_eq!("2", eval_to_string(&g, "DATEVALUE(\"1900-01-02\")"));
        // March 1, 1900 = serial 61 (Excel's leap year bug adds 1)
        assert_eq!("61", eval_to_string(&g, "DATEVALUE(\"1900-03-01\")"));
        // A modern date
        assert_eq!("45390", eval_to_string(&g, "DATEVALUE(\"2024-04-08\")"));
        // Test with MM/DD/YYYY format
        assert_eq!("45390", eval_to_string(&g, "DATEVALUE(\"04/08/2024\")"));
        // Test with DATE function
        assert_eq!("45390", eval_to_string(&g, "DATEVALUE(DATE(2024, 4, 8))"));
    }

    #[test]
    fn test_formula_timevalue() {
        let g = GridController::new();
        // Noon = 0.5 (half a day)
        assert_eq!("0.5", eval_to_string(&g, "TIMEVALUE(\"12:00 PM\")"));
        assert_eq!("0.5", eval_to_string(&g, "TIMEVALUE(\"12:00:00\")"));

        // Midnight = 0
        assert_eq!("0", eval_to_string(&g, "TIMEVALUE(\"12:00 AM\")"));
        assert_eq!("0", eval_to_string(&g, "TIMEVALUE(\"00:00:00\")"));

        // 6:00 AM = 0.25 (quarter of a day)
        assert_eq!("0.25", eval_to_string(&g, "TIMEVALUE(\"06:00:00\")"));
        assert_eq!("0.25", eval_to_string(&g, "TIMEVALUE(\"6:00 AM\")"));

        // 6:00 PM = 0.75 (three quarters of a day)
        assert_eq!("0.75", eval_to_string(&g, "TIMEVALUE(\"18:00:00\")"));
        assert_eq!("0.75", eval_to_string(&g, "TIMEVALUE(\"6:00 PM\")"));

        // 2:30:45 PM = (14*3600 + 30*60 + 45) / 86400 ≈ 0.604687...
        let result = eval_to_string(&g, "TIMEVALUE(\"2:30:45 PM\")");
        let value: f64 = result.parse().unwrap();
        assert!((value - 0.604687).abs() < 0.0001);

        // Test with TIME function (returns Time value)
        assert_eq!("0.5", eval_to_string(&g, "TIMEVALUE(TIME(12, 0, 0))"));
        assert_eq!("0.25", eval_to_string(&g, "TIMEVALUE(TIME(6, 0, 0))"));

        // Test with datetime string (extracts time part)
        let result = eval_to_string(&g, "TIMEVALUE(\"2024-04-08 14:30:00\")");
        let value: f64 = result.parse().unwrap();
        assert!((value - 0.604166667).abs() < 0.0001);
    }

    #[test]
    fn test_formula_days() {
        let g = GridController::new();
        // Basic difference
        assert_eq!(
            "98",
            eval_to_string(&g, "DAYS(DATE(2024, 4, 8), DATE(2024, 1, 1))")
        );
        // Same date = 0
        assert_eq!(
            "0",
            eval_to_string(&g, "DAYS(DATE(2024, 4, 8), DATE(2024, 4, 8))")
        );
        // Negative (end before start)
        assert_eq!(
            "-98",
            eval_to_string(&g, "DAYS(DATE(2024, 1, 1), DATE(2024, 4, 8))")
        );
        // Across years
        assert_eq!(
            "366",
            eval_to_string(&g, "DAYS(DATE(2025, 1, 1), DATE(2024, 1, 1))")
        );
        // With string dates
        assert_eq!(
            "365",
            eval_to_string(&g, "DAYS(\"2024-12-31\", \"2024-01-01\")")
        );
    }

    #[test]
    fn test_formula_days360() {
        let g = GridController::new();
        // Basic calculation (US method)
        assert_eq!(
            "97",
            eval_to_string(&g, "DAYS360(DATE(2024, 1, 1), DATE(2024, 4, 8))")
        );
        // European method
        assert_eq!(
            "97",
            eval_to_string(&g, "DAYS360(DATE(2024, 1, 1), DATE(2024, 4, 8), TRUE)")
        );
        // Full year should be 360 days
        assert_eq!(
            "360",
            eval_to_string(&g, "DAYS360(DATE(2024, 1, 1), DATE(2025, 1, 1))")
        );
        // Test day 31 handling (US method): Jan 30 (adjusted) to Mar 1 = 2*30 + (1-30) = 31
        assert_eq!(
            "31",
            eval_to_string(&g, "DAYS360(DATE(2024, 1, 31), DATE(2024, 3, 1))")
        );
        // Test day 31 handling (European method): Jan 30 (adjusted) to Mar 1 = 31
        assert_eq!(
            "31",
            eval_to_string(&g, "DAYS360(DATE(2024, 1, 31), DATE(2024, 3, 1), TRUE)")
        );
        // Both dates on 31st (US method): Jan 30 to Mar 30 = 60
        assert_eq!(
            "60",
            eval_to_string(&g, "DAYS360(DATE(2024, 1, 31), DATE(2024, 3, 31))")
        );
        // Both dates on 31st (European method): Jan 30 to Mar 30 = 60
        assert_eq!(
            "60",
            eval_to_string(&g, "DAYS360(DATE(2024, 1, 31), DATE(2024, 3, 31), TRUE)")
        );
    }

    #[test]
    fn test_formula_isoweeknum() {
        let g = GridController::new();
        // January 1, 2024 is in week 1 (Monday start)
        assert_eq!("1", eval_to_string(&g, "ISOWEEKNUM(DATE(2024, 1, 1))"));
        // April 8, 2024 (a Monday)
        assert_eq!("15", eval_to_string(&g, "ISOWEEKNUM(DATE(2024, 4, 8))"));
        // December 31, 2024
        assert_eq!("1", eval_to_string(&g, "ISOWEEKNUM(DATE(2024, 12, 31))"));
        // Test with string date
        assert_eq!("15", eval_to_string(&g, "ISOWEEKNUM(\"2024-04-08\")"));
        // January 1, 2023 (Sunday, belongs to week 52 of 2022)
        assert_eq!("52", eval_to_string(&g, "ISOWEEKNUM(DATE(2023, 1, 1))"));
    }

    #[test]
    fn test_formula_weekday() {
        let g = GridController::new();
        // April 8, 2024 is a Monday
        // Default return_type=1: 1=Sunday, 7=Saturday -> Monday = 2
        assert_eq!("2", eval_to_string(&g, "WEEKDAY(DATE(2024, 4, 8))"));
        assert_eq!("2", eval_to_string(&g, "WEEKDAY(DATE(2024, 4, 8), 1)"));
        // return_type=2: 1=Monday, 7=Sunday -> Monday = 1
        assert_eq!("1", eval_to_string(&g, "WEEKDAY(DATE(2024, 4, 8), 2)"));
        // return_type=3: 0=Monday, 6=Sunday -> Monday = 0
        assert_eq!("0", eval_to_string(&g, "WEEKDAY(DATE(2024, 4, 8), 3)"));

        // April 7, 2024 is a Sunday
        assert_eq!("1", eval_to_string(&g, "WEEKDAY(DATE(2024, 4, 7), 1)")); // Sunday = 1
        assert_eq!("7", eval_to_string(&g, "WEEKDAY(DATE(2024, 4, 7), 2)")); // Sunday = 7

        // April 13, 2024 is a Saturday
        assert_eq!("7", eval_to_string(&g, "WEEKDAY(DATE(2024, 4, 13), 1)")); // Saturday = 7
        assert_eq!("6", eval_to_string(&g, "WEEKDAY(DATE(2024, 4, 13), 2)")); // Saturday = 6

        // Test with string date
        assert_eq!("2", eval_to_string(&g, "WEEKDAY(\"2024-04-08\")"));

        // January 15, 2024 is a Monday
        assert_eq!("2", eval_to_string(&g, "WEEKDAY(\"2024-01-15\")")); // Monday = 2 in default mode
        assert_eq!("2", eval_to_string(&g, "WEEKDAY(DATE(2024, 1, 15))")); // Same via DATE()
    }

    #[test]
    fn test_formula_weeknum() {
        let g = GridController::new();
        // January 1, 2024 (Monday) - week 1 in all systems
        assert_eq!("1", eval_to_string(&g, "WEEKNUM(DATE(2024, 1, 1))"));
        assert_eq!("1", eval_to_string(&g, "WEEKNUM(DATE(2024, 1, 1), 1)"));
        assert_eq!("1", eval_to_string(&g, "WEEKNUM(DATE(2024, 1, 1), 2)"));

        // April 8, 2024
        assert_eq!("15", eval_to_string(&g, "WEEKNUM(DATE(2024, 4, 8), 1)"));
        assert_eq!("15", eval_to_string(&g, "WEEKNUM(DATE(2024, 4, 8), 2)"));

        // ISO week number
        assert_eq!("15", eval_to_string(&g, "WEEKNUM(DATE(2024, 4, 8), 21)"));

        // December 31, 2024 (Tuesday)
        assert_eq!("53", eval_to_string(&g, "WEEKNUM(DATE(2024, 12, 31), 1)"));
    }

    #[test]
    fn test_formula_networkdays() {
        let g = GridController::new();
        // January 2024: Jan 1 is Monday
        // Workdays from Jan 1 to Jan 31 = 23 workdays
        assert_eq!(
            "23",
            eval_to_string(&g, "NETWORKDAYS(DATE(2024, 1, 1), DATE(2024, 1, 31))")
        );

        // Same date = 1 workday (Monday)
        assert_eq!(
            "1",
            eval_to_string(&g, "NETWORKDAYS(DATE(2024, 1, 1), DATE(2024, 1, 1))")
        );

        // Weekend only = 0 workdays
        assert_eq!(
            "0",
            eval_to_string(&g, "NETWORKDAYS(DATE(2024, 1, 6), DATE(2024, 1, 7))")
        ); // Sat-Sun

        // Negative (end before start)
        assert_eq!(
            "-23",
            eval_to_string(&g, "NETWORKDAYS(DATE(2024, 1, 31), DATE(2024, 1, 1))")
        );

        // With a holiday
        assert_eq!(
            "22",
            eval_to_string(
                &g,
                "NETWORKDAYS(DATE(2024, 1, 1), DATE(2024, 1, 31), {DATE(2024, 1, 15)})"
            )
        );
    }

    #[test]
    fn test_formula_networkdays_intl() {
        let g = GridController::new();
        // Default (weekend = Sat-Sun)
        assert_eq!(
            "23",
            eval_to_string(&g, "NETWORKDAYS.INTL(DATE(2024, 1, 1), DATE(2024, 1, 31))")
        );

        // Weekend = 1 (Sat-Sun) explicit
        assert_eq!(
            "23",
            eval_to_string(
                &g,
                "NETWORKDAYS.INTL(DATE(2024, 1, 1), DATE(2024, 1, 31), 1)"
            )
        );

        // Weekend = 11 (Sunday only) -> 27 workdays
        assert_eq!(
            "27",
            eval_to_string(
                &g,
                "NETWORKDAYS.INTL(DATE(2024, 1, 1), DATE(2024, 1, 31), 11)"
            )
        );

        // Weekend as string "0000011" (Sat-Sun)
        assert_eq!(
            "23",
            eval_to_string(
                &g,
                "NETWORKDAYS.INTL(DATE(2024, 1, 1), DATE(2024, 1, 31), \"0000011\")"
            )
        );

        // Weekend as string "1000001" (Sun-Mon)
        assert_eq!(
            "22",
            eval_to_string(
                &g,
                "NETWORKDAYS.INTL(DATE(2024, 1, 1), DATE(2024, 1, 31), \"1000001\")"
            )
        );
    }

    #[test]
    fn test_formula_workday() {
        let g = GridController::new();
        // 10 workdays from Jan 1, 2024 (Monday) = Jan 15, 2024 (Monday)
        assert_eq!(
            "2024-01-15",
            eval_to_string(&g, "WORKDAY(DATE(2024, 1, 1), 10)")
        );

        // 0 workdays = same date
        assert_eq!(
            "2024-01-01",
            eval_to_string(&g, "WORKDAY(DATE(2024, 1, 1), 0)")
        );

        // -5 workdays from Jan 10, 2024 (Wednesday) = Jan 3, 2024 (Wednesday)
        assert_eq!(
            "2024-01-03",
            eval_to_string(&g, "WORKDAY(DATE(2024, 1, 10), -5)")
        );

        // With holiday: 10 workdays from Jan 1, skipping Jan 15 = Jan 16
        assert_eq!(
            "2024-01-16",
            eval_to_string(&g, "WORKDAY(DATE(2024, 1, 1), 10, {DATE(2024, 1, 15)})")
        );
    }

    #[test]
    fn test_formula_workday_intl() {
        let g = GridController::new();
        // Default weekend (Sat-Sun)
        assert_eq!(
            "2024-01-15",
            eval_to_string(&g, "WORKDAY.INTL(DATE(2024, 1, 1), 10)")
        );

        // Weekend = 11 (Sunday only)
        assert_eq!(
            "2024-01-12",
            eval_to_string(&g, "WORKDAY.INTL(DATE(2024, 1, 1), 10, 11)")
        );

        // Weekend as string
        assert_eq!(
            "2024-01-15",
            eval_to_string(&g, "WORKDAY.INTL(DATE(2024, 1, 1), 10, \"0000011\")")
        );
    }

    #[test]
    fn test_formula_yearfrac() {
        let g = GridController::new();
        // Half year (US 30/360)
        // From Jan 1 to Jul 1 = 180 days / 360 = 0.5
        assert_eq!(
            "0.5",
            eval_to_string(&g, "YEARFRAC(DATE(2024, 1, 1), DATE(2024, 7, 1), 0)")
        );

        // Actual/actual in same year (leap year 2024)
        // From Jan 1 to Jul 1 = 182 days / 366 ≈ 0.497...
        let result = eval_to_string(&g, "YEARFRAC(DATE(2024, 1, 1), DATE(2024, 7, 1), 1)");
        let value: f64 = result.parse().unwrap();
        assert!((value - 0.497267759).abs() < 0.001);

        // Actual/360
        // From Jan 1 to Jul 1 = 182 days / 360 ≈ 0.505...
        let result = eval_to_string(&g, "YEARFRAC(DATE(2024, 1, 1), DATE(2024, 7, 1), 2)");
        let value: f64 = result.parse().unwrap();
        assert!((value - 0.505555556).abs() < 0.001);

        // Actual/365
        // From Jan 1 to Jul 1 = 182 days / 365 ≈ 0.498...
        let result = eval_to_string(&g, "YEARFRAC(DATE(2024, 1, 1), DATE(2024, 7, 1), 3)");
        let value: f64 = result.parse().unwrap();
        assert!((value - 0.498630137).abs() < 0.001);

        // European 30/360
        assert_eq!(
            "0.5",
            eval_to_string(&g, "YEARFRAC(DATE(2024, 1, 1), DATE(2024, 7, 1), 4)")
        );

        // Reverse dates should give negative value
        assert_eq!(
            "-0.5",
            eval_to_string(&g, "YEARFRAC(DATE(2024, 7, 1), DATE(2024, 1, 1), 0)")
        );
    }
}
