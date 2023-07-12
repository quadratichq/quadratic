use std::fmt;

use serde::{Deserialize, Serialize};

use super::js_structs::Any;
use crate::formulas::BasicValue;

#[derive(Serialize, Deserialize, Debug, Default, Clone, PartialEq)]
pub enum CellValue {
    #[default]
    Blank,
    Text(String),
    Number(f64),
    Logical(bool),
    Error, // TODO: what kind of information to include?
    Instant(Instant),
    Duration(Duration),
}
impl fmt::Display for CellValue {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            CellValue::Blank => Ok(()),
            CellValue::Text(s) => write!(f, "{s}"),
            CellValue::Number(n) => write!(f, "{n}"),
            CellValue::Logical(b) => write!(f, "{b}"),
            CellValue::Error => write!(f, "#ERROR"),
            CellValue::Instant(i) => todo!("format instant"),
            CellValue::Duration(d) => todo!("format duration"),
        }
    }
}
impl From<BasicValue> for CellValue {
    fn from(basic_value: BasicValue) -> Self {
        match basic_value {
            BasicValue::Blank => CellValue::Blank,
            BasicValue::String(s) => CellValue::Text(s),
            BasicValue::Number(n) => CellValue::Number(n),
            BasicValue::Bool(b) => CellValue::Logical(b),
            BasicValue::Err(_e) => CellValue::Error,
        }
    }
}
impl From<Any> for CellValue {
    fn from(value: Any) -> Self {
        match value {
            Any::Number(n) => CellValue::Number(n),
            Any::String(s) => CellValue::Text(s),
            Any::Boolean(b) => CellValue::Logical(b),
        }
    }
}
impl From<Option<Any>> for CellValue {
    fn from(value: Option<Any>) -> Self {
        match value {
            Some(v) => v.into(),
            None => CellValue::Blank,
        }
    }
}

#[derive(Serialize, Deserialize, Debug, Copy, Clone, PartialEq)]
pub struct Instant {
    pub seconds: f64,
}
#[derive(Serialize, Deserialize, Debug, Copy, Clone, PartialEq)]
pub struct Duration {
    pub years: i32,
    pub months: i32,
    pub seconds: f64,
}
