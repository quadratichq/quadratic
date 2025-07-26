use rust_decimal::prelude::*;

use crate::{CellValue, number::normalize};

use super::SeriesOptions;

pub(crate) fn find_number_series(options: &SeriesOptions) -> Option<Vec<CellValue>> {
    // if only one number, copy it
    if options.series.len() == 1 {
        return None;
    }

    let mut addition: Option<Decimal> = None;
    let mut multiplication: Option<Decimal> = None;
    let SeriesOptions {
        series,
        spaces,
        negative,
    } = options;

    // convert every cell value to Decimal
    let zero = Decimal::zero();
    let numbers = series
        .iter()
        .map(|(s, _)| match s {
            CellValue::Number(number) => number,
            _ => &zero,
        })
        .collect::<Vec<&Decimal>>();

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
        if numbers[number - 1] == &Decimal::zero() {
            multiplication = None;
        } else {
            let quotient = numbers[number] / numbers[number - 1];

            if index == 0 {
                multiplication = Some(quotient);
            } else if let Some(bd) = &multiplication {
                if &quotient != bd {
                    multiplication = None;
                }
            }
        }
    });

    // if neither addition or multiplication are possible, just copy series
    if addition.is_none() && multiplication.is_none() {
        return None;
    }

    let mut current = numbers[numbers.len() - 1].to_owned();

    if *negative {
        numbers[0].clone_into(&mut current);
    }

    let calc = |val: &Decimal| match (&addition, &multiplication, negative) {
        (Some(add), _, false) => val + add,
        (Some(add), _, true) => val - add,
        (_, Some(bd), false) => val * bd,
        (_, Some(bd), true) => val / bd,
        (_, _, _) => unreachable!(),
    };

    let mut results = (0..*spaces)
        .map(|_| {
            current = normalize(calc(&current));
            CellValue::Number(current.to_owned())
        })
        .collect::<Vec<CellValue>>();

    if *negative {
        results.reverse();
    }

    Some(results)
}

#[cfg(test)]
mod tests {
    use crate::grid::series::{cell_value_number, find_auto_complete};

    use super::*;

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
}
