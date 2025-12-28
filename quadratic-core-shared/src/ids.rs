use core::fmt;
use core::fmt::Display;
use std::hash::Hash;
use std::str::FromStr;

use anyhow::Result;
use bincode::de::{BorrowDecoder, Decoder};
use bincode::enc::Encoder;
use bincode::error::{DecodeError, EncodeError};
use bincode::{BorrowDecode, Decode, Encode};
use serde::{Deserialize, Serialize};
use uuid::Uuid;

#[derive(Serialize, Deserialize, Debug, Copy, Clone, PartialEq, Eq, Hash)]
#[cfg_attr(feature = "js", derive(ts_rs::TS))]
pub struct SheetId {
    id: Uuid,
}

impl Encode for SheetId {
    fn encode<E: Encoder>(&self, encoder: &mut E) -> Result<(), EncodeError> {
        self.id.as_bytes().encode(encoder)
    }
}

impl<Context> Decode<Context> for SheetId {
    fn decode<D: Decoder<Context = Context>>(decoder: &mut D) -> Result<Self, DecodeError> {
        let bytes: [u8; 16] = Decode::decode(decoder)?;
        Ok(Self {
            id: Uuid::from_bytes(bytes),
        })
    }
}

impl<'de, Context> BorrowDecode<'de, Context> for SheetId {
    fn borrow_decode<D: BorrowDecoder<'de, Context = Context>>(
        decoder: &mut D,
    ) -> Result<Self, DecodeError> {
        let bytes: [u8; 16] = BorrowDecode::borrow_decode(decoder)?;
        Ok(Self {
            id: Uuid::from_bytes(bytes),
        })
    }
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

    /// Returns a test SheetId (nil UUID).
    #[cfg(test)]
    pub fn test() -> Self {
        Self::TEST
    }
}
