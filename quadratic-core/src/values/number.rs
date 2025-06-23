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
/// use quadratic_core::values::number::round_with_strategy;
/// use rust_decimal::Decimal;
///
/// let number = Decimal::from(123456789);
/// let rounded = round_with_strategy(number, 2, RoundingStrategy::MidpointAwayFromZero);
/// assert_eq!(rounded, Decimal::from(123456789));
/// ```
///
/// ```
/// use quadratic_core::values::number::round_with_strategy;
/// use rust_decimal::Decimal;
///
/// let number = Decimal::from(123456789);
/// let rounded = round_with_strategy(number, -2, RoundingStrategy::MidpointAwayFromZero);
/// assert_eq!(rounded, Decimal::from(123456700));
/// ```
pub fn round_with_strategy(number: Decimal, digits: i64, strategy: RoundingStrategy) -> Decimal {
    if digits >= 0 {
        number.round_dp_with_strategy(digits as u32, strategy)
    } else {
        let factor = Decimal::from(10i64.pow((-digits) as u32));
        (number / factor).round_dp_with_strategy(0, strategy) * factor
    }
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

pub fn sum(numbers: Vec<Decimal>) -> Decimal {
    println!("numbers: {:?}", numbers);
    println!("sum: {:?}", numbers.iter().sum::<Decimal>());
    normalize(numbers.iter().sum())
}
