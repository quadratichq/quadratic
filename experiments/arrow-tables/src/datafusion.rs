use arrow::{
    array::{ArrayRef, RecordBatch},
    util::pretty::{self},
};
use datafusion::prelude::*;

async fn create_table(ctx: &mut SessionContext) -> Vec<RecordBatch> {
    let batch = crate::arrow::create_table();
    ctx.register_batch("my_table", batch).unwrap();

    let df = ctx.table("my_table").await.unwrap();

    df.collect().await.unwrap()
}

async fn sort_column(ctx: &SessionContext, column: &str) -> Vec<RecordBatch> {
    let df = ctx
        .table("my_table")
        .await
        .unwrap()
        .sort(vec![col(column).sort(true, true)])
        .unwrap();

    df.collect().await.unwrap()
}

async fn filter_rows(ctx: &SessionContext) -> Vec<RecordBatch> {
    let df = ctx
        .table("my_table")
        .await
        .unwrap()
        .filter(col("col1").gt(lit(5)))
        .unwrap();

    df.collect().await.unwrap()
}

async fn get_cell(ctx: &SessionContext, row: usize, col: &str) -> ArrayRef {
    let df = ctx
        .table("my_table")
        .await
        .unwrap()
        .select_columns(&[col])
        .unwrap()
        .limit(row, Some(1))
        .unwrap();

    df.collect().await.unwrap()[0].column(0).to_owned()
}

pub async fn output() {
    let mut ctx = SessionContext::new();

    let df = create_table(&mut ctx).await;
    pretty::print_batches(&df).unwrap();

    println!("Sorted by col1:");
    let df = sort_column(&ctx, "col1").await;
    pretty::print_batches(&df).unwrap();

    println!("Filtered where col1 > 5:");
    let df = filter_rows(&ctx).await;
    pretty::print_batches(&df).unwrap();

    println!("Cell at (1, col2):");
    let value = get_cell(&ctx, 1, "col2").await;
    println!("{:?}", value);
}
