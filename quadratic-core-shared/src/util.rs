use std::fmt;

use crate::{A1Error, UNBOUNDED};

pub mod btreemap_serde {
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

/// Converts a column name to a number.
#[macro_export]
macro_rules! col {
    [$col_name:ident] => {
        $crate::a1::column_from_name(stringify!($col_name)).expect("invalid column name")
    };
}

/// Converts a row name to a number.
#[macro_export]
macro_rules! row {
    [$row_name:ident] => {
        $crate::a1::row_from_name(stringify!($row_name)).expect("invalid row name")
    };
}

/// For debugging both in tests and in the JS console
#[track_caller]
#[allow(unused_variables)]
pub fn dbgjs(_val: impl fmt::Debug) {
    // Note: WASM logging requires wasm-bindgen console bindings which are not
    // available in this crate. Use dbg! for native debugging.
    #[cfg(not(target_family = "wasm"))]
    dbg!(_val);
}

#[allow(unused_macros)]
macro_rules! dbgjs {
    ($($arg:tt)*) => {
        $crate::util::dbgjs($($arg)*)
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
/// # use quadratic_core_shared::{pos, Pos, SheetId};
/// assert_eq!(pos![A1], Pos::new(1, 1));
/// assert_eq!(pos![C418], Pos::new(3, 418));
///
/// // With a sheet ID (identifier)
/// let my_sheet = SheetId::TEST;
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
        $crate::RefRangeBounds::from_str(stringify!($s), None)
            .expect("invalid cell reference")
            .try_to_pos()
            .expect("pos! macro requires a single cell reference, not a range")
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
/// # use quadratic_core_shared::{rect, Rect, SheetId};
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

pub fn offset_cell_coord(initial: i64, delta: i64) -> Result<i64, A1Error> {
    if initial == UNBOUNDED {
        Ok(UNBOUNDED)
    } else {
        match initial.saturating_add(delta) {
            ..=0 => Err(A1Error::InvalidCellReference(format!(
                "Invalid cell reference: {initial} + {delta} is out of bounds"
            ))),
            other => Ok(other),
        }
    }
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

// normalizes the bounds so that the first is always less than the second
pub fn sort_bounds(a: i64, b: Option<i64>) -> (i64, Option<i64>) {
    match b {
        Some(b) if b < a => (b, Some(a)),
        _ => (a, b),
    }
}
