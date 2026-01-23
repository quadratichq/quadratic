use core::fmt;
use core::fmt::Display;
use std::hash::Hash;
use std::str::FromStr;

use anyhow::Result;
use serde::{Deserialize, Serialize};
use uuid::Uuid;

#[cfg(feature = "js")]
use wasm_bindgen::prelude::*;

// TODO: someday change this to `SheetId(Uuid)` to make TS access easier.
// warning: this would break a LOT of code.
#[derive(Serialize, Deserialize, Debug, Copy, Clone, PartialEq, Eq, Hash)]
#[cfg_attr(feature = "js", derive(ts_rs::TS), wasm_bindgen)]
pub struct SheetId {
    id: Uuid,
}

impl SheetId {
    pub fn new() -> Self {
        Self { id: Uuid::new_v4() }
    }
}

impl Default for SheetId {
    fn default() -> Self {
        Self::new()
    }
}

impl FromStr for SheetId {
    type Err = anyhow::Error;

    fn from_str(s: &str) -> Result<Self> {
        let id = Uuid::parse_str(s);
        Ok(SheetId { id: id? })
    }
}

impl Display for SheetId {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        write!(f, "{}", self.id)
    }
}

impl SheetId {
    /// Sheet ID for testing.
    pub const TEST: Self = Self { id: Uuid::nil() };
}

#[derive(Serialize, Deserialize, Debug, Copy, Clone, PartialEq, Eq, Hash)]
#[cfg_attr(feature = "js", derive(ts_rs::TS), wasm_bindgen)]
pub struct TableId {
    id: Uuid,
}

impl TableId {
    pub fn new() -> Self {
        Self { id: Uuid::new_v4() }
    }
}

impl Default for TableId {
    fn default() -> Self {
        Self::new()
    }
}

impl FromStr for TableId {
    type Err = anyhow::Error;

    fn from_str(s: &str) -> Result<Self> {
        let id = Uuid::parse_str(s)?;
        Ok(TableId { id })
    }
}

impl Display for TableId {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        write!(f, "{}", self.id)
    }
}

impl TableId {
    /// Table ID for testing.
    pub const TEST: Self = Self { id: Uuid::nil() };
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_sheet_id_new() {
        let id1 = SheetId::new();
        let id2 = SheetId::new();
        assert_ne!(id1, id2);
    }

    #[test]
    fn test_sheet_id_from_str() {
        let uuid_str = "550e8400-e29b-41d4-a716-446655440000";
        let id: SheetId = uuid_str.parse().unwrap();
        assert_eq!(id.to_string(), uuid_str);
    }

    #[test]
    fn test_sheet_id_test_constant() {
        assert_eq!(SheetId::TEST.to_string(), "00000000-0000-0000-0000-000000000000");
    }

    #[test]
    fn test_table_id_new() {
        let id1 = TableId::new();
        let id2 = TableId::new();
        assert_ne!(id1, id2);
    }

    #[test]
    fn test_table_id_from_str() {
        let uuid_str = "550e8400-e29b-41d4-a716-446655440000";
        let id: TableId = uuid_str.parse().unwrap();
        assert_eq!(id.to_string(), uuid_str);
    }

    #[test]
    fn test_table_id_test_constant() {
        assert_eq!(TableId::TEST.to_string(), "00000000-0000-0000-0000-000000000000");
    }

    #[test]
    fn test_table_id_default() {
        let id1 = TableId::default();
        let id2 = TableId::default();
        assert_ne!(id1, id2);
    }

    #[test]
    fn test_table_id_invalid_str() {
        let result: Result<TableId> = "not-a-uuid".parse();
        assert!(result.is_err());
    }
}
