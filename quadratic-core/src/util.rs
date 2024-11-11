use std::fmt;
use std::ops::Range;

use chrono::Utc;
use itertools::Itertools;
use lazy_static::lazy_static;
use regex::Regex;

lazy_static! {
    pub static ref MATCH_NUMBERS: Regex = Regex::new(r"\d+$").expect("regex should compile");
}

pub(crate) mod btreemap_serde {
    use std::collections::{BTreeMap, HashMap};

    use serde::ser::SerializeMap;
    use serde::{Deserialize, Deserializer, Serialize, Serializer};

    pub fn serialize<S: Serializer, K: Serialize, V: Serialize>(
        map: &BTreeMap<K, V>,
        s: S,
    ) -> Result<S::Ok, S::Error> {
        let mut m = s.serialize_map(Some(map.len()))?;
        for (k, v) in map {
            m.serialize_entry(&serde_json::to_string(k).unwrap(), v)?;
        }
        m.end()
    }
    pub fn deserialize<
        'de,
        D: Deserializer<'de>,
        K: for<'k> Deserialize<'k> + Ord,
        V: Deserialize<'de>,
    >(
        d: D,
    ) -> Result<BTreeMap<K, V>, D::Error> {
        Ok(HashMap::<String, V>::deserialize(d)?
            .into_iter()
            .map(|(k, v)| (serde_json::from_str(&k).unwrap(), v))
            .collect())
    }
}

pub(crate) mod indexmap_serde {
    use std::collections::HashMap;
    use std::hash::Hash;

    use indexmap::IndexMap;
    use serde::ser::SerializeMap;
    use serde::{Deserialize, Deserializer, Serialize, Serializer};

    pub fn serialize<S: Serializer, K: Serialize, V: Serialize>(
        map: &IndexMap<K, V>,
        s: S,
    ) -> Result<S::Ok, S::Error> {
        let mut m = s.serialize_map(Some(map.len()))?;
        for (k, v) in map {
            if let Ok(key) = serde_json::to_string(k) {
                m.serialize_entry(&key, v)?;
            }
        }
        m.end()
    }
    pub fn deserialize<
        'de,
        D: Deserializer<'de>,
        K: for<'k> Deserialize<'k> + Ord + Hash,
        V: Deserialize<'de>,
    >(
        d: D,
    ) -> Result<IndexMap<K, V>, D::Error> {
        Ok(HashMap::<String, V>::deserialize(d)?
            .into_iter()
            .filter_map(|(k, v)| {
                if let Ok(key) = serde_json::from_str(&k) {
                    Some((key, v))
                } else {
                    None
                }
            })
            .collect())
    }
}

/// Converts a column name to a number.
#[allow(unused)]
macro_rules! col {
    [$col_name:ident] => {
        $crate::util::column_from_name(stringify!($col_name)).expect("invalid column name")
    };
}

/// Parses a cell position in A1 notation.
#[allow(unused)]
macro_rules! pos {
    [$s:ident] => {
        $crate::formulas::CellRef::parse_a1(stringify!($s), $crate::Pos::ORIGIN)
            .expect("invalid cell reference")
            .resolve_from(crate::Pos::ORIGIN)
    };
}

/// Returns a column's name from its number.
pub fn column_name(mut n: i64) -> String {
    let negative = n < 0;
    if negative {
        n = -(n + 1);
    }

    let mut chars = vec![];
    loop {
        let i = n % 26;
        chars.push(b"ABCDEFGHIJKLMNOPQRSTUVWXYZ"[i as usize]);
        n /= 26;
        if n <= 0 {
            break;
        }
        n -= 1;
    }
    if negative {
        // push byte literal of single character `n`
        chars.push(b'n');
    }

    chars.into_iter().rev().map(|c| c as char).collect()
}
/// Returns a column number from a name, or `None` if it is invalid or out of range.
pub fn column_from_name(mut s: &str) -> Option<i64> {
    let negative = s.starts_with('n');
    if let Some(rest) = s.strip_prefix('n') {
        s = rest;
    }

    fn digit(c: char) -> Option<i64> {
        c.is_ascii_uppercase().then_some(c as i64 - 'A' as i64)
    }

    let mut chars = s.chars();
    let mut ret = digit(chars.next()?)?;
    for char in chars {
        ret = ret
            .checked_add(1)?
            .checked_mul(26)?
            .checked_add(digit(char)?)?;
    }

    if negative {
        ret = -ret - 1;
    }

    Some(ret)
}

/// Returns a row's name from its number.
pub fn row_name(n: i64) -> String {
    let negative = n < 0;

    match negative {
        true => format!("n{}", -n),
        false => format!("{}", n),
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

pub fn union_ranges(ranges: impl IntoIterator<Item = Option<Range<i64>>>) -> Option<Range<i64>> {
    ranges
        .into_iter()
        .flatten()
        .reduce(|a, b| std::cmp::min(a.start, b.start)..std::cmp::max(a.end, b.end))
}

pub fn unused_name(prefix: &str, already_used: &[&str]) -> String {
    let last_number: Option<usize> = already_used
        .iter()
        .filter_map(|s| s.strip_prefix(prefix)?.trim().parse().ok())
        .sorted()
        .last();

    // Find the last number
    let i = match last_number {
        Some(i) => i + 1,
        None => 1,
    };
    format!("{prefix} {i}")
}

/// Returns a unique name by appending numbers to the base name if the name is not unique.
/// Starts at 1, and checks if the name is unique, then 2, etc.
/// If `require_number` is true, the name will always have an appended number.
pub fn unique_name(name: &str, all_names: &[String], require_number: bool) -> String {
    let base = MATCH_NUMBERS.replace(name, "");
    let contains_number = base != name;
    let should_short_circuit = !require_number || contains_number;

    // short circuit if the name is unique
    if should_short_circuit && !all_names.contains(&name.to_owned()) {
        return name.to_string();
    }

    // if not unique, try appending numbers until we find a unique name
    let mut num = 1;
    let mut name = String::from("");

    while name.is_empty() {
        let new_name = format!("{}{}", base, num);
        let new_name_alt = format!("{} {}", base, num);
        let new_names = [new_name.as_str(), new_name_alt.as_str()];

        if !all_names
            .iter()
            .any(|item| new_names.contains(&item.as_str()))
        {
            name = new_name;
        }

        num += 1;
    }

    name
}

pub fn maybe_reverse_range(
    range: Range<i64>,
    rev: bool,
) -> itertools::Either<impl Iterator<Item = i64>, impl Iterator<Item = i64>> {
    if !rev {
        itertools::Either::Left(range)
    } else {
        itertools::Either::Right(range.rev())
    }
}

/// For debugging both in tests and in the JS console
#[track_caller]
pub fn dbgjs(val: impl fmt::Debug) {
    if cfg!(target_family = "wasm") {
        crate::wasm_bindings::js::log(&(format!("{:?}", val)));
    } else {
        dbg!(val);
    }
}

#[allow(unused_macros)]
macro_rules! dbgjs {
    ($($arg:tt)*) => {
        $crate::util::dbgjs($($arg)*)
    };
}

#[allow(unused_macros)]
macro_rules! jsTime {
    ($($arg:tt)*) => {
        if cfg!(target_family = "wasm") {
            $crate::wasm_bindings::js::jsTime($($arg)*)
        }
    };
}

#[allow(unused_macros)]
macro_rules! jsTimeEnd {
    ($($arg:tt)*) => {
        if cfg!(target_family = "wasm") {
            $crate::wasm_bindings::js::jsTimeEnd($($arg)*);
        }
    };
}

pub fn date_string() -> String {
    let now = Utc::now();
    now.format("%Y-%m-%d %H:%M:%S").to_string()
}

pub fn round(number: f64, precision: i64) -> f64 {
    let y = 10i32.pow(precision as u32) as f64;
    (number * y).round() / y
}

/// Returns a string suitable for case-insensitive comparison.
pub fn case_fold(s: &str) -> String {
    s.to_uppercase() // TODO: want proper Unicode case folding
}

pub fn set_panic_hook() {
    // When the `console_error_panic_hook` feature is enabled, we can call the
    // `set_panic_hook` function at least once during initialization, and then
    // we will get better error messages if our code ever panics.
    //
    // For more details see
    // https://github.com/rustwasm/console_error_panic_hook#readme
    #[cfg(feature = "console_error_panic_hook")]
    console_error_panic_hook::set_once();
}

#[cfg(test)]
pub(crate) fn assert_f64_approx_eq(expected: f64, actual: &str) {
    const EPSILON: f64 = 0.0001;

    let actual = actual.parse::<f64>().unwrap();
    assert!(
        (expected - actual).abs() < EPSILON,
        "expected {expected} but got {actual}",
    );
}
#[cfg(test)]
mod tests {
    use super::*;
    use serial_test::parallel;

    #[test]
    #[parallel]
    fn test_column_names() {
        // Test near 0
        assert_eq!("A", column_name(0));
        assert_eq!("B", column_name(1));
        assert_eq!("C", column_name(2));
        assert_eq!("D", column_name(3));
        assert_eq!("E", column_name(4));
        assert_eq!("F", column_name(5));

        assert_eq!("nA", column_name(-1));
        assert_eq!("nB", column_name(-2));
        assert_eq!("nC", column_name(-3));
        assert_eq!("nD", column_name(-4));
        assert_eq!("nE", column_name(-5));
        assert_eq!("nF", column_name(-6));

        // Test near ±26
        assert_eq!("Y", column_name(24));
        assert_eq!("Z", column_name(25));
        assert_eq!("AA", column_name(26));
        assert_eq!("AB", column_name(27));
        assert_eq!("nY", column_name(-25));
        assert_eq!("nZ", column_name(-26));
        assert_eq!("nAA", column_name(-27));
        assert_eq!("nAB", column_name(-28));

        // Test near ±52
        assert_eq!("AY", column_name(50));
        assert_eq!("AZ", column_name(51));
        assert_eq!("BA", column_name(52));
        assert_eq!("BB", column_name(53));
        assert_eq!("nAY", column_name(-51));
        assert_eq!("nAZ", column_name(-52));
        assert_eq!("nBA", column_name(-53));
        assert_eq!("nBB", column_name(-54));

        // Test near ±702
        assert_eq!("ZY", column_name(700));
        assert_eq!("ZZ", column_name(701));
        assert_eq!("AAA", column_name(702));
        assert_eq!("AAB", column_name(703));
        assert_eq!("nZY", column_name(-701));
        assert_eq!("nZZ", column_name(-702));
        assert_eq!("nAAA", column_name(-703));
        assert_eq!("nAAB", column_name(-704));

        // Test near the integer limits
        assert_eq!("CRPXNLSKVLJFHH", column_name(i64::MAX));
        assert_eq!("nCRPXNLSKVLJFHH", column_name(i64::MIN));

        // Test fun stuff
        assert_eq!("QUADRATIC", column_name(3719092809668));
        assert_eq!("nQUADRATIC", column_name(-3719092809669));
        assert_eq!("QUICKBROWNFOX", column_name(1700658608758053877));
    }

    #[test]
    #[parallel]
    fn test_from_column_names() {
        // Test near 0
        assert_eq!(Some(0), column_from_name("A"));
        assert_eq!(Some(1), column_from_name("B"));
        assert_eq!(Some(2), column_from_name("C"));
        assert_eq!(Some(3), column_from_name("D"));
        assert_eq!(Some(4), column_from_name("E"));
        assert_eq!(Some(5), column_from_name("F"));

        assert_eq!(Some(-1), column_from_name("nA"));
        assert_eq!(Some(-2), column_from_name("nB"));
        assert_eq!(Some(-3), column_from_name("nC"));
        assert_eq!(Some(-4), column_from_name("nD"));
        assert_eq!(Some(-5), column_from_name("nE"));
        assert_eq!(Some(-6), column_from_name("nF"));

        // Test near ±26
        assert_eq!(Some(24), column_from_name("Y"));
        assert_eq!(Some(25), column_from_name("Z"));
        assert_eq!(Some(26), column_from_name("AA"));
        assert_eq!(Some(27), column_from_name("AB"));
        assert_eq!(Some(-25), column_from_name("nY"));
        assert_eq!(Some(-26), column_from_name("nZ"));
        assert_eq!(Some(-27), column_from_name("nAA"));
        assert_eq!(Some(-28), column_from_name("nAB"));

        // Test near ±52
        assert_eq!(Some(50), column_from_name("AY"));
        assert_eq!(Some(51), column_from_name("AZ"));
        assert_eq!(Some(52), column_from_name("BA"));
        assert_eq!(Some(53), column_from_name("BB"));
        assert_eq!(Some(-51), column_from_name("nAY"));
        assert_eq!(Some(-52), column_from_name("nAZ"));
        assert_eq!(Some(-53), column_from_name("nBA"));
        assert_eq!(Some(-54), column_from_name("nBB"));

        // Test near ±702
        assert_eq!(Some(700), column_from_name("ZY"));
        assert_eq!(Some(701), column_from_name("ZZ"));
        assert_eq!(Some(702), column_from_name("AAA"));
        assert_eq!(Some(703), column_from_name("AAB"));
        assert_eq!(Some(-701), column_from_name("nZY"));
        assert_eq!(Some(-702), column_from_name("nZZ"));
        assert_eq!(Some(-703), column_from_name("nAAA"));
        assert_eq!(Some(-704), column_from_name("nAAB"));

        // Test near the integer limits
        assert_eq!(Some(i64::MAX), column_from_name("CRPXNLSKVLJFHH"));
        assert_eq!(Some(i64::MIN), column_from_name("nCRPXNLSKVLJFHH"));
        assert_eq!(None, column_from_name("CRPXNLSKVLJFHI"));
        assert_eq!(None, column_from_name("XXXXXXXXXXXXXX"));
        assert_eq!(None, column_from_name("nCRPXNLSKVLJFHI"));
        assert_eq!(None, column_from_name("nXXXXXXXXXXXXXX"));

        // Test totally invalid columns
        assert_eq!(None, column_from_name("a"));
        assert_eq!(None, column_from_name("z"));
        assert_eq!(None, column_from_name("n"));
        assert_eq!(None, column_from_name("AnZ"));
        assert_eq!(None, column_from_name("nnB"));
        assert_eq!(None, column_from_name("93"));

        // Test fun stuff
        assert_eq!(Some(3719092809668), column_from_name("QUADRATIC"));
        assert_eq!(Some(1700658608758053877), column_from_name("QUICKBROWNFOX"));
    }

    #[test]
    #[parallel]
    fn test_a1_notation_macros() {
        assert_eq!(col![A], 0);
        assert_eq!(col![C], 2);
        assert_eq!(col![nC], -3);

        assert_eq!(pos![A0], crate::Pos { x: 0, y: 0 });
        assert_eq!(pos![A1], crate::Pos { x: 0, y: 1 });

        assert_eq!(pos![C6], crate::Pos { x: 2, y: 6 });
        assert_eq!(pos![Cn6], crate::Pos { x: 2, y: -6 });
        assert_eq!(pos![nC6], crate::Pos { x: -3, y: 6 });
        assert_eq!(pos![nCn6], crate::Pos { x: -3, y: -6 });
    }

    #[test]
    #[parallel]
    fn test_date_string() {
        assert_eq!(date_string().len(), 19);
    }

    #[test]
    #[parallel]
    fn test_round() {
        assert_eq!(round(1.23456789, 0), 1.0);
        assert_eq!(round(1.23456789, 1), 1.2);
        assert_eq!(round(1.23456789, 2), 1.23);
        assert_eq!(round(1.23456789, 3), 1.235);
        assert_eq!(round(1.23456789, 4), 1.2346);
    }

    #[test]
    #[parallel]
    fn test_unused_name() {
        let used = ["Sheet 1", "Sheet 2"];
        assert_eq!(unused_name("Sheet", &used), "Sheet 3");
        let used = ["Sheet 2", "Sheet 3"];
        assert_eq!(unused_name("Sheet", &used), "Sheet 4");
    }
}
