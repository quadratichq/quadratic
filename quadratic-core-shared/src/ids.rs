//! Identifier types for sheets and other entities.

use serde::{Deserialize, Serialize};
use uuid::Uuid;

#[cfg(feature = "js")]
use wasm_bindgen::prelude::*;

/// Unique identifier for a sheet.
#[derive(Serialize, Deserialize, Debug, Default, Copy, Clone, PartialEq, Eq, Hash)]
#[cfg_attr(feature = "ts", derive(ts_rs::TS))]
#[cfg_attr(feature = "js", wasm_bindgen)]
pub struct SheetId {
    id: Uuid,
}

impl SheetId {
    /// Create a new random SheetId
    pub fn new() -> Self {
        Self { id: Uuid::new_v4() }
    }

    /// Create a SheetId from an existing UUID
    pub const fn from_uuid(id: Uuid) -> Self {
        Self { id }
    }

    /// Get the underlying UUID
    pub const fn as_uuid(&self) -> Uuid {
        self.id
    }

    /// Parse a SheetId from a string
    pub fn from_str(s: &str) -> Result<Self, uuid::Error> {
        Ok(Self {
            id: Uuid::parse_str(s)?,
        })
    }

    /// SheetId for testing (nil UUID)
    pub const fn test() -> Self {
        Self { id: Uuid::nil() }
    }

    /// Alias for test() - used in quadratic-core
    pub const TEST: Self = Self { id: Uuid::nil() };
}

impl std::fmt::Display for SheetId {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        write!(f, "{}", self.id)
    }
}

impl std::str::FromStr for SheetId {
    type Err = uuid::Error;

    fn from_str(s: &str) -> Result<Self, Self::Err> {
        SheetId::from_str(s)
    }
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
    fn test_sheet_id_test() {
        let id = SheetId::test();
        assert_eq!(id, SheetId::TEST);
        assert_eq!(id.as_uuid(), Uuid::nil());
    }

    #[test]
    fn test_sheet_id_from_str() {
        let uuid_str = "550e8400-e29b-41d4-a716-446655440000";
        let id = SheetId::from_str(uuid_str).unwrap();
        assert_eq!(id.to_string(), uuid_str);
    }

    #[test]
    fn test_sheet_id_display() {
        let id = SheetId::test();
        assert_eq!(id.to_string(), "00000000-0000-0000-0000-000000000000");
    }
}
