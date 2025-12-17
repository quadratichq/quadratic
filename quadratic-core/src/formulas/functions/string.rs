use super::*;
use crate::ArraySize;
use crate::number::decimal_from_str;
use chrono::{Datelike, Timelike};
use rust_decimal::prelude::ToPrimitive;
use smallvec::SmallVec;

pub const CATEGORY: FormulaFunctionCategory = FormulaFunctionCategory {
    include_in_docs: true,
    include_in_completions: true,
    name: "String functions",
    docs: None,
    get_functions,
};

fn get_functions() -> Vec<FormulaFunction> {
    vec![
        // Concatenation
        formula_fn!(
            /// Converts an array of values to a string.
            ///
            /// If `format` is 0 or omitted, returns a human-readable
            /// representation such as `Apple, banana, 42, hello, world!`. If
            /// `format` is 1, returns a machine-readable representation in
            /// valid formula syntax such as `{"Apple", "banana", 42, "Hello,
            /// world!"}`. If `format` is any other value, returns an error.
            #[examples(
                "ARRAYTOTEXT({\"Apple\", \"banana\"; 42, \"Hello, world!\"})",
                "ARRAYTOTEXT({\"Apple\", \"banana\"; 42, \"Hello, world!\"}, 1)"
            )]
            fn ARRAYTOTEXT(array: Array, format: (Option<Spanned<i64>>)) {
                match format {
                    Some(Spanned { inner: 0, .. }) | None => array
                        .cell_values_slice()
                        .iter()
                        .map(|v| v.to_display())
                        .join(", "),
                    Some(Spanned { inner: 1, .. }) => array.repr(),
                    Some(Spanned { span, .. }) => {
                        return Err(RunErrorMsg::InvalidArgument.with_span(span));
                    }
                }
            }
        ),
        formula_fn!(
            /// Same as `CONCAT`, but kept for compatibility.
            #[examples("CONCATENATE(\"Hello, \", C0, \"!\")")]
            fn CONCATENATE(strings: (Iter<String>)) {
                strings.try_fold(String::new(), |a, b| Ok(a + &b?))
            }
        ),
        formula_fn!(
            /// [Concatenates](https://en.wikipedia.org/wiki/Concatenation) all
            /// values as strings.
            ///
            /// `&` can also be used to concatenate text.
            #[examples("CONCAT(\"Hello, \", C0, \"!\")", "\"Hello, \" & C0 & \"!\"")]
            fn CONCAT(strings: (Iter<String>)) {
                strings.try_fold(String::new(), |a, b| Ok(a + &b?))
            }
        ),
        // Substrings
        formula_fn!(
            /// Returns the first `char_count` characters from the beginning of
            /// the string `s`.
            ///
            /// Returns an error if `char_count` is less than 0.
            ///
            /// If `char_count` is omitted, it is assumed to be 1.
            ///
            /// If `char_count` is greater than the number of characters in `s`,
            /// then the entire string is returned.
            #[examples(
                "LEFT(\"Hello, world!\") = \"H\"",
                "LEFT(\"Hello, world!\", 6) = \"Hello,\"",
                "LEFT(\"抱歉，我不懂普通话\") = \"抱\"",
                "LEFT(\"抱歉，我不懂普通话\", 6) = \"抱歉，我不懂\""
            )]
            #[zip_map]
            fn LEFT([s]: String, [char_count]: (Option<Spanned<i64>>)) {
                let char_count = char_count.map_or(Ok(1), try_i64_to_usize)?;
                s.chars().take(char_count).collect::<String>()
            }
        ),
        formula_fn!(
            /// Returns the first `byte_count` bytes from the beginning of the
            /// string `s`, encoded using UTF-8.
            ///
            /// Returns an error if `byte_count` is less than 0.
            ///
            /// If `byte_count` is omitted, it is assumed to be 1. If
            /// `byte_count` is greater than the number of bytes in `s`, then
            /// the entire string is returned.
            ///
            /// If the string would be split in the middle of a character, then
            /// `byte_count` is rounded down to the previous character boundary
            /// so the the returned string takes at most `byte_count` bytes.
            #[examples(
                "LEFTB(\"Hello, world!\") = \"H\"",
                "LEFTB(\"Hello, world!\", 6) = \"Hello,\"",
                "LEFTB(\"抱歉，我不懂普通话\") = \"\"",
                "LEFTB(\"抱歉，我不懂普通话\", 6) = \"抱歉\"",
                "LEFTB(\"抱歉，我不懂普通话\", 8) = \"抱歉\""
            )]
            #[zip_map]
            fn LEFTB([s]: String, [byte_count]: (Option<Spanned<i64>>)) {
                let byte_count = byte_count.map_or(Ok(1), try_i64_to_usize)?;
                s[..floor_char_boundary(&s, byte_count)].to_owned()
            }
        ),
        formula_fn!(
            /// Returns the last `char_count` characters from the end of the
            /// string `s`.
            ///
            /// Returns an error if `char_count` is less than 0.
            ///
            /// If `char_count` is omitted, it is assumed to be 1.
            ///
            /// If `char_count` is greater than the number of characters in `s`,
            /// then the entire string is returned.
            #[examples(
                "RIGHT(\"Hello, world!\") = \"!\"",
                "RIGHT(\"Hello, world!\", 6) = \"world!\"",
                "RIGHT(\"抱歉，我不懂普通话\") = \"话\"",
                "RIGHT(\"抱歉，我不懂普通话\", 6) = \"我不懂普通话\""
            )]
            #[zip_map]
            fn RIGHT([s]: String, [char_count]: (Option<Spanned<i64>>)) {
                let char_count = char_count.map_or(Ok(1), try_i64_to_usize)?;
                if char_count == 0 {
                    String::new()
                } else {
                    match s.char_indices().nth_back(char_count - 1) {
                        Some((i, _)) => s[i..].to_owned(),
                        None => s,
                    }
                }
            }
        ),
        formula_fn!(
            /// Returns the last `byte_count` bytes from the end of the string
            /// `s`, encoded using UTF-8.
            ///
            /// Returns an error if `byte_count` is less than 0.
            ///
            /// If `byte_count` is omitted, it is assumed to be 1.
            ///
            /// If `byte_count` is greater than the number of bytes in `s`, then
            /// the entire string is returned.
            ///
            /// If the string would be split in the middle of a character, then
            /// `byte_count` is rounded down to the next character boundary so
            /// that the returned string takes at most `byte_count` bytes.
            #[examples(
                "RIGHTB(\"Hello, world!\") = \"!\"",
                "RIGHTB(\"Hello, world!\", 6) = \"world!\"",
                "RIGHTB(\"抱歉，我不懂普通话\") = \"\"",
                "RIGHTB(\"抱歉，我不懂普通话\", 6) = \"通话\"",
                "RIGHTB(\"抱歉，我不懂普通话\", 7) = \"通话\""
            )]
            #[zip_map]
            fn RIGHTB([s]: String, [byte_count]: (Option<Spanned<i64>>)) {
                let byte_count = byte_count.map_or(Ok(1), try_i64_to_usize)?;
                let byte_index = s.len().saturating_sub(byte_count);
                s[ceil_char_boundary(&s, byte_index)..].to_owned()
            }
        ),
        formula_fn!(
            /// Returns the substring of a string `s` starting at the
            /// `start_char`th character and with a length of `char_count`.
            ///
            /// Returns an error if `start_char` is less than 1 or if
            /// `char_count` is less than 0.
            ///
            /// If `start_char` is past the end of the string, returns an empty
            /// string. If `start_char + char_count` is past the end of the
            /// string, returns the rest of the string starting at `start_char`.
            #[examples(
                "MID(\"Hello, world!\", 4, 6) = \"lo, wo\"",
                "MID(\"Hello, world!\", 1, 5) = \"Hello\"",
                "MID(\"抱歉，我不懂普通话\", 4, 4) = \"我不懂普\""
            )]
            #[zip_map]
            fn MID([s]: String, [start_char]: (Spanned<i64>), [char_count]: (Spanned<i64>)) {
                let start = try_i64_minus_1_to_usize(start_char)?; // 1-indexed
                let len = try_i64_to_usize(char_count)?;
                s.chars().skip(start).take(len).collect::<String>()
            }
        ),
        formula_fn!(
            /// Returns the substring of a string `s` starting at the
            /// `start_byte`th byte and with a length of `byte_count` bytes,
            /// encoded using UTF-8.
            ///
            /// Returns an error if `start_byte` is less than 1 or if
            /// `byte_count` is less than 0.
            ///
            /// If `start_byte` is past the end of the string, returns an empty
            /// string. If `start_byte + byte_count` is past the end of the
            /// string, returns the rest of the string starting at `start_byte`.
            ///
            /// If the string would be split in the middle of a character, then
            /// `start_byte` is rounded up to the next character boundary and
            /// `byte_count` is rounded down to the previous character boundary
            /// so that the returned string takes at most `byte_count` bytes.
            #[examples(
                "MIDB(\"Hello, world!\", 4, 6) = \"lo, wo\"",
                "MIDB(\"Hello, world!\", 1, 5) = \"Hello\"",
                "MIDB(\"抱歉，我不懂普通话\", 10, 12) = \"我不懂普\"",
                "MIDB(\"抱歉，我不懂普通话\", 8, 16) = \"我不懂普\""
            )]
            #[zip_map]
            fn MIDB([s]: String, [start_byte]: (Spanned<i64>), [byte_count]: (Spanned<i64>)) {
                let start = try_i64_minus_1_to_usize(start_byte)?;
                let end = start.saturating_add(try_i64_to_usize(byte_count)?);
                s[ceil_char_boundary(&s, start)..floor_char_boundary(&s, end)].to_owned()
            }
        ),
        // Length
        formula_fn!(
            /// Returns half the length of the string in [Unicode
            /// code-points](https://tonsky.me/blog/unicode/). This is often the
            /// same as the number of characters in a string, but not for
            /// certain diacritics, emojis, or other cases.
            #[examples("LEN(\"abc\") = 3", "LEN(\"résumé\") = 6", "LEN(\"ȍ̶̭h̸̲͝ ̵͈̚ņ̶̾ő̶͖\") = ??")]
            #[zip_map]
            fn LEN([s]: String) {
                // In Google Sheets, this function counts UTF-16 codepoints.
                // In Excel, this function counts UTF-16 codepoints.
                // We count UTF-8 codepoints.
                s.chars().count()
            }
        ),
        formula_fn!(
            /// Returns half the length of the string in bytes, using UTF-8
            /// encoding.
            #[examples("LENB(\"abc\") = 3", "LENB(\"résumé\") = 8")]
            #[zip_map]
            fn LENB([s]: String) {
                // In Google Sheets, this function counts UTF-16 bytes.
                // In Excel in a CJK locale, this function counts UTF-16 bytes.
                // In Excel in a non-CJK locale, this function counts UTF-16 codepoints.
                // We count UTF-8 bytes.
                s.len()
            }
        ),
        // Number <-> character conversion
        formula_fn!(
            /// Returns the first [Unicode] code point in a string as a number.
            /// If the first character is part of standard (non-extended)
            /// [ASCII], then this is the same as its ASCII number.
            ///
            /// [Unicode]: https://en.wikipedia.org/wiki/Unicode
            /// [ASCII]: https://en.wikipedia.org/wiki/ASCII
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
            /// Returns a string containing the given [Unicode] code unit. For
            /// numbers in the range 0-127, this converts from a number to its
            /// corresponding [ASCII] character.
            ///
            /// [Unicode]: https://en.wikipedia.org/wiki/Unicode
            /// [ASCII]: https://en.wikipedia.org/wiki/ASCII
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
        // Fixed substitutions
        formula_fn!(
            /// Removes nonprintable [ASCII] characters 0-31 (0x00-0x1F) from a
            /// string. This removes tabs and newlines, but not spaces.
            ///
            /// [ASCII]: https://en.wikipedia.org/wiki/ASCII
            #[examples("CLEAN(CHAR(9) & \"(only the parenthetical will survive)\" & CHAR(10))")]
            #[zip_map]
            fn CLEAN([s]: String) {
                s.chars().filter(|&c| c as u64 >= 0x20).collect::<String>()
            }
        ),
        formula_fn!(
            /// Removes spaces from the beginning and end of a string `s`, and
            /// replaces each run of consecutive space within the string with a
            /// single space.
            ///
            /// [Other forms of whitespace][whitespace], including tabs and
            /// newlines, are preserved.
            ///
            /// [whitespace]: https://en.wikipedia.org/wiki/Whitespace_character
            #[examples("TRIM(\"    a    b    c    \")=\"a b c\"")]
            #[zip_map]
            fn TRIM([s]: String) {
                // This would be a one-liner if we wanted to apply it to all
                // whitespace: `s.split_whitespace().join(" ")`
                let mut allow_next_space = false;
                s.trim_end_matches(' ')
                    .chars()
                    .filter(|&c| {
                        let is_space = c == ' ';
                        let keep = if is_space { allow_next_space } else { true };
                        allow_next_space = !is_space;
                        keep
                    })
                    .collect::<String>()
            }
        ),
        formula_fn!(
            /// Returns the lowercase equivalent of a string.
            #[examples(
                "LOWER(\"ὈΔΥΣΣΕΎΣ is my FAVORITE character!\") = \"ὀδυσσεύς is my favorite character!\""
            )]
            #[zip_map]
            fn LOWER([s]: String) {
                s.to_lowercase()
            }
        ),
        formula_fn!(
            /// Returns the uppercase equivalent of a string.
            #[examples("UPPER(\"tschüß, my friend\") = \"TSCHÜSS, MY FRIEND\"")]
            #[zip_map]
            fn UPPER([s]: String) {
                s.to_uppercase()
            }
        ),
        formula_fn!(
            /// Capitalizes letters that do not have another letter before them,
            /// and lowercases the rest.
            #[examples(
                "PROPER(\"ὈΔΥΣΣΕΎΣ is my FAVORITE character!\") = \"Ὀδυσσεύς Is My Favorite Character!\""
            )]
            #[zip_map]
            fn PROPER([s]: String) {
                let mut last_char = '\0';
                let mut ret = String::new();
                // Convert to lowercase first so that we get correct handling of
                // word-final sigma. This *may* cause issues where the first
                // character is not preserved, since it gets lowercased and then
                // titlecased.
                for c in s.to_lowercase().chars() {
                    if last_char.is_alphabetic() {
                        ret.push(c);
                    } else {
                        // We can't just uppercase the charater, because Unicode
                        // contains some ligatures like `ǆ` which should be
                        // titlecased to `ǅ` rather than `Ǆ`.
                        match unicode_case_mapping::to_titlecase(c) {
                            [0, 0, 0] => ret.push(c), // unchanged
                            char_seq => ret.extend(
                                char_seq
                                    .into_iter()
                                    .filter(|&c| c != 0)
                                    .filter_map(char::from_u32),
                            ),
                        }
                    }
                    last_char = c;
                }
                ret
            }
        ),
        // Other string conversions
        formula_fn!(
            /// Returns a string value unmodified, or returns the empty string if passed a value other than a string.
            #[examples(
                "T(\"some text\")=\"some text\"",
                "T(\"123\")=\"123\"",
                "T(123)=\"\"",
                "T(FALSE)=\"\""
            )]
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
            ///
            /// If `decimal_sep` is omitted, it is assumed to be `.`. If
            /// `group_sep` is omitted, it is assumed to be `,`. Only the first
            /// character of each is considered. If the decimal separator and
            /// the group separator are the same or if either is an empty
            /// string, an error is returned.
            ///
            /// The decimal separator must appear at most once in the string.
            /// The group separator must not appear at any point after a decimal
            /// separator. Whitespace may appear anywhere in the string.
            /// Whitespace and group separators are ignored and have no effect
            /// on the returned number.
            #[examples("NUMBERVALUE(\"4,000,096.25\")", "NUMBERVALUE(\"4.000.096,25\")")]
            #[zip_map]
            fn NUMBERVALUE(
                [s]: (Spanned<String>),
                [decimal_sep]: (Option<Spanned<String>>),
                [group_sep]: (Option<Spanned<String>>),
            ) {
                let decimal_sep_char = first_char_of_nonempty_string(&decimal_sep)?.unwrap_or('.');
                let mut group_sep_char = first_char_of_nonempty_string(&group_sep)?.unwrap_or(',');

                if decimal_sep_char == group_sep_char {
                    match group_sep {
                        Some(s) => return Err(RunErrorMsg::InvalidArgument.with_span(s.span)),
                        None => group_sep_char = '.',
                    }
                }

                let mut seen_decimal_sep = false;
                let actual_number_string = s
                    .inner
                    .chars()
                    .filter_map(|c| {
                        if c.is_whitespace() {
                            None
                        } else if c == group_sep_char {
                            if seen_decimal_sep {
                                Some('H') // something that will fail to parse
                            } else {
                                None
                            }
                        } else if c == decimal_sep_char {
                            seen_decimal_sep = true;
                            Some('.')
                        } else if c.is_ascii_digit() {
                            Some(c)
                        } else {
                            Some('H') // something that will fail to parse
                        }
                    })
                    .collect::<String>();

                if actual_number_string.is_empty() && !seen_decimal_sep {
                    Ok(0.0)
                } else {
                    actual_number_string
                        .parse::<f64>()
                        .map_err(|_| RunErrorMsg::InvalidArgument.with_span(s.span))
                }
            }
        ),
        // Comparison
        formula_fn!(
            /// Returns whether two strings are exactly equal, using
            /// case-sensitive comparison (but ignoring formatting).
            #[examples(
                "EXACT(\"Abc\", \"abc\")=FALSE",
                "EXACT(\"abc\", \"abc\")=TRUE",
                "EXACT(\"abc\", \"def\")=FALSE"
            )]
            #[zip_map]
            fn EXACT([s1]: String, [s2]: String) {
                s1 == s2
            }
        ),
        // Search and replace
        formula_fn!(
            /// Returns the position of a substring within a string (case-sensitive).
            /// Returns an error if the substring is not found.
            ///
            /// `start_pos` is the position to start searching from (1-indexed, default 1).
            #[examples("FIND(\"lo\", \"Hello\") = 4", "FIND(\"l\", \"Hello\", 4) = 4")]
            #[zip_map]
            fn FIND(
                [find_text]: String,
                [within_text]: String,
                [start_pos]: (Option<Spanned<i64>>),
            ) {
                let start = start_pos.map_or(Ok(0), try_i64_minus_1_to_usize)?;
                if start > within_text.len() {
                    return Err(RunErrorMsg::InvalidArgument.without_span());
                }
                // Get byte index from character index
                let byte_start = within_text
                    .char_indices()
                    .nth(start)
                    .map(|(i, _)| i)
                    .unwrap_or(within_text.len());
                match within_text[byte_start..].find(&find_text) {
                    Some(byte_pos) => {
                        // Convert byte position back to character position
                        let char_pos = within_text[..byte_start + byte_pos].chars().count();
                        (char_pos + 1) as i64 // 1-indexed
                    }
                    None => return Err(RunErrorMsg::NoMatch.without_span()),
                }
            }
        ),
        formula_fn!(
            /// Returns the position of a substring within a string (case-insensitive).
            /// Supports wildcards: `?` matches any single character, `*` matches any sequence.
            /// Returns an error if the substring is not found.
            ///
            /// `start_pos` is the position to start searching from (1-indexed, default 1).
            #[examples(
                "SEARCH(\"LO\", \"Hello\") = 4",
                "SEARCH(\"l\", \"Hello\", 4) = 4",
                "SEARCH(\"l*o\", \"Hello\") = 3"
            )]
            #[zip_map]
            fn SEARCH(
                span: Span,
                [find_text]: String,
                [within_text]: String,
                [start_pos]: (Option<Spanned<i64>>),
            ) {
                let start = start_pos.map_or(Ok(0), try_i64_minus_1_to_usize)?;
                if start > within_text.chars().count() {
                    return Err(RunErrorMsg::InvalidArgument.with_span(span));
                }
                // Get the substring starting from start position
                let search_text: String = within_text.chars().skip(start).collect();
                let search_text_lower = search_text.to_lowercase();
                let find_text_lower = find_text.to_lowercase();

                // Check if it's a simple search or wildcard search
                if find_text_lower.contains('*') || find_text_lower.contains('?') {
                    // Use wildcard matching
                    let regex = crate::formulas::wildcard_pattern_to_regex(&find_text_lower)?;
                    match regex.find(&search_text_lower) {
                        Some(m) => {
                            let char_pos = search_text_lower[..m.start()].chars().count();
                            (start + char_pos + 1) as i64 // 1-indexed
                        }
                        None => return Err(RunErrorMsg::NoMatch.with_span(span)),
                    }
                } else {
                    // Simple case-insensitive search
                    match search_text_lower.find(&find_text_lower) {
                        Some(byte_pos) => {
                            let char_pos = search_text_lower[..byte_pos].chars().count();
                            (start + char_pos + 1) as i64 // 1-indexed
                        }
                        None => return Err(RunErrorMsg::NoMatch.with_span(span)),
                    }
                }
            }
        ),
        formula_fn!(
            /// Replaces part of a text string with a different text string.
            ///
            /// - `old_text`: The original text.
            /// - `start_pos`: The position to start replacing (1-indexed).
            /// - `num_chars`: The number of characters to replace.
            /// - `new_text`: The text to insert.
            #[examples(
                "REPLACE(\"Hello\", 2, 3, \"i\") = \"Hio\"",
                "REPLACE(\"abcdef\", 3, 2, \"XYZ\") = \"abXYZef\""
            )]
            #[zip_map]
            fn REPLACE(
                [old_text]: String,
                [start_pos]: (Spanned<i64>),
                [num_chars]: (Spanned<i64>),
                [new_text]: String,
            ) {
                let start = try_i64_minus_1_to_usize(start_pos)?;
                let num = try_i64_to_usize(num_chars)?;

                let chars: Vec<char> = old_text.chars().collect();
                let before: String = chars.iter().take(start).collect();
                let after: String = chars.iter().skip(start + num).collect();

                format!("{}{}{}", before, new_text, after)
            }
        ),
        formula_fn!(
            /// Substitutes new text for old text in a string.
            ///
            /// - `text`: The text containing the text to replace.
            /// - `old_text`: The text to replace.
            /// - `new_text`: The replacement text.
            /// - `instance_num`: Optional. Which occurrence to replace (1-indexed). If omitted, all occurrences are replaced.
            #[examples(
                "SUBSTITUTE(\"Hello Hello\", \"Hello\", \"Hi\") = \"Hi Hi\"",
                "SUBSTITUTE(\"Hello Hello\", \"Hello\", \"Hi\", 2) = \"Hello Hi\""
            )]
            #[zip_map]
            fn SUBSTITUTE(
                [text]: String,
                [old_text]: String,
                [new_text]: String,
                [instance_num]: (Option<Spanned<i64>>),
            ) {
                if old_text.is_empty() {
                    text
                } else {
                    match instance_num {
                        None => {
                            // Replace all occurrences
                            text.replace(&old_text, &new_text)
                        }
                        Some(n) => {
                            let instance = try_i64_to_usize(n)?;
                            if instance == 0 {
                                return Err(RunErrorMsg::InvalidArgument.with_span(n.span));
                            }
                            // Replace only the nth occurrence
                            let mut count = 0;
                            let mut result = String::new();
                            let mut remaining = text.as_str();

                            while let Some(pos) = remaining.find(&old_text) {
                                count += 1;
                                if count == instance {
                                    result.push_str(&remaining[..pos]);
                                    result.push_str(&new_text);
                                    result.push_str(&remaining[pos + old_text.len()..]);
                                    return Ok(CellValue::Text(result));
                                } else {
                                    result.push_str(&remaining[..pos + old_text.len()]);
                                    remaining = &remaining[pos + old_text.len()..];
                                }
                            }
                            // If we didn't find the nth occurrence, return original text
                            result.push_str(remaining);
                            result
                        }
                    }
                }
            }
        ),
        formula_fn!(
            /// Repeats a text string a specified number of times.
            #[examples("REPT(\"*\", 5) = \"*****\"", "REPT(\"ab\", 3) = \"ababab\"")]
            #[zip_map]
            fn REPT([text]: String, [number_times]: (Spanned<i64>)) {
                let times = try_i64_to_usize(number_times)?;
                text.repeat(times)
            }
        ),
        formula_fn!(
            /// Concatenates text strings with a delimiter between them.
            ///
            /// - `delimiter`: The text to insert between each value.
            /// - `ignore_empty`: If TRUE, ignores empty cells.
            /// - `text1, text2, ...`: The text values to join.
            #[examples(
                "TEXTJOIN(\", \", TRUE, \"a\", \"b\", \"c\") = \"a, b, c\"",
                "TEXTJOIN(\"-\", FALSE, \"a\", \"\", \"c\") = \"a--c\""
            )]
            fn TEXTJOIN(delimiter: String, ignore_empty: bool, texts: (Iter<CellValue>)) {
                let strings: Vec<String> = texts
                    .filter_map(|v| match v {
                        Ok(CellValue::Blank) => {
                            if ignore_empty {
                                None
                            } else {
                                Some(Ok(String::new()))
                            }
                        }
                        Ok(CellValue::Text(s)) if s.is_empty() => {
                            if ignore_empty {
                                None
                            } else {
                                Some(Ok(String::new()))
                            }
                        }
                        Ok(v) => Some(Ok(v.to_display())),
                        Err(e) => Some(Err(e)),
                    })
                    .collect::<CodeResult<Vec<_>>>()?;
                strings.join(&delimiter)
            }
        ),
        // Character width conversions
        formula_fn!(
            /// Converts full-width (double-byte) characters to half-width
            /// (single-byte) characters. This is useful for converting Japanese
            /// katakana and other East Asian characters.
            ///
            /// Characters that don't have a half-width equivalent are left
            /// unchanged.
            #[examples("ASC(\"ＡＢＣ\") = \"ABC\"", "ASC(\"１２３\") = \"123\"")]
            #[zip_map]
            fn ASC([s]: String) {
                s.chars()
                    .map(|c| {
                        // Full-width ASCII to half-width (！to ～ -> ! to ~)
                        if ('\u{FF01}'..='\u{FF5E}').contains(&c) {
                            char::from_u32(c as u32 - 0xFF01 + 0x21).unwrap_or(c)
                        }
                        // Full-width space to half-width space
                        else if c == '\u{3000}' {
                            ' '
                        }
                        // Full-width katakana to half-width katakana
                        else if let Some(half) = full_to_half_katakana(c) {
                            half
                        } else {
                            c
                        }
                    })
                    .collect::<String>()
            }
        ),
        formula_fn!(
            /// Converts half-width (single-byte) characters to full-width
            /// (double-byte) characters. This is the opposite of ASC.
            ///
            /// Characters that don't have a full-width equivalent are left
            /// unchanged.
            #[examples("DBCS(\"ABC\") = \"ＡＢＣ\"", "DBCS(\"123\") = \"１２３\"")]
            #[zip_map]
            fn DBCS([s]: String) {
                s.chars()
                    .map(|c| {
                        // Half-width ASCII to full-width (! to ~ -> ！to ～)
                        if ('!'..='~').contains(&c) {
                            char::from_u32(c as u32 - 0x21 + 0xFF01).unwrap_or(c)
                        }
                        // Half-width space to full-width space
                        else if c == ' ' {
                            '\u{3000}'
                        }
                        // Half-width katakana to full-width katakana
                        else if let Some(full) = half_to_full_katakana(c) {
                            full
                        } else {
                            c
                        }
                    })
                    .collect::<String>()
            }
        ),
        formula_fn!(
            /// Converts a number to Thai text (Thai Baht currency format).
            ///
            /// This function converts a number to text in Thai using the Thai
            /// numeral system for currency representation.
            #[examples("BAHTTEXT(123) = \"หนึ่งร้อยยี่สิบสามบาทถ้วน\"")]
            #[zip_map]
            fn BAHTTEXT([n]: f64) {
                number_to_baht_text(n)
            }
        ),
        formula_fn!(
            /// Formats a number as text with a dollar sign and the specified
            /// number of decimal places.
            ///
            /// If `decimals` is negative, the number is rounded to the left of
            /// the decimal point.
            ///
            /// If `decimals` is omitted, it defaults to 2.
            #[examples(
                "DOLLAR(1234.567) = \"$1,234.57\"",
                "DOLLAR(1234.567, 1) = \"$1,234.6\"",
                "DOLLAR(-1234.567) = \"-$1,234.57\""
            )]
            #[zip_map]
            fn DOLLAR([n]: f64, [decimals]: (Option<Spanned<i64>>)) {
                let decimals = decimals.map_or(2, |d| d.inner);
                format_currency_text(n, decimals, "$")
            }
        ),
        formula_fn!(
            /// Formats a number as text with a fixed number of decimal places.
            ///
            /// - `decimals`: The number of decimal places (default 2).
            /// - `no_commas`: If TRUE, omits thousands separators (default FALSE).
            #[examples(
                "FIXED(1234.567) = \"1,234.57\"",
                "FIXED(1234.567, 1) = \"1,234.6\"",
                "FIXED(1234.567, 1, TRUE) = \"1234.6\"",
                "FIXED(-1234.567, -1) = \"-1,230\""
            )]
            #[zip_map]
            fn FIXED([n]: f64, [decimals]: (Option<Spanned<i64>>), [no_commas]: (Option<bool>)) {
                let decimals = decimals.map_or(2, |d| d.inner);
                let use_commas = !no_commas.unwrap_or(false);
                format_fixed_text(n, decimals, use_commas)
            }
        ),
        formula_fn!(
            /// Returns the position of a substring within a string
            /// (case-sensitive), using byte positions.
            ///
            /// Returns an error if the substring is not found.
            ///
            /// `start_pos` is the byte position to start searching from
            /// (1-indexed, default 1).
            #[examples("FINDB(\"lo\", \"Hello\") = 4", "FINDB(\"界\", \"世界\", 1) = 4")]
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
                // Round start to a valid character boundary
                let start = ceil_char_boundary(&within_text, start);
                match within_text[start..].find(&find_text) {
                    Some(byte_pos) => (start + byte_pos + 1) as i64, // 1-indexed
                    None => return Err(RunErrorMsg::NoMatch.without_span()),
                }
            }
        ),
        formula_fn!(
            /// Returns the position of a substring within a string
            /// (case-insensitive), using byte positions. Supports wildcards: `?`
            /// matches any single character, `*` matches any sequence.
            ///
            /// Returns an error if the substring is not found.
            ///
            /// `start_pos` is the byte position to start searching from
            /// (1-indexed, default 1).
            #[examples("SEARCHB(\"LO\", \"Hello\") = 4", "SEARCHB(\"界\", \"世界\", 1) = 4")]
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
                // Round start to a valid character boundary
                let start = ceil_char_boundary(&within_text, start);
                let search_text = &within_text[start..];
                let search_text_lower = search_text.to_lowercase();
                let find_text_lower = find_text.to_lowercase();

                // Check if it's a simple search or wildcard search
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
        formula_fn!(
            /// Replaces part of a text string with a different text string,
            /// using byte positions.
            ///
            /// - `old_text`: The original text.
            /// - `start_pos`: The byte position to start replacing (1-indexed).
            /// - `num_bytes`: The number of bytes to replace.
            /// - `new_text`: The text to insert.
            #[examples(
                "REPLACEB(\"Hello\", 2, 3, \"i\") = \"Hio\"",
                "REPLACEB(\"世界\", 4, 3, \"人\") = \"世人\""
            )]
            #[zip_map]
            fn REPLACEB(
                [old_text]: String,
                [start_pos]: (Spanned<i64>),
                [num_bytes]: (Spanned<i64>),
                [new_text]: String,
            ) {
                let start = try_i64_minus_1_to_usize(start_pos)?;
                let num = try_i64_to_usize(num_bytes)?;

                // Round start to a valid character boundary
                let byte_start = ceil_char_boundary(&old_text, start);
                let byte_end = floor_char_boundary(&old_text, byte_start.saturating_add(num));

                let before = &old_text[..byte_start];
                let after = &old_text[byte_end..];

                format!("{}{}{}", before, new_text, after)
            }
        ),
        formula_fn!(
            /// Extracts phonetic (furigana) characters from a text string.
            ///
            /// In Quadratic, this function returns the original text unchanged,
            /// as phonetic information is not stored separately. In Excel, this
            /// works with Japanese text that has phonetic readings attached.
            #[examples("PHONETIC(\"東京\") = \"東京\"")]
            #[zip_map]
            fn PHONETIC([s]: String) {
                // In Excel, this extracts furigana from Japanese text.
                // Since we don't store phonetic information separately,
                // we return the original text unchanged.
                s
            }
        ),
        formula_fn!(
            /// Formats a value using a format string.
            ///
            /// Supports various format patterns:
            /// - `0` and `#` for digit placeholders
            /// - `.` for decimal point
            /// - `,` for thousands separator
            /// - `%` for percentage
            /// - Scientific notation with `E`
            /// - Date/time formats like `yyyy-mm-dd`, `hh:mm:ss`
            #[examples(
                "TEXT(1234.567, \"$#,##0.00\") = \"$1,234.57\"",
                "TEXT(0.25, \"0%\") = \"25%\"",
                "TEXT(1234.5, \"0.00E+00\") = \"1.23E+03\""
            )]
            #[zip_map]
            fn TEXT([value]: CellValue, [format_text]: String) {
                format_value_with_pattern(&value, &format_text)?
            }
        ),
        formula_fn!(
            /// Returns text that occurs after a given delimiter.
            ///
            /// - `text`: The text to search within.
            /// - `delimiter`: The delimiter to search for.
            /// - `instance_num`: Which occurrence of the delimiter (default 1).
            ///   Negative values search from the end.
            /// - `match_mode`: 0 for case-sensitive (default), 1 for
            ///   case-insensitive.
            /// - `match_end`: 0 to not match at end (default), 1 to treat text
            ///   end as delimiter.
            /// - `if_not_found`: Value to return if delimiter is not found
            ///   (default is error).
            #[examples(
                "TEXTAFTER(\"Hello World\", \" \") = \"World\"",
                "TEXTAFTER(\"Hello-World-Test\", \"-\", 2) = \"Test\"",
                "TEXTAFTER(\"Hello World\", \" \", -1) = \"World\""
            )]
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
            ///
            /// - `text`: The text to search within.
            /// - `delimiter`: The delimiter to search for.
            /// - `instance_num`: Which occurrence of the delimiter (default 1).
            ///   Negative values search from the end.
            /// - `match_mode`: 0 for case-sensitive (default), 1 for
            ///   case-insensitive.
            /// - `match_end`: 0 to not match at start (default), 1 to treat text
            ///   start as delimiter.
            /// - `if_not_found`: Value to return if delimiter is not found
            ///   (default is error).
            #[examples(
                "TEXTBEFORE(\"Hello World\", \" \") = \"Hello\"",
                "TEXTBEFORE(\"Hello-World-Test\", \"-\", 2) = \"Hello-World\"",
                "TEXTBEFORE(\"Hello World\", \" \", -1) = \"Hello\""
            )]
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
            ///
            /// - `text`: The text to split.
            /// - `col_delimiter`: The delimiter for splitting into columns.
            /// - `row_delimiter`: The delimiter for splitting into rows
            ///   (optional).
            /// - `ignore_empty`: If TRUE, ignores consecutive delimiters (default
            ///   FALSE).
            /// - `match_mode`: 0 for case-sensitive (default), 1 for
            ///   case-insensitive.
            /// - `pad_with`: Value to use for missing cells (default empty
            ///   string).
            #[examples(
                "TEXTSPLIT(\"a,b,c\", \",\") = {\"a\", \"b\", \"c\"}",
                "TEXTSPLIT(\"a,b;c,d\", \",\", \";\") = {{\"a\", \"b\"}; {\"c\", \"d\"}}"
            )]
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

                        // Split by rows first, then by columns
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

                        // Pad rows to have equal columns
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
                        // Split only by columns
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
        formula_fn!(
            /// Converts a text string that represents a number to a number.
            ///
            /// Handles various number formats including currency symbols,
            /// percentages, and thousands separators.
            #[examples(
                "VALUE(\"123.45\") = 123.45",
                "VALUE(\"$1,234.56\") = 1234.56",
                "VALUE(\"25%\") = 0.25"
            )]
            #[zip_map]
            fn VALUE(span: Span, [s]: String) {
                parse_value_text(&s).ok_or_else(|| RunErrorMsg::InvalidArgument.with_span(span))?
            }
        ),
        formula_fn!(
            /// Converts a value to text.
            ///
            /// If `format` is 0 or omitted, returns a human-readable
            /// representation. If `format` is 1, returns a machine-readable
            /// representation in valid formula syntax.
            #[examples(
                "VALUETOTEXT(123) = \"123\"",
                "VALUETOTEXT(\"Hello\") = \"Hello\"",
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
    ]
}

fn unicode(span: Span, s: String) -> CodeResult<u32> {
    match s.chars().next() {
        Some(c) => Ok(c as u32),
        None => Err(RunErrorMsg::InvalidArgument.with_span(span)),
    }
}
fn unichar(span: Span, code_point: u32) -> CodeResult<char> {
    char::from_u32(code_point)
        .filter(|&c| c != '\0')
        .ok_or_else(|| RunErrorMsg::InvalidArgument.with_span(span))
}

fn try_i64_to_usize(Spanned { span, inner: n }: Spanned<i64>) -> CodeResult<usize> {
    usize::try_from(n).map_err(|_| RunErrorMsg::InvalidArgument.with_span(span))
}
fn try_i64_minus_1_to_usize(value: Spanned<i64>) -> CodeResult<usize> {
    try_i64_to_usize(value.map(|n| i64::saturating_sub(n, 1)))
}

fn floor_char_boundary(s: &str, mut byte_index: usize) -> usize {
    // At time of writing, `str::floor_char_boundary()` is still
    // unstable: https://github.com/rust-lang/rust/issues/93743
    if byte_index >= s.len() {
        s.len()
    } else {
        while !s.is_char_boundary(byte_index) {
            byte_index -= 1;
        }
        byte_index
    }
}

fn ceil_char_boundary(s: &str, mut byte_index: usize) -> usize {
    // At time of writing, `str::ceil_char_boundary()` is still
    // unstable: https://github.com/rust-lang/rust/issues/93743
    if byte_index >= s.len() {
        s.len()
    } else {
        while !s.is_char_boundary(byte_index) {
            byte_index += 1;
        }
        byte_index
    }
}

fn first_char_of_nonempty_string(arg: &Option<Spanned<String>>) -> CodeResult<Option<char>> {
    match arg {
        Some(s) => {
            Ok(Some(s.inner.chars().next().ok_or_else(|| {
                RunErrorMsg::InvalidArgument.with_span(s.span)
            })?))
        }
        None => Ok(None),
    }
}

/// Converts full-width katakana to half-width.
fn full_to_half_katakana(c: char) -> Option<char> {
    // Full-width katakana range: U+30A1 to U+30F6
    // Half-width katakana range: U+FF66 to U+FF9D
    match c {
        'ァ' => Some('ｧ'),
        'ア' => Some('ｱ'),
        'ィ' => Some('ｨ'),
        'イ' => Some('ｲ'),
        'ゥ' => Some('ｩ'),
        'ウ' => Some('ｳ'),
        'ェ' => Some('ｪ'),
        'エ' => Some('ｴ'),
        'ォ' => Some('ｫ'),
        'オ' => Some('ｵ'),
        'カ' => Some('ｶ'),
        'キ' => Some('ｷ'),
        'ク' => Some('ｸ'),
        'ケ' => Some('ｹ'),
        'コ' => Some('ｺ'),
        'サ' => Some('ｻ'),
        'シ' => Some('ｼ'),
        'ス' => Some('ｽ'),
        'セ' => Some('ｾ'),
        'ソ' => Some('ｿ'),
        'タ' => Some('ﾀ'),
        'チ' => Some('ﾁ'),
        'ツ' => Some('ﾂ'),
        'テ' => Some('ﾃ'),
        'ト' => Some('ﾄ'),
        'ナ' => Some('ﾅ'),
        'ニ' => Some('ﾆ'),
        'ヌ' => Some('ﾇ'),
        'ネ' => Some('ﾈ'),
        'ノ' => Some('ﾉ'),
        'ハ' => Some('ﾊ'),
        'ヒ' => Some('ﾋ'),
        'フ' => Some('ﾌ'),
        'ヘ' => Some('ﾍ'),
        'ホ' => Some('ﾎ'),
        'マ' => Some('ﾏ'),
        'ミ' => Some('ﾐ'),
        'ム' => Some('ﾑ'),
        'メ' => Some('ﾒ'),
        'モ' => Some('ﾓ'),
        'ヤ' => Some('ﾔ'),
        'ユ' => Some('ﾕ'),
        'ヨ' => Some('ﾖ'),
        'ラ' => Some('ﾗ'),
        'リ' => Some('ﾘ'),
        'ル' => Some('ﾙ'),
        'レ' => Some('ﾚ'),
        'ロ' => Some('ﾛ'),
        'ワ' => Some('ﾜ'),
        'ヲ' => Some('ｦ'),
        'ン' => Some('ﾝ'),
        'ー' => Some('ｰ'),
        '。' => Some('｡'),
        '「' => Some('｢'),
        '」' => Some('｣'),
        '、' => Some('､'),
        '・' => Some('･'),
        _ => None,
    }
}

/// Converts half-width katakana to full-width.
fn half_to_full_katakana(c: char) -> Option<char> {
    match c {
        'ｧ' => Some('ァ'),
        'ｱ' => Some('ア'),
        'ｨ' => Some('ィ'),
        'ｲ' => Some('イ'),
        'ｩ' => Some('ゥ'),
        'ｳ' => Some('ウ'),
        'ｪ' => Some('ェ'),
        'ｴ' => Some('エ'),
        'ｫ' => Some('ォ'),
        'ｵ' => Some('オ'),
        'ｶ' => Some('カ'),
        'ｷ' => Some('キ'),
        'ｸ' => Some('ク'),
        'ｹ' => Some('ケ'),
        'ｺ' => Some('コ'),
        'ｻ' => Some('サ'),
        'ｼ' => Some('シ'),
        'ｽ' => Some('ス'),
        'ｾ' => Some('セ'),
        'ｿ' => Some('ソ'),
        'ﾀ' => Some('タ'),
        'ﾁ' => Some('チ'),
        'ﾂ' => Some('ツ'),
        'ﾃ' => Some('テ'),
        'ﾄ' => Some('ト'),
        'ﾅ' => Some('ナ'),
        'ﾆ' => Some('ニ'),
        'ﾇ' => Some('ヌ'),
        'ﾈ' => Some('ネ'),
        'ﾉ' => Some('ノ'),
        'ﾊ' => Some('ハ'),
        'ﾋ' => Some('ヒ'),
        'ﾌ' => Some('フ'),
        'ﾍ' => Some('ヘ'),
        'ﾎ' => Some('ホ'),
        'ﾏ' => Some('マ'),
        'ﾐ' => Some('ミ'),
        'ﾑ' => Some('ム'),
        'ﾒ' => Some('メ'),
        'ﾓ' => Some('モ'),
        'ﾔ' => Some('ヤ'),
        'ﾕ' => Some('ユ'),
        'ﾖ' => Some('ヨ'),
        'ﾗ' => Some('ラ'),
        'ﾘ' => Some('リ'),
        'ﾙ' => Some('ル'),
        'ﾚ' => Some('レ'),
        'ﾛ' => Some('ロ'),
        'ﾜ' => Some('ワ'),
        'ｦ' => Some('ヲ'),
        'ﾝ' => Some('ン'),
        'ｰ' => Some('ー'),
        '｡' => Some('。'),
        '｢' => Some('「'),
        '｣' => Some('」'),
        '､' => Some('、'),
        '･' => Some('・'),
        _ => None,
    }
}

/// Thai number words
const THAI_DIGITS: [&str; 10] = [
    "ศูนย์",
    "หนึ่ง",
    "สอง",
    "สาม",
    "สี่",
    "ห้า",
    "หก",
    "เจ็ด",
    "แปด",
    "เก้า",
];
const THAI_SPECIAL_ONE: &str = "เอ็ด";
const THAI_SPECIAL_TWO: &str = "ยี่";
const THAI_UNITS: [&str; 6] = ["", "สิบ", "ร้อย", "พัน", "หมื่น", "แสน"];
const THAI_MILLION: &str = "ล้าน";
const THAI_BAHT: &str = "บาท";
const THAI_SATANG: &str = "สตางค์";
const THAI_ONLY: &str = "ถ้วน";

/// Converts a number to Thai Baht text.
fn number_to_baht_text(n: f64) -> String {
    if n == 0.0 {
        return format!("{}{}{}", THAI_DIGITS[0], THAI_BAHT, THAI_ONLY);
    }

    let is_negative = n < 0.0;
    let abs_n = n.abs();

    // Split into baht and satang
    let baht_part = abs_n.trunc() as i64;
    let satang_part = ((abs_n.fract() * 100.0).round() as i64) % 100;

    let mut result = String::new();

    if is_negative {
        result.push_str("ลบ");
    }

    if baht_part > 0 {
        result.push_str(&thai_number_to_text(baht_part));
        result.push_str(THAI_BAHT);
    }

    if satang_part > 0 {
        result.push_str(&thai_number_to_text(satang_part));
        result.push_str(THAI_SATANG);
    } else if baht_part > 0 {
        result.push_str(THAI_ONLY);
    } else {
        result.push_str(THAI_DIGITS[0]);
        result.push_str(THAI_BAHT);
        result.push_str(THAI_ONLY);
    }

    result
}

/// Converts an integer to Thai text.
fn thai_number_to_text(mut n: i64) -> String {
    if n == 0 {
        return THAI_DIGITS[0].to_string();
    }

    let mut result = String::new();
    let mut millions = 0;

    while n > 0 {
        let group = (n % 1_000_000) as usize;
        n /= 1_000_000;

        if group > 0 {
            let group_text = thai_group_to_text(group, millions > 0);
            if millions > 0 {
                result = format!("{}{}{}", group_text, THAI_MILLION.repeat(millions), result);
            } else {
                result = group_text;
            }
        }
        millions += 1;
    }

    result
}

/// Converts a group of up to 6 digits to Thai text.
fn thai_group_to_text(n: usize, has_more: bool) -> String {
    if n == 0 {
        return String::new();
    }

    let mut result = String::new();
    let mut remaining = n;

    let mut digits = Vec::new();
    while remaining > 0 {
        digits.push(remaining % 10);
        remaining /= 10;
    }
    digits.reverse();

    let len = digits.len();
    for (i, &digit) in digits.iter().enumerate() {
        let position = len - i - 1;

        if digit == 0 {
            continue;
        }

        if position == 1 && digit == 1 {
            // "สิบ" without "หนึ่ง" prefix for 10s place
            result.push_str(THAI_UNITS[position]);
        } else if position == 1 && digit == 2 {
            // Special "ยี่" for 20s
            result.push_str(THAI_SPECIAL_TWO);
            result.push_str(THAI_UNITS[position]);
        } else if position == 0 && digit == 1 && (len > 1 || has_more) {
            // "เอ็ด" for trailing 1 (except when it's the only digit)
            result.push_str(THAI_SPECIAL_ONE);
        } else {
            result.push_str(THAI_DIGITS[digit]);
            result.push_str(THAI_UNITS[position]);
        }
    }

    result
}

/// Formats a number as currency text.
fn format_currency_text(n: f64, decimals: i64, symbol: &str) -> String {
    let formatted = format_fixed_text(n.abs(), decimals, true);
    if n < 0.0 {
        format!("-{}{}", symbol, formatted)
    } else {
        format!("{}{}", symbol, formatted)
    }
}

/// Formats a number with fixed decimal places and optional commas.
fn format_fixed_text(n: f64, decimals: i64, use_commas: bool) -> String {
    // Handle negative decimals (round to left of decimal point)
    let rounded = if decimals < 0 {
        let factor = 10_f64.powi(-decimals as i32);
        (n / factor).round() * factor
    } else {
        n
    };

    let formatted = if decimals >= 0 {
        format!("{:.prec$}", rounded, prec = decimals as usize)
    } else {
        format!("{:.0}", rounded)
    };

    if use_commas {
        add_thousands_separators(&formatted)
    } else {
        formatted
    }
}

/// Adds thousands separators to a formatted number string.
fn add_thousands_separators(s: &str) -> String {
    let is_negative = s.starts_with('-');
    let s = if is_negative { &s[1..] } else { s };

    let (integer_part, decimal_part) = match s.find('.') {
        Some(pos) => (&s[..pos], Some(&s[pos..])),
        None => (s, None),
    };

    let mut result = String::new();
    for (i, c) in integer_part.chars().rev().enumerate() {
        if i > 0 && i % 3 == 0 {
            result.insert(0, ',');
        }
        result.insert(0, c);
    }

    if is_negative {
        result.insert(0, '-');
    }

    if let Some(dec) = decimal_part {
        result.push_str(dec);
    }

    result
}

/// Formats a value using a format pattern string.
fn format_value_with_pattern(value: &CellValue, pattern: &str) -> CodeResult<String> {
    let pattern_lower = pattern.to_lowercase();

    // Handle percentage format
    if pattern_lower.contains('%') {
        if let Some(n) = value.to_number() {
            let percentage = n * 100.0;
            let decimals = count_decimal_places(pattern);
            let formatted = format!("{:.prec$}", percentage, prec = decimals);
            let with_commas = if pattern.contains(',') {
                add_thousands_separators(&formatted)
            } else {
                formatted
            };
            return Ok(format!("{}%", with_commas));
        }
    }

    // Handle scientific notation
    if pattern_lower.contains('e') {
        if let Some(n) = value.to_number() {
            let decimals = count_decimal_places_before_e(pattern);
            let formatted = format!("{:.prec$e}", n, prec = decimals);
            // Parse and reformat the exponent to be zero-padded if needed
            let result = if let Some(e_pos) = formatted.find('e') {
                let mantissa = &formatted[..e_pos];
                let exp_str = &formatted[e_pos + 1..];
                let exp: i32 = exp_str.parse().unwrap_or(0);
                let use_upper = pattern.contains('E');
                let show_plus = pattern.contains("E+") || pattern.contains("e+");
                let exp_sign = if exp >= 0 && show_plus {
                    "+"
                } else if exp < 0 {
                    "-"
                } else {
                    ""
                };
                let e_char = if use_upper { "E" } else { "e" };
                format!("{}{}{}{:02}", mantissa, e_char, exp_sign, exp.abs())
            } else {
                formatted
            };
            return Ok(result);
        }
    }

    // Handle date/time formats
    if is_date_time_format(pattern) {
        return format_date_time(value, pattern);
    }

    // Handle general number formats
    if let Some(n) = value.to_number() {
        let has_currency = extract_currency_symbol(pattern);
        let decimals = count_decimal_places(pattern);
        let use_commas = pattern.contains(',') || pattern.contains("#,");

        let formatted = format!("{:.prec$}", n.abs(), prec = decimals);
        let with_commas = if use_commas {
            add_thousands_separators(&formatted)
        } else {
            formatted
        };

        let mut result = String::new();
        if n < 0.0 {
            result.push('-');
        }
        if let Some(symbol) = has_currency {
            result.push_str(symbol);
        }
        result.push_str(&with_commas);
        return Ok(result);
    }

    // For non-numeric values, just return the display representation
    Ok(value.to_display())
}

/// Counts decimal places in a format pattern.
fn count_decimal_places(pattern: &str) -> usize {
    if let Some(dot_pos) = pattern.find('.') {
        let after_dot = &pattern[dot_pos + 1..];
        after_dot
            .chars()
            .take_while(|&c| c == '0' || c == '#')
            .count()
    } else {
        0
    }
}

/// Counts decimal places before 'E' in scientific notation format.
fn count_decimal_places_before_e(pattern: &str) -> usize {
    let pattern_lower = pattern.to_lowercase();
    if let Some(e_pos) = pattern_lower.find('e') {
        count_decimal_places(&pattern[..e_pos])
    } else {
        count_decimal_places(pattern)
    }
}

/// Extracts currency symbol from format pattern.
fn extract_currency_symbol(pattern: &str) -> Option<&str> {
    if pattern.starts_with('$') {
        Some("$")
    } else if pattern.starts_with('€') {
        Some("€")
    } else if pattern.starts_with('£') {
        Some("£")
    } else if pattern.starts_with('¥') {
        Some("¥")
    } else {
        None
    }
}

/// Checks if a format pattern is for date/time.
fn is_date_time_format(pattern: &str) -> bool {
    let p = pattern.to_lowercase();
    p.contains("yyyy")
        || p.contains("yy")
        || p.contains("mm")
        || p.contains("dd")
        || p.contains("hh")
        || p.contains("ss")
        || p.contains("am")
        || p.contains("pm")
}

/// Formats a value as date/time using a pattern.
fn format_date_time(value: &CellValue, pattern: &str) -> CodeResult<String> {
    match value {
        CellValue::Date(d) => {
            let mut result = pattern.to_string();
            result = result.replace("yyyy", &format!("{:04}", d.year()));
            result = result.replace("yy", &format!("{:02}", d.year() % 100));
            result = result.replace("mmmm", &month_name(d.month()));
            result = result.replace("mmm", &month_abbrev(d.month()));
            result = result.replace("mm", &format!("{:02}", d.month()));
            result = result.replace("dddd", &weekday_name(d.weekday()));
            result = result.replace("ddd", &weekday_abbrev(d.weekday()));
            result = result.replace("dd", &format!("{:02}", d.day()));
            Ok(result)
        }
        CellValue::DateTime(dt) => {
            let d = dt.date();
            let t = dt.time();
            let mut result = pattern.to_string();
            result = result.replace("yyyy", &format!("{:04}", d.year()));
            result = result.replace("yy", &format!("{:02}", d.year() % 100));
            result = result.replace("mmmm", &month_name(d.month()));
            result = result.replace("mmm", &month_abbrev(d.month()));

            // Handle mm carefully - could be month or minute
            if result.contains("hh") || result.contains("ss") {
                // It's a time format, mm means minutes
                let time_mm = format!("{:02}", t.minute());
                result = result.replace("mm", &time_mm);
            } else {
                result = result.replace("mm", &format!("{:02}", d.month()));
            }

            result = result.replace("dddd", &weekday_name(d.weekday()));
            result = result.replace("ddd", &weekday_abbrev(d.weekday()));
            result = result.replace("dd", &format!("{:02}", d.day()));
            result = result.replace("hh", &format!("{:02}", t.hour()));
            result = result.replace("ss", &format!("{:02}", t.second()));
            Ok(result)
        }
        CellValue::Time(t) => {
            let mut result = pattern.to_string();
            let hour = t.hour();
            let is_pm = hour >= 12;
            let hour_12 = if hour == 0 {
                12
            } else if hour > 12 {
                hour - 12
            } else {
                hour
            };

            if pattern.to_lowercase().contains("am") || pattern.to_lowercase().contains("pm") {
                result = result.replace("hh", &format!("{:02}", hour_12));
                result = result.replace("AM/PM", if is_pm { "PM" } else { "AM" });
                result = result.replace("am/pm", if is_pm { "pm" } else { "am" });
            } else {
                result = result.replace("hh", &format!("{:02}", hour));
            }
            result = result.replace("mm", &format!("{:02}", t.minute()));
            result = result.replace("ss", &format!("{:02}", t.second()));
            Ok(result)
        }
        CellValue::Number(n) => {
            // Excel serial date number - convert to date
            // Excel epoch: January 1, 1900 = 1
            let days = n.to_i64().unwrap_or(0);
            if days >= 1 {
                use chrono::NaiveDate;
                if let Some(date) = NaiveDate::from_ymd_opt(1899, 12, 30)
                    .and_then(|d| d.checked_add_days(chrono::Days::new(days as u64)))
                {
                    let temp_value = CellValue::Date(date);
                    return format_date_time(&temp_value, pattern);
                }
            }
            Ok(value.to_display())
        }
        _ => Ok(value.to_display()),
    }
}

fn month_name(month: u32) -> String {
    match month {
        1 => "January",
        2 => "February",
        3 => "March",
        4 => "April",
        5 => "May",
        6 => "June",
        7 => "July",
        8 => "August",
        9 => "September",
        10 => "October",
        11 => "November",
        12 => "December",
        _ => "",
    }
    .to_string()
}

fn month_abbrev(month: u32) -> String {
    match month {
        1 => "Jan",
        2 => "Feb",
        3 => "Mar",
        4 => "Apr",
        5 => "May",
        6 => "Jun",
        7 => "Jul",
        8 => "Aug",
        9 => "Sep",
        10 => "Oct",
        11 => "Nov",
        12 => "Dec",
        _ => "",
    }
    .to_string()
}

fn weekday_name(weekday: chrono::Weekday) -> String {
    match weekday {
        chrono::Weekday::Mon => "Monday",
        chrono::Weekday::Tue => "Tuesday",
        chrono::Weekday::Wed => "Wednesday",
        chrono::Weekday::Thu => "Thursday",
        chrono::Weekday::Fri => "Friday",
        chrono::Weekday::Sat => "Saturday",
        chrono::Weekday::Sun => "Sunday",
    }
    .to_string()
}

fn weekday_abbrev(weekday: chrono::Weekday) -> String {
    match weekday {
        chrono::Weekday::Mon => "Mon",
        chrono::Weekday::Tue => "Tue",
        chrono::Weekday::Wed => "Wed",
        chrono::Weekday::Thu => "Thu",
        chrono::Weekday::Fri => "Fri",
        chrono::Weekday::Sat => "Sat",
        chrono::Weekday::Sun => "Sun",
    }
    .to_string()
}

/// Returns text after a delimiter.
fn text_after<'a>(
    text: &'a str,
    delimiter: &str,
    instance: i64,
    case_insensitive: bool,
    match_end_as_delim: bool,
) -> Option<&'a str> {
    if delimiter.is_empty() {
        return Some(text);
    }

    let text_for_search = if case_insensitive {
        text.to_lowercase()
    } else {
        text.to_string()
    };
    let delim_for_search = if case_insensitive {
        delimiter.to_lowercase()
    } else {
        delimiter.to_string()
    };

    let positions: Vec<usize> = text_for_search
        .match_indices(&delim_for_search)
        .map(|(i, _)| i)
        .collect();

    if positions.is_empty() {
        if match_end_as_delim && instance == 1 {
            return Some("");
        }
        return None;
    }

    let index = if instance > 0 {
        (instance - 1) as usize
    } else {
        let abs_instance = (-instance) as usize;
        if abs_instance > positions.len() {
            return None;
        }
        positions.len() - abs_instance
    };

    if index >= positions.len() {
        if match_end_as_delim {
            return Some("");
        }
        return None;
    }

    let pos = positions[index];
    Some(&text[pos + delimiter.len()..])
}

/// Returns text before a delimiter.
fn text_before<'a>(
    text: &'a str,
    delimiter: &str,
    instance: i64,
    case_insensitive: bool,
    match_start_as_delim: bool,
) -> Option<&'a str> {
    if delimiter.is_empty() {
        return Some(text);
    }

    let text_for_search = if case_insensitive {
        text.to_lowercase()
    } else {
        text.to_string()
    };
    let delim_for_search = if case_insensitive {
        delimiter.to_lowercase()
    } else {
        delimiter.to_string()
    };

    let positions: Vec<usize> = text_for_search
        .match_indices(&delim_for_search)
        .map(|(i, _)| i)
        .collect();

    if positions.is_empty() {
        if match_start_as_delim && instance == 1 {
            return Some("");
        }
        return None;
    }

    let index = if instance > 0 {
        (instance - 1) as usize
    } else {
        let abs_instance = (-instance) as usize;
        if abs_instance > positions.len() {
            return None;
        }
        positions.len() - abs_instance
    };

    if index >= positions.len() {
        if match_start_as_delim {
            return Some("");
        }
        return None;
    }

    let pos = positions[index];
    Some(&text[..pos])
}

/// Splits text while keeping track of original positions (for case-insensitive splitting).
fn split_keeping_positions<'a>(
    original: &'a str,
    lowercase: &str,
    delimiter: &str,
    ignore_empty: bool,
) -> Vec<&'a str> {
    if delimiter.is_empty() {
        return vec![original];
    }

    let mut result = Vec::new();
    let mut last_end = 0;

    for (pos, _) in lowercase.match_indices(delimiter) {
        let part = &original[last_end..pos];
        if !ignore_empty || !part.is_empty() {
            result.push(part);
        }
        last_end = pos + delimiter.len();
    }

    // Add the remaining part
    let remaining = &original[last_end..];
    if !ignore_empty || !remaining.is_empty() {
        result.push(remaining);
    }

    result
}

/// Parses a text string as a number.
fn parse_value_text(s: &str) -> Option<f64> {
    let s = s.trim();

    if s.is_empty() {
        return Some(0.0);
    }

    // Try direct parsing first
    if let Ok(n) = s.parse::<f64>() {
        return Some(n);
    }

    // Handle percentage
    if s.ends_with('%') {
        let num_part = s.trim_end_matches('%').trim();
        if let Ok(n) = num_part.parse::<f64>() {
            return Some(n / 100.0);
        }
        // Try with commas removed
        let cleaned: String = num_part.chars().filter(|&c| c != ',').collect();
        if let Ok(n) = cleaned.parse::<f64>() {
            return Some(n / 100.0);
        }
    }

    // Handle currency and commas
    let cleaned: String = s
        .chars()
        .filter(|&c| c.is_ascii_digit() || c == '.' || c == '-' || c == '+')
        .collect();

    if let Ok(n) = cleaned.parse::<f64>() {
        // Check if there was a negative sign in a currency format like ($1,234)
        if s.starts_with('(') && s.ends_with(')') {
            return Some(-n);
        }
        // Check for negative currency like -$1,234
        if s.starts_with('-') || s.contains("-$") || s.contains("-€") {
            if n > 0.0 && !cleaned.starts_with('-') {
                return Some(-n);
            }
        }
        return Some(n);
    }

    // Try parsing with decimal_from_str for more formats
    if let Ok(d) = decimal_from_str(s) {
        return d.to_f64();
    }

    None
}

#[cfg(test)]
mod tests {
    use crate::{controller::GridController, formulas::tests::*};

    #[test]
    fn test_formula_array_to_text() {
        let a = array!["Apple", "banana"; 42.0, "Hello, world!"];
        let g = GridController::from_grid(Grid::from_array(pos![A1], &a), 0);
        assert_eq!(
            "Apple, banana, 42, Hello, world!",
            eval_to_string(&g, "ARRAYTOTEXT(A1:B2)"),
        );
        assert_eq!(
            "Apple, banana, 42, Hello, world!",
            eval_to_string(&g, "ARRAYTOTEXT(A1:B2, 0)"),
        );
        assert_eq!(
            "{\"Apple\", \"banana\"; 42, \"Hello, world!\"}",
            eval_to_string(&g, "ARRAYTOTEXT(A1:B2, 1)"),
        );
        assert_eq!(
            RunErrorMsg::InvalidArgument,
            eval_to_err(&g, "ARRAYTOTEXT(A1:B2, 2)").msg,
        );
    }

    #[test]
    fn test_formula_concat() {
        let g = GridController::new();
        assert_eq!(
            "Hello, 14000605 worlds!".to_string(),
            eval_to_string(&g, "\"Hello, \" & 14000605 & ' worlds!'"),
        );
        assert_eq!(
            "Hello, 14000605 worlds!".to_string(),
            eval_to_string(&g, "CONCAT('Hello, ',14000605,\" worlds!\")"),
        );
        assert_eq!(
            "Hello, 14000605 worlds!".to_string(),
            eval_to_string(&g, "CONCATENATE('Hello, ',14000605,\" worlds!\")"),
        );
    }

    #[test]
    fn test_formula_left_right_mid() {
        let g = GridController::new();

        for (formula, expected_output) in [
            // LEFT
            ("LEFT('Hello, world!')", "H"),
            ("LEFT('Hello, world!', 0)", ""),
            ("LEFT('Hello, world!', 6)", "Hello,"),
            ("LEFT('Hello, world!', 99)", "Hello, world!"),
            ("LEFT('抱', 6)", "抱"),
            ("LEFT('抱歉，我不懂普通话', 6)", "抱歉，我不懂"),
            // LEFTB
            ("LEFTB('Hello, world!')", "H"),
            ("LEFTB('Hello, world!', 0)", ""),
            ("LEFTB('Hello, world!', 6)", "Hello,"),
            ("LEFTB('Hello, world!', 99)", "Hello, world!"),
            ("LEFTB('抱歉，我不懂普通话')", ""),
            ("LEFTB('抱歉，我不懂普通话', 6)", "抱歉"),
            ("LEFTB('抱歉，我不懂普通话', 8)", "抱歉"),
            // RIGHT
            ("RIGHT('Hello, world!', 6)", "world!"),
            ("RIGHT('Hello, world!', 0)", ""),
            ("RIGHT('Hello, world!')", "!"),
            ("RIGHT('Hello, world!', 99)", "Hello, world!"),
            ("RIGHT('抱歉，我不懂普通话')", "话"),
            ("RIGHT('抱歉，我不懂普通话', 6)", "我不懂普通话"),
            // RIGHTB
            ("RIGHTB('Hello, world!')", "!"),
            ("RIGHTB('Hello, world!', 0)", ""),
            ("RIGHTB('Hello, world!', 6)", "world!"),
            ("RIGHTB('Hello, world!', 99)", "Hello, world!"),
            ("RIGHTB('抱歉，我不懂普通话')", ""),
            ("RIGHTB('抱歉，我不懂普通话', 6)", "通话"),
            ("RIGHTB('抱歉，我不懂普通话', 7)", "通话"),
            // MID
            ("MID(\"Hello, world!\", 4, 6)", "lo, wo"),
            ("MID(\"Hello, world!\", 4, 99)", "lo, world!"),
            ("MID(\"Hello, world!\", 1, 5)", "Hello"),
            ("MID(\"抱歉，我不懂普通话\", 4, 4)", "我不懂普"),
            // MIDB
            ("MIDB(\"Hello, world!\", 4, 6)", "lo, wo"),
            ("MIDB(\"Hello, world!\", 4, 99)", "lo, world!"),
            ("MIDB(\"Hello, world!\", 1, 5)", "Hello"),
            ("MIDB(\"抱歉，我不懂普通话\", 10, 12)", "我不懂普"),
            ("MIDB(\"抱歉，我不懂普通话\", 8, 16)", "我不懂普"),
        ] {
            assert_eq!(expected_output, eval_to_string(&g, formula));
        }

        for formula in [
            // LEFT
            "LEFT('Hello, world!', -1)",
            "LEFT('Hello, world!', -10)",
            // LEFTB
            "LEFTB('Hello, world!', -1)",
            "LEFTB('Hello, world!', -10)",
            // RIGHT
            "RIGHT('Hello, world!', -1)",
            "RIGHT('Hello, world!', -10)",
            // RIGHTB
            "RIGHTB('Hello, world!', -1)",
            "RIGHTB('Hello, world!', -10)",
            // MID
            "MID('Hello, world!', 0, 5)",
            "MID('Hello, world!', -5, 5)",
            "MID('Hello, world!', 5, -1)",
            "MID('Hello, world!', 5, -10)",
            // MIDB
            "MIDB('Hello, world!', 0, 5)",
            "MIDB('Hello, world!', -5, 5)",
            "MIDB('Hello, world!', 5, -1)",
            "MIDB('Hello, world!', 5, -10)",
        ] {
            assert_eq!(RunErrorMsg::InvalidArgument, eval_to_err(&g, formula).msg);
        }
    }

    #[test]
    fn test_formula_len_and_lenb() {
        let g = GridController::new();

        // Excel uses UTF-16 code points, so those are included here in case we
        // later decide we want that for compatibility.
        for (string, codepoints, bytes, _utf_16_code_units) in [
            ("", 0, 0, 0),
            ("résumé", 6, 8, 8),
            ("ȍ̶̭h̸̲͝ ̵͈̚ņ̶̾ő̶͖", 17, 32, 17),
            ("ą̷̬͔̖̤̎̀͆̄̅̓̕͝", 14, 28, 14),
            ("😂", 1, 4, 2),
            ("ĩ", 1, 2, 5),
            ("👨‍🚀", 3, 11, 5),
            ("👍🏿", 2, 8, 4),
        ] {
            assert_eq!(
                codepoints.to_string(),
                eval_to_string(&g, &format!("LEN(\"{string}\")")),
            );
            assert_eq!(
                bytes.to_string(),
                eval_to_string(&g, &format!("LENB(\"{string}\")")),
            );
        }

        // Test zip-mapping
        assert_eq!(
            "{2, 3; 1, 4}",
            eval_to_string(&g, "LEN({\"aa\", \"bbb\"; \"c\", \"dddd\"})"),
        );
        assert_eq!(
            "{2, 3; 1, 4}",
            eval_to_string(&g, "LENB({\"aa\", \"bbb\"; \"c\", \"dddd\"})"),
        );
    }

    #[test]
    fn test_formula_code() {
        let g = GridController::new();

        // These share implementation so we only need to thoroughly test one.
        assert_eq!("65", eval_to_string(&g, "CODE('ABC')"));
        assert_eq!("65", eval_to_string(&g, "UNICODE('ABC')"));

        assert_eq!("97", eval_to_string(&g, "UNICODE('a')"));
        assert_eq!("65", eval_to_string(&g, "UNICODE('A')"));
        assert_eq!(
            RunErrorMsg::InvalidArgument,
            eval_to_err(&g, "UNICODE('')").msg,
        );
    }

    #[test]
    fn test_formula_char() {
        let g = GridController::new();

        // These share implementation so we only need to thoroughly test one.
        assert_eq!("A", eval_to_string(&g, "CHAR(65)"));
        assert_eq!("A", eval_to_string(&g, "UNICHAR(65)"));

        assert_eq!("a", eval_to_string(&g, "UNICHAR(97)"));

        // Excel rounds numbers down, so even `65.9` would still give `A`.
        // We're incompatible in that respect.
        assert_eq!("A", eval_to_string(&g, "UNICHAR(65.4)")); // round to int

        assert_eq!("F", eval_to_string(&g, "UNICHAR(65+5)"));

        assert_eq!(
            RunErrorMsg::InvalidArgument,
            eval_to_err(&g, "UNICHAR(-3)").msg,
        );
        assert_eq!(
            RunErrorMsg::InvalidArgument,
            eval_to_err(&g, "UNICHAR(0)").msg,
        );
        assert_eq!(
            RunErrorMsg::InvalidArgument,
            eval_to_err(&g, "UNICHAR(2^24)").msg,
        );
    }

    #[test]
    fn test_formula_clean() {
        let g = GridController::new();

        assert_eq!(
            "  A BC",
            eval_to_string(&g, "CLEAN(\"  A\u{0} \u{A}\nB\u{1C}C\t\")"),
        );

        // Test idempotence
        assert_eq!("  A BC", eval_to_string(&g, "CLEAN(\"  A BC\")"));
    }

    #[test]
    fn test_formula_trim() {
        let g = GridController::new();

        assert_eq!(
            "I'm in \t space!\n",
            eval_to_string(&g, "TRIM(\"   I'm in  \t    space!\n   \")"),
        );

        // Test idempotence
        assert_eq!(
            "I'm in \t space!\n",
            eval_to_string(&g, "TRIM(\"I'm in \t space!\n\")"),
        );
    }

    #[test]
    fn test_formula_casing() {
        let g = GridController::new();

        let odysseus = "ὈΔΥΣΣΕΎΣ is my FAVORITE character!";
        assert_eq!(
            "ὀδυσσεύς is my favorite character!",
            eval_to_string(&g, &format!("LOWER({odysseus:?})")),
        );
        assert_eq!(
            "ὈΔΥΣΣΕΎΣ IS MY FAVORITE CHARACTER!",
            eval_to_string(&g, &format!("UPPER({odysseus:?})")),
        );
        assert_eq!(
            "Ὀδυσσεύς Is My Favorite Character!",
            eval_to_string(&g, &format!("PROPER({odysseus:?})")),
        );

        let goodbye = "tschüß, my friend";
        assert_eq!(goodbye, eval_to_string(&g, &format!("LOWER({goodbye:?})")));
        assert_eq!(
            "TSCHÜSS, MY FRIEND",
            eval_to_string(&g, &format!("UPPER({goodbye:?})")),
        );
        assert_eq!(
            "Tschüß, My Friend",
            eval_to_string(&g, &format!("PROPER({goodbye:?})")),
        );

        // Excel considers the string "Σ" to contain a final sigma and so it's
        // lowercased to "ς", but Rust lowercases it to "σ". For context: Rust
        // contains a hard-coded exception for sigma.
        // https://doc.rust-lang.org/1.80.1/src/alloc/str.rs.html#379-387
        assert_eq!("σ", eval_to_string(&g, "LOWER('Σ')"));
        // assert_eq!("ς", eval_to_string(&g, &format!("LOWER('Σ')"))); // This is what Excel does

        // You think Excel handles ligature characters correctly? Ha! Nope.
        assert_eq!("ǆa", eval_to_string(&g, "LOWER('ǄA')"));
        assert_eq!("ǄA", eval_to_string(&g, "UPPER('ǆa')"));
        assert_eq!("ǅa", eval_to_string(&g, "PROPER('ǆA')"));
        // assert_eq!("Ǆa", eval_to_string(&g, "PROPER('ǆA')")); // This is what Excel does
    }

    #[test]
    fn test_formula_t() {
        let g = GridController::new();
        assert_eq!("some text", eval_to_string(&g, "T(\"some text\")"));
        assert_eq!("123", eval_to_string(&g, "T(\"123\")"));
        assert_eq!("", eval_to_string(&g, "T(123)"));
        assert_eq!("", eval_to_string(&g, "T(FALSE)"));
    }

    #[test]
    fn test_formula_numbervalue() {
        let g = GridController::new();

        for (decimal_sep, group_sep) in [
            (None, None),
            (Some("a"), None),
            (Some(","), Some(".")),
            (Some(","), None),      // infer `.` for group sep
            (Some(",zerty"), None), // infer `.` for group sep
            (Some(","), Some("b")),
            (Some("a"), Some("b")),
            (Some("azerty"), Some("bwerty")),
            (Some("8"), Some("9")), // cursed! but allowed
        ] {
            // Format as a string
            let mut extra_args = String::new();
            if let Some(s) = decimal_sep {
                extra_args += &format!(", {s:?}");
            }
            if let Some(s) = group_sep {
                extra_args += &format!(", {s:?}");
            }

            // Extract first character
            let decimal_sep = decimal_sep.map(|s| s.chars().next().unwrap());
            let mut group_sep = group_sep.map(|s| s.chars().next().unwrap());
            // Infer second argument
            if decimal_sep == Some(',') && group_sep.is_none() {
                group_sep = Some('.');
            }
            // Convert to string
            let decimal_sep = decimal_sep.unwrap_or('.').to_string();
            let group_sep = group_sep.unwrap_or(',').to_string();

            // Test ok cases
            for (expected, arg) in [
                ("0", ""),
                ("25", "25"),
                ("25", "2 5d"),       // `2 5.`
                ("25", "g 2 g5 g d"), // `, 2 ,5 , .`
                ("0.25", "d2 5"),     // .2 5
                ("12.5", "gg 12d 5"), // `,, 12. 5`
            ] {
                let arg = arg.replace('d', &decimal_sep).replace('g', &group_sep);
                assert_eq!(
                    expected,
                    eval_to_string(&g, &format!("NUMBERVALUE({arg:?}{extra_args})")),
                );
            }

            // Test error cases
            for arg in [
                "1z",    // unknown symbol
                "d",     // only decimal sep
                "1d2g3", // group sep after decimal sep
                "1d2d3", // 2x decimal sep
            ] {
                let arg = arg.replace('d', &decimal_sep).replace('g', &group_sep);
                eval_to_err(&g, &format!("NUMBERVALUE({arg:?}{extra_args})"));
            }
        }

        // It should be case sensitive
        assert_eq!("12.5", eval_to_string(&g, "NUMBERVALUE('12a5', 'a')"));
        assert_eq!("12.5", eval_to_string(&g, "NUMBERVALUE('12A5', 'A')"));
        eval_to_err(&g, "NUMBERVALUE('12a5', 'A')");
        eval_to_err(&g, "NUMBERVALUE('12A5', 'a')");

        // Error if decimal sep and group sep are the same
        eval_to_err(&g, "NUMBERVALUE('', 'azerty', 'apple')");

        // Error if the decimal sep or group sep are empty
        eval_to_err(&g, "NUMBERVALUE('123', '')");
        eval_to_err(&g, "NUMBERVALUE('123', '.', '')");

        // Reparse a number if it's passed in as-is
        assert_eq!("1.5", eval_to_string(&g, "NUMBERVALUE(185, '88888888')"));
    }

    #[test]
    fn test_formula_exact() {
        let g = GridController::new();

        assert_eq!("FALSE", eval_to_string(&g, "EXACT(\"Abc\", \"abc\")"));
        assert_eq!("TRUE", eval_to_string(&g, "EXACT(\"abc\", \"abc\")"));
        assert_eq!("FALSE", eval_to_string(&g, "EXACT(\"abc\", \"def\")"));
    }

    #[test]
    fn test_formula_find() {
        let g = GridController::new();

        // Basic find
        assert_eq!("4", eval_to_string(&g, "FIND(\"lo\", \"Hello\")"));
        assert_eq!("1", eval_to_string(&g, "FIND(\"H\", \"Hello\")"));
        assert_eq!("5", eval_to_string(&g, "FIND(\"o\", \"Hello\")"));

        // Case sensitive
        assert_eq!(
            RunErrorMsg::NoMatch,
            eval_to_err(&g, "FIND(\"h\", \"Hello\")").msg,
        );

        // With start position
        assert_eq!("4", eval_to_string(&g, "FIND(\"l\", \"Hello\", 4)"));

        // Not found
        assert_eq!(
            RunErrorMsg::NoMatch,
            eval_to_err(&g, "FIND(\"z\", \"Hello\")").msg,
        );
    }

    #[test]
    fn test_formula_search() {
        let g = GridController::new();

        // Basic search (case insensitive)
        assert_eq!("1", eval_to_string(&g, "SEARCH(\"h\", \"Hello\")"));
        assert_eq!("1", eval_to_string(&g, "SEARCH(\"H\", \"Hello\")"));
        assert_eq!("4", eval_to_string(&g, "SEARCH(\"lo\", \"Hello\")"));

        // Wildcards
        assert_eq!("1", eval_to_string(&g, "SEARCH(\"H*o\", \"Hello\")"));
        assert_eq!("1", eval_to_string(&g, "SEARCH(\"H?llo\", \"Hello\")"));
    }

    #[test]
    fn test_formula_replace() {
        let g = GridController::new();

        // Basic replace - start at position 4, replace 6 chars
        // "abcdefghijk" -> "abc" + "XYZ" + "jk" = "abcXYZjk"
        assert_eq!(
            "abcXYZjk",
            eval_to_string(&g, "REPLACE(\"abcdefghijk\", 4, 6, \"XYZ\")")
        );

        // Replace at beginning
        assert_eq!(
            "XYZdef",
            eval_to_string(&g, "REPLACE(\"abcdef\", 1, 3, \"XYZ\")")
        );

        // Replace at end
        assert_eq!(
            "abcXYZ",
            eval_to_string(&g, "REPLACE(\"abcdef\", 4, 3, \"XYZ\")")
        );

        // Insert (0 chars to replace)
        assert_eq!(
            "abcXYZdef",
            eval_to_string(&g, "REPLACE(\"abcdef\", 4, 0, \"XYZ\")")
        );
    }

    #[test]
    fn test_formula_substitute() {
        let g = GridController::new();

        // Replace all occurrences
        assert_eq!(
            "Hi Hi",
            eval_to_string(&g, "SUBSTITUTE(\"Hello Hello\", \"Hello\", \"Hi\")")
        );

        // Replace specific occurrence
        assert_eq!(
            "Hello Hi",
            eval_to_string(&g, "SUBSTITUTE(\"Hello Hello\", \"Hello\", \"Hi\", 2)")
        );

        // No match
        assert_eq!(
            "Hello",
            eval_to_string(&g, "SUBSTITUTE(\"Hello\", \"xyz\", \"abc\")")
        );

        // Empty old_text returns original
        assert_eq!(
            "Hello",
            eval_to_string(&g, "SUBSTITUTE(\"Hello\", \"\", \"abc\")")
        );
    }

    #[test]
    fn test_formula_rept() {
        let g = GridController::new();

        assert_eq!("*****", eval_to_string(&g, "REPT(\"*\", 5)"));
        assert_eq!("ababab", eval_to_string(&g, "REPT(\"ab\", 3)"));
        assert_eq!("", eval_to_string(&g, "REPT(\"abc\", 0)"));
    }

    #[test]
    fn test_formula_textjoin() {
        let g = GridController::new();

        // Basic join
        assert_eq!(
            "a, b, c",
            eval_to_string(&g, "TEXTJOIN(\", \", TRUE, \"a\", \"b\", \"c\")")
        );

        // Ignore empty
        assert_eq!(
            "a-c",
            eval_to_string(&g, "TEXTJOIN(\"-\", TRUE, \"a\", \"\", \"c\")")
        );

        // Keep empty
        assert_eq!(
            "a--c",
            eval_to_string(&g, "TEXTJOIN(\"-\", FALSE, \"a\", \"\", \"c\")")
        );
    }

    #[test]
    fn test_formula_asc() {
        let g = GridController::new();

        // Full-width ASCII to half-width
        assert_eq!("ABC", eval_to_string(&g, "ASC(\"ＡＢＣ\")"));
        assert_eq!("123", eval_to_string(&g, "ASC(\"１２３\")"));
        assert_eq!("Hello", eval_to_string(&g, "ASC(\"Ｈｅｌｌｏ\")"));

        // Full-width punctuation
        assert_eq!("!@#", eval_to_string(&g, "ASC(\"！＠＃\")"));

        // Full-width space
        assert_eq!("a b", eval_to_string(&g, "ASC(\"a\u{3000}b\")"));

        // Mixed content - some converted, some not
        assert_eq!("ABC漢字", eval_to_string(&g, "ASC(\"ＡＢＣ漢字\")"));

        // Already half-width stays the same
        assert_eq!("ABC", eval_to_string(&g, "ASC(\"ABC\")"));
    }

    #[test]
    fn test_formula_dbcs() {
        let g = GridController::new();

        // Half-width ASCII to full-width
        assert_eq!("ＡＢＣ", eval_to_string(&g, "DBCS(\"ABC\")"));
        assert_eq!("１２３", eval_to_string(&g, "DBCS(\"123\")"));
        assert_eq!("Ｈｅｌｌｏ", eval_to_string(&g, "DBCS(\"Hello\")"));

        // Half-width punctuation
        assert_eq!("！＠＃", eval_to_string(&g, "DBCS(\"!@#\")"));

        // Half-width space to full-width
        assert_eq!("ａ\u{3000}ｂ", eval_to_string(&g, "DBCS(\"a b\")"));

        // Already full-width stays the same
        assert_eq!("ＡＢＣ", eval_to_string(&g, "DBCS(\"ＡＢＣ\")"));
    }

    #[test]
    fn test_formula_bahttext() {
        let g = GridController::new();

        // Basic numbers
        assert_eq!("หนึ่งบาทถ้วน", eval_to_string(&g, "BAHTTEXT(1)"));
        assert_eq!("สิบบาทถ้วน", eval_to_string(&g, "BAHTTEXT(10)"));
        assert_eq!("ยี่สิบเอ็ดบาทถ้วน", eval_to_string(&g, "BAHTTEXT(21)"));
        assert_eq!("หนึ่งร้อยยี่สิบสามบาทถ้วน", eval_to_string(&g, "BAHTTEXT(123)"));

        // Zero
        assert_eq!("ศูนย์บาทถ้วน", eval_to_string(&g, "BAHTTEXT(0)"));

        // With satang
        assert_eq!("หนึ่งบาทห้าสิบสตางค์", eval_to_string(&g, "BAHTTEXT(1.5)"));
    }

    #[test]
    fn test_formula_dollar() {
        let g = GridController::new();

        // Default 2 decimals
        assert_eq!("$1,234.57", eval_to_string(&g, "DOLLAR(1234.567)"));

        // Specified decimals
        assert_eq!("$1,234.6", eval_to_string(&g, "DOLLAR(1234.567, 1)"));
        assert_eq!("$1,235", eval_to_string(&g, "DOLLAR(1234.567, 0)"));

        // Negative number
        assert_eq!("-$1,234.57", eval_to_string(&g, "DOLLAR(-1234.567)"));

        // Negative decimals (rounding)
        assert_eq!("$1,230", eval_to_string(&g, "DOLLAR(1234.567, -1)"));
    }

    #[test]
    fn test_formula_fixed() {
        let g = GridController::new();

        // Default 2 decimals with commas
        assert_eq!("1,234.57", eval_to_string(&g, "FIXED(1234.567)"));

        // Specified decimals
        assert_eq!("1,234.6", eval_to_string(&g, "FIXED(1234.567, 1)"));
        assert_eq!("1,235", eval_to_string(&g, "FIXED(1234.567, 0)"));

        // No commas
        assert_eq!("1234.6", eval_to_string(&g, "FIXED(1234.567, 1, TRUE)"));
        assert_eq!("1234.57", eval_to_string(&g, "FIXED(1234.567, 2, TRUE)"));

        // Negative number
        assert_eq!("-1,234.57", eval_to_string(&g, "FIXED(-1234.567)"));

        // Negative decimals (rounding to left of decimal)
        assert_eq!("-1,230", eval_to_string(&g, "FIXED(-1234.567, -1)"));
    }

    #[test]
    fn test_formula_findb() {
        let g = GridController::new();

        // Basic find (ASCII)
        assert_eq!("4", eval_to_string(&g, "FINDB(\"lo\", \"Hello\")"));
        assert_eq!("1", eval_to_string(&g, "FINDB(\"H\", \"Hello\")"));

        // Multi-byte characters
        assert_eq!("4", eval_to_string(&g, "FINDB(\"界\", \"世界\")"));

        // With start position
        assert_eq!("4", eval_to_string(&g, "FINDB(\"l\", \"Hello\", 4)"));

        // Not found
        assert_eq!(
            RunErrorMsg::NoMatch,
            eval_to_err(&g, "FINDB(\"z\", \"Hello\")").msg
        );

        // Case sensitive
        assert_eq!(
            RunErrorMsg::NoMatch,
            eval_to_err(&g, "FINDB(\"h\", \"Hello\")").msg
        );
    }

    #[test]
    fn test_formula_searchb() {
        let g = GridController::new();

        // Case insensitive search
        assert_eq!("1", eval_to_string(&g, "SEARCHB(\"h\", \"Hello\")"));
        assert_eq!("1", eval_to_string(&g, "SEARCHB(\"H\", \"Hello\")"));

        // Multi-byte characters
        assert_eq!("4", eval_to_string(&g, "SEARCHB(\"界\", \"世界\")"));

        // With wildcards
        assert_eq!("1", eval_to_string(&g, "SEARCHB(\"H*o\", \"Hello\")"));
        assert_eq!("1", eval_to_string(&g, "SEARCHB(\"H?llo\", \"Hello\")"));

        // Not found
        assert_eq!(
            RunErrorMsg::NoMatch,
            eval_to_err(&g, "SEARCHB(\"z\", \"Hello\")").msg
        );
    }

    #[test]
    fn test_formula_replaceb() {
        let g = GridController::new();

        // Basic replace (ASCII)
        assert_eq!(
            "Hio",
            eval_to_string(&g, "REPLACEB(\"Hello\", 2, 3, \"i\")")
        );

        // Multi-byte characters
        // "世界" has 世 at bytes 1-3 and 界 at bytes 4-6
        // Replace 界 (bytes 4-6) with 人
        assert_eq!(
            "世人",
            eval_to_string(&g, "REPLACEB(\"世界\", 4, 3, \"人\")")
        );

        // Insert (0 bytes to replace)
        assert_eq!(
            "abcXYZdef",
            eval_to_string(&g, "REPLACEB(\"abcdef\", 4, 0, \"XYZ\")")
        );

        // Replace at beginning
        assert_eq!(
            "XYZdef",
            eval_to_string(&g, "REPLACEB(\"abcdef\", 1, 3, \"XYZ\")")
        );
    }

    #[test]
    fn test_formula_phonetic() {
        let g = GridController::new();

        // Returns the original text (we don't store phonetic info)
        assert_eq!("東京", eval_to_string(&g, "PHONETIC(\"東京\")"));
        assert_eq!("Hello", eval_to_string(&g, "PHONETIC(\"Hello\")"));
    }

    #[test]
    fn test_formula_text() {
        let g = GridController::new();

        // Currency format
        assert_eq!(
            "$1,234.57",
            eval_to_string(&g, "TEXT(1234.567, \"$#,##0.00\")")
        );

        // Percentage
        assert_eq!("25%", eval_to_string(&g, "TEXT(0.25, \"0%\")"));
        assert_eq!("25.50%", eval_to_string(&g, "TEXT(0.255, \"0.00%\")"));

        // Scientific notation
        assert_eq!("1.23E+03", eval_to_string(&g, "TEXT(1234.5, \"0.00E+00\")"));

        // Simple number format
        assert_eq!("1234.57", eval_to_string(&g, "TEXT(1234.567, \"0.00\")"));
        assert_eq!(
            "1,234.57",
            eval_to_string(&g, "TEXT(1234.567, \"#,##0.00\")")
        );
    }

    #[test]
    fn test_formula_textafter() {
        let g = GridController::new();

        // Basic usage
        assert_eq!(
            "World",
            eval_to_string(&g, "TEXTAFTER(\"Hello World\", \" \")")
        );

        // Multiple occurrences - get after 2nd delimiter
        assert_eq!(
            "Test",
            eval_to_string(&g, "TEXTAFTER(\"Hello-World-Test\", \"-\", 2)")
        );

        // Negative instance (from end)
        assert_eq!(
            "World",
            eval_to_string(&g, "TEXTAFTER(\"Hello World\", \" \", -1)")
        );

        // Case insensitive
        assert_eq!(
            "World",
            eval_to_string(&g, "TEXTAFTER(\"Hello World\", \"hello \", 1, 1)")
        );

        // Not found - error
        assert_eq!(
            RunErrorMsg::NoMatch,
            eval_to_err(&g, "TEXTAFTER(\"Hello\", \"x\")").msg
        );

        // Not found with default value
        assert_eq!(
            "default",
            eval_to_string(&g, "TEXTAFTER(\"Hello\", \"x\", 1, 0, 0, \"default\")")
        );
    }

    #[test]
    fn test_formula_textbefore() {
        let g = GridController::new();

        // Basic usage
        assert_eq!(
            "Hello",
            eval_to_string(&g, "TEXTBEFORE(\"Hello World\", \" \")")
        );

        // Multiple occurrences - get before 2nd delimiter
        assert_eq!(
            "Hello-World",
            eval_to_string(&g, "TEXTBEFORE(\"Hello-World-Test\", \"-\", 2)")
        );

        // Negative instance (from end)
        assert_eq!(
            "Hello",
            eval_to_string(&g, "TEXTBEFORE(\"Hello World\", \" \", -1)")
        );

        // Case insensitive
        assert_eq!(
            "Hello",
            eval_to_string(&g, "TEXTBEFORE(\"Hello World\", \" world\", 1, 1)")
        );

        // Not found - error
        assert_eq!(
            RunErrorMsg::NoMatch,
            eval_to_err(&g, "TEXTBEFORE(\"Hello\", \"x\")").msg
        );

        // Not found with default value
        assert_eq!(
            "default",
            eval_to_string(&g, "TEXTBEFORE(\"Hello\", \"x\", 1, 0, 0, \"default\")")
        );
    }

    #[test]
    fn test_formula_textsplit() {
        let g = GridController::new();

        // Split by column delimiter only
        assert_eq!(
            "{a, b, c}",
            eval_to_string(&g, "TEXTSPLIT(\"a,b,c\", \",\")")
        );

        // Split by both row and column delimiters
        assert_eq!(
            "{a, b; c, d}",
            eval_to_string(&g, "TEXTSPLIT(\"a,b;c,d\", \",\", \";\")")
        );

        // Ignore empty
        assert_eq!(
            "{a, b, c}",
            eval_to_string(&g, "TEXTSPLIT(\"a,,b,,c\", \",\", , TRUE)")
        );

        // Keep empty (default)
        assert_eq!("{a, , b}", eval_to_string(&g, "TEXTSPLIT(\"a,,b\", \",\")"));

        // Case insensitive
        assert_eq!(
            "{Hello, World}",
            eval_to_string(&g, "TEXTSPLIT(\"HelloXWorld\", \"x\", , , 1)")
        );
    }

    #[test]
    fn test_formula_value() {
        let g = GridController::new();

        // Basic number
        assert_eq!("123.45", eval_to_string(&g, "VALUE(\"123.45\")"));

        // With currency
        assert_eq!("1234.56", eval_to_string(&g, "VALUE(\"$1,234.56\")"));

        // Percentage
        assert_eq!("0.25", eval_to_string(&g, "VALUE(\"25%\")"));

        // Negative
        assert_eq!("-123", eval_to_string(&g, "VALUE(\"-123\")"));

        // Empty string
        assert_eq!("0", eval_to_string(&g, "VALUE(\"\")"));

        // Invalid - error
        assert_eq!(
            RunErrorMsg::InvalidArgument,
            eval_to_err(&g, "VALUE(\"abc\")").msg
        );
    }

    #[test]
    fn test_formula_valuetotext() {
        let g = GridController::new();

        // Number
        assert_eq!("123", eval_to_string(&g, "VALUETOTEXT(123)"));

        // Text - format 0 (human readable)
        assert_eq!("Hello", eval_to_string(&g, "VALUETOTEXT(\"Hello\")"));

        // Text - format 1 (machine readable with quotes)
        assert_eq!("\"Hello\"", eval_to_string(&g, "VALUETOTEXT(\"Hello\", 1)"));

        // Boolean
        assert_eq!("true", eval_to_string(&g, "VALUETOTEXT(TRUE)"));
        assert_eq!("TRUE", eval_to_string(&g, "VALUETOTEXT(TRUE, 1)"));

        // Invalid format
        assert_eq!(
            RunErrorMsg::InvalidArgument,
            eval_to_err(&g, "VALUETOTEXT(123, 2)").msg
        );
    }
}
