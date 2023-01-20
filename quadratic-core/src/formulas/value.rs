use std::fmt;

use super::{FormulaErrorMsg, FormulaResult, Spanned};

#[derive(Debug, Clone, PartialEq)]
pub enum Value {
    String(String),
}
impl fmt::Display for Value {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            Value::String(s) => write!(f, "{s}"),
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
        }
    }
}
