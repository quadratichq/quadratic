use chrono::{NaiveDateTime, Utc};
use dateparser::parse_with_timezone;

use crate::date_time::{
    parse_date, parse_date_with_format, parse_time, parse_time_with_format,
};

use super::CellValue;

impl CellValue {
    pub fn unpack_time(value: &str) -> Option<CellValue> {
        let time = parse_time(value)?;
        Some(CellValue::Time(time))
    }

    /// Unpacks a time string, returning both the CellValue and the strftime format.
    pub fn unpack_time_with_format(value: &str) -> Option<(CellValue, String)> {
        let (time, format) = parse_time_with_format(value)?;
        Some((CellValue::Time(time), format))
    }

    pub fn unpack_date(value: &str) -> Option<CellValue> {
        let date = parse_date(value)?;
        Some(CellValue::Date(date))
    }

    /// Unpacks a date string, returning both the CellValue and the strftime format.
    pub fn unpack_date_with_format(value: &str) -> Option<(CellValue, String)> {
        let (date, format) = parse_date_with_format(value)?;
        Some((CellValue::Date(date), format))
    }

    pub fn unpack_date_time(value: &str) -> Option<CellValue> {
        // First try the dateparser crate
        if let Ok(dt) = parse_with_timezone(value, &Utc) {
            return Some(CellValue::DateTime(dt.naive_utc()));
        }

        // Try parsing as "date time" with our custom parsers (e.g., "1/2/20 5pm")
        Self::try_parse_date_time_custom(value)
    }

    /// Unpacks a datetime string, returning both the CellValue and the strftime format.
    pub fn unpack_date_time_with_format(value: &str) -> Option<(CellValue, String)> {
        // First try the dateparser crate
        if let Ok(dt) = parse_with_timezone(value, &Utc) {
            // Use default format for dateparser results
            return Some((
                CellValue::DateTime(dt.naive_utc()),
                crate::date_time::DEFAULT_DATE_TIME_FORMAT.to_string(),
            ));
        }

        // Try parsing as "date time" with our custom parsers (e.g., "1/2/20 5pm")
        Self::try_parse_date_time_custom_with_format(value)
    }

    /// Tries to parse a datetime string by splitting into date and time parts.
    /// Handles formats like "1/2/20 5pm" or "12/25/2024 3:30 PM"
    fn try_parse_date_time_custom(value: &str) -> Option<CellValue> {
        Self::try_parse_date_time_custom_with_format(value).map(|(cv, _)| cv)
    }

    /// Tries to parse a datetime string by splitting into date and time parts.
    /// Returns both the CellValue and the format string.
    fn try_parse_date_time_custom_with_format(value: &str) -> Option<(CellValue, String)> {
        // Find potential split points (space before a time-like pattern)
        for (i, _) in value.char_indices() {
            if i == 0 {
                continue;
            }

            let remaining = &value[i..].trim_start();
            if remaining.is_empty() {
                continue;
            }

            // Check if remaining looks like a time (starts with digit and contains am/pm or colon)
            let first_char = remaining.chars().next()?;
            if first_char.is_ascii_digit() {
                let remaining_lower = remaining.to_lowercase();
                let looks_like_time = remaining_lower.contains("am")
                    || remaining_lower.contains("pm")
                    || remaining.contains(':');

                if looks_like_time {
                    let date_part = value[..i].trim();
                    let time_part = remaining;

                    if let (Some((date, date_format)), Some((time, time_format))) = (
                        parse_date_with_format(date_part),
                        parse_time_with_format(time_part),
                    ) {
                        let datetime = NaiveDateTime::new(date, time);
                        let format = format!("{} {}", date_format, time_format);
                        return Some((CellValue::DateTime(datetime), format));
                    }
                }
            }
        }

        None
    }

    pub fn unpack_duration(value: &str) -> Option<CellValue> {
        value.parse().map(CellValue::Duration).ok()
    }
}

#[cfg(test)]
mod tests {
    use chrono::{NaiveDate, NaiveTime};

    use super::*;

    #[test]
    fn unpack_time() {
        let value = String::from("12:34:56");
        assert_eq!(
            CellValue::unpack_time(&value),
            Some(CellValue::Time(
                NaiveTime::from_hms_opt(12, 34, 56).unwrap()
            ))
        );

        let value = String::from("12:34:56 PM");
        assert_eq!(
            CellValue::unpack_time(&value),
            Some(CellValue::Time(
                NaiveTime::from_hms_opt(12, 34, 56).unwrap()
            ))
        );

        let value = String::from("12:34 PM");
        assert_eq!(
            CellValue::unpack_time(&value),
            Some(CellValue::Time(NaiveTime::from_hms_opt(12, 34, 0).unwrap()))
        );

        let value = String::from("12:34");
        assert_eq!(
            CellValue::unpack_time(&value),
            Some(CellValue::Time(NaiveTime::from_hms_opt(12, 34, 0).unwrap()))
        );

        let value = String::from("17:12:00.000");
        assert_eq!(
            CellValue::unpack_time(&value),
            Some(CellValue::Time(
                NaiveTime::from_hms_milli_opt(17, 12, 0, 0).unwrap()
            ))
        );
    }

    #[test]
    fn unpack_date() {
        let value = String::from("2021-01-01");
        assert_eq!(
            CellValue::unpack_date(&value),
            Some(CellValue::Date(
                NaiveDate::from_ymd_opt(2021, 1, 1).unwrap()
            ))
        );

        let value = String::from("01-01-2021");
        assert_eq!(
            CellValue::unpack_date(&value),
            Some(CellValue::Date(
                NaiveDate::from_ymd_opt(2021, 1, 1).unwrap()
            ))
        );

        let value = String::from("2021/01/01");
        assert_eq!(
            CellValue::unpack_date(&value),
            Some(CellValue::Date(
                NaiveDate::from_ymd_opt(2021, 1, 1).unwrap()
            ))
        );

        let value = String::from("01/01/2021");
        assert_eq!(
            CellValue::unpack_date(&value),
            Some(CellValue::Date(
                NaiveDate::from_ymd_opt(2021, 1, 1).unwrap()
            ))
        );

        let value = String::from("2021.01.01");
        assert_eq!(
            CellValue::unpack_date(&value),
            Some(CellValue::Date(
                NaiveDate::from_ymd_opt(2021, 1, 1).unwrap()
            ))
        );

        let value = String::from("01.01.2021");
        assert_eq!(
            CellValue::unpack_date(&value),
            Some(CellValue::Date(
                NaiveDate::from_ymd_opt(2021, 1, 1).unwrap()
            ))
        );
    }

    #[test]
    fn unpack_date_time() {
        let value = String::from("2021-01-01 12:34:56");
        assert_eq!(
            CellValue::unpack_date_time(&value),
            Some(CellValue::DateTime(
                NaiveDate::from_ymd_opt(2021, 1, 1)
                    .unwrap()
                    .and_hms_opt(12, 34, 56)
                    .unwrap()
            ))
        );

        let value = String::from("01/01/2021 12:34:56");
        assert_eq!(
            CellValue::unpack_date_time(&value),
            Some(CellValue::DateTime(
                NaiveDate::from_ymd_opt(2021, 1, 1)
                    .unwrap()
                    .and_hms_opt(12, 34, 56)
                    .unwrap()
            ))
        );

        let value = String::from("2021/01/01 12:34:56");
        assert_eq!(
            CellValue::unpack_date_time(&value),
            Some(CellValue::DateTime(
                NaiveDate::from_ymd_opt(2021, 1, 1)
                    .unwrap()
                    .and_hms_opt(12, 34, 56)
                    .unwrap()
            ))
        );

        let value = String::from("01/01/2021 12:34:56");
        assert_eq!(
            CellValue::unpack_date_time(&value),
            Some(CellValue::DateTime(
                NaiveDate::from_ymd_opt(2021, 1, 1)
                    .unwrap()
                    .and_hms_opt(12, 34, 56)
                    .unwrap()
            ))
        );
    }

    #[test]
    fn unpack_date_time_with_ampm() {
        // Test "1/2/20 5pm" format
        let value = String::from("1/2/20 5pm");
        let result = CellValue::unpack_date_time(&value);
        assert_eq!(
            result,
            Some(CellValue::DateTime(
                NaiveDate::from_ymd_opt(2020, 1, 2)
                    .unwrap()
                    .and_hms_opt(17, 0, 0)
                    .unwrap()
            ))
        );

        // Test with full time format
        let value = String::from("12/25/2024 3:30 PM");
        let result = CellValue::unpack_date_time(&value);
        assert_eq!(
            result,
            Some(CellValue::DateTime(
                NaiveDate::from_ymd_opt(2024, 12, 25)
                    .unwrap()
                    .and_hms_opt(15, 30, 0)
                    .unwrap()
            ))
        );
    }
}
