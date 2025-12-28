//! Binary serialization helpers using bincode.
//!
//! This module provides efficient serialization for messages between
//! quadratic-core and quadratic-rust-renderer workers.

use bincode::config::{Configuration, Fixint, LittleEndian, NoLimit};
use bincode::{Decode, Encode};

/// Bincode configuration optimized for speed.
/// - Little endian: most common architecture
/// - Fixed int encoding: faster than variable
/// - No limit: we trust our own data
const CONFIG: Configuration<LittleEndian, Fixint, NoLimit> = bincode::config::standard()
    .with_little_endian()
    .with_fixed_int_encoding()
    .with_no_limit();

/// Serialization error type.
#[derive(Debug)]
pub enum SerializeError {
    Bincode(bincode::error::EncodeError),
}

impl std::fmt::Display for SerializeError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            SerializeError::Bincode(e) => write!(f, "bincode encode error: {}", e),
        }
    }
}

impl std::error::Error for SerializeError {}

impl From<bincode::error::EncodeError> for SerializeError {
    fn from(e: bincode::error::EncodeError) -> Self {
        SerializeError::Bincode(e)
    }
}

/// Deserialization error type.
#[derive(Debug)]
pub enum DeserializeError {
    Bincode(bincode::error::DecodeError),
}

impl std::fmt::Display for DeserializeError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            DeserializeError::Bincode(e) => write!(f, "bincode decode error: {}", e),
        }
    }
}

impl std::error::Error for DeserializeError {}

impl From<bincode::error::DecodeError> for DeserializeError {
    fn from(e: bincode::error::DecodeError) -> Self {
        DeserializeError::Bincode(e)
    }
}

/// Serialize a value to bytes using bincode.
///
/// This is optimized for speed and produces compact binary output.
pub fn serialize<T: Encode>(value: &T) -> Result<Vec<u8>, SerializeError> {
    Ok(bincode::encode_to_vec(value, CONFIG)?)
}

/// Serialize a value directly into a pre-allocated buffer.
///
/// Returns the number of bytes written.
pub fn serialize_into<T: Encode>(value: &T, buffer: &mut [u8]) -> Result<usize, SerializeError> {
    Ok(bincode::encode_into_slice(value, buffer, CONFIG)?)
}

/// Deserialize a value from bytes using bincode.
pub fn deserialize<T: Decode<()>>(bytes: &[u8]) -> Result<T, DeserializeError> {
    let (value, _) = bincode::decode_from_slice(bytes, CONFIG)?;
    Ok(value)
}

/// Estimate the serialized size of a value.
///
/// This is useful for pre-allocating buffers.
pub fn serialized_size<T: Encode>(value: &T) -> Result<usize, SerializeError> {
    // bincode 2.0 doesn't have a direct size function, so we serialize and check
    Ok(serialize(value)?.len())
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::{CoreToRenderer, Pos, SheetId};

    #[test]
    fn test_pos_roundtrip() {
        let pos = Pos::new(12345, -67890);
        let bytes = serialize(&pos).unwrap();
        let decoded: Pos = deserialize(&bytes).unwrap();
        assert_eq!(pos, decoded);
    }

    #[test]
    fn test_pos_size() {
        let pos = Pos::new(1, 2);
        let bytes = serialize(&pos).unwrap();
        // i64 + i64 = 16 bytes with fixed int encoding
        assert_eq!(bytes.len(), 16);
    }

    #[test]
    fn test_message_roundtrip() {
        let msg = CoreToRenderer::DirtyHashes {
            sheet_id: SheetId::test(),
            hashes: vec![Pos::new(0, 0), Pos::new(1, 1), Pos::new(2, 2)],
        };

        let bytes = serialize(&msg).unwrap();
        let decoded: CoreToRenderer = deserialize(&bytes).unwrap();

        match decoded {
            CoreToRenderer::DirtyHashes { hashes, .. } => {
                assert_eq!(hashes.len(), 3);
            }
            _ => panic!("Wrong type"),
        }
    }

    #[test]
    fn test_serialize_into_buffer() {
        let pos = Pos::new(1, 2);
        let mut buffer = [0u8; 32];
        let len = serialize_into(&pos, &mut buffer).unwrap();
        assert_eq!(len, 16);

        let decoded: Pos = deserialize(&buffer[..len]).unwrap();
        assert_eq!(pos, decoded);
    }
}
