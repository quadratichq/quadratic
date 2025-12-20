//! String search and conversion functions (len, find, value, text).

use super::*;

pub fn get_functions() -> Vec<FormulaFunction> {
    vec![
        // Length
        formula_fn!(
            /// Returns half the length of the string in Unicode code-points.
            #[examples("LEN(\"abc\") = 3", "LEN(\"résumé\") = 6")]
            #[zip_map]
            fn LEN([s]: String) {
                s.chars().count()
            }
        ),
        formula_fn!(
            /// Returns half the length of the string in bytes, using UTF-8 encoding.
            #[examples("LENB(\"abc\") = 3", "LENB(\"résumé\") = 8")]
            #[zip_map]
            fn LENB([s]: String) {
                s.len()
            }
        ),
        // Number <-> character conversion
        formula_fn!(
            /// Returns the first Unicode code point in a string as a number.
            #[examples("UNICODE(\"a\")=97", "UNICODE(\"Alpha\")=65")]
            #[zip_map]
            fn UNICODE(span: Span, [s]: String) {
                unicode(*span, s)?
            }
        ),
        formula_fn!(
            /// Same as `UNICODE`. Prefer `UNICODE`.
            #[examples("CODE(\"a\")=97", "CODE(\"Alpha\")=65")]
            #[zip_map]
            fn CODE(span: Span, [s]: String) {
                unicode(*span, s)?
            }
        ),
        formula_fn!(
            /// Returns a string containing the given Unicode code unit.
            #[examples("UNICHAR(97) = \"a\"", "UNICHAR(65) = \"A\"")]
            #[zip_map]
            fn UNICHAR(span: Span, [code_point]: u32) {
                unichar(*span, code_point)?.to_string()
            }
        ),
        formula_fn!(
            /// Same as `UNICHAR`. Prefer `UNICHAR`.
            #[examples("CHAR(97) = \"a\"", "CHAR(65) = \"A\"")]
            #[zip_map]
            fn CHAR(span: Span, [code_point]: u32) {
                unichar(*span, code_point)?.to_string()
            }
        ),
        // Type conversion
        formula_fn!(
            /// Returns a string value unmodified, or returns the empty string if passed a value other than a string.
            #[examples("T(\"some text\")=\"some text\"", "T(123)=\"\"")]
            #[zip_map]
            fn T([v]: CellValue) {
                match v {
                    CellValue::Text(s) => s.as_str(),
                    _ => "",
                }
            }
        ),
        formula_fn!(
            /// Parses a number from a string `s`, using `decimal_sep` as the
            /// decimal separator and `group_sep` as the group separator.
            #[examples(
                "NUMBERVALUE(\"4,000,096.25\")",
                "NUMBERVALUE(\"4.000.096,25\", \",\", \".\")"
            )]
            #[zip_map]
            fn NUMBERVALUE(
                span: Span,
                [text]: String,
                [decimal_sep]: (Option<Spanned<String>>),
                [group_sep]: (Option<Spanned<String>>),
            ) {
                let decimal = first_char_of_nonempty_string(&decimal_sep)?.unwrap_or('.');
                let group = first_char_of_nonempty_string(&group_sep)?.unwrap_or(',');

                if decimal == group {
                    return Err(RunErrorMsg::InvalidArgument.with_span(span));
                }

                let mut already_seen_decimal = false;
                let mut s = String::new();
                for c in text.chars() {
                    if c.is_whitespace() {
                        continue;
                    } else if c == decimal {
                        if already_seen_decimal {
                            return Err(RunErrorMsg::InvalidArgument.with_span(span));
                        }
                        already_seen_decimal = true;
                        s.push('.');
                    } else if c == group {
                        if already_seen_decimal {
                            return Err(RunErrorMsg::InvalidArgument.with_span(span));
                        }
                    } else {
                        s.push(c);
                    }
                }

                s.parse::<f64>()
                    .map_err(|_| RunErrorMsg::InvalidArgument.with_span(span))?
            }
        ),
        // Searching
        formula_fn!(
            /// Returns TRUE if two text strings are exactly the same (case-sensitive).
            #[examples("EXACT(\"abc\", \"abc\") = TRUE", "EXACT(\"Abc\", \"abc\") = FALSE")]
            #[zip_map]
            fn EXACT([s1]: String, [s2]: String) {
                s1 == s2
            }
        ),
        formula_fn!(
            /// Returns the position of a substring within a string (case-sensitive).
            #[examples("FIND(\"lo\", \"Hello\") = 4", "FIND(\"l\", \"Hello\", 4) = 4")]
            #[zip_map]
            fn FIND(
                span: Span,
                [find_text]: String,
                [within_text]: String,
                [start_pos]: (Option<Spanned<i64>>),
            ) {
                let start = start_pos.map_or(Ok(0), try_i64_minus_1_to_usize)?;
                let search_text = &within_text.chars().skip(start).collect::<String>();
                match search_text.find(&find_text) {
                    Some(byte_pos) => {
                        let char_pos = search_text[..byte_pos].chars().count();
                        (start + char_pos + 1) as i64
                    }
                    None => return Err(RunErrorMsg::NoMatch.with_span(span)),
                }
            }
        ),
        formula_fn!(
            /// Returns the position of a substring within a string (case-sensitive), using byte positions.
            #[examples("FINDB(\"lo\", \"Hello\") = 4")]
            #[zip_map]
            fn FINDB(
                [find_text]: String,
                [within_text]: String,
                [start_pos]: (Option<Spanned<i64>>),
            ) {
                let start = start_pos.map_or(Ok(0), try_i64_minus_1_to_usize)?;
                if start > within_text.len() {
                    return Err(RunErrorMsg::InvalidArgument.without_span());
                }
                let start = ceil_char_boundary(&within_text, start);
                match within_text[start..].find(&find_text) {
                    Some(byte_pos) => (start + byte_pos + 1) as i64,
                    None => return Err(RunErrorMsg::NoMatch.without_span()),
                }
            }
        ),
        formula_fn!(
            /// Returns the position of a substring within a string (case-insensitive). Supports wildcards.
            #[examples("SEARCH(\"h\", \"Hello\") = 1", "SEARCH(\"H?llo\", \"Hello\") = 1")]
            #[zip_map]
            fn SEARCH(
                span: Span,
                [find_text]: String,
                [within_text]: String,
                [start_pos]: (Option<Spanned<i64>>),
            ) {
                let start = start_pos.map_or(Ok(0), try_i64_minus_1_to_usize)?;
                let search_text: String = within_text.chars().skip(start).collect();
                let search_text_lower = search_text.to_lowercase();
                let find_text_lower = find_text.to_lowercase();

                if find_text_lower.contains('*') || find_text_lower.contains('?') {
                    let regex = crate::formulas::wildcard_pattern_to_regex(&find_text_lower)?;
                    match regex.find(&search_text_lower) {
                        Some(m) => {
                            let char_pos = search_text_lower[..m.start()].chars().count();
                            (start + char_pos + 1) as i64
                        }
                        None => return Err(RunErrorMsg::NoMatch.with_span(span)),
                    }
                } else {
                    match search_text_lower.find(&find_text_lower) {
                        Some(byte_pos) => {
                            let char_pos = search_text_lower[..byte_pos].chars().count();
                            (start + char_pos + 1) as i64
                        }
                        None => return Err(RunErrorMsg::NoMatch.with_span(span)),
                    }
                }
            }
        ),
        formula_fn!(
            /// Returns the position of a substring within a string (case-insensitive), using byte positions.
            #[examples("SEARCHB(\"LO\", \"Hello\") = 4")]
            #[zip_map]
            fn SEARCHB(
                span: Span,
                [find_text]: String,
                [within_text]: String,
                [start_pos]: (Option<Spanned<i64>>),
            ) {
                let start = start_pos.map_or(Ok(0), try_i64_minus_1_to_usize)?;
                if start > within_text.len() {
                    return Err(RunErrorMsg::InvalidArgument.with_span(span));
                }
                let start = ceil_char_boundary(&within_text, start);
                let search_text = &within_text[start..];
                let search_text_lower = search_text.to_lowercase();
                let find_text_lower = find_text.to_lowercase();

                if find_text_lower.contains('*') || find_text_lower.contains('?') {
                    let regex = crate::formulas::wildcard_pattern_to_regex(&find_text_lower)?;
                    match regex.find(&search_text_lower) {
                        Some(m) => (start + m.start() + 1) as i64,
                        None => return Err(RunErrorMsg::NoMatch.with_span(span)),
                    }
                } else {
                    match search_text_lower.find(&find_text_lower) {
                        Some(byte_pos) => (start + byte_pos + 1) as i64,
                        None => return Err(RunErrorMsg::NoMatch.with_span(span)),
                    }
                }
            }
        ),
        // Currency formatting
        formula_fn!(
            /// Formats a number as text with a dollar sign.
            #[examples(
                "DOLLAR(1234.567) = \"$1,234.57\"",
                "DOLLAR(1234.567, 1) = \"$1,234.6\""
            )]
            #[zip_map]
            fn DOLLAR([n]: f64, [decimals]: (Option<Spanned<i64>>)) {
                let decimals = decimals.map_or(2, |d| d.inner);
                format_currency_text(n, decimals, "$")
            }
        ),
        formula_fn!(
            /// Formats a number as text with a fixed number of decimal places.
            #[examples(
                "FIXED(1234.567) = \"1,234.57\"",
                "FIXED(1234.567, 1, TRUE) = \"1234.6\""
            )]
            #[zip_map]
            fn FIXED([n]: f64, [decimals]: (Option<Spanned<i64>>), [no_commas]: (Option<bool>)) {
                let decimals = decimals.map_or(2, |d| d.inner);
                let use_commas = !no_commas.unwrap_or(false);
                format_fixed_text(n, decimals, use_commas)
            }
        ),
        // Text formatting
        formula_fn!(
            /// Formats a value using a format string.
            #[examples(
                "TEXT(1234.567, \"$#,##0.00\") = \"$1,234.57\"",
                "TEXT(0.25, \"0%\") = \"25%\""
            )]
            #[zip_map]
            fn TEXT([value]: CellValue, [format_text]: String) {
                format_value_with_pattern(value, &format_text)?
            }
        ),
        // Text extraction
        formula_fn!(
            /// Returns text that occurs after a given delimiter.
            #[examples("TEXTAFTER(\"Hello World\", \" \") = \"World\"")]
            #[zip_map]
            fn TEXTAFTER(
                span: Span,
                [text]: String,
                [delimiter]: String,
                [instance_num]: (Option<Spanned<i64>>),
                [match_mode]: (Option<i64>),
                [match_end]: (Option<i64>),
                [if_not_found]: (Option<String>),
            ) {
                let instance = instance_num.map_or(1, |i| i.inner);
                if instance == 0 {
                    return Err(RunErrorMsg::InvalidArgument.with_span(span));
                }
                let case_insensitive = match_mode.unwrap_or(0) == 1;
                let match_end_as_delim = match_end.unwrap_or(0) == 1;

                text_after(
                    &text,
                    &delimiter,
                    instance,
                    case_insensitive,
                    match_end_as_delim,
                )
                .map(|s| s.to_string())
                .or_else(|| if_not_found.clone())
                .ok_or_else(|| RunErrorMsg::NoMatch.with_span(span))?
            }
        ),
        formula_fn!(
            /// Returns text that occurs before a given delimiter.
            #[examples("TEXTBEFORE(\"Hello World\", \" \") = \"Hello\"")]
            #[zip_map]
            fn TEXTBEFORE(
                span: Span,
                [text]: String,
                [delimiter]: String,
                [instance_num]: (Option<Spanned<i64>>),
                [match_mode]: (Option<i64>),
                [match_end]: (Option<i64>),
                [if_not_found]: (Option<String>),
            ) {
                let instance = instance_num.map_or(1, |i| i.inner);
                if instance == 0 {
                    return Err(RunErrorMsg::InvalidArgument.with_span(span));
                }
                let case_insensitive = match_mode.unwrap_or(0) == 1;
                let match_start_as_delim = match_end.unwrap_or(0) == 1;

                text_before(
                    &text,
                    &delimiter,
                    instance,
                    case_insensitive,
                    match_start_as_delim,
                )
                .map(|s| s.to_string())
                .or_else(|| if_not_found.clone())
                .ok_or_else(|| RunErrorMsg::NoMatch.with_span(span))?
            }
        ),
        formula_fn!(
            /// Splits text by column and/or row delimiters.
            #[examples("TEXTSPLIT(\"a,b,c\", \",\") = {\"a\", \"b\", \"c\"}")]
            fn TEXTSPLIT(
                span: Span,
                text: String,
                col_delimiter: (Spanned<String>),
                row_delimiter: (Option<Spanned<String>>),
                ignore_empty: (Option<bool>),
                match_mode: (Option<i64>),
                pad_with: (Option<CellValue>),
            ) {
                let col_delim = &col_delimiter.inner;
                let ignore = ignore_empty.unwrap_or(false);
                let case_insensitive = match_mode.unwrap_or(0) == 1;
                let pad = pad_with.unwrap_or(CellValue::Blank);

                if col_delim.is_empty() {
                    return Err(RunErrorMsg::InvalidArgument.with_span(col_delimiter.span));
                }

                let text_for_split = if case_insensitive {
                    text.to_lowercase()
                } else {
                    text.clone()
                };
                let col_delim_for_split = if case_insensitive {
                    col_delim.to_lowercase()
                } else {
                    col_delim.clone()
                };

                match &row_delimiter {
                    Some(row_delim_spanned) => {
                        let row_delim = &row_delim_spanned.inner;
                        if row_delim.is_empty() {
                            return Err(
                                RunErrorMsg::InvalidArgument.with_span(row_delim_spanned.span)
                            );
                        }
                        let row_delim_for_split = if case_insensitive {
                            row_delim.to_lowercase()
                        } else {
                            row_delim.clone()
                        };

                        let rows = split_keeping_positions(
                            &text,
                            &text_for_split,
                            &row_delim_for_split,
                            ignore,
                        );
                        let mut result_rows: Vec<Vec<CellValue>> = Vec::new();
                        let mut max_cols = 0;

                        for row_text in rows {
                            let row_lower = if case_insensitive {
                                row_text.to_lowercase()
                            } else {
                                row_text.to_string()
                            };
                            let cols: Vec<CellValue> = split_keeping_positions(
                                row_text,
                                &row_lower,
                                &col_delim_for_split,
                                ignore,
                            )
                            .into_iter()
                            .map(|s| CellValue::Text(s.to_string()))
                            .collect();
                            max_cols = max_cols.max(cols.len());
                            result_rows.push(cols);
                        }

                        for row in &mut result_rows {
                            while row.len() < max_cols {
                                row.push(pad.clone());
                            }
                        }

                        if result_rows.is_empty() {
                            return Err(RunErrorMsg::EmptyArray.with_span(span));
                        }
                        let width = max_cols.max(1);
                        let height = result_rows.len();
                        let flat: SmallVec<[CellValue; 1]> =
                            result_rows.into_iter().flatten().collect();
                        let size = ArraySize::new(width as u32, height as u32)
                            .ok_or_else(|| RunErrorMsg::ArrayTooBig.with_span(span))?;
                        Array::new_row_major(size, flat).map_err(|e| e.with_span(span))?
                    }
                    None => {
                        let parts: Vec<CellValue> = split_keeping_positions(
                            &text,
                            &text_for_split,
                            &col_delim_for_split,
                            ignore,
                        )
                        .into_iter()
                        .map(|s| CellValue::Text(s.to_string()))
                        .collect();
                        if parts.is_empty() {
                            return Err(RunErrorMsg::EmptyArray.with_span(span));
                        }
                        let size = ArraySize::new(parts.len() as u32, 1)
                            .ok_or_else(|| RunErrorMsg::ArrayTooBig.with_span(span))?;
                        Array::new_row_major(size, parts.into()).map_err(|e| e.with_span(span))?
                    }
                }
            }
        ),
        // Value conversion
        formula_fn!(
            /// Converts a text string that represents a number to a number.
            #[examples("VALUE(\"123.45\") = 123.45", "VALUE(\"$1,234.56\") = 1234.56")]
            #[zip_map]
            fn VALUE(span: Span, [s]: String) {
                parse_value_text(&s).ok_or_else(|| RunErrorMsg::InvalidArgument.with_span(span))?
            }
        ),
        formula_fn!(
            /// Converts a value to text.
            #[examples(
                "VALUETOTEXT(123) = \"123\"",
                "VALUETOTEXT(\"Hello\", 1) = \"\\\"Hello\\\"\""
            )]
            #[zip_map]
            fn VALUETOTEXT([value]: CellValue, [format]: (Option<Spanned<i64>>)) {
                match format {
                    Some(Spanned { inner: 0, .. }) | None => value.to_display(),
                    Some(Spanned { inner: 1, .. }) => value.repr(),
                    Some(Spanned { span, .. }) => {
                        return Err(RunErrorMsg::InvalidArgument.with_span(span));
                    }
                }
            }
        ),
        // URL encoding
        formula_fn!(
            /// Encodes a text string for use in a URL.
            ///
            /// Replaces spaces and other special characters with percent-encoded
            /// representations (e.g., space becomes %20).
            #[examples(
                "ENCODEURL(\"Hello World\") = \"Hello%20World\"",
                "ENCODEURL(\"a=1&b=2\") = \"a%3D1%26b%3D2\""
            )]
            #[zip_map]
            fn ENCODEURL([text]: String) {
                url_encode(&text)
            }
        ),
        // ===== REGEX FUNCTIONS =====
        formula_fn!(
            /// Tests whether a text string matches a regular expression pattern.
            ///
            /// Returns TRUE if the text matches the pattern, FALSE otherwise.
            /// The pattern uses regular expression syntax.
            #[examples(
                "REGEXTEST(\"hello123\", \"[0-9]+\") = TRUE",
                "REGEXTEST(\"hello\", \"[0-9]+\") = FALSE",
                "REGEXTEST(\"test@example.com\", \"^[a-z]+@[a-z]+\\\\.[a-z]+$\") = TRUE"
            )]
            #[zip_map]
            fn REGEXTEST(span: Span, [text]: String, [pattern]: String) {
                let re = regex::Regex::new(&pattern)
                    .map_err(|_| RunErrorMsg::InvalidArgument.with_span(span))?;
                re.is_match(&text)
            }
        ),
        formula_fn!(
            /// Extracts text that matches a regular expression pattern.
            ///
            /// Returns the first match of the pattern in the text.
            /// If the pattern contains a capture group, returns the captured text.
            /// Returns an error if no match is found.
            #[examples(
                "REGEXEXTRACT(\"hello123world\", \"[0-9]+\") = \"123\"",
                "REGEXEXTRACT(\"John Smith\", \"(\\\\w+) (\\\\w+)\") = \"John Smith\"",
                "REGEXEXTRACT(\"test@example.com\", \"@(\\\\w+)\") = \"@example\""
            )]
            #[zip_map]
            fn REGEXEXTRACT(span: Span, [text]: String, [pattern]: String) {
                let re = regex::Regex::new(&pattern)
                    .map_err(|_| RunErrorMsg::InvalidArgument.with_span(span))?;
                match re.find(&text) {
                    Some(m) => m.as_str().to_string(),
                    None => return Err(RunErrorMsg::NoMatch.with_span(span)),
                }
            }
        ),
        formula_fn!(
            /// Replaces text matching a regular expression pattern with replacement text.
            ///
            /// Replaces all occurrences of the pattern in the text with the replacement.
            /// The replacement can use $1, $2, etc. to refer to capture groups.
            #[examples(
                "REGEXREPLACE(\"hello123world\", \"[0-9]+\", \"XXX\") = \"helloXXXworld\"",
                "REGEXREPLACE(\"John Smith\", \"(\\\\w+) (\\\\w+)\", \"$2, $1\") = \"Smith, John\"",
                "REGEXREPLACE(\"2023-12-25\", \"(\\\\d+)-(\\\\d+)-(\\\\d+)\", \"$2/$3/$1\") = \"12/25/2023\""
            )]
            #[zip_map]
            fn REGEXREPLACE(span: Span, [text]: String, [pattern]: String, [replacement]: String) {
                let re = regex::Regex::new(&pattern)
                    .map_err(|_| RunErrorMsg::InvalidArgument.with_span(span))?;
                re.replace_all(&text, replacement.as_str()).to_string()
            }
        ),
    ]
}

/// URL-encodes a string for use in URLs.
fn url_encode(s: &str) -> String {
    let mut result = String::with_capacity(s.len() * 3);
    for c in s.chars() {
        // Characters that don't need encoding (RFC 3986 unreserved characters)
        if c.is_ascii_alphanumeric() || c == '-' || c == '_' || c == '.' || c == '~' {
            result.push(c);
        } else {
            // Encode all other characters as UTF-8 percent-encoded
            for byte in c.to_string().as_bytes() {
                result.push_str(&format!("%{:02X}", byte));
            }
        }
    }
    result
}

/// Formats a number with currency symbol.
fn format_currency_text(n: f64, decimals: i64, symbol: &str) -> String {
    let formatted = format_fixed_text(n.abs(), decimals, true);
    if n < 0.0 {
        format!("-{}{}", symbol, formatted)
    } else {
        format!("{}{}", symbol, formatted)
    }
}

/// Formats a number with fixed decimals and optional thousands separator.
fn format_fixed_text(n: f64, decimals: i64, use_commas: bool) -> String {
    let rounded = if decimals >= 0 {
        let factor = 10_f64.powi(decimals as i32);
        (n * factor).round() / factor
    } else {
        let factor = 10_f64.powi((-decimals) as i32);
        (n / factor).round() * factor
    };

    let decimals_usize = decimals.max(0) as usize;
    let formatted = format!("{:.prec$}", rounded, prec = decimals_usize);

    if use_commas {
        add_thousands_separator(&formatted)
    } else {
        formatted
    }
}

fn add_thousands_separator(s: &str) -> String {
    let (int_part, dec_part) = match s.find('.') {
        Some(pos) => (&s[..pos], &s[pos..]),
        None => (s, ""),
    };

    let negative = int_part.starts_with('-');
    let int_digits: String = int_part.chars().filter(|c| c.is_ascii_digit()).collect();

    let with_commas: String = int_digits
        .chars()
        .rev()
        .enumerate()
        .flat_map(|(i, c)| {
            if i > 0 && i % 3 == 0 {
                vec![',', c]
            } else {
                vec![c]
            }
        })
        .collect::<String>()
        .chars()
        .rev()
        .collect();

    if negative {
        format!("-{}{}", with_commas, dec_part)
    } else {
        format!("{}{}", with_commas, dec_part)
    }
}

/// Formats a value with a pattern.
fn format_value_with_pattern(value: &CellValue, pattern: &str) -> CodeResult<String> {
    match value {
        CellValue::Number(n) => {
            let n_f64 = n.to_f64().unwrap_or(0.0);

            if pattern.contains('%') {
                let cleaned = pattern.replace('%', "");
                let decimals = cleaned.chars().filter(|c| *c == '0').count() as i64 - 1;
                let decimals = decimals.max(0);
                return Ok(format!(
                    "{:.prec$}%",
                    n_f64 * 100.0,
                    prec = decimals as usize
                ));
            }

            if pattern.to_uppercase().contains('E') {
                let decimals = pattern
                    .chars()
                    .filter(|c| *c == '0' || *c == '#')
                    .count()
                    .saturating_sub(1);
                return Ok(format!("{:.prec$E}", n_f64, prec = decimals));
            }

            if pattern.contains('#') || pattern.contains('0') {
                let has_comma = pattern.contains(',');
                let decimal_pos = pattern.find('.');
                let decimals = match decimal_pos {
                    Some(pos) => pattern[pos + 1..]
                        .chars()
                        .filter(|c| *c == '0' || *c == '#')
                        .count(),
                    None => 0,
                };

                let prefix: String = pattern
                    .chars()
                    .take_while(|c| *c != '#' && *c != '0')
                    .collect();
                let suffix: String = pattern
                    .chars()
                    .rev()
                    .take_while(|c| *c != '#' && *c != '0')
                    .collect::<String>()
                    .chars()
                    .rev()
                    .collect();

                let formatted = format!("{:.prec$}", n_f64.abs(), prec = decimals);
                let with_sep = if has_comma {
                    add_thousands_separator(&formatted)
                } else {
                    formatted
                };

                let sign = if n_f64 < 0.0 { "-" } else { "" };
                return Ok(format!("{}{}{}{}", sign, prefix, with_sep, suffix));
            }

            Ok(n.to_string())
        }
        CellValue::Date(_) | CellValue::DateTime(_) | CellValue::Time(_) => {
            format_date_time(value, pattern)
        }
        _ => Ok(value.to_display()),
    }
}

#[cfg(test)]
mod tests {
    use crate::{controller::GridController, formulas::tests::*};

    #[test]
    fn test_formula_len() {
        let g = GridController::new();
        assert_eq!("3", eval_to_string(&g, "LEN(\"abc\")"));
        assert_eq!("6", eval_to_string(&g, "LEN(\"résumé\")"));
    }

    #[test]
    fn test_formula_unicode() {
        let g = GridController::new();
        assert_eq!("97", eval_to_string(&g, "UNICODE(\"a\")"));
        assert_eq!("65", eval_to_string(&g, "UNICODE(\"Alpha\")"));
    }

    #[test]
    fn test_formula_unichar() {
        let g = GridController::new();
        assert_eq!("a", eval_to_string(&g, "UNICHAR(97)"));
        assert_eq!("A", eval_to_string(&g, "CHAR(65)"));
    }

    #[test]
    fn test_formula_t() {
        let g = GridController::new();
        assert_eq!("hello", eval_to_string(&g, "T(\"hello\")"));
        assert_eq!("", eval_to_string(&g, "T(123)"));
    }

    #[test]
    fn test_formula_exact() {
        let g = GridController::new();
        assert_eq!("FALSE", eval_to_string(&g, "EXACT(\"Abc\", \"abc\")"));
        assert_eq!("TRUE", eval_to_string(&g, "EXACT(\"abc\", \"abc\")"));
    }

    #[test]
    fn test_formula_find() {
        let g = GridController::new();
        assert_eq!("4", eval_to_string(&g, "FIND(\"lo\", \"Hello\")"));
        assert_eq!("1", eval_to_string(&g, "FIND(\"H\", \"Hello\")"));
    }

    #[test]
    fn test_formula_search() {
        let g = GridController::new();
        assert_eq!("1", eval_to_string(&g, "SEARCH(\"h\", \"Hello\")"));
        assert_eq!("4", eval_to_string(&g, "SEARCH(\"lo\", \"Hello\")"));
    }

    #[test]
    fn test_formula_dollar() {
        let g = GridController::new();
        assert_eq!("$1,234.57", eval_to_string(&g, "DOLLAR(1234.567)"));
        assert_eq!("$1,234.6", eval_to_string(&g, "DOLLAR(1234.567, 1)"));
    }

    #[test]
    fn test_formula_fixed() {
        let g = GridController::new();
        assert_eq!("1,234.57", eval_to_string(&g, "FIXED(1234.567)"));
        assert_eq!("1234.6", eval_to_string(&g, "FIXED(1234.567, 1, TRUE)"));
    }

    #[test]
    fn test_formula_value() {
        let g = GridController::new();
        assert_eq!("123.45", eval_to_string(&g, "VALUE(\"123.45\")"));
        assert_eq!("1234.56", eval_to_string(&g, "VALUE(\"$1,234.56\")"));
    }

    #[test]
    fn test_formula_textafter() {
        let g = GridController::new();
        assert_eq!(
            "World",
            eval_to_string(&g, "TEXTAFTER(\"Hello World\", \" \")")
        );
    }

    #[test]
    fn test_formula_textbefore() {
        let g = GridController::new();
        assert_eq!(
            "Hello",
            eval_to_string(&g, "TEXTBEFORE(\"Hello World\", \" \")")
        );
    }

    #[test]
    fn test_formula_textsplit() {
        let g = GridController::new();
        // TEXTSPLIT returns an array, which eval_to_string renders without quotes on text
        assert_eq!(
            "{a, b, c}",
            eval_to_string(&g, "TEXTSPLIT(\"a,b,c\", \",\")")
        );
    }

    #[test]
    fn test_formula_encodeurl() {
        let g = GridController::new();
        assert_eq!(
            "Hello%20World",
            eval_to_string(&g, "ENCODEURL(\"Hello World\")")
        );
        assert_eq!(
            "a%3D1%26b%3D2",
            eval_to_string(&g, "ENCODEURL(\"a=1&b=2\")")
        );
        // Alphanumeric characters should not be encoded
        assert_eq!("abc123", eval_to_string(&g, "ENCODEURL(\"abc123\")"));
        // Special unreserved characters
        assert_eq!("-_.~", eval_to_string(&g, "ENCODEURL(\"-_.~\")"));
        // Unicode characters
        assert_eq!(
            "%E4%B8%AD%E6%96%87",
            eval_to_string(&g, "ENCODEURL(\"中文\")")
        );
    }
}
