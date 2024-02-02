use anyhow::{anyhow, Result};
use bigdecimal::{BigDecimal, Zero};
use itertools::Itertools;

use crate::CellValue;

const ALPHABET_LOWER: [&str; 26] = [
    "a", "b", "c", "d", "e", "f", "g", "h", "i", "j", "k", "l", "m", "n", "o", "p", "q", "r", "s",
    "t", "u", "v", "w", "x", "y", "z",
];

const ALPHABET_UPPER: [&str; 26] = [
    "A", "B", "C", "D", "E", "F", "G", "H", "I", "J", "K", "L", "M", "N", "O", "P", "Q", "R", "S",
    "T", "U", "V", "W", "X", "Y", "Z",
];

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

pub struct SeriesOptions {
    pub series: Vec<CellValue>,
    pub spaces: i32,
    pub negative: bool,
}

pub fn copy_series(options: SeriesOptions) -> Vec<CellValue> {
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

pub fn find_number_series(options: SeriesOptions) -> Vec<CellValue> {
    // if only one number, copy it
    if options.series.len() == 1 {
        return copy_series(options);
    }

    let mut addition: Option<BigDecimal> = None;
    let mut multiplication: Option<BigDecimal> = None;
    let SeriesOptions {
        ref series,
        spaces,
        negative,
    } = options;

    // convert every cell value to BigDecimal
    let zero = BigDecimal::zero();
    let numbers = series
        .iter()
        .map(|s| match s {
            CellValue::Number(number) => number,
            _ => &zero,
        })
        .collect::<Vec<&BigDecimal>>();

    // determine if addition or multiplication are possible
    // if possible, store the difference or quotient
    (1..numbers.len()).enumerate().for_each(|(index, number)| {
        let difference = numbers[number] - numbers[number - 1];

        if index == 0 {
            addition = Some(difference);
        } else if let Some(add) = &addition {
            if &difference != add {
                addition = None;
            }
        }

        // no divide by zero
        if numbers[number - 1] == &BigDecimal::zero() {
            multiplication = None;
        } else {
            let quotient = numbers[number] / numbers[number - 1];

            if index == 0 {
                multiplication = Some(quotient);
            } else if let Some(mult) = &multiplication {
                if &quotient != mult {
                    multiplication = None;
                }
            }
        }
    });

    // if neither addition or multiplication are possible, just copy series
    if addition.is_none() && multiplication.is_none() {
        return copy_series(options);
    }

    let mut current = numbers[numbers.len() - 1].to_owned();

    if negative {
        current = numbers[0].to_owned();
    }

    let calc = |val: &BigDecimal| match (&addition, &multiplication, negative) {
        (Some(add), _, false) => val + add,
        (Some(add), _, true) => val - add,
        (_, Some(mult), false) => val * mult,
        (_, Some(mult), true) => val / mult,
        (_, _, _) => unreachable!(),
    };

    let mut results = (0..spaces)
        .map(|_| {
            current = calc(&current);
            CellValue::Number(current.to_owned())
        })
        .collect::<Vec<CellValue>>();

    if negative {
        results.reverse();
    }

    results
}

pub fn find_string_series(options: SeriesOptions) -> Vec<CellValue> {
    let mut results: Vec<CellValue> = vec![];
    let SeriesOptions {
        ref series,
        spaces,
        negative,
    } = options;
    let text_series: &[&[&str]] = &[
        &ALPHABET_LOWER,
        &ALPHABET_UPPER,
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
                        .collect(),
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
        if let Some(entry) = &possible_text_series[i].clone() {
            if !entry.is_empty() {
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

                (0..spaces).for_each(|_| {
                    if let Ok(next) = get_series_next_key(&cell_value, &text_series[i], negative) {
                        results.push(CellValue::Text(next.to_owned()));
                        cell_value = next;
                    }
                });

                if negative {
                    results.reverse();
                }

                return results;
            }
        }
    }

    if !results.is_empty() {
        return results;
    }

    // no case found
    copy_series(options)
}

pub fn find_auto_complete(options: SeriesOptions) -> Vec<CellValue> {
    // if cells are missing, just copy series
    if options.series.iter().all(|s| *s == CellValue::Blank) {
        return copy_series(options);
    }

    // number series first
    if options
        .series
        .iter()
        .all(|s| matches!(s, CellValue::Number(_)))
    {
        return find_number_series(options);
    }

    find_string_series(options)
}

pub fn is_series_key(key: &str, keys: &[&str]) -> bool {
    keys.contains(&key)
}

pub fn is_series_next_key(
    key: &str,
    existing_keys: &Vec<&str>,
    all_keys: &&[&str],
) -> Result<bool> {
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

pub fn get_series_next_key(last_key: &str, all_keys: &&[&str], negative: bool) -> Result<String> {
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

#[cfg(test)]
mod tests {
    use super::*;

    fn cell_value_number(values: Vec<i32>) -> Vec<CellValue> {
        values
            .iter()
            .map(|s| CellValue::Number(BigDecimal::from(s)))
            .collect::<Vec<CellValue>>()
    }

    fn cell_value_text(values: Vec<&str>) -> Vec<CellValue> {
        values
            .iter()
            .map(|s| CellValue::Text(s.to_string()))
            .collect::<Vec<CellValue>>()
    }

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

    #[test]
    fn find_a_number_series_positive_addition_by_one() {
        let options = SeriesOptions {
            series: cell_value_number(vec![1, 2, 3]),
            spaces: 4,
            negative: false,
        };
        let results = find_auto_complete(options);
        assert_eq!(results, cell_value_number(vec![4, 5, 6, 7]));
    }

    #[test]
    fn find_a_number_series_positive_addition_by_two() {
        let options = SeriesOptions {
            series: cell_value_number(vec![2, 4, 6]),
            spaces: 4,
            negative: false,
        };
        let results = find_auto_complete(options);
        assert_eq!(results, cell_value_number(vec![8, 10, 12, 14]));
    }

    #[test]
    fn find_a_number_series_positive_addition_by_minus_one() {
        let options = SeriesOptions {
            series: cell_value_number(vec![6, 5, 4]),
            spaces: 4,
            negative: false,
        };
        let results = find_auto_complete(options);
        assert_eq!(results, cell_value_number(vec![3, 2, 1, 0]));
    }

    #[test]
    fn find_a_number_series_positive_addition_by_minus_two() {
        let options = SeriesOptions {
            series: cell_value_number(vec![6, 4, 2]),
            spaces: 4,
            negative: false,
        };
        let results = find_auto_complete(options);
        assert_eq!(results, cell_value_number(vec![0, -2, -4, -6]));
    }

    #[test]
    fn find_a_number_series_positive_addition_by_add_one_negative() {
        let options = SeriesOptions {
            series: cell_value_number(vec![1, 2, 3]),
            spaces: 4,
            negative: true,
        };
        let results = find_auto_complete(options);
        assert_eq!(results, cell_value_number(vec![-3, -2, -1, 0]));
    }

    #[test]
    fn find_a_number_series_positive_addition_by_add_two_negative() {
        let options = SeriesOptions {
            series: cell_value_number(vec![2, 4, 6]),
            spaces: 4,
            negative: true,
        };
        let results = find_auto_complete(options);
        assert_eq!(results, cell_value_number(vec![-6, -4, -2, 0]));
    }

    #[test]
    fn find_a_number_series_positive_addition_by_minus_one_negative() {
        let options = SeriesOptions {
            series: cell_value_number(vec![6, 5, 4]),
            spaces: 4,
            negative: true,
        };
        let results = find_auto_complete(options);
        assert_eq!(results, cell_value_number(vec![10, 9, 8, 7]));
    }

    #[test]
    fn find_a_number_series_positive_addition_by_minus_two_negative() {
        let options = SeriesOptions {
            series: cell_value_number(vec![6, 4, 2]),
            spaces: 4,
            negative: true,
        };
        let results = find_auto_complete(options);
        assert_eq!(results, cell_value_number(vec![14, 12, 10, 8]));
    }

    #[test]
    fn find_a_number_series_positive_positive_multiplication() {
        let options = SeriesOptions {
            series: cell_value_number(vec![2, 4, 8]),
            spaces: 4,
            negative: false,
        };
        let results = find_auto_complete(options);
        assert_eq!(results, cell_value_number(vec![16, 32, 64, 128]));
    }

    #[test]
    fn find_a_number_series_positive_descending_multiplication() {
        let options = SeriesOptions {
            series: cell_value_number(vec![128, 64, 32]),
            spaces: 4,
            negative: false,
        };
        let results = find_auto_complete(options);
        assert_eq!(results, cell_value_number(vec![16, 8, 4, 2]));
    }

    #[test]
    fn find_a_number_series_positive_positive_multiplication_negative() {
        let options = SeriesOptions {
            series: cell_value_number(vec![16, 32, 64, 128]),
            spaces: 4,
            negative: true,
        };
        let results = find_auto_complete(options);
        assert_eq!(results, cell_value_number(vec![1, 2, 4, 8]));
    }

    #[test]
    fn find_a_number_series_positive_descending_multiplication_negative() {
        let options = SeriesOptions {
            series: cell_value_number(vec![128, 64, 32]),
            spaces: 4,
            negative: true,
        };
        let results = find_auto_complete(options);
        assert_eq!(results, cell_value_number(vec![2048, 1024, 512, 256]));
    }

    #[test]
    fn find_a_text_series_lowercase_letters() {
        let options = SeriesOptions {
            series: cell_value_text(vec!["a", "b", "c"]),
            spaces: 4,
            negative: false,
        };
        let results = find_auto_complete(options);
        assert_eq!(results, cell_value_text(vec!["d", "e", "f", "g"]));
    }

    #[test]
    fn find_a_text_series_uppercase_letters() {
        let options = SeriesOptions {
            series: cell_value_text(vec!["A", "B", "C"]),
            spaces: 4,
            negative: false,
        };
        let results = find_auto_complete(options);
        assert_eq!(results, cell_value_text(vec!["D", "E", "F", "G"]));
    }

    #[test]
    fn find_a_text_series_uppercase_letters_with_wrap() {
        let options = SeriesOptions {
            series: cell_value_text(vec!["X", "Y", "Z"]),
            spaces: 4,
            negative: false,
        };
        let results = find_auto_complete(options);
        assert_eq!(results, cell_value_text(vec!["A", "B", "C", "D"]));
    }

    #[test]
    fn find_a_text_series_uppercase_letters_with_wrap_negative() {
        let options = SeriesOptions {
            series: cell_value_text(vec!["A", "B", "C"]),
            spaces: 4,
            negative: true,
        };
        let results = find_auto_complete(options);
        assert_eq!(results, cell_value_text(vec!["W", "X", "Y", "Z"]));
    }

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
