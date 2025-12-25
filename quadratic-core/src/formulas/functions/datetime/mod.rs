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
pub(crate) fn add_months_offset_to_day(day: NaiveDate, months: i64) -> Option<NaiveDate> {
    if let Ok(m) = u32::try_from(months) {
        day.checked_add_months(Months::new(m))
    } else if let Ok(m) = u32::try_from(months.saturating_neg()) {
        day.checked_sub_months(Months::new(m))
    } else {
        None
    }
}
