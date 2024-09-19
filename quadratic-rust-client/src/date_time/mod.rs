//! WASM functions for date and time conversions.

mod date_time;

use date_time::*;
use wasm_bindgen::prelude::*;

#[allow(non_snake_case)]
#[wasm_bindgen(js_name = "formatDate")]
/// Returns a formatted version of the date string. The date is expected to
/// be in the format of %Y-%m-%d.
pub fn js_format_date(date: &str, format: Option<String>) -> String {
    format_date(date, format)
}

#[allow(non_snake_case)]
#[wasm_bindgen(js_name = "formatDateTime")]
/// Returns a formatted version of the date string. The date is expected to
/// be in the format of %Y-%m-%d %H:%M:%S.
pub fn js_format_date_time(date: &str, format: Option<String>) -> String {
    format_date_time(date, format)
}

#[allow(non_snake_case)]
#[wasm_bindgen(js_name = "formatTime")]
/// Returns a formatted version of the time string. The date is expected to be
/// in the format DEFAULT_DATE_TIME_FORMAT.
pub fn js_format_time(date: &str, format: Option<String>) -> String {
    format_time(date, format)
}

#[allow(non_snake_case)]
#[wasm_bindgen(js_name = "parseTime")]
/// Returns a date string in the format of %Y-%m-%d %H:%M:%S. Returns an empty
/// string if unable to parse the date or time string.
pub fn js_parse_time_from_format(date: &str, time: &str) -> String {
    parse_time_from_format(date, time)
}

#[allow(non_snake_case)]
#[wasm_bindgen(js_name = "dateTimeToNumber")]
/// Converts a date-time string to an i64 for use in date_time validations.
/// Expects the date-time to be in the format of %Y-%m-%d %H:%M:%S.
pub fn js_date_to_number(date: &str) -> i64 {
    date_to_number(date)
}

#[allow(non_snake_case)]
#[wasm_bindgen(js_name = "timeToNumber")]
/// Converts a time to an i32 for use in time validations. Expects the time to
/// be in the format of %H:%M:%S.
pub fn js_time_to_number(time: &str) -> i32 {
    time_to_number(time)
}

#[allow(non_snake_case)]
#[wasm_bindgen(js_name = "userDateToNumber")]
/// Attempts to convert a user's input to an i64 for use in date_time validation.
pub fn js_user_date_to_number(date: &str) -> Option<i64> {
    user_date_to_number(date)
}

#[allow(non_snake_case)]
#[wasm_bindgen(js_name = "userTimeToNumber")]
/// Attempts to convert a user's input to an i32 for use in time validation.
pub fn js_user_time_to_number(time: &str) -> Option<i32> {
    user_time_to_number(time)
}

#[allow(non_snake_case)]
#[wasm_bindgen(js_name = "numberToDate")]
/// Converts a number to a date string to the default date format.
pub fn js_number_to_date(number: i64) -> Option<String> {
    number_to_date(number)
}

#[allow(non_snake_case)]
#[wasm_bindgen(js_name = "numberToTime")]
/// Converts a number to a time string to the default time format.
pub fn js_number_to_time(number: i32) -> Option<String> {
    number_to_time(number)
}

#[allow(non_snake_case)]
#[wasm_bindgen(js_name = "applyFormatToDateTime")]
/// Applies a date format to a date from CellValue.to_edit()
/// Note: this will likely change, but for now we hardcode the formats
///    CellValue::Date(d) => d.format("%m/%d/%Y").to_string(),
///    CellValue::Time(t) => t.format("%-I:%M %p").to_string(),
///    CellValue::DateTime(t) => t.format("%m/%d/%Y %-I:%M %p").to_string(),
pub fn js_apply_format_to_date_time(date: &str, format: &str) -> Option<String> {
    apply_format_to_date_time(date, format)
}
