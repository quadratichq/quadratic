use ::arrow::util::pretty;
use union::{insert_value, new_union_array, union_to_record_batch, CellValue};

mod arrow;
mod datafusion;
mod sheet;
mod union;
// mod union_old;

#[tokio::main]
async fn main() {
    println!("Arrow:");
    arrow::output();

    println!("\nDataFusion:");
    datafusion::output().await;

    let table = new_union_array();
    let table = insert_value(table, CellValue::Int32(1));
    let table = insert_value(table, CellValue::String("first".into()));
    let table = insert_value(table, CellValue::Int32(2));
    let table = insert_value(table, CellValue::String("second".into()));

    // println!("{:?}", table);

    let record_batch = union_to_record_batch(&table);
    println!("{:?}", record_batch);
    pretty::print_batches(&[record_batch]).unwrap();
}
