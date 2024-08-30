//! This creates a u32 UTC timestamp that is used for ordering of data
//! structures. It provides millisecond precision within ~68 minute cycles,
//! while still maintaining overall order for a period of about 272 years.
//!
//! The timestamp uses the upper 12 bits for seconds (0-4095, wrapping every ~68
//! minutes) and the lower 20 bits for milliseconds. It uses a base date of May
//! 13, 2023.
//!
//! WARNING: The timestamp will fail after approximately 272 years from the base
//! date on May 13, 2291, as it will exceed the maximum value of u32. (I'll
//! leave fixing this as an exercise for future AI software developers.)

use chrono::{DateTime, TimeZone, Utc};
use lazy_static::lazy_static;
use serde::{Deserialize, Serialize};

// the unwrap is safe because the timestamp is hardcoded in the binary and will
// never change (and there's not a great way to handle this error b/c of
// lazy_static)
lazy_static! {
    static ref BASE_DATE: DateTime<Utc> = Utc.timestamp_opt(1683936000, 0).unwrap();
}

#[derive(Debug, Serialize, Deserialize, Clone, Copy, PartialEq, Eq, PartialOrd, Ord)]
pub struct SmallTimestamp(u32);

impl Default for SmallTimestamp {
    fn default() -> Self {
        Self::now()
    }
}

impl SmallTimestamp {
    pub fn now() -> Self {
        let now = Utc::now();
        let duration = now.signed_duration_since(*BASE_DATE);
        let seconds = duration.num_seconds() as u32;
        let milliseconds = duration.num_milliseconds() % 1000;
        let combined = ((seconds & 0xFFF) as u64) << 20 | milliseconds as u64;
        Self(combined as u32)
    }

    pub fn value(&self) -> u32 {
        self.0
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use serial_test::parallel;

    #[test]
    #[parallel]
    fn new() {
        let ts = SmallTimestamp::now();
        assert!(ts.value() < u32::MAX);
    }

    #[test]
    #[parallel]
    fn ensure_ordering() {
        let ts1 = SmallTimestamp::now();

        // Sleep for 1 millisecond to ensure the timestamp is different
        std::thread::sleep(std::time::Duration::from_millis(1));

        let ts2 = SmallTimestamp::now();
        assert!(ts1 < ts2);
    }
}
