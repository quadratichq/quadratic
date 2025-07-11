mod compression;

use arrow_schema::DataType;
use bigdecimal::BigDecimal;
use bincode::{Decode, Encode};
use rust_decimal::Decimal;
use serde::{Deserialize, Serialize};

pub type CellValueBigDecimal = BigDecimal;

#[derive(Debug, Serialize, Deserialize)]
pub struct CellValueRustDecimal(#[serde(with = "rust_decimal::serde::float")] pub Decimal);

pub type CellValueDecimal128 = DataType;

// #[derive(Debug, Encode, Decode, Serialize, Deserialize)]
// enum CellValueDecimal128 {
//     Number(DataType),
// }

#[cfg(test)]
mod tests {
    use std::time::Instant;

    use num_format::{Locale, ToFormattedString};

    use super::*;

    fn format_size(size: usize) -> String {
        size.to_formatted_string(&Locale::en)
    }

    #[test]
    fn bigdecimal() {
        let mut numbers = vec![];
        let mut count = 0;
        let compression_format = compression::CompressionFormat::Zlib;
        let serialization_format = compression::SerializationFormat::Json;

        // Insert BigDecimal
        let start = Instant::now();

        while count < 1_000_000 {
            numbers.push(BigDecimal::from(count));
            count += 1;
        }

        println!("Insert BigDecimal: {:?}", start.elapsed());

        // serialize to json
        let start = Instant::now();
        let serialized = compression::serialize(&serialization_format, &numbers).unwrap();
        println!(
            "Serialize to {:?} time: {:?}",
            serialization_format,
            start.elapsed()
        );
        println!(
            "Serialize to {:?} size: {:?}",
            serialization_format,
            format_size(serialized.len())
        );

        let compressed = compression::compress(&compression_format, serialized).unwrap();
        println!(
            "Compress using {:?} time: {:?} at level {:?}",
            compression_format,
            start.elapsed(),
            compression::ZSTD_COMPRESSION_LEVEL
        );
        println!(
            "Compress using {:?} size {:?} at level {:?}",
            compression_format,
            format_size(compressed.len()),
            compression::ZSTD_COMPRESSION_LEVEL
        );

        // // deserialize from bincode
        // let start = Instant::now();
        // let decoded: Vec<CellValueBigDecimal> = compression::decompress_and_deserialize(
        //     &serialization_format,
        //     &compression_format,
        //     &encoded,
        // )
        // .unwrap();
        // println!("Deserialize from bincode time: {:?}", start.elapsed());
        // println!("Deserialize from bincode size: {:?}", decoded.len());
    }

    #[test]
    fn rust_decimal() {
        let mut numbers = vec![];
        let mut count = 0;
        let compression_format = compression::CompressionFormat::Zstd;
        let serialization_format = compression::SerializationFormat::Json;

        // Insert RustDecimal
        let start = Instant::now();

        while count < 1_000_000 {
            numbers.push(Decimal::from(count));
            count += 1;
        }

        println!("Insert RustDecimal: {:?}", start.elapsed());

        // serialize to json
        let start = Instant::now();
        let serialized = compression::serialize(&serialization_format, &numbers).unwrap();
        println!(
            "Serialize to {:?} time: {:?}",
            serialization_format,
            start.elapsed()
        );
        println!(
            "Serialize to {:?} size: {:?}",
            serialization_format,
            format_size(serialized.len())
        );

        let compressed = compression::compress(&compression_format, serialized).unwrap();
        println!(
            "Compress using {:?} time: {:?} at level {:?}",
            compression_format,
            start.elapsed(),
            compression::ZSTD_COMPRESSION_LEVEL
        );
        println!(
            "Compress using {:?} size {:?} at level {:?}",
            compression_format,
            format_size(compressed.len()),
            compression::ZSTD_COMPRESSION_LEVEL
        );
    }

    #[test]
    fn decimal128() {
        let mut numbers = vec![];
        let mut count = 0;
        let compression_format = compression::CompressionFormat::Zlib;
        let serialization_format = compression::SerializationFormat::Json;

        // Insert Decimal128
        let start = Instant::now();

        while count < 1_000_000 {
            numbers.push(DataType::Decimal128(10, 2));
            count += 1;
        }

        println!("Insert Decimal128: {:?}", start.elapsed());

        // serialize to json
        let start = Instant::now();
        let serialized = compression::serialize(&serialization_format, &numbers).unwrap();
        println!(
            "Serialize to {:?} time: {:?}",
            serialization_format,
            start.elapsed()
        );
        println!(
            "Serialize to {:?} size: {:?}",
            serialization_format,
            format_size(serialized.len())
        );

        let compressed = compression::compress(&compression_format, serialized).unwrap();
        println!("Compress time: {:?}", start.elapsed());
        println!("Compress size: {:?}", format_size(compressed.len()));
    }
}
