use chrono::{Datelike, Duration, NaiveDate};

use crate::CellValue;

use super::SeriesOptions;

pub(crate) type Diff = (i32, i32, i32);

/// Find the date difference between two dates.
pub(crate) fn date_diff(start: &NaiveDate, end: &NaiveDate) -> Diff {
    let mut years = end.year() - start.year();
    let mut months = end.month() as i32 - start.month() as i32;
    let mut days = end.day() as i32 - start.day() as i32;

    // Adjust for negative months
    if months < 0 {
        years -= 1;
        months += 12;
    }

    // Adjust for negative days
    if days < 0 {
        months -= 1;
        days += start
            .with_month((start.month() % 12) + 1)
            .unwrap_or((*start).with_month(1).unwrap())
            .signed_duration_since(*start)
            .num_days() as i32;
    }

    // Adjust if months became negative after day adjustment
    if months < 0 {
        years -= 1;
        months += 12;
    }

    (years, months, days)
}

/// Adjust a date by a difference.
pub(crate) fn date_delta(last: &mut NaiveDate, diff: (i32, i32, i32), negative: bool) {
    let (years, months, days) = diff;

    // Apply the sign based on the `negative` flag
    let years = if negative { -years } else { years };
    let months = if negative { -months } else { months };
    let days = if negative { -days } else { days };

    // Adjust the year and month first
    let mut new_year = last.year() + years;
    let mut new_month = last.month() as i32 + months;

    // Handle month overflow/underflow
    if new_month > 12 {
        new_year += (new_month - 1) / 12;
        new_month = (new_month - 1) % 12 + 1;
    } else if new_month < 1 {
        new_year += (new_month - 12) / 12;
        new_month = (new_month + 12 - 1) % 12 + 1;
    }

    // Set the day to the last valid day if it overflows
    let new_day = last.day().min(days_in_month(new_year, new_month as u32));

    let Some(new_last) = NaiveDate::from_ymd_opt(new_year, new_month as u32, new_day) else {
        return;
    };
    *last = new_last;

    // Adjust the day after setting year and month
    *last += Duration::days(days as i64);
}

// Helper function to get the number of days in a given month
fn days_in_month(year: i32, month: u32) -> u32 {
    match month {
        1 | 3 | 5 | 7 | 8 | 10 | 12 => 31,
        4 | 6 | 9 | 11 => 30,
        2 => {
            if NaiveDate::from_ymd_opt(year, 2, 29).is_some() {
                29
            } else {
                28
            }
        }
        _ => 30,
    }
}

pub(crate) fn find_date_series(options: &SeriesOptions) -> Option<Vec<CellValue>> {
    let diff = if options.series.len() == 1 {
        // if only one date, then apply a one-day delta
        (0, 0, 1)
    } else {
        let (CellValue::Date(first), CellValue::Date(second)) =
            (&options.series[0], &options.series[1])
        else {
            return None;
        };

        let diff = date_diff(first, second);

        for i in 2..options.series.len() {
            let (CellValue::Date(first), CellValue::Date(second)) =
                (&options.series[i - 1], &options.series[i])
            else {
                return None;
            };

            let new_diff = date_diff(first, second);

            if new_diff != diff {
                return None;
            }
        }
        diff
    };
    let last = if options.negative {
        options.series[0].to_owned()
    } else {
        options.series[options.series.len() - 1].to_owned()
    };

    let CellValue::Date(mut last) = last else {
        return None;
    };

    let mut results = vec![];
    for _ in 0..options.spaces {
        date_delta(&mut last, diff, options.negative);
        results.push(CellValue::Date(last));
    }

    if options.negative {
        results.reverse();
    }
    Some(results)
}

#[cfg(test)]
mod tests {
    use crate::grid::series::find_auto_complete;

    use super::*;
    use chrono::NaiveDate;

    fn naked_date(year: i32, month: u32, day: u32) -> NaiveDate {
        NaiveDate::from_ymd_opt(year, month, day).unwrap()
    }

    fn date(year: i32, month: u32, day: u32) -> CellValue {
        CellValue::Date(naked_date(year, month, day))
    }

    #[test]
    fn find_date_series_months() {
        let options = SeriesOptions {
            series: vec![date(2021, 1, 1), date(2021, 2, 1), date(2021, 3, 1)],
            spaces: 4,
            negative: false,
        };
        let results = find_auto_complete(options.clone());
        assert_eq!(
            results,
            vec![
                date(2021, 4, 1),
                date(2021, 5, 1),
                date(2021, 6, 1),
                date(2021, 7, 1),
            ]
        );

        let results = find_auto_complete(SeriesOptions {
            negative: true,
            ..options
        });
        assert_eq!(
            results,
            vec![
                date(2020, 9, 1),
                date(2020, 10, 1),
                date(2020, 11, 1),
                date(2020, 12, 1),
            ]
        );
    }

    #[test]
    fn find_date_series_months_by_2() {
        let options = SeriesOptions {
            series: vec![date(2021, 1, 1), date(2021, 3, 1), date(2021, 5, 1)],
            spaces: 4,
            negative: false,
        };
        let results = find_auto_complete(options.clone());
        assert_eq!(
            results,
            vec![
                date(2021, 7, 1),
                date(2021, 9, 1),
                date(2021, 11, 1),
                date(2022, 1, 1),
            ]
        );

        let results = find_auto_complete(SeriesOptions {
            negative: true,
            ..options
        });
        assert_eq!(
            results,
            vec![
                date(2020, 5, 1),
                date(2020, 7, 1),
                date(2020, 9, 1),
                date(2020, 11, 1),
            ]
        );
    }

    #[test]
    fn find_date_series_years() {
        let options = SeriesOptions {
            series: vec![date(2021, 1, 1), date(2022, 1, 1), date(2023, 1, 1)],
            spaces: 4,
            negative: false,
        };
        let results = find_auto_complete(options.clone());
        assert_eq!(
            results,
            vec![
                date(2024, 1, 1),
                date(2025, 1, 1),
                date(2026, 1, 1),
                date(2027, 1, 1),
            ]
        );

        let results = find_auto_complete(SeriesOptions {
            negative: true,
            ..options
        });
        assert_eq!(
            results,
            vec![
                date(2017, 1, 1),
                date(2018, 1, 1),
                date(2019, 1, 1),
                date(2020, 1, 1),
            ]
        );
    }

    #[test]
    fn find_date_series_years_by_2() {
        let options = SeriesOptions {
            series: vec![date(2021, 1, 1), date(2023, 1, 1), date(2025, 1, 1)],
            spaces: 4,
            negative: false,
        };
        let results = find_auto_complete(options.clone());
        assert_eq!(
            results,
            vec![
                date(2027, 1, 1),
                date(2029, 1, 1),
                date(2031, 1, 1),
                date(2033, 1, 1),
            ]
        );

        let results = find_auto_complete(SeriesOptions {
            negative: true,
            ..options
        });
        assert_eq!(
            results,
            vec![
                date(2013, 1, 1),
                date(2015, 1, 1),
                date(2017, 1, 1),
                date(2019, 1, 1),
            ]
        );
    }

    #[test]
    fn find_date_series_day() {
        let options = SeriesOptions {
            series: vec![date(2021, 1, 1), date(2021, 1, 2), date(2021, 1, 3)],
            spaces: 4,
            negative: false,
        };
        let results = find_auto_complete(options.clone());
        assert_eq!(
            results,
            vec![
                date(2021, 1, 4),
                date(2021, 1, 5),
                date(2021, 1, 6),
                date(2021, 1, 7),
            ]
        );

        let results = find_auto_complete(SeriesOptions {
            negative: true,
            ..options
        });
        assert_eq!(
            results,
            vec![
                date(2020, 12, 28),
                date(2020, 12, 29),
                date(2020, 12, 30),
                date(2020, 12, 31),
            ]
        );
    }

    #[test]
    fn find_date_series_day_by_2() {
        let options = SeriesOptions {
            series: vec![date(2021, 1, 1), date(2021, 1, 3), date(2021, 1, 5)],
            spaces: 4,
            negative: false,
        };
        let results = find_auto_complete(options.clone());
        assert_eq!(
            results,
            vec![
                date(2021, 1, 7),
                date(2021, 1, 9),
                date(2021, 1, 11),
                date(2021, 1, 13),
            ]
        );

        let results = find_auto_complete(SeriesOptions {
            negative: true,
            ..options
        });
        assert_eq!(
            results,
            vec![
                date(2020, 12, 24),
                date(2020, 12, 26),
                date(2020, 12, 28),
                date(2020, 12, 30),
            ]
        );
    }

    #[test]
    fn find_date_series_one() {
        let options = SeriesOptions {
            series: vec![date(2021, 1, 1)],
            spaces: 4,
            negative: false,
        };
        let results = find_auto_complete(options.clone());
        assert_eq!(
            results,
            vec![
                date(2021, 1, 2),
                date(2021, 1, 3),
                date(2021, 1, 4),
                date(2021, 1, 5),
            ]
        );

        let results = find_auto_complete(SeriesOptions {
            negative: true,
            ..options
        });
        assert_eq!(
            results,
            vec![
                date(2020, 12, 28),
                date(2020, 12, 29),
                date(2020, 12, 30),
                date(2020, 12, 31),
            ]
        );
    }
}
