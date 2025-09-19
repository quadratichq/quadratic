//! Column data for writing to parquet.
//!
//!

use arrow::array::ArrayRef;
use arrow::datatypes::{
    DataType, Field as ArrowField, Float32Type, Float64Type, Int32Type, Int64Type,
    Schema as ArrowSchema,
};
use parquet::record::Field;
use std::collections::HashMap;

use crate::SharedError;
use crate::arrow::utils::{
    string_to_array_ref, string_to_boolean_array_ref, string_to_string_array_ref,
};
use crate::error::Result;
use crate::parquet::error::Parquet as ParquetError;

/// Structure to hold column data for writing to parquet.
///
/// Store all values as strings for now, with proper conversion later.
#[derive(Debug)]
pub struct ColumnData {
    pub(crate) values: Vec<Option<String>>,
}

impl ColumnData {
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
            DataType::Boolean => string_to_boolean_array_ref(self.values)?,
            DataType::Int32 => string_to_array_ref::<Int32Type>(self.values)?,
            DataType::Int64 => string_to_array_ref::<Int64Type>(self.values)?,
            DataType::Float32 => string_to_array_ref::<Float32Type>(self.values)?,
            DataType::Float64 => string_to_array_ref::<Float64Type>(self.values)?,
            DataType::Utf8 => string_to_string_array_ref(self.values)?,
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
        mut column_data: HashMap<String, ColumnData>,
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

    fn error(e: impl ToString) -> SharedError {
        SharedError::Parquet(ParquetError::ColumnData(e.to_string()))
    }
}
