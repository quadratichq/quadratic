//! Functions for lossless tokenization.

use lazy_static::lazy_static;
use regex::{Regex, RegexBuilder};
use strum_macros::Display;

use crate::{Span, Spanned};

pub fn tokenize(input_str: &str) -> impl '_ + Iterator<Item = Spanned<Token>> {
    let mut token_start = 0;
    std::iter::from_fn(move || {
        Token::consume_from_input(input_str, token_start).map(|(token, token_end)| {
            let span = Span {
                start: token_start as u32,
                end: token_end as u32,
            };
            token_start = token_end;
            Spanned { span, inner: token }
        })
    })
}

fn new_fullmatch_regex(s: &str) -> Regex {
    Regex::new(&("^(".to_owned() + s + ")")).unwrap()
}

/// Function call consisting of a letter or underscore followed by any letters,
/// digits, and/or underscores terminated with a `(`.
const FUNCTION_CALL_PATTERN: &str = r"[A-Za-z_][A-Za-z_\d]*\(";

/// A1-style cell reference.
///
/// \$?n?[A-Z]+\$?n?\d+
/// \$?        \$?            optional `$`s
///    n?         n?          optional `n`s
///      [A-Z]+               letters
///                 \d+       digits
const A1_CELL_REFERENCE_PATTERN: &str = r"\$?n?[A-Z]+\$?n?\d+";

/// Floating-point or integer number, without leading sign.
///
/// (\d+(\.\d*)?|\.\d+)([eE][+-]?\d+)?
/// (           |     )                   EITHER
///  \d+                                    integer part
///     (\.\d*)?                            with an optional decimal
/// (           |     )                   OR
///              \.\d+                      decimal part only
///                    ([eE]        )?    optional exponent
///                         [+-]?           with an optional sign
///                              \d+        followed by some digits
const NUMERIC_LITERAL_PATTERN: &str = r"(\d+(\.\d*)?|\.\d+)([eE][+-]?\d+)?";

/// Single-quoted string. Note that like Rust strings, this can span multiple
/// lines.
const SINGLE_QUOTE_STRING_LITERAL_PATTERN: &str = r"'([^'\\]|\\[\s\S])*'";
/// Double-quoted string. Note that like Rust strings, this can span multiple
/// lines.
const DOUBLE_QUOTE_STRING_LITERAL_PATTERN: &str = r#""([^"\\]|\\[\s\S])*""#;
/// Unquoted sheet reference, such as `Sheet1!`. A quoted sheet reference such
/// as `'Sheet1'!` is parsed as a string followed by a sheet reference operator
/// `!`.
const UNQUOTED_SHEET_REFERENCE_PATTERN: &str = r"[A-Za-z_][A-Za-z0-9_\.]*\s*!";
/// Unterminated string literal.
const UNTERMINATED_STRING_LITERAL_PATTERN: &str = r#"["']"#;

/// List of token patterns, arranged roughly from least to most general.
const TOKEN_PATTERNS: &[&str] = &[
    // Comparison operators `==`, `!=`, `<=`, and `>=`.
    r#"[=!<>]="#,
    // Double and triple dot.
    r"\.\.\.?",
    // Line comment.
    r"//[^\n]*",
    // Start of a block comment (block comment has special handling).
    r"/\*",
    // Sheet reference.
    UNQUOTED_SHEET_REFERENCE_PATTERN,
    // String literal.
    SINGLE_QUOTE_STRING_LITERAL_PATTERN,
    DOUBLE_QUOTE_STRING_LITERAL_PATTERN,
    UNTERMINATED_STRING_LITERAL_PATTERN,
    // Numeric literal.
    NUMERIC_LITERAL_PATTERN,
    // Function call.
    FUNCTION_CALL_PATTERN,
    // Boolean literal (case-insensitive).
    r#"false|true"#,
    // Reference to a cell.
    A1_CELL_REFERENCE_PATTERN,
    // Whitespace.
    r"\s+",
    // Any other single Unicode character.
    r"[\s\S]",
];

lazy_static! {
    /// Single regex that matches any token, including comments and strings,
    /// by joining each member of `TOKEN_PATTERNS` with "|".
    pub static ref TOKEN_REGEX: Regex =
        RegexBuilder::new(&TOKEN_PATTERNS.join("|")).case_insensitive(true).build().unwrap();

    /// Regex that matches a valid function call.
    pub static ref FUNCTION_CALL_REGEX: Regex =
        new_fullmatch_regex(FUNCTION_CALL_PATTERN);

    /// Regex that matches an unquoted sheet reference, such as `Sheet1!`.
    pub static ref UNQUOTED_SHEET_REFERENCE: Regex =
        new_fullmatch_regex(UNQUOTED_SHEET_REFERENCE_PATTERN);

    /// Regex that matches a valid A1-style cell reference.
    pub static ref A1_CELL_REFERENCE_REGEX: Regex =
        new_fullmatch_regex(A1_CELL_REFERENCE_PATTERN);

    /// Regex that matches all valid numeric literals and some invalid ones.
    pub static ref NUMERIC_LITERAL_REGEX: Regex =
        new_fullmatch_regex(NUMERIC_LITERAL_PATTERN);

    /// Regex that matches a valid string literal.
    pub static ref STRING_LITERAL_REGEX: Regex =
        new_fullmatch_regex(&[
            SINGLE_QUOTE_STRING_LITERAL_PATTERN,
            DOUBLE_QUOTE_STRING_LITERAL_PATTERN,
        ].join("|"));

    /// Regex that matches an unterminated string literal.
    pub static ref UNTERMINATED_STRING_LITERAL_REGEX: Regex =
        new_fullmatch_regex(UNTERMINATED_STRING_LITERAL_PATTERN);
}

#[derive(Debug, Display, Copy, Clone, PartialEq, Eq)]
pub enum Token {
    // Grouping
    #[strum(to_string = "left paren")]
    LParen,
    #[strum(to_string = "left bracket")]
    LBracket,
    #[strum(to_string = "left brace")]
    LBrace,
    #[strum(to_string = "right paren")]
    RParen,
    #[strum(to_string = "right bracket")]
    RBracket,
    #[strum(to_string = "right brace")]
    RBrace,

    // Separators
    #[strum(to_string = "argument separator (comma)")]
    ArgSep,
    #[strum(to_string = "array row seperator (semicolon)")]
    RowSep,

    // Comparison operators
    #[strum(to_string = "equals comparison")]
    Eql,
    #[strum(to_string = "not-equals comparison")]
    Neq,
    #[strum(to_string = "less-than comparison")]
    Lt,
    #[strum(to_string = "greater-than comparison")]
    Gt,
    #[strum(to_string = "less-than-or-equal comparison")]
    Lte,
    #[strum(to_string = "greater-than-or-equal comparison")]
    Gte,

    // Mathematical operators
    #[strum(to_string = "plus operator")]
    Plus,
    #[strum(to_string = "minus operator")]
    Minus,
    #[strum(to_string = "multiplication operator")]
    Mult,
    #[strum(to_string = "division operator")]
    Div,
    #[strum(to_string = "exponentiation operator")]
    Power, // ^

    // Other operators
    #[strum(to_string = "concatenation operator")]
    Concat, // &
    #[strum(to_string = "numeric range operator")]
    RangeOp, // ..
    #[strum(to_string = "percent operator")]
    Percent, // %
    #[strum(to_string = "cell range operator")]
    CellRangeOp, // :
    #[strum(to_string = "sheet reference operator")]
    SheetRefOp, // !
    #[strum(to_string = "ellipsis")]
    Ellipsis, // ...

    // Booleans
    #[strum(to_string = "FALSE")]
    False,
    #[strum(to_string = "TRUE")]
    True,

    // Comments
    #[strum(to_string = "comment")]
    Comment,
    #[strum(to_string = "unterminated block comment")]
    UnterminatedBlockComment,

    // Other special tokens
    #[strum(to_string = "function call")]
    FunctionCall,
    #[strum(to_string = "unquoted sheet reference")]
    UnquotedSheetReference,
    #[strum(to_string = "string literal")]
    StringLiteral,
    #[strum(to_string = "unterminated string literal")]
    UnterminatedStringLiteral,
    #[strum(to_string = "numeric literal")]
    NumericLiteral,
    #[strum(to_string = "cell reference")]
    CellRef,
    #[strum(to_string = "whitespace")]
    Whitespace,
    #[strum(to_string = "unknown symbol")]
    Unknown,
}
impl Token {
    /// Consumes a token from a given starting index and returns the index of
    /// the next character after the token.
    fn consume_from_input(input_str: &str, start: usize) -> Option<(Self, usize)> {
        // Find next token.
        let m = TOKEN_REGEX.find_at(input_str, start)?;

        let mut end = m.end();

        let token = match m.as_str() {
            "(" => Self::LParen,
            "[" => Self::LBracket,
            "{" => Self::LBrace,
            ")" => Self::RParen,
            "]" => Self::RBracket,
            "}" => Self::RBrace,
            "," => Self::ArgSep,
            ";" => Self::RowSep,
            "=" | "==" => Self::Eql,
            "<>" | "!=" => Self::Neq,
            "<" => Self::Lt,
            ">" => Self::Gt,
            "<=" => Self::Lte,
            ">=" => Self::Gte,
            "+" => Self::Plus,
            "-" => Self::Minus,
            "*" => Self::Mult,
            "/" => Self::Div,
            "^" => Self::Power,
            "&" => Self::Concat,
            ".." => Self::RangeOp,
            "%" => Self::Percent,
            ":" => Self::CellRangeOp,
            "!" => Self::SheetRefOp,
            "..." => Self::Ellipsis,
            s if s.eq_ignore_ascii_case("false") => Self::False,
            s if s.eq_ignore_ascii_case("true") => Self::True,

            // Match a line comment.
            s if s.starts_with("//") => Self::Comment,

            // Match a block comment.
            s if s.starts_with("/*") => {
                lazy_static! {
                    static ref COMMENT_BOUNDARY_PATTERN: Regex = Regex::new(r"/\*|\*/").unwrap();
                }
                let mut depth = 0;
                let mut comment_len = 0;
                for m in COMMENT_BOUNDARY_PATTERN.find_iter(&input_str[start..]) {
                    comment_len = m.end();
                    match m.as_str() {
                        "/*" => depth += 1,
                        "*/" => depth -= 1,
                        _ => (), // should be impossible
                    }
                    if depth <= 0 {
                        break;
                    }
                }
                if depth == 0 {
                    end = start + comment_len;
                    Self::Comment
                } else {
                    Self::UnterminatedBlockComment
                }
            }

            // Match anything else.
            s if FUNCTION_CALL_REGEX.is_match(s) => Self::FunctionCall,
            s if UNQUOTED_SHEET_REFERENCE.is_match(s) => Self::UnquotedSheetReference,
            s if STRING_LITERAL_REGEX.is_match(s) => Self::StringLiteral,
            s if UNTERMINATED_STRING_LITERAL_REGEX.is_match(s) => Self::UnterminatedStringLiteral,
            s if s.eq_ignore_ascii_case("false") => Self::False,
            s if s.eq_ignore_ascii_case("true") => Self::True,
            s if NUMERIC_LITERAL_REGEX.is_match(s) => Self::NumericLiteral,
            s if A1_CELL_REFERENCE_REGEX.is_match(s) => Self::CellRef,
            s if s.trim().is_empty() => Self::Whitespace,

            // Give up.
            _ => Self::Unknown,
        };

        let rest_of_input = &input_str[end..];

        // Special workaround for `<integer>..<number>`. This fails on `1...5`,
        // which is ambiguous between `1 .. .5` and `1. .. 5`.
        if token == Self::NumericLiteral
            && m.as_str().ends_with('.')
            && rest_of_input.starts_with('.')
        {
            end -= 1;
        }

        Some((token, end))
    }

    /// Returns whether this token is a comment or whitespace that should be
    /// skipped most of the time when parsing.
    pub fn is_skip(self) -> bool {
        matches!(self, Self::Comment | Self::Whitespace)
    }
}

#[cfg(test)]
mod tests {
    use itertools::Itertools;

    use super::*;

    #[test]
    fn test_lex_block_comment() {
        test_block_comment(true, "/* basic */");
        test_block_comment(true, "/* line1 \n line2 */");
        test_block_comment(true, "/* */");
        test_block_comment(true, "/**/");
        test_block_comment(true, "/***/");
        test_block_comment(true, "/****/");
        test_block_comment(true, "/** spooky * scary\n ** block *** comments **/");
        test_block_comment(true, "/* nested /*/ oh my! ***/*/");

        test_block_comment(false, "/* /*");
        test_block_comment(false, "/*/");
    }
    fn test_block_comment(expected_to_end: bool, s: &str) {
        let tokens = tokenize(s).collect_vec();
        if expected_to_end {
            assert_eq!(1, tokens.len(), "Too many tokens: {:?}", tokens);
        }
        let expected = if expected_to_end {
            Token::Comment
        } else {
            Token::UnterminatedBlockComment
        };
        assert_eq!(
            expected,
            tokens[0].inner,
            "Token is: {:?}",
            tokens[0].span.of_str(s),
        );
    }
}
