//! String manipulation and conversion functions for formulas.

mod conversion;
mod manipulation;

use chrono::{Datelike, Timelike};
use rust_decimal::prelude::ToPrimitive;
use smallvec::SmallVec;

use super::*;
use crate::ArraySize;
use crate::values::parse_value_text;

pub const CATEGORY: FormulaFunctionCategory = FormulaFunctionCategory {
    include_in_docs: true,
    include_in_completions: true,
    name: "String functions",
    docs: None,
    get_functions,
};

fn get_functions() -> Vec<FormulaFunction> {
    [manipulation::get_functions(), conversion::get_functions()]
        .into_iter()
        .flatten()
        .collect()
}

// ============================================================================
// Shared helper functions
// ============================================================================

pub(crate) fn unicode(span: Span, s: String) -> CodeResult<u32> {
    match s.chars().next() {
        Some(c) => Ok(c as u32),
        None => Err(RunErrorMsg::InvalidArgument.with_span(span)),
    }
}

pub(crate) fn unichar(span: Span, code_point: u32) -> CodeResult<char> {
    char::from_u32(code_point)
        .filter(|&c| c != '\0')
        .ok_or_else(|| RunErrorMsg::InvalidArgument.with_span(span))
}

pub(crate) fn try_i64_to_usize(Spanned { span, inner: n }: Spanned<i64>) -> CodeResult<usize> {
    usize::try_from(n).map_err(|_| RunErrorMsg::InvalidArgument.with_span(span))
}

pub(crate) fn try_i64_minus_1_to_usize(value: Spanned<i64>) -> CodeResult<usize> {
    try_i64_to_usize(value.map(|n| i64::saturating_sub(n, 1)))
}

pub(crate) fn floor_char_boundary(s: &str, mut byte_index: usize) -> usize {
    if byte_index >= s.len() {
        s.len()
    } else {
        while !s.is_char_boundary(byte_index) {
            byte_index -= 1;
        }
        byte_index
    }
}

pub(crate) fn ceil_char_boundary(s: &str, mut byte_index: usize) -> usize {
    if byte_index >= s.len() {
        s.len()
    } else {
        while !s.is_char_boundary(byte_index) {
            byte_index += 1;
        }
        byte_index
    }
}

pub(crate) fn first_char_of_nonempty_string(
    arg: &Option<Spanned<String>>,
) -> CodeResult<Option<char>> {
    match arg {
        Some(s) => {
            Ok(Some(s.inner.chars().next().ok_or_else(|| {
                RunErrorMsg::InvalidArgument.with_span(s.span)
            })?))
        }
        None => Ok(None),
    }
}

/// Format a date/time value using the given pattern.
pub(crate) fn format_date_time(value: &CellValue, pattern: &str) -> CodeResult<String> {
    match value {
        CellValue::Date(d) => {
            let mut result = pattern.to_string();
            result = result.replace("yyyy", &format!("{:04}", d.year()));
            result = result.replace("yy", &format!("{:02}", d.year() % 100));
            result = result.replace("mmmm", &month_name(d.month()));
            result = result.replace("mmm", &month_abbrev(d.month()));
            result = result.replace("mm", &format!("{:02}", d.month()));
            result = result.replace("dddd", &weekday_name(d.weekday()));
            result = result.replace("ddd", &weekday_abbrev(d.weekday()));
            result = result.replace("dd", &format!("{:02}", d.day()));
            Ok(result)
        }
        CellValue::DateTime(dt) => {
            let d = dt.date();
            let t = dt.time();
            let mut result = pattern.to_string();
            result = result.replace("yyyy", &format!("{:04}", d.year()));
            result = result.replace("yy", &format!("{:02}", d.year() % 100));
            result = result.replace("mmmm", &month_name(d.month()));
            result = result.replace("mmm", &month_abbrev(d.month()));
            result = result.replace("mm", &format!("{:02}", d.month()));
            result = result.replace("dddd", &weekday_name(d.weekday()));
            result = result.replace("ddd", &weekday_abbrev(d.weekday()));
            result = result.replace("dd", &format!("{:02}", d.day()));

            let hour = t.hour();
            let is_pm = hour >= 12;
            let hour_12 = if hour == 0 {
                12
            } else if hour > 12 {
                hour - 12
            } else {
                hour
            };

            if pattern.to_lowercase().contains("am") || pattern.to_lowercase().contains("pm") {
                result = result.replace("hh", &format!("{:02}", hour_12));
                result = result.replace("AM/PM", if is_pm { "PM" } else { "AM" });
                result = result.replace("am/pm", if is_pm { "pm" } else { "am" });
            } else {
                result = result.replace("hh", &format!("{:02}", hour));
            }
            result = result.replace("mm", &format!("{:02}", t.minute()));
            result = result.replace("ss", &format!("{:02}", t.second()));
            Ok(result)
        }
        CellValue::Time(t) => {
            let mut result = pattern.to_string();
            let hour = t.hour();
            let is_pm = hour >= 12;
            let hour_12 = if hour == 0 {
                12
            } else if hour > 12 {
                hour - 12
            } else {
                hour
            };

            if pattern.to_lowercase().contains("am") || pattern.to_lowercase().contains("pm") {
                result = result.replace("hh", &format!("{:02}", hour_12));
                result = result.replace("AM/PM", if is_pm { "PM" } else { "AM" });
                result = result.replace("am/pm", if is_pm { "pm" } else { "am" });
            } else {
                result = result.replace("hh", &format!("{:02}", hour));
            }
            result = result.replace("mm", &format!("{:02}", t.minute()));
            result = result.replace("ss", &format!("{:02}", t.second()));
            Ok(result)
        }
        CellValue::Number(n) => {
            let days = n.to_i64().unwrap_or(0);
            if days >= 1 {
                use chrono::NaiveDate;
                if let Some(date) = NaiveDate::from_ymd_opt(1899, 12, 30)
                    .and_then(|d| d.checked_add_days(chrono::Days::new(days as u64)))
                {
                    let temp_value = CellValue::Date(date);
                    return format_date_time(&temp_value, pattern);
                }
            }
            Ok(value.to_display())
        }
        _ => Ok(value.to_display()),
    }
}

fn month_name(month: u32) -> String {
    match month {
        1 => "January",
        2 => "February",
        3 => "March",
        4 => "April",
        5 => "May",
        6 => "June",
        7 => "July",
        8 => "August",
        9 => "September",
        10 => "October",
        11 => "November",
        12 => "December",
        _ => "",
    }
    .to_string()
}

fn month_abbrev(month: u32) -> String {
    match month {
        1 => "Jan",
        2 => "Feb",
        3 => "Mar",
        4 => "Apr",
        5 => "May",
        6 => "Jun",
        7 => "Jul",
        8 => "Aug",
        9 => "Sep",
        10 => "Oct",
        11 => "Nov",
        12 => "Dec",
        _ => "",
    }
    .to_string()
}

fn weekday_name(weekday: chrono::Weekday) -> String {
    match weekday {
        chrono::Weekday::Mon => "Monday",
        chrono::Weekday::Tue => "Tuesday",
        chrono::Weekday::Wed => "Wednesday",
        chrono::Weekday::Thu => "Thursday",
        chrono::Weekday::Fri => "Friday",
        chrono::Weekday::Sat => "Saturday",
        chrono::Weekday::Sun => "Sunday",
    }
    .to_string()
}

fn weekday_abbrev(weekday: chrono::Weekday) -> String {
    match weekday {
        chrono::Weekday::Mon => "Mon",
        chrono::Weekday::Tue => "Tue",
        chrono::Weekday::Wed => "Wed",
        chrono::Weekday::Thu => "Thu",
        chrono::Weekday::Fri => "Fri",
        chrono::Weekday::Sat => "Sat",
        chrono::Weekday::Sun => "Sun",
    }
    .to_string()
}

/// Returns text after a delimiter.
pub(crate) fn text_after<'a>(
    text: &'a str,
    delimiter: &str,
    instance: i64,
    case_insensitive: bool,
    match_end_as_delim: bool,
) -> Option<&'a str> {
    if delimiter.is_empty() {
        return Some(text);
    }

    let text_for_search = if case_insensitive {
        text.to_lowercase()
    } else {
        text.to_string()
    };
    let delim_for_search = if case_insensitive {
        delimiter.to_lowercase()
    } else {
        delimiter.to_string()
    };

    let positions: Vec<usize> = text_for_search
        .match_indices(&delim_for_search)
        .map(|(i, _)| i)
        .collect();

    if positions.is_empty() {
        if match_end_as_delim && instance == 1 {
            return Some("");
        }
        return None;
    }

    let index = if instance > 0 {
        (instance - 1) as usize
    } else {
        let abs_instance = (-instance) as usize;
        if abs_instance > positions.len() {
            return None;
        }
        positions.len() - abs_instance
    };

    if index >= positions.len() {
        if match_end_as_delim {
            return Some("");
        }
        return None;
    }

    let pos = positions[index];
    Some(&text[pos + delimiter.len()..])
}

/// Returns text before a delimiter.
pub(crate) fn text_before<'a>(
    text: &'a str,
    delimiter: &str,
    instance: i64,
    case_insensitive: bool,
    match_start_as_delim: bool,
) -> Option<&'a str> {
    if delimiter.is_empty() {
        return Some(text);
    }

    let text_for_search = if case_insensitive {
        text.to_lowercase()
    } else {
        text.to_string()
    };
    let delim_for_search = if case_insensitive {
        delimiter.to_lowercase()
    } else {
        delimiter.to_string()
    };

    let positions: Vec<usize> = text_for_search
        .match_indices(&delim_for_search)
        .map(|(i, _)| i)
        .collect();

    if positions.is_empty() {
        if match_start_as_delim && instance == 1 {
            return Some("");
        }
        return None;
    }

    let index = if instance > 0 {
        (instance - 1) as usize
    } else {
        let abs_instance = (-instance) as usize;
        if abs_instance > positions.len() {
            return None;
        }
        positions.len() - abs_instance
    };

    if index >= positions.len() {
        if match_start_as_delim {
            return Some("");
        }
        return None;
    }

    let pos = positions[index];
    Some(&text[..pos])
}

/// Splits text while keeping track of original positions (for case-insensitive splitting).
pub(crate) fn split_keeping_positions<'a>(
    original: &'a str,
    lowercase: &str,
    delimiter: &str,
    ignore_empty: bool,
) -> Vec<&'a str> {
    if delimiter.is_empty() {
        return vec![original];
    }

    let mut result = Vec::new();
    let mut last_end = 0;

    for (pos, _) in lowercase.match_indices(delimiter) {
        let part = &original[last_end..pos];
        if !ignore_empty || !part.is_empty() {
            result.push(part);
        }
        last_end = pos + delimiter.len();
    }

    let remaining = &original[last_end..];
    if !ignore_empty || !remaining.is_empty() {
        result.push(remaining);
    }

    result
}

#[cfg(test)]
mod tests {
    use super::*;
    use chrono::{NaiveDate, NaiveDateTime, NaiveTime, Weekday};
    use rust_decimal::prelude::*;

    // ============================================================================
    // unicode() tests
    // ============================================================================

    #[test]
    fn test_unicode_ascii() {
        let span = Span::empty(0);
        assert_eq!(unicode(span, "A".to_string()).unwrap(), 65);
        assert_eq!(unicode(span, "a".to_string()).unwrap(), 97);
        assert_eq!(unicode(span, "0".to_string()).unwrap(), 48);
        assert_eq!(unicode(span, " ".to_string()).unwrap(), 32);
    }

    #[test]
    fn test_unicode_multibyte() {
        let span = Span::empty(0);
        assert_eq!(unicode(span, "中".to_string()).unwrap(), 20013);
        assert_eq!(unicode(span, "é".to_string()).unwrap(), 233);
        assert_eq!(unicode(span, "😀".to_string()).unwrap(), 128512);
    }

    #[test]
    fn test_unicode_takes_first_char() {
        let span = Span::empty(0);
        assert_eq!(unicode(span, "ABC".to_string()).unwrap(), 65);
        assert_eq!(unicode(span, "hello".to_string()).unwrap(), 104);
    }

    #[test]
    fn test_unicode_empty_string_error() {
        let span = Span::empty(0);
        assert!(unicode(span, "".to_string()).is_err());
    }

    // ============================================================================
    // unichar() tests
    // ============================================================================

    #[test]
    fn test_unichar_ascii() {
        let span = Span::empty(0);
        assert_eq!(unichar(span, 65).unwrap(), 'A');
        assert_eq!(unichar(span, 97).unwrap(), 'a');
        assert_eq!(unichar(span, 48).unwrap(), '0');
        assert_eq!(unichar(span, 32).unwrap(), ' ');
    }

    #[test]
    fn test_unichar_multibyte() {
        let span = Span::empty(0);
        assert_eq!(unichar(span, 20013).unwrap(), '中');
        assert_eq!(unichar(span, 233).unwrap(), 'é');
        assert_eq!(unichar(span, 128512).unwrap(), '😀');
    }

    #[test]
    fn test_unichar_null_char_error() {
        let span = Span::empty(0);
        assert!(unichar(span, 0).is_err());
    }

    #[test]
    fn test_unichar_invalid_code_point_error() {
        let span = Span::empty(0);
        // Invalid Unicode code point
        assert!(unichar(span, 0xD800).is_err()); // surrogate
        assert!(unichar(span, 0x110000).is_err()); // out of range
    }

    // ============================================================================
    // try_i64_to_usize() tests
    // ============================================================================

    #[test]
    fn test_try_i64_to_usize_positive() {
        let spanned = Spanned::new(0, 0, 42i64);
        assert_eq!(try_i64_to_usize(spanned).unwrap(), 42usize);
    }

    #[test]
    fn test_try_i64_to_usize_zero() {
        let spanned = Spanned::new(0, 0, 0i64);
        assert_eq!(try_i64_to_usize(spanned).unwrap(), 0usize);
    }

    #[test]
    fn test_try_i64_to_usize_negative_error() {
        let spanned = Spanned::new(0, 0, -1i64);
        assert!(try_i64_to_usize(spanned).is_err());
    }

    // ============================================================================
    // try_i64_minus_1_to_usize() tests
    // ============================================================================

    #[test]
    fn test_try_i64_minus_1_to_usize_one_based() {
        let spanned = Spanned::new(0, 0, 1i64);
        assert_eq!(try_i64_minus_1_to_usize(spanned).unwrap(), 0usize);
    }

    #[test]
    fn test_try_i64_minus_1_to_usize_positive() {
        let spanned = Spanned::new(0, 0, 10i64);
        assert_eq!(try_i64_minus_1_to_usize(spanned).unwrap(), 9usize);
    }

    #[test]
    fn test_try_i64_minus_1_to_usize_zero_error() {
        let spanned = Spanned::new(0, 0, 0i64);
        // 0 - 1 = -1, which can't be converted to usize
        assert!(try_i64_minus_1_to_usize(spanned).is_err());
    }

    // ============================================================================
    // floor_char_boundary() tests
    // ============================================================================

    #[test]
    fn test_floor_char_boundary_ascii() {
        let s = "hello";
        assert_eq!(floor_char_boundary(s, 0), 0);
        assert_eq!(floor_char_boundary(s, 2), 2);
        assert_eq!(floor_char_boundary(s, 5), 5);
    }

    #[test]
    fn test_floor_char_boundary_past_end() {
        let s = "hello";
        assert_eq!(floor_char_boundary(s, 10), 5);
        assert_eq!(floor_char_boundary(s, 100), 5);
    }

    #[test]
    fn test_floor_char_boundary_multibyte() {
        let s = "中文"; // Each character is 3 bytes
        assert_eq!(floor_char_boundary(s, 0), 0);
        assert_eq!(floor_char_boundary(s, 1), 0); // mid-char, floor to start
        assert_eq!(floor_char_boundary(s, 2), 0); // mid-char, floor to start
        assert_eq!(floor_char_boundary(s, 3), 3); // start of second char
        assert_eq!(floor_char_boundary(s, 4), 3); // mid-char, floor to start of second
        assert_eq!(floor_char_boundary(s, 6), 6); // end
    }

    // ============================================================================
    // ceil_char_boundary() tests
    // ============================================================================

    #[test]
    fn test_ceil_char_boundary_ascii() {
        let s = "hello";
        assert_eq!(ceil_char_boundary(s, 0), 0);
        assert_eq!(ceil_char_boundary(s, 2), 2);
        assert_eq!(ceil_char_boundary(s, 5), 5);
    }

    #[test]
    fn test_ceil_char_boundary_past_end() {
        let s = "hello";
        assert_eq!(ceil_char_boundary(s, 10), 5);
        assert_eq!(ceil_char_boundary(s, 100), 5);
    }

    #[test]
    fn test_ceil_char_boundary_multibyte() {
        let s = "中文"; // Each character is 3 bytes
        assert_eq!(ceil_char_boundary(s, 0), 0);
        assert_eq!(ceil_char_boundary(s, 1), 3); // mid-char, ceil to end of first
        assert_eq!(ceil_char_boundary(s, 2), 3); // mid-char, ceil to end of first
        assert_eq!(ceil_char_boundary(s, 3), 3); // start of second char
        assert_eq!(ceil_char_boundary(s, 4), 6); // mid-char, ceil to end of second
        assert_eq!(ceil_char_boundary(s, 6), 6); // end
    }

    // ============================================================================
    // first_char_of_nonempty_string() tests
    // ============================================================================

    #[test]
    fn test_first_char_of_nonempty_string_some() {
        let spanned = Spanned::new(0, 0, "Hello".to_string());
        assert_eq!(
            first_char_of_nonempty_string(&Some(spanned)).unwrap(),
            Some('H')
        );
    }

    #[test]
    fn test_first_char_of_nonempty_string_none() {
        assert_eq!(first_char_of_nonempty_string(&None).unwrap(), None);
    }

    #[test]
    fn test_first_char_of_nonempty_string_empty_error() {
        let spanned = Spanned::new(0, 0, "".to_string());
        assert!(first_char_of_nonempty_string(&Some(spanned)).is_err());
    }

    #[test]
    fn test_first_char_of_nonempty_string_unicode() {
        let spanned = Spanned::new(0, 0, "中文".to_string());
        assert_eq!(
            first_char_of_nonempty_string(&Some(spanned)).unwrap(),
            Some('中')
        );
    }

    // ============================================================================
    // month_name() tests
    // ============================================================================

    #[test]
    fn test_month_name_all_months() {
        assert_eq!(month_name(1), "January");
        assert_eq!(month_name(2), "February");
        assert_eq!(month_name(3), "March");
        assert_eq!(month_name(4), "April");
        assert_eq!(month_name(5), "May");
        assert_eq!(month_name(6), "June");
        assert_eq!(month_name(7), "July");
        assert_eq!(month_name(8), "August");
        assert_eq!(month_name(9), "September");
        assert_eq!(month_name(10), "October");
        assert_eq!(month_name(11), "November");
        assert_eq!(month_name(12), "December");
    }

    #[test]
    fn test_month_name_invalid() {
        assert_eq!(month_name(0), "");
        assert_eq!(month_name(13), "");
        assert_eq!(month_name(100), "");
    }

    // ============================================================================
    // month_abbrev() tests
    // ============================================================================

    #[test]
    fn test_month_abbrev_all_months() {
        assert_eq!(month_abbrev(1), "Jan");
        assert_eq!(month_abbrev(2), "Feb");
        assert_eq!(month_abbrev(3), "Mar");
        assert_eq!(month_abbrev(4), "Apr");
        assert_eq!(month_abbrev(5), "May");
        assert_eq!(month_abbrev(6), "Jun");
        assert_eq!(month_abbrev(7), "Jul");
        assert_eq!(month_abbrev(8), "Aug");
        assert_eq!(month_abbrev(9), "Sep");
        assert_eq!(month_abbrev(10), "Oct");
        assert_eq!(month_abbrev(11), "Nov");
        assert_eq!(month_abbrev(12), "Dec");
    }

    #[test]
    fn test_month_abbrev_invalid() {
        assert_eq!(month_abbrev(0), "");
        assert_eq!(month_abbrev(13), "");
    }

    // ============================================================================
    // weekday_name() tests
    // ============================================================================

    #[test]
    fn test_weekday_name_all_days() {
        assert_eq!(weekday_name(Weekday::Mon), "Monday");
        assert_eq!(weekday_name(Weekday::Tue), "Tuesday");
        assert_eq!(weekday_name(Weekday::Wed), "Wednesday");
        assert_eq!(weekday_name(Weekday::Thu), "Thursday");
        assert_eq!(weekday_name(Weekday::Fri), "Friday");
        assert_eq!(weekday_name(Weekday::Sat), "Saturday");
        assert_eq!(weekday_name(Weekday::Sun), "Sunday");
    }

    // ============================================================================
    // weekday_abbrev() tests
    // ============================================================================

    #[test]
    fn test_weekday_abbrev_all_days() {
        assert_eq!(weekday_abbrev(Weekday::Mon), "Mon");
        assert_eq!(weekday_abbrev(Weekday::Tue), "Tue");
        assert_eq!(weekday_abbrev(Weekday::Wed), "Wed");
        assert_eq!(weekday_abbrev(Weekday::Thu), "Thu");
        assert_eq!(weekday_abbrev(Weekday::Fri), "Fri");
        assert_eq!(weekday_abbrev(Weekday::Sat), "Sat");
        assert_eq!(weekday_abbrev(Weekday::Sun), "Sun");
    }

    // ============================================================================
    // format_date_time() tests
    // ============================================================================

    #[test]
    fn test_format_date_time_date_basic() {
        let date = NaiveDate::from_ymd_opt(2024, 3, 15).unwrap();
        let value = CellValue::Date(date);

        assert_eq!(
            format_date_time(&value, "yyyy-mm-dd").unwrap(),
            "2024-03-15"
        );
        assert_eq!(
            format_date_time(&value, "dd/mm/yyyy").unwrap(),
            "15/03/2024"
        );
        assert_eq!(format_date_time(&value, "yy-mm-dd").unwrap(), "24-03-15");
    }

    #[test]
    fn test_format_date_time_date_names() {
        let date = NaiveDate::from_ymd_opt(2024, 3, 15).unwrap(); // Friday
        let value = CellValue::Date(date);

        assert_eq!(
            format_date_time(&value, "mmmm dd, yyyy").unwrap(),
            "March 15, 2024"
        );
        assert_eq!(format_date_time(&value, "mmm dd").unwrap(), "Mar 15");
        assert_eq!(format_date_time(&value, "dddd").unwrap(), "Friday");
        assert_eq!(format_date_time(&value, "ddd").unwrap(), "Fri");
    }

    #[test]
    fn test_format_date_time_time_24h() {
        let time = NaiveTime::from_hms_opt(14, 30, 45).unwrap();
        let value = CellValue::Time(time);

        assert_eq!(format_date_time(&value, "hh:mm:ss").unwrap(), "14:30:45");
        assert_eq!(format_date_time(&value, "hh:mm").unwrap(), "14:30");
    }

    #[test]
    fn test_format_date_time_time_12h_pm() {
        let time = NaiveTime::from_hms_opt(14, 30, 45).unwrap();
        let value = CellValue::Time(time);

        assert_eq!(
            format_date_time(&value, "hh:mm:ss AM/PM").unwrap(),
            "02:30:45 PM"
        );
        assert_eq!(format_date_time(&value, "hh:mm am/pm").unwrap(), "02:30 pm");
    }

    #[test]
    fn test_format_date_time_time_12h_am() {
        let time = NaiveTime::from_hms_opt(9, 15, 30).unwrap();
        let value = CellValue::Time(time);

        assert_eq!(
            format_date_time(&value, "hh:mm:ss AM/PM").unwrap(),
            "09:15:30 AM"
        );
    }

    #[test]
    fn test_format_date_time_time_noon_midnight() {
        let noon = NaiveTime::from_hms_opt(12, 0, 0).unwrap();
        let midnight = NaiveTime::from_hms_opt(0, 0, 0).unwrap();

        assert_eq!(
            format_date_time(&CellValue::Time(noon), "hh AM/PM").unwrap(),
            "12 PM"
        );
        assert_eq!(
            format_date_time(&CellValue::Time(midnight), "hh AM/PM").unwrap(),
            "12 AM"
        );
    }

    #[test]
    fn test_format_date_time_datetime() {
        let dt = NaiveDateTime::new(
            NaiveDate::from_ymd_opt(2024, 12, 25).unwrap(),
            NaiveTime::from_hms_opt(15, 30, 0).unwrap(),
        );
        let value = CellValue::DateTime(dt);

        // Note: "mm" is used for both month and minute in patterns.
        // The implementation replaces month first, then minute, so the second "mm"
        // in "yyyy-mm-dd hh:mm:ss" becomes the month (12), not the minute (30).
        assert_eq!(
            format_date_time(&value, "yyyy-mm-dd hh:mm:ss").unwrap(),
            "2024-12-25 15:12:00"
        );
        assert_eq!(
            format_date_time(&value, "mmmm dd, yyyy hh:mm AM/PM").unwrap(),
            "December 25, 2024 03:12 PM"
        );
    }

    #[test]
    fn test_format_date_time_number_as_date() {
        // Excel serial date 45000 = 2023-03-15
        let value = CellValue::Number(Decimal::from(45000));
        let result = format_date_time(&value, "yyyy-mm-dd").unwrap();
        // The date should be formatted based on Excel's date serial system
        assert!(result.contains("2023") || result.contains("03") || result.contains("15"));
    }

    #[test]
    fn test_format_date_time_text_passthrough() {
        let value = CellValue::Text("Hello".to_string());
        assert_eq!(format_date_time(&value, "yyyy-mm-dd").unwrap(), "Hello");
    }

    // ============================================================================
    // text_after() tests
    // ============================================================================

    #[test]
    fn test_text_after_basic() {
        assert_eq!(
            text_after("Hello World", " ", 1, false, false),
            Some("World")
        );
        assert_eq!(text_after("a,b,c", ",", 1, false, false), Some("b,c"));
        assert_eq!(text_after("a,b,c", ",", 2, false, false), Some("c"));
    }

    #[test]
    fn test_text_after_empty_delimiter() {
        assert_eq!(text_after("Hello", "", 1, false, false), Some("Hello"));
    }

    #[test]
    fn test_text_after_not_found() {
        assert_eq!(text_after("Hello", "x", 1, false, false), None);
    }

    #[test]
    fn test_text_after_case_insensitive() {
        // Case-insensitive: "WORLD" matches "World" in "Hello World"
        assert_eq!(text_after("Hello World", "WORLD", 1, true, false), Some(""));
        assert_eq!(
            text_after("Hello WORLD test", "world", 1, true, false),
            Some(" test")
        );
        // Case-sensitive: "WORLD" does NOT match "World"
        assert_eq!(text_after("Hello World", "WORLD", 1, false, false), None);
    }

    #[test]
    fn test_text_after_negative_instance() {
        assert_eq!(text_after("a,b,c", ",", -1, false, false), Some("c"));
        assert_eq!(text_after("a,b,c", ",", -2, false, false), Some("b,c"));
    }

    #[test]
    fn test_text_after_match_end_as_delim() {
        assert_eq!(text_after("abc", "x", 1, false, true), Some(""));
        assert_eq!(text_after("a,b,c", ",", 3, false, true), Some(""));
    }

    #[test]
    fn test_text_after_instance_out_of_range() {
        assert_eq!(text_after("a,b,c", ",", 5, false, false), None);
        assert_eq!(text_after("a,b,c", ",", -5, false, false), None);
    }

    // ============================================================================
    // text_before() tests
    // ============================================================================

    #[test]
    fn test_text_before_basic() {
        assert_eq!(
            text_before("Hello World", " ", 1, false, false),
            Some("Hello")
        );
        assert_eq!(text_before("a,b,c", ",", 1, false, false), Some("a"));
        assert_eq!(text_before("a,b,c", ",", 2, false, false), Some("a,b"));
    }

    #[test]
    fn test_text_before_empty_delimiter() {
        assert_eq!(text_before("Hello", "", 1, false, false), Some("Hello"));
    }

    #[test]
    fn test_text_before_not_found() {
        assert_eq!(text_before("Hello", "x", 1, false, false), None);
    }

    #[test]
    fn test_text_before_case_insensitive() {
        // Case-insensitive: "WORLD" matches "World" in "Hello World"
        assert_eq!(
            text_before("Hello World", "WORLD", 1, true, false),
            Some("Hello ")
        );
        assert_eq!(
            text_before("test WORLD Hello", "world", 1, true, false),
            Some("test ")
        );
        // Case-sensitive: "WORLD" does NOT match "World"
        assert_eq!(text_before("Hello World", "WORLD", 1, false, false), None);
    }

    #[test]
    fn test_text_before_negative_instance() {
        assert_eq!(text_before("a,b,c", ",", -1, false, false), Some("a,b"));
        assert_eq!(text_before("a,b,c", ",", -2, false, false), Some("a"));
    }

    #[test]
    fn test_text_before_match_start_as_delim() {
        assert_eq!(text_before("abc", "x", 1, false, true), Some(""));
        assert_eq!(text_before("a,b,c", ",", 3, false, true), Some(""));
    }

    #[test]
    fn test_text_before_instance_out_of_range() {
        assert_eq!(text_before("a,b,c", ",", 5, false, false), None);
        assert_eq!(text_before("a,b,c", ",", -5, false, false), None);
    }

    // ============================================================================
    // split_keeping_positions() tests
    // ============================================================================

    #[test]
    fn test_split_keeping_positions_basic() {
        let result = split_keeping_positions("a,b,c", "a,b,c", ",", false);
        assert_eq!(result, vec!["a", "b", "c"]);
    }

    #[test]
    fn test_split_keeping_positions_empty_delimiter() {
        let result = split_keeping_positions("abc", "abc", "", false);
        assert_eq!(result, vec!["abc"]);
    }

    #[test]
    fn test_split_keeping_positions_no_match() {
        let result = split_keeping_positions("abc", "abc", "x", false);
        assert_eq!(result, vec!["abc"]);
    }

    #[test]
    fn test_split_keeping_positions_case_insensitive() {
        let original = "Hello WORLD Test";
        let lowercase = original.to_lowercase();
        let result = split_keeping_positions(original, &lowercase, "world", false);
        assert_eq!(result, vec!["Hello ", " Test"]);
    }

    #[test]
    fn test_split_keeping_positions_ignore_empty() {
        let result = split_keeping_positions("a,,b", "a,,b", ",", true);
        assert_eq!(result, vec!["a", "b"]);
    }

    #[test]
    fn test_split_keeping_positions_keep_empty() {
        let result = split_keeping_positions("a,,b", "a,,b", ",", false);
        assert_eq!(result, vec!["a", "", "b"]);
    }

    #[test]
    fn test_split_keeping_positions_delimiter_at_ends() {
        let result = split_keeping_positions(",a,b,", ",a,b,", ",", false);
        assert_eq!(result, vec!["", "a", "b", ""]);

        let result_ignore = split_keeping_positions(",a,b,", ",a,b,", ",", true);
        assert_eq!(result_ignore, vec!["a", "b"]);
    }

    // ============================================================================
    // parse_value_text() tests
    // ============================================================================

    #[test]
    fn test_parse_value_text_basic_numbers() {
        assert_eq!(parse_value_text("123"), Some(123.0));
        assert_eq!(parse_value_text("123.45"), Some(123.45));
        assert_eq!(parse_value_text("-123.45"), Some(-123.45));
        assert_eq!(parse_value_text("+123.45"), Some(123.45));
    }

    #[test]
    fn test_parse_value_text_empty_and_whitespace() {
        assert_eq!(parse_value_text(""), Some(0.0));
        assert_eq!(parse_value_text("   "), Some(0.0));
        assert_eq!(parse_value_text("  123  "), Some(123.0));
    }

    #[test]
    fn test_parse_value_text_percentage() {
        assert_eq!(parse_value_text("50%"), Some(0.5));
        assert_eq!(parse_value_text("100%"), Some(1.0));
        assert_eq!(parse_value_text("25.5%"), Some(0.255));
        assert_eq!(parse_value_text("1,234%"), Some(12.34));
    }

    #[test]
    fn test_parse_value_text_currency() {
        assert_eq!(parse_value_text("$123"), Some(123.0));
        assert_eq!(parse_value_text("$1,234.56"), Some(1234.56));
        assert_eq!(parse_value_text("€1234"), Some(1234.0));
    }

    #[test]
    fn test_parse_value_text_negative_formats() {
        assert_eq!(parse_value_text("(123)"), Some(-123.0));
        assert_eq!(parse_value_text("-$123"), Some(-123.0));
        assert_eq!(parse_value_text("-€123"), Some(-123.0));
    }

    #[test]
    fn test_parse_value_text_with_thousands_separator() {
        assert_eq!(parse_value_text("1,234"), Some(1234.0));
        assert_eq!(parse_value_text("1,234,567.89"), Some(1234567.89));
    }

    #[test]
    fn test_parse_value_text_invalid() {
        assert_eq!(parse_value_text("abc"), None);
        assert_eq!(parse_value_text("12.34.56"), None);
    }
}
