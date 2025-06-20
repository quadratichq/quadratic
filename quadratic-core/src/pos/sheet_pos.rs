use crate::{Pos, grid::SheetId};
use anyhow::Result;
use serde::{Deserialize, Serialize};
use std::{fmt, str::FromStr};

/// Used for referencing a pos during computation.
#[derive(Serialize, Deserialize, Debug, Copy, Clone, PartialEq, Eq, Hash)]
#[cfg_attr(feature = "js", derive(ts_rs::TS))]
pub struct SheetPos {
    pub x: i64,
    pub y: i64,
    pub sheet_id: SheetId,
}

impl SheetPos {
    /// Replace the pos with a new pos
    pub fn replace_pos(&mut self, pos: Pos) {
        self.x = pos.x;
        self.y = pos.y;
    }

    #[cfg(test)]
    pub fn test() -> Self {
        Self {
            x: 1,
            y: 1,
            sheet_id: SheetId::TEST,
        }
    }
}

impl fmt::Display for SheetPos {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        write!(f, "{} ({}, {})", self.sheet_id, self.x, self.y)
    }
}

impl From<(i64, i64, SheetId)> for SheetPos {
    fn from((x, y, sheet_id): (i64, i64, SheetId)) -> Self {
        Self { x, y, sheet_id }
    }
}

impl From<(Pos, SheetId)> for SheetPos {
    fn from((pos, sheet_id): (Pos, SheetId)) -> Self {
        Self {
            x: pos.x,
            y: pos.y,
            sheet_id,
        }
    }
}

impl FromStr for SheetPos {
    type Err = String;

    fn from_str(s: &str) -> Result<Self, Self::Err> {
        serde_json::from_str::<SheetPos>(s).map_err(|e| e.to_string())
    }
}

impl fmt::Debug for Pos {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        write!(f, "Pos ({}, {}) {}", self.x, self.y, self.a1_string())
    }
}

impl SheetPos {
    pub fn new(sheet_id: SheetId, x: i64, y: i64) -> Self {
        Self { sheet_id, x, y }
    }
}

#[cfg(test)]
mod test {
    use crate::{Pos, SheetPos, SheetRect, grid::SheetId};

    #[test]
    fn test_pos_into() {
        let pos: Pos = (1, 2).into();
        assert_eq!(pos, Pos { x: 1, y: 2 });

        let sheet_id = SheetId::new();
        let sheet_pos = SheetPos {
            x: 1,
            y: 2,
            sheet_id,
        };
        let check_pos: Pos = sheet_pos.into();
        assert_eq!(check_pos, Pos { x: 1, y: 2 });

        let pos: Pos = (1, 2).into();
        assert_eq!(pos, Pos { x: 1, y: 2 });

        let sheet_pos = SheetPos {
            x: 1,
            y: 2,
            sheet_id,
        };
        let pos: Pos = sheet_pos.into();
        assert_eq!(pos, Pos { x: 1, y: 2 });
    }

    #[test]
    fn test_sheet_rect_new_pos_span() {
        let pos1 = SheetPos {
            x: 1,
            y: 2,
            sheet_id: SheetId::new(),
        };
        let pos2 = SheetPos {
            x: 3,
            y: 4,
            sheet_id: SheetId::new(),
        };
        let rect = SheetRect::new_span(pos1, pos2);
        assert_eq!(rect.min, Pos { x: 1, y: 2 });
        assert_eq!(rect.max, Pos { x: 3, y: 4 });
    }

    #[test]
    fn sheet_pos_from_str() {
        let sheet_id = SheetId::new();
        let sheet_pos = SheetPos {
            x: 1,
            y: 2,
            sheet_id,
        };
        let sheet_pos_str = serde_json::to_string(&sheet_pos).unwrap();
        let parsed_sheet_pos: SheetPos = sheet_pos_str.parse().unwrap();
        assert_eq!(parsed_sheet_pos, sheet_pos);
    }
}
