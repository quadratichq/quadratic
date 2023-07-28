use std::fmt;

use serde::{Deserialize, Serialize};

use crate::formulas::BasicValue;

#[derive(Serialize, Deserialize, Debug, Default, Clone, PartialEq)]
#[serde(tag = "type", content = "value")]
#[serde(rename_all = "snake_case")]
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
            CellValue::Instant(i) => todo!("format instant {i:?}"),
            CellValue::Duration(d) => todo!("format duration {d:?}"),
        }
    }
}
impl<T: Into<BasicValue>> From<T> for CellValue {
    fn from(basic_value: T) -> Self {
        match basic_value.into() {
            BasicValue::Blank => CellValue::Blank,
            BasicValue::String(s) => CellValue::Text(s),
            BasicValue::Number(n) => CellValue::Number(n),
            BasicValue::Bool(b) => CellValue::Logical(b),
            BasicValue::Err(_e) => CellValue::Error,
        }
    }
}
impl CellValue {
    pub fn is_blank(&self) -> bool {
        *self == Self::Blank
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
