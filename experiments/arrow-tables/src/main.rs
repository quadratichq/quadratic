mod arrow;
mod datafusion;
mod union;

#[tokio::main]
async fn main() {
    println!("Arrow:");
    arrow::output();

    println!("\nDataFusion:");
    datafusion::output().await;
}
