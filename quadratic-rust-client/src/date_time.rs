use chrono::{NaiveDate, NaiveDateTime, NaiveTime, ParseError};

use quadratic_core::{
    date_time::{
        date_time_to_date_time_string, i32_to_naive_time, i64_to_naive_date,
        naive_date_time_to_i64, naive_date_to_i64, naive_time_to_i32, parse_date, parse_time,
        time_to_time_string, DEFAULT_DATE_FORMAT, DEFAULT_DATE_TIME_FORMAT, DEFAULT_TIME_FORMAT,
    },
    CellValue,
};
use wasm_bindgen::prelude::*;

#[wasm_bindgen(js_name = "formatDate")]
/// Returns a formatted version of the date string. The date is expected to
/// be in the format of %Y-%m-%d.
pub fn format_date(date: &str, format: Option<String>) -> String {
    let date = NaiveDate::parse_from_str(date, "%Y-%m-%d");
    match date {
        Ok(date) => date
            .format(&format.unwrap_or(DEFAULT_DATE_FORMAT.to_string()))
            .to_string(),
        Err(_) => "".to_string(),
    }
}

fn parse_date_time(date: &str, format: Option<String>) -> Result<NaiveDateTime, ParseError> {
    let format = format.unwrap_or(DEFAULT_DATE_TIME_FORMAT.to_string());
    NaiveDateTime::parse_from_str(date, &format)
}

#[wasm_bindgen(js_name = "formatDateTime")]
/// Returns a formatted version of the date string. The date is expected to
/// be in the format of %Y-%m-%d %H:%M:%S.
pub fn format_date_time(date: &str, format: Option<String>) -> String {
    let date = NaiveDateTime::parse_from_str(date, "%Y-%m-%d %H:%M:%S");
    match date {
        Ok(date) => date_time_to_date_time_string(date, format),
        Err(_) => "".to_string(),
    }
}

#[wasm_bindgen(js_name = "formatTime")]
/// Returns a formatted version of the time string. The date is expected to be
/// in the format of %Y-%m-%d %H:%M:%S.
pub fn format_time(date: &str, format: Option<String>) -> String {
    let date = parse_date_time(date, format.clone());
    match date {
        Ok(time) => time_to_time_string(time.time(), format),
        Err(_) => "".to_string(),
    }
}

#[wasm_bindgen(js_name = "parseTime")]
/// Returns a date string in the format of %Y-%m-%d %H:%M:%S. Returns an empty
/// string if unable to parse the date or time string.
pub fn parse_time_from_format(date: &str, time: &str) -> String {
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

#[wasm_bindgen(js_name = "dateTimeToNumber")]
/// Converts a date-time string to an i64 for use in date_time validations.
/// Expects the date-time to be in the format of %Y-%m-%d %H:%M:%S.
pub fn date_to_number(date: &str) -> i64 {
    let date = NaiveDateTime::parse_from_str(date, "%Y-%m-%d %H:%M:%S");
    match date {
        Ok(date) => naive_date_time_to_i64(date),
        Err(_) => -1,
    }
}

#[wasm_bindgen(js_name = "timeToNumber")]
/// Converts a time to an i32 for use in time validations. Expects the time to
/// be in the format of %H:%M:%S.
pub fn time_to_number(time: &str) -> i32 {
    let time = NaiveTime::parse_from_str(time, "%H:%M:%S");
    match time {
        Ok(time) => naive_time_to_i32(time),
        Err(_) => -1,
    }
}

#[wasm_bindgen(js_name = "userDateToNumber")]
/// Attempts to convert a user's input to an i64 for use in date_time validation.
pub fn user_date_to_number(date: &str) -> Option<i64> {
    let date = parse_date(date)?;
    naive_date_to_i64(date)
}

#[wasm_bindgen(js_name = "userTimeToNumber")]
/// Attempts to convert a user's input to an i32 for use in time validation.
pub fn user_time_to_number(time: &str) -> Option<i32> {
    let time = parse_time(time)?;
    Some(naive_time_to_i32(time))
}

#[wasm_bindgen(js_name = "numberToDate")]
/// Converts a number to a date string to the default date format.
pub fn number_to_date(number: i64) -> Option<String> {
    let date = i64_to_naive_date(number)?;
    Some(date.format(DEFAULT_DATE_FORMAT).to_string())
}

#[wasm_bindgen(js_name = "numberToTime")]
/// Converts a number to a time string to the default time format.
pub fn number_to_time(number: i32) -> Option<String> {
    let time = i32_to_naive_time(number)?;
    Some(time.format(DEFAULT_TIME_FORMAT).to_string())
}
