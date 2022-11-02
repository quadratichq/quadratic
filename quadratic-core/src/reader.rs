use arrow2::array::{Array, BooleanArray, Int32Array, Int8Array, UInt8Array, Utf8Array};
use arrow2::chunk::Chunk;
use arrow2::datatypes::DataType;
use arrow2::error::Result;
use arrow2::io::ipc::write::{StreamWriter as IPCStreamWriter, WriteOptions as IPCWriteOptions};
use arrow2::io::parquet::read::{
    infer_schema, read_metadata as parquet_read_metadata, FileReader as ParquetFileReader,
};
use parquet2::metadata::FileMetaData;
use std::io::Cursor;

use super::utils::log;

/// Internal function to read a buffer with Parquet data into a buffer with Arrow IPC Stream data
/// using the arrow2 and parquet2 crates
pub fn read_parquet(parquet_file: &[u8]) -> Result<Vec<u8>> {
    // Create Parquet reader
    let mut input_file = Cursor::new(parquet_file);

    let metadata = parquet_read_metadata(&mut input_file)?;

    let schema = infer_schema(&metadata)?;

    let file_reader = ParquetFileReader::new(
        input_file,
        metadata.row_groups,
        schema.clone(),
        None,
        None,
        None,
    );

    // Create IPC writer
    let mut output_file = Vec::new();
    let options = IPCWriteOptions { compression: None };
    let mut writer = IPCStreamWriter::new(&mut output_file, options);
    writer.start(&schema, None)?;

    let mut string_rects = vec![];
    // Iterate over reader chunks, writing each into the IPC writer
    for maybe_chunk in file_reader {
        let chunk = maybe_chunk?;

        string_rects.push(generate_matrix(&chunk));
        writer.write(&chunk, None)?;
    }

    writer.finish()?;

    Ok(output_file)
}

fn generate_matrix(chunk: &Chunk<Box<dyn Array>>) -> Vec<Vec<String>> {
    let mut string_rect = vec![];
    log(&format!("Chunk length= {}", chunk.len()));
    let columns = chunk.columns();
    log(&format!("Number of columns= {}", columns.len()));
    for column in columns {
        string_rect.push(to_string_array(column));
    }

    string_rect
}

fn to_string_array(column: &Box<dyn Array>) -> Vec<String> {
    let data_type = column.data_type();
    let c = column.as_any();
    let mut string_array = vec![];

    match data_type {
        DataType::Boolean => match c.downcast_ref::<BooleanArray>() {
            Some(bs) => {
                log("--------BooleanArray--------");
                for mayb in bs.iter() {
                    if let Some(b) = mayb {
                        log(&format!("{}", b));
                        string_array.push(b.to_string());
                    }
                }
            }
            None => string_array.push("Uknown".to_string()),
        },
        DataType::Int8 => match c.downcast_ref::<Int8Array>() {
            Some(primitive_array) => {
                log("--------Int8Array--------");
                for maybii in primitive_array.iter() {
                    if let Some(i) = maybii {
                        log(&format!("{}", i));
                    }
                }
            }
            None => {
                log("Failed to cast into Utf8Array<i32>");
            }
        },

        DataType::Int32 => match c.downcast_ref::<Int32Array>() {
            Some(primitive_array) => {
                log("--------Int32Array--------");
                for maybii in primitive_array.iter() {
                    if let Some(i) = maybii {
                        log(&format!("{}", i));
                    }
                }
            }
            None => {
                log("Failed to cast into Utf8Array<i32>");
            }
        },

        DataType::UInt8 => match c.downcast_ref::<UInt8Array>() {
            Some(primitive_array) => {
                log("--------UInt8Array--------");
                for maybii in primitive_array.iter() {
                    if let Some(i) = maybii {
                        log(&format!("{}", i));
                    }
                }
            }
            None => {
                log("Failed to cast into Utf8Array<i32>");
            }
        },

        DataType::Utf8 => match c.downcast_ref::<Utf8Array<i32>>() {
            Some(primitive_array) => {
                log("--------Utf8Array--------");
                for maybii in primitive_array.iter() {
                    if let Some(i) = maybii {
                        log(&format!("{}", i));
                    }
                }
            }
            None => {
                log("Failed to cast into Utf8Array<i32>");
            }
        },
        _ => {}
    }

    string_array
}

fn match_columns(column: &Box<dyn Array>) {
    let data_type = column.data_type();
    let c = column.as_any();
    match data_type {
        DataType::Null => log(&format!("DataType: {}", 0)),
        DataType::Boolean => match c.downcast_ref::<BooleanArray>() {
            Some(bs) => {
                for mayb in bs.iter() {
                    if let Some(b) = mayb {
                        log(&format!("Bool value: {}", b));
                    }
                }
            }
            None => log("Failed to convert"),
        },
        DataType::Int8 => match c.downcast_ref::<Int8Array>() {
            Some(primitive_array) => {
                for maybii in primitive_array.iter() {
                    if let Some(i) = maybii {
                        log(&format!("Int8 value: {}", i));
                    }
                }
            }
            None => {}
        },
        DataType::Int16 => log(&format!("DataType: {}", 3)),
        DataType::Int32 => match c.downcast_ref::<Int32Array>() {
            Some(primitive_array) => {
                for maybii in primitive_array.iter() {
                    if let Some(i) = maybii {
                        log(&format!("Int32 value: {}", i));
                    }
                }
            }
            None => {}
        },
        DataType::Int64 => log(&format!("DataType: {}", 5)),
        DataType::UInt8 => match c.downcast_ref::<UInt8Array>() {
            Some(primitive_array) => {
                for maybii in primitive_array.iter() {
                    if let Some(i) = maybii {
                        log(&format!("UInt8 value: {}", i));
                    }
                }
            }
            None => {}
        },
        DataType::UInt16 => log(&format!("DataType: {}", 7)),
        DataType::UInt32 => log(&format!("DataType: {}", 8)),
        DataType::UInt64 => log(&format!("DataType: {}", 9)),
        DataType::Float16 => log(&format!("DataType: {}", 10)),
        DataType::Float32 => log(&format!("DataType: {}", 11)),
        DataType::Float64 => log(&format!("DataType: {}", 12)),
        DataType::Timestamp(_, _) => log(&format!("DataType: {}", 13)),
        DataType::Date32 => log(&format!("DataType: {}", 14)),
        DataType::Date64 => log(&format!("DataType: {}", 15)),
        DataType::Time32(_) => log(&format!("DataType: {}", 16)),
        DataType::Time64(_) => log(&format!("DataType: {}", 17)),
        DataType::Duration(_) => log(&format!("DataType: {}", 18)),
        DataType::Interval(_) => log(&format!("DataType: {}", 19)),
        DataType::Binary => log(&format!("DataType: {}", 20)),
        DataType::FixedSizeBinary(_) => log(&format!("DataType: {}", 21)),
        DataType::LargeBinary => log(&format!("DataType: {}", 22)),
        DataType::Utf8 => match c.downcast_ref::<Utf8Array<i32>>() {
            Some(primitive_array) => {
                for maybii in primitive_array.iter() {
                    if let Some(i) = maybii {
                        log(&format!("UInt8 value: {}", i));
                    }
                }
            }
            None => {
                log("Failed to cast into Utf8Array<i32>");
            }
        },
        DataType::LargeUtf8 => log(&format!("DataType: {}", 24)),
        DataType::List(_) => log(&format!("DataType: {}", 25)),
        DataType::FixedSizeList(_, _) => log(&format!("DataType: {}", 26)),
        DataType::LargeList(_) => log(&format!("DataType: {}", 27)),
        DataType::Struct(_) => log(&format!("DataType: {}", 28)),
        DataType::Union(_, _, _) => log(&format!("DataType: {}", 29)),
        DataType::Map(_, _) => log(&format!("DataType: {}", 30)),
        DataType::Dictionary(_, _, _) => log(&format!("DataType: {}", 31)),
        DataType::Decimal(_, _) => log(&format!("DataType: {}", 32)),
        DataType::Decimal256(_, _) => log(&format!("DataType: {}", 33)),
        DataType::Extension(_, _, _) => log(&format!("DataType: {}", 34)),
    }
}

/// Read metadata from parquet buffer
pub fn read_metadata(parquet_file: &[u8]) -> Result<FileMetaData> {
    let mut input_file = Cursor::new(parquet_file);
    Ok(parquet_read_metadata(&mut input_file)?)
}

// /// Read single row group
// pub fn read_row_group(
//     parquet_file: &[u8],
//     schema: arrow2::datatypes::Schema,
//     row_group: RowGroupMetaData,
// ) -> Result<Vec<u8>> {
//     let input_file = Cursor::new(parquet_file);
//     let file_reader = ParquetFileReader::new(
//         input_file,
//         vec![row_group],
//         schema.clone(),
//         None,
//         None,
//         None,
//     );

//     // Create IPC writer
//     let mut output_file = Vec::new();
//     let options = IPCWriteOptions { compression: None };
//     let mut writer = IPCStreamWriter::new(&mut output_file, options);
//     writer.start(&schema, None)?;

//     // Iterate over reader chunks, writing each into the IPC writer
//     for maybe_chunk in file_reader {
//         let chunk = maybe_chunk?;
//         writer.write(&chunk, None)?;
//     }

//     writer.finish()?;
//     Ok(output_file)
// }
