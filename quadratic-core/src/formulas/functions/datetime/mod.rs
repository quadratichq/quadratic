//! Date and time functions for formulas.

mod calculations;
mod core;

use chrono::{Datelike, Months, NaiveDate};

use super::*;

pub const CATEGORY: FormulaFunctionCategory = FormulaFunctionCategory {
    include_in_docs: true,
    include_in_completions: true,
    name: "Date & time functions",
    docs: Some(include_str!("../datetime_docs.md")),
    get_functions,
};

fn get_functions() -> Vec<FormulaFunction> {
    [core::get_functions(), calculations::get_functions()]
        .into_iter()
        .flatten()
        .collect()
}

// ============================================================================
// Shared helper functions
// ============================================================================

/// Excel epoch base date (December 31, 1899).
/// Excel serial number 1 = January 1, 1900.
const EXCEL_EPOCH: (i32, u32, u32) = (1899, 12, 31);

/// Converts a NaiveDate to an Excel serial number.
/// Excel serial number 1 = January 1, 1900.
/// Note: Excel incorrectly treats 1900 as a leap year (Feb 29, 1900 = serial 60),
/// so we need to add 1 for dates after Feb 28, 1900.
pub(crate) fn date_to_excel_serial(date: NaiveDate) -> i64 {
    let base_date = NaiveDate::from_ymd_opt(EXCEL_EPOCH.0, EXCEL_EPOCH.1, EXCEL_EPOCH.2).unwrap();
    let days = (date - base_date).num_days();

    // Excel incorrectly includes Feb 29, 1900 (serial 60), so add 1 for dates >= March 1, 1900
    // March 1, 1900 is 60 real days after Dec 31, 1899, but should be serial 61
    if days >= 60 { days + 1 } else { days }
}

/// Parses a date from a CellValue.
pub(crate) fn parse_date_from_cell_value(value: &Spanned<CellValue>) -> CodeResult<NaiveDate> {
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

/// Returns true if the given year is a leap year.
pub(crate) fn is_leap_year(year: i32) -> bool {
    (year % 4 == 0 && year % 100 != 0) || (year % 400 == 0)
}

/// Returns the last day of the month for the given date.
pub(crate) fn last_day_of_month(date: NaiveDate) -> u32 {
    match date.month() {
        1 | 3 | 5 | 7 | 8 | 10 | 12 => 31,
        4 | 6 | 9 | 11 => 30,
        2 => {
            if is_leap_year(date.year()) {
                29
            } else {
                28
            }
        }
        // should never happen
        _ => 31,
    }
}

/// Adds a number of months to a date, or returns `None` in the case of
/// overflow.
///
/// If the date goes past the end of the month, the last day in the month is
/// returned.
pub(crate) fn add_months_offset_to_day(day: NaiveDate, months: i64) -> Option<NaiveDate> {
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
    use super::*;

    #[test]
    fn test_is_leap_year() {
        // Common years (not leap years)
        assert!(!is_leap_year(1900)); // divisible by 100 but not 400
        assert!(!is_leap_year(2100)); // divisible by 100 but not 400
        assert!(!is_leap_year(2019)); // not divisible by 4
        assert!(!is_leap_year(2021)); // not divisible by 4

        // Leap years
        assert!(is_leap_year(2000)); // divisible by 400
        assert!(is_leap_year(2400)); // divisible by 400
        assert!(is_leap_year(2020)); // divisible by 4, not by 100
        assert!(is_leap_year(2024)); // divisible by 4, not by 100
        assert!(is_leap_year(1996)); // divisible by 4, not by 100
    }

    #[test]
    fn test_last_day_of_month() {
        // 31-day months
        assert_eq!(
            last_day_of_month(NaiveDate::from_ymd_opt(2024, 1, 15).unwrap()),
            31
        );
        assert_eq!(
            last_day_of_month(NaiveDate::from_ymd_opt(2024, 3, 1).unwrap()),
            31
        );
        assert_eq!(
            last_day_of_month(NaiveDate::from_ymd_opt(2024, 5, 31).unwrap()),
            31
        );
        assert_eq!(
            last_day_of_month(NaiveDate::from_ymd_opt(2024, 7, 10).unwrap()),
            31
        );
        assert_eq!(
            last_day_of_month(NaiveDate::from_ymd_opt(2024, 8, 20).unwrap()),
            31
        );
        assert_eq!(
            last_day_of_month(NaiveDate::from_ymd_opt(2024, 10, 5).unwrap()),
            31
        );
        assert_eq!(
            last_day_of_month(NaiveDate::from_ymd_opt(2024, 12, 25).unwrap()),
            31
        );

        // 30-day months
        assert_eq!(
            last_day_of_month(NaiveDate::from_ymd_opt(2024, 4, 1).unwrap()),
            30
        );
        assert_eq!(
            last_day_of_month(NaiveDate::from_ymd_opt(2024, 6, 15).unwrap()),
            30
        );
        assert_eq!(
            last_day_of_month(NaiveDate::from_ymd_opt(2024, 9, 30).unwrap()),
            30
        );
        assert_eq!(
            last_day_of_month(NaiveDate::from_ymd_opt(2024, 11, 11).unwrap()),
            30
        );

        // February in leap year
        assert_eq!(
            last_day_of_month(NaiveDate::from_ymd_opt(2024, 2, 1).unwrap()),
            29
        );
        assert_eq!(
            last_day_of_month(NaiveDate::from_ymd_opt(2000, 2, 15).unwrap()),
            29
        );

        // February in non-leap year
        assert_eq!(
            last_day_of_month(NaiveDate::from_ymd_opt(2023, 2, 1).unwrap()),
            28
        );
        assert_eq!(
            last_day_of_month(NaiveDate::from_ymd_opt(1900, 2, 15).unwrap()),
            28
        );
        assert_eq!(
            last_day_of_month(NaiveDate::from_ymd_opt(2100, 2, 10).unwrap()),
            28
        );
    }

    #[test]
    fn test_date_to_excel_serial() {
        // Excel serial number 1 = January 1, 1900
        assert_eq!(
            date_to_excel_serial(NaiveDate::from_ymd_opt(1900, 1, 1).unwrap()),
            1
        );

        // Excel serial number 2 = January 2, 1900
        assert_eq!(
            date_to_excel_serial(NaiveDate::from_ymd_opt(1900, 1, 2).unwrap()),
            2
        );

        // Feb 28, 1900 = serial 59
        assert_eq!(
            date_to_excel_serial(NaiveDate::from_ymd_opt(1900, 2, 28).unwrap()),
            59
        );

        // March 1, 1900 = serial 61 (Excel has fake Feb 29 at 60)
        assert_eq!(
            date_to_excel_serial(NaiveDate::from_ymd_opt(1900, 3, 1).unwrap()),
            61
        );

        // Known Excel dates
        assert_eq!(
            date_to_excel_serial(NaiveDate::from_ymd_opt(2024, 1, 1).unwrap()),
            45292
        );
        assert_eq!(
            date_to_excel_serial(NaiveDate::from_ymd_opt(2024, 4, 8).unwrap()),
            45390
        );
    }

    #[test]
    fn test_add_months_offset_to_day() {
        let date = NaiveDate::from_ymd_opt(2024, 1, 15).unwrap();

        // Adding positive months
        assert_eq!(
            add_months_offset_to_day(date, 1),
            NaiveDate::from_ymd_opt(2024, 2, 15)
        );
        assert_eq!(
            add_months_offset_to_day(date, 12),
            NaiveDate::from_ymd_opt(2025, 1, 15)
        );

        // Subtracting months (negative)
        assert_eq!(
            add_months_offset_to_day(date, -1),
            NaiveDate::from_ymd_opt(2023, 12, 15)
        );
        assert_eq!(
            add_months_offset_to_day(date, -13),
            NaiveDate::from_ymd_opt(2022, 12, 15)
        );

        // Zero months
        assert_eq!(
            add_months_offset_to_day(date, 0),
            NaiveDate::from_ymd_opt(2024, 1, 15)
        );

        // End of month handling: Jan 31 + 1 month = Feb 29 (leap year 2024)
        let jan31 = NaiveDate::from_ymd_opt(2024, 1, 31).unwrap();
        assert_eq!(
            add_months_offset_to_day(jan31, 1),
            NaiveDate::from_ymd_opt(2024, 2, 29)
        );

        // End of month handling: Jan 31 + 1 month = Feb 28 (non-leap year 2023)
        let jan31_2023 = NaiveDate::from_ymd_opt(2023, 1, 31).unwrap();
        assert_eq!(
            add_months_offset_to_day(jan31_2023, 1),
            NaiveDate::from_ymd_opt(2023, 2, 28)
        );
    }
}
