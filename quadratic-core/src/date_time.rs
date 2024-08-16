//! Handles converting NaiveDate, NaiveTime, and NaiveDateTime to strings using
//! strftime format strings. This is a bit complicated because we have to handle
//! the case where the format string contains both date and time elements, but
//! the value is only a Date or Time. In this case, we need to truncate the
//! format string to only include the relevant elements. (Otherwise it throws an
//! error.)

use chrono::{
    format::{Fixed, Item, Numeric, StrftimeItems},
    NaiveDate, NaiveDateTime, NaiveTime,
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

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn time() {
        let date_time = "12/23/2024; 4:45 PM".to_string();
        let format = "%m/%d/%Y HH:mm:ss %p".to_string();

        let date_time = NaiveDateTime::parse_from_str(&date_time, &format).unwrap();
        assert_eq!(
            time_to_time_string(date_time.time(), Some(format)),
            "16:45:00".to_string()
        );
    }
}
