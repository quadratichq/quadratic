use anyhow::Result;
use flate2::{
    write::{ZlibDecoder, ZlibEncoder},
    Compression,
};
use serde::de::DeserializeOwned;
use std::io::prelude::*;

pub fn serialize_and_compress<T>(data: &T) -> Result<Vec<u8>>
where
    T: serde::Serialize,
{
    let serialized = serialize(data)?;
    compress(serialized)
}

pub fn serialize<T>(data: &T) -> Result<Vec<u8>>
where
    T: serde::Serialize,
{
    Ok(bincode::serialize(data)?)
}

pub fn compress(data: Vec<u8>) -> Result<Vec<u8>> {
    let mut encoder = ZlibEncoder::new(Vec::new(), Compression::fast());
    encoder.write_all(data.as_slice()).unwrap();
    Ok(encoder.finish()?)
}

pub fn decompress_and_deserialize<T>(data: &[u8]) -> Result<T>
where
    T: DeserializeOwned,
{
    let decompressed = decompress(data)?;
    deserialize(decompressed)
}

pub fn decompress(data: &[u8]) -> Result<Vec<u8>> {
    let writer = Vec::new();
    let mut decoder = ZlibDecoder::new(writer);
    decoder.write_all(&data[..])?;

    Ok(decoder.finish()?)
}

pub fn deserialize<T>(data: Vec<u8>) -> Result<T>
where
    T: DeserializeOwned,
{
    Ok(bincode::deserialize(&data)?)
}

#[cfg(test)]
mod test {
    use super::*;

    #[test]
    fn roundtrip_compression() {
        let data = "hello world";
        let compressed = serialize_and_compress(&data).unwrap();
        let decompressed = decompress_and_deserialize::<String>(&compressed).unwrap();

        assert_eq!(data, decompressed);
    }
}
