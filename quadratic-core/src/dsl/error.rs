//! Error types for the DSL parser

use std::fmt;

/// Result type for DSL operations
pub type DslResult<T> = Result<T, DslError>;

/// Errors that can occur during DSL parsing or compilation
#[derive(Debug, Clone, PartialEq)]
pub struct DslError {
    pub kind: DslErrorKind,
    pub message: String,
    pub line: Option<usize>,
    pub column: Option<usize>,
}

impl DslError {
    pub fn new(kind: DslErrorKind, message: impl Into<String>) -> Self {
        Self {
            kind,
            message: message.into(),
            line: None,
            column: None,
        }
    }

    pub fn with_location(mut self, line: usize, column: usize) -> Self {
        self.line = Some(line);
        self.column = Some(column);
        self
    }

    pub fn lexer(message: impl Into<String>) -> Self {
        Self::new(DslErrorKind::Lexer, message)
    }

    pub fn parser(message: impl Into<String>) -> Self {
        Self::new(DslErrorKind::Parser, message)
    }

    pub fn compiler(message: impl Into<String>) -> Self {
        Self::new(DslErrorKind::Compiler, message)
    }
}

impl fmt::Display for DslError {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match (self.line, self.column) {
            (Some(line), Some(col)) => {
                write!(f, "[{}] {}:{}: {}", self.kind, line, col, self.message)
            }
            (Some(line), None) => {
                write!(f, "[{}] line {}: {}", self.kind, line, self.message)
            }
            _ => {
                write!(f, "[{}] {}", self.kind, self.message)
            }
        }
    }
}

impl std::error::Error for DslError {}

/// Kind of DSL error
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum DslErrorKind {
    /// Error during tokenization
    Lexer,
    /// Error during parsing
    Parser,
    /// Error during compilation to Grid
    Compiler,
}

impl fmt::Display for DslErrorKind {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            DslErrorKind::Lexer => write!(f, "Lexer"),
            DslErrorKind::Parser => write!(f, "Parser"),
            DslErrorKind::Compiler => write!(f, "Compiler"),
        }
    }
}
