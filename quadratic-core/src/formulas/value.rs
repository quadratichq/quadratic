use std::fmt;

use super::{FormulaErrorMsg, FormulaResult, Spanned};

#[derive(Debug, Clone, PartialEq)]
pub enum Value {
    String(String),
    Number(f64),
    Bool(bool),
}

impl fmt::Display for Value {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            Value::String(s) => write!(f, "{s}"),
            Value::Number(n) => write!(f, "{n}"),
            Value::Bool(true) => write!(f, "TRUE"),
            Value::Bool(false) => write!(f, "FALSE"),
        }
    }
}

impl Value {
    pub fn type_name(&self) -> &'static str {
        match self {
            Value::String(_) => "string",
            Value::Number(_) => "number",
            Value::Bool(_) => "boolean",
        }
    }
}

impl Spanned<Value> {
    pub fn to_number(&self) -> FormulaResult<f64> {
        match &self.inner {
            Value::String(s) => {
                if s.trim().is_empty() {
                    return Ok(0.0);
                }
                s.trim().parse().map_err(|_| {
                    FormulaErrorMsg::Expected {
                        expected: "number".into(),
                        got: Some(format!("{s:?}").into()),
                    }
                    .with_span(self)
                })
            }
            Value::Number(n) => Ok(*n),
            Value::Bool(true) => Ok(1.0),
            Value::Bool(false) => Ok(0.0),
        }
    }

    pub fn to_bool(&self) -> FormulaResult<bool> {
        match &self.inner {
            Value::Bool(b) => Ok(*b),
            Value::String(s) if s.eq_ignore_ascii_case("TRUE") => Ok(true),
            Value::String(s) if s.eq_ignore_ascii_case("FALSE") => Ok(false),
            _ => Err(FormulaErrorMsg::Expected {
                expected: "boolean".into(),
                got: Some(self.inner.type_name().into()),
            }
            .with_span(self.span)),
        }
    }
}
