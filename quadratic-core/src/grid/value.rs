use serde::{Deserialize, Serialize};

#[derive(Serialize, Deserialize, Debug, Clone, PartialEq)]
pub enum CellValue {
    Blank,
    Text(String),
    Number(f64),
    Logical(bool),
    Error,
    Instant(Instant),
    Duration(Duration),
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
