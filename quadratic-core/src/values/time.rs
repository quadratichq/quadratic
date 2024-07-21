use std::fmt::{self, Display};

use anyhow::{bail, Result};
use chrono::{DateTime, MappedLocalTime, NaiveDateTime};
use serde::{Deserialize, Serialize};

use crate::CellValue;

#[cfg_attr(test, derive(proptest_derive::Arbitrary))]
#[derive(Serialize, Deserialize, Debug, Copy, Clone)]
#[cfg_attr(feature = "js", derive(ts_rs::TS))]
pub struct Instant {
    #[cfg_attr(test, proptest(strategy = "0.0..(i32::MAX as f64)"))]
    pub seconds: f64,
}

impl Instant {
    pub fn new(seconds: f64) -> Self {
        Self { seconds }
    }
}

impl From<NaiveDateTime> for Instant {
    fn from(datetime: NaiveDateTime) -> Self {
        Self {
            seconds: datetime.and_utc().timestamp() as f64,
        }
    }
}

impl fmt::Display for Instant {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        write!(
            f,
            "{}",
            CellValue::unpack_unix_timestamp(self.seconds as i64).unwrap_or_default()
        )
        // write!(f, "{s} seconds", s = self.seconds)
    }
}

impl PartialEq for Instant {
    fn eq(&self, other: &Self) -> bool {
        f64::total_cmp(&self.seconds, &other.seconds) == std::cmp::Ordering::Equal
    }
}
impl Eq for Instant {}
impl PartialOrd for Instant {
    fn partial_cmp(&self, other: &Self) -> Option<std::cmp::Ordering> {
        Some(self.cmp(other))
    }
}
impl Ord for Instant {
    fn cmp(&self, other: &Self) -> std::cmp::Ordering {
        f64::total_cmp(&self.seconds, &other.seconds)
    }
}

#[cfg_attr(test, derive(proptest_derive::Arbitrary))]
#[derive(Serialize, Deserialize, Debug, Copy, Clone)]
#[cfg_attr(feature = "js", derive(ts_rs::TS))]
pub struct Duration {
    pub years: i32,
    pub months: i32,
    #[cfg_attr(test, proptest(strategy = "(i32::MIN as f64)..(i32::MAX as f64)"))]
    pub seconds: f64,
}

impl fmt::Display for Duration {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        write!(
            f,
            "{y} years, {m} months, {s} seconds",
            y = self.years,
            m = self.months,
            s = self.seconds,
        )
    }
}

impl PartialEq for Duration {
    fn eq(&self, other: &Self) -> bool {
        self.years == other.years
            && self.months == other.months
            && f64::total_cmp(&self.seconds, &other.seconds).is_eq()
    }
}
impl Eq for Duration {}
impl PartialOrd for Duration {
    fn partial_cmp(&self, other: &Self) -> Option<std::cmp::Ordering> {
        Some(self.cmp(other))
    }
}
impl Ord for Duration {
    fn cmp(&self, other: &Self) -> std::cmp::Ordering {
        // We have to implement this ourself since we want to use
        // `f32::total_cmp()`
        let mut ret = self.years.cmp(&other.years);
        if ret.is_eq() {
            ret = self.months.cmp(&other.months);
        }
        if ret.is_eq() {
            ret = f64::total_cmp(&self.seconds, &other.seconds);
        }
        ret
    }
}

pub fn map_local_result<T: chrono::TimeZone + Display>(
    value: MappedLocalTime<DateTime<T>>,
) -> Result<DateTime<T>> {
    match value {
        chrono::LocalResult::Single(timestamp) => Ok(timestamp),
        _ => bail!("Could not parse timestamp: {:?}", value),
    }
}
