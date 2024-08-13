use self::{
    // mssql_connection::MsSqlConnection,
    mysql_connection::MySqlConnection,
    postgres_connection::PostgresConnection,
};

// pub mod mssql_connection;
pub mod mysql_connection;
pub mod postgres_connection;

pub enum SqlConnection {
    Postgres(PostgresConnection),
    Mysql(MySqlConnection),
    // Mssql(MsSqlConnection),
}
