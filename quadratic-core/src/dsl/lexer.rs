//! Lexer/tokenizer for the Quadratic DSL

use crate::dsl::error::{DslError, DslResult};

/// Token types for the DSL
#[derive(Debug, Clone, PartialEq)]
pub enum Token {
    // Keywords
    Cell,
    Grid,
    Table,
    Python,
    Javascript,
    Format,
    At,
    Orientation,
    Rows,
    Columns,
    Headers,

    // Literals
    Identifier(String), // e.g., A1, B2, columnName
    String(String),     // "text" or 'text'
    Number(String),     // 123, 45.67, -100

    // Punctuation
    Colon,        // :
    Comma,        // ,
    LeftBrace,    // {
    RightBrace,   // }
    LeftBracket,  // [
    RightBracket, // ]
    LeftParen,    // (
    RightParen,   // )

    // Special
    Newline,
    Eof,
}

/// Lexer for the DSL
pub struct Lexer {
    input: Vec<char>,
    pos: usize,
    line: usize,
    column: usize,
}

impl Lexer {
    pub fn new(input: &str) -> Self {
        Self {
            input: input.chars().collect(),
            pos: 0,
            line: 1,
            column: 1,
        }
    }

    /// Tokenize the entire input
    pub fn tokenize(&mut self) -> DslResult<Vec<Token>> {
        let mut tokens = Vec::new();

        loop {
            let token = self.next_token()?;
            let is_eof = token == Token::Eof;
            tokens.push(token);
            if is_eof {
                break;
            }
        }

        Ok(tokens)
    }

    fn next_token(&mut self) -> DslResult<Token> {
        self.skip_whitespace_and_comments();

        if self.is_at_end() {
            return Ok(Token::Eof);
        }

        let c = self.current();

        // Newline
        if c == '\n' {
            self.advance();
            return Ok(Token::Newline);
        }

        // String literals
        if c == '"' || c == '\'' {
            return self.read_string(c);
        }

        // Note: We DON'T treat = as starting a formula here.
        // Instead, = is handled as a single character in code blocks,
        // and the parser will recognize formulas (values starting with =)
        // when parsing cell values.

        // Number (including negative)
        if c.is_ascii_digit() || (c == '-' && self.peek().map_or(false, |p| p.is_ascii_digit())) {
            return self.read_number();
        }

        // Punctuation
        match c {
            ':' => {
                self.advance();
                return Ok(Token::Colon);
            }
            ',' => {
                self.advance();
                return Ok(Token::Comma);
            }
            '{' => {
                self.advance();
                return Ok(Token::LeftBrace);
            }
            '}' => {
                self.advance();
                return Ok(Token::RightBrace);
            }
            '[' => {
                self.advance();
                return Ok(Token::LeftBracket);
            }
            ']' => {
                self.advance();
                return Ok(Token::RightBracket);
            }
            '(' => {
                self.advance();
                return Ok(Token::LeftParen);
            }
            ')' => {
                self.advance();
                return Ok(Token::RightParen);
            }
            // Code block characters - treat each as a single-character identifier
            // This allows code like "x => x * 2" to be tokenized correctly
            // Note: '=' is included here for code blocks; formulas are detected
            // by the parser when a value starts with '='
            ';' | '.' | '+' | '*' | '/' | '%' | '<' | '>' | '!' | '&' | '|' | '^' | '~' | '?'
            | '@' | '$' | '`' | '\\' | '=' => {
                let ch = self.current();
                self.advance();
                return Ok(Token::Identifier(ch.to_string()));
            }
            _ => {}
        }

        // Identifier or keyword
        if c.is_ascii_alphabetic() || c == '_' {
            return self.read_identifier();
        }

        Err(DslError::lexer(format!("Unexpected character: '{}'", c))
            .with_location(self.line, self.column))
    }

    fn read_string(&mut self, quote: char) -> DslResult<Token> {
        self.advance(); // consume opening quote
        let mut value = String::new();

        while !self.is_at_end() {
            let c = self.current();
            if c == quote {
                self.advance(); // consume closing quote
                return Ok(Token::String(value));
            }
            if c == '\\' {
                self.advance();
                if !self.is_at_end() {
                    let escaped = self.current();
                    self.advance();
                    match escaped {
                        'n' => value.push('\n'),
                        't' => value.push('\t'),
                        'r' => value.push('\r'),
                        '\\' => value.push('\\'),
                        '"' => value.push('"'),
                        '\'' => value.push('\''),
                        _ => {
                            value.push('\\');
                            value.push(escaped);
                        }
                    }
                }
            } else if c == '\n' {
                return Err(DslError::lexer("Unterminated string literal")
                    .with_location(self.line, self.column));
            } else {
                value.push(c);
                self.advance();
            }
        }

        Err(DslError::lexer("Unterminated string literal").with_location(self.line, self.column))
    }

    fn read_number(&mut self) -> DslResult<Token> {
        let mut value = String::new();

        // Handle negative sign
        if self.current() == '-' {
            value.push('-');
            self.advance();
        }

        // Read digits
        while !self.is_at_end() && self.current().is_ascii_digit() {
            value.push(self.current());
            self.advance();
        }

        // Read decimal part
        if !self.is_at_end()
            && self.current() == '.'
            && self.peek().map_or(false, |c| c.is_ascii_digit())
        {
            value.push('.');
            self.advance();
            while !self.is_at_end() && self.current().is_ascii_digit() {
                value.push(self.current());
                self.advance();
            }
        }

        Ok(Token::Number(value))
    }

    fn read_identifier(&mut self) -> DslResult<Token> {
        let mut value = String::new();

        while !self.is_at_end() {
            let c = self.current();
            if c.is_ascii_alphanumeric() || c == '_' {
                value.push(c);
                self.advance();
            } else {
                break;
            }
        }

        // Check for keywords
        let token = match value.to_lowercase().as_str() {
            "cell" => Token::Cell,
            "grid" => Token::Grid,
            "table" => Token::Table,
            "python" => Token::Python,
            "javascript" => Token::Javascript,
            "format" => Token::Format,
            "at" => Token::At,
            "orientation" => Token::Orientation,
            "rows" => Token::Rows,
            "columns" => Token::Columns,
            "headers" => Token::Headers,
            "true" => Token::Identifier("true".to_string()),
            "false" => Token::Identifier("false".to_string()),
            _ => Token::Identifier(value),
        };

        Ok(token)
    }

    fn skip_whitespace_and_comments(&mut self) {
        while !self.is_at_end() {
            let c = self.current();

            // Skip spaces and tabs (but not newlines - they're tokens)
            if c == ' ' || c == '\t' || c == '\r' {
                self.advance();
                continue;
            }

            // Skip comments
            if c == '#' {
                while !self.is_at_end() && self.current() != '\n' {
                    self.advance();
                }
                continue;
            }

            break;
        }
    }

    fn current(&self) -> char {
        self.input.get(self.pos).copied().unwrap_or('\0')
    }

    fn peek(&self) -> Option<char> {
        self.input.get(self.pos + 1).copied()
    }

    fn advance(&mut self) {
        if !self.is_at_end() {
            if self.current() == '\n' {
                self.line += 1;
                self.column = 1;
            } else {
                self.column += 1;
            }
            self.pos += 1;
        }
    }

    fn is_at_end(&self) -> bool {
        self.pos >= self.input.len()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_tokenize_cell() {
        let mut lexer = Lexer::new("cell A1: \"Hello\"");
        let tokens = lexer.tokenize().unwrap();
        assert_eq!(
            tokens,
            vec![
                Token::Cell,
                Token::Identifier("A1".to_string()),
                Token::Colon,
                Token::String("Hello".to_string()),
                Token::Eof
            ]
        );
    }

    #[test]
    fn test_tokenize_number() {
        let mut lexer = Lexer::new("cell B2: 123.45");
        let tokens = lexer.tokenize().unwrap();
        assert_eq!(
            tokens,
            vec![
                Token::Cell,
                Token::Identifier("B2".to_string()),
                Token::Colon,
                Token::Number("123.45".to_string()),
                Token::Eof
            ]
        );
    }

    #[test]
    fn test_tokenize_formula() {
        // Formulas are now tokenized as separate tokens (= is its own identifier)
        // The parser reconstructs the formula from these tokens
        let mut lexer = Lexer::new("cell C3: =SUM(A1:A10)");
        let tokens = lexer.tokenize().unwrap();
        assert_eq!(
            tokens,
            vec![
                Token::Cell,
                Token::Identifier("C3".to_string()),
                Token::Colon,
                Token::Identifier("=".to_string()),
                Token::Identifier("SUM".to_string()),
                Token::LeftParen,
                Token::Identifier("A1".to_string()),
                Token::Colon,
                Token::Identifier("A10".to_string()),
                Token::RightParen,
                Token::Eof
            ]
        );
    }

    #[test]
    fn test_tokenize_grid() {
        let mut lexer = Lexer::new("grid at A1 [");
        let tokens = lexer.tokenize().unwrap();
        assert_eq!(
            tokens,
            vec![
                Token::Grid,
                Token::At,
                Token::Identifier("A1".to_string()),
                Token::LeftBracket,
                Token::Eof
            ]
        );
    }

    #[test]
    fn test_comments() {
        let mut lexer = Lexer::new("# This is a comment\ncell A1: 5");
        let tokens = lexer.tokenize().unwrap();
        assert_eq!(
            tokens,
            vec![
                Token::Newline,
                Token::Cell,
                Token::Identifier("A1".to_string()),
                Token::Colon,
                Token::Number("5".to_string()),
                Token::Eof
            ]
        );
    }
}
