use anyhow::{Result, anyhow};
use bincode::config;
use flate2::{
    Compression,
    write::{ZlibDecoder, ZlibEncoder},
};
use serde::{Deserialize, Serialize, de::DeserializeOwned};
use std::io::prelude::*;

const HEADER_DELIMITER: u8 = "*".as_bytes()[0];
const BUFFER_SIZE: usize = 8192; // 8KB chunks
const MAX_FILE_SIZE: usize = 104857600; // 100 MB
const BINCODE_CONFIG: bincode::config::Configuration<
    bincode::config::LittleEndian,
    bincode::config::Fixint,
    bincode::config::Limit<MAX_FILE_SIZE>, // 100 MB
> = config::standard()
    .with_fixed_int_encoding()
    .with_limit::<MAX_FILE_SIZE>();
pub const ZSTD_COMPRESSION_LEVEL: i32 = 4;

#[derive(Serialize, Deserialize, Debug, Clone)]
pub enum CompressionFormat {
    None,
    Zlib,
    Zstd,
}

#[derive(Serialize, Deserialize, Debug, Clone)]
pub enum SerializationFormat {
    Bincode,
    Json,
}

#[function_timer::function_timer(dbgjs)]
pub fn serialize_and_compress<T>(
    serialization_format: &SerializationFormat,
    compression_format: &CompressionFormat,
    data: T,
) -> Result<Vec<u8>>
where
    T: serde::Serialize,
{
    let serialized = serialize::<T>(serialization_format, data)?;
    compress(compression_format, serialized)
}

#[function_timer::function_timer(dbgjs)]
pub fn decompress_and_deserialize<T>(
    serialization_format: &SerializationFormat,
    compression_format: &CompressionFormat,
    data: &[u8],
) -> Result<T>
where
    T: DeserializeOwned,
{
    let decompressed = decompress(compression_format, data)?;
    deserialize::<T>(serialization_format, &decompressed)
}

// SERIALIZATION

pub fn serialize<T>(serialization_format: &SerializationFormat, data: T) -> Result<Vec<u8>>
where
    T: serde::Serialize,
{
    match serialization_format {
        SerializationFormat::Bincode => Ok(bincode::serde::encode_to_vec(&data, BINCODE_CONFIG)?),
        SerializationFormat::Json => Ok(serde_json::to_string(&data)?.into_bytes()),
    }
}

pub fn deserialize<T>(serialization_format: &SerializationFormat, data: &[u8]) -> Result<T>
where
    T: DeserializeOwned,
{
    match serialization_format {
        SerializationFormat::Bincode => Ok(deserialize_bincode(data)?),
        SerializationFormat::Json => Ok(serde_json::from_slice(data)?),
    }
}

pub fn deserialize_bincode<T>(data: &[u8]) -> Result<T>
where
    T: DeserializeOwned,
{
    let deserialized =
        bincode::serde::decode_from_slice(data, BINCODE_CONFIG).map_err(|e| anyhow!(e))?;

    Ok(deserialized.0)
}

// COMPRESSION

pub fn compress(compression_format: &CompressionFormat, data: Vec<u8>) -> Result<Vec<u8>> {
    match compression_format {
        CompressionFormat::None => Ok(data),
        CompressionFormat::Zlib => compress_zlib(data),
        CompressionFormat::Zstd => compress_zstd(data),
    }
}

pub fn compress_zlib(data: Vec<u8>) -> Result<Vec<u8>> {
    let mut encoder = ZlibEncoder::new(Vec::new(), Compression::fast());

    for chunk in data.chunks(BUFFER_SIZE) {
        encoder.write_all(chunk)?;
    }

    Ok(encoder.finish()?)
}

pub fn compress_zstd(data: Vec<u8>) -> Result<Vec<u8>> {
    Ok(zstd::encode_all(data.as_slice(), ZSTD_COMPRESSION_LEVEL)?)
}

pub fn decompress(compression_format: &CompressionFormat, data: &[u8]) -> Result<Vec<u8>> {
    match compression_format {
        CompressionFormat::None => Ok(data.to_vec()),
        CompressionFormat::Zlib => decompress_zlib(data),
        CompressionFormat::Zstd => decompress_zstd(data),
    }
}

pub fn decompress_zlib(data: &[u8]) -> Result<Vec<u8>> {
    let writer = Vec::new();
    let mut decoder = ZlibDecoder::new(writer);

    for chunk in data.chunks(BUFFER_SIZE) {
        decoder.write_all(chunk)?;
    }

    Ok(decoder.finish()?)
}

pub fn decompress_zstd(data: &[u8]) -> Result<Vec<u8>> {
    Ok(zstd::decode_all(data)?)
}

// HEADER

pub fn add_header(header: Vec<u8>, data: Vec<u8>) -> Result<Vec<u8>> {
    // add the delimiter to the header
    let mut output = [header, vec![HEADER_DELIMITER]].concat();

    // now append the data
    output.extend(data);

    Ok(output)
}

pub fn remove_header(data: &[u8]) -> Result<(&[u8], &[u8])> {
    let index = data
        .iter()
        .position(|&r| r == HEADER_DELIMITER)
        .ok_or_else(|| anyhow!("Could not find the file header delimiter"))?;
    let header = &data[0..=index];
    let data = &data[index + 1..];

    Ok((header, data))
}

#[cfg(test)]
mod test {
    use super::*;

    fn assert_roundtrip_compression(
        serialization_format: &SerializationFormat,
        compression_format: &CompressionFormat,
    ) {
        let data = "hello world";
        let compressed =
            serialize_and_compress(serialization_format, compression_format, data).unwrap();
        let decompressed = decompress_and_deserialize::<String>(
            serialization_format,
            compression_format,
            &compressed,
        )
        .unwrap();

        assert_eq!(data, decompressed);
    }

    #[test]
    fn roundtrip_compression_json() {
        let compression_format = CompressionFormat::Zlib;
        let serialization_format = SerializationFormat::Json;

        assert_roundtrip_compression(&serialization_format, &compression_format);
    }

    #[test]
    fn roundtrip_compression_bincode() {
        let compression_format = CompressionFormat::Zlib;
        let serialization_format = SerializationFormat::Bincode;

        assert_roundtrip_compression(&serialization_format, &compression_format);
    }
}
