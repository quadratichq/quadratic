use chrono::{NaiveDate, NaiveTime, Utc};
use dateparser::parse_with_timezone;

use super::CellValue;

impl CellValue {
    pub fn unpack_time(value: &str) -> Option<CellValue> {
        let formats = vec![
            "%H:%M:%S",
            "%I:%M:%S %p",
            "%I:%M %p",
            "%H:%M",
            "%I:%M:%S",
            "%I:%M",
        ];

        for &format in formats.iter() {
            if let Ok(parsed_time) = NaiveTime::parse_from_str(value, format) {
                return Some(CellValue::Time(parsed_time));
            }
        }
        None
    }

    pub fn unpack_date(value: &str) -> Option<CellValue> {
        let formats = vec![
            "%Y-%m-%d", "%m-%d-%Y", "%d-%m-%Y", "%Y/%m/%d", "%m/%d/%Y", "%d/%m/%Y", "%Y.%m.%d",
            "%m.%d.%Y", "%d.%m.%Y", "%Y %m %d", "%m %d %Y", "%d %m %Y", "%Y %b %d", "%b %d %Y",
            "%d %b %Y", "%Y %B %d", "%B %d %Y", "%d %B %Y",
        ];

        for &format in formats.iter() {
            if let Ok(parsed_date) = NaiveDate::parse_from_str(value, format) {
                return Some(CellValue::Date(parsed_date));
            }
        }
        None
    }

    pub fn unpack_date_time(value: &str) -> Option<CellValue> {
        parse_with_timezone(value, &Utc)
            .map(|dt| CellValue::DateTime(dt.naive_utc()))
            .ok()
    }
}

#[cfg(test)]
mod tests {
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
}
