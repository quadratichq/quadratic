//! Parquet Utilities
//!
//! Functions to interact with Parquet files

use arrow::datatypes::{DataType, TimeUnit};
use arrow::record_batch::RecordBatch;
use bytes::Bytes;
use parquet::arrow::ArrowWriter;
use parquet::basic::Compression;
use parquet::file::properties::WriterProperties;
use parquet::file::reader::{ChunkReader, FileReader, SerializedFileReader};
use parquet::record::{Field, Row};
use std::fs::File;
use std::sync::Arc;

use crate::SharedError;
use crate::error::Result;
use crate::parquet::error::Parquet as ParquetError;
use crate::parquet::string_column::StringColumn;

/// Direct conversion from Parquet Field to Arrow DataType.
/// This bypasses the ArrowFieldType intermediary for cases where you want
/// to preserve the full range of Parquet data types.
pub fn field_to_data_type(field: &Field) -> Result<DataType> {
    match field {
        Field::Null => Ok(DataType::Null),
        Field::Bool(_) => Ok(DataType::Boolean),
        Field::Byte(_) => Ok(DataType::Int8),
        Field::Short(_) => Ok(DataType::Int16),
        Field::Int(_) => Ok(DataType::Int32),
        Field::Long(_) => Ok(DataType::Int64),
        Field::UByte(_) => Ok(DataType::UInt8),
        Field::UShort(_) => Ok(DataType::UInt16),
        Field::UInt(_) => Ok(DataType::UInt32),
        Field::ULong(_) => Ok(DataType::UInt64),
        Field::Float(_) => Ok(DataType::Float32),
        Field::Float16(_) => Ok(DataType::Float32), // Arrow doesn't have Float16
        Field::Double(_) => Ok(DataType::Float64),
        Field::Str(_) => Ok(DataType::Utf8),
        Field::Bytes(_) => Ok(DataType::Binary),
        Field::Date(_) => Ok(DataType::Date32),
        Field::TimestampMillis(_) => Ok(DataType::Timestamp(TimeUnit::Millisecond, None)),
        Field::TimestampMicros(_) => Ok(DataType::Timestamp(TimeUnit::Microsecond, None)),
        Field::Decimal(_) => Ok(DataType::Decimal128(38, 10)), // Default precision and scale
        Field::Group(_) => {
            Err(ParquetError::Unknown("nested groups not supported yet".into()).into())
        }
        Field::ListInternal(_) => {
            Err(ParquetError::Unknown("Lists not supported yet".into()).into())
        }
        Field::MapInternal(_) => Err(ParquetError::Unknown("Maps not supported yet".into()).into()),
    }
}

/// Convert a Parquet reader to a vector of rows
pub fn reader_to_vec<T: ChunkReader + 'static>(
    reader: SerializedFileReader<T>,
) -> Result<Vec<Row>> {
    let rows = reader
        .get_row_iter(None)
        .map_err(|e| SharedError::Generic(format!("Could not convert to rows: {e}")))?
        .flatten()
        .collect::<Vec<_>>();

    Ok(rows)
}

/// Convert a Parquet file to a vector of rows
pub fn file_to_rows(file: &str) -> Result<Vec<Row>> {
    let file = std::fs::File::open(file)
        .map_err(|e| SharedError::Generic(format!("Could not open file: {e}")))?;
    let reader = SerializedFileReader::new(file)?;

    reader_to_vec(reader)
}

/// Convert a Parquet bytes to a vector of rows
pub fn bytes_to_rows(bytes: Bytes) -> Result<Vec<Row>> {
    let reader = SerializedFileReader::new(bytes)?;

    reader_to_vec(reader)
}

/// Compare a Parquet file with a vector of bytes
pub fn compare_parquet_file_with_bytes(file: &str, bytes: Bytes) -> bool {
    let file_rows = file_to_rows(file);
    let bytes_rows = bytes_to_rows(bytes);

    file_rows == bytes_rows
}

/// Convert a vec into a parquet file using Arrow with direct Field to DataType conversion
/// This preserves the full range of Parquet data types
pub fn vec_to_parquet(vec: Vec<Row>, file: &str) -> Result<()> {
    if vec.is_empty() {
        return Err(SharedError::Generic(
            "Cannot write empty vector to parquet file".to_string(),
        ));
    }

    let (arrow_schema, column_data) = StringColumn::build_arrow_schema_and_data(&vec)?;
    let arrow_arrays = StringColumn::arrow_arrays(column_data, &arrow_schema)?;
    let record_batch = RecordBatch::try_new(Arc::new(arrow_schema), arrow_arrays)
        .map_err(|e| ParquetError::VecToParquet(format!("Could not create record batch: {e}")))?;

    write_record_batch(record_batch, file)?;

    Ok(())
}

pub fn write_record_batch(record_batch: RecordBatch, file: &str) -> Result<()> {
    let output_file = File::create(file)
        .map_err(|e| ParquetError::WriteRecordBatch(format!("Could not create file: {e}")))?;
    let props = WriterProperties::builder()
        .set_compression(Compression::SNAPPY)
        .build();
    let mut writer = ArrowWriter::try_new(output_file, record_batch.schema(), Some(props))?;
    writer.write(&record_batch)?;
    writer.close()?;

    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    use arrow::datatypes::{DataType, Field as ArrowField, Schema as ArrowSchema};
    use arrow::record_batch::RecordBatch;
    use arrow_array::{BooleanArray, Float32Array, Float64Array, Int32Array, StringArray};
    use parquet::arrow::ArrowWriter;
    use parquet::record::Row;
    use std::fs;
    use tempfile::tempdir;
    use tracing_test::traced_test;

    #[traced_test]
    #[test]
    fn test_vec_to_parquet_with_overlapping_keys() {
        let temp_dir = tempdir()
            .map_err(|e| SharedError::Generic(format!("Could not create temp dir: {e}")))
            .unwrap();
        let file_path = temp_dir.path().join("test_overlapping.parquet");
        let file_path_str = file_path.to_str().unwrap();

        let temp_file_1 = temp_dir.path().join("source1.parquet");
        let schema1 = ArrowSchema::new(vec![
            ArrowField::new("name", DataType::Utf8, true),
            ArrowField::new("age", DataType::Int32, true),
            ArrowField::new("score", DataType::Float32, true),
        ]);
        let batch1 = RecordBatch::try_new(
            Arc::new(schema1.clone()),
            vec![
                Arc::new(StringArray::from(vec![Some("Alice"), Some("Bob")])),
                Arc::new(Int32Array::from(vec![Some(25), Some(30)])),
                Arc::new(Float32Array::from(vec![Some(95.5), None])), // Bob has no score
            ],
        )
        .unwrap();
        let file1 = File::create(&temp_file_1).unwrap();
        let mut writer1 = ArrowWriter::try_new(file1, batch1.schema(), None).unwrap();
        writer1.write(&batch1).unwrap();
        writer1.close().unwrap();

        let temp_file_2 = temp_dir.path().join("source2.parquet");
        let schema2 = ArrowSchema::new(vec![
            ArrowField::new("name", DataType::Utf8, true),
            ArrowField::new("active", DataType::Boolean, true),
            ArrowField::new("category", DataType::Utf8, true),
        ]);
        let batch2 = RecordBatch::try_new(
            Arc::new(schema2.clone()),
            vec![
                Arc::new(StringArray::from(vec![Some("Charlie"), Some("Diana")])),
                Arc::new(BooleanArray::from(vec![Some(true), Some(false)])),
                Arc::new(StringArray::from(vec![Some("premium"), Some("gold")])),
            ],
        )
        .unwrap();
        let file2 = File::create(&temp_file_2).unwrap();
        let mut writer2 = ArrowWriter::try_new(file2, batch2.schema(), None).unwrap();
        writer2.write(&batch2).unwrap();
        writer2.close().unwrap();

        let rows1 = file_to_rows(temp_file_1.to_str().unwrap()).unwrap();
        let rows2 = file_to_rows(temp_file_2.to_str().unwrap()).unwrap();
        let mut test_rows = rows1;
        test_rows.extend(rows2);

        // write to parquet
        vec_to_parquet(test_rows, file_path_str).unwrap();
        assert!(file_path.exists(), "Parquet file should be created");

        // read back the file and verify we can parse it
        let rows = file_to_rows(file_path_str).unwrap();
        assert_eq!(rows.len(), 4, "Should have 4 rows in the parquet file");

        if !rows.is_empty() {
            println!(
                "All row fields: {:?}",
                rows.iter()
                    .map(|row| row.get_column_iter().collect::<Vec<_>>())
                    .collect::<Vec<_>>()
            );
        }

        // clean up
        fs::remove_file(&file_path).ok();
    }

    #[test]
    fn test_vec_to_parquet_type_unification() -> Result<()> {
        let temp_dir = tempdir()
            .map_err(|e| SharedError::Generic(format!("Could not create temp dir: {e}")))?;
        let file_path = temp_dir.path().join("test_types.parquet");
        let file_path_str = file_path.to_str().unwrap();

        let mut test_rows: Vec<Row> = Vec::new();

        // Create test data with type progression: Int -> Float -> Double -> String
        // This will test the type unification logic

        // Create first file with Int32 values
        let temp_file_int = temp_dir.path().join("int_data.parquet");
        let schema_int = ArrowSchema::new(vec![
            ArrowField::new("id", DataType::Int32, false),
            ArrowField::new("value", DataType::Int32, false),
        ]);

        let batch_int = RecordBatch::try_new(
            Arc::new(schema_int),
            vec![
                Arc::new(Int32Array::from(vec![1, 2])),
                Arc::new(Int32Array::from(vec![100, 200])),
            ],
        )?;

        let file_int = File::create(&temp_file_int)?;
        let mut writer_int = ArrowWriter::try_new(file_int, batch_int.schema(), None)?;
        writer_int.write(&batch_int)?;
        writer_int.close()?;

        // Create second file with Float32 values (should widen to Float64 when combined)
        let temp_file_float = temp_dir.path().join("float_data.parquet");
        let schema_float = ArrowSchema::new(vec![
            ArrowField::new("id", DataType::Int32, false),
            ArrowField::new("value", DataType::Float64, false), // Use Float64 to test type widening
        ]);

        let batch_float = RecordBatch::try_new(
            Arc::new(schema_float),
            vec![
                Arc::new(Int32Array::from(vec![3, 4])),
                Arc::new(Float64Array::from(vec![100.5, 200.123456789])),
            ],
        )?;

        let file_float = File::create(&temp_file_float)?;
        let mut writer_float = ArrowWriter::try_new(file_float, batch_float.schema(), None)?;
        writer_float.write(&batch_float)?;
        writer_float.close()?;

        // Read both files and combine
        let rows_int = file_to_rows(temp_file_int.to_str().unwrap())?;
        let rows_float = file_to_rows(temp_file_float.to_str().unwrap())?;

        test_rows.extend(rows_int);
        test_rows.extend(rows_float);

        // Write and verify
        vec_to_parquet(test_rows, file_path_str)?;
        assert!(file_path.exists(), "Parquet file should be created");

        // Read back
        let rows = file_to_rows(file_path_str)?;
        assert_eq!(rows.len(), 4, "Should have 4 rows");

        // Clean up
        fs::remove_file(&file_path).ok();

        Ok(())
    }

    #[test]
    fn test_vec_to_parquet_empty_vec() {
        let temp_dir = tempdir().unwrap();
        let file_path = temp_dir.path().join("test_empty.parquet");
        let file_path_str = file_path.to_str().unwrap();

        let empty_rows: Vec<Row> = Vec::new();

        // Should return an error for empty vector
        let result = vec_to_parquet(empty_rows, file_path_str);
        assert!(result.is_err(), "Should return error for empty vector");

        if let Err(SharedError::Generic(msg)) = result {
            assert!(
                msg.contains("Cannot write empty vector"),
                "Error should mention empty vector"
            );
        } else {
            panic!("Expected Generic error");
        }
    }
}
