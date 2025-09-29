use serde::{Deserialize, Serialize};
use ts_rs::TS;

use crate::{
    CellValue,
    date_time::{naive_date_to_i64, naive_time_to_i32},
};

#[derive(Serialize, Deserialize, Debug, Clone, PartialEq, TS)]
pub enum DateTimeRange {
    DateRange(Option<i64>, Option<i64>),
    DateEqual(Vec<i64>),
    DateNotEqual(Vec<i64>),

    TimeRange(Option<i32>, Option<i32>),
    TimeEqual(Vec<i32>),
    TimeNotEqual(Vec<i32>),
}

#[derive(Default, Serialize, Deserialize, Debug, Clone, PartialEq, TS)]
pub struct ValidationDateTime {
    pub ignore_blank: bool,

    pub require_date: bool,
    pub require_time: bool,
    pub prohibit_date: bool,
    pub prohibit_time: bool,

    pub ranges: Vec<DateTimeRange>,
}

impl ValidationDateTime {
    // Validate a CellValue against the validation rule.
    pub(crate) fn validate(&self, value: Option<&CellValue>) -> bool {
        if let Some(value) = value {
            let (date, time) = match value {
                CellValue::DateTime(dt) => {
                    if self.prohibit_time || self.prohibit_date {
                        return false;
                    }
                    (dt.and_utc().timestamp(), naive_time_to_i32(dt.time()))
                }
                CellValue::Date(d) => {
                    if self.prohibit_date || self.require_time {
                        return false;
                    }
                    let Some(date_i64) = naive_date_to_i64(*d) else {
                        return false;
                    };
                    (date_i64, 0)
                }
                CellValue::Time(t) => {
                    if self.require_date || self.prohibit_time {
                        return false;
                    }
                    (0, naive_time_to_i32(*t))
                }
                _ => return false,
            };

            if self.ranges.is_empty() {
                return true;
            }

            // we're looking for one valid range.
            self.ranges.iter().any(|range| match range {
                DateTimeRange::DateEqual(equal) => equal.contains(&date),
                DateTimeRange::DateNotEqual(not_equal) => not_equal.iter().all(|v| date != *v),
                DateTimeRange::DateRange(min, max) => {
                    if let Some(min) = min.as_ref()
                        && date < *min {
                            return false;
                        }
                    if let Some(max) = max.as_ref()
                        && date > *max {
                            return false;
                        }
                    true
                }

                DateTimeRange::TimeEqual(equal) => equal.contains(&time),
                DateTimeRange::TimeRange(min, max) => {
                    if let Some(min) = min.as_ref()
                        && time < *min {
                            return false;
                        }
                    if let Some(max) = max.as_ref()
                        && time > *max {
                            return false;
                        }
                    true
                }
                DateTimeRange::TimeNotEqual(not_equal) => not_equal.iter().all(|v| time != *v),
            })
        } else {
            self.ignore_blank
        }
    }
}

#[cfg(test)]
mod tests {
    use chrono::{NaiveDate, NaiveDateTime, NaiveTime};

    use super::*;

    #[test]
    fn validate_date_time_ignore_blank() {
        let rule = ValidationDateTime {
            ignore_blank: true,
            ..Default::default()
        };
        assert!(rule.validate(None));

        let rule = ValidationDateTime {
            ignore_blank: false,
            ..Default::default()
        };
        assert!(!rule.validate(None));
        assert!(rule.validate(Some(&CellValue::DateTime(
            NaiveDateTime::parse_from_str("2021-01-01T00:00:00", "%Y-%m-%dT%H:%M:%S").unwrap()
        ))));
    }

    #[test]
    fn validate_date_time_types() {
        let rule = ValidationDateTime {
            prohibit_time: true,
            ..Default::default()
        };
        assert!(!rule.validate(Some(&CellValue::DateTime(
            NaiveDateTime::parse_from_str("2021-01-01T00:00:00", "%Y-%m-%dT%H:%M:%S").unwrap()
        ))));
        assert!(rule.validate(Some(&CellValue::Date(
            NaiveDate::parse_from_str("2021-01-01", "%Y-%m-%d").unwrap()
        ))));
        assert!(!rule.validate(Some(&CellValue::Time(
            NaiveTime::parse_from_str("00:00:00", "%H:%M:%S").unwrap()
        ))));

        let rule = ValidationDateTime {
            require_date: true,
            require_time: true,
            ..Default::default()
        };
        assert!(rule.validate(Some(&CellValue::DateTime(
            NaiveDateTime::parse_from_str("2021-01-01T00:00:00", "%Y-%m-%dT%H:%M:%S").unwrap()
        ))));
        assert!(!rule.validate(Some(&CellValue::Date(
            NaiveDate::parse_from_str("2021-01-01", "%Y-%m-%d").unwrap()
        ))));
        assert!(!rule.validate(Some(&CellValue::Time(
            NaiveTime::parse_from_str("00:00:00", "%H:%M:%S").unwrap()
        ))));

        let rule = ValidationDateTime {
            ..Default::default()
        };
        assert!(rule.validate(Some(&CellValue::DateTime(
            NaiveDateTime::parse_from_str("2021-01-01T00:00:00", "%Y-%m-%dT%H:%M:%S").unwrap()
        ))));
        assert!(rule.validate(Some(&CellValue::Date(
            NaiveDate::parse_from_str("2021-01-01", "%Y-%m-%d").unwrap()
        ))));
        assert!(rule.validate(Some(&CellValue::Time(
            NaiveTime::parse_from_str("00:00:00", "%H:%M:%S").unwrap()
        ))));

        let rule = ValidationDateTime {
            prohibit_date: true,
            ..Default::default()
        };
        assert!(!rule.validate(Some(&CellValue::DateTime(
            NaiveDateTime::parse_from_str("2021-01-01T00:00:00", "%Y-%m-%dT%H:%M:%S").unwrap()
        ))));
        assert!(!rule.validate(Some(&CellValue::Date(
            NaiveDate::parse_from_str("2021-01-01", "%Y-%m-%d").unwrap()
        ))));
        assert!(rule.validate(Some(&CellValue::Time(
            NaiveTime::parse_from_str("00:00:00", "%H:%M:%S").unwrap()
        ))));

        let rule = ValidationDateTime {
            prohibit_time: true,
            ..Default::default()
        };
        assert!(!rule.validate(Some(&CellValue::DateTime(
            NaiveDateTime::parse_from_str("2021-01-01T00:00:00", "%Y-%m-%dT%H:%M:%S").unwrap()
        ))));
        assert!(rule.validate(Some(&CellValue::Date(
            NaiveDate::parse_from_str("2021-01-01", "%Y-%m-%d").unwrap()
        ))));
        assert!(!rule.validate(Some(&CellValue::Time(
            NaiveTime::parse_from_str("00:00:00", "%H:%M:%S").unwrap()
        ))));
    }

    #[test]
    fn date_equal() {
        let rule = ValidationDateTime {
            ignore_blank: true,
            ranges: vec![DateTimeRange::DateEqual(vec![1612137600])],
            ..Default::default()
        };
        assert!(rule.validate(Some(&CellValue::Date(
            NaiveDate::parse_from_str("2021-02-01", "%Y-%m-%d").unwrap()
        ))));
        assert!(!rule.validate(Some(&CellValue::Date(
            NaiveDate::parse_from_str("2021-01-01", "%Y-%m-%d").unwrap()
        ))));

        assert!(rule.validate(Some(&CellValue::DateTime(
            NaiveDateTime::parse_from_str("2021-02-01T00:00:00", "%Y-%m-%dT%H:%M:%S").unwrap()
        ))));
        assert!(!rule.validate(Some(&CellValue::DateTime(
            NaiveDateTime::parse_from_str("2021-01-01T00:00:00", "%Y-%m-%dT%H:%M:%S").unwrap()
        ))));

        // this one fails b/c there are no relevant rules. I think this is the correct approach.
        assert!(!rule.validate(Some(&CellValue::Time(
            NaiveTime::parse_from_str("00:00:00", "%H:%M:%S").unwrap()
        ))));
    }

    #[test]
    fn date_not_equal() {
        let rule = ValidationDateTime {
            ranges: vec![DateTimeRange::DateNotEqual(vec![1612137600])],
            ..Default::default()
        };
        assert!(!rule.validate(Some(&CellValue::Date(
            NaiveDate::parse_from_str("2021-02-01", "%Y-%m-%d").unwrap()
        ))));
        assert!(rule.validate(Some(&CellValue::Date(
            NaiveDate::parse_from_str("2021-01-01", "%Y-%m-%d").unwrap()
        ))));
        assert!(rule.validate(Some(&CellValue::DateTime(
            NaiveDateTime::parse_from_str("2021-01-01T00:00:00", "%Y-%m-%dT%H:%M:%S").unwrap()
        ))));
        assert!(rule.validate(Some(&CellValue::DateTime(
            NaiveDateTime::parse_from_str("2021-01-01T00:10:00", "%Y-%m-%dT%H:%M:%S").unwrap()
        ))));
    }

    #[test]
    fn date_range_single() {
        let rule = ValidationDateTime {
            ranges: vec![DateTimeRange::DateRange(Some(1612137600), Some(1612137600))],
            ..Default::default()
        };
        assert!(rule.validate(Some(&CellValue::Date(
            NaiveDate::parse_from_str("2021-02-01", "%Y-%m-%d").unwrap()
        ))));
        assert!(!rule.validate(Some(&CellValue::Date(
            NaiveDate::parse_from_str("2021-01-01", "%Y-%m-%d").unwrap()
        ))));
        assert!(!rule.validate(Some(&CellValue::DateTime(
            NaiveDateTime::parse_from_str("2021-01-01T00:00:00", "%Y-%m-%dT%H:%M:%S").unwrap()
        ))));
        assert!(!rule.validate(Some(&CellValue::DateTime(
            NaiveDateTime::parse_from_str("2021-01-01T00:10:00", "%Y-%m-%dT%H:%M:%S").unwrap()
        ))));
    }

    #[test]
    fn date_range_multiple() {
        let rule = ValidationDateTime {
            // two date range
            ranges: vec![DateTimeRange::DateRange(Some(1612137600), Some(1612224600))],
            ..Default::default()
        };
        assert!(rule.validate(Some(&CellValue::Date(
            NaiveDate::parse_from_str("2021-02-01", "%Y-%m-%d").unwrap()
        ))));
        assert!(rule.validate(Some(&CellValue::Date(
            NaiveDate::parse_from_str("2021-02-02", "%Y-%m-%d").unwrap()
        ))));
        assert!(!rule.validate(Some(&CellValue::Date(
            NaiveDate::parse_from_str("2021-01-01", "%Y-%m-%d").unwrap()
        ))));
        assert!(!rule.validate(Some(&CellValue::DateTime(
            NaiveDateTime::parse_from_str("2021-01-01T00:00:00", "%Y-%m-%dT%H:%M:%S").unwrap()
        ))));
        assert!(!rule.validate(Some(&CellValue::DateTime(
            NaiveDateTime::parse_from_str("2021-01-02T00:00:00", "%Y-%m-%dT%H:%M:%S").unwrap()
        ))));
        assert!(!rule.validate(Some(&CellValue::DateTime(
            NaiveDateTime::parse_from_str("2021-01-03T00:10:00", "%Y-%m-%dT%H:%M:%S").unwrap()
        ))));
    }

    #[test]
    fn date_range_start() {
        // range from 2021-02-01 to the end of time
        let rule = ValidationDateTime {
            ranges: vec![DateTimeRange::DateRange(Some(1612137600), None)],
            ..Default::default()
        };
        assert!(rule.validate(Some(&CellValue::Date(
            NaiveDate::parse_from_str("2021-02-01", "%Y-%m-%d").unwrap()
        ))));
        assert!(rule.validate(Some(&CellValue::Date(
            NaiveDate::parse_from_str("2021-02-02", "%Y-%m-%d").unwrap()
        ))));
        assert!(!rule.validate(Some(&CellValue::Date(
            NaiveDate::parse_from_str("2021-01-01", "%Y-%m-%d").unwrap()
        ))));
        assert!(!rule.validate(Some(&CellValue::DateTime(
            NaiveDateTime::parse_from_str("2021-01-01T00:00:00", "%Y-%m-%dT%H:%M:%S").unwrap()
        ))));
        assert!(!rule.validate(Some(&CellValue::DateTime(
            NaiveDateTime::parse_from_str("2021-01-02T00:00:00", "%Y-%m-%dT%H:%M:%S").unwrap()
        ))));
        assert!(!rule.validate(Some(&CellValue::DateTime(
            NaiveDateTime::parse_from_str("2021-01-03T00:10:00", "%Y-%m-%dT%H:%M:%S").unwrap()
        ))));
    }

    #[test]
    fn date_range_end() {
        // range from the beginning of time to 2021-02-01
        let rule = ValidationDateTime {
            ranges: vec![DateTimeRange::DateRange(None, Some(1612137600))],
            ..Default::default()
        };
        assert!(rule.validate(Some(&CellValue::Date(
            NaiveDate::parse_from_str("2021-02-01", "%Y-%m-%d").unwrap()
        ))));
        assert!(!rule.validate(Some(&CellValue::Date(
            NaiveDate::parse_from_str("2021-02-02", "%Y-%m-%d").unwrap()
        ))));
        assert!(rule.validate(Some(&CellValue::Date(
            NaiveDate::parse_from_str("2021-01-01", "%Y-%m-%d").unwrap()
        ))));
        assert!(rule.validate(Some(&CellValue::DateTime(
            NaiveDateTime::parse_from_str("2021-01-01T00:00:00", "%Y-%m-%dT%H:%M:%S").unwrap()
        ))));
    }

    #[test]
    fn time_equal() {
        let rule = ValidationDateTime {
            ranges: vec![DateTimeRange::TimeEqual(vec![0])],
            ..Default::default()
        };
        assert!(rule.validate(Some(&CellValue::Time(
            NaiveTime::parse_from_str("00:00:00", "%H:%M:%S").unwrap()
        ))));
        assert!(!rule.validate(Some(&CellValue::Time(
            NaiveTime::parse_from_str("00:00:01", "%H:%M:%S").unwrap()
        ))));
        assert!(rule.validate(Some(&CellValue::DateTime(
            NaiveDateTime::parse_from_str("2021-01-01T00:00:00", "%Y-%m-%dT%H:%M:%S").unwrap()
        ))));
        assert!(!rule.validate(Some(&CellValue::DateTime(
            NaiveDateTime::parse_from_str("2021-01-01T00:00:01", "%Y-%m-%dT%H:%M:%S").unwrap()
        ))));
    }

    #[test]
    fn time_not_equal() {
        let rule = ValidationDateTime {
            ranges: vec![DateTimeRange::TimeNotEqual(vec![0])],
            ..Default::default()
        };
        assert!(!rule.validate(Some(&CellValue::Time(
            NaiveTime::parse_from_str("00:00:00", "%H:%M:%S").unwrap()
        ))));
        assert!(rule.validate(Some(&CellValue::Time(
            NaiveTime::parse_from_str("00:00:01", "%H:%M:%S").unwrap()
        ))));
        assert!(!rule.validate(Some(&CellValue::DateTime(
            NaiveDateTime::parse_from_str("2021-01-01T00:00:00", "%Y-%m-%dT%H:%M:%S").unwrap()
        ))));
        assert!(rule.validate(Some(&CellValue::DateTime(
            NaiveDateTime::parse_from_str("2021-01-01T00:00:01", "%Y-%m-%dT%H:%M:%S").unwrap()
        ))));
    }

    #[test]
    fn time_ranges() {
        let rule = ValidationDateTime {
            ranges: vec![DateTimeRange::TimeRange(Some(0), Some(0))],
            ..Default::default()
        };
        assert!(rule.validate(Some(&CellValue::Time(
            NaiveTime::parse_from_str("00:00:00", "%H:%M:%S").unwrap()
        ))));
        assert!(!rule.validate(Some(&CellValue::Time(
            NaiveTime::parse_from_str("00:00:01", "%H:%M:%S").unwrap()
        ))));
        assert!(rule.validate(Some(&CellValue::DateTime(
            NaiveDateTime::parse_from_str("2021-01-01T00:00:00", "%Y-%m-%dT%H:%M:%S").unwrap()
        ))));
        assert!(!rule.validate(Some(&CellValue::DateTime(
            NaiveDateTime::parse_from_str("2021-01-01T00:00:01", "%Y-%m-%dT%H:%M:%S").unwrap()
        ))));

        let rule = ValidationDateTime {
            ranges: vec![DateTimeRange::TimeRange(Some(0), Some(1))],
            ..Default::default()
        };
        assert!(rule.validate(Some(&CellValue::Time(
            NaiveTime::parse_from_str("00:00:00", "%H:%M:%S").unwrap()
        ))));
        assert!(rule.validate(Some(&CellValue::Time(
            NaiveTime::parse_from_str("00:00:01", "%H:%M:%S").unwrap()
        ))));
        assert!(!rule.validate(Some(&CellValue::Time(
            NaiveTime::parse_from_str("00:00:02", "%H:%M:%S").unwrap()
        ))));
    }

    #[test]
    fn time_ranges_start() {
        let rule = ValidationDateTime {
            ranges: vec![DateTimeRange::TimeRange(Some(1), None)],
            ..Default::default()
        };
        assert!(rule.validate(Some(&CellValue::Time(
            NaiveTime::parse_from_str("00:00:01", "%H:%M:%S").unwrap()
        ))));
        assert!(rule.validate(Some(&CellValue::Time(
            NaiveTime::parse_from_str("00:00:01", "%H:%M:%S").unwrap()
        ))));
        assert!(rule.validate(Some(&CellValue::Time(
            NaiveTime::parse_from_str("00:00:02", "%H:%M:%S").unwrap()
        ))));
        assert!(!rule.validate(Some(&CellValue::Time(
            NaiveTime::parse_from_str("00:00:00", "%H:%M:%S").unwrap()
        ))));
    }

    #[test]
    fn time_ranges_end() {
        let rule = ValidationDateTime {
            ranges: vec![DateTimeRange::TimeRange(None, Some(1))],
            ..Default::default()
        };
        assert!(rule.validate(Some(&CellValue::Time(
            NaiveTime::parse_from_str("00:00:01", "%H:%M:%S").unwrap()
        ))));
        assert!(rule.validate(Some(&CellValue::Time(
            NaiveTime::parse_from_str("00:00:01", "%H:%M:%S").unwrap()
        ))));
        assert!(!rule.validate(Some(&CellValue::Time(
            NaiveTime::parse_from_str("00:00:02", "%H:%M:%S").unwrap()
        ))));
    }
}
