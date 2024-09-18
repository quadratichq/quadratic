use arrow::array::{
    Array, ArrayRef, BooleanArray, Float64Array, Int32Array, StringArray, UnionArray, UnionBuilder,
};
use arrow::buffer::ScalarBuffer;
use arrow::compute::filter;
use arrow::compute::{sort_to_indices, take, SortOptions};
use arrow::datatypes::{
    DataType, Field, Float64Type, GenericStringType, Int32Type, Int64Type, Schema, StringViewType,
    UnionFields, UnionMode, Utf8Type,
};
use arrow::record_batch::RecordBatch;
use arrow::util::pretty;
use std::sync::Arc;

// Function to create the table
pub fn create_table() {
    let mut builder = UnionBuilder::new_dense();
    builder.append::<Int32Type>("a", 1).unwrap();
    builder.append_null::<Int32Type>("a").unwrap();
    builder.append::<Float64Type>("c", 3.0).unwrap();
    builder.append_null::<Float64Type>("c").unwrap();
    builder.append::<Int32Type>("a", 4).unwrap();
    let union = builder.build().unwrap();

    let schema = Schema::new(vec![Field::new(
        "struct_array_1",
        union.data_type().clone(),
        true,
    )]);
    println!("union.data_type().clone() {:?}", union.data_type().clone());

    let record_batch = RecordBatch::try_new(
        Arc::new(schema),
        vec![Arc::new(union.clone()), Arc::new(union)],
    )
    .unwrap();

    let record_batch_slice = record_batch.slice(1, 3);
    println!("{:?}", record_batch_slice);
    pretty::print_batches(&[record_batch]).unwrap();
}

fn create_2d_union_array() -> UnionArray {
    let inner_union1 = create_inner_union_array(vec![1, 2], vec!["three", "four"]);
    let inner_union2 = create_inner_union_array(vec![5], vec!["six", "seven", "eight"]);
    let inner_union3 = create_inner_union_array(vec![9, 10, 11], vec!["twelve"]);

    let type_ids = vec![0, 0].into_iter().collect::<ScalarBuffer<i8>>();
    // let offsets = Int32Array::from(vec![0, 1, 2]);
    let child_arrays: Vec<ArrayRef> = vec![Arc::new(inner_union1), Arc::new(inner_union2)];
    let union_fields_inner = [
        (0, Arc::new(Field::new("int", DataType::Int32, false))),
        (1, Arc::new(Field::new("string", DataType::Utf8, false))),
    ]
    .into_iter()
    .collect::<UnionFields>();

    let union_fields = [
        (
            0,
            Arc::new(Field::new(
                "inner_union",
                DataType::Union(union_fields_inner.clone(), UnionMode::Dense),
                false,
            )),
        ),
        (
            1,
            Arc::new(Field::new(
                "inner_union",
                DataType::Union(union_fields_inner, UnionMode::Dense),
                false,
            )),
        ),
    ]
    .into_iter()
    .collect::<UnionFields>();

    UnionArray::try_new(union_fields, type_ids, None, child_arrays).unwrap()
}

fn create_inner_union_array(int_data: Vec<i32>, str_data: Vec<&str>) -> UnionArray {
    let int_array = Int32Array::from(int_data);
    let str_array = StringArray::from(str_data);

    let mut type_ids = Vec::new();
    let mut offsets = Vec::new();

    for i in 0..int_array.len() {
        type_ids.push(0);
        offsets.push(i as i32);
    }

    // let str_offset = int_array.len() as i32;
    for i in 0..str_array.len() {
        type_ids.push(1);
        offsets.push(i as i32);
    }

    let type_ids = type_ids.into_iter().collect::<ScalarBuffer<i8>>();
    // let offsets = Int32Array::from(offsets);

    let child_data: Vec<ArrayRef> = vec![Arc::new(int_array), Arc::new(str_array)];
    let union_fields = [
        (0, Arc::new(Field::new("int", DataType::Int32, false))),
        (1, Arc::new(Field::new("string", DataType::Utf8, false))),
    ]
    .into_iter()
    .collect::<UnionFields>();

    // let data_type = DataType::Union(union_fields, UnionMode::Dense);

    UnionArray::try_new(union_fields, type_ids, None, child_data).unwrap()
}

pub fn add_col() {
    let mut builder = UnionBuilder::new_sparse();
    builder.append::<Int32Type>("a", 1).unwrap();
    builder.append_null::<Int32Type>("a").unwrap();
    builder.append::<Float64Type>("c", 3.0).unwrap();
    builder.append_null::<Float64Type>("c").unwrap();
    builder.append::<Int32Type>("a", 4).unwrap();
    let union = builder.build().unwrap();

    let schema = Schema::new(vec![Field::new(
        "struct_array",
        union.data_type().clone(),
        true,
    )]);

    let record_batch = RecordBatch::try_new(Arc::new(schema), vec![Arc::new(union)]).unwrap();

    let record_batch_slice = record_batch.slice(1, 3);
    println!("{:?}", record_batch_slice);
}

fn union_to_record_batch(union_array: &UnionArray) -> RecordBatch {
    let schema = Schema::new(vec![Field::new(
        "2d_union",
        union_array.data_type().clone(),
        false,
    )]);

    RecordBatch::try_new(Arc::new(schema), vec![Arc::new(union_array.clone())]).unwrap()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn union() {
        // let table = create_table();
        let outer_union = create_2d_union_array();
        let record_batch = union_to_record_batch(&outer_union);

        println!("{:?}", outer_union);

        // pretty::print_columns("col_name", &[outer_union.child(0).to_owned()]).unwrap();

        // println!("{:?}", outer_union);
        // println!("{:?}", record_batch);
        // pretty::print_batches(&[record_batch]).unwrap();
    }
}
