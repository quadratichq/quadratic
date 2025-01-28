use super::*;

impl fmt::Debug for CellRefRange {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            CellRefRange::Sheet { range } => write!(f, "CellRefRange::Sheet({})", range),
            CellRefRange::Table { range } => write!(f, "CellRefRange::Table({})", range),
        }
    }
}

impl fmt::Display for CellRefRange {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            Self::Sheet { range } => fmt::Display::fmt(range, f),
            Self::Table { range } => fmt::Display::fmt(range, f),
        }
    }
}
