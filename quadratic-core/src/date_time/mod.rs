//! Handles converting NaiveDate, NaiveTime, and NaiveDateTime to strings using
//! strftime format strings. This is a bit complicated because we have to handle
//! the case where the format string contains both date and time elements, but
//! the value is only a Date or Time. In this case, we need to truncate the
//! format string to only include the relevant elements. (Otherwise it throws an
//! error.)

use itertools::Itertools;
use std::{cmp::Ordering, str::FromStr};

use chrono::{
    DateTime, Datelike, NaiveDate, NaiveDateTime, NaiveTime, Timelike, Utc,
    format::{Fixed, Item, Numeric, StrftimeItems},
};

mod date_time_convert;
mod wasm;

pub const DEFAULT_DATE_FORMAT: &str = "%m/%d/%Y";
pub const DEFAULT_TIME_FORMAT: &str = "%-I:%M %p";
pub const DEFAULT_DATE_TIME_FORMAT: &str = "%m/%d/%Y %-I:%M %p";

/// Whether to prefer the American style M/D/Y instead of the international
/// D/M/Y.
pub const AMERICAN: bool = true;
/// Cutoff year between for 2-digit parsing. For example, should `12/31/36`
/// parse as 1936 or 2036?
///
/// Numbers below this cutoff are in the 21st century (20xx) and numbers at or
/// above this cutoff are in the 19th century (19xx). This should only affect
/// parsing, so it's safe to change in the future or even make it based on the
/// current year without breaking existing files.
pub const CENTURY_CUTOFF: u32 = 50;
/// Symbols used as separators when parsing dates, not including whitespace.
pub const DATE_SEPARATOR_SYMBOLS: &[char] = &['/', '-', '.'];

fn is_date_item(item: &Item<'_>) -> bool {
    matches!(
        item,
        Item::Numeric(
            Numeric::Year
                | Numeric::YearDiv100
                | Numeric::YearMod100
                | Numeric::IsoYear
                | Numeric::IsoYearDiv100
                | Numeric::IsoYearMod100
                | Numeric::Month
                | Numeric::Day
                | Numeric::WeekFromSun
                | Numeric::WeekFromMon
                | Numeric::IsoWeek
                | Numeric::NumDaysFromSun
                | Numeric::WeekdayFromMon
                | Numeric::Ordinal,
            _
        ) | Item::Fixed(
            Fixed::ShortMonthName
                | Fixed::LongMonthName
                | Fixed::LongWeekdayName
                | Fixed::ShortWeekdayName
                | Fixed::TimezoneName
                | Fixed::TimezoneOffset
                | Fixed::TimezoneOffsetColon
                | Fixed::TimezoneOffsetColonZ
                | Fixed::TimezoneOffsetDoubleColon
                | Fixed::TimezoneOffsetTripleColon
                | Fixed::TimezoneOffsetZ
        )
    )
}

fn is_time_item(item: &Item<'_>) -> bool {
    matches!(
        item,
        Item::Numeric(
            Numeric::Ordinal
                | Numeric::Hour
                | Numeric::Hour12
                | Numeric::Minute
                | Numeric::Second
                | Numeric::Nanosecond
                | Numeric::Timestamp,
            _
        ) | Item::Fixed(
            Fixed::LowerAmPm
                | Fixed::Nanosecond
                | Fixed::Nanosecond3
                | Fixed::Nanosecond6
                | Fixed::Nanosecond9
                | Fixed::TimezoneName
                | Fixed::TimezoneOffset
                | Fixed::TimezoneOffsetColon
                | Fixed::TimezoneOffsetColonZ
                | Fixed::TimezoneOffsetDoubleColon
                | Fixed::TimezoneOffsetTripleColon
                | Fixed::TimezoneOffsetZ
                | Fixed::UpperAmPm
        )
    )
}

fn is_space_item(item: &Item<'_>) -> bool {
    matches!(item, Item::Space(_))
}

/// Finds the index of the first time item in a strftime format string.
fn find_items_time_start(items: &[Item<'_>]) -> Option<usize> {
    items.iter().position(|i| is_time_item(i))
}

fn find_items_date_start(items: &[Item<'_>]) -> Option<usize> {
    items.iter().position(|i| is_date_item(i))
}

/// Converts a NaiveDateTime to a date and time string using a strftime format string.
pub fn date_time_to_date_time_string(date_time: NaiveDateTime, format: Option<String>) -> String {
    let format = format.map_or(DEFAULT_DATE_TIME_FORMAT.to_string(), |f| f);
    let strftime_items = StrftimeItems::new(&format);
    let Ok(items) = strftime_items.parse() else {
        return date_time.format(DEFAULT_DATE_TIME_FORMAT).to_string();
    };
    date_time.format_with_items(items.iter()).to_string()
}

/// Converts a NaiveDateTime to a date-only string using a strftime format string.
pub fn date_to_date_string(date: NaiveDate, format: Option<String>) -> String {
    let format = format.map_or(DEFAULT_DATE_TIME_FORMAT.to_string(), |f| f);
    let strftime_items = StrftimeItems::new(&format);
    let Ok(mut items) = strftime_items.parse() else {
        return date.format(DEFAULT_DATE_FORMAT).to_string();
    };

    let time_start = find_items_time_start(&items);
    let date_start = find_items_date_start(&items);

    if let (Some(mut time_start), Some(date_start)) = (time_start, date_start) {
        // remove any time items before the date items
        match date_start.cmp(&time_start) {
            Ordering::Less => {
                while time_start > 0 && is_space_item(&items[time_start - 1]) {
                    time_start -= 1;
                }
                items.drain(time_start..);
            }
            Ordering::Greater => {
                let mut date_end = date_start - 1;
                while date_end > 0 && is_space_item(&items[date_end - 1]) {
                    date_end -= 1;
                }
                items.drain(0..=date_end);
            }
            Ordering::Equal => (),
        }
    } else if let (Some(_), None) = (time_start, date_start) {
        // handle case where there are no date items, only time items
        return date.to_string();
    }

    date.format_with_items(items.iter()).to_string()
}

/// Converts a NaiveDateTime to a time-only string using a strftime format string.
pub fn time_to_time_string(time: NaiveTime, format: Option<String>) -> String {
    let format = format.map_or(DEFAULT_DATE_TIME_FORMAT.to_string(), |f| f);
    let strftime_items = StrftimeItems::new(&format);
    let Ok(mut items) = strftime_items.parse() else {
        return time.format(DEFAULT_TIME_FORMAT).to_string();
    };

    let time_start = find_items_time_start(&items);
    let date_start = find_items_date_start(&items);
    if let (Some(mut time_start), Some(mut date_start)) = (time_start, date_start) {
        // remove any space items before the time items
        match time_start.cmp(&date_start) {
            Ordering::Greater => {
                while time_start > 0 && is_space_item(&items[time_start]) {
                    time_start -= 1;
                }
                items.drain(date_start..time_start);
            }
            Ordering::Less => {
                while date_start > 0 && is_space_item(&items[date_start - 1]) {
                    date_start -= 1;
                }
                items.drain(date_start..);
            }
            Ordering::Equal => (),
        }
    } else if date_start.is_some() {
        // handle case where there are no time items, only date items
        return time.to_string();
    }

    // remove any date items before the time items
    time.format_with_items(items.iter()).to_string()
}

/// Parses a time string using a list of possible formats, returning the parsed
/// time and the strftime format string that matches the user's input format.
pub fn parse_time_with_format(value: &str) -> Option<(NaiveTime, String)> {
    // Formats paired with their output format for display
    let formats = [
        ("%H:%M:%S", "%-H:%M:%S"),
        ("%I:%M:%S %p", "%-I:%M:%S %p"),
        ("%I:%M:%S%p", "%-I:%M:%S %p"),
        ("%I:%M %p", "%-I:%M %p"),
        ("%I:%M%p", "%-I:%M %p"),
        ("%H:%M", "%-H:%M"),
        ("%I:%M:%S", "%-I:%M:%S"),
        ("%I:%M", "%-I:%M"),
        ("%H:%M:%S%.3f", "%-H:%M:%S"),
    ];

    for &(parse_format, output_format) in formats.iter() {
        if let Ok(parsed_time) = NaiveTime::parse_from_str(value, parse_format) {
            return Some((parsed_time, output_format.to_string()));
        }

        // this is a hack to handle the case where the user leaves out minutes in a time
        // e.g. 4pm instead of 4:00pm
        let lowercase = value.to_lowercase();
        let (time_number, am_pm) = if lowercase.contains("pm") {
            (lowercase.replace("pm", "").trim().to_string(), "PM")
        } else if lowercase.contains("am") {
            (lowercase.replace("am", "").trim().to_string(), "AM")
        } else {
            continue;
        };
        if let Ok(parsed_time) =
            NaiveTime::parse_from_str(&format!("{time_number}:00 {am_pm}"), parse_format)
        {
            // For AM/PM input, always use the AM/PM format for output
            return Some((parsed_time, "%-I:%M %p".to_string()));
        }
    }
    None
}

/// Parses a time string using a list of possible formats.
pub fn parse_time(value: &str) -> Option<NaiveTime> {
    parse_time_with_format(value).map(|(time, _)| time)
}

#[derive(Debug, Clone)]
struct ParsedDateComponents {
    /// Character used to separate components.
    separator: char,
    components: Vec<ParsedDateComponent>,
}
impl FromStr for ParsedDateComponents {
    type Err = ();

    fn from_str(s: &str) -> Result<Self, Self::Err> {
        match DATE_SEPARATOR_SYMBOLS.iter().find(|&&c| s.contains(c)) {
            Some(&c) => Self::new(c, s.trim().split(c)),
            None => Self::new(' ', s.replace(',', " ").split_whitespace()),
            // `.trim().split_whitespace()` would be redundant
        }
    }
}
impl ParsedDateComponents {
    fn new<'a>(separator: char, components: impl Iterator<Item = &'a str>) -> Result<Self, ()> {
        let components = components
            .map(str::trim)
            .map(ParsedDateComponent::from_str)
            .try_collect()
            .map_err(|_| (/* don't care about error details */))?;

        Ok(Self {
            separator,
            components,
        })
    }

    fn len(&self) -> usize {
        self.components.len()
    }

    /// Converts the internal format string to a strftime format string that
    /// preserves the user's input style (separator, month name vs number, etc.)
    pub fn to_strftime_format(&self, format: &str) -> String {
        let sep = if self.separator == ' ' {
            " ".to_string()
        } else {
            self.separator.to_string()
        };

        let parts: Vec<String> = format
            .chars()
            .zip(&self.components)
            .map(|(format_char, component)| {
                match format_char {
                    'y' | 'Y' => {
                        // Use %Y for 4-digit years, %y for 2-digit
                        if matches!(component, ParsedDateComponent::Year(_)) {
                            "%Y".to_string()
                        } else {
                            "%y".to_string()
                        }
                    }
                    'm' | 'M' => {
                        // Use %b for named months, %m or %-m for numeric
                        if matches!(component, ParsedDateComponent::Month(_)) {
                            "%b".to_string()
                        } else if component.has_leading_zero() {
                            "%m".to_string() // preserve leading zero
                        } else {
                            "%-m".to_string() // no padding
                        }
                    }
                    'd' | 'D' => {
                        // Preserve leading zero if present
                        if component.has_leading_zero() {
                            "%d".to_string() // with padding
                        } else {
                            "%-d".to_string() // no padding
                        }
                    }
                    c => panic!("unexpected char {c:?} in date format"),
                }
            })
            .collect();

        parts.join(&sep)
    }

    /// Takes a 2- or 3-character format string and tries to return this date,
    /// parsed using that format. For example, `mdy` would match `12/25/2010`
    /// but not `2010-12-25` (because `2010` must be a year).
    ///
    /// The following symbols are allowed:
    /// - `y` = number that could be a year
    /// - `m` = number that could be a month
    /// - `d` = number that could be a day
    /// - `Y` = number that MUST be a year (e.g., because it is 4 digits)
    /// - `M` = number that MUST be a month (e.g., because it is a named month)
    /// - `D` = number that MUST be a day (e.g., because it is an ordinal number)
    ///
    /// Any other symbols cause a panic.
    pub fn try_format(&self, format: &str) -> Option<chrono::NaiveDate> {
        if format.len() != self.components.len() {
            return None;
        }

        let mut year = None;
        let mut month = None;
        let mut day = None;
        for (format_char, component) in std::iter::zip(format.chars(), &self.components) {
            match format_char {
                'y' => year = Some(component.year()?),
                'm' => month = Some(component.month()?),
                'd' => day = Some(component.day()?),
                'Y' => year = Some(component.year().filter(|_| !component.is_ambiguous())?),
                'M' => month = Some(component.month().filter(|_| !component.is_ambiguous())?),
                'D' => day = Some(component.day().filter(|_| !component.is_ambiguous())?),
                c => panic!("unexpected char {c:?} in date format"),
            }
        }

        // Infer defaults if unspecified in the pattern.
        NaiveDate::from_ymd_opt(
            match year {
                Some(y) => i32::try_from(y).ok()?,
                None => Utc::now().year(),
            },
            month.unwrap_or(1),
            day.unwrap_or(1),
        )
    }
}

#[derive(Debug, Copy, Clone)]
enum ParsedDateComponent {
    /// Unambiguous year (4 digits)
    Year(u32),
    /// Unambiguous month (named, like "January")
    Month(u32),
    /// Unambiguous day (has ordinal suffix, like "3rd")
    Day(u32),
    /// Ambiguous (1- or 2-digit number)
    Ambiguous {
        year: Option<u32>,
        month: Option<u32>,
        day: Option<u32>,
        /// Whether the original string had a leading zero (e.g., "01" vs "1")
        has_leading_zero: bool,
    },
}

impl FromStr for ParsedDateComponent {
    type Err = ();

    fn from_str(s: &str) -> Result<Self, Self::Err> {
        if let Ok(named_month) = chrono::Month::from_str(s) {
            // Example: `January`
            Ok(Self::Month(named_month.number_from_month()))
        } else if let Some(ordinal) = s
            .strip_suffix("st")
            .or_else(|| s.strip_suffix("nd"))
            .or_else(|| s.strip_suffix("rd"))
            .or_else(|| s.strip_suffix("th"))
        {
            // Example `3rd`
            Ok(Self::Day(ordinal.parse().map_err(|_| ())?))
        } else {
            let n = s.parse().map_err(|_| ())?;
            // Check if the string has a leading zero (e.g., "01" vs "1")
            let has_leading_zero = s.len() == 2 && s.starts_with('0');
            match s.len() {
                // 1-digit number must be day or month. Example: `3`
                1 => Ok(Self::Ambiguous {
                    year: None,
                    month: Some(n),
                    day: Some(n),
                    has_leading_zero: false,
                }),
                // 2-digit number could be anything. Example: `12` or `01`
                2 => Ok(Self::Ambiguous {
                    year: match n {
                        ..CENTURY_CUTOFF => n.checked_add(2000),
                        CENTURY_CUTOFF.. => n.checked_add(1900),
                    },
                    month: Some(n),
                    day: Some(n),
                    has_leading_zero,
                }),
                // 4-digit number must be year. Example: `1619`
                4 => Ok(Self::Year(n)),
                // Anything else is probably not a date.
                _ => Err(()),
            }
        }
    }
}
impl ParsedDateComponent {
    fn year(self) -> Option<u32> {
        match self {
            ParsedDateComponent::Year(year) => Some(year),
            ParsedDateComponent::Ambiguous { year, .. } => year,
            _ => None,
        }
    }
    fn month(self) -> Option<u32> {
        match self {
            ParsedDateComponent::Month(month) => Some(month),
            ParsedDateComponent::Ambiguous { month, .. } => month,
            _ => None,
        }
    }
    fn has_leading_zero(self) -> bool {
        match self {
            ParsedDateComponent::Ambiguous {
                has_leading_zero, ..
            } => has_leading_zero,
            _ => false,
        }
    }
    fn day(self) -> Option<u32> {
        match self {
            ParsedDateComponent::Day(day) => Some(day),
            ParsedDateComponent::Ambiguous { day, .. } => day,
            _ => None,
        }
    }
    fn is_ambiguous(self) -> bool {
        matches!(self, ParsedDateComponent::Ambiguous { .. })
    }
}

/// Parses a date string using a list of possible formats, returning the parsed
/// date and a strftime format string that matches the user's input format.
pub fn parse_date_with_format(value: &str) -> Option<(NaiveDate, String)> {
    let components = ParsedDateComponents::from_str(value).ok()?;
    let sep = components.separator;

    if !(2..=3).contains(&components.len()) {
        return None;
    }

    if sep == '.' && components.len() == 2 {
        return None; // looks like a decimal number
    }

    let formats: &[&str] = if sep == ' ' {
        // When using spaces, a month name is always required.
        &[
            "MdY", // Dec 10 2024
            "Mdy", // Dec 10 24 (2-digit year)
            "dMY", // 10 Dec 2024
            "dMy", // 10 Dec 24 (2-digit year)
            "YMd", // 2024 Dec 10
            "yMd", // 24 Dec 10 (2-digit year)
            "dM",  // 10 Dec
            "Md",  // Dec 10
            "MY",  // Dec 2024
            "YM",  // 2024 Dec
        ]
    } else {
        &[
            //
            // 3 COMPONENTS
            //
            // `10/12/24` is `mdy` or `dmy` depending on locale.
            // This also covers `10/12/2024`.
            if AMERICAN { "mdy" } else { "dmy" },
            // Always accept the other pattern if there's a named month.
            "dMy",
            "Mdy",
            // `2024/10/12` is always `Ymd`
            "Ymd",
            //
            // 2 COMPONENTS
            //
            // `12/12` is `md` or `dm` depending on locale.
            if AMERICAN { "md" } else { "dm" },
            // Always accept the other pattern if there's a named month.
            "dM",
            "Md",
            // `2024/12` is `Ym` and `12/2024` is `mY`.
            "Ym",
            "mY",
        ]
    };

    for format in formats {
        if let Some(date) = components.try_format(format) {
            let strftime_format = components.to_strftime_format(format);
            return Some((date, strftime_format));
        }
    }
    None
}

/// Parses a date string using a list of possible formats.
pub fn parse_date(value: &str) -> Option<NaiveDate> {
    parse_date_with_format(value).map(|(date, _)| date)
}

/// Convert the entire time into seconds since midnight
pub fn naive_time_to_i32(time: NaiveTime) -> i32 {
    let hours = time.hour() as i32;
    let minutes = time.minute() as i32;
    let seconds = time.second() as i32;
    hours * 3600 + minutes * 60 + seconds
}

pub fn i32_to_naive_time(time: i32) -> Option<NaiveTime> {
    let hours = time / 3600;
    let minutes = (time % 3600) / 60;
    let seconds = time % 60;
    NaiveTime::from_hms_opt(hours as u32, minutes as u32, seconds as u32)
}

/// Convert a NaiveDateTime to an i64 timestamp.
pub fn naive_date_time_to_i64(date: NaiveDateTime) -> i64 {
    date.and_utc().timestamp()
}

/// Convert a NaiveDate to an i64 timestamp.
pub fn naive_date_to_i64(date: NaiveDate) -> Option<i64> {
    let time = NaiveTime::from_hms_opt(0, 0, 0)?;
    let dt = NaiveDateTime::new(date, time);
    Some(naive_date_time_to_i64(dt))
}

/// Convert an i64 timestamp to a NaiveDate.
pub fn i64_to_naive_date(timestamp: i64) -> Option<NaiveDate> {
    let dt = DateTime::from_timestamp(timestamp, 0)?;
    Some(dt.date_naive())
}

#[cfg(test)]
mod tests {

    use super::*;

    #[test]
    fn time() {
        let date_time = "12/23/2024 4:45 PM".to_string();
        let format = "%m/%d/%Y %-I:%M %p".to_string();

        let date_time = NaiveDateTime::parse_from_str(&date_time, &format).unwrap();
        assert_eq!(
            time_to_time_string(date_time.time(), Some(format)),
            "4:45 PM".to_string()
        );
    }

    #[test]
    fn naive_time_i32() {
        let time = NaiveTime::from_hms_opt(12, 34, 56);
        assert_eq!(naive_time_to_i32(time.unwrap()), 45296);
        assert_eq!(i32_to_naive_time(45296), time);
    }

    #[test]
    fn naive_date_i64() {
        let date = NaiveDate::from_ymd_opt(2024, 12, 23);
        assert_eq!(naive_date_to_i64(date.unwrap()), Some(1734912000));
        assert_eq!(i64_to_naive_date(1734912000), date);
    }

    #[test]
    fn test_parse_date() {
        let parsed_date = parse_date("12/23/2024").unwrap();
        assert_eq!(parsed_date, NaiveDate::from_ymd_opt(2024, 12, 23).unwrap());
        assert_eq!(
            parse_date("12/23/2024"),
            NaiveDate::from_ymd_opt(2024, 12, 23)
        );
        assert_eq!(
            parse_date("2024-12-23"),
            NaiveDate::from_ymd_opt(2024, 12, 23)
        );
        assert_eq!(
            parse_date("23 Dec 2024"),
            NaiveDate::from_ymd_opt(2024, 12, 23)
        );
        assert_eq!(
            parse_date("December 23, 2024"),
            NaiveDate::from_ymd_opt(2024, 12, 23)
        );
        assert_eq!(
            parse_date("2024/12/23"),
            NaiveDate::from_ymd_opt(2024, 12, 23)
        );
        assert_eq!(
            parse_date("jan 1,2024"),
            NaiveDate::from_ymd_opt(2024, 1, 1)
        );
        assert_eq!(parse_date("Jan 2024"), NaiveDate::from_ymd_opt(2024, 1, 1));
        assert_eq!(
            parse_date("4/10"),
            NaiveDate::from_ymd_opt(Utc::now().year(), 4, 10),
        );
        assert_eq!(
            parse_date("4/6"),
            NaiveDate::from_ymd_opt(Utc::now().year(), 4, 6),
        );
        assert_eq!(parse_date("4/99"), None);
        assert_eq!(
            parse_date("4/10/2024"),
            NaiveDate::from_ymd_opt(2024, 4, 10),
        );
        assert_eq!(parse_date("4/6/2024"), NaiveDate::from_ymd_opt(2024, 4, 6));

        assert_eq!(parse_date("6/10/12"), NaiveDate::from_ymd_opt(2012, 6, 10));

        assert_eq!(parse_date("4/2024"), NaiveDate::from_ymd_opt(2024, 4, 1));

        assert_eq!(
            parse_date("jan 3rd"),
            NaiveDate::from_ymd_opt(Utc::now().year(), 1, 3)
        );
        assert_eq!(
            parse_date("3 jan"),
            NaiveDate::from_ymd_opt(Utc::now().year(), 1, 3)
        );

        assert_eq!(
            parse_date("14-Mar-2021"),
            NaiveDate::from_ymd_opt(2021, 3, 14)
        );

        assert_eq!(parse_date("1893-01"), NaiveDate::from_ymd_opt(1893, 1, 1));
        assert_eq!(parse_date("1902-06"), NaiveDate::from_ymd_opt(1902, 6, 1));
        assert_eq!(parse_date("01-1893"), NaiveDate::from_ymd_opt(1893, 1, 1));
        assert_eq!(parse_date("06-1902"), NaiveDate::from_ymd_opt(1902, 6, 1));
    }

    #[test]
    fn test_parse_date_with_format() {
        // Test that format preserves separator (/ vs -)
        let (_, format) = parse_date_with_format("12/23/2024").unwrap();
        assert_eq!(format, "%-m/%-d/%Y");

        let (_, format) = parse_date_with_format("12-23-2024").unwrap();
        assert_eq!(format, "%-m-%-d-%Y");

        // Test that format preserves named months
        let (_, format) = parse_date_with_format("Dec 15").unwrap();
        assert_eq!(format, "%b %-d");

        let (_, format) = parse_date_with_format("15 Dec").unwrap();
        assert_eq!(format, "%-d %b");

        // Test 2-component dates without year
        let (_, format) = parse_date_with_format("5/15").unwrap();
        assert_eq!(format, "%-m/%-d");

        let (_, format) = parse_date_with_format("5-5").unwrap();
        assert_eq!(format, "%-m-%-d");

        // Test named month with 2-digit year (Jan 5 24)
        let (date, format) = parse_date_with_format("Jan 5 24").unwrap();
        assert_eq!(date, NaiveDate::from_ymd_opt(2024, 1, 5).unwrap());
        assert_eq!(format, "%b %-d %y");

        // Test leading zeros are preserved
        let (date, format) = parse_date_with_format("01/02/2020").unwrap();
        assert_eq!(date, NaiveDate::from_ymd_opt(2020, 1, 2).unwrap());
        assert_eq!(format, "%m/%d/%Y");
        // Verify rendering
        assert_eq!(date.format(&format).to_string(), "01/02/2020");

        // Single digit without leading zero
        let (date, format) = parse_date_with_format("1/2/2020").unwrap();
        assert_eq!(date, NaiveDate::from_ymd_opt(2020, 1, 2).unwrap());
        assert_eq!(format, "%-m/%-d/%Y");
        // Verify rendering
        assert_eq!(date.format(&format).to_string(), "1/2/2020");

        // Test 01/05/2024 specifically - with AMERICAN=true, this is January 5, 2024
        let (date, format) = parse_date_with_format("01/05/2024").unwrap();
        // Verify it's parsed as January 5, 2024 (month=1, day=5)
        assert_eq!(date.month(), 1);
        assert_eq!(date.day(), 5);
        assert_eq!(date.year(), 2024);
        assert_eq!(date, NaiveDate::from_ymd_opt(2024, 1, 5).unwrap());
        // Format should preserve leading zeros
        assert_eq!(format, "%m/%d/%Y");
        // Verify it renders as "01/05/2024", NOT "2024/01/05"
        assert_eq!(date.format(&format).to_string(), "01/05/2024");
    }

    #[test]
    fn test_parse_time_with_format() {
        // Test AM/PM format preservation
        let (_, format) = parse_time_with_format("4:45 PM").unwrap();
        assert_eq!(format, "%-I:%M:%S %p");

        let (_, format) = parse_time_with_format("4pm").unwrap();
        assert_eq!(format, "%-I:%M %p");

        // Test 24-hour format
        let (_, format) = parse_time_with_format("16:45").unwrap();
        assert_eq!(format, "%-H:%M");

        let (_, format) = parse_time_with_format("16:45:30").unwrap();
        assert_eq!(format, "%-H:%M:%S");
    }

    #[test]
    fn test_parse_time() {
        let time = "4:45 PM".to_string();
        let parsed_time = parse_time(&time).unwrap();
        assert_eq!(parsed_time, NaiveTime::from_hms_opt(16, 45, 0).unwrap());

        // more test functions are in validation_date_time.rs
    }

    #[test]
    fn parse_simple_times() {
        let time = "4pm".to_string();
        let parsed_time = parse_time(&time).unwrap();
        assert_eq!(parsed_time, NaiveTime::from_hms_opt(16, 0, 0).unwrap());

        let time = "4 pm".to_string();
        let parsed_time = parse_time(&time).unwrap();
        assert_eq!(parsed_time, NaiveTime::from_hms_opt(16, 0, 0).unwrap());
    }

    #[test]
    fn format_date_with_bad_ordering() {
        let date = NaiveDate::from_ymd_opt(2024, 12, 23);
        let format = "%d/%m/%Y %S %m %Y".to_string();
        let formatted_date = date_to_date_string(date.unwrap(), Some(format));
        assert_eq!(formatted_date, "23/12/2024".to_string());
    }

    #[test]
    fn format_time_wrong_order() {
        let time = NaiveTime::from_hms_opt(12, 34, 56).unwrap();
        let format = "%H:%M:%S %A";
        let formatted_time = time_to_time_string(time, Some(format.to_string()));
        assert_eq!(formatted_time, "12:34:56".to_string());
    }

    #[test]
    fn format_time() {
        let time = NaiveTime::from_hms_opt(12, 34, 56).unwrap();
        let format = "%A %H:%M:%S";
        let formatted_time = time_to_time_string(time, Some(format.to_string()));
        assert_eq!(formatted_time, "12:34:56".to_string());
    }

    #[test]
    fn format_date() {
        let date = NaiveDate::from_ymd_opt(2024, 12, 23);
        let format = "%A %d %B %Y %H:%M:%S";
        let formatted_date = date_to_date_string(date.unwrap(), Some(format.to_string()));
        assert_eq!(formatted_date, "Monday 23 December 2024".to_string());
    }

    #[test]
    fn format_date_opposite_order() {
        let date = NaiveDate::from_ymd_opt(2024, 12, 23);
        let format = "%H:%M:%S %Y %B %d %A";
        let formatted_date = date_to_date_string(date.unwrap(), Some(format.to_string()));
        assert_eq!(formatted_date, "2024 December 23 Monday".to_string());
    }

    #[test]
    fn test_parse_date_time() {
        assert_eq!(parse_date("101-250"), None);
        assert_eq!(parse_date("1 3"), None);
        assert_eq!(parse_date("10 12"), None);
        assert_eq!(parse_date("10 12 2025"), None);
        assert_eq!(parse_date("14.03.21"), None);
    }
}
