use arrow2::array::{Array, BooleanArray, Int32Array, Int8Array, UInt8Array, Utf8Array};
use arrow2::chunk::Chunk;
use arrow2::datatypes::DataType;
use arrow2::error::Result;
use arrow2::io::parquet::read::{
    infer_schema, read_metadata as parquet_read_metadata, FileReader as ParquetFileReader,
};
use parquet2::metadata::FileMetaData;
use std::io::Cursor;

use crate::QuadraticCore;

use super::utils::log;

pub fn read_parquet(q_core: &mut QuadraticCore, parquet_file: &[u8]) {
    // Create Parquet reader
    let mut input_file = Cursor::new(parquet_file);
    match parquet_read_metadata(&mut input_file) {
        Ok(file_metadata) => match infer_schema(&file_metadata) {
            Ok(schema) => {
                // Create reader
                let file_reader = ParquetFileReader::new(
                    input_file,
                    file_metadata.row_groups,
                    schema.clone(),
                    None,
                    None,
                    None,
                );

                // Add all non-corrupt chunks to q_core instance
                for maybe_chunk in file_reader {
                    match maybe_chunk {
                        Ok(chunk) => q_core.chunks.push(chunk),
                        Err(_) => log("Chunk is corrupt..."),
                    }
                }
            }
            Err(_) => log("Schema is corrupt..."),
        },
        Err(_) => log("Metadata is corrupt..."),
    }
}

pub fn generate_string_matrices(q_core: &mut QuadraticCore) {
    for chunk in &q_core.chunks {
        q_core.matrices.push(generate_matrix(&chunk));
    }
}

/// Generates a matrix of strings representing all the values for the chunk/RecordBatch argument
fn generate_matrix(chunk: &Chunk<Box<dyn Array>>) -> Vec<Vec<String>> {
    chunk
        .columns()
        .iter()
        .map(|column| to_string_array(column))
        .collect()
}

/// Generates a Vec<String> corresponding to the values of the column argument.
fn to_string_array(column: &Box<dyn Array>) -> Vec<String> {
    let data_type = column.data_type();
    let c = column.as_any();
    let mut string_array = vec![];

    // This is a demo so there are match arms that remains to be implemented (see below in commented code for all matcharms)
    match data_type {
        DataType::Boolean => match c.downcast_ref::<BooleanArray>() {
            Some(bs) => {
                log("Found BooleanArray");
                for mayb in bs.iter() {
                    if let Some(b) = mayb {
                        string_array.push(b.to_string());
                    }
                }
            }
            None => string_array.push("Uknown".to_string()),
        },
        DataType::Int8 => match c.downcast_ref::<Int8Array>() {
            Some(primitive_array) => {
                log("Found Int8Array");
                for maybii in primitive_array.iter() {
                    if let Some(i) = maybii {
                        string_array.push(i.to_string());
                    }
                }
            }
            None => {
                log("Failed to cast into Utf8Array<i32>");
            }
        },

        DataType::Int32 => match c.downcast_ref::<Int32Array>() {
            Some(primitive_array) => {
                log("Found Int32Array");
                for maybii in primitive_array.iter() {
                    if let Some(i) = maybii {
                        string_array.push(i.to_string());
                    }
                }
            }
            None => {
                log("Failed to cast into Utf8Array<i32>");
            }
        },

        DataType::UInt8 => match c.downcast_ref::<UInt8Array>() {
            Some(primitive_array) => {
                log("Found UInt8Array");
                for maybii in primitive_array.iter() {
                    if let Some(i) = maybii {
                        string_array.push(i.to_string());
                    }
                }
            }
            None => {
                log("Failed to cast into Utf8Array<i32>");
            }
        },

        DataType::Utf8 => match c.downcast_ref::<Utf8Array<i32>>() {
            Some(primitive_array) => {
                log("Found Utf8Array");
                for maybii in primitive_array.iter() {
                    if let Some(i) = maybii {
                        string_array.push(i.to_string());
                    }
                }
            }
            None => {
                log("Failed to cast into Utf8Array<i32>");
            }
        },
        _ => {
            log("");
        }
    }

    string_array
}

/// Read metadata from parquet buffer
pub fn read_metadata(parquet_file: &[u8]) -> Result<FileMetaData> {
    let mut input_file = Cursor::new(parquet_file);
    Ok(parquet_read_metadata(&mut input_file)?)
}

// All match arms are here....
// fn match_columns(column: &Box<dyn Array>) {
//     let data_type = column.data_type();
//     let c = column.as_any();
//     match data_type {
//         DataType::Null => log(&format!("DataType: {}", 0)),
//         DataType::Boolean => match c.downcast_ref::<BooleanArray>() {
//             Some(bs) => {
//                 for mayb in bs.iter() {
//                     if let Some(b) = mayb {
//                         log(&format!("Bool value: {}", b));
//                     }
//                 }
//             }
//             None => log("Failed to convert"),
//         },
//         DataType::Int8 => match c.downcast_ref::<Int8Array>() {
//             Some(primitive_array) => {
//                 for maybii in primitive_array.iter() {
//                     if let Some(i) = maybii {
//                         log(&format!("Int8 value: {}", i));
//                     }
//                 }
//             }
//             None => {}
//         },
//         DataType::Int16 => log(&format!("DataType: {}", 3)),
//         DataType::Int32 => match c.downcast_ref::<Int32Array>() {
//             Some(primitive_array) => {
//                 for maybii in primitive_array.iter() {
//                     if let Some(i) = maybii {
//                         log(&format!("Int32 value: {}", i));
//                     }
//                 }
//             }
//             None => {}
//         },
//         DataType::Int64 => log(&format!("DataType: {}", 5)),
//         DataType::UInt8 => match c.downcast_ref::<UInt8Array>() {
//             Some(primitive_array) => {
//                 for maybii in primitive_array.iter() {
//                     if let Some(i) = maybii {
//                         log(&format!("UInt8 value: {}", i));
//                     }
//                 }
//             }
//             None => {}
//         },
//         DataType::UInt16 => log(&format!("DataType: {}", 7)),
//         DataType::UInt32 => log(&format!("DataType: {}", 8)),
//         DataType::UInt64 => log(&format!("DataType: {}", 9)),
//         DataType::Float16 => log(&format!("DataType: {}", 10)),
//         DataType::Float32 => log(&format!("DataType: {}", 11)),
//         DataType::Float64 => log(&format!("DataType: {}", 12)),
//         DataType::Timestamp(_, _) => log(&format!("DataType: {}", 13)),
//         DataType::Date32 => log(&format!("DataType: {}", 14)),
//         DataType::Date64 => log(&format!("DataType: {}", 15)),
//         DataType::Time32(_) => log(&format!("DataType: {}", 16)),
//         DataType::Time64(_) => log(&format!("DataType: {}", 17)),
//         DataType::Duration(_) => log(&format!("DataType: {}", 18)),
//         DataType::Interval(_) => log(&format!("DataType: {}", 19)),
//         DataType::Binary => log(&format!("DataType: {}", 20)),
//         DataType::FixedSizeBinary(_) => log(&format!("DataType: {}", 21)),
//         DataType::LargeBinary => log(&format!("DataType: {}", 22)),
//         DataType::Utf8 => match c.downcast_ref::<Utf8Array<i32>>() {
//             Some(primitive_array) => {
//                 for maybii in primitive_array.iter() {
//                     if let Some(i) = maybii {
//                         log(&format!("UInt8 value: {}", i));
//                     }
//                 }
//             }
//             None => {
//                 log("Failed to cast into Utf8Array<i32>");
//             }
//         },
//         DataType::LargeUtf8 => log(&format!("DataType: {}", 24)),
//         DataType::List(_) => log(&format!("DataType: {}", 25)),
//         DataType::FixedSizeList(_, _) => log(&format!("DataType: {}", 26)),
//         DataType::LargeList(_) => log(&format!("DataType: {}", 27)),
//         DataType::Struct(_) => log(&format!("DataType: {}", 28)),
//         DataType::Union(_, _, _) => log(&format!("DataType: {}", 29)),
//         DataType::Map(_, _) => log(&format!("DataType: {}", 30)),
//         DataType::Dictionary(_, _, _) => log(&format!("DataType: {}", 31)),
//         DataType::Decimal(_, _) => log(&format!("DataType: {}", 32)),
//         DataType::Decimal256(_, _) => log(&format!("DataType: {}", 33)),
//         DataType::Extension(_, _, _) => log(&format!("DataType: {}", 34)),
//     }
// }
