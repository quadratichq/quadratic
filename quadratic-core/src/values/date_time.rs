use chrono::Utc;
use dateparser::parse_with_timezone;

use crate::date_time::{parse_date, parse_time};

use super::CellValue;

impl CellValue {
    pub(crate) fn unpack_time(value: &str) -> Option<CellValue> {
        let time = parse_time(value)?;
        Some(CellValue::Time(time))
    }

    pub(crate) fn unpack_date(value: &str) -> Option<CellValue> {
        let date = parse_date(value)?;
        Some(CellValue::Date(date))
    }

    pub(crate) fn unpack_date_time(value: &str) -> Option<CellValue> {
        parse_with_timezone(value, &Utc)
            .map(|dt| CellValue::DateTime(dt.naive_utc()))
            .ok()
    }

    pub(crate) fn unpack_duration(value: &str) -> Option<CellValue> {
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
}
