use arrow::array::{Array, ArrayRef, Int32Array, RecordBatch, StringArray, UnionArray};
use arrow::buffer::ScalarBuffer;
use arrow::datatypes::{DataType, Field, Schema, UnionFields};
use std::collections::HashMap;
use std::sync::Arc;

fn new_union_array() -> UnionArray {
    let union_fields = UnionFields::empty();
    let type_ids = vec![].into_iter().collect::<ScalarBuffer<i8>>();
    UnionArray::try_new(union_fields, type_ids, None, vec![]).unwrap()
}

fn type_map() -> HashMap<DataType, i8> {
    let mut map = HashMap::new();
    map.insert(DataType::Int32, 0);
    map.insert(DataType::Utf8, 1);
    map
}

fn union_field(mut table: UnionArray, field: Field) -> ArrayRef {
    let (union_fields, type_ids, offsets, children) = table.into_parts();
    Arc::new(Int32Array::from(vec![1]))
}

fn add_union_field(table: UnionArray, data_type: DataType) -> UnionArray {
    let index = *type_map().get(&data_type).unwrap();
    let (mut union_fields, mut type_ids, offsets, mut children) = table.into_parts();

    let mut type_ids_vec = type_ids.iter().collect::<Vec<_>>();
    // let mut chidren_vec = children.iter().collect::<Vec<_>>();
    let mut union_fields_vec = union_fields
        .iter()
        .map(|(i, f)| (i, f.to_owned()))
        .collect::<Vec<_>>();

    if !union_fields_vec.iter().any(|(i, _)| i == &index) {
        let field = Field::new(data_type.to_string(), data_type.to_owned(), false);
        union_fields_vec.push((index, Arc::new(field)));
        union_fields = union_fields_vec.into_iter().collect::<UnionFields>();

        type_ids_vec.push(&index);
        type_ids = type_ids_vec
            .into_iter()
            .cloned()
            .collect::<ScalarBuffer<i8>>();

        let child = match data_type {
            DataType::Int32 => Arc::new(Int32Array::from(vec![1])) as Arc<dyn Array>,
            DataType::Utf8 => Arc::new(StringArray::from(vec!["first"])) as Arc<dyn Array>,
            _ => unreachable!(),
        };

        children.push(child);
    } else {
        let child_index = children
            .iter()
            .position(|c| c.data_type() == &data_type)
            .unwrap();

        match data_type {
            DataType::Int32 => {
                let mut child = children[child_index]
                    .as_any()
                    .downcast_ref::<Int32Array>()
                    .unwrap()
                    .into_iter()
                    .collect::<Vec<_>>();

                child.push(Some(2));
                children[child_index] = Arc::new(Int32Array::from(child)) as Arc<dyn Array>;
            }
            DataType::Utf8 => {
                let mut child = children[child_index]
                    .as_any()
                    .downcast_ref::<StringArray>()
                    .unwrap()
                    .into_iter()
                    .collect::<Vec<_>>();

                child.push(Some("Second"));
                children[child_index] = Arc::new(StringArray::from(child)) as Arc<dyn Array>;
            }
            _ => unreachable!(),
        };
    }

    UnionArray::try_new(union_fields, type_ids, None, children).unwrap()
}

fn union_to_record_batch(union_array: &UnionArray) -> RecordBatch {
    let (union_fields, _, _, columns) = union_array.clone().into_parts();
    let union_fields = union_fields
        .iter()
        .map(|(_, field)| field.to_owned())
        .collect::<Vec<_>>();
    let columns = columns.into_iter().collect::<Vec<_>>();
    let schema = Schema::new(union_fields);

    RecordBatch::try_new(Arc::new(schema), columns).unwrap()
}

#[cfg(test)]
mod tests {
    use arrow::util::pretty;

    use super::*;

    #[test]
    fn union() {
        let table = new_union_array();

        let table = add_union_field(table, DataType::Int32);
        let table = add_union_field(table, DataType::Utf8);
        let table = add_union_field(table, DataType::Int32);
        let table = add_union_field(table, DataType::Utf8);

        // println!("{:?}", table);

        let record_batch = union_to_record_batch(&table);
        println!("{:?}", record_batch);
        // pretty::print_batches(&[record_batch]).unwrap();
    }
}
