use anyhow::{anyhow, Result};
use bigdecimal::{BigDecimal, Zero};

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

pub fn find_auto_complete(options: SeriesOptions) -> Vec<CellValue> {
    // if cells are missing, just copy series
    if options.series.iter().all(|s| *s == CellValue::Blank) {
        println!("blank");
        return copy_series(options);
    }

    // number series first
    if options.series.iter().all(|s| match s {
        CellValue::Number(_) => true,
        _ => false,
    }) {
        return find_number_series(options);
    }

    // string series
    // return findStringSeries(options);
    vec![]
}

pub fn is_series_key(key: &str, keys: Vec<&str>) -> bool {
    keys.contains(&key)
}

pub fn is_series_next_key(
    key: &str,
    existing_keys: Vec<&str>,
    all_keys: Vec<&str>,
) -> Result<bool> {
    let last_key = existing_keys[existing_keys.len() - 1];
    let index = all_keys
        .iter()
        .position(|val| val == &last_key)
        .ok_or_else(|| anyhow!("Expected to find last_key in all_keys"))?;

    // find index of the key
    let index_next_key = all_keys
        .iter()
        .position(|val| val == &key)
        .ok_or_else(|| anyhow!("Expected to find key in all_keys"))?;

    Ok((index + 1) % all_keys.len() == index_next_key)
}

pub fn get_series_next_key(last_key: &str, all_keys: Vec<&str>, negative: bool) -> Result<String> {
    let index = all_keys
        .iter()
        .position(|val| val == &last_key)
        .ok_or_else(|| anyhow!("Expected to find last_key in all_keys"))?;

    let key = match negative {
        true => index - 1 % all_keys.len(),
        false => index + 1 % all_keys.len(),
    };

    let next_key = all_keys
        .get(key)
        .ok_or_else(|| anyhow!("Expected to find last_key in all_keys"))?;

    Ok(next_key.to_string())
}

#[cfg(test)]
mod tests {
    use super::*;

    fn to_cell_values(values: Vec<i32>) -> Vec<CellValue> {
        values
            .iter()
            .map(|s| CellValue::Number(BigDecimal::from(s)))
            .collect::<Vec<CellValue>>()
    }

    #[test]
    fn find_a_number_series_positive_addition_by_one() {
        let options = SeriesOptions {
            series: to_cell_values(vec![1, 2, 3]),
            spaces: 4,
            negative: false,
        };
        let results = find_auto_complete(options);
        assert_eq!(results, to_cell_values(vec![4, 5, 6, 7]));
    }

    #[test]
    fn find_a_number_series_positive_addition_by_two() {
        let options = SeriesOptions {
            series: to_cell_values(vec![2, 4, 6]),
            spaces: 4,
            negative: false,
        };
        let results = find_auto_complete(options);
        assert_eq!(results, to_cell_values(vec![8, 10, 12, 14]));
    }

    #[test]
    fn find_a_number_series_positive_addition_by_minus_one() {
        let options = SeriesOptions {
            series: to_cell_values(vec![6, 5, 4]),
            spaces: 4,
            negative: false,
        };
        let results = find_auto_complete(options);
        assert_eq!(results, to_cell_values(vec![3, 2, 1, 0]));
    }

    #[test]
    fn find_a_number_series_positive_addition_by_minus_two() {
        let options = SeriesOptions {
            series: to_cell_values(vec![6, 4, 2]),
            spaces: 4,
            negative: false,
        };
        let results = find_auto_complete(options);
        assert_eq!(results, to_cell_values(vec![0, -2, -4, -6]));
    }

    #[test]
    fn find_a_number_series_positive_addition_by_add_one_negative() {
        let options = SeriesOptions {
            series: to_cell_values(vec![1, 2, 3]),
            spaces: 4,
            negative: true,
        };
        let results = find_auto_complete(options);
        assert_eq!(results, to_cell_values(vec![-3, -2, -1, 0]));
    }

    #[test]
    fn find_a_number_series_positive_addition_by_add_two_negative() {
        let options = SeriesOptions {
            series: to_cell_values(vec![2, 4, 6]),
            spaces: 4,
            negative: true,
        };
        let results = find_auto_complete(options);
        assert_eq!(results, to_cell_values(vec![-6, -4, -2, 0]));
    }

    #[test]
    fn find_a_number_series_positive_addition_by_minus_one_negative() {
        let options = SeriesOptions {
            series: to_cell_values(vec![6, 5, 4]),
            spaces: 4,
            negative: true,
        };
        let results = find_auto_complete(options);
        assert_eq!(results, to_cell_values(vec![10, 9, 8, 7]));
    }

    #[test]
    fn find_a_number_series_positive_addition_by_minus_two_negative() {
        let options = SeriesOptions {
            series: to_cell_values(vec![6, 4, 2]),
            spaces: 4,
            negative: true,
        };
        let results = find_auto_complete(options);
        assert_eq!(results, to_cell_values(vec![14, 12, 10, 8]));
    }

    #[test]
    fn find_a_number_series_positive_positive_multiplication() {
        let options = SeriesOptions {
            series: to_cell_values(vec![2, 4, 8]),
            spaces: 4,
            negative: false,
        };
        let results = find_auto_complete(options);
        assert_eq!(results, to_cell_values(vec![16, 32, 64, 128]));
    }

    #[test]
    fn find_a_number_series_positive_descending_multiplication() {
        let options = SeriesOptions {
            series: to_cell_values(vec![128, 64, 32]),
            spaces: 4,
            negative: false,
        };
        let results = find_auto_complete(options);
        assert_eq!(results, to_cell_values(vec![16, 8, 4, 2]));
    }

    #[test]
    fn find_a_number_series_positive_positive_multiplication_negative() {
        let options = SeriesOptions {
            series: to_cell_values(vec![16, 32, 64, 128]),
            spaces: 4,
            negative: true,
        };
        let results = find_auto_complete(options);
        assert_eq!(results, to_cell_values(vec![1, 2, 4, 8]));
    }

    #[test]
    fn find_a_number_series_positive_descending_multiplication_negative() {
        let options = SeriesOptions {
            series: to_cell_values(vec![128, 64, 32]),
            spaces: 4,
            negative: true,
        };
        let results = find_auto_complete(options);
        assert_eq!(results, to_cell_values(vec![2048, 1024, 512, 256]));
    }
}
