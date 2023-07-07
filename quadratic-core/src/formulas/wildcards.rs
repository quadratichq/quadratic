use regex::{Regex, RegexBuilder};

use super::{FormulaError, FormulaErrorMsg};

pub fn wildcard_pattern_to_regex(s: &str) -> Result<Regex, FormulaError> {
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
