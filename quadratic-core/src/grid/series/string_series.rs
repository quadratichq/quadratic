use anyhow::{Result, anyhow};

use crate::CellValue;

use super::SeriesOptions;

const MONTHS_SHORT: [&str; 12] = [
    "Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

const MONTHS_SHORT_UPPER: [&str; 12] = [
    "JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC",
];

const MONTHS_FULL: [&str; 12] = [
    "January",
    "February",
    "March",
    "April",
    "May",
    "June",
    "July",
    "August",
    "September",
    "October",
    "November",
    "December",
];

const MONTHS_FULL_UPPER: [&str; 12] = [
    "JANUARY",
    "FEBRUARY",
    "MARCH",
    "APRIL",
    "MAY",
    "JUNE",
    "JULY",
    "AUGUST",
    "SEPTEMBER",
    "OCTOBER",
    "NOVEMBER",
    "DECEMBER",
];

const DAYS_SHORT: [&str; 7] = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const DAYS_SHORT_UPPER: [&str; 7] = ["MON", "TUE", "WED", "THU", "FRI", "SAT", "SUN"];

const DAYS_FULL: [&str; 7] = [
    "Monday",
    "Tuesday",
    "Wednesday",
    "Thursday",
    "Friday",
    "Saturday",
    "Sunday",
];

const DAYS_FULL_UPPER: [&str; 7] = [
    "MONDAY",
    "TUESDAY",
    "WEDNESDAY",
    "THURSDAY",
    "FRIDAY",
    "SATURDAY",
    "SUNDAY",
];

fn is_series_key(key: &str, keys: &[&str]) -> bool {
    keys.contains(&key)
}

fn is_series_next_key(key: &str, existing_keys: &[&str], all_keys: &&[&str]) -> Result<bool> {
    let last_key = existing_keys[existing_keys.len() - 1];
    let index = all_keys
        .iter()
        .position(|val| val == &last_key)
        .ok_or_else(|| anyhow!("Expected to find last_key in all_keys in is_series_next_key"))?;

    // find index of the key
    let index_next_key = all_keys
        .iter()
        .position(|val| val == &key)
        .ok_or_else(|| anyhow!("Expected to find key in all_keys"))?;

    Ok((index + 1) % all_keys.len() == index_next_key)
}

pub fn checked_mod(n: isize, m: isize) -> isize {
    ((n % m) + m) % m
}

fn get_series_next_key(last_key: &str, all_keys: &&[&str], negative: bool) -> Result<String> {
    let all_keys_len = all_keys.len() as isize;
    let index = all_keys
        .iter()
        .position(|val| *last_key == val.to_string())
        .ok_or_else(|| anyhow!("Expected to find '{}' in all_keys", last_key))?
        as isize;

    let key = match negative {
        true => checked_mod(index - 1, all_keys_len),
        false => checked_mod(index + 1, all_keys_len),
    };

    let next_key = all_keys
        .get(key as usize)
        .ok_or_else(|| anyhow!("Expected to find '{}' in all_keys", key))?;

    Ok(next_key.to_string())
}

pub fn find_string_series(options: &SeriesOptions) -> Option<Vec<CellValue>> {
    let mut results: Vec<CellValue> = vec![];
    let SeriesOptions {
        series,
        spaces,
        negative,
    } = options;
    let text_series: &[&[&str]] = &[
        &MONTHS_SHORT,
        &MONTHS_SHORT_UPPER,
        &MONTHS_FULL,
        &MONTHS_FULL_UPPER,
        &DAYS_SHORT,
        &DAYS_SHORT_UPPER,
        &DAYS_FULL,
        &DAYS_FULL_UPPER,
    ];

    let mut possible_text_series = text_series.iter().map(|_| Some(vec![])).collect::<Vec<_>>();

    series.iter().for_each(|cell| {
        text_series.iter().enumerate().for_each(|(i, text_series)| {
            let cell_value = cell.to_string();

            if let Some(mut possible) = possible_text_series[i].to_owned() {
                if !is_series_key(&cell_value, text_series) {
                    possible_text_series[i] = None;
                } else if possible.is_empty() {
                    possible_text_series[i] = Some(vec![cell.to_owned()]);
                } else if is_series_next_key(
                    &cell_value,
                    &possible
                        .iter()
                        .map(|s| match s {
                            CellValue::Text(s) => s,
                            _ => "",
                        })
                        .collect::<Vec<&str>>(),
                    text_series,
                )
                .unwrap_or(false)
                {
                    possible.push(cell.to_owned());
                    possible_text_series[i] = Some(possible);
                } else {
                    possible_text_series[i] = None;
                }
            }
        });
    });

    for i in 0..possible_text_series.len() {
        if let Some(entry) = &possible_text_series[i].clone()
            && !entry.is_empty()
        {
            let current = if !negative {
                entry[entry.len() - 1].to_owned()
            } else {
                entry[0].to_owned()
            };

            // TODO(ddimaria): replace with new to-cell-value code when it's ready
            let mut cell_value = match current {
                CellValue::Text(current) => current,
                _ => "".into(),
            };

            (0..*spaces).for_each(|_| {
                if let Ok(next) = get_series_next_key(&cell_value, &text_series[i], *negative) {
                    results.push(CellValue::Text(next.to_owned()));
                    cell_value = next;
                }
            });

            if *negative {
                results.reverse();
            }

            return Some(results);
        }
    }

    if !results.is_empty() {
        return Some(results);
    }

    None
}

#[cfg(test)]
mod tests {
    use crate::grid::series::{cell_value_text, find_auto_complete};

    use super::*;
    #[test]
    fn find_a_text_series_short_month() {
        let options = SeriesOptions {
            series: cell_value_text(vec!["Jan", "Feb", "Mar"]),
            spaces: 4,
            negative: false,
        };
        let results = find_auto_complete(options);
        assert_eq!(results, cell_value_text(vec!["Apr", "May", "Jun", "Jul"]));
    }

    #[test]
    fn find_a_text_series_uppercase_short_month_negative() {
        let options = SeriesOptions {
            series: cell_value_text(vec!["JAN", "FEB", "MAR"]),
            spaces: 4,
            negative: true,
        };
        let results = find_auto_complete(options);
        assert_eq!(results, cell_value_text(vec!["SEP", "OCT", "NOV", "DEC"]));
    }

    #[test]
    fn find_a_text_series_full_month() {
        let options = SeriesOptions {
            series: cell_value_text(vec!["January", "February"]),
            spaces: 1,
            negative: false,
        };
        let results = find_auto_complete(options);
        assert_eq!(results, cell_value_text(vec!["March"]));
    }

    #[test]
    fn find_a_text_series_uppercase_full_month_negative_wrap() {
        let options = SeriesOptions {
            series: cell_value_text(vec!["FEBRUARY", "MARCH"]),
            spaces: 2,
            negative: true,
        };
        let results = find_auto_complete(options);
        assert_eq!(results, cell_value_text(vec!["DECEMBER", "JANUARY"]));
    }
}
