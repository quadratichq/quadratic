//! Microsoft SQL Server
//!
//! Functions to interact with Microsoft SQL Server

use std::collections::BTreeMap;
use std::str::FromStr;

use arrow::datatypes::Date32Type;
use async_trait::async_trait;
use bytes::Bytes;
use chrono::{DateTime, Local, NaiveDate, NaiveDateTime, NaiveTime, Utc};
use futures_util::{StreamExt, TryStreamExt};
use rust_decimal::Decimal;
use serde::{Deserialize, Serialize};
use tiberius::ColumnData;
use tiberius::xml::XmlData;
use tiberius::{AuthMethod, Client, Column, Config, FromSql, FromSqlOwned, Row};
use tokio::net::TcpStream;
use tokio_util::compat::{Compat, TokioAsyncWriteCompatExt};
use uuid::Uuid;

use crate::arrow::arrow_type::ArrowType;
use crate::error::{Result, SharedError};
use crate::net::ssh::SshConfig;
use crate::quadratic_api::Connection as ApiConnection;
use crate::sql::Connection;
use crate::sql::error::Sql as SqlError;
use crate::sql::schema::{DatabaseSchema, SchemaColumn, SchemaTable};

use super::UsesSsh;

/// Microsoft SQL Server connection
#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct MsSqlConnection {
    pub username: Option<String>,
    pub password: Option<String>,
    pub host: String,
    pub port: Option<String>,
    pub database: String,
    pub use_ssh: Option<bool>,
    pub ssh_host: Option<String>,
    pub ssh_port: Option<String>,
    pub ssh_username: Option<String>,
    pub ssh_key: Option<String>,
}

impl From<&ApiConnection<MsSqlConnection>> for MsSqlConnection {
    fn from(connection: &ApiConnection<MsSqlConnection>) -> Self {
        let details = connection.type_details.to_owned();
        MsSqlConnection::new(
            details.username,
            details.password,
            details.host,
            details.port,
            details.database,
            details.use_ssh,
            details.ssh_host,
            details.ssh_port,
            details.ssh_username,
            details.ssh_key,
        )
    }
}

impl TryFrom<MsSqlConnection> for SshConfig {
    type Error = SharedError;

    fn try_from(connection: MsSqlConnection) -> Result<Self> {
        let required = |value: Option<String>| {
            value.ok_or(SharedError::Sql(SqlError::Connect(
                "Required field is missing".into(),
            )))
        };

        let ssh_port = <MsSqlConnection as UsesSsh>::parse_port(&connection.ssh_port).ok_or(
            SharedError::Sql(SqlError::Connect("SSH port is required".into())),
        )??;

        Ok(SshConfig::new(
            required(connection.ssh_host)?,
            ssh_port,
            required(connection.ssh_username)?,
            connection.password,
            required(connection.ssh_key)?,
            None,
        ))
    }
}

impl MsSqlConnection {
    /// Create a new Microsoft SQL Server connection
    #[allow(clippy::too_many_arguments)]
    pub fn new(
        username: Option<String>,
        password: Option<String>,
        host: String,
        port: Option<String>,
        database: String,
        use_ssh: Option<bool>,
        ssh_host: Option<String>,
        ssh_port: Option<String>,
        ssh_username: Option<String>,
        ssh_key: Option<String>,
    ) -> MsSqlConnection {
        MsSqlConnection {
            username,
            password,
            host,
            port,
            database,
            use_ssh,
            ssh_host,
            ssh_port,
            ssh_username,
            ssh_key,
        }
    }

    /// Query all rows from a SQL Server
    async fn query_all(client: &mut Client<Compat<TcpStream>>, sql: &str) -> Result<Vec<Row>> {
        let mut rows = vec![];
        let mut row_stream = client
            .query(sql, &[])
            .await
            .map_err(|e| SharedError::Sql(SqlError::Query(e.to_string())))?
            .into_row_stream();

        while let Some(row_result) = row_stream.next().await {
            match row_result {
                Ok(row) => rows.push(row),
                Err(e) => return Err(SharedError::Sql(SqlError::Query(e.to_string()))),
            }
        }

        Ok(rows)
    }
}

#[async_trait]
impl<'a> Connection<'a> for MsSqlConnection {
    type Conn = Client<Compat<TcpStream>>;
    type Row = Row;
    type Column = Column;

    /// Get the length of a row
    fn row_len(row: &Self::Row) -> usize {
        row.len()
    }

    /// Get the columns of a row
    fn row_columns(row: &Self::Row) -> Box<dyn Iterator<Item = &Self::Column> + '_> {
        Box::new(row.columns().iter())
    }

    /// Get the name of a column
    fn column_name(&self, col: &Self::Column, _index: usize) -> String {
        col.name().to_string()
    }

    /// Connect to a SQL Server
    async fn connect(&self) -> Result<Client<Compat<TcpStream>>> {
        let mut config = Config::new();
        config.host(&self.host);
        config.database(&self.database);

        if let Some(port) = self.port() {
            config.port(port?);
        }

        if let Some(username) = &self.username {
            config.authentication(AuthMethod::sql_server(
                username,
                self.password.as_deref().ok_or_else(|| {
                    SharedError::Sql(SqlError::Connect("Password is required".into()))
                })?,
            ));
        }

        config.trust_cert();

        let tcp = TcpStream::connect(config.get_addr())
            .await
            .map_err(|e| SharedError::Sql(SqlError::Connect(format!("Failed to connect: {e}"))))?;
        tcp.set_nodelay(true).map_err(|e| {
            SharedError::Sql(SqlError::Connect(format!("Failed to set nodelay: {e}")))
        })?;

        let client = Client::connect(config, tcp.compat_write())
            .await
            .map_err(|e| {
                SharedError::Sql(SqlError::Connect(format!("Failed to create client: {e}")))
            })?;

        Ok(client)
    }

    /// Query rows from a SQL Server
    async fn query(
        &mut self,
        client: &mut Self::Conn,
        sql: &str,
        max_bytes: Option<u64>,
    ) -> Result<(Bytes, bool, usize)> {
        let mut rows = vec![];
        let mut over_the_limit = false;

        if let Some(max_bytes) = max_bytes {
            let mut bytes = 0;

            let mut row_stream = client
                .query(sql, &[])
                .await
                .map_err(|e| SharedError::Sql(SqlError::Query(e.to_string())))?
                .into_row_stream();

            while let Some(row_result) = row_stream.next().await {
                match row_result {
                    Ok(row) => {
                        bytes += row.len() as u64;

                        if bytes > max_bytes {
                            over_the_limit = true;
                            break;
                        }

                        rows.push(row);
                    }
                    Err(e) => return Err(SharedError::Sql(SqlError::Query(e.to_string()))),
                }
            }
        } else {
            rows = Self::query_all(client, sql).await?;
        }

        let (bytes, num_records) = self.to_parquet(rows)?;

        Ok((bytes, over_the_limit, num_records))
    }

    /// Get the schema of a SQL Server
    async fn schema(&self, client: &mut Self::Conn) -> Result<DatabaseSchema> {
        let database = self.database.to_owned();
        let sql = format!(
            "
SELECT
    DB_NAME() AS 'database',
    s.name AS 'schema',
    t.name AS 'table',
    c.name AS 'column_name',
    TYPE_NAME(c.user_type_id) AS 'column_type',
    CASE WHEN c.is_nullable = 1 THEN 'YES' ELSE 'NO' END AS 'is_nullable'
FROM
    {database}.sys.columns c
INNER JOIN
    {database}.sys.tables t ON c.object_id = t.object_id
INNER JOIN
    {database}.sys.schemas s ON t.schema_id = s.schema_id
ORDER BY
    t.name, c.column_id, c.name"
        );

        let row_stream = client
            .query(sql, &[])
            .await
            .map_err(|e| SharedError::Sql(SqlError::Schema(e.to_string())))?
            .into_row_stream();

        let rows: Vec<Row> = row_stream
            .try_collect()
            .await
            .map_err(|e| SharedError::Sql(SqlError::Schema(e.to_string())))?;

        let mut schema = DatabaseSchema {
            database: self.database.to_owned(),
            tables: BTreeMap::new(),
        };

        for (index, row) in rows.into_iter().enumerate() {
            let safe_get = |data: Option<&str>, kind: &str| {
                data.map(|s| s.to_string())
                    .unwrap_or(format!("Unknown {kind} - {index}"))
            };
            let table_name = safe_get(row.get(2), "Table");

            schema
                .tables
                .entry(table_name.to_owned())
                .or_insert_with(|| SchemaTable {
                    name: table_name,
                    schema: safe_get(row.get(1), "Schema"),
                    columns: vec![],
                })
                .columns
                .push(SchemaColumn {
                    name: safe_get(row.get(3), "Column"),
                    r#type: safe_get(row.get(4), "Type"),
                    is_nullable: row.get(5).map_or("NO", |v| v).to_uppercase() == "YES",
                });
        }

        Ok(schema)
    }

    /// Convert a row to an Arrow type
    fn to_arrow(&self, row: &tiberius::Row, _: &tiberius::Column, index: usize) -> ArrowType {
        if let Some((_, column_data)) = row.cells().nth(index) {
            match column_data {
                ColumnData::Bit(_) => {
                    convert_mssql_type::<bool, _>(column_data, ArrowType::Boolean)
                }
                ColumnData::U8(_) => convert_mssql_type::<u8, _>(column_data, ArrowType::UInt8),
                ColumnData::I16(_) => convert_mssql_type::<i16, _>(column_data, ArrowType::Int16),
                ColumnData::I32(_) => convert_mssql_type::<i32, _>(column_data, ArrowType::Int32),
                ColumnData::I64(_) => convert_mssql_type::<i64, _>(column_data, ArrowType::Int64),
                ColumnData::F32(_) => convert_mssql_type::<f32, _>(column_data, ArrowType::Float32),
                ColumnData::F64(_) => convert_mssql_type::<f64, _>(column_data, ArrowType::Float64),
                ColumnData::Numeric(_) => {
                    convert_mssql_type::<Decimal, _>(column_data, |decimal| {
                        ArrowType::Decimal(
                            Decimal::from_str(&decimal.to_string()).unwrap_or_default(),
                        )
                    })
                }
                ColumnData::Guid(_) => convert_mssql_type::<Uuid, _>(column_data, ArrowType::Uuid),
                ColumnData::String(_) => {
                    convert_mssql_type_owned::<String, _>(column_data.to_owned(), ArrowType::Utf8)
                }
                ColumnData::Binary(_) => {
                    convert_mssql_type_owned::<Vec<u8>, _>(column_data.to_owned(), |bytes| {
                        ArrowType::Utf8(String::from_utf8(bytes).unwrap_or_default())
                    })
                }
                ColumnData::Date(_) => {
                    convert_mssql_type::<NaiveDate, _>(column_data, |naive_date| {
                        ArrowType::Date32(Date32Type::from_naive_date(naive_date))
                    })
                }
                ColumnData::Time(_) => {
                    convert_mssql_type::<NaiveTime, _>(column_data, ArrowType::Time32)
                }
                ColumnData::SmallDateTime(_)
                | ColumnData::DateTime(_)
                | ColumnData::DateTime2(_) => {
                    convert_mssql_type::<NaiveDateTime, _>(column_data, ArrowType::Timestamp)
                }
                ColumnData::DateTimeOffset(_) => {
                    convert_mssql_type::<DateTime<Utc>, _>(column_data, |date_time| {
                        ArrowType::TimestampTz(date_time.with_timezone(&Local))
                    })
                }
                ColumnData::Xml(_) => {
                    convert_mssql_type_owned::<XmlData, _>(column_data.to_owned(), |xml_data| {
                        ArrowType::Utf8(xml_data.to_string())
                    })
                }
            }
        } else {
            ArrowType::Unsupported
        }
    }
}

/// Convert a column data to an Arrow type using a function to map the data to an Arrow type
fn convert_mssql_type<'a, T, F>(
    column_data: &'a ColumnData<'static>,
    map_to_arrow_type: F,
) -> ArrowType
where
    T: Sized + 'a + FromSql<'a>,
    F: Fn(T) -> ArrowType,
{
    T::from_sql(column_data)
        .ok()
        .flatten()
        .map(map_to_arrow_type)
        .unwrap_or(ArrowType::Void)
}

/// Convert a column data to an Arrow type using a function to map the data to an Arrow type
fn convert_mssql_type_owned<T, F>(
    column_data: ColumnData<'static>,
    map_to_arrow_type: F,
) -> ArrowType
where
    T: FromSqlOwned,
    F: Fn(T) -> ArrowType,
{
    T::from_sql_owned(column_data)
        .ok()
        .flatten()
        .map(map_to_arrow_type)
        .unwrap_or(ArrowType::Void)
}

impl UsesSsh for MsSqlConnection {
    fn use_ssh(&self) -> bool {
        self.use_ssh.unwrap_or(false)
    }

    fn port(&self) -> Option<Result<u16>> {
        Self::parse_port(&self.port)
    }

    fn set_port(&mut self, port: u16) {
        self.port = Some(port.to_string());
    }

    fn host(&self) -> String {
        self.host.clone()
    }

    fn set_host(&mut self, host: String) {
        self.host = host;
    }

    fn ssh_host(&self) -> Option<String> {
        self.ssh_host.to_owned()
    }

    fn set_ssh_key(&mut self, ssh_key: Option<String>) {
        self.ssh_key = ssh_key;
    }
}

#[cfg(test)]
mod tests {

    use std::str::FromStr;

    use super::*;
    // use std::io::Read;

    fn new_mssql_connection() -> MsSqlConnection {
        MsSqlConnection::new(
            Some("sa".into()),
            Some("yourStrong(!)Password".into()),
            "0.0.0.0".into(),
            Some("1433".into()),
            "AllTypes".into(),
            None,
            None,
            None,
            None,
            None,
        )
    }

    async fn setup() -> (MsSqlConnection, Result<Client<Compat<TcpStream>>>) {
        let connection = new_mssql_connection();
        let client = connection.connect().await;

        (connection, client)
    }

    #[tokio::test]
    async fn test_mssql_connection() {
        let (_, client) = setup().await;

        assert!(client.is_ok());
    }

    #[tokio::test]
    async fn test_mssql_query_to_arrow() {
        let (connection, client) = setup().await;
        let sql = "SELECT TOP 1 * FROM [dbo].[all_native_data_types] ORDER BY id";
        let rows = MsSqlConnection::query_all(&mut client.unwrap(), sql)
            .await
            .unwrap();

        // for row in &rows {
        //     for (index, col) in row.columns().iter().enumerate() {
        //         let value = MsSqlConnection::to_arrow(row, col, index);
        //         println!("assert_eq!(to_arrow({}), ArrowType::{:?});", index, value);
        //     }
        // }

        let row = &rows[0];
        let columns = row.columns();
        let to_arrow = |index: usize| connection.to_arrow(row, &columns[index], index);

        assert_eq!(to_arrow(0), ArrowType::Int32(1));
        assert_eq!(to_arrow(1), ArrowType::UInt8(255));
        assert_eq!(to_arrow(2), ArrowType::Int16(32767));
        assert_eq!(to_arrow(3), ArrowType::Int32(2147483647));
        assert_eq!(to_arrow(4), ArrowType::Int64(9223372036854775807));
        assert_eq!(to_arrow(5), ArrowType::Boolean(true));
        assert_eq!(
            to_arrow(6),
            ArrowType::Decimal(Decimal::from_str("12345.67").unwrap())
        );
        assert_eq!(
            to_arrow(7),
            ArrowType::Decimal(Decimal::from_str("12345.67").unwrap())
        );
        assert_eq!(to_arrow(8), ArrowType::Float64(922337203685477.6));
        assert_eq!(to_arrow(9), ArrowType::Float64(214748.3647));
        assert_eq!(to_arrow(10), ArrowType::Float64(123456789.123456));
        assert_eq!(to_arrow(11), ArrowType::Float32(123456.79));
        assert_eq!(to_arrow(12), ArrowType::Date32(19871));
        assert_eq!(
            to_arrow(13),
            ArrowType::Time32(NaiveTime::from_str("12:34:56.123456700").unwrap())
        );
        assert_eq!(
            to_arrow(14),
            ArrowType::Timestamp(NaiveDateTime::from_str("2024-05-28T12:34:56.123456700").unwrap())
        );
        assert_eq!(
            to_arrow(15),
            ArrowType::TimestampTz(
                DateTime::<Local>::from_str("2024-05-28T16:04:56.123456700+05:30").unwrap()
            )
        );
        assert_eq!(
            to_arrow(16),
            ArrowType::Timestamp(NaiveDateTime::from_str("2024-05-28T12:34:56").unwrap())
        );
        assert_eq!(
            to_arrow(17),
            ArrowType::Timestamp(NaiveDateTime::from_str("2024-05-28T12:34:00").unwrap())
        );
        assert_eq!(to_arrow(18), ArrowType::Utf8("CHAR      ".to_string()));
        assert_eq!(to_arrow(19), ArrowType::Utf8("VARCHAR".to_string()));
        assert_eq!(to_arrow(20), ArrowType::Utf8("TEXT".to_string()));
        assert_eq!(to_arrow(21), ArrowType::Utf8("NCHAR     ".to_string()));
        assert_eq!(to_arrow(22), ArrowType::Utf8("NVARCHAR".to_string()));
        assert_eq!(to_arrow(23), ArrowType::Utf8("NTEXT".to_string()));
        assert_eq!(
            to_arrow(24),
            ArrowType::Utf8("\u{1}\u{2}\u{3}\u{4}\u{5}\0\0\0\0\0".to_string())
        );
        assert_eq!(
            to_arrow(25),
            ArrowType::Utf8("\u{1}\u{2}\u{3}\u{4}\u{5}".to_string())
        );
        assert_eq!(
            to_arrow(26),
            ArrowType::Utf8("\u{1}\u{2}\u{3}\u{4}\u{5}".to_string())
        );
        assert_eq!(
            to_arrow(27),
            ArrowType::Utf8("{\"key\": \"value\"}".to_string())
        );
        assert_eq!(
            to_arrow(28),
            ArrowType::Uuid(Uuid::from_str("abcb8303-a0a2-4392-848b-3b32181d224b").unwrap())
        );
        assert_eq!(
            to_arrow(29),
            ArrowType::Utf8("<root><element>value</element></root>".to_string())
        );
        assert_eq!(to_arrow(30), ArrowType::Utf8("A".repeat(8000)));
        assert_eq!(to_arrow(31), ArrowType::Utf8("A".repeat(4000)));
        assert_eq!(to_arrow(32), ArrowType::Utf8("A".repeat(8000)));
    }

    #[tokio::test]
    async fn test_mssql_schema() {
        let connection = new_mssql_connection();
        let mut client = connection.connect().await.unwrap();
        let schema = connection.schema(&mut client).await.unwrap();

        // for (table_name, table) in &schema.tables {
        //     println!("Table: {}", table_name);
        //     for column in &table.columns {
        //         println!("Column: {} ({})", column.name, column.r#type);
        //     }
        // }

        let expected = vec![
            SchemaColumn {
                name: "id".into(),
                r#type: "int".into(),
                is_nullable: false,
            },
            SchemaColumn {
                name: "tinyint_col".into(),
                r#type: "tinyint".into(),
                is_nullable: true,
            },
            SchemaColumn {
                name: "smallint_col".into(),
                r#type: "smallint".into(),
                is_nullable: true,
            },
            SchemaColumn {
                name: "int_col".into(),
                r#type: "int".into(),
                is_nullable: true,
            },
            SchemaColumn {
                name: "bigint_col".into(),
                r#type: "bigint".into(),
                is_nullable: true,
            },
            SchemaColumn {
                name: "bit_col".into(),
                r#type: "bit".into(),
                is_nullable: true,
            },
            SchemaColumn {
                name: "decimal_col".into(),
                r#type: "decimal".into(),
                is_nullable: true,
            },
            SchemaColumn {
                name: "numeric_col".into(),
                r#type: "numeric".into(),
                is_nullable: true,
            },
            SchemaColumn {
                name: "money_col".into(),
                r#type: "money".into(),
                is_nullable: true,
            },
            SchemaColumn {
                name: "smallmoney_col".into(),
                r#type: "smallmoney".into(),
                is_nullable: true,
            },
            SchemaColumn {
                name: "float_col".into(),
                r#type: "float".into(),
                is_nullable: true,
            },
            SchemaColumn {
                name: "real_col".into(),
                r#type: "real".into(),
                is_nullable: true,
            },
            SchemaColumn {
                name: "date_col".into(),
                r#type: "date".into(),
                is_nullable: true,
            },
            SchemaColumn {
                name: "time_col".into(),
                r#type: "time".into(),
                is_nullable: true,
            },
            SchemaColumn {
                name: "datetime2_col".into(),
                r#type: "datetime2".into(),
                is_nullable: true,
            },
            SchemaColumn {
                name: "datetimeoffset_col".into(),
                r#type: "datetimeoffset".into(),
                is_nullable: true,
            },
            SchemaColumn {
                name: "datetime_col".into(),
                r#type: "datetime".into(),
                is_nullable: true,
            },
            SchemaColumn {
                name: "smalldatetime_col".into(),
                r#type: "smalldatetime".into(),
                is_nullable: true,
            },
            SchemaColumn {
                name: "char_col".into(),
                r#type: "char".into(),
                is_nullable: true,
            },
            SchemaColumn {
                name: "varchar_col".into(),
                r#type: "varchar".into(),
                is_nullable: true,
            },
            SchemaColumn {
                name: "text_col".into(),
                r#type: "text".into(),
                is_nullable: true,
            },
            SchemaColumn {
                name: "nchar_col".into(),
                r#type: "nchar".into(),
                is_nullable: true,
            },
            SchemaColumn {
                name: "nvarchar_col".into(),
                r#type: "nvarchar".into(),
                is_nullable: true,
            },
            SchemaColumn {
                name: "ntext_col".into(),
                r#type: "ntext".into(),
                is_nullable: true,
            },
            SchemaColumn {
                name: "binary_col".into(),
                r#type: "binary".into(),
                is_nullable: true,
            },
            SchemaColumn {
                name: "varbinary_col".into(),
                r#type: "varbinary".into(),
                is_nullable: true,
            },
            SchemaColumn {
                name: "image_col".into(),
                r#type: "image".into(),
                is_nullable: true,
            },
            SchemaColumn {
                name: "json_col".into(),
                r#type: "nvarchar".into(),
                is_nullable: true,
            },
            SchemaColumn {
                name: "uniqueidentifier_col".into(),
                r#type: "uniqueidentifier".into(),
                is_nullable: true,
            },
            SchemaColumn {
                name: "xml_col".into(),
                r#type: "xml".into(),
                is_nullable: true,
            },
            SchemaColumn {
                name: "varchar_max_col".into(),
                r#type: "varchar".into(),
                is_nullable: true,
            },
            SchemaColumn {
                name: "nvarchar_max_col".into(),
                r#type: "nvarchar".into(),
                is_nullable: true,
            },
            SchemaColumn {
                name: "varbinary_max_col".into(),
                r#type: "varbinary".into(),
                is_nullable: true,
            },
        ];

        let columns = &schema.tables.get("all_native_data_types").unwrap().columns;

        assert_eq!(columns, &expected);
    }
}
