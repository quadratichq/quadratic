use arrow::array::{
    make_array, Array, ArrayRef, ArrowPrimitiveType, BooleanArray, Int32Array, PrimitiveArray,
    RecordBatch, StringArray, UnionArray,
};
use arrow::buffer::ScalarBuffer;
use arrow::compute::filter;
use arrow::datatypes::{
    DataType, Field, Float32Type, Float64Type, Int16Type, Int32Type, Int64Type, Int8Type, Schema,
    UInt16Type, UInt32Type, UInt64Type, UInt8Type, UnionFields,
};
use std::sync::Arc;

pub enum CellValue {
    Int32(i32),
    String(String),
}

impl From<&CellValue> for DataType {
    fn from(value: &CellValue) -> Self {
        match value {
            CellValue::Int32(_) => DataType::Int32,
            CellValue::String(_) => DataType::Utf8,
        }
    }
}

impl CellValue {
    fn to_array(&self) -> ArrayRef {
        match self {
            CellValue::Int32(value) => Arc::new(Int32Array::from(vec![*value])),
            CellValue::String(value) => Arc::new(StringArray::from(vec![value.as_str()])),
        }
    }

    fn to_index(&self) -> i8 {
        match self {
            CellValue::Int32(_) => 0,
            CellValue::String(_) => 1,
        }
    }
}

pub fn new_union_array() -> UnionArray {
    let union_fields = UnionFields::empty();
    let type_ids = vec![].into_iter().collect::<ScalarBuffer<i8>>();
    let offsets = vec![].into_iter().collect::<ScalarBuffer<i32>>();
    UnionArray::try_new(union_fields, type_ids, Some(offsets), vec![]).unwrap()
}

pub fn get_native_child<T, U>(children: &Vec<ArrayRef>, index: usize) -> Vec<Option<U>>
where
    T: ArrowPrimitiveType<Native = U>,
    U: From<T::Native>,
{
    children[index]
        .as_any()
        .downcast_ref::<PrimitiveArray<T>>()
        .unwrap()
        .into_iter()
        .collect::<Vec<_>>()
}

pub fn get_string_array_child(children: &Vec<ArrayRef>, index: usize) -> Vec<Option<&str>> {
    children[index]
        .as_any()
        .downcast_ref::<StringArray>()
        .unwrap()
        .into_iter()
        .collect::<Vec<_>>()
}

pub fn append(table: UnionArray, value: CellValue) -> UnionArray {
    let index = value.to_index();
    let data_type = DataType::from(&value);

    let (mut union_fields, mut type_ids, mut offsets, mut children) = table.into_parts();

    let mut type_ids_vec = type_ids.iter().collect::<Vec<_>>();
    let mut offsets = offsets.unwrap();
    let mut offsets_vec = offsets.into_iter().collect::<Vec<_>>();
    let mut union_fields_vec = union_fields
        .iter()
        .map(|(i, f)| (i, f.to_owned()))
        .collect::<Vec<_>>();
    let has_union_field = union_fields_vec.iter().any(|(i, _)| i == &index);

    type_ids_vec.push(&index);
    type_ids = type_ids_vec
        .into_iter()
        .cloned()
        .collect::<ScalarBuffer<i8>>();

    // if the union field doesn't exist, create it then add the new child array
    if !has_union_field {
        let field = Field::new(data_type.to_string(), data_type.to_owned(), false);
        union_fields_vec.push((index, Arc::new(field)));
        union_fields = union_fields_vec.into_iter().collect::<UnionFields>();
        offsets_vec.push(&0);
        offsets = offsets_vec
            .into_iter()
            .cloned()
            .collect::<ScalarBuffer<i32>>();

        let child = value.to_array();
        children.push(child);
    }
    // append to the existing child array
    else {
        let child_index = children
            .iter()
            .position(|c| c.data_type() == &data_type)
            .unwrap();

        let offset = match value {
            CellValue::Int32(v) => {
                let mut child = get_native_child::<Int32Type, i32>(&children, child_index);
                child.push(Some(v));
                let offset = (child.len() - 1) as i32;
                children[child_index] = Arc::new(Int32Array::from(child)) as Arc<dyn Array>;
                offset
            }
            CellValue::String(v) => {
                let mut child = get_string_array_child(&children, child_index);
                child.push(Some(&v));
                let offset = (child.len() - 1) as i32;
                children[child_index] = Arc::new(StringArray::from(child)) as Arc<dyn Array>;
                offset
            }
        };

        offsets_vec.push(&offset);
        offsets = offsets_vec
            .into_iter()
            .cloned()
            .collect::<ScalarBuffer<i32>>();
    }

    UnionArray::try_new(union_fields, type_ids, Some(offsets), children).unwrap()
}

pub fn insert_at(table: UnionArray, value: CellValue, row: usize) -> UnionArray {
    let index = value.to_index();
    let data_type = DataType::from(&value);

    let (mut union_fields, mut type_ids, mut offsets, mut children) = table.into_parts();

    let mut type_ids_vec = type_ids.iter().collect::<Vec<_>>();
    let mut offsets = offsets.unwrap();
    let mut offsets_vec = offsets.into_iter().collect::<Vec<_>>();
    let mut union_fields_vec = union_fields
        .iter()
        .map(|(i, f)| (i, f.to_owned()))
        .collect::<Vec<_>>();
    let has_union_field = union_fields_vec.iter().any(|(i, _)| i == &index);

    // added
    let slice = &[index];
    type_ids_vec.splice(row..row, slice);

    // removed
    // type_ids_vec.push(&index);
    type_ids = type_ids_vec
        .into_iter()
        .cloned()
        .collect::<ScalarBuffer<i8>>();

    // if the union field doesn't exist, create it then add the new child array
    if !has_union_field {
        let field = Field::new(data_type.to_string(), data_type.to_owned(), false);
        union_fields_vec.push((index, Arc::new(field)));
        union_fields = union_fields_vec.into_iter().collect::<UnionFields>();
        offsets_vec.push(&0);
        offsets = offsets_vec
            .into_iter()
            .cloned()
            .collect::<ScalarBuffer<i32>>();

        let child = value.to_array();
        children.push(child);
    }
    // append to the existing child array
    else {
        let child_index = children
            .iter()
            .position(|c| c.data_type() == &data_type)
            .unwrap();

        let offset = match value {
            CellValue::Int32(v) => {
                let mut child = get_native_child::<Int32Type, i32>(&children, child_index);

                // added
                child.splice(row..row, [Some(v)]);

                // removed
                // child.push(Some(v));

                // let offset = (child.len() - 1) as i32;
                children[child_index] = Arc::new(Int32Array::from(child)) as Arc<dyn Array>;
                row as i32
            }
            CellValue::String(v) => {
                let mut child = get_string_array_child(&children, child_index);

                // added
                child.splice(row..row, [Some(v.as_str())]);

                // removed
                // child.push(Some(&v));

                // let offset = (child.len() - 1) as i32;
                children[child_index] = Arc::new(StringArray::from(child)) as Arc<dyn Array>;
                row as i32
            }
        };
        // added
        offsets_vec.splice(row..row, [&offset]);
        let offsets_vec_end = offsets_vec
            .iter()
            .enumerate()
            .skip(row + 1)
            .map(|(i, mut offset)| {
                let mut new_offset: i32 = **offset;

                if type_ids[i] == index {
                    new_offset = **offset + 1;
                }
                new_offset
            })
            .collect::<Vec<_>>();

        offsets_vec.splice(row + 1..offsets_vec.len(), &offsets_vec_end);

        // removed
        // offsets_vec.push(&offset);
        offsets = offsets_vec
            .into_iter()
            .cloned()
            .collect::<ScalarBuffer<i32>>();
    }

    UnionArray::try_new(union_fields, type_ids, Some(offsets), children).unwrap()
}

fn array_ref_to_string(array: &ArrayRef) -> String {
    match array.data_type() {
        DataType::Boolean => {
            let bool_array = array.as_any().downcast_ref::<BooleanArray>().unwrap();
            bool_array
                .iter()
                .map(|opt_bool| opt_bool.map_or("null".to_string(), |b| b.to_string()))
                .collect::<Vec<_>>()
                .join(", ")
        }
        DataType::Int8 => primitive_array_to_string::<Int8Type>(array),
        DataType::Int16 => primitive_array_to_string::<Int16Type>(array),
        DataType::Int32 => primitive_array_to_string::<Int32Type>(array),
        DataType::Int64 => primitive_array_to_string::<Int64Type>(array),
        DataType::UInt8 => primitive_array_to_string::<UInt8Type>(array),
        DataType::UInt16 => primitive_array_to_string::<UInt16Type>(array),
        DataType::UInt32 => primitive_array_to_string::<UInt32Type>(array),
        DataType::UInt64 => primitive_array_to_string::<UInt64Type>(array),
        DataType::Float32 => primitive_array_to_string::<Float32Type>(array),
        DataType::Float64 => primitive_array_to_string::<Float64Type>(array),
        DataType::Utf8 => {
            let string_array = array.as_any().downcast_ref::<StringArray>().unwrap();
            string_array
                .iter()
                .map(|opt_str| opt_str.map_or("null".to_string(), |s| format!("\"{}\"", s)))
                .collect::<Vec<_>>()
                .join(", ")
        }
        // Add more data types as needed
        _ => format!("Unsupported data type: {:?}", array.data_type()),
    }
}

fn primitive_array_to_string<T: ArrowPrimitiveType>(array: &ArrayRef) -> String
where
    T::Native: std::fmt::Display,
{
    let primitive_array = array.as_any().downcast_ref::<PrimitiveArray<T>>().unwrap();
    primitive_array
        .iter()
        .map(|opt_val| opt_val.map_or("null".to_string(), |v| v.to_string()))
        .collect::<Vec<_>>()
        .join(", ")
}

pub fn heterogeneous_union_to_record_batch(union_array: &UnionArray) -> RecordBatch {
    let table_len = union_array.len();
    let mut values = vec![];
    for i in 0..table_len {
        let value: String = array_ref_to_string(&union_array.value(i));
        values.push(value);
    }
    let column = StringArray::from(values);
    let schema = Schema::new(vec![Field::new("col1", DataType::Utf8, true)]);

    RecordBatch::try_new(Arc::new(schema), vec![Arc::new(column)]).unwrap()
}

pub fn homogeneous_union_to_record_batch(union_array: &UnionArray) -> RecordBatch {
    let (union_fields, _, _, columns) = union_array.clone().into_parts();

    let union_fields = union_fields
        .iter()
        .map(|(_, field)| field.to_owned())
        .collect::<Vec<_>>();
    let columns = columns.into_iter().collect::<Vec<_>>();
    let schema = Schema::new(union_fields);

    RecordBatch::try_new(Arc::new(schema), columns).unwrap()
}

fn filter_rows(batch: &RecordBatch, col_idx: usize, value: &str) -> RecordBatch {
    let array = batch
        .column(col_idx)
        .as_any()
        .downcast_ref::<StringArray>()
        .unwrap();

    // Create a boolean mask where values > threshold
    let mask = array
        .iter()
        .map(|x| x.map(|val| val.contains(value)).unwrap_or(false))
        .collect::<Vec<_>>();
    let mask = BooleanArray::from(mask);

    // Apply the mask to filter rows
    let filtered_columns: Vec<_> = batch
        .columns()
        .iter()
        .map(|col| filter(col.as_ref(), &mask).unwrap())
        .collect();

    // Return a new RecordBatch with filtered columns
    RecordBatch::try_new(batch.schema(), filtered_columns).unwrap()
}

#[cfg(test)]
mod tests {
    // use arrow::util::pretty;

    use super::*;
    use crate::arrow::sort_column;
    use arrow::util::pretty;

    #[test]
    fn union() {
        let table = new_union_array();

        let table = append(table, CellValue::Int32(1));
        let table = append(table, CellValue::String("first".into()));
        let table = append(table, CellValue::Int32(2));
        let table = append(table, CellValue::String("second".into()));
        let table = append(table, CellValue::String("third".into()));
        let table = insert_at(table, CellValue::String("inserted".into()), 1);
        // let table = insert_at(table, CellValue::String("inserted2".into()), 2);

        // println!("{:?}", table);

        // assert_eq!(table.len(), 5);
        // assert_eq!(
        //     *table.value(0),
        //     Arc::new(Int32Array::from(vec![1])) as Arc<dyn Array>
        // );
        // assert_eq!(
        //     *table.value(1),
        //     Arc::new(StringArray::from(vec!["first"])) as Arc<dyn Array>
        // );
        // assert_eq!(
        //     *table.value(2),
        //     Arc::new(Int32Array::from(vec![2])) as Arc<dyn Array>
        // );
        // assert_eq!(
        //     *table.value(3),
        //     Arc::new(StringArray::from(vec!["second"])) as Arc<dyn Array>
        // );
        // assert_eq!(
        //     *table.value(4),
        //     Arc::new(StringArray::from(vec!["third"])) as Arc<dyn Array>
        // );

        println!("{:?}", table);

        println!("Original");
        let record_batch = heterogeneous_union_to_record_batch(&table);
        pretty::print_batches(&[record_batch.clone()]).unwrap();

        println!("\nSorted");
        let sorted = sort_column(&record_batch.clone(), 0);
        pretty::print_batches(&[sorted]).unwrap();

        println!("\nFiltered where col1 contains 'r'");
        let sorted = filter_rows(&record_batch.clone(), 0, "r");
        pretty::print_batches(&[sorted]).unwrap();
    }
}
