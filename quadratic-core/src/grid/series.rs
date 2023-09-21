use anyhow::{anyhow, Result};
use bigdecimal::{BigDecimal, Zero};

use crate::CellValue;

const ALPHABET_LOWER: [&'static str; 26] = [
    "a", "b", "c", "d", "e", "f", "g", "h", "i", "j", "k", "l", "m", "n", "o", "p", "q", "r", "s",
    "t", "u", "v", "w", "x", "y", "z",
];

const ALPHABET_UPPER: [&'static str; 26] = [
    "A", "B", "C", "D", "E", "F", "G", "H", "I", "J", "K", "L", "M", "N", "O", "P", "Q", "R", "S",
    "T", "U", "V", "W", "X", "Y", "Z",
];

const MONTHS_SHORT: [&'static str; 12] = [
    "Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

const MONTHS_SHORT_UPPER: [&'static str; 12] = [
    "JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC",
];

const MONTHS_FULL: [&'static str; 12] = [
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

const MONTHS_FULL_UPPER: [&'static str; 12] = [
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

const DAYS_SHORT: [&'static str; 7] = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const DAYS_SHORT_UPPER: [&'static str; 7] = ["MON", "TUE", "WED", "THU", "FRI", "SAT", "SUN"];

const DAYS_FULL: [&'static str; 7] = [
    "Monday",
    "Tuesday",
    "Wednesday",
    "Thursday",
    "Friday",
    "Saturday",
    "Sunday",
];

const DAYS_FULL_UPPER: [&'static str; 7] = [
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
    let mut results;
    let SeriesOptions {
        series,
        spaces,
        negative,
    } = options;

    if negative {
        let mut copy = series.len() - 1;

        results = (0..spaces)
            .map(|_| {
                let value = series[copy].to_owned();
                copy = copy.checked_sub(1).unwrap_or(series.len() - 1);
                value
            })
            .collect::<Vec<CellValue>>();
        results.reverse();
    } else {
        let mut copy = 0;

        results = (0..spaces)
            .map(|_| {
                let value = series[copy].to_owned();
                copy = (copy + 1) % series.len();
                value
            })
            .collect::<Vec<CellValue>>();
    }

    results
}

pub fn find_number_series(options: SeriesOptions) -> Vec<CellValue> {
    let mut results: Vec<CellValue> = vec![];
    let mut addition: Option<BigDecimal> = None;
    let mut multiplication: Option<BigDecimal> = None;

    // if only one number, copy it
    if options.series.len() == 1 {
        return copy_series(options);
    }

    let SeriesOptions {
        series,
        spaces,
        negative,
    } = options;

    let numbers = series
        .iter()
        .filter_map(|s| match s {
            CellValue::Number(number) => Some(number),
            _ => None,
        })
        .collect::<Vec<&BigDecimal>>();

    (1..numbers.len()).enumerate().for_each(|(index, number)| {
        let difference = numbers[number] - numbers[number - 1];

        if index == 0 {
            addition = Some(difference.clone());
        } else if let Some(add) = addition.to_owned() {
            if difference != add {
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
            } else if let Some(mult) = multiplication.to_owned() {
                if quotient != mult {
                    multiplication = None;
                }
            }
        }

        if let Some(add) = addition.to_owned() {
            if negative {
                let mut current = numbers[0].to_owned();

                results = (0..spaces)
                    .map(|_| {
                        current = current.clone() - add.clone();
                        CellValue::Number(current.clone())
                    })
                    .collect::<Vec<CellValue>>();
                results.reverse();
            } else {
                let mut current = numbers[numbers.len() - 1].to_owned();

                results = (0..spaces)
                    .map(|_| {
                        current = current.clone() + add.clone();
                        CellValue::Number(current.clone())
                    })
                    .collect::<Vec<CellValue>>();
            }
        }

        if let Some(mult) = multiplication.to_owned() {
            if negative {
                let mut current = numbers[0].to_owned();

                results = (0..spaces)
                    .map(|_| {
                        current = current.clone() / mult.clone();
                        CellValue::Number(current.clone())
                    })
                    .collect::<Vec<CellValue>>();
                results.reverse();
            } else {
                let mut current = numbers[numbers.len() - 1].to_owned();

                results = (0..spaces)
                    .map(|_| {
                        current = current.clone() * mult.clone();
                        CellValue::Number(current.clone())
                    })
                    .collect::<Vec<CellValue>>();
            }
        }
    });

    return results;
}

pub fn find_string_series(options: SeriesOptions) -> Vec<CellValue> {
    let mut results: Vec<CellValue> = vec![];
    let SeriesOptions {
        ref series,
        spaces,
        negative,
    } = options;
    let text_series: Vec<Vec<&str>> = vec![
        ALPHABET_LOWER.into(),
        ALPHABET_UPPER.into(),
        MONTHS_SHORT.into(),
        MONTHS_SHORT_UPPER.into(),
        MONTHS_FULL.into(),
        MONTHS_FULL_UPPER.into(),
        DAYS_SHORT.into(),
        DAYS_SHORT_UPPER.into(),
        DAYS_FULL.into(),
        DAYS_FULL_UPPER.into(),
    ];

    let mut possible_text_series = text_series
        .iter()
        .map(|_| vec![])
        .collect::<Vec<Vec<CellValue>>>();

    series.iter().for_each(|cell| {
        text_series.iter().enumerate().for_each(|(i, text_series)| {
            // TODO(ddimaria): change to if let Some
            let cell_value = match cell {
                CellValue::Text(s) => s,
                _ => "",
            };

            // if possible_text_series[i].is_some() {
            if !is_series_key(cell_value, text_series) {
                possible_text_series[i] = vec![];
            } else if possible_text_series[i].len() == 0 {
                possible_text_series[i] = vec![cell.to_owned()];
            } else if is_series_next_key(
                cell_value,
                &possible_text_series[i]
                    .iter()
                    .map(|s| match s {
                        CellValue::Text(s) => s,
                        _ => "",
                    })
                    .collect(),
                text_series,
            )
            .unwrap()
            {
                possible_text_series[i].push(cell.to_owned());
            } else {
                possible_text_series[i] = vec![];
            }
            // }
        });
    });

    possible_text_series.iter().enumerate().for_each(|(i, s)| {
        let entry = possible_text_series[i].clone();
        if entry.len() > 0 {
            if negative {
                let string_list = entry;
                let current = string_list[0].clone();
                let mut cell_value = match current {
                    CellValue::Text(current) => current,
                    _ => "".into(),
                };

                (0..spaces).for_each(|_| {
                    let next =
                        get_series_next_key(&cell_value, text_series[i].clone(), true).unwrap();
                    results.push(CellValue::Text(next.clone()));
                    cell_value = next;
                });

                results.reverse();
            } else {
                let string_list = entry;
                let current = string_list[string_list.len() - 1].clone();
                let mut cell_value = match current {
                    CellValue::Text(current) => current,
                    _ => "".into(),
                };

                (0..spaces).for_each(|_| {
                    let next =
                        get_series_next_key(&cell_value, text_series[i].clone(), false).unwrap();

                    results.push(CellValue::Text(next.clone()));
                    cell_value = next;
                });
            }
        }
    });

    if results.len() > 0 {
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
    if options.series.iter().all(|s| match s {
        CellValue::Number(_) => true,
        _ => false,
    }) {
        return find_number_series(options);
    }

    find_string_series(options)
}

pub fn is_series_key(key: &str, keys: &Vec<&str>) -> bool {
    keys.contains(&key)
}

pub fn is_series_next_key(
    key: &str,
    existing_keys: &Vec<&str>,
    all_keys: &Vec<&str>,
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

pub fn get_series_next_key(last_key: &str, all_keys: Vec<&str>, negative: bool) -> Result<String> {
    let index = all_keys
        .iter()
        .position(|val| last_key.to_string() == val.to_string())
        .ok_or_else(|| anyhow!("Expected to find '{}' in all_keys", last_key))?
        as isize;
    let all_keys_len = all_keys.len() as isize;

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
        println!("{:#?}", results);
        assert_eq!(results, cell_value_text(vec!["DECEMBER", "JANUARY"]));
    }
}
