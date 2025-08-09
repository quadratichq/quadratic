use prost_reflect::{DescriptorPool, DynamicMessage};

use crate::{Result, error::SharedError};

/// Efficiently peek at the type field (tag 1) in protobuf without full decode
///
/// This relies on the fact that the type field is always the first field in the message.
pub fn type_name_from_peek(data: &[u8]) -> Result<String> {
    use prost::encoding::{WireType, decode_key, decode_varint};

    let mut buf = data;

    // Read fields until we find tag 1 (type field)
    while !buf.is_empty() {
        let (tag, wire_type) = decode_key(&mut buf)
            .map_err(|e| SharedError::Protobuf(format!("Invalid protobuf key: {}", e)))?;

        if tag == 1 && wire_type == WireType::LengthDelimited {
            // Found tag 1 (type field) - decode the string
            let len = decode_varint(&mut buf)
                .map_err(|e| SharedError::Protobuf(format!("Invalid string length: {}", e)))?;

            if buf.len() < len as usize {
                return Err(SharedError::Protobuf("Truncated string field".to_string()));
            }

            let type_str = std::str::from_utf8(&buf[..len as usize])
                .map_err(|e| SharedError::Protobuf(format!("Invalid UTF-8: {}", e)))?;

            return Ok(type_str.to_string());
        } else {
            // Skip this field based on wire type
            match wire_type {
                WireType::Varint => {
                    decode_varint(&mut buf)
                        .map_err(|e| SharedError::Protobuf(format!("Invalid varint: {}", e)))?;
                }
                WireType::LengthDelimited => {
                    let len = decode_varint(&mut buf)
                        .map_err(|e| SharedError::Protobuf(format!("Invalid length: {}", e)))?;
                    if buf.len() < len as usize {
                        return Err(SharedError::Protobuf("Truncated field".to_string()));
                    }
                    buf = &buf[len as usize..];
                }
                WireType::SixtyFourBit => {
                    if buf.len() < 8 {
                        return Err(SharedError::Protobuf("Truncated 64-bit field".to_string()));
                    }
                    buf = &buf[8..];
                }
                WireType::ThirtyTwoBit => {
                    if buf.len() < 4 {
                        return Err(SharedError::Protobuf("Truncated 32-bit field".to_string()));
                    }
                    buf = &buf[4..];
                }
                _ => {
                    return Err(SharedError::Protobuf("Unknown wire type".to_string()));
                }
            }
        }
    }

    Err(SharedError::Protobuf("Type field not found".to_string()))
}

/// Efficiently determine the type of a protobuf message from the descriptor set
///
/// This relies the file descriptor set, which is a small binary (12kb at the time of writing)
/// that contains all the protobuf messages and their definitions.
/// To make this more efficient, this should be modified to cache the decoding of the descriptor set.
/// See type_from_descriptor_with_pool for a more efficient version.
pub fn type_from_descriptor(message: &[u8]) -> Option<String> {
    let pool_bytes = crate::protobuf::FILE_DESCRIPTOR_SET;
    let pool = DescriptorPool::decode(pool_bytes).unwrap();

    type_from_descriptor_with_pool(message, pool)
}

/// Efficiently determine the type of a protobuf message from the descriptor set
///
/// This relies the file descriptor set, which is a small binary (12kb at the time of writing)
/// that contains all the protobuf messages and their definitions.
/// To make this more efficient, this should be modified to cache the decoding of the descriptor set.
pub fn type_from_descriptor_with_pool(message: &[u8], pool: DescriptorPool) -> Option<String> {
    let mut type_name = None;

    // try each message type in the pool
    for descriptor in pool.all_messages() {
        if let Ok(_message) = DynamicMessage::decode(descriptor.clone(), &message[..]) {
            type_name = Some(descriptor.full_name().to_string());
            break;
        }
    }

    type_name
}
