use date_series::find_date_series;
use date_time_series::find_date_time_series;
use itertools::Itertools;
use number_series::find_number_series;
use string_series::find_string_series;
use time_series::find_time_series;

use crate::CellValue;

pub mod date_series;
pub mod date_time_series;
pub mod number_series;
pub mod string_series;
pub mod time_series;

#[derive(Debug, Clone)]
pub struct SeriesOptions {
    pub series: Vec<CellValue>,
    pub spaces: i32,
    pub negative: bool,
}

fn copy_series(options: SeriesOptions) -> Vec<CellValue> {
    let SeriesOptions {
        series,
        spaces,
        negative,
    } = options;

    if negative {
        let chunk_size = series.len();

        let mut output = series
            .into_iter()
            .rev()
            .cycle()
            .take(spaces as usize)
            .chunks(chunk_size)
            .into_iter()
            .flat_map(|chunks| chunks.collect_vec())
            .collect::<Vec<_>>();
        output.reverse();
        output
    } else {
        series
            .into_iter()
            .cycle()
            .take(spaces as usize)
            .collect::<Vec<CellValue>>()
    }
}

/// Finds auto complete series.
pub fn find_auto_complete(options: SeriesOptions) -> Vec<CellValue> {
    // if cells are missing, just copy series
    if options.series.iter().all(|s| s == &CellValue::Blank) {
        return copy_series(options);
    }

    // number series first
    let results = if options
        .series
        .iter()
        .all(|s| matches!(s, CellValue::Number(_)))
    {
        find_number_series(&options)
    }
    // date series
    else if options
        .series
        .iter()
        .all(|s| matches!(s, CellValue::Date(_)))
    {
        find_date_series(&options)
    }
    // time series
    else if options
        .series
        .iter()
        .all(|s| matches!(s, CellValue::Time(_)))
    {
        find_time_series(&options)
    }
    // date time series
    else if options
        .series
        .iter()
        .all(|s| matches!(s, CellValue::DateTime(_)))
    {
        find_date_time_series(&options)
    } else {
        find_string_series(&options)
    };

    results.unwrap_or(copy_series(options))
}

#[cfg(test)]
pub(crate) fn cell_value_number(values: Vec<i32>) -> Vec<CellValue> {
    values
        .iter()
        .map(|s| CellValue::Number((*s).into()))
        .collect()
}

#[cfg(test)]
pub(crate) fn cell_value_text(values: Vec<&str>) -> Vec<CellValue> {
    values
        .iter()
        .map(|s| CellValue::Text(s.to_string()))
        .collect()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn copies_a_series() {
        let options = SeriesOptions {
            series: cell_value_number(vec![1, 2, 3]),
            spaces: 10,
            negative: false,
        };
        let results = copy_series(options);
        assert_eq!(
            results,
            cell_value_number(vec![1, 2, 3, 1, 2, 3, 1, 2, 3, 1])
        );
    }

    #[test]
    fn copies_a_non_series() {
        let options = SeriesOptions {
            series: cell_value_text(vec!["a", "s", "d", "f"]),
            spaces: 8,
            negative: false,
        };
        let results = copy_series(options);
        assert_eq!(
            results,
            cell_value_text(vec!["a", "s", "d", "f", "a", "s", "d", "f"])
        );
    }

    #[test]
    fn copies_a_non_series_negative() {
        let options = SeriesOptions {
            series: cell_value_text(vec!["a", "s", "d", "f"]),
            spaces: 9,
            negative: true,
        };
        let results = copy_series(options);
        assert_eq!(
            results,
            cell_value_text(vec!["f", "a", "s", "d", "f", "a", "s", "d", "f"])
        );
    }
}
