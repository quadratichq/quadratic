use futures_util::Future;

pub mod postgres_connection;

pub trait Connection {
    type Pool;
    type Row;
    type Column;

    fn connect(&self) -> impl Future<Output = Result<Self::Pool, sqlx::Error>>;
    fn connection_string(&self) -> String;
    fn query(
        &self,
        pool: Self::Pool,
        sql: &str,
    ) -> impl Future<Output = Result<Vec<Self::Row>, sqlx::Error>>;
    fn to_arrow(row: &Self::Row, column: &Self::Column, index: usize) -> Option<String>;
    fn to_parquet(data: Vec<Self::Row>);
}
