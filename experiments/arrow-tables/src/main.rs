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
}
