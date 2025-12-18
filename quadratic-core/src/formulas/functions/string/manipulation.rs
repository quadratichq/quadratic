//! String manipulation functions (concat, substring, case, replace).

use super::*;

pub fn get_functions() -> Vec<FormulaFunction> {
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
                let start = try_i64_minus_1_to_usize(start_char)?;
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
                for c in s.to_lowercase().chars() {
                    if last_char.is_alphabetic() {
                        ret.push(c);
                    } else {
                        match unicode_case_mapping::to_titlecase(c) {
                            [0, 0, 0] => ret.push(c),
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

                let start = ceil_char_boundary(&old_text, start);
                let end = floor_char_boundary(&old_text, start.saturating_add(num));

                let before = &old_text[..start];
                let after = &old_text[end..];

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
                        None => text.replace(&old_text, &new_text),
                        Some(n) => {
                            let instance = try_i64_to_usize(n)?;
                            if instance == 0 {
                                return Err(RunErrorMsg::InvalidArgument.with_span(n.span));
                            }
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
                let n = try_i64_to_usize(number_times)?;
                text.repeat(n)
            }
        ),
        formula_fn!(
            /// Joins an array of values with a delimiter.
            ///
            /// - `delimiter`: The string to place between each value.
            /// - `ignore_empty`: If TRUE, empty cells are ignored.
            /// - `texts`: The values to join.
            #[examples(
                "TEXTJOIN(\", \", TRUE, \"a\", \"b\", \"c\") = \"a, b, c\"",
                "TEXTJOIN(\"-\", TRUE, \"a\", \"\", \"c\") = \"a-c\""
            )]
            fn TEXTJOIN(delimiter: String, ignore_empty: bool, texts: (Iter<CellValue>)) {
                let strings: Vec<String> = texts
                    .filter_map(|v| match v {
                        Ok(v) if ignore_empty && v.is_blank() => None,
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
                        if ('\u{FF01}'..='\u{FF5E}').contains(&c) {
                            char::from_u32(c as u32 - 0xFF01 + 0x21).unwrap_or(c)
                        } else if c == '\u{3000}' {
                            ' '
                        } else if let Some(half) = full_to_half_katakana(c) {
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
                        if ('!'..='~').contains(&c) {
                            char::from_u32(c as u32 - 0x21 + 0xFF01).unwrap_or(c)
                        } else if c == ' ' {
                            '\u{3000}'
                        } else if let Some(full) = half_to_full_katakana(c) {
                            full
                        } else {
                            c
                        }
                    })
                    .collect::<String>()
            }
        ),
    ]
}

#[cfg(test)]
mod tests {
    use crate::{controller::GridController, formulas::tests::*};

    #[test]
    fn test_formula_array_to_text() {
        let g = GridController::new();
        // Test with inline array instead of grid reference
        assert_eq!(
            "Apple, banana, 42, Hello, world!",
            eval_to_string(
                &g,
                "ARRAYTOTEXT({\"Apple\", \"banana\"; 42, \"Hello, world!\"})"
            ),
        );
        assert_eq!(
            "Apple, banana, 42, Hello, world!",
            eval_to_string(
                &g,
                "ARRAYTOTEXT({\"Apple\", \"banana\"; 42, \"Hello, world!\"}, 0)"
            ),
        );
        assert_eq!(
            "{\"Apple\", \"banana\"; 42, \"Hello, world!\"}",
            eval_to_string(
                &g,
                "ARRAYTOTEXT({\"Apple\", \"banana\"; 42, \"Hello, world!\"}, 1)"
            ),
        );
        assert_eq!(
            RunErrorMsg::InvalidArgument,
            eval_to_err(
                &g,
                "ARRAYTOTEXT({\"Apple\", \"banana\"; 42, \"Hello, world!\"}, 2)"
            )
            .msg,
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
            eval_to_string(&g, "CONCAT(\"Hello, \", 14000605, ' worlds!')"),
        );
        assert_eq!(
            "Hello, 14000605 worlds!".to_string(),
            eval_to_string(&g, "CONCATENATE(\"Hello, \", 14000605, ' worlds!')"),
        );
    }

    #[test]
    fn test_formula_left() {
        let g = GridController::new();
        assert_eq!("H", eval_to_string(&g, "LEFT(\"Hello, world!\")"));
        assert_eq!("Hello,", eval_to_string(&g, "LEFT(\"Hello, world!\", 6)"));
        assert_eq!("抱", eval_to_string(&g, "LEFT(\"抱歉，我不懂普通话\")"));
        assert_eq!(
            "抱歉，我不懂",
            eval_to_string(&g, "LEFT(\"抱歉，我不懂普通话\", 6)")
        );
    }

    #[test]
    fn test_formula_right() {
        let g = GridController::new();
        assert_eq!("!", eval_to_string(&g, "RIGHT(\"Hello, world!\")"));
        assert_eq!("world!", eval_to_string(&g, "RIGHT(\"Hello, world!\", 6)"));
    }

    #[test]
    fn test_formula_mid() {
        let g = GridController::new();
        assert_eq!("lo, wo", eval_to_string(&g, "MID(\"Hello, world!\", 4, 6)"));
        assert_eq!("Hello", eval_to_string(&g, "MID(\"Hello, world!\", 1, 5)"));
    }

    #[test]
    fn test_formula_clean() {
        let g = GridController::new();
        assert_eq!(
            "(only the parenthetical will survive)",
            eval_to_string(
                &g,
                "CLEAN(CHAR(9) & \"(only the parenthetical will survive)\" & CHAR(10))"
            ),
        );
    }

    #[test]
    fn test_formula_trim() {
        let g = GridController::new();
        assert_eq!("a b c", eval_to_string(&g, "TRIM(\"    a    b    c    \")"),);
    }

    #[test]
    fn test_formula_lower_upper() {
        let g = GridController::new();
        assert_eq!("hello", eval_to_string(&g, "LOWER(\"HELLO\")"),);
        assert_eq!("HELLO", eval_to_string(&g, "UPPER(\"hello\")"),);
    }

    #[test]
    fn test_formula_proper() {
        let g = GridController::new();
        assert_eq!("Hello World", eval_to_string(&g, "PROPER(\"hello world\")"),);
    }

    #[test]
    fn test_formula_replace() {
        let g = GridController::new();
        assert_eq!(
            "abcXYZjk",
            eval_to_string(&g, "REPLACE(\"abcdefghijk\", 4, 6, \"XYZ\")"),
        );
    }

    #[test]
    fn test_formula_substitute() {
        let g = GridController::new();
        assert_eq!(
            "Hi Hi",
            eval_to_string(&g, "SUBSTITUTE(\"Hello Hello\", \"Hello\", \"Hi\")"),
        );
        assert_eq!(
            "Hello Hi",
            eval_to_string(&g, "SUBSTITUTE(\"Hello Hello\", \"Hello\", \"Hi\", 2)"),
        );
    }

    #[test]
    fn test_formula_rept() {
        let g = GridController::new();
        assert_eq!("*****", eval_to_string(&g, "REPT(\"*\", 5)"));
        assert_eq!("ababab", eval_to_string(&g, "REPT(\"ab\", 3)"));
    }

    #[test]
    fn test_formula_textjoin() {
        let g = GridController::new();
        assert_eq!(
            "a, b, c",
            eval_to_string(&g, "TEXTJOIN(\", \", TRUE, \"a\", \"b\", \"c\")"),
        );
    }

    #[test]
    fn test_formula_asc() {
        let g = GridController::new();
        assert_eq!("ABC", eval_to_string(&g, "ASC(\"ＡＢＣ\")"));
        assert_eq!("123", eval_to_string(&g, "ASC(\"１２３\")"));
    }

    #[test]
    fn test_formula_dbcs() {
        let g = GridController::new();
        assert_eq!("ＡＢＣ", eval_to_string(&g, "DBCS(\"ABC\")"));
        assert_eq!("１２３", eval_to_string(&g, "DBCS(\"123\")"));
    }
}
