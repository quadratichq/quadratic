use anyhow::Result;
use rust_decimal::prelude::*;

/// Rounds a number to the specified number of digits after the decimal point.
///
/// - If `digits` is 0 or omitted, then the number is rounded to an integer.
/// - If `digits > 0`, then the number is rounded to a digit after the decimal point. For example, `ROUND(x, 2)` rounds `x` to a multiple of 0.01.
/// - If `digits < 0`, then the number is rounded to a digit before the decimal point. For example, `ROUND(x, -2)` rounds `x` to a multiple of 100.
///
/// # Examples
///
/// ```
/// use quadratic_core::number::round_with_strategy;
/// use rust_decimal::prelude::*;
///
/// let number = Decimal::from(123456789);
/// let rounded = round_with_strategy(number, 2, RoundingStrategy::MidpointAwayFromZero);
/// assert_eq!(rounded, Decimal::from(123456789));
/// ```
pub fn round_with_strategy(number: Decimal, digits: i64, strategy: RoundingStrategy) -> Decimal {
    let rounded = if digits >= 0 {
        number.round_dp_with_strategy(digits as u32, strategy)
    } else {
        let factor = Decimal::from(10i64.pow((-digits) as u32));
        (number / factor).round_dp_with_strategy(0, strategy) * factor
    };

    rounded.normalize()
}

/// Rounds a number to the specified number of digits after the decimal point.
pub fn round(number: Decimal, digits: i64) -> Decimal {
    round_with_strategy(number, digits, RoundingStrategy::MidpointAwayFromZero)
}

/// Rounds a number **away from zero** to the specified number of digits after the decimal point.
pub fn round_up(number: Decimal, digits: i64) -> Decimal {
    round_with_strategy(number, digits, RoundingStrategy::AwayFromZero)
}

/// Rounds a number **toward zero** to the specified number of digits after the decimal point.
pub fn round_down(number: Decimal, digits: i64) -> Decimal {
    round_with_strategy(number, digits, RoundingStrategy::ToZero)
}

/// Rounds a number **toward zero** to the specified number of digits after the decimal point.
/// This is exactly the same as `round_down()`.
pub fn truncate(number: Decimal, digits: i64) -> Decimal {
    round_with_strategy(number, digits, RoundingStrategy::ToZero)
}

/// Strips any trailing zero's from a `Decimal` and converts -0 to 0.
pub fn normalize(number: Decimal) -> Decimal {
    number.normalize()
}

/// Sums a vector of `Decimal`s and normalizes the result.
pub fn sum(numbers: Vec<Decimal>) -> Decimal {
    normalize(numbers.iter().sum())
}

/// Converts a string to a `Decimal`.
pub fn decimal_from_str(s: &str) -> Result<Decimal> {
    Ok(Decimal::from_str(s)?)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_round_with_strategy() {
        let number = Decimal::from(123456789);
        let rounded = round_with_strategy(number, -1, RoundingStrategy::MidpointAwayFromZero);
        assert_eq!(rounded, Decimal::from(123456790));
    }

    #[test]
    fn test_round() {
        let number = Decimal::from(123456789);
        let rounded = round(number, -1);
        assert_eq!(rounded, Decimal::from(123456790));
    }

    #[test]
    fn test_round_up() {
        let number = Decimal::from(123456789);
        let rounded = round_up(number, -1);
        assert_eq!(rounded, Decimal::from(123456790));
    }

    #[test]
    fn test_round_down() {
        let number = Decimal::from(123456789);
        let rounded = round_down(number, -1);
        assert_eq!(rounded, Decimal::from(123456780));
    }

    #[test]
    fn test_truncate() {
        let number = Decimal::from_f64(123456789.1234).unwrap();
        let truncated = truncate(number, 2);
        assert_eq!(truncated, Decimal::from_f64(123456789.12).unwrap());
    }

    #[test]
    fn test_sum() {
        let numbers = vec![Decimal::from(1), Decimal::from(2), Decimal::from(3)];
        assert_eq!(sum(numbers), Decimal::from(6));
    }
}
