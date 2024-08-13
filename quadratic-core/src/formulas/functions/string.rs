use super::*;

pub const CATEGORY: FormulaFunctionCategory = FormulaFunctionCategory {
    include_in_docs: true,
    include_in_completions: true,
    name: "String functions",
    docs: "",
    get_functions,
};

fn get_functions() -> Vec<FormulaFunction> {
    vec![
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
    ]
}

fn unicode(span: Span, s: String) -> CodeResult<u32> {
    match s.chars().next() {
        Some(c) => Ok(c as u32),
        None => return Err(RunErrorMsg::InvalidArgument.with_span(span)),
    }
}
fn unichar(span: Span, code_point: u32) -> CodeResult<char> {
    char::from_u32(code_point)
        .filter(|&c| c != '\0')
        .ok_or_else(|| RunErrorMsg::InvalidArgument.with_span(span))
}

#[cfg(test)]
mod tests {
    use crate::formulas::tests::*;
    use serial_test::parallel;

    #[test]
    #[parallel]
    fn test_formula_concat() {
        let g = Grid::new();
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
    #[parallel]
    fn test_formula_len_and_lenb() {
        let g = Grid::new();

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
    #[parallel]
    fn test_formula_code() {
        let g = Grid::new();

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
    #[parallel]
    fn test_formula_char() {
        let g = Grid::new();

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
    #[parallel]
    fn test_formula_clean() {
        let g = Grid::new();

        assert_eq!(
            "  A BC",
            eval_to_string(&g, "CLEAN(\"  A\u{0} \u{A}\nB\u{1C}C\t\")"),
        )
    }

    #[test]
    #[parallel]
    fn test_formula_exact() {
        let g = Grid::new();

        assert_eq!("FALSE", eval_to_string(&g, "EXACT(\"Abc\", \"abc\")"));
        assert_eq!("TRUE", eval_to_string(&g, "EXACT(\"abc\", \"abc\")"));
        assert_eq!("FALSE", eval_to_string(&g, "EXACT(\"abc\", \"def\")"));
    }
}
