//! Parquet Utilities
//!
//! Functions to interact with Parquet files

use arrow::datatypes::{DataType, Field as ArrowField, Schema as ArrowSchema};
use arrow::record_batch::RecordBatch;
use bytes::Bytes;
use parquet::arrow::ArrowWriter;
use parquet::basic::Compression;
use parquet::file::properties::WriterProperties;
use parquet::file::reader::{ChunkReader, FileReader, SerializedFileReader};
use parquet::record::{Field, Row};
use std::collections::HashMap;
use std::fs::File;
use std::sync::Arc;

use crate::SharedError;
use crate::error::Result;
use crate::parquet::column_data::ColumnData;
use crate::parquet::error::Parquet as ParquetError;

/// Arrow field types that we can detect and handle
#[derive(Debug, Clone, PartialEq)]
pub enum ArrowFieldType {
    Boolean,
    Int32,
    Int64,
    Float32,
    Float64,
    String,
}

impl ArrowFieldType {
    /// Unify two Arrow field types, choosing the more general type
    pub fn merge(type1: &ArrowFieldType, type2: &ArrowFieldType) -> ArrowFieldType {
        match (type1, type2) {
            (ArrowFieldType::String, _) | (_, ArrowFieldType::String) => ArrowFieldType::String,
            (ArrowFieldType::Float64, _) | (_, ArrowFieldType::Float64) => ArrowFieldType::Float64,
            (ArrowFieldType::Float32, ArrowFieldType::Int32)
            | (ArrowFieldType::Int32, ArrowFieldType::Float32) => ArrowFieldType::Float32,
            (ArrowFieldType::Float32, ArrowFieldType::Int64)
            | (ArrowFieldType::Int64, ArrowFieldType::Float32) => ArrowFieldType::Float64,
            (ArrowFieldType::Int64, _) | (_, ArrowFieldType::Int64) => ArrowFieldType::Int64,
            (ArrowFieldType::Int32, ArrowFieldType::Int32) => ArrowFieldType::Int32,
            (ArrowFieldType::Float32, ArrowFieldType::Float32) => ArrowFieldType::Float32,
            (ArrowFieldType::Boolean, ArrowFieldType::Boolean) => ArrowFieldType::Boolean,

            // Default to string for any other combination
            _ => ArrowFieldType::String,
        }
    }

    /// Create an Arrow schema from the detected field types
    pub fn create_arrow_schema(
        field_types: HashMap<String, ArrowFieldType>,
    ) -> Result<ArrowSchema> {
        let mut arrow_fields = Vec::new();

        for (field_name, field_type) in field_types {
            let data_type = field_type.into();

            // All fields are nullable since rows can have different fields
            let arrow_field = ArrowField::new(&field_name, data_type, true);

            arrow_fields.push(arrow_field);
        }

        Ok(ArrowSchema::new(arrow_fields))
    }
}

impl From<ArrowFieldType> for DataType {
    fn from(field_type: ArrowFieldType) -> Self {
        match field_type {
            ArrowFieldType::Boolean => DataType::Boolean,
            ArrowFieldType::Int32 => DataType::Int32,
            ArrowFieldType::Int64 => DataType::Int64,
            ArrowFieldType::Float32 => DataType::Float32,
            ArrowFieldType::Float64 => DataType::Float64,
            ArrowFieldType::String => DataType::Utf8,
        }
    }
}

impl TryFrom<&Field> for ArrowFieldType {
    type Error = SharedError;

    fn try_from(field: &Field) -> Result<Self, Self::Error> {
        match field {
            Field::Null => Ok(ArrowFieldType::String),
            Field::Bool(_) => Ok(ArrowFieldType::Boolean),
            Field::Byte(_) => Ok(ArrowFieldType::Int32),
            Field::Short(_) => Ok(ArrowFieldType::Int32),
            Field::Int(_) => Ok(ArrowFieldType::Int32),
            Field::Long(_) => Ok(ArrowFieldType::Int64),
            Field::UByte(_) => Ok(ArrowFieldType::Int32),
            Field::UShort(_) => Ok(ArrowFieldType::Int32),
            Field::UInt(_) => Ok(ArrowFieldType::Int64),
            Field::ULong(_) => Ok(ArrowFieldType::Int64),
            Field::Float(_) => Ok(ArrowFieldType::Float32),
            Field::Float16(_) => Ok(ArrowFieldType::Float32),
            Field::Double(_) => Ok(ArrowFieldType::Float64),
            Field::Str(_) => Ok(ArrowFieldType::String),
            Field::Bytes(_) => Ok(ArrowFieldType::String),
            Field::Date(_) => Ok(ArrowFieldType::Int32),
            Field::TimestampMillis(_) => Ok(ArrowFieldType::Int64),
            Field::TimestampMicros(_) => Ok(ArrowFieldType::Int64),
            Field::Decimal(_) => Ok(ArrowFieldType::String),
            Field::Group(_) => {
                Err(ParquetError::Unknown("nested groups not supported yet".into()).into())
            }
            Field::ListInternal(_) => {
                Err(ParquetError::Unknown("Lists not supported yet".into()).into())
            }
            Field::MapInternal(_) => {
                Err(ParquetError::Unknown("Maps not supported yet".into()).into())
            }
        }
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

/// Convert a vec into a parquet file using Arrow
pub fn vec_to_parquet(vec: Vec<Row>, file: &str) -> Result<()> {
    if vec.is_empty() {
        return Err(SharedError::Generic(
            "Cannot write empty vector to parquet file".to_string(),
        ));
    }

    let (arrow_schema, column_data) = build_arrow_schema_and_data(&vec)?;
    let arrow_arrays = ColumnData::arrow_arrays(column_data, &arrow_schema)?;
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

/// Build Arrow schema and collect column data by analyzing all rows
fn build_arrow_schema_and_data(rows: &[Row]) -> Result<(ArrowSchema, HashMap<String, ColumnData>)> {
    let mut field_types: HashMap<String, ArrowFieldType> = HashMap::new();
    let mut column_data: HashMap<String, ColumnData> = HashMap::new();

    // detect all field names and types across all rows
    for row in rows {
        let fields = row.get_column_iter();

        for (i, (name, field)) in fields.enumerate() {
            let field_name = if !name.is_empty() {
                name.clone()
            } else {
                format!("field_{}", i)
            };

            let field_type = ArrowFieldType::try_from(field)?;

            match field_types.get(&field_name) {
                None => {
                    field_types.insert(field_name.clone(), field_type.clone());
                }
                Some(existing_type) => {
                    let unified_type = ArrowFieldType::merge(existing_type, &field_type);
                    field_types.insert(field_name.clone(), unified_type);
                }
            }
        }
    }

    for field_name in field_types.keys() {
        column_data.insert(field_name.clone(), ColumnData::new());
    }

    // process each row and add values or nulls for each column
    for row in rows {
        let fields = row.get_column_iter();
        let mut row_fields: HashMap<String, &Field> = HashMap::new();

        for (i, (name, field)) in fields.enumerate() {
            let field_name = if !name.is_empty() {
                name.clone()
            } else {
                format!("field_{}", i)
            };
            row_fields.insert(field_name, field);
        }

        // add value or null for each known column
        for field_name in field_types.keys() {
            let column = column_data.get_mut(field_name).unwrap();

            if let Some(field) = row_fields.get(field_name) {
                column.add_value(field)?;
            } else {
                column.add_null_value();
            }
        }
    }

    // build the Arrow schema from detected field types
    let schema = ArrowFieldType::create_arrow_schema(field_types)?;

    Ok((schema, column_data))
}

/// Enum representing the types we can detect and handle in Arrow

#[cfg(test)]
mod tests {
    use super::*;
    use arrow_array::{BooleanArray, Float32Array, Float64Array, Int32Array};
    use parquet::record::Row;
    use std::fs;
    use tempfile::tempdir;
    use tracing_test::traced_test;

    #[traced_test]
    #[test]
    fn test_vec_to_parquet_with_overlapping_keys() -> Result<()> {
        // Create a temporary directory for test files
        let temp_dir = tempdir()
            .map_err(|e| SharedError::Generic(format!("Could not create temp dir: {e}")))?;
        let file_path = temp_dir.path().join("test_overlapping.parquet");
        let file_path_str = file_path.to_str().unwrap();

        // For this test, we'll create test data by creating simple parquet files
        // and then reading them as Row vectors to test our vec_to_parquet function

        use arrow::array::{Int32Array, StringArray};
        use arrow::datatypes::{DataType, Field as ArrowField, Schema as ArrowSchema};
        use arrow::record_batch::RecordBatch;
        use parquet::arrow::ArrowWriter;

        // Create a temporary parquet file with overlapping schema
        let temp_file_1 = temp_dir.path().join("source1.parquet");
        let temp_file_2 = temp_dir.path().join("source2.parquet");

        // Schema 1: name, age, score
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
        )?;

        let file1 = File::create(&temp_file_1)?;
        let mut writer1 = ArrowWriter::try_new(file1, batch1.schema(), None)?;
        writer1.write(&batch1)?;
        writer1.close()?;

        // Schema 2: name, active, category
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
        )?;

        let file2 = File::create(&temp_file_2)?;
        let mut writer2 = ArrowWriter::try_new(file2, batch2.schema(), None)?;
        writer2.write(&batch2)?;
        writer2.close()?;

        // Read both files as Row vectors - these will have overlapping but different schemas
        let rows1 = file_to_rows(temp_file_1.to_str().unwrap())?;
        let rows2 = file_to_rows(temp_file_2.to_str().unwrap())?;

        let mut test_rows = Vec::new();
        test_rows.extend(rows1);
        test_rows.extend(rows2);

        // Write to parquet
        vec_to_parquet(test_rows, file_path_str)?;

        // Verify the file was created
        assert!(file_path.exists(), "Parquet file should be created");

        // Read back the file and verify we can parse it
        let rows = file_to_rows(file_path_str)?;

        // Should have 4 rows (2 from each source file)
        assert_eq!(rows.len(), 4, "Should have 4 rows in the parquet file");

        // Verify that we can read the data back (basic smoke test)
        // The exact field structure will depend on how the schema was unified
        println!("Successfully wrote and read back {} rows", rows.len());

        // Print all rows for debugging
        if !rows.is_empty() {
            println!(
                "All row fields: {:?}",
                rows.iter()
                    .map(|row| row.get_column_iter().collect::<Vec<_>>())
                    .collect::<Vec<_>>()
            );
        }

        // Clean up
        fs::remove_file(&file_path).ok();

        Ok(())
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
