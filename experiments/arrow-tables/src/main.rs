mod arrow;
mod datafusion;

#[tokio::main]
async fn main() {
    println!("Arrow:");
    arrow::output();

    println!("\nDataFusion:");
    datafusion::output().await;
}
