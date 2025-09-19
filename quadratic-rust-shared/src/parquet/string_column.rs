//! Utilities for working with string column data for converting to parquet.
//!
//!

use arrow::array::ArrayRef;
use arrow::datatypes::{
    DataType, Field as ArrowField, Float32Type, Float64Type, Int8Type, Int16Type, Int32Type,
    Int64Type, Schema as ArrowSchema, TimeUnit, UInt8Type, UInt16Type, UInt32Type, UInt64Type,
};
use parquet::record::{Field, Row};
use std::collections::HashMap;

use crate::SharedError;
use crate::arrow::utils::{
    string_to_array_ref, string_to_binary_array_ref, string_to_boolean_array_ref,
    string_to_date32_array_ref, string_to_decimal128_array_ref, string_to_string_array_ref,
    string_to_timestamp_micros_array_ref, string_to_timestamp_millis_array_ref,
};
use crate::error::Result;
use crate::parquet::error::Parquet as ParquetError;
use crate::parquet::utils::field_to_data_type;

/// Structure to hold column data for writing to parquet.
///
/// Store all values as strings for now, with proper conversion later.
#[derive(Debug)]
pub struct StringColumn {
    pub(crate) values: Vec<Option<String>>,
}

impl StringColumn {
    pub fn new() -> Self {
        Self { values: Vec::new() }
    }

    pub fn add_value(&mut self, field: &Field) -> Result<()> {
        let value = match field {
            Field::Null => None,
            Field::Bool(b) => Some(b.to_string()),
            Field::Byte(b) => Some(b.to_string()),
            Field::Short(s) => Some(s.to_string()),
            Field::Int(i) => Some(i.to_string()),
            Field::Long(l) => Some(l.to_string()),
            Field::UByte(b) => Some(b.to_string()),
            Field::UShort(s) => Some(s.to_string()),
            Field::UInt(i) => Some(i.to_string()),
            Field::ULong(l) => Some(l.to_string()),
            Field::Float(f) => Some(f.to_string()),
            Field::Float16(f) => Some(f.to_string()),
            Field::Double(d) => Some(d.to_string()),
            Field::Str(s) => Some(s.clone()),
            Field::Bytes(b) => Some(format!("{:?}", b)), // Convert bytes to debug string
            Field::Date(d) => Some(d.to_string()),
            Field::TimestampMillis(t) => Some(t.to_string()),
            Field::TimestampMicros(t) => Some(t.to_string()),
            Field::Decimal(d) => Some(format!("{:?}", d)),
            Field::Group(_) => {
                return Err(Self::error("Nested groups not supported"));
            }
            Field::ListInternal(_) => {
                return Err(Self::error("Lists not supported"));
            }
            Field::MapInternal(_) => {
                return Err(Self::error("Maps not supported"));
            }
        };

        self.values.push(value);
        Ok(())
    }

    pub fn add_null_value(&mut self) {
        self.values.push(None);
    }

    /// Convert column data (Strings) to an Arrow array.
    ///
    /// Consumes the column data.
    pub fn to_array_ref(self, field: &ArrowField) -> Result<ArrayRef> {
        let array: ArrayRef = match field.data_type() {
            DataType::Null => string_to_string_array_ref(self.values)?, // Treat null as string for now
            DataType::Boolean => string_to_boolean_array_ref(self.values)?,
            DataType::Int8 => string_to_array_ref::<Int8Type>(self.values)?,
            DataType::Int16 => string_to_array_ref::<Int16Type>(self.values)?,
            DataType::Int32 => string_to_array_ref::<Int32Type>(self.values)?,
            DataType::Int64 => string_to_array_ref::<Int64Type>(self.values)?,
            DataType::UInt8 => string_to_array_ref::<UInt8Type>(self.values)?,
            DataType::UInt16 => string_to_array_ref::<UInt16Type>(self.values)?,
            DataType::UInt32 => string_to_array_ref::<UInt32Type>(self.values)?,
            DataType::UInt64 => string_to_array_ref::<UInt64Type>(self.values)?,
            DataType::Float32 => string_to_array_ref::<Float32Type>(self.values)?,
            DataType::Float64 => string_to_array_ref::<Float64Type>(self.values)?,
            DataType::Utf8 => string_to_string_array_ref(self.values)?,
            DataType::Binary => string_to_binary_array_ref(self.values)?,
            DataType::Date32 => string_to_date32_array_ref(self.values)?,
            DataType::Timestamp(TimeUnit::Millisecond, _) => {
                string_to_timestamp_millis_array_ref(self.values)?
            }
            DataType::Timestamp(TimeUnit::Microsecond, _) => {
                string_to_timestamp_micros_array_ref(self.values)?
            }
            DataType::Decimal128(precision, scale) => {
                string_to_decimal128_array_ref(self.values, *precision, *scale)?
            }
            _ => {
                return Err(Self::error(format!(
                    "Unsupported data type for field {}: {:?}",
                    field.name(),
                    field.data_type()
                )));
            }
        };

        Ok(array)
    }

    /// Convert column data to Arrow arrays.
    ///
    /// Takes ownership of the column data map, removing the data from the map.
    pub fn arrow_arrays(
        mut column_data: HashMap<String, StringColumn>,
        schema: &ArrowSchema,
    ) -> Result<Vec<ArrayRef>> {
        let mut arrays = Vec::new();

        for field in schema.fields() {
            let field_name = field.name();
            let column = column_data
                .remove(field_name)
                .ok_or_else(|| Self::error(format!("No data found for field: {}", field_name)))?;
            let array = column.to_array_ref(field)?;

            arrays.push(array);
        }

        Ok(arrays)
    }

    /// Build Arrow schema and collect column data using direct Field to DataType conversion
    /// This preserves the full range of Parquet data types without the ArrowFieldType intermediary
    pub fn build_arrow_schema_and_data(
        rows: &[Row],
    ) -> Result<(ArrowSchema, HashMap<String, StringColumn>)> {
        let mut field_types: HashMap<String, DataType> = HashMap::new();
        let mut column_data: HashMap<String, StringColumn> = HashMap::new();

        // detect all field names and types across all rows
        for row in rows {
            let fields = row.get_column_iter();

            for (i, (name, field)) in fields.enumerate() {
                let field_name = if !name.is_empty() {
                    name.clone()
                } else {
                    format!("field_{}", i)
                };

                let data_type = field_to_data_type(field)?;

                match field_types.get(&field_name) {
                    None => {
                        field_types.insert(field_name.clone(), data_type);
                    }
                    Some(existing_type) => {
                        // For direct conversion, we could implement type merging here if needed
                        // For now, just use the first type encountered
                        if existing_type != &data_type {
                            // If types don't match, default to string for compatibility
                            field_types.insert(field_name.clone(), DataType::Utf8);
                        }
                    }
                }
            }
        }

        for field_name in field_types.keys() {
            column_data.insert(field_name.clone(), StringColumn::new());
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
        let mut arrow_fields = Vec::new();
        for (field_name, data_type) in field_types {
            let arrow_field = ArrowField::new(&field_name, data_type, true);
            arrow_fields.push(arrow_field);
        }
        let schema = ArrowSchema::new(arrow_fields);

        Ok((schema, column_data))
    }

    fn error(e: impl ToString) -> SharedError {
        SharedError::Parquet(ParquetError::StringColumn(e.to_string()))
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use arrow::array::{
        Array, BinaryArray, BooleanArray, Date32Array, Decimal128Array, Float64Array, Int32Array,
        StringArray, TimestampMicrosecondArray, TimestampMillisecondArray, UInt64Array,
    };
    use arrow::datatypes::{DataType, Field as ArrowField, Schema as ArrowSchema, TimeUnit};
    use parquet::record::{Field, Row};
    use std::collections::HashMap;
    use std::sync::Arc;

    #[test]
    fn test_add_null_value() {
        let mut column = StringColumn::new();
        column.add_null_value();
        assert_eq!(column.values.len(), 1);
        assert_eq!(column.values[0], None);
    }

    #[test]
    fn test_add_value_supported_types() {
        let mut column = StringColumn::new();

        let test_cases = vec![
            (Field::Null, None),                                       // index 0
            (Field::Bool(true), Some("true".to_string())),             // index 1
            (Field::Bool(false), Some("false".to_string())),           // index 2
            (Field::Byte(42), Some("42".to_string())),                 // index 3
            (Field::Short(1234), Some("1234".to_string())),            // index 4
            (Field::Int(123456), Some("123456".to_string())),          // index 5
            (Field::Long(123456789), Some("123456789".to_string())),   // index 6
            (Field::UByte(255), Some("255".to_string())),              // index 7
            (Field::UShort(65535), Some("65535".to_string())),         // index 8
            (Field::UInt(4294967295), Some("4294967295".to_string())), // index 9
            (
                Field::ULong(18446744073709551615),
                Some("18446744073709551615".to_string()),
            ), // index 10
            (Field::Float(3.14), Some("3.14".to_string())),            // index 11
            (Field::Double(2.718281828), Some("2.718281828".to_string())), // index 12
            (Field::Str("hello".to_string()), Some("hello".to_string())), // index 13
            (Field::Date(18628), Some("18628".to_string())), // Days since epoch    // index 14
            (
                Field::TimestampMillis(1640995200000),
                Some("1640995200000".to_string()),
            ), // index 15
            (
                Field::TimestampMicros(1640995200000000),
                Some("1640995200000000".to_string()),
            ), // index 16
        ];

        for (field, _expected) in test_cases {
            let result = column.add_value(&field);
            assert!(result.is_ok(), "Failed to add value for field: {:?}", field);
        }

        assert_eq!(column.values.len(), 17);
        assert_eq!(column.values[0], None);
        assert_eq!(column.values[1], Some("true".to_string()));
        assert_eq!(column.values[13], Some("hello".to_string()));
    }

    #[test]
    fn test_to_array_ref_boolean() {
        let mut column = StringColumn::new();
        column.values = vec![Some("true".to_string()), Some("false".to_string()), None];

        let field = ArrowField::new("test", DataType::Boolean, true);
        let array = column.to_array_ref(&field).unwrap();
        let bool_array = array.as_any().downcast_ref::<BooleanArray>().unwrap();

        assert_eq!(bool_array.len(), 3);
        assert_eq!(bool_array.value(0), true);
        assert_eq!(bool_array.value(1), false);
        assert!(bool_array.is_null(2));
    }

    #[test]
    fn test_to_array_ref_integers() {
        let mut column = StringColumn::new();
        column.values = vec![Some("42".to_string()), Some("-123".to_string()), None];

        let field = ArrowField::new("test", DataType::Int32, true);
        let array = column.to_array_ref(&field).unwrap();
        let int_array = array.as_any().downcast_ref::<Int32Array>().unwrap();

        assert_eq!(int_array.len(), 3);
        assert_eq!(int_array.value(0), 42);
        assert_eq!(int_array.value(1), -123);
        assert!(int_array.is_null(2));

        let mut column = StringColumn::new();
        column.values = vec![Some("18446744073709551615".to_string()), None];

        let field = ArrowField::new("test", DataType::UInt64, true);
        let array = column.to_array_ref(&field).unwrap();
        let uint_array = array.as_any().downcast_ref::<UInt64Array>().unwrap();

        assert_eq!(uint_array.len(), 2);
        assert_eq!(uint_array.value(0), 18446744073709551615);
        assert!(uint_array.is_null(1));
    }

    #[test]
    fn test_to_array_ref_floats() {
        let mut column = StringColumn::new();
        column.values = vec![Some("3.14".to_string()), Some("-2.718".to_string()), None];

        let field = ArrowField::new("test", DataType::Float64, true);
        let array = column.to_array_ref(&field).unwrap();
        let float_array = array.as_any().downcast_ref::<Float64Array>().unwrap();

        assert_eq!(float_array.len(), 3);
        assert!((float_array.value(0) - 3.14).abs() < f64::EPSILON);
        assert!((float_array.value(1) - (-2.718)).abs() < f64::EPSILON);
        assert!(float_array.is_null(2));
    }

    #[test]
    fn test_to_array_ref_string() {
        let mut column = StringColumn::new();
        column.values = vec![Some("hello".to_string()), Some("world".to_string()), None];

        let field = ArrowField::new("test", DataType::Utf8, true);
        let array = column.to_array_ref(&field).unwrap();
        let string_array = array.as_any().downcast_ref::<StringArray>().unwrap();

        assert_eq!(string_array.len(), 3);
        assert_eq!(string_array.value(0), "hello");
        assert_eq!(string_array.value(1), "world");
        assert!(string_array.is_null(2));
    }

    #[test]
    fn test_to_array_ref_binary() {
        let mut column = StringColumn::new();
        column.values = vec![Some("hello".to_string()), None];

        let field = ArrowField::new("test", DataType::Binary, true);
        let array = column.to_array_ref(&field).unwrap();
        let binary_array = array.as_any().downcast_ref::<BinaryArray>().unwrap();

        assert_eq!(binary_array.len(), 2);
        assert_eq!(binary_array.value(0), b"hello");
        assert!(binary_array.is_null(1));
    }

    #[test]
    fn test_to_array_ref_date32() {
        let mut column = StringColumn::new();
        // Date32 expects days since epoch (1970-01-01), so use a number
        // Jan 1, 2021 is ~18628 days since epoch
        column.values = vec![Some("18628".to_string()), None];

        let field = ArrowField::new("test", DataType::Date32, true);
        let array = column.to_array_ref(&field).unwrap();
        let date_array = array.as_any().downcast_ref::<Date32Array>().unwrap();

        assert_eq!(date_array.len(), 2);
        assert!(date_array.is_null(1));
    }

    #[test]
    fn test_to_array_ref_timestamp() {
        // millisecond timestamp
        let mut column = StringColumn::new();
        column.values = vec![Some("1640995200000".to_string()), None];

        let field = ArrowField::new(
            "test",
            DataType::Timestamp(TimeUnit::Millisecond, None),
            true,
        );
        let array = column.to_array_ref(&field).unwrap();
        let ts_array = array
            .as_any()
            .downcast_ref::<TimestampMillisecondArray>()
            .unwrap();

        assert_eq!(ts_array.len(), 2);
        assert!(ts_array.is_null(1));

        // microsecond timestamp
        let mut column = StringColumn::new();
        column.values = vec![Some("1640995200000000".to_string()), None];

        let field = ArrowField::new(
            "test",
            DataType::Timestamp(TimeUnit::Microsecond, None),
            true,
        );
        let array = column.to_array_ref(&field).unwrap();
        let ts_array = array
            .as_any()
            .downcast_ref::<TimestampMicrosecondArray>()
            .unwrap();

        assert_eq!(ts_array.len(), 2);
        assert!(ts_array.is_null(1));
    }

    #[test]
    fn test_to_array_ref_decimal128() {
        let mut column = StringColumn::new();
        column.values = vec![Some("123.45".to_string()), None];

        let field = ArrowField::new("test", DataType::Decimal128(10, 2), true);
        let array = column.to_array_ref(&field).unwrap();
        let decimal_array = array.as_any().downcast_ref::<Decimal128Array>().unwrap();

        assert_eq!(decimal_array.len(), 2);
        assert!(decimal_array.is_null(1));
    }

    #[test]
    fn test_to_array_ref_unsupported_type() {
        let column = StringColumn::new();
        let field = ArrowField::new(
            "test",
            DataType::List(Arc::new(ArrowField::new("item", DataType::Int32, true))),
            true,
        );

        let result = column.to_array_ref(&field);
        assert!(result.is_err());
    }

    #[test]
    fn test_arrow_arrays_success() {
        let mut column_data = HashMap::new();

        let mut int_column = StringColumn::new();
        int_column.values = vec![Some("42".to_string()), Some("123".to_string())];
        column_data.insert("int_field".to_string(), int_column);

        let mut string_column = StringColumn::new();
        string_column.values = vec![Some("hello".to_string()), Some("world".to_string())];
        column_data.insert("string_field".to_string(), string_column);

        let schema = ArrowSchema::new(vec![
            ArrowField::new("int_field", DataType::Int32, true),
            ArrowField::new("string_field", DataType::Utf8, true),
        ]);

        let arrays = StringColumn::arrow_arrays(column_data, &schema).unwrap();
        assert_eq!(arrays.len(), 2);

        let int_array = arrays[0].as_any().downcast_ref::<Int32Array>().unwrap();
        assert_eq!(int_array.value(0), 42);
        assert_eq!(int_array.value(1), 123);

        let string_array = arrays[1].as_any().downcast_ref::<StringArray>().unwrap();
        assert_eq!(string_array.value(0), "hello");
        assert_eq!(string_array.value(1), "world");
    }

    #[test]
    fn test_arrow_arrays_missing_field() {
        let column_data = HashMap::new(); // Empty data

        let schema = ArrowSchema::new(vec![ArrowField::new(
            "missing_field",
            DataType::Int32,
            true,
        )]);

        let result = StringColumn::arrow_arrays(column_data, &schema);
        assert!(result.is_err());
    }

    #[test]
    fn test_build_arrow_schema_and_data_basic() {
        let row1 = Row::new(vec![
            ("name".to_string(), Field::Str("Alice".to_string())),
            ("age".to_string(), Field::Int(30)),
            ("active".to_string(), Field::Bool(true)),
        ]);
        let row2 = Row::new(vec![
            ("name".to_string(), Field::Str("Bob".to_string())),
            ("age".to_string(), Field::Int(25)),
            ("active".to_string(), Field::Bool(false)),
        ]);
        let rows = vec![row1, row2];
        let (schema, column_data) = StringColumn::build_arrow_schema_and_data(&rows).unwrap();

        assert_eq!(schema.fields().len(), 3);
        assert_eq!(column_data.len(), 3);

        assert!(column_data.contains_key("name"));
        assert!(column_data.contains_key("age"));
        assert!(column_data.contains_key("active"));

        let name_column = &column_data["name"];
        assert_eq!(name_column.values.len(), 2);
        assert_eq!(name_column.values[0], Some("Alice".to_string()));
        assert_eq!(name_column.values[1], Some("Bob".to_string()));

        let age_column = &column_data["age"];
        assert_eq!(age_column.values.len(), 2);
        assert_eq!(age_column.values[0], Some("30".to_string()));
        assert_eq!(age_column.values[1], Some("25".to_string()));
    }

    #[test]
    fn test_build_arrow_schema_and_data_missing_fields() {
        let row1 = Row::new(vec![
            ("name".to_string(), Field::Str("Alice".to_string())),
            ("age".to_string(), Field::Int(30)),
        ]);
        let row2 = Row::new(vec![
            ("name".to_string(), Field::Str("Bob".to_string())),
            ("city".to_string(), Field::Str("NYC".to_string())),
        ]);
        let rows = vec![row1, row2];
        let (schema, column_data) = StringColumn::build_arrow_schema_and_data(&rows).unwrap();

        assert_eq!(schema.fields().len(), 3); // name, age, city
        assert_eq!(column_data.len(), 3);

        // Check that missing values are filled with nulls
        let age_column = &column_data["age"];
        assert_eq!(age_column.values.len(), 2);
        assert_eq!(age_column.values[0], Some("30".to_string()));
        assert_eq!(age_column.values[1], None); // Missing in second row

        let city_column = &column_data["city"];
        assert_eq!(city_column.values.len(), 2);
        assert_eq!(city_column.values[0], None); // Missing in first row
        assert_eq!(city_column.values[1], Some("NYC".to_string()));
    }

    #[test]
    fn test_build_arrow_schema_and_data_type_conflicts() {
        let row1 = Row::new(vec![("mixed_field".to_string(), Field::Int(42))]);
        let row2 = Row::new(vec![(
            "mixed_field".to_string(),
            Field::Str("hello".to_string()),
        )]);
        let rows = vec![row1, row2];
        let (schema, column_data) = StringColumn::build_arrow_schema_and_data(&rows).unwrap();

        assert_eq!(schema.fields().len(), 1);

        // type conflict should resolve to Utf8 (string)
        let field = &schema.fields()[0];
        assert_eq!(field.data_type(), &DataType::Utf8);

        let mixed_column = &column_data["mixed_field"];
        assert_eq!(mixed_column.values.len(), 2);
        assert_eq!(mixed_column.values[0], Some("42".to_string()));
        assert_eq!(mixed_column.values[1], Some("hello".to_string()));
    }

    #[test]
    fn test_build_arrow_schema_and_data_unnamed_fields() {
        let row1 = Row::new(vec![
            ("".to_string(), Field::Int(42)),                  // Empty name
            ("".to_string(), Field::Str("hello".to_string())), // Empty name
        ]);
        let rows = vec![row1];
        let (schema, column_data) = StringColumn::build_arrow_schema_and_data(&rows).unwrap();

        assert_eq!(schema.fields().len(), 2);
        assert!(column_data.contains_key("field_0"));
        assert!(column_data.contains_key("field_1"));

        let field0_column = &column_data["field_0"];
        assert_eq!(field0_column.values[0], Some("42".to_string()));

        let field1_column = &column_data["field_1"];
        assert_eq!(field1_column.values[0], Some("hello".to_string()));
    }

    #[test]
    fn test_build_arrow_schema_and_data_empty_rows() {
        let rows: Vec<Row> = vec![];
        let (schema, column_data) = StringColumn::build_arrow_schema_and_data(&rows).unwrap();

        assert_eq!(schema.fields().len(), 0);
        assert_eq!(column_data.len(), 0);
    }
}
