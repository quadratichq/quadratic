use rust_decimal::prelude::*;

use super::number::decimal_from_str;

// Currency symbols ordered by length (longest first) to avoid partial matches
// e.g., "R$" must be checked before "R" to correctly parse "R$123"
pub const CURRENCY_SYMBOLS: &[&str] = &[
    "CHF", "R$", "kr", "zł", // Multi-character symbols first
    "$", "€", "£", "¥", "₹", "₩", "₺", "₽", "R", // Single-character symbols
];

fn strip_commas(value: &str) -> String {
    value.trim().to_string().replace(',', "")
}

fn strip_parentheses(value: &str) -> String {
    let mut trimmed = value.trim();

    let percent = if trimmed.ends_with("%") {
        trimmed = trimmed.strip_suffix("%").unwrap_or(trimmed);
        "%"
    } else {
        ""
    };
    if trimmed.starts_with("(") && trimmed.ends_with(")") {
        format!("-{}{}", trimmed[1..trimmed.len() - 1].trim(), percent)
    } else {
        value.to_string()
    }
}

// Currency formatting rules: position (start/end) and spacing
#[derive(Debug, Clone, Copy)]
struct CurrencyFormat {
    at_end: bool,
    space: bool,
}

// Hard-coded currency formatting rules
fn get_currency_format(symbol: &str) -> CurrencyFormat {
    match symbol {
        "$" => CurrencyFormat {
            at_end: false,
            space: false,
        },
        "€" => CurrencyFormat {
            at_end: false,
            space: false,
        },
        "£" => CurrencyFormat {
            at_end: false,
            space: false,
        },
        "¥" => CurrencyFormat {
            at_end: false,
            space: false,
        },
        "CHF" => CurrencyFormat {
            at_end: true,
            space: true,
        },
        "₹" => CurrencyFormat {
            at_end: false,
            space: false,
        },
        "R$" => CurrencyFormat {
            at_end: false,
            space: true,
        },
        "₩" => CurrencyFormat {
            at_end: false,
            space: false,
        },
        "zł" => CurrencyFormat {
            at_end: true,
            space: true,
        },
        "₺" => CurrencyFormat {
            at_end: false,
            space: false,
        },
        "₽" => CurrencyFormat {
            at_end: true,
            space: true,
        },
        "R" => CurrencyFormat {
            at_end: false,
            space: false,
        },
        "kr" => CurrencyFormat {
            at_end: true,
            space: true,
        },
        _ => CurrencyFormat {
            // Default: start position, no space
            at_end: false,
            space: false,
        },
    }
}

/// Formats a number with currency according to the symbol's formatting rules
pub fn format_currency(number: &str, symbol: &str, is_negative: bool) -> String {
    let format = get_currency_format(symbol);
    let space = if format.space { " " } else { "" };

    if format.at_end {
        let mut currency = if is_negative {
            String::from("-")
        } else {
            String::new()
        };
        currency.push_str(number);
        currency.push_str(&format!("{space}{symbol}"));
        currency
    } else {
        let mut currency = if is_negative {
            format!("-{symbol}{space}")
        } else {
            format!("{symbol}{space}")
        };
        currency.push_str(number);
        currency
    }
}

/// Unpacks a currency value string into its symbol and numeric value
/// Returns None if no valid currency symbol is found
pub fn unpack_currency(s: &str) -> Option<(String, Decimal)> {
    if s.is_empty() {
        return None;
    }

    let without_parentheses = strip_parentheses(s);
    let (is_negative, absolute_value) = (
        without_parentheses.starts_with("-"),
        without_parentheses
            .strip_prefix("-")
            .map_or(without_parentheses.as_str(), |absolute_value| {
                absolute_value.trim()
            }),
    );

    // Try to find currency symbol at the beginning
    for symbol in CURRENCY_SYMBOLS {
        if let Some(stripped) = absolute_value
            .strip_prefix(symbol)
            .map(|stripped| stripped.trim())
        {
            let without_commas = strip_commas(&strip_parentheses(stripped));
            if let Ok(bd) = decimal_from_str(&without_commas) {
                let bd = if is_negative { -bd } else { bd };
                return Some((symbol.to_string(), bd));
            }
        }
    }

    // Try to find currency symbol at the end
    for symbol in CURRENCY_SYMBOLS {
        if let Some(stripped) = absolute_value
            .strip_suffix(symbol)
            .map(|stripped| stripped.trim())
        {
            let without_commas = strip_commas(&strip_parentheses(stripped));
            if let Ok(bd) = decimal_from_str(&without_commas) {
                let bd = if is_negative { -bd } else { bd };
                return Some((symbol.to_string(), bd));
            }
        }
    }
    None
}

/// Strips currency symbols from the beginning or end of a value string
pub fn strip_currency(value: &str) -> String {
    let (is_negative, absolute_value) = (
        value.starts_with("-"),
        value.strip_prefix("-").unwrap_or(value),
    );

    let mut stripped = absolute_value.trim();

    // Try to strip from the beginning first
    for symbol in CURRENCY_SYMBOLS {
        if let Some(remaining) = stripped.strip_prefix(symbol) {
            stripped = remaining.trim();
            break; // Only strip the first matching symbol
        }
    }

    // If no symbol was found at the beginning, try the end
    if stripped == absolute_value.trim() {
        for symbol in CURRENCY_SYMBOLS {
            if let Some(remaining) = stripped.strip_suffix(symbol) {
                stripped = remaining.trim();
                break; // Only strip the first matching symbol
            }
        }
    }

    if is_negative {
        if let Some(stripped) = stripped.strip_prefix("-") {
            stripped.trim().to_string()
        } else {
            format!("-{}", stripped.trim())
        }
    } else {
        stripped.trim().to_string()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_format_currency_start_no_space() {
        // Test currencies that go at the start with no space
        assert_eq!(format_currency("100", "$", false), "$100");
        assert_eq!(format_currency("100", "$", true), "-$100");
        assert_eq!(format_currency("123.45", "$", false), "$123.45");
        assert_eq!(format_currency("123.45", "$", true), "-$123.45");

        assert_eq!(format_currency("100", "€", false), "€100");
        assert_eq!(format_currency("100", "€", true), "-€100");
        assert_eq!(format_currency("123.45", "€", false), "€123.45");
        assert_eq!(format_currency("123.45", "€", true), "-€123.45");

        assert_eq!(format_currency("100", "£", false), "£100");
        assert_eq!(format_currency("100", "£", true), "-£100");

        assert_eq!(format_currency("100", "¥", false), "¥100");
        assert_eq!(format_currency("100", "¥", true), "-¥100");

        assert_eq!(format_currency("100", "₹", false), "₹100");
        assert_eq!(format_currency("100", "₹", true), "-₹100");

        assert_eq!(format_currency("100", "₩", false), "₩100");
        assert_eq!(format_currency("100", "₩", true), "-₩100");

        assert_eq!(format_currency("100", "₺", false), "₺100");
        assert_eq!(format_currency("100", "₺", true), "-₺100");

        assert_eq!(format_currency("100", "R", false), "R100");
        assert_eq!(format_currency("100", "R", true), "-R100");
    }

    #[test]
    fn test_format_currency_start_with_space() {
        // Test currencies that go at the start with a space
        assert_eq!(format_currency("100", "R$", false), "R$ 100");
        assert_eq!(format_currency("100", "R$", true), "-R$ 100");
        assert_eq!(format_currency("123.45", "R$", false), "R$ 123.45");
        assert_eq!(format_currency("123.45", "R$", true), "-R$ 123.45");
    }

    #[test]
    fn test_format_currency_end_with_space() {
        // Test currencies that go at the end with a space
        assert_eq!(format_currency("100", "CHF", false), "100 CHF");
        assert_eq!(format_currency("100", "CHF", true), "-100 CHF");

        assert_eq!(format_currency("100", "zł", false), "100 zł");
        assert_eq!(format_currency("100", "zł", true), "-100 zł");

        assert_eq!(format_currency("100", "₽", false), "100 ₽");
        assert_eq!(format_currency("100", "₽", true), "-100 ₽");

        assert_eq!(format_currency("100", "kr", false), "100 kr");
        assert_eq!(format_currency("100", "kr", true), "-100 kr");
    }

    #[test]
    fn test_format_currency_with_commas() {
        // Test formatting with numbers that have commas
        assert_eq!(format_currency("123,456.78", "$", false), "$123,456.78");
        assert_eq!(format_currency("123,456.78", "$", true), "-$123,456.78");
        assert_eq!(format_currency("123,456.78", "€", false), "€123,456.78");
        assert_eq!(format_currency("123,456.78", "€", true), "-€123,456.78");
        assert_eq!(format_currency("123,456.78", "R$", false), "R$ 123,456.78");
        assert_eq!(format_currency("123,456.78", "R$", true), "-R$ 123,456.78");
    }

    #[test]
    fn test_format_currency_unknown_symbol() {
        // Test unknown currency symbol (should default to start, no space)
        assert_eq!(format_currency("100", "XYZ", false), "XYZ100");
        assert_eq!(format_currency("100", "XYZ", true), "-XYZ100");
    }

    #[test]
    fn test_strip_currency() {
        // Test stripping currency symbols from the beginning
        assert_eq!(strip_currency("$100"), "100");
        assert_eq!(strip_currency("-$100"), "-100");
        assert_eq!(strip_currency("$ 100"), "100");
        assert_eq!(strip_currency("- $ 100"), "-100");

        assert_eq!(strip_currency("€100"), "100");
        assert_eq!(strip_currency("R$ 100"), "100");
        assert_eq!(strip_currency("-R$ 100"), "-100");

        assert_eq!(strip_currency("CHF100"), "100");

        // Test stripping currency symbols from the end
        assert_eq!(strip_currency("100 €"), "100");
        assert_eq!(strip_currency("-100 €"), "-100");
        assert_eq!(strip_currency("100  €"), "100");
        assert_eq!(strip_currency("-100  €"), "-100");

        assert_eq!(strip_currency("100 CHF"), "100");
        assert_eq!(strip_currency("-100 CHF"), "-100");
        assert_eq!(strip_currency("100  CHF"), "100");

        assert_eq!(strip_currency("100 zł"), "100");
        assert_eq!(strip_currency("-100 zł"), "-100");
        assert_eq!(strip_currency("₺100"), "100");
        assert_eq!(strip_currency("100 ₽"), "100");
        assert_eq!(strip_currency("100 kr"), "100");

        // Test multi-character symbols
        assert_eq!(strip_currency("R$123.45"), "123.45");
        assert_eq!(strip_currency("CHF123.45"), "123.45");
        assert_eq!(strip_currency("kr123.45"), "123.45");
        assert_eq!(strip_currency("zł123.45"), "123.45");

        // Test that longer symbols are matched before shorter ones
        assert_eq!(strip_currency("R$123.45"), "123.45");
        assert_eq!(strip_currency("R 123.45"), "123.45");

        // Test with no currency symbol
        assert_eq!(strip_currency("100"), "100");
        assert_eq!(strip_currency("-100"), "-100");
        assert_eq!(strip_currency("test"), "test");
    }

    #[test]
    fn test_strip_currency_with_negative() {
        // Test various negative number formats
        assert_eq!(strip_currency("-$100"), "-100");
        assert_eq!(strip_currency("$-100"), "-100");
        assert_eq!(strip_currency("- $ 100"), "-100");
        assert_eq!(strip_currency("$ -100"), "-100");

        // Test negative with currency at end
        assert_eq!(strip_currency("-100 €"), "-100");
        assert_eq!(strip_currency("- 100 €"), "-100");
        assert_eq!(strip_currency("-100 CHF"), "-100");
    }

    #[test]
    fn test_unpack_currency() {
        use crate::values::number::decimal_from_str;

        // Test unpacking currency from the beginning
        let value = String::from("$123.123");
        assert_eq!(
            unpack_currency(&value),
            Some((String::from("$"), decimal_from_str("123.123").unwrap()))
        );

        let value = String::from("test");
        assert_eq!(unpack_currency(&value), None);

        let value = String::from("$123$123");
        assert_eq!(unpack_currency(&value), None);

        let value = String::from("$123.123abc");
        assert_eq!(unpack_currency(&value), None);

        // Test multi-character currency symbols
        let value = String::from("CHF123.45");
        assert_eq!(
            unpack_currency(&value),
            Some((String::from("CHF"), decimal_from_str("123.45").unwrap()))
        );

        let value = String::from("R$123.45");
        assert_eq!(
            unpack_currency(&value),
            Some((String::from("R$"), decimal_from_str("123.45").unwrap()))
        );

        let value = String::from("kr123.45");
        assert_eq!(
            unpack_currency(&value),
            Some((String::from("kr"), decimal_from_str("123.45").unwrap()))
        );

        // Test that longer symbols are matched before shorter ones
        // "R$" should match before "R" for "R$123.45" (Brazilian Real)
        let value = String::from("R$123.45");
        assert_eq!(
            unpack_currency(&value),
            Some((String::from("R$"), decimal_from_str("123.45").unwrap()))
        );

        // Test that "R 123" (South African Rand with space) correctly matches "R" and not "R$"
        let value = String::from("R 123.45");
        assert_eq!(
            unpack_currency(&value),
            Some((String::from("R"), decimal_from_str("123.45").unwrap()))
        );

        // Test unpacking currency from the end
        let value = String::from("123.45 €");
        assert_eq!(
            unpack_currency(&value),
            Some((String::from("€"), decimal_from_str("123.45").unwrap()))
        );

        let value = String::from("123.45 CHF");
        assert_eq!(
            unpack_currency(&value),
            Some((String::from("CHF"), decimal_from_str("123.45").unwrap()))
        );

        let value = String::from("123.45 zł");
        assert_eq!(
            unpack_currency(&value),
            Some((String::from("zł"), decimal_from_str("123.45").unwrap()))
        );

        let value = String::from("123.45 kr");
        assert_eq!(
            unpack_currency(&value),
            Some((String::from("kr"), decimal_from_str("123.45").unwrap()))
        );

        // Test with negative numbers
        let value = String::from("-$123.45");
        assert_eq!(
            unpack_currency(&value),
            Some((String::from("$"), decimal_from_str("-123.45").unwrap()))
        );

        let value = String::from("-123.45 €");
        assert_eq!(
            unpack_currency(&value),
            Some((String::from("€"), decimal_from_str("-123.45").unwrap()))
        );

        // Test with parentheses (negative)
        let value = String::from("($123.45)");
        assert_eq!(
            unpack_currency(&value),
            Some((String::from("$"), decimal_from_str("-123.45").unwrap()))
        );

        // Test with commas
        let value = String::from("$123,456.78");
        assert_eq!(
            unpack_currency(&value),
            Some((String::from("$"), decimal_from_str("123456.78").unwrap()))
        );
    }
}
