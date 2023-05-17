//! Mimic Excel's criteria in functions such as `SUMIF()`.
//!
//! This entire file feels really janky and awful but this is my best the
//! behavior Excel has.

use regex::{Regex, RegexBuilder};

use super::{FormulaError, FormulaErrorMsg, Spanned, Value};

#[derive(Debug, Clone)]
pub enum Criterion {
    Regex(Regex),
    NotRegex(Regex),
    Compare { compare_fn: CompareFn, rhs: Value },
}
impl TryFrom<&Spanned<Value>> for Criterion {
    type Error = FormulaError;

    fn try_from(value: &Spanned<Value>) -> Result<Self, Self::Error> {
        match &value.inner {
            Value::String(s) => {
                let (compare_fn, rhs_string) =
                    strip_compare_fn_prefix(s).unwrap_or((CompareFn::Eql, s));
                let rhs = if rhs_string.eq_ignore_ascii_case("TRUE") {
                    Value::Bool(true)
                } else if rhs_string.eq_ignore_ascii_case("FALSE") {
                    Value::Bool(false)
                } else if let Ok(n) = rhs_string.parse::<f64>() {
                    Value::Number(n)
                } else if compare_fn == CompareFn::Eql && rhs_string.contains(['?', '*']) {
                    // If the string doesn't contain any `?` or `*`, then Excel
                    // treats all `~` as literal.
                    return Ok(Self::Regex(wildcard_pattern_to_regex(rhs_string)?));
                } else if compare_fn == CompareFn::Neq && rhs_string.contains(['?', '*']) {
                    return Ok(Self::NotRegex(wildcard_pattern_to_regex(rhs_string)?));
                } else {
                    Value::String(rhs_string.to_string().to_ascii_lowercase())
                };

                Ok(Criterion::Compare { compare_fn, rhs })
            }
            Value::Number(_) | Value::Bool(_) => Ok(Criterion::Compare {
                compare_fn: CompareFn::Eql,
                rhs: value.inner.clone(),
            }),
            Value::Array(_) | Value::MissingErr => Err(FormulaErrorMsg::Expected {
                expected: "comparable value (string, number, etc.)".into(),
                got: Some(value.inner.type_name().into()),
            }
            .with_span(value.span)),
        }
    }
}
impl Criterion {
    /// Evaluates the criterion on a value and returns whether it matches.
    pub fn matches(&self, value: &Value) -> bool {
        match self {
            Criterion::Regex(r) => r.is_match(&value.to_string()),
            Criterion::NotRegex(r) => !r.is_match(&value.to_string()),
            Criterion::Compare { compare_fn, rhs } => match rhs {
                Value::String(rhs) => {
                    compare_fn.compare(&value.to_string().to_ascii_lowercase(), &rhs)
                }
                Value::Number(rhs) => match value.to_number() {
                    Ok(lhs) => compare_fn.compare(&lhs, rhs),
                    Err(_) => false,
                },
                Value::Bool(rhs) => match value.to_bool() {
                    Ok(lhs) => compare_fn.compare(&lhs, rhs),
                    Err(_) => false,
                },
                Value::Array(_) | Value::MissingErr => false,
            },
        }
    }
}

fn wildcard_pattern_to_regex(s: &str) -> Result<Regex, FormulaError> {
    let mut chars = s.chars();
    let mut regex_string = String::new();
    regex_string.push('^'); // Match whole string using `^...$`.
    while let Some(c) = chars.next() {
        match c {
            // Escape the next character, if there is one. Otherwise ignore.
            '~' => {
                if let Some(c) = chars.next() {
                    regex_string.push_str(&regex::escape(&c.to_string()))
                }
            }

            '?' => regex_string.push('.'),
            '*' => regex_string.push_str(".*"),
            _ => regex_string.push_str(&regex::escape(&c.to_string())),
        }
    }
    regex_string.push('$'); // Match whole string using `^...$`.
    RegexBuilder::new(&regex_string)
        .case_insensitive(true)
        .build()
        .map_err(|e| {
            FormulaErrorMsg::InternalError(
                format!("error building regex for criterion {s:?}: {e}").into(),
            )
            .without_span()
        })
}

fn strip_compare_fn_prefix(s: &str) -> Option<(CompareFn, &str)> {
    None.or_else(|| s.strip_prefix("==").map(|rest| (CompareFn::Eql, rest)))
        .or_else(|| s.strip_prefix("=").map(|rest| (CompareFn::Eql, rest)))
        .or_else(|| s.strip_prefix("!=").map(|rest| (CompareFn::Neq, rest)))
        .or_else(|| s.strip_prefix("<>").map(|rest| (CompareFn::Neq, rest)))
        .or_else(|| s.strip_prefix("<=").map(|rest| (CompareFn::Lte, rest)))
        .or_else(|| s.strip_prefix(">=").map(|rest| (CompareFn::Gte, rest)))
        .or_else(|| s.strip_prefix("<").map(|rest| (CompareFn::Lt, rest)))
        .or_else(|| s.strip_prefix(">").map(|rest| (CompareFn::Gt, rest)))
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

    fn make_criterion(v: impl Into<Value>) -> Criterion {
        Criterion::try_from(&Spanned::new(0, 0, v.into())).unwrap()
    }

    fn matches(c: &Criterion, v: impl Into<Value>) -> bool {
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
        for prefix in ["=", "==", "<>", "!=", "<", ">", "<=", ">="] {
            for value in ["TRUE", "FALSE"] {
                let c = make_criterion(format!("{prefix}{value}"));
                assert!(!matches(&c, "a string"));
                assert!(!matches(&c, 0.0));
                assert!(!matches(&c, 1.0));
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
