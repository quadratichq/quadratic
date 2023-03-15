use itertools::Itertools;
use std::fmt;

/// Returns a column's name from its number.
pub fn column_name(mut n: i64) -> String {
    let mut digits = vec![];
    let signum = n.signum();
    while n != 0 {
        n -= signum;
        digits.push((n % 25).unsigned_abs() as u8);
        n /= 25;
    }
    if signum <= 0 {
        digits.push(25);
    }
    digits
        .into_iter()
        .rev()
        .map(|i| {
            "ABCDEFGHIJKLMNOPQRSTUVWXYZ"[i as usize..]
                .chars()
                .next()
                .unwrap()
        })
        .collect()
}
/// Returns a column number from a name, or `None` if it is invalid or out of range.
pub fn column_from_name(mut s: &str) -> Option<i64> {
    if s == "Z" {
        Some(0)
    } else {
        // Multiply by the signum throughout the function rather than at the
        // very end, so that we can handle `i64::MIN` correctly.
        let signum = if let Some(rest) = s.strip_prefix('Z') {
            s = rest;
            -1
        } else {
            1
        };

        let mut ret = 0_i64;
        for char in s.chars() {
            ret = ret.checked_mul(25)?;
            if ('A'..='Y').contains(&char) {
                ret = ret.checked_add((char as i64 - 'A' as i64 + 1) * signum)?;
            } else {
                return None;
            }
        }
        Some(ret)
    }
}

/// Returns a human-friendly list of things, joined at the end by the given
/// conjuction.
pub fn join_with_conjunction(conjunction: &str, items: &[impl fmt::Display]) -> String {
    match items {
        [] => "(none)".to_string(),
        [a] => format!("{a}"),
        [a, b] => format!("{a} {conjunction} {b}"),
        [all_but_last @ .., z] => {
            let mut ret = all_but_last.iter().map(|x| format!("{x}, ")).join("");
            ret.push_str(conjunction);
            ret.push_str(&format!(" {z}"));
            ret
        }
    }
}

/// Implements `std::format::Display` for a type using arguments to `write!()`.
macro_rules! impl_display {
    ( for $typename:ty, $( $fmt_arg:expr ),+ $(,)? ) => {
        impl std::fmt::Display for $typename {
            fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
                write!(f, $( $fmt_arg ),+ )
            }
        }
    };
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_column_names() {
        // Test near 0
        assert_eq!("A", column_name(1));
        assert_eq!("B", column_name(2));
        assert_eq!("C", column_name(3));
        assert_eq!("D", column_name(4));
        assert_eq!("E", column_name(5));
        assert_eq!("F", column_name(6));

        assert_eq!("Z", column_name(0));

        assert_eq!("ZA", column_name(-1));
        assert_eq!("ZB", column_name(-2));
        assert_eq!("ZC", column_name(-3));
        assert_eq!("ZD", column_name(-4));
        assert_eq!("ZE", column_name(-5));
        assert_eq!("ZF", column_name(-6));

        // Test near ±25
        assert_eq!("X", column_name(24));
        assert_eq!("Y", column_name(25));
        assert_eq!("AA", column_name(26));
        assert_eq!("AB", column_name(27));
        assert_eq!("ZX", column_name(-24));
        assert_eq!("ZY", column_name(-25));
        assert_eq!("ZAA", column_name(-26));
        assert_eq!("ZAB", column_name(-27));

        // Test near ±50
        assert_eq!("AX", column_name(49));
        assert_eq!("AY", column_name(50));
        assert_eq!("BA", column_name(51));
        assert_eq!("BB", column_name(52));
        assert_eq!("ZAX", column_name(-49));
        assert_eq!("ZAY", column_name(-50));
        assert_eq!("ZBA", column_name(-51));
        assert_eq!("ZBB", column_name(-52));

        // Test near ±650
        assert_eq!("YX", column_name(649));
        assert_eq!("YY", column_name(650));
        assert_eq!("AAA", column_name(651));
        assert_eq!("AAB", column_name(652));
        assert_eq!("ZYX", column_name(-649));
        assert_eq!("ZYY", column_name(-650));
        assert_eq!("ZAAA", column_name(-651));
        assert_eq!("ZAAB", column_name(-652));

        // Test near the integer limits
        assert_eq!("FDRNAOXLWWEPGG", column_name(i64::MAX));
        assert_eq!("ZFDRNAOXLWWEPGH", column_name(i64::MIN));

        // Test fun stuff
        assert_eq!("QUADRATIC", column_name(2722458231478));
        assert_eq!("ZQUADRATIC", column_name(-2722458231478));
        assert_eq!("QUICKBROWNFOX", column_name(1064218308993582274));
    }

    #[test]
    fn test_from_column_names() {
        // Test near 0
        assert_eq!(Some(1), column_from_name("A"));
        assert_eq!(Some(2), column_from_name("B"));
        assert_eq!(Some(3), column_from_name("C"));
        assert_eq!(Some(4), column_from_name("D"));
        assert_eq!(Some(5), column_from_name("E"));
        assert_eq!(Some(6), column_from_name("F"));

        assert_eq!(Some(0), column_from_name("Z"));

        assert_eq!(Some(-1), column_from_name("ZA"));
        assert_eq!(Some(-2), column_from_name("ZB"));
        assert_eq!(Some(-3), column_from_name("ZC"));
        assert_eq!(Some(-4), column_from_name("ZD"));
        assert_eq!(Some(-5), column_from_name("ZE"));
        assert_eq!(Some(-6), column_from_name("ZF"));

        // Test near ±25
        assert_eq!(Some(24), column_from_name("X"));
        assert_eq!(Some(25), column_from_name("Y"));
        assert_eq!(Some(26), column_from_name("AA"));
        assert_eq!(Some(27), column_from_name("AB"));
        assert_eq!(Some(-24), column_from_name("ZX"));
        assert_eq!(Some(-25), column_from_name("ZY"));
        assert_eq!(Some(-26), column_from_name("ZAA"));
        assert_eq!(Some(-27), column_from_name("ZAB"));

        // Test near ±50
        assert_eq!(Some(49), column_from_name("AX"));
        assert_eq!(Some(50), column_from_name("AY"));
        assert_eq!(Some(51), column_from_name("BA"));
        assert_eq!(Some(52), column_from_name("BB"));
        assert_eq!(Some(-49), column_from_name("ZAX"));
        assert_eq!(Some(-50), column_from_name("ZAY"));
        assert_eq!(Some(-51), column_from_name("ZBA"));
        assert_eq!(Some(-52), column_from_name("ZBB"));

        // Test near ±650
        assert_eq!(Some(649), column_from_name("YX"));
        assert_eq!(Some(650), column_from_name("YY"));
        assert_eq!(Some(651), column_from_name("AAA"));
        assert_eq!(Some(652), column_from_name("AAB"));
        assert_eq!(Some(-649), column_from_name("ZYX"));
        assert_eq!(Some(-650), column_from_name("ZYY"));
        assert_eq!(Some(-651), column_from_name("ZAAA"));
        assert_eq!(Some(-652), column_from_name("ZAAB"));

        // Test near the integer limits
        assert_eq!(Some(i64::MAX), column_from_name("FDRNAOXLWWEPGG"));
        assert_eq!(Some(i64::MIN), column_from_name("ZFDRNAOXLWWEPGH"));
        assert_eq!(None, column_from_name("FDRNAOXLWWEPGH"));
        assert_eq!(None, column_from_name("XXXXXXXXXXXXXX"));
        assert_eq!(None, column_from_name("ZFDRNAOXLWWEPGI"));
        assert_eq!(None, column_from_name("ZXXXXXXXXXXXXXX"));

        // Test totally invalid columns
        assert_eq!(None, column_from_name("a"));
        assert_eq!(None, column_from_name("z"));
        assert_eq!(None, column_from_name("93"));

        // Test fun stuff
        assert_eq!(Some(2722458231478), column_from_name("QUADRATIC"));
        assert_eq!(Some(1064218308993582274), column_from_name("QUICKBROWNFOX"));
    }
}
