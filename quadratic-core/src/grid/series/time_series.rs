use chrono::{Duration, NaiveTime, Timelike};

use crate::CellValue;

use super::SeriesOptions;

fn unwrap_times(first: &CellValue, second: &CellValue) -> Option<(NaiveTime, NaiveTime)> {
    match (first, second) {
        (CellValue::Time(first), CellValue::Time(second)) => Some((*first, *second)),
        _ => None,
    }
}

pub(crate) fn time_diff(first: NaiveTime, second: NaiveTime) -> Duration {
    second - first
}

/// Adjust a time by a duration, accounting for overflow/underflow across midnight.
/// returns the number of days for overflow/underflow
pub(crate) fn time_delta(last: &mut NaiveTime, diff: Duration, reverse: bool) -> i32 {
    // Handle overflow/underflow across midnight
    let seconds_in_day = 24 * 60 * 60;
    let current_seconds = last.num_seconds_from_midnight() as i64;
    let delta_seconds = diff.num_seconds();
    let new_seconds = if reverse {
        current_seconds - delta_seconds
    } else {
        current_seconds + delta_seconds
    };

    let final_seconds = if new_seconds < 0 {
        // Handle underflow: wrap around to the previous day
        (new_seconds % seconds_in_day + seconds_in_day) % seconds_in_day
    } else {
        // Handle overflow: wrap around to the next day
        new_seconds % seconds_in_day
    };

    let Some(opt) = NaiveTime::from_num_seconds_from_midnight_opt(final_seconds as u32, 0) else {
        return 0;
    };
    *last = opt;

    // Return any overflow/underflow as a new duration
    Duration::seconds(new_seconds - final_seconds).num_days() as i32
}

pub(crate) fn find_time_series(options: &SeriesOptions) -> Option<Vec<CellValue>> {
    // if only one time, copy it
    let diff = if options.series.len() == 1 {
        Duration::hours(1)
    } else {
        let (first, second) = unwrap_times(&options.series[0], &options.series[1])?;

        let diff = time_diff(first, second);

        for i in 2..options.series.len() {
            let (first, second) = unwrap_times(&options.series[i - 1], &options.series[i])?;

            if time_diff(first, second) != diff {
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

    let CellValue::Time(mut last) = last else {
        return None;
    };

    let mut results = vec![];
    for _ in 0..options.spaces {
        time_delta(&mut last, diff, options.negative);
        results.push(CellValue::Time(last));
    }

    if options.negative {
        results.reverse();
    }
    Some(results)
}

#[cfg(test)]
mod test {
    use crate::grid::series::find_auto_complete;

    use super::*;

    fn naked_time(hour: u32, minute: u32, second: u32) -> NaiveTime {
        NaiveTime::from_hms_opt(hour, minute, second).unwrap()
    }

    fn cell_value_time(hour: u32, minute: u32, second: u32) -> CellValue {
        CellValue::Time(naked_time(hour, minute, second))
    }

    #[test]
    fn time_series_hours() {
        let options = SeriesOptions {
            series: vec![
                cell_value_time(1, 0, 0),
                cell_value_time(2, 0, 0),
                cell_value_time(3, 0, 0),
            ],
            spaces: 4,
            negative: false,
        };

        let results = find_auto_complete(options.clone());
        assert_eq!(
            results,
            vec![
                cell_value_time(4, 0, 0),
                cell_value_time(5, 0, 0),
                cell_value_time(6, 0, 0),
                cell_value_time(7, 0, 0),
            ]
        );

        let results = find_auto_complete(SeriesOptions {
            negative: true,
            ..options
        });
        assert_eq!(
            results,
            vec![
                cell_value_time(21, 0, 0),
                cell_value_time(22, 0, 0),
                cell_value_time(23, 0, 0),
                cell_value_time(0, 0, 0),
            ]
        );
    }

    #[test]
    fn time_series_minutes() {
        let options = SeriesOptions {
            series: vec![
                cell_value_time(0, 1, 0),
                cell_value_time(0, 2, 0),
                cell_value_time(0, 3, 0),
            ],
            spaces: 4,
            negative: false,
        };

        let results = find_auto_complete(options.clone());
        assert_eq!(
            results,
            vec![
                cell_value_time(0, 4, 0),
                cell_value_time(0, 5, 0),
                cell_value_time(0, 6, 0),
                cell_value_time(0, 7, 0),
            ]
        );

        let results = find_auto_complete(SeriesOptions {
            negative: true,
            ..options
        });
        assert_eq!(
            results,
            vec![
                cell_value_time(23, 57, 0),
                cell_value_time(23, 58, 0),
                cell_value_time(23, 59, 0),
                cell_value_time(0, 0, 0),
            ]
        );
    }

    #[test]
    fn time_series_seconds() {
        let options = SeriesOptions {
            series: vec![
                cell_value_time(0, 0, 1),
                cell_value_time(0, 0, 2),
                cell_value_time(0, 0, 3),
            ],
            spaces: 4,
            negative: false,
        };

        let results = find_auto_complete(options.clone());
        assert_eq!(
            results,
            vec![
                cell_value_time(0, 0, 4),
                cell_value_time(0, 0, 5),
                cell_value_time(0, 0, 6),
                cell_value_time(0, 0, 7),
            ]
        );

        let results = find_auto_complete(SeriesOptions {
            negative: true,
            ..options
        });
        assert_eq!(
            results,
            vec![
                cell_value_time(23, 59, 57),
                cell_value_time(23, 59, 58),
                cell_value_time(23, 59, 59),
                cell_value_time(0, 0, 0),
            ]
        );
    }

    #[test]
    fn time_diff_overflow_underflow() {
        let diff = Duration::seconds(-1);
        let mut time = naked_time(0, 0, 0);
        let days = time_delta(&mut time, diff, false);
        assert_eq!(time, naked_time(23, 59, 59));
        assert_eq!(days, -1);

        let mut time = naked_time(0, 0, 0);
        let days = time_delta(&mut time, diff, true);
        assert_eq!(time, naked_time(0, 0, 1));
        assert_eq!(days, 0);

        let diff = Duration::seconds(1);
        let mut time = naked_time(23, 59, 59);
        let days = time_delta(&mut time, diff, false);
        assert_eq!(time, naked_time(0, 0, 0));
        assert_eq!(days, 1);

        let mut time = naked_time(23, 59, 59);
        let days = time_delta(&mut time, diff, true);
        assert_eq!(time, naked_time(23, 59, 58));
        assert_eq!(days, 0);
    }

    #[test]
    fn time_series_one() {
        let options = SeriesOptions {
            series: vec![cell_value_time(0, 0, 0)],
            spaces: 4,
            negative: false,
        };

        let results = find_auto_complete(options.clone());
        assert_eq!(
            results,
            vec![
                cell_value_time(1, 0, 0),
                cell_value_time(2, 0, 0),
                cell_value_time(3, 0, 0),
                cell_value_time(4, 0, 0),
            ]
        );

        let results = find_auto_complete(SeriesOptions {
            negative: true,
            ..options
        });
        assert_eq!(
            results,
            vec![
                cell_value_time(20, 0, 0),
                cell_value_time(21, 0, 0),
                cell_value_time(22, 0, 0),
                cell_value_time(23, 0, 0),
            ]
        );
    }
}
