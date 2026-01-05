//! Lookup and reference functions for formulas.

mod reference;
mod search;

use itertools::Itertools;
use regex::Regex;

use super::*;
use crate::ArraySize;

pub use reference::IndexFunctionArgs;

pub const CATEGORY: FormulaFunctionCategory = FormulaFunctionCategory {
    include_in_docs: true,
    include_in_completions: true,
    name: "Lookup functions",
    docs: None,
    get_functions,
};

fn get_functions() -> Vec<FormulaFunction> {
    [search::get_functions(), reference::get_functions()]
        .into_iter()
        .flatten()
        .collect()
}

// ============================================================================
// Lookup helper functions and types (shared by search functions)
// ============================================================================

/// Performs a `LOOKUP` and returns the index of the best match (0-indexed).
pub(super) fn lookup<V: ToString + AsRef<CellValue>>(
    needle: &CellValue,
    haystack: &[V],
    match_mode: LookupMatchMode,
    search_mode: LookupSearchMode,
) -> CodeResult<Option<usize>> {
    let fix_rev_index = |i: usize| haystack.len() - 1 - i;

    let preference = match match_mode {
        LookupMatchMode::Exact => std::cmp::Ordering::Equal,
        LookupMatchMode::NextSmaller => std::cmp::Ordering::Less,
        LookupMatchMode::NextLarger => std::cmp::Ordering::Greater,
        LookupMatchMode::Wildcard => match needle {
            CellValue::Text(needle_string) => {
                let regex = crate::formulas::wildcard_pattern_to_regex(needle_string)?;
                return Ok(match search_mode {
                    LookupSearchMode::LinearForward => lookup_regex(regex, haystack),
                    LookupSearchMode::LinearReverse => {
                        lookup_regex(regex, haystack.iter().rev()).map(fix_rev_index)
                    }
                    LookupSearchMode::BinaryAscending | LookupSearchMode::BinaryDescending => {
                        internal_error!(
                            "invalid match_mode+search_mode combination \
                             should have been caught earlier in XLOOKUP",
                        );
                    }
                });
            }
            _ => std::cmp::Ordering::Equal,
        },
    };

    Ok(match search_mode {
        LookupSearchMode::LinearForward => {
            lookup_linear_search(needle, haystack.iter(), preference)
        }
        LookupSearchMode::LinearReverse => {
            lookup_linear_search(needle, haystack.iter().rev(), preference).map(fix_rev_index)
        }
        LookupSearchMode::BinaryAscending => {
            lookup_binary_search(needle, haystack, preference, |a, b| a.partial_cmp(b))
        }
        LookupSearchMode::BinaryDescending => {
            lookup_binary_search(needle, haystack, preference.reverse(), |a, b| {
                b.partial_cmp(a)
            })
        }
    }
    .filter(|&i| {
        // Only return a match if it's comparable (i.e., the same type).
        haystack
            .get(i)
            .is_some_and(|candidate| candidate.as_ref().type_id() == needle.type_id())
    }))
}

/// Performs a `LOOKUP` using a wildcard and returns the index of the first
/// match.
fn lookup_regex<'a, V: 'a + ToString>(
    needle: Regex,
    haystack: impl IntoIterator<Item = &'a V>,
) -> Option<usize> {
    haystack
        .into_iter()
        .find_position(|candidate| needle.is_match(&candidate.to_string()))
        .map(|(index, _value)| index)
}

fn lookup_linear_search<'a, V: 'a + AsRef<CellValue>>(
    needle: &CellValue,
    haystack: impl IntoIterator<Item = &'a V>,
    preference: std::cmp::Ordering,
) -> Option<usize> {
    let haystack = haystack.into_iter().map(|v| v.as_ref());

    let mut best_match: Option<(usize, &'a CellValue)> = None;

    for candidate @ (index, value) in haystack.enumerate() {
        // Compare the old value to the new one.
        let cmp_result = value.partial_cmp(needle).ok();
        let Some(cmp_result) = cmp_result else {
            continue;
        };

        if cmp_result == std::cmp::Ordering::Equal {
            return Some(index);
        } else if cmp_result == preference {
            if let Some((_, old_best_value)) = best_match {
                // If `value` is closer, then return it instead of
                // `old_best_value`.
                if old_best_value.partial_cmp(value) == Ok(preference) {
                    best_match = Some(candidate);
                }
            } else {
                best_match = Some(candidate);
            }
        }
    }

    best_match.map(|(index, _value)| index)
}

fn lookup_binary_search<V: AsRef<CellValue>>(
    needle: &CellValue,
    haystack: &[V],
    preference: std::cmp::Ordering,
    cmp_fn: fn(&CellValue, &CellValue) -> CodeResult<std::cmp::Ordering>,
) -> Option<usize> {
    // Error behavior doesn't matter too much, since the result is undefined if
    // values aren't sorted. I think Excel assumes errors are greater that the
    // needle but I'm not sure.
    let cmp_fn =
        |candidate: &V| cmp_fn(candidate.as_ref(), needle).unwrap_or(std::cmp::Ordering::Greater);

    match haystack.binary_search_by(cmp_fn) {
        Ok(i) => Some(i),
        Err(i) => match preference {
            std::cmp::Ordering::Less => i.checked_sub(1),
            std::cmp::Ordering::Equal => None,
            std::cmp::Ordering::Greater => (i < haystack.len()).then_some(i),
        },
    }
}

#[derive(Debug, Default, Copy, Clone, PartialEq, Eq, Hash)]
pub(super) enum LookupMatchMode {
    #[default]
    Exact = 0,
    NextSmaller = -1,
    NextLarger = 1,
    Wildcard = 2,
}
impl TryFrom<Option<Spanned<i64>>> for LookupMatchMode {
    type Error = RunError;

    fn try_from(value: Option<Spanned<i64>>) -> Result<Self, Self::Error> {
        match value {
            None => Ok(LookupMatchMode::default()),
            Some(v) => match v.inner {
                0 => Ok(LookupMatchMode::Exact),
                -1 => Ok(LookupMatchMode::NextSmaller),
                1 => Ok(LookupMatchMode::NextLarger),
                2 => Ok(LookupMatchMode::Wildcard),
                _ => Err(RunErrorMsg::InvalidArgument.with_span(v.span)),
            },
        }
    }
}

#[derive(Debug, Default, Copy, Clone, PartialEq, Eq, Hash)]
pub(super) enum LookupSearchMode {
    #[default]
    LinearForward = 1,
    LinearReverse = -1,
    BinaryAscending = 2,
    BinaryDescending = -2,
}
impl LookupSearchMode {
    pub(super) fn from_is_sorted(is_sorted: Option<bool>) -> Self {
        // TODO: the default behavior here may be incorrect.
        match is_sorted {
            Some(false) | None => LookupSearchMode::LinearForward,
            Some(true) => LookupSearchMode::BinaryAscending,
        }
    }
}
impl TryFrom<Option<Spanned<i64>>> for LookupSearchMode {
    type Error = RunError;

    fn try_from(value: Option<Spanned<i64>>) -> Result<Self, Self::Error> {
        match value {
            None => Ok(LookupSearchMode::default()),
            Some(v) => match v.inner {
                1 => Ok(LookupSearchMode::LinearForward),
                -1 => Ok(LookupSearchMode::LinearReverse),
                2 => Ok(LookupSearchMode::BinaryAscending),
                -2 => Ok(LookupSearchMode::BinaryDescending),
                _ => Err(RunErrorMsg::InvalidArgument.with_span(v.span)),
            },
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::Span;

    // ============================================================================
    // Tests for LookupMatchMode
    // ============================================================================

    #[test]
    fn test_lookup_match_mode_try_from_none() {
        let result = LookupMatchMode::try_from(None);
        assert!(result.is_ok());
        assert_eq!(result.unwrap(), LookupMatchMode::Exact);
    }

    #[test]
    fn test_lookup_match_mode_try_from_valid_values() {
        let span = Span::empty(0);

        // 0 = Exact
        let result = LookupMatchMode::try_from(Some(Spanned { span, inner: 0 }));
        assert!(result.is_ok());
        assert_eq!(result.unwrap(), LookupMatchMode::Exact);

        // -1 = NextSmaller
        let result = LookupMatchMode::try_from(Some(Spanned { span, inner: -1 }));
        assert!(result.is_ok());
        assert_eq!(result.unwrap(), LookupMatchMode::NextSmaller);

        // 1 = NextLarger
        let result = LookupMatchMode::try_from(Some(Spanned { span, inner: 1 }));
        assert!(result.is_ok());
        assert_eq!(result.unwrap(), LookupMatchMode::NextLarger);

        // 2 = Wildcard
        let result = LookupMatchMode::try_from(Some(Spanned { span, inner: 2 }));
        assert!(result.is_ok());
        assert_eq!(result.unwrap(), LookupMatchMode::Wildcard);
    }

    #[test]
    fn test_lookup_match_mode_try_from_invalid_values() {
        let span = Span::empty(0);

        for invalid in [-2, 3, 10, -10, 100] {
            let result = LookupMatchMode::try_from(Some(Spanned {
                span,
                inner: invalid,
            }));
            assert!(result.is_err());
            assert_eq!(result.unwrap_err().msg, RunErrorMsg::InvalidArgument);
        }
    }

    // ============================================================================
    // Tests for LookupSearchMode
    // ============================================================================

    #[test]
    fn test_lookup_search_mode_try_from_none() {
        let result = LookupSearchMode::try_from(None);
        assert!(result.is_ok());
        assert_eq!(result.unwrap(), LookupSearchMode::LinearForward);
    }

    #[test]
    fn test_lookup_search_mode_try_from_valid_values() {
        let span = Span::empty(0);

        // 1 = LinearForward
        let result = LookupSearchMode::try_from(Some(Spanned { span, inner: 1 }));
        assert!(result.is_ok());
        assert_eq!(result.unwrap(), LookupSearchMode::LinearForward);

        // -1 = LinearReverse
        let result = LookupSearchMode::try_from(Some(Spanned { span, inner: -1 }));
        assert!(result.is_ok());
        assert_eq!(result.unwrap(), LookupSearchMode::LinearReverse);

        // 2 = BinaryAscending
        let result = LookupSearchMode::try_from(Some(Spanned { span, inner: 2 }));
        assert!(result.is_ok());
        assert_eq!(result.unwrap(), LookupSearchMode::BinaryAscending);

        // -2 = BinaryDescending
        let result = LookupSearchMode::try_from(Some(Spanned { span, inner: -2 }));
        assert!(result.is_ok());
        assert_eq!(result.unwrap(), LookupSearchMode::BinaryDescending);
    }

    #[test]
    fn test_lookup_search_mode_try_from_invalid_values() {
        let span = Span::empty(0);

        for invalid in [0, 3, -3, 10, -10, 100] {
            let result = LookupSearchMode::try_from(Some(Spanned {
                span,
                inner: invalid,
            }));
            assert!(result.is_err());
            assert_eq!(result.unwrap_err().msg, RunErrorMsg::InvalidArgument);
        }
    }

    #[test]
    fn test_lookup_search_mode_from_is_sorted() {
        // None or Some(false) -> LinearForward
        assert_eq!(
            LookupSearchMode::from_is_sorted(None),
            LookupSearchMode::LinearForward
        );
        assert_eq!(
            LookupSearchMode::from_is_sorted(Some(false)),
            LookupSearchMode::LinearForward
        );

        // Some(true) -> BinaryAscending
        assert_eq!(
            LookupSearchMode::from_is_sorted(Some(true)),
            LookupSearchMode::BinaryAscending
        );
    }

    // ============================================================================
    // Tests for lookup() function
    // ============================================================================

    #[test]
    fn test_lookup_exact_match_numbers() {
        let haystack: Vec<CellValue> = vec![1.into(), 2.into(), 3.into(), 4.into(), 5.into()];

        // Exact match found
        let result = lookup(
            &CellValue::from(3),
            &haystack,
            LookupMatchMode::Exact,
            LookupSearchMode::LinearForward,
        );
        assert_eq!(result.unwrap(), Some(2));

        // Exact match not found
        let result = lookup(
            &CellValue::from(6),
            &haystack,
            LookupMatchMode::Exact,
            LookupSearchMode::LinearForward,
        );
        assert_eq!(result.unwrap(), None);
    }

    #[test]
    fn test_lookup_exact_match_strings() {
        let haystack: Vec<CellValue> = vec![
            "apple".into(),
            "banana".into(),
            "cherry".into(),
            "date".into(),
        ];

        // Exact match found (case-insensitive)
        let result = lookup(
            &CellValue::from("BANANA"),
            &haystack,
            LookupMatchMode::Exact,
            LookupSearchMode::LinearForward,
        );
        assert_eq!(result.unwrap(), Some(1));

        // Not found
        let result = lookup(
            &CellValue::from("elderberry"),
            &haystack,
            LookupMatchMode::Exact,
            LookupSearchMode::LinearForward,
        );
        assert_eq!(result.unwrap(), None);
    }

    #[test]
    fn test_lookup_next_smaller() {
        let haystack: Vec<CellValue> = vec![10.into(), 20.into(), 30.into(), 40.into(), 50.into()];

        // Exact match returns that index
        let result = lookup(
            &CellValue::from(30),
            &haystack,
            LookupMatchMode::NextSmaller,
            LookupSearchMode::LinearForward,
        );
        assert_eq!(result.unwrap(), Some(2));

        // Between values returns smaller
        let result = lookup(
            &CellValue::from(25),
            &haystack,
            LookupMatchMode::NextSmaller,
            LookupSearchMode::LinearForward,
        );
        assert_eq!(result.unwrap(), Some(1)); // 20

        // Greater than all returns last
        let result = lookup(
            &CellValue::from(100),
            &haystack,
            LookupMatchMode::NextSmaller,
            LookupSearchMode::LinearForward,
        );
        assert_eq!(result.unwrap(), Some(4)); // 50

        // Smaller than all returns None
        let result = lookup(
            &CellValue::from(5),
            &haystack,
            LookupMatchMode::NextSmaller,
            LookupSearchMode::LinearForward,
        );
        assert_eq!(result.unwrap(), None);
    }

    #[test]
    fn test_lookup_next_larger() {
        let haystack: Vec<CellValue> = vec![10.into(), 20.into(), 30.into(), 40.into(), 50.into()];

        // Exact match returns that index
        let result = lookup(
            &CellValue::from(30),
            &haystack,
            LookupMatchMode::NextLarger,
            LookupSearchMode::LinearForward,
        );
        assert_eq!(result.unwrap(), Some(2));

        // Between values returns larger
        let result = lookup(
            &CellValue::from(25),
            &haystack,
            LookupMatchMode::NextLarger,
            LookupSearchMode::LinearForward,
        );
        assert_eq!(result.unwrap(), Some(2)); // 30

        // Smaller than all returns first
        let result = lookup(
            &CellValue::from(5),
            &haystack,
            LookupMatchMode::NextLarger,
            LookupSearchMode::LinearForward,
        );
        assert_eq!(result.unwrap(), Some(0)); // 10

        // Greater than all returns None
        let result = lookup(
            &CellValue::from(100),
            &haystack,
            LookupMatchMode::NextLarger,
            LookupSearchMode::LinearForward,
        );
        assert_eq!(result.unwrap(), None);
    }

    #[test]
    fn test_lookup_wildcard() {
        let haystack: Vec<CellValue> = vec![
            "apple".into(),
            "banana".into(),
            "blueberry".into(),
            "cherry".into(),
        ];

        // Wildcard with *
        let result = lookup(
            &CellValue::from("b*"),
            &haystack,
            LookupMatchMode::Wildcard,
            LookupSearchMode::LinearForward,
        );
        assert_eq!(result.unwrap(), Some(1)); // banana

        // Wildcard with ?
        let result = lookup(
            &CellValue::from("?pple"),
            &haystack,
            LookupMatchMode::Wildcard,
            LookupSearchMode::LinearForward,
        );
        assert_eq!(result.unwrap(), Some(0)); // apple

        // Wildcard not found
        let result = lookup(
            &CellValue::from("z*"),
            &haystack,
            LookupMatchMode::Wildcard,
            LookupSearchMode::LinearForward,
        );
        assert_eq!(result.unwrap(), None);
    }

    #[test]
    fn test_lookup_wildcard_reverse() {
        let haystack: Vec<CellValue> = vec![
            "apple".into(),
            "banana".into(),
            "blueberry".into(),
            "cherry".into(),
        ];

        // Forward should find banana (first match)
        let result = lookup(
            &CellValue::from("b*"),
            &haystack,
            LookupMatchMode::Wildcard,
            LookupSearchMode::LinearForward,
        );
        assert_eq!(result.unwrap(), Some(1)); // banana

        // Reverse should find blueberry (last match that starts with b)
        let result = lookup(
            &CellValue::from("b*"),
            &haystack,
            LookupMatchMode::Wildcard,
            LookupSearchMode::LinearReverse,
        );
        assert_eq!(result.unwrap(), Some(2)); // blueberry
    }

    #[test]
    fn test_lookup_linear_forward_vs_reverse() {
        let haystack: Vec<CellValue> = vec![1.into(), 2.into(), 3.into(), 2.into(), 1.into()];

        // Forward should find first occurrence
        let result = lookup(
            &CellValue::from(2),
            &haystack,
            LookupMatchMode::Exact,
            LookupSearchMode::LinearForward,
        );
        assert_eq!(result.unwrap(), Some(1));

        // Reverse should find last occurrence
        let result = lookup(
            &CellValue::from(2),
            &haystack,
            LookupMatchMode::Exact,
            LookupSearchMode::LinearReverse,
        );
        assert_eq!(result.unwrap(), Some(3));
    }

    #[test]
    fn test_lookup_binary_ascending() {
        // Sorted ascending
        let haystack: Vec<CellValue> = vec![10.into(), 20.into(), 30.into(), 40.into(), 50.into()];

        // Exact match
        let result = lookup(
            &CellValue::from(30),
            &haystack,
            LookupMatchMode::Exact,
            LookupSearchMode::BinaryAscending,
        );
        assert_eq!(result.unwrap(), Some(2));

        // Not found
        let result = lookup(
            &CellValue::from(25),
            &haystack,
            LookupMatchMode::Exact,
            LookupSearchMode::BinaryAscending,
        );
        assert_eq!(result.unwrap(), None);

        // NextSmaller with binary search
        let result = lookup(
            &CellValue::from(25),
            &haystack,
            LookupMatchMode::NextSmaller,
            LookupSearchMode::BinaryAscending,
        );
        assert_eq!(result.unwrap(), Some(1)); // 20
    }

    #[test]
    fn test_lookup_binary_descending() {
        // Sorted descending
        let haystack: Vec<CellValue> = vec![50.into(), 40.into(), 30.into(), 20.into(), 10.into()];

        // Exact match
        let result = lookup(
            &CellValue::from(30),
            &haystack,
            LookupMatchMode::Exact,
            LookupSearchMode::BinaryDescending,
        );
        assert_eq!(result.unwrap(), Some(2));

        // Not found
        let result = lookup(
            &CellValue::from(25),
            &haystack,
            LookupMatchMode::Exact,
            LookupSearchMode::BinaryDescending,
        );
        assert_eq!(result.unwrap(), None);

        // NextLarger with binary descending
        let result = lookup(
            &CellValue::from(25),
            &haystack,
            LookupMatchMode::NextLarger,
            LookupSearchMode::BinaryDescending,
        );
        assert_eq!(result.unwrap(), Some(2)); // 30
    }

    #[test]
    fn test_lookup_type_mismatch_returns_none() {
        let haystack: Vec<CellValue> = vec![1.into(), 2.into(), 3.into()];

        // Looking for a string in a numeric array should return None
        let result = lookup(
            &CellValue::from("hello"),
            &haystack,
            LookupMatchMode::Exact,
            LookupSearchMode::LinearForward,
        );
        assert_eq!(result.unwrap(), None);
    }

    #[test]
    fn test_lookup_empty_haystack() {
        let haystack: Vec<CellValue> = vec![];

        let result = lookup(
            &CellValue::from(1),
            &haystack,
            LookupMatchMode::Exact,
            LookupSearchMode::LinearForward,
        );
        assert_eq!(result.unwrap(), None);
    }

    #[test]
    fn test_lookup_single_element() {
        let haystack: Vec<CellValue> = vec![42.into()];

        // Match
        let result = lookup(
            &CellValue::from(42),
            &haystack,
            LookupMatchMode::Exact,
            LookupSearchMode::LinearForward,
        );
        assert_eq!(result.unwrap(), Some(0));

        // No match
        let result = lookup(
            &CellValue::from(99),
            &haystack,
            LookupMatchMode::Exact,
            LookupSearchMode::LinearForward,
        );
        assert_eq!(result.unwrap(), None);
    }

    #[test]
    fn test_lookup_with_blanks() {
        let haystack: Vec<CellValue> = vec![CellValue::Blank, 1.into(), CellValue::Blank, 2.into()];

        // Looking for blank
        let result = lookup(
            &CellValue::Blank,
            &haystack,
            LookupMatchMode::Exact,
            LookupSearchMode::LinearForward,
        );
        assert_eq!(result.unwrap(), Some(0));

        // Looking for a value should skip blanks
        let result = lookup(
            &CellValue::from(2),
            &haystack,
            LookupMatchMode::Exact,
            LookupSearchMode::LinearForward,
        );
        assert_eq!(result.unwrap(), Some(3));
    }

    // ============================================================================
    // Tests for lookup_regex() helper
    // ============================================================================

    #[test]
    fn test_lookup_regex_basic() {
        let haystack: Vec<String> = vec![
            "apple".to_string(),
            "banana".to_string(),
            "cherry".to_string(),
        ];

        let regex = Regex::new("^b").unwrap();
        let result = lookup_regex(regex, &haystack);
        assert_eq!(result, Some(1));
    }

    #[test]
    fn test_lookup_regex_not_found() {
        let haystack: Vec<String> = vec![
            "apple".to_string(),
            "banana".to_string(),
            "cherry".to_string(),
        ];

        let regex = Regex::new("^z").unwrap();
        let result = lookup_regex(regex, &haystack);
        assert_eq!(result, None);
    }

    // ============================================================================
    // Tests for lookup_linear_search() helper
    // ============================================================================

    #[test]
    fn test_lookup_linear_search_exact() {
        let haystack: Vec<CellValue> = vec![10.into(), 20.into(), 30.into()];

        let result =
            lookup_linear_search(&CellValue::from(20), &haystack, std::cmp::Ordering::Equal);
        assert_eq!(result, Some(1));
    }

    #[test]
    fn test_lookup_linear_search_prefer_less() {
        let haystack: Vec<CellValue> = vec![10.into(), 20.into(), 30.into()];

        // Looking for 25 with preference for less should return 20 (index 1)
        let result =
            lookup_linear_search(&CellValue::from(25), &haystack, std::cmp::Ordering::Less);
        assert_eq!(result, Some(1));
    }

    #[test]
    fn test_lookup_linear_search_prefer_greater() {
        let haystack: Vec<CellValue> = vec![10.into(), 20.into(), 30.into()];

        // Looking for 25 with preference for greater should return 30 (index 2)
        let result =
            lookup_linear_search(&CellValue::from(25), &haystack, std::cmp::Ordering::Greater);
        assert_eq!(result, Some(2));
    }

    // ============================================================================
    // Tests for lookup_binary_search() helper
    // ============================================================================

    #[test]
    fn test_lookup_binary_search_exact_match() {
        let haystack: Vec<CellValue> = vec![10.into(), 20.into(), 30.into(), 40.into(), 50.into()];

        let result = lookup_binary_search(
            &CellValue::from(30),
            &haystack,
            std::cmp::Ordering::Equal,
            |a, b| a.partial_cmp(b),
        );
        assert_eq!(result, Some(2));
    }

    #[test]
    fn test_lookup_binary_search_prefer_less() {
        let haystack: Vec<CellValue> = vec![10.into(), 20.into(), 30.into(), 40.into(), 50.into()];

        // 25 not found, prefer less -> return 20 (index 1)
        let result = lookup_binary_search(
            &CellValue::from(25),
            &haystack,
            std::cmp::Ordering::Less,
            |a, b| a.partial_cmp(b),
        );
        assert_eq!(result, Some(1));
    }

    #[test]
    fn test_lookup_binary_search_prefer_greater() {
        let haystack: Vec<CellValue> = vec![10.into(), 20.into(), 30.into(), 40.into(), 50.into()];

        // 25 not found, prefer greater -> return 30 (index 2)
        let result = lookup_binary_search(
            &CellValue::from(25),
            &haystack,
            std::cmp::Ordering::Greater,
            |a, b| a.partial_cmp(b),
        );
        assert_eq!(result, Some(2));
    }

    #[test]
    fn test_lookup_binary_search_no_match() {
        let haystack: Vec<CellValue> = vec![10.into(), 20.into(), 30.into()];

        // Looking for 5 (smaller than all) with exact match preference
        let result = lookup_binary_search(
            &CellValue::from(5),
            &haystack,
            std::cmp::Ordering::Equal,
            |a, b| a.partial_cmp(b),
        );
        assert_eq!(result, None);

        // Looking for 5 with Less preference should return None (nothing smaller)
        let result = lookup_binary_search(
            &CellValue::from(5),
            &haystack,
            std::cmp::Ordering::Less,
            |a, b| a.partial_cmp(b),
        );
        assert_eq!(result, None);

        // Looking for 5 with Greater preference should return first element
        let result = lookup_binary_search(
            &CellValue::from(5),
            &haystack,
            std::cmp::Ordering::Greater,
            |a, b| a.partial_cmp(b),
        );
        assert_eq!(result, Some(0));
    }

    #[test]
    fn test_lookup_binary_search_beyond_range() {
        let haystack: Vec<CellValue> = vec![10.into(), 20.into(), 30.into()];

        // Looking for 100 (greater than all) with Greater preference
        let result = lookup_binary_search(
            &CellValue::from(100),
            &haystack,
            std::cmp::Ordering::Greater,
            |a, b| a.partial_cmp(b),
        );
        assert_eq!(result, None);

        // Looking for 100 with Less preference should return last element
        let result = lookup_binary_search(
            &CellValue::from(100),
            &haystack,
            std::cmp::Ordering::Less,
            |a, b| a.partial_cmp(b),
        );
        assert_eq!(result, Some(2));
    }
}
