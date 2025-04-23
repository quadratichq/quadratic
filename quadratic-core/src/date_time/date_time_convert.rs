//! Rust functions w/tests for date and time conversions.
//!
//! This file is necessary because testing w/WASM functions is difficult.

use chrono::{NaiveDate, NaiveDateTime, NaiveTime};

use {
    super::{
        DEFAULT_DATE_FORMAT, DEFAULT_DATE_TIME_FORMAT, DEFAULT_TIME_FORMAT,
        date_time_to_date_time_string, date_to_date_string, i32_to_naive_time, i64_to_naive_date,
        naive_date_time_to_i64, naive_date_to_i64, naive_time_to_i32, parse_date, parse_time,
        time_to_time_string,
    },
    crate::CellValue,
};

/// Returns a formatted version of the date string. The date is expected to
/// be in the format of %Y-%m-%d.
pub(crate) fn format_date(date: &str, format: Option<String>) -> String {
    let date = NaiveDate::parse_from_str(date, "%Y-%m-%d");
    match date {
        Ok(date) => date_to_date_string(date, format),
        Err(_) => "".to_string(),
    }
}

/// Returns a formatted version of the date string. The date is expected to
/// be in the format of %Y-%m-%d %H:%M:%S.
pub(crate) fn format_date_time(date: &str, format: Option<String>) -> String {
    let date = NaiveDateTime::parse_from_str(date, "%Y-%m-%d %H:%M:%S");
    match date {
        Ok(date) => date_time_to_date_time_string(date, format),
        Err(_) => "".to_string(),
    }
}

/// Returns a formatted version of the time string. The date is expected to be
/// in the format DEFAULT_DATE_TIME_FORMAT.
pub(crate) fn format_time(date: &str, format: Option<String>) -> String {
    let date = NaiveDateTime::parse_from_str(date, DEFAULT_DATE_TIME_FORMAT);
    match date {
        Ok(time) => time_to_time_string(time.time(), format),
        Err(_) => "".to_string(),
    }
}

/// Returns a date string in the format of %Y-%m-%d %H:%M:%S. Returns an empty
/// string if unable to parse the date or time string.
pub(crate) fn parse_time_from_format(date: &str, time: &str) -> String {
    if let (Ok(date), Some(parsed)) = (
        NaiveDate::parse_from_str(date, "%Y-%m-%d"),
        CellValue::unpack_time(time),
    ) {
        match parsed {
            CellValue::Time(time) => {
                let dt = NaiveDateTime::new(date, time);
                return dt.format("%Y-%m-%d %H:%M:%S").to_string();
            }
            _ => return "".to_string(),
        }
    }
    "".to_string()
}

/// Converts a date-time string to an i64 for use in date_time validations.
/// Expects the date-time to be in the format of %Y-%m-%d %H:%M:%S.
pub(crate) fn date_to_number(date: &str) -> i64 {
    let date = NaiveDateTime::parse_from_str(date, "%Y-%m-%d %H:%M:%S");
    match date {
        Ok(date) => naive_date_time_to_i64(date),
        Err(_) => -1,
    }
}

/// Converts a time to an i32 for use in time validations. Expects the time to
/// be in the format of %H:%M:%S.
pub(crate) fn time_to_number(time: &str) -> i32 {
    let time = NaiveTime::parse_from_str(time, "%H:%M:%S");
    match time {
        Ok(time) => naive_time_to_i32(time),
        Err(_) => -1,
    }
}

/// Attempts to convert a user's input to an i64 for use in date_time validation.
pub(crate) fn user_date_to_number(date: &str) -> Option<i64> {
    let date = parse_date(date)?;
    naive_date_to_i64(date)
}

/// Attempts to convert a user's input to an i32 for use in time validation.
pub(crate) fn user_time_to_number(time: &str) -> Option<i32> {
    let time = parse_time(time)?;
    Some(naive_time_to_i32(time))
}

/// Converts a number to a date string to the default date format.
pub(crate) fn number_to_date(number: i64) -> Option<String> {
    let date = i64_to_naive_date(number)?;
    Some(date.format(DEFAULT_DATE_FORMAT).to_string())
}

/// Converts a number to a time string to the default time format.
pub(crate) fn number_to_time(number: i32) -> Option<String> {
    let time = i32_to_naive_time(number)?;
    Some(time.format(DEFAULT_TIME_FORMAT).to_string())
}

/// Applies a date format to a date from CellValue.to_edit()
/// Note: this will likely change, but for now we hardcode the formats
///    CellValue::Date(d) => d.format("%m/%d/%Y").to_string(),
///    CellValue::Time(t) => t.format("%-I:%M %p").to_string(),
///    CellValue::DateTime(t) => t.format("%m/%d/%Y %-I:%M %p").to_string(),
pub(crate) fn apply_format_to_date_time(date: &str, format: &str) -> Option<String> {
    if let Ok(dt) = NaiveDateTime::parse_from_str(date, "%m/%d/%Y %-I:%M %p") {
        return Some(date_time_to_date_time_string(dt, Some(format.to_string())));
    } else if let Ok(dt) = NaiveDate::parse_from_str(date, "%m/%d/%Y") {
        return Some(date_to_date_string(dt, Some(format.to_string())));
    } else if let Ok(dt) = NaiveTime::parse_from_str(date, "%-I:%M %p") {
        return Some(time_to_time_string(dt, Some(format.to_string())));
    }
    None
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_format_date() {
        assert_eq!(format_date("2021-01-01", None), "01/01/2021".to_string());
        assert_eq!(
            format_date("2021-01-01", Some("%m/%d/%Y".to_string())),
            "01/01/2021".to_string()
        );
        assert_eq!(
            format_date("2021-01-01", Some("".to_string())),
            "".to_string()
        );
        assert_eq!(
            format_date("2021-01-01", Some("text".to_string())),
            "text".to_string()
        );
    }

    #[test]
    fn test_format_date_time() {
        assert_eq!(
            format_date_time("2021-01-01 12:00:00", None),
            "01/01/2021 12:00 PM".to_string()
        );
        assert_eq!(
            format_date_time(
                "2021-01-01 12:00:00",
                Some("%m/%d/%Y %-I:%M %p".to_string())
            ),
            "01/01/2021 12:00 PM".to_string()
        );
        assert_eq!(
            format_date_time("2021-01-01 12:00:00", Some("".to_string())),
            "".to_string()
        );
        assert_eq!(
            format_date_time("2021-01-01 12:00:00", Some("text".to_string())),
            "text".to_string()
        );
    }

    #[test]
    fn test_format_time() {
        assert_eq!(
            format_time("01/01/2021 12:00 PM", None),
            "12:00 PM".to_string()
        );
        assert_eq!(
            format_time("01/01/2021 12:00 PM", Some("%-I:%M %p".to_string())),
            "12:00 PM".to_string()
        );
        assert_eq!(
            format_time("01/01/2021 12:00 PM", Some("".to_string())),
            "".to_string()
        );
        assert_eq!(
            format_time("01/01/2021 12:00 PM", Some("text".to_string())),
            "text".to_string()
        );
    }

    #[test]
    fn test_parse_time_from_format() {
        assert_eq!(
            parse_time_from_format("2021-01-01", "12:00:00"),
            "2021-01-01 12:00:00".to_string()
        );
        assert_eq!(
            parse_time_from_format("2021-01-01", "invalid"),
            "".to_string()
        );
        assert_eq!(
            parse_time_from_format("invalid", "12:00:00"),
            "".to_string()
        );
    }

    #[test]
    fn format_date_with_custom() {
        let custom = "%m/%d/%Y time %-I:%M %p";
        assert_eq!(
            format_date("2021-01-01", Some(custom.to_string())),
            "01/01/2021 time"
        );
    }
}
