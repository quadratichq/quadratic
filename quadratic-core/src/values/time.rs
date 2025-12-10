use std::fmt::{self, Display};
use std::ops::{Add, Mul, Neg, Sub};
use std::str::FromStr;

use anyhow::{Result, bail};
use chrono::{DateTime, MappedLocalTime, NaiveDate, NaiveDateTime, NaiveTime, Utc};
use regex::Regex;
use rust_decimal::prelude::*;
use serde::{Deserialize, Serialize};
use strum::VariantArray;

use crate::CellValue;

const MAX_SUBSECOND_DIGITS: f64 = 10.0;

// #[cfg_attr(test, derive(proptest_derive::Arbitrary))]
#[derive(Serialize, Deserialize, Debug, Copy, Clone)]
#[cfg_attr(feature = "js", derive(ts_rs::TS))]
pub struct Instant {
    // #[cfg_attr(test, proptest(strategy = "0.0..(i32::MAX as f64)"))]
    pub seconds: f64,
}

impl Instant {
    pub fn new(seconds: f64) -> Self {
        Self { seconds }
    }

    pub fn now() -> Self {
        Utc::now().naive_utc().into()
    }
}

impl From<NaiveDateTime> for Instant {
    fn from(datetime: NaiveDateTime) -> Self {
        Self {
            seconds: datetime.and_utc().timestamp() as f64,
        }
    }
}

impl Default for Instant {
    fn default() -> Self {
        Instant::now()
    }
}

impl fmt::Display for Instant {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        write!(
            f,
            "{}",
            CellValue::Text("not implemented".to_string()) // unpack_unix_timestamp(self.seconds as i64).unwrap_or_default()
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
#[derive(Serialize, Deserialize, Debug, Default, Copy, Clone)]
#[cfg_attr(feature = "js", derive(ts_rs::TS))]
pub struct Duration {
    pub months: i32,

    // `chrono::TimeDelta` would make sense here but it gives some serde error?
    #[cfg_attr(test, proptest(strategy = "(i32::MIN as f64)..(i32::MAX as f64)"))]
    pub seconds: f64,
}

impl fmt::Display for Duration {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        // Handle zero and sub-second durations separately.
        if self.months == 0 && self.seconds.abs() < 1.0 {
            // Display only one unit.
            let mut unit = TimeUnit::Second;
            let mut quantity = self.seconds;
            if let Some(u) = self.largest_unit() {
                unit = u;
                quantity /= Duration::from(u).seconds;
            }

            // Round so we don't display bogus digits
            let precision = 10.0_f64.powf(MAX_SUBSECOND_DIGITS);
            quantity = (quantity * precision).round() / precision;

            return write!(f, "{quantity}{unit}");
        }

        // Split months into years and months.
        let mut months = self.months;
        let years = months / 12;
        months -= years * 12;

        // Split seconds into days, hours, minutes, and seconds.
        let mut seconds = self.seconds;
        let mut minutes = (seconds / 60.0).trunc();
        seconds -= minutes * 60.0;
        let mut hours = (minutes / 60.0).trunc();
        minutes -= hours * 60.0;
        let days = (hours / 24.0).trunc();
        hours -= days * 24.0;

        let mut units_to_display = vec![
            (days, TimeUnit::Day),
            (hours, TimeUnit::Hour),
            (minutes, TimeUnit::Minute),
            (seconds, TimeUnit::Second),
        ];

        // Only display zeros if they're between nonzero units.
        if self.months == 0 {
            while units_to_display.first().is_some_and(|&(n, _)| n == 0.0) {
                units_to_display.remove(0);
            }
        }
        while units_to_display.last().is_some_and(|&(n, _)| n == 0.0) {
            units_to_display.pop();
        }

        // Display months and years whenever they are present, regardless of
        // seconds-based units.
        if months != 0 {
            units_to_display.insert(0, (months as f64, TimeUnit::Month));
        }
        if years != 0 {
            units_to_display.insert(0, (years as f64, TimeUnit::Year));
        }

        let mut is_first = true;
        for (mut quantity, unit) in units_to_display {
            match is_first {
                true => is_first = false,
                false => write!(f, " ")?,
            }

            // Replace `-0.0` with `0.0`.
            if quantity == 0.0 {
                quantity = 0.0;
            }

            // Round `quantity` to the nearest 0.001
            quantity = (quantity * 1000.0).round() / 1000.0;

            write!(f, "{quantity}{unit}")?;
        }

        Ok(())
    }
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub enum ParseDurationError {
    Empty,
    InvalidUnit,
    BadInteger(std::num::ParseIntError),
    BadFloat(std::num::ParseFloatError),
    NondecreasingUnitOrder,
}
impl FromStr for Duration {
    type Err = ParseDurationError;

    fn from_str(s: &str) -> std::result::Result<Self, Self::Err> {
        // This regex matches tons of invalid inputs, and that's fine -- it just
        // needs to correctly segment the input text.
        lazy_static::lazy_static! {
            /// Match an integer (minus sign, decimal point, & digits) followed
            /// by some other symbols (hopefully alphabetic ones representing a
            /// unit of time!)
            ///
            /// We use "0 or more" matching to ensure that we never miss part of
            /// the string.
            static ref TIME_UNIT_REGEX: Regex = Regex::new(r"([-\.\d]*)([^-\d]*)").unwrap();
        }

        let mut any_segment = false;
        let mut sum = Duration::ZERO;
        let mut last_unit = None;
        for segments in TIME_UNIT_REGEX.captures_iter(s.trim()) {
            any_segment = true;

            let count_str = segments[1].trim();

            let unit_str = &segments[2].trim();
            let stripped = unit_str.strip_suffix(',').unwrap_or(unit_str);

            // Only apply lowercase for multi-character units. Single-character
            // units must be lowercase to avoid false positives like "5M" being
            // parsed as 5 minutes (when it might mean megabytes or just text).
            let normalized = if stripped.len() > 1 {
                stripped.to_ascii_lowercase()
            } else {
                stripped.to_string()
            };

            let unit: TimeUnit = normalized
                .parse()
                .map_err(|()| ParseDurationError::InvalidUnit)?;

            // Require decreasing unit size.
            if last_unit.is_some_and(|it| unit > it) {
                return Err(ParseDurationError::NondecreasingUnitOrder);
            }

            last_unit = Some(unit);

            let additional_duration = if unit.allows_float() {
                Duration::from(unit)
                    * count_str
                        .parse::<f64>()
                        .map_err(ParseDurationError::BadFloat)?
            } else {
                Duration::from(unit)
                    * count_str
                        .parse::<i32>()
                        .map_err(ParseDurationError::BadInteger)?
            };

            sum = sum + additional_duration;
        }

        if any_segment {
            Ok(sum)
        } else {
            Err(ParseDurationError::Empty)
        }
    }
}

impl PartialEq for Duration {
    fn eq(&self, other: &Self) -> bool {
        self.months == other.months && f64::total_cmp(&self.seconds, &other.seconds).is_eq()
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
        let mut ret = self.months.cmp(&other.months);
        if ret.is_eq() {
            ret = f64::total_cmp(&self.seconds, &other.seconds);
        }
        ret
    }
}

impl Add for Duration {
    type Output = Self;

    fn add(self, rhs: Self) -> Self::Output {
        // TODO: this should always be checked addition
        Self {
            months: self.months + rhs.months,
            seconds: self.seconds + rhs.seconds,
        }
    }
}
impl Neg for Duration {
    type Output = Self;

    fn neg(self) -> Self::Output {
        // TODO: this should always be checked negation
        Self {
            months: -self.months,
            seconds: -self.seconds,
        }
    }
}
impl Sub for Duration {
    type Output = Self;

    fn sub(self, rhs: Self) -> Self::Output {
        // TODO: this should always be checked subtraction
        Self {
            months: self.months - rhs.months,
            seconds: self.seconds - rhs.seconds,
        }
    }
}
impl Mul<i32> for Duration {
    type Output = Self;

    fn mul(self, rhs: i32) -> Self::Output {
        // TODO: this should always be checked multiplication
        Self {
            months: self.months * rhs,
            seconds: self.seconds * rhs as f64,
        }
    }
}
impl Mul<f64> for Duration {
    type Output = Self;

    fn mul(self, rhs: f64) -> Self::Output {
        // TODO: this should always be checked multiplication
        Self {
            months: self.months * rhs.round() as i32, // ick
            seconds: self.seconds * rhs,
        }
    }
}

impl From<chrono::TimeDelta> for Duration {
    fn from(value: chrono::TimeDelta) -> Self {
        Duration::from_seconds(value.num_seconds() as f64)
            + Duration::from_nanoseconds(value.subsec_nanos() as f64)
    }
}

impl Duration {
    /// Zero duration.
    pub const ZERO: Self = Self {
        months: 0,
        seconds: 0.0,
    };

    pub const YEAR: Self = Self::from_years(1);
    pub const MONTH: Self = Self::from_months(1);
    pub const WEEK: Self = Self::from_seconds(60.0 * 60.0 * 24.0 * 7.0);
    pub const DAY: Self = Self::from_seconds(60.0 * 60.0 * 24.0);
    pub const HOUR: Self = Self::from_seconds(60.0 * 60.0);
    pub const MINUTE: Self = Self::from_seconds(60.0);
    pub const SECOND: Self = Self::from_seconds(1.0);
    pub const MILLISECOND: Self = Self::from_seconds(0.001);
    pub const MICROSECOND: Self = Self::from_seconds(0.000_001);
    pub const NANOSECOND: Self = Self::from_seconds(0.000_000_001);
    pub const PICOSECOND: Self = Self::from_seconds(0.000_000_000_001);
    pub const FEMTOSECOND: Self = Self::from_seconds(0.000_000_000_000_001);
    pub const ATTOSECOND: Self = Self::from_seconds(0.000_000_000_000_000_001);

    /// Constructs a duration lasting some number of years.
    pub const fn from_years(years: i32) -> Self {
        Self::from_months(years * 12)
    }

    /// Constructs a duration lasting some number of months.
    pub const fn from_months(months: i32) -> Self {
        Self {
            months,
            ..Self::ZERO
        }
    }

    /// Constructs a duration lasting some number of days, automatically
    /// converting to `f64`.
    pub fn from_days_bigdec(days: &Decimal) -> Self {
        Self::from_days(days.to_f64().unwrap_or(0.0))
    }

    /// Constructs a duration lasting some number of hours, automatically
    /// converting to `f64`.
    pub fn from_hours_bigdec(hours: &Decimal) -> Self {
        Self::from_hours(hours.to_f64().unwrap_or(0.0))
    }

    /// Constructs a duration lasting some number of days.
    pub fn from_days(days: f64) -> Self {
        Self::from_hours(days * 24.0)
    }

    /// Constructs a duration lasting some number of hours.
    pub fn from_hours(hours: f64) -> Self {
        Self::from_minutes(hours * 60.0)
    }

    /// Constructs a duration lasting some number of minutes.
    pub fn from_minutes(minutes: f64) -> Self {
        Self::from_seconds(minutes * 60.0)
    }

    /// Constructs a duration lasting some number of seconds.
    pub const fn from_seconds(seconds: f64) -> Self {
        Self {
            seconds,
            ..Self::ZERO
        }
    }

    /// Constructs a duration lasting some number of milliseconds.
    pub fn from_milliseconds(ms: f64) -> Self {
        Self::from_seconds(0.001 * ms)
    }
    /// Constructs a duration lasting some number of microseconds.
    pub fn from_microseconds(us: f64) -> Self {
        Self::from_milliseconds(0.001 * us)
    }
    /// Constructs a duration lasting some number of nanoseconds.
    pub fn from_nanoseconds(ns: f64) -> Self {
        Self::from_microseconds(0.001 * ns)
    }
    /// Constructs a duration lasting some number of picoseconds.
    pub fn from_picoseconds(ps: f64) -> Self {
        Self::from_nanoseconds(0.001 * ps)
    }
    /// Constructs a duration lasting some number of picoseconds.
    pub fn from_femtoseconds(ps: f64) -> Self {
        Self::from_picoseconds(0.001 * ps)
    }
    /// Constructs a duration lasting some number of attoseconds.
    pub fn from_attoseconds(a_s: f64) -> Self {
        Self::from_femtoseconds(0.001 * a_s)
    }

    pub fn abs(self) -> Self {
        match self.months.cmp(&0) {
            std::cmp::Ordering::Less => return -self,
            std::cmp::Ordering::Greater => return self,
            std::cmp::Ordering::Equal => (),
        };
        match self.seconds.partial_cmp(&0.0) {
            Some(std::cmp::Ordering::Less) => -self,
            Some(std::cmp::Ordering::Greater) => self,
            _ => self,
        }
    }

    /// Returns whether the duration represents zero time.
    fn is_zero(self) -> bool {
        self == Self::ZERO
    }

    /// Returns whether the duration represents an integer number of days.
    pub fn is_integer_days(self) -> bool {
        (self.seconds / Self::DAY.seconds).fract() == 0.0
    }

    /// Returns the number of years, rounded down to an integer.
    pub fn years(self) -> i32 {
        self.months.div_euclid(12)
    }
    /// Returns the number of months as an integer between `0` and `11`
    /// (inclusive).
    pub fn subyear_months(self) -> i32 {
        self.months.rem_euclid(12)
    }
    /// Returns the number of days as an integer.
    pub fn days(self) -> i64 {
        (self.seconds / 86_400.0).floor() as i64
    }
    /// Returns the number of hours as an integer between `0` and `23`
    /// (inclusive).
    pub fn subday_hours(self) -> i32 {
        ((self.seconds / 3_600.0).floor() as i32).rem_euclid(24)
    }
    /// Returns the number of minutes as an integer between `0` and `59`
    /// (inclusive).
    pub fn subhour_minutes(self) -> i32 {
        ((self.seconds / 60.0).floor() as i32).rem_euclid(60)
    }
    /// Returns the number of seconds as a floating-point number between `0`
    /// (inclusive) and `60.0` (exclusive).
    pub fn subminute_seconds(self) -> f64 {
        self.seconds.rem_euclid(60.0)
    }

    /// Returns a number of fractional days representing this duration.
    ///
    /// If the duration contains months or years, then this is an approximation
    /// using `365.24 / 12.0` as the number of days in a month. The number of
    /// days contributed by months/years is always rounded to the nearest
    /// integer.
    pub fn to_fractional_days(self) -> f64 {
        self.seconds / 86_400.0 + (self.months as f64 * (365.24 / 12.0)).round()
    }

    /// Returns the largest unit that is still smaller than this duration, or
    /// `None` if the duration is zero. If the duration is less than the
    /// smallest known unit (one attosecond, at time of writing), then that
    /// smallest unit is returned.
    fn largest_unit(self) -> Option<TimeUnit> {
        (!self.is_zero()).then(|| {
            TimeUnit::VARIANTS
                .iter()
                .rev()
                .copied()
                .find(|&unit| Duration::from(unit) < self.abs())
                .unwrap_or(TimeUnit::Attosecond)
        })
    }

    /// Returns the number of seconds as a `chrono::TimeDelta`, ignoring months.
    fn to_chrono_timedelta(self) -> chrono::TimeDelta {
        chrono::TimeDelta::seconds(self.seconds.trunc() as i64)
            + chrono::TimeDelta::nanoseconds((self.seconds.fract() * 1_000_000_000.0) as i64)
    }
}

impl From<TimeUnit> for Duration {
    fn from(unit: TimeUnit) -> Self {
        match unit {
            TimeUnit::Attosecond => Self::ATTOSECOND,
            TimeUnit::Femtosecond => Self::FEMTOSECOND,
            TimeUnit::Picosecond => Self::PICOSECOND,
            TimeUnit::Nanosecond => Self::NANOSECOND,
            TimeUnit::Microsecond => Self::MICROSECOND,
            TimeUnit::Millisecond => Self::MILLISECOND,
            TimeUnit::Second => Self::SECOND,
            TimeUnit::Minute => Self::MINUTE,
            TimeUnit::Hour => Self::HOUR,
            TimeUnit::Day => Self::DAY,
            TimeUnit::Week => Self::WEEK,
            TimeUnit::Month => Self::MONTH,
            TimeUnit::Year => Self::YEAR,
        }
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

#[derive(Debug, Copy, Clone, PartialEq, Eq, Hash, PartialOrd, Ord, strum::VariantArray)]
enum TimeUnit {
    Attosecond,
    Femtosecond,
    Picosecond,
    Nanosecond,
    Microsecond,
    Millisecond,
    Second,
    Minute,
    Hour,
    Day,
    Week,
    Month,
    Year,
}
impl fmt::Display for TimeUnit {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        write!(f, "{}", self.short_name())
    }
}
impl FromStr for TimeUnit {
    type Err = ();

    fn from_str(s: &str) -> std::result::Result<Self, Self::Err> {
        match s {
            "as" | "attosec" | "attosecond" | "attoseconds" => Ok(Self::Attosecond),
            "fs" | "femtosec" | "femtosecond" | "femtoseconds" => Ok(Self::Femtosecond),
            "ps" | "picosec" | "picosecond" | "picoseconds" => Ok(Self::Picosecond),
            "ns" | "nanosec" | "nanosecond" | "nanoseconds" => Ok(Self::Nanosecond),
            "us" | "µs" | "microsec" | "microsecond" | "microseconds" => Ok(Self::Microsecond),
            "ms" | "millisec" | "millisecond" | "milliseconds" => Ok(Self::Millisecond),
            "s" | "sec" | "second" | "secs" | "seconds" => Ok(Self::Second),
            "m" | "min" | "minute" | "mins" | "minutes" => Ok(Self::Minute),
            "h" | "hr" | "hour" | "hrs" | "hours" => Ok(Self::Hour),
            "d" | "day" | "days" => Ok(Self::Day),
            "w" | "week" | "weeks" => Ok(Self::Week),
            "mo" | "mon" | "month" | "months" => Ok(Self::Month),
            "y" | "yr" | "year" | "yrs" | "years" => Ok(Self::Year),
            _ => Err(()),
        }
    }
}
impl TimeUnit {
    /// Whether [`Duration`] can hold an arbitrary fractional amount of this
    /// unit.
    fn allows_float(self) -> bool {
        match self {
            TimeUnit::Attosecond => true,
            TimeUnit::Femtosecond => true,
            TimeUnit::Picosecond => true,
            TimeUnit::Nanosecond => true,
            TimeUnit::Microsecond => true,
            TimeUnit::Millisecond => true,
            TimeUnit::Second => true,
            TimeUnit::Minute => true,
            TimeUnit::Hour => true,
            TimeUnit::Day => true,
            TimeUnit::Week => true,
            TimeUnit::Month => false,
            TimeUnit::Year => false,
        }
    }

    pub fn short_name(self) -> &'static str {
        match self {
            TimeUnit::Attosecond => "as",
            TimeUnit::Femtosecond => "fs",
            TimeUnit::Picosecond => "ps",
            TimeUnit::Nanosecond => "ns",
            TimeUnit::Microsecond => "µs",
            TimeUnit::Millisecond => "ms",
            TimeUnit::Second => "s",
            TimeUnit::Minute => "m",
            TimeUnit::Hour => "h",
            TimeUnit::Day => "d",
            TimeUnit::Week => "w",
            TimeUnit::Month => "mo",
            TimeUnit::Year => "y",
        }
    }
}

pub fn add_to_datetime(datetime: NaiveDateTime, duration: Duration) -> NaiveDateTime {
    add_months(datetime, duration.months) + duration.to_chrono_timedelta()
}
pub fn add_to_date(date: NaiveDate, duration: Duration) -> NaiveDate {
    add_months(date, duration.months) + duration.to_chrono_timedelta()
}
pub fn add_to_time(time: NaiveTime, duration: Duration) -> NaiveTime {
    time + duration.to_chrono_timedelta()
}
pub fn add_months<T: Add<chrono::Months, Output = T> + Sub<chrono::Months, Output = T>>(
    t: T,
    months: i32,
) -> T {
    if months < 0 {
        t - chrono::Months::new(-months as u32)
    } else {
        t + chrono::Months::new(months as u32)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_duration_parsing() {
        for (input, expected) in [
            ("3y10d", Ok("3y 10d")),
            ("987 attosec", Ok("987as")),
            ("0.12 attosec", Ok("0.12as")),
            ("0.456 ns", Ok("456ps")),
            ("0.0004 seconds", Ok("400µs")),
            ("10year,3 mo2w16d, 4000min", Ok("10y 3mo 32d 18h 40m")),
            (" 0 \tDAYS", Ok("0s")),
            (" 6   milliseconds 5 µs 4nanosec  ", Ok("6.005004ms")),
            ("3 picosecond, 2 fs1as", Ok("3.002001ps")),
            ("10 femtoseconds", Ok("10fs")),
            ("14 nanosec", Ok("14ns")),
            ("0.5s", Ok("500ms")),
            ("1 year 0.5s", Ok("1y 0d 0h 0m 0.5s")),
            // negatives
            ("-1 yrs", Ok("-1y")),
            ("-6 milliseconds -5 µs -4nanosec", Ok("-6.005004ms")),
            ("-3 picosecond, -2 fs1as", Ok("-3.001999ps")),
            ("-1 y-3 d", Ok("-1y -3d")),
            ("-0.4s", Ok("-400ms")),
            ("-1 year -0.5s", Ok("-1y 0d 0h 0m -0.5s")),
            // errors
            ("1y ,3m", Err(())),                     // space before comma
            ("4:30", Err(())),                       // time, not duration
            ("16", Err(())),                         // no unit
            ("3,y10d", Err(())),                     // comma in a bad spot
            ("10year,3 mo2w16d,, 4000min", Err(())), // double comma
            ("1 year month", Err(())),               // two units in a row
            ("0.5 year", Err(())),                   // fractional year is not allowed
            ("3 mo, 10year", Err(())),               // nondecreasing unit order
            ("5M", Err(())),                         // uppercase single-letter unit should NOT match
            ("5S", Err(())),                         // uppercase single-letter unit should NOT match
            ("5H", Err(())),                         // uppercase single-letter unit should NOT match
        ] {
            println!("Parsing duration {input:?}");
            let result = input.parse::<Duration>();
            match expected {
                Ok(expected_ok) => {
                    assert_eq!(result.unwrap().to_string(), expected_ok);

                    // Test idempotency
                    println!("Parsing duration {expected_ok:?}");
                    assert_eq!(
                        expected_ok.parse::<Duration>().unwrap().to_string(),
                        expected_ok,
                    );
                }
                Err(()) => {
                    result.unwrap_err();
                }
            }
        }
    }

    #[test]
    fn test_duration_construction() {
        assert_eq!(Duration::from_years(3).to_string(), "3y");
        assert_eq!(Duration::from_months(3).to_string(), "3mo");

        assert_eq!(Duration::from_days(3.25).to_string(), "3d 6h");

        assert_eq!(Duration::from_attoseconds(3.2).to_string(), "3.2as");
        assert_eq!(Duration::from_femtoseconds(3.2).to_string(), "3.2fs");
        assert_eq!(Duration::from_picoseconds(3.2).to_string(), "3.2ps");
    }

    #[test]
    fn test_duration_to_fractional_days() {
        assert_eq!(
            (Duration::from_months(12) + Duration::from_days(5.5)).to_fractional_days(),
            370.5,
        );
        assert_eq!(
            (Duration::from_months(1) + Duration::from_days(-3.0)).to_fractional_days(),
            27.0,
        );
    }

    #[test]
    fn test_duration_to_string() {
        assert_eq!(Duration::from_seconds(5.0).to_string(), "5s");
        assert_eq!(Duration::from_str("5s").unwrap().to_string(), "5s");
    }
}
