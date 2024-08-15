//! Handles converting Date, Time, and DateTime values to strings using strftime
//! format strings. This is a bit complicated because we have to handle the case
//! where the format string contains both date and time elements, but the value
//! is only a Date or Time. In this case, we need to truncate the format string
//! to only include the relevant elements. (Otherwise it throws an error.)

use chrono::format::{Fixed, Item, Numeric, StrftimeItems};

use crate::CellValue;

use super::Sheet;

impl Sheet {
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
        items.iter().position(|i| Self::is_time_item(i))
    }

    fn find_items_date_start(items: &[Item<'_>]) -> Option<usize> {
        items.iter().position(|i| Self::is_date_item(i))
    }

    /// Format a Date, Time, or DateTime using a strftime-style format string.
    ///
    /// Note: we cannot include any time elements within a Date, or date elements
    /// within a Time. To remove this formatting, we parse the format string and
    /// truncate (we assume date is first and time is second; although this can
    /// be changed to be arbitrary if necessary down the road).
    pub fn value_date_time(date_time: &Option<String>, value: &CellValue) -> String {
        match date_time {
            Some(date_time) => {
                let strftime_items = StrftimeItems::new(date_time);
                let Ok(mut items) = strftime_items.parse() else {
                    return value.to_display();
                };
                match value {
                    CellValue::DateTime(dt) => dt.format_with_items(items.iter()).to_string(),
                    CellValue::Date(d) => {
                        if let Some(mut time_start) = Self::find_items_time_start(&items) {
                            // remove any space items before the time items
                            while time_start > 0 && Self::is_space_item(&items[time_start - 1]) {
                                time_start -= 1;
                            }
                            items.truncate(time_start);
                        }
                        d.format_with_items(items.iter()).to_string()
                    }
                    CellValue::Time(t) => {
                        let time_start = Self::find_items_time_start(&items);
                        let date_start = Self::find_items_date_start(&items);
                        if let (Some(mut time_start), Some(date_start)) = (time_start, date_start) {
                            // remove any space items before the time items
                            if time_start > date_start {
                                while time_start > 0 && Self::is_space_item(&items[time_start]) {
                                    time_start -= 1;
                                }
                                items.drain(date_start..time_start);
                            }
                        } else if date_start.is_some() {
                            // handle case where there are no time items, only date items
                            return value.to_display();
                        }

                        // todo: this can throw an uncaught error if the format
                        // string is invalid. This should be handled better and
                        // fallback to to_display on error.

                        // remove any date items before the time items
                        t.format_with_items(items.iter()).to_string()
                    }
                    _ => value.to_display(),
                }
            }
            None => value.to_display(),
        }
    }
}

#[cfg(test)]
mod tests {
    use std::str::FromStr;

    use chrono::{NaiveDateTime, NaiveTime};
    use serial_test::parallel;

    use crate::{
        controller::GridController,
        grid::{
            formats::{format::Format, Formats},
            js_types::JsRenderCell,
            CellAlign,
        },
        Rect,
    };

    use super::*;

    #[test]
    #[parallel]
    fn value_date_time() {
        let date_time = "%Y-%m-%d %H:%M:%S".to_string();
        let value = CellValue::DateTime(
            NaiveDateTime::parse_from_str("2014-5-17T12:34:56+09:30", "%Y-%m-%dT%H:%M:%S%z")
                .unwrap(),
        );
        assert_eq!(
            Sheet::value_date_time(&Some(date_time.clone()), &value),
            "2014-05-17 12:34:56"
        );

        let value = CellValue::Date(
            NaiveDateTime::parse_from_str("2014-5-17T12:34:56+09:30", "%Y-%m-%dT%H:%M:%S%z")
                .unwrap()
                .date(),
        );
        assert_eq!(
            Sheet::value_date_time(&Some(date_time.clone()), &value),
            "2014-05-17"
        );

        let value = CellValue::Time(
            NaiveDateTime::parse_from_str("2014-5-17T12:34:56+09:30", "%Y-%m-%dT%H:%M:%S%z")
                .unwrap()
                .time(),
        );
        assert_eq!(
            Sheet::value_date_time(&Some(date_time.clone()), &value),
            "12:34:56"
        );
    }

    #[test]
    #[parallel]
    fn render_cell_date_time() {
        let mut gc = GridController::test();
        let sheet_id = gc.sheet_ids()[0];
        let sheet = gc.sheet_mut(sheet_id);
        let pos = (0, 0).into();
        let date_time = "%Y-%m-%d %H:%M:%S".to_string();
        let value = CellValue::DateTime(
            NaiveDateTime::parse_from_str("2014-5-17T12:34:56+09:30", "%Y-%m-%dT%H:%M:%S%z")
                .unwrap(),
        );
        sheet.set_cell_value(pos, value);
        let rendering = sheet.get_render_cells(Rect::from_numbers(0, 0, 1, 1));
        assert_eq!(rendering.len(), 1);
        assert_eq!(
            rendering[0],
            JsRenderCell {
                align: Some(CellAlign::Right),
                value: "05/17/2014 12:34 PM".to_string(),
                ..Default::default()
            }
        );

        let format = Format {
            date_time: Some(date_time.clone()),
            ..Default::default()
        };
        sheet.set_formats_columns(&[0], &Formats::repeat(format.into(), 1));
        let rendering = sheet.get_render_cells(Rect::from_numbers(0, 0, 1, 1));
        assert_eq!(rendering.len(), 1);
        assert_eq!(
            rendering[0],
            JsRenderCell {
                align: Some(CellAlign::Right),
                value: "2014-05-17 12:34:56".to_string(),
                ..Default::default()
            }
        );

        let format = Format {
            date_time: Some("%Y-%m-%d".to_string()),
            ..Default::default()
        };
        sheet.set_formats_columns(&[0], &Formats::repeat(format.into(), 1));
        let rendering = sheet.get_render_cells(Rect::from_numbers(0, 0, 1, 1));
        assert_eq!(rendering.len(), 1);
        assert_eq!(
            rendering[0],
            JsRenderCell {
                align: Some(CellAlign::Right),
                value: "2014-05-17".to_string(),
                ..Default::default()
            }
        );
    }

    #[test]
    #[parallel]
    fn cell_date_time_error() {
        let format = "%Y-%m-%d %I:%M:%S %p".to_string();
        let value = CellValue::Time(NaiveTime::from_str("17:12:00").unwrap());
        assert_eq!(Sheet::value_date_time(&Some(format), &value), "05:12:00 PM");
    }
}
