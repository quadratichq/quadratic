use chrono::{Duration, NaiveDateTime};

use crate::CellValue;

use super::{
    SeriesOptions,
    date_series::{date_delta, date_diff},
    time_series::{time_delta, time_diff},
};

pub(crate) fn find_date_time_series(options: &SeriesOptions) -> Option<Vec<CellValue>> {
    let (diff_in_date, diff_in_time) = if options.series.len() == 1 {
        ((0, 0, 1), Duration::zero())
    } else {
        let (CellValue::DateTime(first), CellValue::DateTime(second)) =
            (&options.series[0], &options.series[1])
        else {
            return None;
        };

        let diff_in_date = date_diff(&first.date(), &second.date());
        let diff_in_time = time_diff(first.time(), second.time());

        for i in 2..options.series.len() {
            let (CellValue::DateTime(first), CellValue::DateTime(second)) =
                (&options.series[i - 1], &options.series[i])
            else {
                return None;
            };

            if date_diff(&first.date(), &second.date()) != diff_in_date
                || time_diff(first.time(), second.time()) != diff_in_time
            {
                return None;
            }
        }

        (diff_in_date, diff_in_time)
    };
    let last = if options.negative {
        options.series[0].to_owned()
    } else {
        options.series[options.series.len() - 1].to_owned()
    };

    let CellValue::DateTime(mut last) = last else {
        return None;
    };

    let mut results = vec![];
    for _ in 0..options.spaces {
        let mut date = last.date();
        let mut time = last.time();
        let days = time_delta(&mut time, diff_in_time, options.negative);

        // This is way better looking than the days.cmp match statement
        #[allow(clippy::comparison_chain)]
        if days < 0 {
            date -= Duration::days(days.abs() as i64);
        } else if days > 0 {
            date += Duration::days(days as i64);
        }
        date_delta(&mut date, diff_in_date, options.negative);

        last = NaiveDateTime::new(date, time);
        results.push(CellValue::DateTime(last));
    }

    if options.negative {
        results.reverse();
    }
    Some(results)
}

#[cfg(test)]
mod tests {
    use chrono::{NaiveDate, NaiveTime};

    use crate::grid::series::find_auto_complete;

    use super::*;

    fn date_time(
        year: i32,
        month: u32,
        day: u32,
        hour: u32,
        minute: u32,
        second: u32,
    ) -> CellValue {
        CellValue::DateTime(NaiveDateTime::new(
            NaiveDate::from_ymd_opt(year, month, day).unwrap(),
            NaiveTime::from_hms_opt(hour, minute, second).unwrap(),
        ))
    }

    #[test]
    fn date_time_series_days() {
        let options = SeriesOptions {
            series: vec![
                date_time(2021, 1, 1, 0, 0, 0),
                date_time(2021, 1, 2, 0, 0, 0),
                date_time(2021, 1, 3, 0, 0, 0),
            ],
            spaces: 4,
            negative: false,
        };

        let results = find_auto_complete(options.clone());
        assert_eq!(
            results,
            vec![
                date_time(2021, 1, 4, 0, 0, 0),
                date_time(2021, 1, 5, 0, 0, 0),
                date_time(2021, 1, 6, 0, 0, 0),
                date_time(2021, 1, 7, 0, 0, 0),
            ]
        );

        let results = find_auto_complete(SeriesOptions {
            negative: true,
            ..options
        });
        assert_eq!(
            results,
            vec![
                date_time(2020, 12, 28, 0, 0, 0),
                date_time(2020, 12, 29, 0, 0, 0),
                date_time(2020, 12, 30, 0, 0, 0),
                date_time(2020, 12, 31, 0, 0, 0),
            ]
        );
    }

    #[test]
    fn date_time_series_months() {
        let options = SeriesOptions {
            series: vec![
                date_time(2021, 1, 1, 0, 0, 0),
                date_time(2021, 2, 1, 0, 0, 0),
                date_time(2021, 3, 1, 0, 0, 0),
            ],
            spaces: 4,
            negative: false,
        };

        let results = find_auto_complete(options.clone());
        assert_eq!(
            results,
            vec![
                date_time(2021, 4, 1, 0, 0, 0),
                date_time(2021, 5, 1, 0, 0, 0),
                date_time(2021, 6, 1, 0, 0, 0),
                date_time(2021, 7, 1, 0, 0, 0),
            ]
        );

        let results = find_auto_complete(SeriesOptions {
            negative: true,
            ..options
        });
        assert_eq!(
            results,
            vec![
                date_time(2020, 9, 1, 0, 0, 0),
                date_time(2020, 10, 1, 0, 0, 0),
                date_time(2020, 11, 1, 0, 0, 0),
                date_time(2020, 12, 1, 0, 0, 0),
            ]
        );
    }

    #[test]
    fn date_time_series_years() {
        let options = SeriesOptions {
            series: vec![
                date_time(2021, 1, 1, 0, 0, 0),
                date_time(2022, 1, 1, 0, 0, 0),
                date_time(2023, 1, 1, 0, 0, 0),
            ],
            spaces: 4,
            negative: false,
        };

        let results = find_auto_complete(options.clone());
        assert_eq!(
            results,
            vec![
                date_time(2024, 1, 1, 0, 0, 0),
                date_time(2025, 1, 1, 0, 0, 0),
                date_time(2026, 1, 1, 0, 0, 0),
                date_time(2027, 1, 1, 0, 0, 0),
            ]
        );

        let results = find_auto_complete(SeriesOptions {
            negative: true,
            ..options
        });
        assert_eq!(
            results,
            vec![
                date_time(2017, 1, 1, 0, 0, 0),
                date_time(2018, 1, 1, 0, 0, 0),
                date_time(2019, 1, 1, 0, 0, 0),
                date_time(2020, 1, 1, 0, 0, 0),
            ]
        );
    }

    #[test]
    fn date_time_series_hours() {
        let options = SeriesOptions {
            series: vec![
                date_time(2021, 1, 1, 1, 0, 0),
                date_time(2021, 1, 1, 2, 0, 0),
                date_time(2021, 1, 1, 3, 0, 0),
            ],
            spaces: 4,
            negative: false,
        };

        let results = find_auto_complete(options.clone());
        assert_eq!(
            results,
            vec![
                date_time(2021, 1, 1, 4, 0, 0),
                date_time(2021, 1, 1, 5, 0, 0),
                date_time(2021, 1, 1, 6, 0, 0),
                date_time(2021, 1, 1, 7, 0, 0),
            ]
        );

        let results = find_auto_complete(SeriesOptions {
            negative: true,
            ..options
        });
        assert_eq!(
            results,
            vec![
                date_time(2020, 12, 31, 21, 0, 0),
                date_time(2020, 12, 31, 22, 0, 0),
                date_time(2020, 12, 31, 23, 0, 0),
                date_time(2021, 1, 1, 0, 0, 0),
            ]
        );
    }

    #[test]
    fn date_time_series_minutes() {
        let options = SeriesOptions {
            series: vec![
                date_time(2021, 1, 1, 0, 1, 0),
                date_time(2021, 1, 1, 0, 2, 0),
                date_time(2021, 1, 1, 0, 3, 0),
            ],
            spaces: 4,
            negative: false,
        };

        let results = find_auto_complete(options.clone());
        assert_eq!(
            results,
            vec![
                date_time(2021, 1, 1, 0, 4, 0),
                date_time(2021, 1, 1, 0, 5, 0),
                date_time(2021, 1, 1, 0, 6, 0),
                date_time(2021, 1, 1, 0, 7, 0),
            ]
        );

        let results = find_auto_complete(SeriesOptions {
            negative: true,
            ..options
        });
        assert_eq!(
            results,
            vec![
                date_time(2020, 12, 31, 23, 57, 0),
                date_time(2020, 12, 31, 23, 58, 0),
                date_time(2020, 12, 31, 23, 59, 0),
                date_time(2021, 1, 1, 0, 0, 0),
            ]
        );
    }

    #[test]
    fn date_time_series_seconds() {
        let options = SeriesOptions {
            series: vec![
                date_time(2021, 1, 1, 0, 0, 1),
                date_time(2021, 1, 1, 0, 0, 2),
                date_time(2021, 1, 1, 0, 0, 3),
            ],
            spaces: 4,
            negative: false,
        };

        let results = find_auto_complete(options.clone());
        assert_eq!(
            results,
            vec![
                date_time(2021, 1, 1, 0, 0, 4),
                date_time(2021, 1, 1, 0, 0, 5),
                date_time(2021, 1, 1, 0, 0, 6),
                date_time(2021, 1, 1, 0, 0, 7),
            ]
        );

        let results = find_auto_complete(SeriesOptions {
            negative: true,
            ..options
        });
        assert_eq!(
            results,
            vec![
                date_time(2020, 12, 31, 23, 59, 57),
                date_time(2020, 12, 31, 23, 59, 58),
                date_time(2020, 12, 31, 23, 59, 59),
                date_time(2021, 1, 1, 0, 0, 0),
            ]
        );
    }

    #[test]
    fn date_time_series_of_one() {
        let options = SeriesOptions {
            series: vec![date_time(2021, 1, 1, 0, 1, 0)],
            spaces: 4,
            negative: false,
        };

        let results = find_auto_complete(options.clone());
        assert_eq!(
            results,
            vec![
                date_time(2021, 1, 2, 0, 1, 0),
                date_time(2021, 1, 3, 0, 1, 0),
                date_time(2021, 1, 4, 0, 1, 0),
                date_time(2021, 1, 5, 0, 1, 0),
            ]
        );

        let results = find_auto_complete(SeriesOptions {
            negative: true,
            ..options
        });
        assert_eq!(
            results,
            vec![
                date_time(2020, 12, 28, 0, 1, 0),
                date_time(2020, 12, 29, 0, 1, 0),
                date_time(2020, 12, 30, 0, 1, 0),
                date_time(2020, 12, 31, 0, 1, 0),
            ]
        );
    }
}
