//! Mimic Excel's criteria in functions such as `SUMIF()`.
//!
//! This entire file feels really janky and awful but this is my best attempt at
//! mimicking the behavior Excel has.

use std::str::FromStr;

use bigdecimal::{BigDecimal, Zero};
use itertools::Itertools;
use regex::Regex;

use super::wildcard_pattern_to_regex;
use crate::{
    Array, CellValue, CodeResult, CoerceInto, RunError, RunErrorMsg, SpannableIterExt, Spanned,
};

#[derive(Debug, Clone)]
pub enum Criterion {
    Regex(Regex),
    NotRegex(Regex),
    Compare {
        compare_fn: CompareFn,
        rhs: CellValue,
    },
}
impl TryFrom<Spanned<&CellValue>> for Criterion {
    type Error = RunError;

    fn try_from(value: Spanned<&CellValue>) -> Result<Self, Self::Error> {
        match &value.inner {
            CellValue::Blank
            | CellValue::Number(_)
            | CellValue::Html(_)
            | CellValue::Code(_)
            | CellValue::Logical(_)
            | CellValue::Instant(_)
            | CellValue::Duration(_) => Ok(Criterion::Compare {
                compare_fn: CompareFn::Eql,
                rhs: value.inner.clone(),
            }),
            CellValue::Text(s) => {
                let (compare_fn, rhs_string) =
                    strip_compare_fn_prefix(s).unwrap_or((CompareFn::Eql, s));
                let rhs = if rhs_string.eq_ignore_ascii_case("TRUE") {
                    CellValue::Logical(true)
                } else if rhs_string.eq_ignore_ascii_case("FALSE") {
                    CellValue::Logical(false)
                } else if let Ok(n) = BigDecimal::from_str(rhs_string) {
                    CellValue::Number(n)
                } else if compare_fn == CompareFn::Eql && rhs_string.contains(['?', '*']) {
                    // If the string doesn't contain any `?` or `*`, then Excel
                    // treats all `~` as literal.
                    return Ok(Self::Regex(wildcard_pattern_to_regex(rhs_string)?));
                } else if compare_fn == CompareFn::Neq && rhs_string.contains(['?', '*']) {
                    return Ok(Self::NotRegex(wildcard_pattern_to_regex(rhs_string)?));
                } else {
                    CellValue::Text(rhs_string.to_string().to_ascii_lowercase())
                };

                Ok(Criterion::Compare { compare_fn, rhs })
            }
            CellValue::Error(e) => Err((**e).clone()),
        }
    }
}
impl Criterion {
    /// Evaluates the criterion on a value and returns whether it matches.
    pub fn matches(&self, value: &CellValue) -> bool {
        match self {
            Criterion::Regex(r) => r.is_match(&value.to_string()),
            Criterion::NotRegex(r) => !r.is_match(&value.to_string()),
            Criterion::Compare { compare_fn, rhs } => match compare_fn {
                // "Not equal" is the only comparison that can return `true` for
                // disparate types.
                CompareFn::Neq => !Self::compare(CompareFn::Eql, value, rhs),

                _ => Self::compare(*compare_fn, value, rhs),
            },
        }
    }

    fn compare(compare_fn: CompareFn, lhs: &CellValue, rhs: &CellValue) -> bool {
        match rhs {
            CellValue::Blank => match lhs {
                CellValue::Number(lhs) => compare_fn.compare(lhs, &BigDecimal::zero()),
                _ => false,
            },
            CellValue::Text(rhs) => compare_fn.compare(&lhs.to_string().to_ascii_lowercase(), rhs),
            CellValue::Number(rhs) => match lhs {
                CellValue::Number(lhs) => compare_fn.compare(lhs, rhs),
                _ => false,
            },
            CellValue::Logical(rhs) => match lhs {
                CellValue::Logical(lhs) => compare_fn.compare(lhs, rhs),
                _ => false,
            },
            CellValue::Instant(rhs) => match lhs {
                CellValue::Instant(lhs) => compare_fn.compare(lhs, rhs),
                _ => false,
            },
            CellValue::Duration(rhs) => match lhs {
                CellValue::Duration(lhs) => compare_fn.compare(lhs, rhs),
                _ => false,
            },
            CellValue::Error(_) => false,
            CellValue::Html(_) => false,
            CellValue::Code(_) => false,
        }
    }

    /// Iterates over values, excluding those that do not match.
    pub fn iter_matching<'a>(
        &'a self,
        eval_range: &'a Spanned<Array>,
        output_values_range: Option<&'a Spanned<Array>>,
    ) -> CodeResult<impl 'a + Iterator<Item = Spanned<&'a CellValue>>> {
        if let Some(range) = output_values_range {
            if range.inner.size() != eval_range.inner.size() {
                return Err(RunErrorMsg::ExactArraySizeMismatch {
                    expected: eval_range.inner.size(),
                    got: range.inner.size(),
                }
                .with_span(range.span));
            }
        }
        let output_values_range = output_values_range.unwrap_or(eval_range);

        Ok(std::iter::zip(
            eval_range.inner.cell_values_slice(),
            output_values_range.inner.cell_values_slice(),
        )
        .filter(|(eval_value, _output_value)| self.matches(eval_value))
        .map(|(_eval_value, output_value)| output_value)
        .with_all_same_span(output_values_range.span))
    }
    /// Iterates over values and coerces each one, excluding those that do not
    /// match or where coercion fails.
    pub fn iter_matching_coerced<'a, T>(
        &'a self,
        eval_range: &'a Spanned<Array>,
        output_values_range: Option<&'a Spanned<Array>>,
    ) -> CodeResult<impl 'a + Iterator<Item = CodeResult<T>>>
    where
        &'a CellValue: TryInto<T>,
    {
        Ok(self
            .iter_matching(eval_range, output_values_range)?
            // Propogate errors
            .map(|v| v.into_non_error_value())
            // Ignore blank values
            .filter_map_ok(|v| v.coerce_nonblank::<T>()))
    }
}

fn strip_compare_fn_prefix(s: &str) -> Option<(CompareFn, &str)> {
    None.or_else(|| s.strip_prefix("==").map(|rest| (CompareFn::Eql, rest)))
        .or_else(|| s.strip_prefix('=').map(|rest| (CompareFn::Eql, rest)))
        .or_else(|| s.strip_prefix("!=").map(|rest| (CompareFn::Neq, rest)))
        .or_else(|| s.strip_prefix("<>").map(|rest| (CompareFn::Neq, rest)))
        .or_else(|| s.strip_prefix("<=").map(|rest| (CompareFn::Lte, rest)))
        .or_else(|| s.strip_prefix(">=").map(|rest| (CompareFn::Gte, rest)))
        .or_else(|| s.strip_prefix('<').map(|rest| (CompareFn::Lt, rest)))
        .or_else(|| s.strip_prefix('>').map(|rest| (CompareFn::Gt, rest)))
}

#[derive(Debug, Default, Copy, Clone, PartialEq, Eq, Hash)]
pub enum CompareFn {
    #[default]
    Eql,
    Neq,
    Lt,
    Gt,
    Lte,
    Gte,
}
impl CompareFn {
    fn compare<L, R>(self, lhs: &L, rhs: &R) -> bool
    where
        L: PartialOrd<R>,
    {
        match self {
            CompareFn::Eql => lhs == rhs,
            CompareFn::Neq => lhs != rhs,
            CompareFn::Lt => lhs < rhs,
            CompareFn::Gt => lhs > rhs,
            CompareFn::Lte => lhs <= rhs,
            CompareFn::Gte => lhs >= rhs,
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn make_criterion(v: impl Into<CellValue>) -> Criterion {
        Criterion::try_from(Spanned::new(0, 0, &v.into())).unwrap()
    }

    fn matches(c: &Criterion, v: impl Into<CellValue>) -> bool {
        c.matches(&v.into())
    }

    #[test]
    fn test_formula_comparison_criteria() {
        // Excel is much more strict than we are about types. At the time this
        // code was written, we don't have a strong type system in Quadratic, so
        // I've commented out tests that would fail right now due to implicit
        // type conversions.

        // Test number (implicit equality)
        let c = make_criterion(1.0);
        assert!(matches(&c, 1.0));
        assert!(!matches(&c, 2.0));
        assert!(!matches(&c, 0.0));
        assert!(!matches(&c, "a string"));
        // assert!(!matches(&c, "1"));
        // assert!(!matches(&c, true));
        assert!(!matches(&c, false));

        // Test boolean (implicit equality)
        let c = make_criterion(true);
        assert!(matches(&c, true));
        assert!(!matches(&c, false));
        assert!(!matches(&c, "a string"));
        assert!(!matches(&c, "1"));
        // assert!(!matches(&c, "true"));
        assert!(!matches(&c, "false"));

        // Test string equality
        for prefix in ["", "=", "=="] {
            let c = make_criterion(format!("{prefix}Blue"));
            assert!(matches(&c, "blue"));
            assert!(matches(&c, "BLUE"));
            assert!(!matches(&c, "green"));
            assert!(!matches(&c, "alpha"));
            assert!(!matches(&c, "bluee"));
            assert!(!matches(&c, "bblue"));
            assert!(!matches(&c, "bbluee"));
            assert!(!matches(&c, 1.0));
            assert!(!matches(&c, true));
            assert!(!matches(&c, false));
        }

        // Test string inequality
        for prefix in ["<>", "!="] {
            let c = make_criterion(format!("{prefix}Blue"));
            assert!(!matches(&c, "blue"));
            assert!(!matches(&c, "BLUE"));
            assert!(matches(&c, "green"));
            assert!(matches(&c, "alpha"));
            assert!(matches(&c, 1.0));
            assert!(matches(&c, true));
            assert!(matches(&c, false));
        }

        // Test boolean comparison against non-boolean values
        for prefix in ["=", "==", "<", ">", "<=", ">="] {
            for value in ["TRUE", "FALSE"] {
                let c = make_criterion(format!("{prefix}{value}"));
                assert!(!matches(&c, "a string"));
                assert!(!matches(&c, 0.0));
                assert!(!matches(&c, 1.0));
            }
        }

        // Test boolean comparison against non-boolean values (not-equal)
        for prefix in ["<>", "!="] {
            for value in ["TRUE", "FALSE"] {
                let c = make_criterion(format!("{prefix}{value}"));
                assert!(matches(&c, "a string"));
                assert!(matches(&c, 0.0));
                assert!(matches(&c, 1.0));
            }
        }

        // Test comparison between booleans
        for (criteria_string, matches_true, matches_false) in [
            ("=TRUE", true, false),
            ("=FALSE", false, true),
            ("<>TRUE", false, true),
            ("<>FALSE", true, false),
            ("<TRUE", false, true),
            ("<FALSE", false, false),
            (">TRUE", false, false),
            (">FALSE", true, false),
            ("<=TRUE", true, true),
            ("<=FALSE", false, true),
            (">=TRUE", true, false),
            (">=FALSE", true, true),
        ] {
            let c = make_criterion(criteria_string);
            assert_eq!(matches_true, matches(&c, true));
            assert_eq!(matches_false, matches(&c, false));
        }

        // Test numeric comparison
        let c = make_criterion("<3");
        assert!(matches(&c, 2.0));
        assert!(!matches(&c, 3.0));
        assert!(!matches(&c, 4.0));
        let c = make_criterion(">=-12");
        assert!(!matches(&c, -13.0));
        assert!(matches(&c, -12.0));
        assert!(matches(&c, 0.0));
        assert!(matches(&c, 4.0));
        let c = make_criterion("<>0");
        assert!(matches(&c, -3.5));
        assert!(matches(&c, 9.0));
        assert!(!matches(&c, 0.0));
        let c = make_criterion("==0");
        assert!(!matches(&c, -3.5));
        assert!(!matches(&c, 9.0));
        assert!(matches(&c, 0.0));

        let strings_in_order = [
            (0, "andrew"),
            (1, "David"),
            (1, "DAVID"),
            (2, "Jim"),
            (3, "peter"),
        ];
        for (i1, s1) in strings_in_order {
            println!("Testing string {s1:?}");

            let c = make_criterion(format!("<{s1}"));
            for (i2, s2) in strings_in_order {
                assert_eq!(i2 < i1, matches(&c, s2));
            }

            let c = make_criterion(format!(">{s1}"));
            for (i2, s2) in strings_in_order {
                assert_eq!(i2 > i1, matches(&c, s2));
            }

            let c = make_criterion(format!("<={s1}"));
            for (i2, s2) in strings_in_order {
                assert_eq!(i2 <= i1, matches(&c, s2));
            }

            let c = make_criterion(format!(">={s1}"));
            for (i2, s2) in strings_in_order {
                assert_eq!(i2 >= i1, matches(&c, s2));
            }
        }
    }

    #[test]
    fn test_formula_wildcards() {
        fn test_wildcard(
            criteria_string: &str,
            inputs_to_match: &[&str],
            inputs_to_not_match: &[&str],
        ) {
            println!("Testing criteria string {criteria_string:?}");
            let c1 = make_criterion(criteria_string);
            let c2 = make_criterion(format!("={criteria_string}"));
            let c3 = make_criterion(format!("=={criteria_string}"));
            let c4 = make_criterion(format!("<>{criteria_string}"));
            let c5 = make_criterion(format!("!={criteria_string}"));
            for &input in inputs_to_match {
                println!("... against input {input:?} (should match)");
                assert!(matches(&c1, input));
                assert!(matches(&c2, input));
                assert!(matches(&c3, input));
                assert!(!matches(&c4, input));
                assert!(!matches(&c5, input));
            }
            for &input in inputs_to_not_match {
                println!("... against input {input:?} (should reject)");
                assert!(!matches(&c1, input));
                assert!(!matches(&c2, input));
                assert!(!matches(&c3, input));
                assert!(matches(&c4, input));
                assert!(matches(&c5, input));
            }
        }

        // Test `?` on its own
        test_wildcard(
            "DEFEN?E",
            &["defence", "defense"],
            &["defenestrate", "defene"],
        );

        // Test `*` on its own
        test_wildcard("*ATE", &["ate", "inflate", "late"], &["wait"]);

        // Test `?` and `*` together
        test_wildcard(
            "A*B?C",
            &["ab~c", "abbc", "aqbqqb_c", "aqbqqb_c"],
            &["ab~~c", "abc", "ab~bc"],
        );

        // Test literal `~` with no escaping
        test_wildcard("a~b", &["a~b"], &["a_b", "ab"]);

        // Test escaping of `?` and `*`
        test_wildcard("A~?B", &["A?B"], &["A~?B", "A~qB", "AqB"]);
        test_wildcard("A~*B", &["A*B"], &["A~*B", "A~qB", "AqB"]);
        test_wildcard("HELLO~?", &["Hello?"], &["Hello", "Hello!", "Hello~?"]);

        // Test escaping of `~` (a single extra trailing `~` is ignored)
        test_wildcard("~*", &["*"], &["~*"]);
        test_wildcard("~*~", &["*"], &["~*"]);
        test_wildcard("~*~~", &["*~"], &["*", "*~~"]);
        test_wildcard("~*~~~", &["*~"], &["*", "*~~"]);
        test_wildcard("~*~~~~", &["*~~"], &["*~", "*~~~"]);
        test_wildcard("~*~~~~~", &["*~~"], &["*~", "*~~~"]);
        test_wildcard("~*~~~~~~", &["*~~~"], &["*~~", "*~~~~"]);
        test_wildcard(
            "HELLO ~~?",
            &["hello ~Q", "hello ~R", "hello ~?"],
            &["hello qq"],
        );
    }
}
