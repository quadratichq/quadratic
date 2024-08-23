use chrono::{Duration, NaiveDateTime};

use crate::CellValue;

use super::{
    copy_series,
    date_series::{date_delta, date_diff},
    time_series::{time_delta, time_diff},
    SeriesOptions,
};

pub(crate) fn find_date_time_series(options: SeriesOptions) -> Vec<CellValue> {
    // if only one date, copy it
    if options.series.len() == 1 {
        return copy_series(options);
    }

    let (CellValue::DateTime(first), CellValue::DateTime(second)) =
        (&options.series[0], &options.series[1])
    else {
        return copy_series(options);
    };

    let diff_in_date = date_diff(&first.date(), &second.date());
    let diff_in_time = time_diff(first.time(), second.time());

    for i in 2..options.series.len() {
        let (CellValue::DateTime(first), CellValue::DateTime(second)) =
            (&options.series[i - 1], &options.series[i])
        else {
            return copy_series(options);
        };

        if date_diff(&first.date(), &second.date()) != diff_in_date
            || time_diff(first.time(), second.time()) != diff_in_time
        {
            return copy_series(options);
        }
    }

    let last = if options.negative {
        &options.series[0]
    } else {
        &options.series[options.series.len() - 1]
    };

    let CellValue::DateTime(mut last) = last else {
        return copy_series(options);
    };

    let mut results = vec![];
    for _ in 0..options.spaces {
        let mut date = last.date().clone();
        let mut time = last.time().clone();
        let days = time_delta(&mut time, diff_in_time, options.negative);
        if days < 0 {
            date = date - Duration::days(days.abs() as i64);
        } else if days > 0 {
            date = date + Duration::days(days as i64);
        }
        date_delta(&mut date, diff_in_date, options.negative);

        last = NaiveDateTime::new(date, time);
        results.push(CellValue::DateTime(last.clone()));
    }

    if options.negative {
        results.reverse();
    }
    results
}

#[cfg(test)]
mod tests {
    use chrono::{NaiveDate, NaiveTime};
    use serial_test::parallel;

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
    #[parallel]
    fn date_time_series_days() {
        let options = SeriesOptions {
            series: vec![
                date_time(2021, 1, 1, 0, 0, 0),
                date_time(2021, 1, 2, 0, 0, 0),
                date_time(2021, 1, 3, 0, 0, 0),
            ],
            spaces: 10,
            negative: false,
        };

        let results = find_date_time_series(options.clone());
        assert_eq!(
            results,
            vec![
                date_time(2021, 1, 4, 0, 0, 0),
                date_time(2021, 1, 5, 0, 0, 0),
                date_time(2021, 1, 6, 0, 0, 0),
                date_time(2021, 1, 7, 0, 0, 0),
                date_time(2021, 1, 8, 0, 0, 0),
                date_time(2021, 1, 9, 0, 0, 0),
                date_time(2021, 1, 10, 0, 0, 0),
                date_time(2021, 1, 11, 0, 0, 0),
                date_time(2021, 1, 12, 0, 0, 0),
                date_time(2021, 1, 13, 0, 0, 0),
            ]
        );

        let results = find_date_time_series(SeriesOptions {
            negative: true,
            ..options
        });
        assert_eq!(
            results,
            vec![
                date_time(2020, 12, 22, 0, 0, 0),
                date_time(2020, 12, 23, 0, 0, 0),
                date_time(2020, 12, 24, 0, 0, 0),
                date_time(2020, 12, 25, 0, 0, 0),
                date_time(2020, 12, 26, 0, 0, 0),
                date_time(2020, 12, 27, 0, 0, 0),
                date_time(2020, 12, 28, 0, 0, 0),
                date_time(2020, 12, 29, 0, 0, 0),
                date_time(2020, 12, 30, 0, 0, 0),
                date_time(2020, 12, 31, 0, 0, 0),
            ]
        );
    }

    #[test]
    #[parallel]
    fn date_time_series_months() {
        let options = SeriesOptions {
            series: vec![
                date_time(2021, 1, 1, 0, 0, 0),
                date_time(2021, 2, 1, 0, 0, 0),
                date_time(2021, 3, 1, 0, 0, 0),
            ],
            spaces: 10,
            negative: false,
        };

        let results = find_date_time_series(options.clone());
        assert_eq!(
            results,
            vec![
                date_time(2021, 4, 1, 0, 0, 0),
                date_time(2021, 5, 1, 0, 0, 0),
                date_time(2021, 6, 1, 0, 0, 0),
                date_time(2021, 7, 1, 0, 0, 0),
                date_time(2021, 8, 1, 0, 0, 0),
                date_time(2021, 9, 1, 0, 0, 0),
                date_time(2021, 10, 1, 0, 0, 0),
                date_time(2021, 11, 1, 0, 0, 0),
                date_time(2021, 12, 1, 0, 0, 0),
                date_time(2022, 1, 1, 0, 0, 0),
            ]
        );

        let results = find_date_time_series(SeriesOptions {
            negative: true,
            ..options
        });
        assert_eq!(
            results,
            vec![
                date_time(2020, 3, 1, 0, 0, 0),
                date_time(2020, 4, 1, 0, 0, 0),
                date_time(2020, 5, 1, 0, 0, 0),
                date_time(2020, 6, 1, 0, 0, 0),
                date_time(2020, 7, 1, 0, 0, 0),
                date_time(2020, 8, 1, 0, 0, 0),
                date_time(2020, 9, 1, 0, 0, 0),
                date_time(2020, 10, 1, 0, 0, 0),
                date_time(2020, 11, 1, 0, 0, 0),
                date_time(2020, 12, 1, 0, 0, 0),
            ]
        );
    }

    // #[test]
    // #[parallel]
}
