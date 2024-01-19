use core::fmt;
use core::fmt::Display;
use std::hash::Hash;
use std::str::FromStr;

use anyhow::Result;
use serde::{Deserialize, Serialize};
use uuid::Uuid;

#[cfg(feature = "js")]
use wasm_bindgen::prelude::*;

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

#[cfg(test)]
impl SheetId {
    pub fn test() -> Self {
        Self {
            id: Uuid::parse_str("00000000-0000-0000-0000-000000000000").unwrap(),
        }
    }
}
