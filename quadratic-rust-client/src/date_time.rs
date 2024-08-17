use chrono::{NaiveDate, NaiveDateTime, ParseError};

use quadratic_core::{
    date_time::{
        date_time_to_date_time_string, time_to_time_string, DEFAULT_DATE_FORMAT,
        DEFAULT_DATE_TIME_FORMAT,
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
pub fn parse_time(date: &str, time: &str) -> String {
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
