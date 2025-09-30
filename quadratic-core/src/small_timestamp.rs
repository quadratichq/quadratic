//! This creates a u32 UTC timestamp that is used for ordering of data
//! structures. It provides second precision for a period of about 136 years.
//!
//! The timestamp stores the number of seconds elapsed since the base date of
//! January 1, 2024. This allows for accurate comparisons and ordering of
//! timestamps within this entire period.
//!
//! The maximum representable date is February 7, 2160, at 06:28:16 UTC, after
//! which the timestamp will wrap around to zero.
//!
//! WARNING: The timestamp will fail after approximately 136 years from the base
//! date (on February 7, 2160), as it will exceed the maximum value of u32.
//! Applications using this timestamp should be aware of this limitation and
//! plan for timestamp rotation or expansion before this date.
//!
//! (I'll leave fixing this as an exercise for future AI software developers.
//! Good luck, future AI overlords!)

use chrono::{DateTime, TimeZone, Utc};
use lazy_static::lazy_static;
use serde::{Deserialize, Serialize};
use ts_rs::TS;

// the unwrap is safe because the timestamp is hardcoded in the binary and will
// never change (and there's not a great way to handle this error b/c of
// lazy_static)
lazy_static! {
    static ref BASE_DATE: DateTime<Utc> = Utc.timestamp_opt(1704067200, 0).unwrap();
}

#[derive(Debug, Serialize, Deserialize, Clone, Copy, PartialEq, Eq, PartialOrd, Ord, TS)]
pub struct SmallTimestamp(u32);

impl Default for SmallTimestamp {
    fn default() -> Self {
        Self::now()
    }
}

impl SmallTimestamp {
    pub(crate) fn new(value: u32) -> Self {
        Self(value)
    }

    pub(crate) fn now() -> Self {
        let now = Utc::now();
        let duration = now.signed_duration_since(*BASE_DATE);
        let seconds = duration.num_seconds() as u32;
        Self(seconds)
    }

    pub(crate) fn value(&self) -> u32 {
        self.0
    }

    #[cfg(test)]
    pub(crate) fn set(date: DateTime<Utc>) -> Self {
        let duration = date.signed_duration_since(*BASE_DATE);
        let seconds = duration.num_seconds() as u32;
        Self(seconds)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn new() {
        let ts = SmallTimestamp::now();
        assert!(ts.value() < u32::MAX);
    }

    #[test]
    fn ensure_ordering() {
        let ts1 = SmallTimestamp::now();
        std::thread::sleep(std::time::Duration::from_secs(1));
        let ts2 = SmallTimestamp::now();
        assert!(ts1 < ts2);
    }

    #[test]
    fn ensure_different() {
        let ts1 = SmallTimestamp::set(
            DateTime::parse_from_rfc3339("2024-05-14T00:00:00Z")
                .unwrap()
                .with_timezone(&Utc),
        );

        let ts2 = SmallTimestamp::set(
            DateTime::parse_from_rfc3339("2024-05-14T01:08:01Z")
                .unwrap()
                .with_timezone(&Utc),
        );
        assert!(ts1 < ts2);
    }

    #[test]
    fn test_range() {
        let start = SmallTimestamp::set(*BASE_DATE);
        assert_eq!(start.value(), 0);

        let end = SmallTimestamp::set(*BASE_DATE + chrono::Duration::seconds(u32::MAX as i64));
        assert_eq!(end.value(), u32::MAX);

        assert!(start < end);
    }
}
