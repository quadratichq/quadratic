use super::*;

impl fmt::Debug for CellRefRange {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            CellRefRange::Sheet { range } => {
                f.debug_tuple("CellRefRange::Sheet").field(range).finish()
            }
            CellRefRange::Table { range } => {
                f.debug_tuple("CellRefRange::Table").field(range).finish()
            }
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
