use serde::{Deserialize, Serialize};

/// Contents of a single spreadsheet cell.
#[derive(Serialize, Deserialize, Debug, Default, Clone, PartialEq)]
pub enum Cell {
    #[default]
    Empty,
    Int(i64),
    Float(f64),
    Text(String),
    Python(String),
}
impl Cell {
    pub fn is_empty(&self) -> bool {
        matches!(self, Self::Empty)
    }
}
