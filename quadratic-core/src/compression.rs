use anyhow::{anyhow, Result};
use flate2::{
    write::{ZlibDecoder, ZlibEncoder},
    Compression,
};
use serde::de::DeserializeOwned;
use std::io::prelude::*;

const HEADER_DELIMITER: u8 = "*".as_bytes()[0];

pub fn serialize_and_compress<T>(data: &T) -> Result<Vec<u8>>
where
    T: serde::Serialize,
{
    let serialized = serialize::<T>(data)?;
    compress(serialized)
}

pub fn serialize<T>(data: &T) -> Result<Vec<u8>>
where
    T: serde::Serialize,
{
    Ok(bincode::serialize::<T>(data)?)
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
    deserialize::<T>(&decompressed)
}

pub fn decompress(data: &[u8]) -> Result<Vec<u8>> {
    let writer = Vec::new();
    let mut decoder = ZlibDecoder::new(writer);
    decoder.write_all(&data)?;

    Ok(decoder.finish()?)
}

pub fn deserialize<T>(data: &[u8]) -> Result<T>
where
    T: DeserializeOwned,
{
    Ok(bincode::deserialize::<T>(data)?)
}

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

    #[test]
    fn roundtrip_compression() {
        let data = "hello world";
        let compressed = serialize_and_compress(&data).unwrap();
        let decompressed = decompress_and_deserialize::<String>(&compressed).unwrap();

        assert_eq!(data, decompressed);
    }
}
