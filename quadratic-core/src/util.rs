use std::fmt;
use std::ops::Range;

use chrono::Utc;
use itertools::Itertools;

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
        $crate::a1::column_from_name(stringify!($col_name)).expect("invalid column name")
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

/// Returns a human-friendly list of things, joined at the end by the given
/// conjunction.
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

/// Returns the minimum and maximum of two values, in that order.
pub fn minmax<T: PartialOrd>(a: T, b: T) -> (T, T) {
    if a > b {
        (b, a)
    } else {
        (a, b)
    }
}
/// Returns the minimum and maximum extent of two values, in that order. `None`
/// is considered the largest possible possible.
pub fn minmax_opt<T: PartialOrd>(a: T, b: Option<T>) -> (T, Option<T>) {
    match b {
        Some(b) => {
            let (lo, hi) = minmax(a, b);
            (lo, Some(hi))
        }
        None => (a, None),
    }
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

pub fn maybe_reverse<I: DoubleEndedIterator>(
    iter: I,
    rev: bool,
) -> itertools::Either<I, std::iter::Rev<I>> {
    if !rev {
        itertools::Either::Left(iter)
    } else {
        itertools::Either::Right(iter.rev())
    }
}

/// For debugging both in tests and in the JS console
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
    fn test_a1_notation_macros() {
        assert_eq!(col![A], 1);
        assert_eq!(col![C], 3);
        assert_eq!(col![AA], 27);

        assert_eq!(pos![A1], crate::Pos { x: 1, y: 1 });
        assert_eq!(pos![A2], crate::Pos { x: 1, y: 2 });

        assert_eq!(pos![C6], crate::Pos { x: 3, y: 6 });
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
