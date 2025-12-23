use super::*;

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
        // Hyperlink
        formula_fn!(
            /// Creates a clickable hyperlink.
            ///
            /// If `link_label` is omitted, the URL is displayed as the link text.
            #[examples(
                "HYPERLINK(\"https://example.com\")",
                "HYPERLINK(\"https://example.com\", \"Click here\")"
            )]
            #[zip_map]
            fn HYPERLINK([url]: String, [link_label]: (Option<String>)) {
                let display_text = link_label.unwrap_or_else(|| url.clone());
                CellValue::RichText(vec![TextSpan::link(display_text, url)])
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
    fn test_formula_hyperlink() {
        use crate::{CellValue, TextSpan, Value};

        let g = GridController::new();

        // Test with both URL and label
        let result = eval(&g, "HYPERLINK(\"https://example.com\", \"Click here\")");
        let expected = Value::Single(CellValue::RichText(vec![TextSpan::link(
            "Click here",
            "https://example.com",
        )]));
        assert_eq!(result, expected);

        // Test with only URL (label defaults to URL)
        let result = eval(&g, "HYPERLINK(\"https://example.com\")");
        let expected = Value::Single(CellValue::RichText(vec![TextSpan::link(
            "https://example.com",
            "https://example.com",
        )]));
        assert_eq!(result, expected);

        // Test display string (concatenated text)
        assert_eq!(
            "Click here",
            eval_to_string(&g, "HYPERLINK(\"https://example.com\", \"Click here\")")
        );
        assert_eq!(
            "https://example.com",
            eval_to_string(&g, "HYPERLINK(\"https://example.com\")")
        );
    }
}
