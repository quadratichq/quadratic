use bigdecimal::{BigDecimal, Zero};

use crate::CellValue;

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
        let mut copy = series.len() - 1;

        return (0..spaces)
            .map(|_| {
                let value = series[copy].to_owned();
                copy = copy.checked_sub(1).unwrap_or(series.len() - 1);
                value
            })
            .rev()
            .collect::<Vec<CellValue>>();
    } else {
        let mut copy = 0;

        return (0..spaces)
            .map(|_| {
                let value = series[copy].to_owned();
                copy = (copy + 1) % series.len();
                value
            })
            .collect::<Vec<CellValue>>();
    }
}

pub fn find_number_series(options: SeriesOptions) -> Vec<CellValue> {
    // if only one number, copy it
    if options.series.len() == 1 {
        return copy_series(options);
    }

    let SeriesOptions {
        series,
        spaces,
        negative,
    } = options;

    let mut results: Vec<CellValue> = vec![];
    let mut addition: Option<BigDecimal> = None;
    let mut multiplication: Option<BigDecimal> = None;

    let numbers = series
        .iter()
        .filter_map(|s| match s {
            CellValue::Number(number) => Some(number),
            _ => None,
        })
        .collect::<Vec<&BigDecimal>>();

    (1..numbers.len()).for_each(|number| {
        let difference = numbers[number] - numbers[number - 1];

        // if let Some(add) = addition.to_owned() {
        if difference == addition.clone().unwrap_or(BigDecimal::zero()) {
            addition = None;
        } else {
            addition = Some(difference.clone());
        }
        // }

        // no divide by zero
        if numbers[number - 1] == &BigDecimal::zero() {
            multiplication = None;
        } else {
            let quotient = numbers[number] / numbers[number - 1];
            if let Some(mult) = multiplication.to_owned() {
                if quotient != mult {
                    multiplication = None;
                } else {
                    multiplication = Some(quotient);
                }
            }
        }

        if let Some(add) = addition.to_owned() {
            if negative {
                println!("negative: {:?}", negative);
                let mut current = numbers[0].to_owned();

                results.extend(
                    (0..spaces)
                        .map(|_| {
                            current = current.clone() - add.clone();
                            CellValue::Number(current.clone())
                        })
                        .collect::<Vec<CellValue>>(),
                );
                results.reverse();
            } else {
                let mut current = numbers[numbers.len() - 1].to_owned();

                results.extend(
                    (0..spaces)
                        .map(|_| {
                            current = current.clone() + add.clone();
                            CellValue::Number(current.clone())
                        })
                        .collect::<Vec<CellValue>>(),
                );
            }
        }

        if let Some(mult) = multiplication.to_owned() {
            if negative {
                let mut current = numbers[0].to_owned();

                results.extend(
                    (0..spaces)
                        .map(|_| {
                            current = current.clone() / mult.clone();
                            CellValue::Number(current.clone())
                        })
                        .collect::<Vec<CellValue>>(),
                );
                results.reverse();
            } else {
                let mut current = numbers[numbers.len() - 1].to_owned();

                results.extend(
                    (0..spaces)
                        .map(|_| {
                            current = current.clone() / mult.clone();
                            CellValue::Number(current.clone())
                        })
                        .collect::<Vec<CellValue>>(),
                );
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
        println!("results: {:?}", results);
    }
}
