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
