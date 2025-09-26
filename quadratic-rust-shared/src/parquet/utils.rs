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
use std::io::Write;

use crate::SharedError;
use crate::error::Result;
use crate::parquet::error::Parquet as ParquetError;
// use crate::parquet::string_column::StringColumn;

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

/// Convert a a record batch into a parquet bytes using Arrow with direct Field to DataType conversion
pub fn record_batch_to_parquet_bytes(record_batch: RecordBatch) -> Result<Bytes> {
    let writer = Vec::new();
    let arrow_writer = write_record_batch(record_batch, writer)?;

    Ok(arrow_writer.into_inner()?.into())
}

pub fn write_record_batch<W: Write + Send>(
    record_batch: RecordBatch,
    writer: W,
) -> Result<ArrowWriter<W>> {
    let props = WriterProperties::builder()
        .set_compression(Compression::SNAPPY)
        .build();
    let mut arrow_writer = ArrowWriter::try_new(writer, record_batch.schema(), Some(props))?;
    arrow_writer.write(&record_batch)?;

    Ok(arrow_writer)
}

#[cfg(test)]
mod tests {
    use super::*;
    use arrow::datatypes::{DataType, Field as ArrowField, Schema as ArrowSchema, TimeUnit};
    use arrow::record_batch::RecordBatch;
    use arrow_array::{
        BinaryArray, BooleanArray, Date32Array, Float64Array, Int32Array, Int64Array, StringArray,
        TimestampMillisecondArray,
    };
    use bytes::Bytes;
    use parquet::arrow::arrow_reader::ParquetRecordBatchReaderBuilder;
    use parquet::data_type::{ByteArray, Decimal};
    use parquet::record::{Field, RowAccessor};
    use std::fs::File;
    use std::sync::Arc;
    use tempfile::tempdir;
    use tracing_test::traced_test;

    #[test]
    fn test_field_to_data_type_basic_types() {
        assert_eq!(field_to_data_type(&Field::Null).unwrap(), DataType::Null);
        assert_eq!(
            field_to_data_type(&Field::Bool(true)).unwrap(),
            DataType::Boolean
        );
        assert_eq!(
            field_to_data_type(&Field::Byte(42)).unwrap(),
            DataType::Int8
        );
        assert_eq!(
            field_to_data_type(&Field::Short(42)).unwrap(),
            DataType::Int16
        );
        assert_eq!(
            field_to_data_type(&Field::Int(42)).unwrap(),
            DataType::Int32
        );
        assert_eq!(
            field_to_data_type(&Field::Long(42)).unwrap(),
            DataType::Int64
        );
        assert_eq!(
            field_to_data_type(&Field::UByte(42)).unwrap(),
            DataType::UInt8
        );
        assert_eq!(
            field_to_data_type(&Field::UShort(42)).unwrap(),
            DataType::UInt16
        );
        assert_eq!(
            field_to_data_type(&Field::UInt(42)).unwrap(),
            DataType::UInt32
        );
        assert_eq!(
            field_to_data_type(&Field::ULong(42)).unwrap(),
            DataType::UInt64
        );
        assert_eq!(
            field_to_data_type(&Field::Float(3.12)).unwrap(),
            DataType::Float32
        );
        assert_eq!(
            field_to_data_type(&Field::Double(3.12)).unwrap(),
            DataType::Float64
        );
        assert_eq!(
            field_to_data_type(&Field::Str("test".to_string())).unwrap(),
            DataType::Utf8
        );
        assert_eq!(
            field_to_data_type(&Field::Bytes(vec![1, 2, 3].into())).unwrap(),
            DataType::Binary
        );
        assert_eq!(
            field_to_data_type(&Field::Date(12345)).unwrap(),
            DataType::Date32
        );
        assert_eq!(
            field_to_data_type(&Field::TimestampMillis(1234567890)).unwrap(),
            DataType::Timestamp(TimeUnit::Millisecond, None)
        );
        assert_eq!(
            field_to_data_type(&Field::TimestampMicros(1234567890)).unwrap(),
            DataType::Timestamp(TimeUnit::Microsecond, None)
        );

        let byte_array = ByteArray::from(vec![1, 2, 3]);
        let decimal_value = Decimal::from_bytes(byte_array, 10, 2);
        assert_eq!(
            field_to_data_type(&Field::Decimal(decimal_value)).unwrap(),
            DataType::Decimal128(38, 10)
        );
    }

    #[test]
    fn test_record_batch_to_parquet_bytes() {
        let schema = Arc::new(ArrowSchema::new(vec![
            ArrowField::new("id", DataType::Int32, false),
            ArrowField::new("name", DataType::Utf8, true),
            ArrowField::new("active", DataType::Boolean, true),
        ]));
        let id_array = Arc::new(Int32Array::from(vec![1, 2, 3]));
        let name_array = Arc::new(StringArray::from(vec![Some("Alice"), Some("Bob"), None]));
        let active_array = Arc::new(BooleanArray::from(vec![
            Some(true),
            Some(false),
            Some(true),
        ]));
        let record_batch =
            RecordBatch::try_new(schema, vec![id_array, name_array, active_array]).unwrap();
        let parquet_bytes = record_batch_to_parquet_bytes(record_batch).unwrap();

        assert!(!parquet_bytes.is_empty());

        let builder = ParquetRecordBatchReaderBuilder::try_new(parquet_bytes).unwrap();
        let reader = builder.build().unwrap();

        let batches: Result<Vec<_>, _> = reader.collect();
        let batches = batches.unwrap();
        assert_eq!(batches.len(), 1);

        let batch = &batches[0];
        assert_eq!(batch.num_columns(), 3);
        assert_eq!(batch.num_rows(), 3);
    }

    #[test]
    fn test_write_record_batch() {
        let schema = Arc::new(ArrowSchema::new(vec![ArrowField::new(
            "value",
            DataType::Float64,
            false,
        )]));
        let value_array = Arc::new(Float64Array::from(vec![1.1, 2.2, 3.3]));
        let record_batch = RecordBatch::try_new(schema, vec![value_array]).unwrap();
        let mut buffer = Vec::new();
        let arrow_writer = write_record_batch(record_batch, &mut buffer).unwrap();
        arrow_writer.close().unwrap();

        assert!(!buffer.is_empty());

        let bytes = Bytes::from(buffer);
        let builder = ParquetRecordBatchReaderBuilder::try_new(bytes).unwrap();
        let reader = builder.build().unwrap();

        let batches: Result<Vec<_>, _> = reader.collect();
        let batches = batches.unwrap();
        assert_eq!(batches.len(), 1);

        let batch = &batches[0];
        assert_eq!(batch.num_rows(), 3);

        let values = batch
            .column(0)
            .as_any()
            .downcast_ref::<Float64Array>()
            .unwrap();
        assert_eq!(values.value(0), 1.1);
        assert_eq!(values.value(1), 2.2);
        assert_eq!(values.value(2), 3.3);
    }

    #[test]
    fn test_bytes_to_rows() {
        let schema = Arc::new(ArrowSchema::new(vec![
            ArrowField::new("id", DataType::Int64, false),
            ArrowField::new("message", DataType::Utf8, true),
        ]));
        let id_array = Arc::new(Int64Array::from(vec![100, 200]));
        let message_array = Arc::new(StringArray::from(vec![Some("hello"), Some("world")]));
        let record_batch = RecordBatch::try_new(schema, vec![id_array, message_array]).unwrap();
        let parquet_bytes = record_batch_to_parquet_bytes(record_batch).unwrap();
        let rows = bytes_to_rows(parquet_bytes).unwrap();
        assert_eq!(rows.len(), 2);

        let first_row = &rows[0];
        assert_eq!(first_row.len(), 2);

        match first_row.get_long(0) {
            Ok(value) => assert_eq!(value, 100),
            Err(_) => panic!("Expected Long value at index 0"),
        }

        match first_row.get_string(1) {
            Ok(value) => assert_eq!(value, "hello"),
            Err(_) => panic!("Expected String value at index 1"),
        }
    }

    #[test]
    #[traced_test]
    fn test_file_to_rows() {
        let temp_dir = tempdir().unwrap();
        let file_path = temp_dir.path().join("test.parquet");
        let schema = Arc::new(ArrowSchema::new(vec![ArrowField::new(
            "test_col",
            DataType::Int32,
            false,
        )]));
        let test_array = Arc::new(Int32Array::from(vec![42, 84, 126]));
        let record_batch = RecordBatch::try_new(schema, vec![test_array]).unwrap();
        let file = File::create(&file_path).unwrap();
        let arrow_writer = write_record_batch(record_batch, file).unwrap();
        arrow_writer.close().unwrap();
        let rows = file_to_rows(file_path.to_str().unwrap()).unwrap();
        assert_eq!(rows.len(), 3);
        assert_eq!(rows[0].get_int(0).unwrap(), 42);
        assert_eq!(rows[1].get_int(0).unwrap(), 84);
        assert_eq!(rows[2].get_int(0).unwrap(), 126);
    }

    #[test]
    fn test_file_to_rows_nonexistent_file() {
        let result = file_to_rows("/nonexistent/path/file.parquet");
        assert!(result.is_err());
    }

    #[test]
    #[traced_test]
    fn test_compare_parquet_file_with_bytes() {
        let temp_dir = tempdir().unwrap();
        let file_path = temp_dir.path().join("compare_test.parquet");
        let schema = Arc::new(ArrowSchema::new(vec![ArrowField::new(
            "value",
            DataType::Utf8,
            true,
        )]));
        let value_array = Arc::new(StringArray::from(vec![Some("test1"), Some("test2")]));
        let record_batch = RecordBatch::try_new(schema, vec![value_array]).unwrap();
        let file = File::create(&file_path).unwrap();
        let arrow_writer = write_record_batch(record_batch.clone(), file).unwrap();
        arrow_writer.close().unwrap();
        let parquet_bytes = record_batch_to_parquet_bytes(record_batch).unwrap();

        let result = compare_parquet_file_with_bytes(file_path.to_str().unwrap(), parquet_bytes);
        assert!(result);

        let different_schema = Arc::new(ArrowSchema::new(vec![ArrowField::new(
            "value",
            DataType::Utf8,
            true,
        )]));
        let different_array = Arc::new(StringArray::from(vec![
            Some("different1"),
            Some("different2"),
        ]));
        let different_batch =
            RecordBatch::try_new(different_schema, vec![different_array]).unwrap();
        let different_bytes = record_batch_to_parquet_bytes(different_batch).unwrap();

        let result = compare_parquet_file_with_bytes(file_path.to_str().unwrap(), different_bytes);
        assert!(!result);
    }

    #[test]
    fn test_compare_parquet_file_with_bytes_nonexistent_file() {
        let schema = Arc::new(ArrowSchema::new(vec![ArrowField::new(
            "dummy",
            DataType::Int32,
            false,
        )]));
        let dummy_array = Arc::new(Int32Array::from(vec![1]));
        let record_batch = RecordBatch::try_new(schema, vec![dummy_array]).unwrap();
        let bytes = record_batch_to_parquet_bytes(record_batch).unwrap();
        let result = compare_parquet_file_with_bytes("/nonexistent/file.parquet", bytes);
        assert!(!result);
    }

    #[test]
    fn test_reader_to_vec_empty() {
        let schema = Arc::new(ArrowSchema::new(vec![ArrowField::new(
            "empty_col",
            DataType::Int32,
            true,
        )]));
        let empty_array = Arc::new(Int32Array::from(Vec::<Option<i32>>::new()));
        let record_batch = RecordBatch::try_new(schema, vec![empty_array]).unwrap();
        let parquet_bytes = record_batch_to_parquet_bytes(record_batch).unwrap();

        let rows = bytes_to_rows(parquet_bytes).unwrap();
        assert_eq!(rows.len(), 0);
    }

    #[test]
    fn test_various_data_types_conversion() {
        let schema = Arc::new(ArrowSchema::new(vec![
            ArrowField::new("int32_col", DataType::Int32, true),
            ArrowField::new("float64_col", DataType::Float64, true),
            ArrowField::new("string_col", DataType::Utf8, true),
            ArrowField::new("bool_col", DataType::Boolean, true),
            ArrowField::new("binary_col", DataType::Binary, true),
            ArrowField::new("date_col", DataType::Date32, true),
            ArrowField::new(
                "timestamp_col",
                DataType::Timestamp(TimeUnit::Millisecond, None),
                true,
            ),
        ]));

        let int32_array = Arc::new(Int32Array::from(vec![Some(42), None, Some(-123)]));
        let float64_array = Arc::new(Float64Array::from(vec![Some(3.12), Some(-2.71), None]));
        let string_array = Arc::new(StringArray::from(vec![Some("hello"), None, Some("world")]));
        let bool_array = Arc::new(BooleanArray::from(vec![Some(true), Some(false), None]));
        let binary_array = Arc::new(BinaryArray::from(vec![
            Some(b"binary1".as_slice()),
            None,
            Some(b"binary2".as_slice()),
        ]));
        let date_array = Arc::new(Date32Array::from(vec![Some(18628), None, Some(18629)])); // 2021-01-01, 2021-01-02
        let timestamp_array = Arc::new(TimestampMillisecondArray::from(vec![
            Some(1609459200000), // 2021-01-01 00:00:00
            None,
            Some(1609545600000), // 2021-01-02 00:00:00
        ]));

        let record_batch = RecordBatch::try_new(
            schema,
            vec![
                int32_array,
                float64_array,
                string_array,
                bool_array,
                binary_array,
                date_array,
                timestamp_array,
            ],
        )
        .unwrap();

        let parquet_bytes = record_batch_to_parquet_bytes(record_batch).unwrap();
        let rows = bytes_to_rows(parquet_bytes).unwrap();
        assert_eq!(rows.len(), 3);

        let first_row = &rows[0];
        assert_eq!(first_row.get_int(0).unwrap(), 42);
        assert_eq!(first_row.get_double(1).unwrap(), 3.12);
        assert_eq!(first_row.get_string(2).unwrap(), "hello");
        assert!(first_row.get_bool(3).unwrap());

        let second_row = &rows[1];
        assert!(second_row.get_int(0).is_err());
        assert_eq!(second_row.get_double(1).unwrap(), -2.71);
        assert!(second_row.get_string(2).is_err());
        assert!(!second_row.get_bool(3).unwrap());
    }
}
