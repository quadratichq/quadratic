use ::arrow::util::pretty;
use union::{append, new_union_array, CellValue};

mod arrow;
mod datafusion;
mod union;
// mod union_old;

#[tokio::main]
async fn main() {
    println!("Arrow:");
    arrow::output();

    println!("\nDataFusion:");
    datafusion::output().await;

    let table = new_union_array();
    let table = append(table, CellValue::Int32(1));
    let table = append(table, CellValue::String("first".into()));
    let table = append(table, CellValue::Int32(2));
    let table = append(table, CellValue::String("second".into()));

    // println!("{:?}", table);
}
