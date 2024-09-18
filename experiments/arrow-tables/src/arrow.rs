use arrow::array::{Array, BooleanArray, Float64Array, Int32Array, StringArray};
use arrow::compute::filter;
use arrow::compute::{sort_to_indices, take, SortOptions};
use arrow::datatypes::DataType;
use arrow::record_batch::RecordBatch;
use arrow::util::pretty;
use std::sync::Arc;

// Function to create the table
pub fn create_table() -> RecordBatch {
    let col1 = Int32Array::from(vec![10, 9, 8, 7, 6, 5, 4, 3, 2, 1]);
    let col2 = Float64Array::from(vec![1.1, 2.2, 3.3, 4.4, 5.5, 6.6, 7.7, 8.8, 9.9, 10.1]);
    let col3 = StringArray::from(vec!["A", "B", "C", "D", "E", "F", "G", "H", "I", "J"]);
    let col4 = BooleanArray::from(vec![
        true, false, true, false, true, false, true, false, true, false,
    ]);

    let schema = arrow::datatypes::Schema::new(vec![
        arrow::datatypes::Field::new("col1", DataType::Int32, false),
        arrow::datatypes::Field::new("col2", DataType::Float64, false),
        arrow::datatypes::Field::new("col3", DataType::Utf8, false),
        arrow::datatypes::Field::new("col4", DataType::Boolean, false),
    ]);

    RecordBatch::try_new(
        Arc::new(schema),
        vec![
            Arc::new(col1),
            Arc::new(col2),
            Arc::new(col3),
            Arc::new(col4),
        ],
    )
    .unwrap()
}

fn sort_column(batch: &RecordBatch, col_idx: usize) -> RecordBatch {
    let array = batch.column(col_idx);

    // Sort the column
    let sort_options = SortOptions::default(); // Default is ascending order
    let sorted_indices = sort_to_indices(array, Some(sort_options), None).unwrap();

    // Reorder all columns based on sorted indices
    let sorted_columns: Vec<_> = batch
        .columns()
        .iter()
        .map(|col| take(col.as_ref(), &sorted_indices, None).unwrap())
        .collect();

    // Return a new RecordBatch with sorted columns
    RecordBatch::try_new(batch.schema(), sorted_columns).unwrap()
}

fn filter_rows(batch: &RecordBatch, col_idx: usize, threshold: i32) -> RecordBatch {
    let array = batch
        .column(col_idx)
        .as_any()
        .downcast_ref::<Int32Array>()
        .unwrap();

    // Create a boolean mask where values > threshold
    let mask = array
        .iter()
        .map(|x| x.map(|val| val > threshold).unwrap_or(false))
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

fn get_value_at(batch: &RecordBatch, row: usize, col: usize) -> Option<String> {
    // Get the column (array) at the specified index
    let array = batch.column(col);

    // Dynamically downcast to the correct type and get the value
    if let Some(int_array) = array.as_any().downcast_ref::<Int32Array>() {
        return int_array.value(row).to_string().into();
    } else if let Some(float_array) = array.as_any().downcast_ref::<Float64Array>() {
        return float_array.value(row).to_string().into();
    } else if let Some(string_array) = array.as_any().downcast_ref::<StringArray>() {
        return Some(string_array.value(row).to_string());
    } else if let Some(bool_array) = array.as_any().downcast_ref::<BooleanArray>() {
        return bool_array.value(row).to_string().into();
    }

    // If no matching type was found, return None
    None
}

fn update_cell(batch: &RecordBatch, row: usize, col: usize, new_value: i32) -> RecordBatch {
    let mut new_columns = batch.columns().to_vec();

    let col_data = batch
        .column(col)
        .as_any()
        .downcast_ref::<Int32Array>()
        .unwrap();
    let mut updated_values: Vec<i32> = col_data.values().to_vec();
    updated_values[row] = new_value;

    let updated_column = Arc::new(Int32Array::from(updated_values)) as Arc<dyn Array>;
    new_columns[col] = updated_column;

    RecordBatch::try_new(batch.schema(), new_columns).unwrap()
}

// fn insert_row(batch: &RecordBatch, new_row: (i32, f64, &str, bool)) -> RecordBatch {
//     let mut new_columns = batch.columns().to_vec();

//     // Append to the first column (Int32)
//     let col1 = batch
//         .column(0)
//         .as_any()
//         .downcast_ref::<Int32Array>()
//         .unwrap();
//     let mut col1_values: Vec<i32> = col1.values().to_vec();
//     col1_values.push(new_row.0);
//     let new_col1 = Arc::new(Int32Array::from(col1_values)) as Arc<dyn Array>;
//     new_columns[0] = new_col1;

//     // Append to the second column (Float64)
//     let col2 = batch
//         .column(1)
//         .as_any()
//         .downcast_ref::<Float64Array>()
//         .unwrap();
//     let mut col2_values: Vec<f64> = col2.values().to_vec();
//     col2_values.push(new_row.1);
//     let new_col2 = Arc::new(Float64Array::from(col2_values)) as Arc<dyn Array>;
//     new_columns[1] = new_col2;

//     // Append to the third column (StringArray)
//     let col3 = batch
//         .column(2)
//         .as_any()
//         .downcast_ref::<StringArray>()
//         .unwrap();
//     let mut col3_values: Vec<&str> = (0..col3.len()).map(|i| col3.value(i)).collect();
//     col3_values.push(new_row.2);
//     let new_col3 = Arc::new(StringArray::from(col3_values)) as Arc<dyn Array>;
//     new_columns[2] = new_col3;

//     // Append to the fourth column (BooleanArray)
//     let col4 = batch
//         .column(3)
//         .as_any()
//         .downcast_ref::<BooleanArray>()
//         .unwrap();
//     let mut col4_values: Vec<bool> = col4.values();
//     col4_values.push(new_row.3);
//     let new_col4 = Arc::new(BooleanArray::from(col4_values)) as Arc<dyn Array>;
//     new_columns[3] = new_col4;

//     // Return the new RecordBatch with the inserted row
//     RecordBatch::try_new(batch.schema(), new_columns).unwrap()
// }

pub fn output() {
    let batch = create_table();

    println!("Original Table:");
    pretty::print_batches(&[batch.clone()]).unwrap();

    let sorted_batch = sort_column(&batch, 0);
    println!("\nSorted Table:");
    pretty::print_batches(&[sorted_batch]).unwrap();

    let filtered_batch = filter_rows(&batch, 0, 5);
    println!("\nFiltered Table (col1 > 5):");
    pretty::print_batches(&[filtered_batch]).unwrap();

    let cell_value = get_value_at(&batch, 1, 2);
    println!("\nCell at (1,2): {:?}", cell_value);

    let updated_batch = update_cell(&batch, 1, 0, 99);
    println!("\nTable After Update (1,0) -> 99:");
    pretty::print_batches(&[updated_batch]).unwrap();

    // let inserted_batch = insert_row(&batch, (11, 11.11, "K", true));
    // println!("\nTable After Insert:");
    // pretty::print_batches(&[inserted_batch]).unwrap();
}
