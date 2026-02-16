use std::fmt;
use std::ops::Range;
use std::panic::{AssertUnwindSafe, catch_unwind};

use chrono::{DateTime, Utc};
use itertools::Itertools;
use lazy_static::lazy_static;
use regex::Regex;

use crate::RefError;
use crate::a1::UNBOUNDED;

lazy_static! {
    pub static ref MATCH_NUMBERS: Regex = Regex::new(r"\d+$").expect("regex should compile");
}

pub(crate) fn is_false(value: &bool) -> bool {
    !(*value)
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
        $crate::a1::column_from_name(stringify!($col_name)).expect("invalid column name")
    };
}

/// Converts a row name to a number.
#[allow(unused)]
macro_rules! row {
    [$row_name:ident] => {
        $crate::a1::row_from_name(stringify!($row_name)).expect("invalid row name")
    };
}

/// Parses a cell position in A1 notation.
///
/// Expressions evaluating to sheet IDs are allowed but must be surrounded in
/// parentheses if they are anything other than a single identifier.
///
/// # Examples
///
/// ```
/// # use quadratic_core::{pos, Pos, grid::SheetId};
/// assert_eq!(pos![A1], Pos::new(1, 1));
/// assert_eq!(pos![C418], Pos::new(3, 418));
///
/// // With a sheet ID (identifier)
/// let my_sheet = SheetId::new();
/// assert_eq!(pos![my_sheet!A1], Pos::new(1, 1).to_sheet_pos(my_sheet));
///
/// // With a sheet ID (arbitrary expression)
/// let some_tuple = (10, 20, my_sheet);
/// assert_eq!(pos![(some_tuple.2)!B3], Pos::new(2, 3).to_sheet_pos(some_tuple.2));
/// ```
#[macro_export]
macro_rules! pos {
    [$sheet_id:ident ! $s:ident] => { pos![($sheet_id) ! $s] };
    [($sheet_id:expr) ! $s:ident] => { pos![$s].to_sheet_pos($sheet_id) };
    [$sheet_id:ident ! $col:expr, $row:expr] => { pos![$col, $row].to_sheet_pos($sheet_id) };
    [$col:expr, $row:expr] => { $crate::Pos::new($col, $row) };
    [$s:ident] => {{
        #[allow(unused_assignments, unused_variables)]
        let pos = $crate::formulas::legacy_cell_ref::CellRef::parse_a1(stringify!($s), $crate::Pos::ORIGIN)
            .expect("invalid cell reference")
            .resolve_from($crate::Pos::ORIGIN);
        pos
    }};
}

/// Parses a cell rectangle in A1 notation.
///
/// Expressions evaluating to sheet IDs are allowed but must be surrounded in
/// parentheses if they are anything other than a single identifier.
///
/// # Examples
///
/// ```
/// # use quadratic_core::{rect, Rect, grid::SheetId};
/// assert_eq!(rect![A1:A1], Rect::new(1, 1, 1, 1));
/// assert_eq!(rect![C6:D24], Rect::new(3, 6, 4, 24));
/// assert_eq!(rect![C24:D6], Rect::new(3, 6, 4, 24));
///
/// // With a sheet ID (identifier)
/// let my_sheet = SheetId::new();
/// assert_eq!(rect![my_sheet!A1:C3], Rect::new(1, 1, 3, 3).to_sheet_rect(my_sheet));
///
/// // With a sheet ID (arbitrary expression)
/// let some_tuple = (10, 20, my_sheet);
/// assert_eq!(rect![(some_tuple.2)!A1:C3], Rect::new(1, 1, 3, 3).to_sheet_rect(some_tuple.2));
/// ```
#[macro_export]
macro_rules! rect {
    [$sheet_id:ident ! $corner1:ident : $corner2:ident] => { rect![($sheet_id) ! $corner1 : $corner2] };
    [($sheet_id:expr) ! $corner1:ident : $corner2:ident] => { rect![$corner1 : $corner2].to_sheet_rect($sheet_id) };
    ($corner1:ident : $corner2:ident) => {
        $crate::Rect::new_span($crate::pos![$corner1], $crate::pos![$corner2])
    };
}

/// Parses a cell reference range in A1 notation.
///
/// # Examples
///
/// ```
/// # use quadratic_core::{ref_range_bounds, a1::{RefRangeBounds, CellRefRangeEnd, CellRefCoord}};
/// assert_eq!(ref_range_bounds![:$C], RefRangeBounds {
///     start: CellRefRangeEnd::new_relative_xy(1, 1),
///     end: CellRefRangeEnd {
///         col: CellRefCoord::new_abs(3),
///         row: CellRefCoord::ABS_UNBOUNDED,
///     },
/// });
/// ```
#[macro_export]
macro_rules! ref_range_bounds {
    ($($tok:tt)*) => {
        $crate::a1::RefRangeBounds::from_str(stringify!($($tok)*), None)
            .expect("invalid range")
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
    if a > b { (b, a) } else { (a, b) }
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
        .next_back();

    // Find the last number
    let i = match last_number {
        Some(i) => i + 1,
        None => 1,
    };
    format!("{prefix}{i}")
}

/// Returns a unique name by appending numbers to the base name if the name is not unique.
/// Starts at 1, and checks if the name is unique, then 2, etc.
/// If `require_number` is true, the name will always have an appended number.
pub fn unique_name<'a>(
    name: &str,
    require_number: bool,
    check_name: impl Fn(&str) -> bool,
    mut iter_names: impl Iterator<Item = &'a String>,
) -> String {
    let base = MATCH_NUMBERS.replace(name, "");
    let contains_number = base != name;
    let should_short_circuit = !require_number || contains_number;

    // short circuit if the name is unique
    if should_short_circuit && check_name(name) {
        return name.to_string();
    }

    // if not unique, try appending numbers until we find a unique name

    // Find the highest existing number
    let base_folded = case_fold_ascii(&base);
    let mut num = iter_names
        .find_map(|name| {
            if name.len() > base_folded.len() && name.starts_with(&base_folded) {
                MATCH_NUMBERS
                    .find(name)?
                    .as_str()
                    .trim()
                    .parse::<usize>()
                    .ok()
            } else {
                None
            }
        })
        .map_or(1, |n| n + 1);

    let mut name = String::from("");

    while name.is_empty() {
        let new_name = format!("{base}{num}");
        let new_name_alt = format!("{base} {num}");
        let new_names = [new_name.as_str(), new_name_alt.as_str()];

        if new_names.iter().all(|name| check_name(name)) {
            name = new_name;
        }

        num += 1;
    }

    name
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

pub fn offset_cell_coord(initial: i64, delta: i64) -> Result<i64, RefError> {
    if initial == UNBOUNDED {
        Ok(UNBOUNDED)
    } else {
        match initial.saturating_add(delta) {
            ..=0 => Err(RefError),
            other => Ok(other),
        }
    }
}

/// For debugging both in tests and in the JS console
#[track_caller]
pub fn dbgjs(_val: impl fmt::Debug) {
    #[cfg(all(target_family = "wasm", feature = "dbgjs"))]
    crate::wasm_bindings::js::log(&(format!("{:?}", _val)));

    #[cfg(all(not(target_family = "wasm"), feature = "dbgjs"))]
    dbg!(_val);
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

/// Uppercase ascii-only string suitable for case-insensitive comparison.
pub fn case_fold_ascii(s: &str) -> String {
    s.to_ascii_uppercase()
}

/// Uppercase ascii-only string suitable for case-insensitive comparison.
pub fn case_fold_ascii_in_place(s: &mut str) {
    s.make_ascii_uppercase();
}

/// Runs a closure, catching any panics and converting them to
/// `anyhow::Result`. Useful for calling into libraries (e.g. calamine) that
/// may panic on malformed or very large inputs in WASM.
pub fn catch_panic<T>(f: impl FnOnce() -> anyhow::Result<T>) -> anyhow::Result<T> {
    match catch_unwind(AssertUnwindSafe(f)) {
        Ok(result) => result,
        Err(panic_info) => {
            let msg = panic_info
                .downcast_ref::<String>()
                .map(|s| s.as_str())
                .or_else(|| panic_info.downcast_ref::<&str>().copied())
                .unwrap_or("unknown error");
            Err(anyhow::anyhow!("{msg}"))
        }
    }
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

// normalizes the bounds so that the first is always less than the second
pub fn sort_bounds(a: i64, b: Option<i64>) -> (i64, Option<i64>) {
    match b {
        Some(b) if b < a => (b, Some(a)),
        _ => (a, b),
    }
}

// Returns the current UTC time.
pub fn now() -> DateTime<Utc> {
    #[cfg(target_family = "wasm")]
    {
        DateTime::from_timestamp_millis(crate::wasm_bindings::js::jsTimestamp() as i64).unwrap()
    }
    #[cfg(not(target_family = "wasm"))]
    {
        Utc::now()
    }
}

#[allow(unused)]
macro_rules! print_sheet {
    ($gc:expr, $sheet_id:expr) => {
        let sheet = $gc.try_sheet($sheet_id).unwrap();
        $crate::test_util::print_sheet::print_sheet(sheet);
    };
}

#[allow(unused)]
macro_rules! print_first_sheet {
    ($gc:expr) => {
        let sheet = $gc.try_sheet($gc.sheet_ids()[0]).unwrap();
        $crate::test_util::print_sheet::print_sheet(sheet);
    };
}

#[cfg(test)]
#[track_caller]
pub(crate) fn assert_f64_approx_eq(expected: f64, actual: f64, message: &str) {
    const EPSILON: f64 = 0.0001;

    assert!(
        (expected - actual).abs() < EPSILON,
        "{message}: expected {expected} but got {actual}"
    );
}
#[cfg(test)]
mod tests {
    use crate::a1::{CellRefCoord, CellRefRangeEnd, RefRangeBounds};
    use crate::ref_range_bounds;

    use super::*;

    #[test]
    fn test_a1_notation_macros() {
        assert_eq!(col![A], 1);
        assert_eq!(col![C], 3);
        assert_eq!(col![AA], 27);

        assert_eq!(pos![A1], crate::Pos { x: 1, y: 1 });
        assert_eq!(pos![A2], crate::Pos { x: 1, y: 2 });

        assert_eq!(pos![C6], crate::Pos { x: 3, y: 6 });
    }

    #[test]
    fn test_date_string() {
        assert_eq!(date_string().len(), 19);
    }

    #[test]
    fn test_round() {
        assert_eq!(round(1.23456789, 0), 1.0);
        assert_eq!(round(1.23456789, 1), 1.2);
        assert_eq!(round(1.23456789, 2), 1.23);
        assert_eq!(round(1.23456789, 3), 1.235);
        assert_eq!(round(1.23456789, 4), 1.2346);
    }

    #[test]
    fn test_unused_name() {
        let used = ["Sheet1", "Sheet2"];
        assert_eq!(unused_name("Sheet", &used), "Sheet3");
        let used = ["Sheet2", "Sheet3"];
        assert_eq!(unused_name("Sheet", &used), "Sheet4");
    }

    #[test]
    fn test_ref_range_bounds() {
        assert_eq!(
            ref_range_bounds![:$C],
            RefRangeBounds {
                start: CellRefRangeEnd::new_relative_xy(1, 1),
                end: CellRefRangeEnd {
                    col: CellRefCoord::new_abs(3),
                    row: CellRefCoord::ABS_UNBOUNDED,
                },
            }
        );
    }
}
