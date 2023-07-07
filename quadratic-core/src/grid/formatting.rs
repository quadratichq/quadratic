use serde::{Deserialize, Serialize};

#[derive(Serialize, Deserialize, Debug, Copy, Clone, PartialEq, Eq, Hash)]
pub enum CellAlign {
    Center,
    Left,
    Right,
}

#[derive(Serialize, Deserialize, Debug, Copy, Clone, PartialEq, Eq, Hash)]
pub enum CellWrap {
    Overflow,
    Wrap,
    Clip,
}

#[derive(Serialize, Deserialize, Debug, Copy, Clone, PartialEq, Eq, Hash)]
pub struct CellBorders {
    h: CellBorder,
    v: CellBorder,
}
#[derive(Serialize, Deserialize, Debug, Copy, Clone, PartialEq, Eq, Hash)]
pub struct CellBorder {
    color: [u8; 3],
    style: CellBorderStyle,
}
#[derive(Serialize, Deserialize, Debug, Copy, Clone, PartialEq, Eq, Hash)]
pub enum CellBorderStyle {
    Line1,
    Line2,
    Line3,
    Dotted,
    Dashed,
    Double,
}

#[derive(Serialize, Deserialize, Debug, Copy, Clone, PartialEq, Eq, Hash)]
pub struct NumericFormat {
    kind: NumericFormatKind,
    decimals: Option<u32>,
}
#[derive(Serialize, Deserialize, Debug, Copy, Clone, PartialEq, Eq, Hash)]
pub enum NumericFormatKind {
    Default,
    Currency,
    Percentage,
    Exponential,
}
