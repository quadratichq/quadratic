//! Handles converting NaiveDate, NaiveTime, and NaiveDateTime to strings using
//! strftime format strings. This is a bit complicated because we have to handle
//! the case where the format string contains both date and time elements, but
//! the value is only a Date or Time. In this case, we need to truncate the
//! format string to only include the relevant elements. (Otherwise it throws an
//! error.)

use chrono::{
    format::{Fixed, Item, Numeric, StrftimeItems},
    DateTime, NaiveDate, NaiveDateTime, NaiveTime, Timelike,
};

pub const DEFAULT_DATE_FORMAT: &str = "%m/%d/%Y";
pub const DEFAULT_TIME_FORMAT: &str = "%-I:%M %p";
pub const DEFAULT_DATE_TIME_FORMAT: &str = "%m/%d/%Y %-I:%M %p";

fn is_date_item(item: &Item<'_>) -> bool {
    match item {
        Item::Numeric(numeric, _) => match numeric {
            Numeric::Year => true,
            Numeric::YearDiv100 => true,
            Numeric::YearMod100 => true,
            Numeric::IsoYear => true,
            Numeric::IsoYearDiv100 => true,
            Numeric::IsoYearMod100 => true,
            Numeric::Month => true,
            Numeric::Day => true,
            Numeric::WeekFromSun => true,
            Numeric::WeekFromMon => true,
            Numeric::IsoWeek => true,
            Numeric::NumDaysFromSun => true,
            Numeric::WeekdayFromMon => true,
            Numeric::Ordinal => true,
            _ => false,
        },
        Item::Fixed(
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
            | Fixed::TimezoneOffsetZ,
        ) => true,
        _ => false,
    }
}

fn is_time_item(item: &Item<'_>) -> bool {
    match item {
        Item::Numeric(numeric, _) => match numeric {
            Numeric::Hour => true,
            Numeric::Hour12 => true,
            Numeric::Minute => true,
            Numeric::Second => true,
            Numeric::Nanosecond => true,
            Numeric::Timestamp => true,
            _ => false,
        },
        Item::Fixed(
            Fixed::LowerAmPm
            | Fixed::Nanosecond
            | Fixed::Nanosecond3
            | Fixed::Nanosecond6
            | Fixed::Nanosecond9
            | Fixed::UpperAmPm,
        ) => true,
        _ => false,
    }
}

fn is_space_item(item: &Item<'_>) -> bool {
    match item {
        Item::Space(_) => true,
        _ => false,
    }
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
    date_time.format(&format).to_string()
}

/// Converts a NaiveDateTime to a date-only string using a strftime format string.
pub fn date_to_date_string(date: NaiveDate, format: Option<String>) -> String {
    let format = format.map_or(DEFAULT_DATE_TIME_FORMAT.to_string(), |f| f);
    let strftime_items = StrftimeItems::new(&format);
    let Ok(mut items) = strftime_items.parse() else {
        return date.format(DEFAULT_DATE_FORMAT).to_string();
    };

    if let Some(mut time_start) = find_items_time_start(&items) {
        // remove any space items before the time items
        while time_start > 0 && is_space_item(&items[time_start - 1]) {
            time_start -= 1;
        }
        items.truncate(time_start);
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
    if let (Some(mut time_start), Some(date_start)) = (time_start, date_start) {
        // remove any space items before the time items
        if time_start > date_start {
            while time_start > 0 && is_space_item(&items[time_start]) {
                time_start -= 1;
            }
            items.drain(date_start..time_start);
        }
    } else if date_start.is_some() {
        // handle case where there are no time items, only date items
        return time.to_string();
    }

    // todo: this can throw an uncaught error if the format
    // string is invalid. This should be handled better and
    // fallback to to_display on error.

    // remove any date items before the time items
    time.format_with_items(items.iter()).to_string()
}

/// Parses a time string using a list of possible formats.
pub fn parse_time(value: &str) -> Option<NaiveTime> {
    let formats = [
        "%H:%M:%S",
        "%I:%M:%S %p",
        "%I:%M:%S%p",
        "%I:%M %p",
        "%I:%M%p",
        "%H:%M",
        "%I:%M:%S",
        "%I:%M",
        "%H:%M:%S%.3f",
    ];

    for &format in formats.iter() {
        if let Ok(parsed_time) = NaiveTime::parse_from_str(value, format) {
            return Some(parsed_time);
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
            NaiveTime::parse_from_str(&format!("{}:00 {}", time_number, am_pm), format)
        {
            return Some(parsed_time);
        }
    }
    None
}

/// Parses a date string using a list of possible formats.
pub fn parse_date(value: &str) -> Option<NaiveDate> {
    let formats = vec![
        "%Y-%m-%d", "%m-%d-%Y", "%d-%m-%Y", "%Y/%m/%d", "%m/%d/%Y", "%d/%m/%Y", "%Y.%m.%d",
        "%m.%d.%Y", "%d.%m.%Y", "%Y %m %d", "%m %d %Y", "%d %m %Y", "%Y %b %d", "%b %d %Y",
        "%d %b %Y", "%Y %B %d", "%B %d %Y", "%d %B %Y",
    ];

    for &format in formats.iter() {
        if let Ok(parsed_date) = NaiveDate::parse_from_str(value, format) {
            return Some(parsed_date);
        }
    }
    None
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
        let date = "12/23/2024".to_string();
        let parsed_date = parse_date(&date).unwrap();
        assert_eq!(parsed_date, NaiveDate::from_ymd_opt(2024, 12, 23).unwrap());

        // more test functions are in validation_date_time.rs
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
}
