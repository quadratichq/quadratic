use bigdecimal::{BigDecimal, Zero};

use crate::CellValue;

pub struct Series {
    pub series: Vec<CellValue>,
    pub spaces: i32,
    pub negative: bool,
}

pub fn copy_series(options: Series) -> Vec<CellValue> {
    let Series {
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

pub fn find_number_series(options: Series) -> Vec<CellValue> {
    // if only one number, copy it
    if options.series.len() == 1 {
        return copy_series(options);
    }

    let Series {
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

        if let Some(add) = addition.to_owned() {
            if difference != add {
                addition = None;
            } else {
                addition = Some(difference);
            }
        }

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
                let mut current = numbers[0].to_owned();

                results.extend(
                    (0..spaces)
                        .map(|_| {
                            current = current.clone() - add.clone();
                            CellValue::Number(current.clone())
                        })
                        .rev()
                        .collect::<Vec<CellValue>>(),
                );
            } else {
                let mut current = numbers[numbers.len() - 1].to_owned();

                results.extend(
                    (0..spaces)
                        .map(|_| {
                            current = current.clone() - add.clone();
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
                        .rev()
                        .collect::<Vec<CellValue>>(),
                );
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

pub fn find_auto_complete(options: Series) -> Vec<CellValue> {
    // if cells are missing, just copy series
    if !options.series.iter().all(|s| *s == CellValue::Blank) {
        return copy_series(options);
    }

    // number series first
    if !options.series.iter().all(|s| match s {
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
    use crate::{array, grid::Bold};
    use bigdecimal::BigDecimal;
    use std::str::FromStr;
    use tabled::{
        builder::Builder,
        settings::Color,
        settings::{Modify, Style},
    };

    #[test]
    fn find_a_number_series() {}
}
