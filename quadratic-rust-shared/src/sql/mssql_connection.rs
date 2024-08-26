use std::collections::BTreeMap;

use arrow::datatypes::Date32Type;
use async_trait::async_trait;
use bigdecimal::BigDecimal;
use chrono::{DateTime, Local, NaiveDate, NaiveDateTime, NaiveTime, Utc};
use futures_util::{StreamExt, TryStreamExt};
use serde::{Deserialize, Serialize};
use tiberius::xml::XmlData;
use tiberius::ColumnData;
use uuid::Uuid;

use tiberius::{AuthMethod, Client, Column, Config, FromSql, FromSqlOwned, Row};
use tokio::net::TcpStream;
use tokio_util::compat::{Compat, TokioAsyncWriteCompatExt};

use crate::arrow::arrow_type::ArrowType;
use crate::error::{Result, SharedError, Sql};
use crate::sql::schema::{DatabaseSchema, SchemaColumn, SchemaTable};
use crate::sql::Connection;
use crate::{convert_mssql_type, convert_mssql_type_owned};

#[derive(Debug, Serialize, Deserialize)]
pub struct MsSqlConnection {
    pub username: Option<String>,
    pub password: Option<String>,
    pub host: String,
    pub port: Option<String>,
    pub database: Option<String>,
}

impl MsSqlConnection {
    pub fn new(
        username: Option<String>,
        password: Option<String>,
        host: String,
        port: Option<String>,
        database: Option<String>,
    ) -> MsSqlConnection {
        MsSqlConnection {
            username,
            password,
            host,
            port,
            database,
        }
    }
}

#[async_trait]
impl Connection for MsSqlConnection {
    type Conn = Client<Compat<TcpStream>>;
    type Row = Row;
    type Column = Column;

    fn row_len(row: &Self::Row) -> usize {
        row.len()
    }

    fn row_columns(row: &Self::Row) -> Box<dyn Iterator<Item = &Self::Column> + '_> {
        Box::new(row.columns().iter())
    }

    fn column_name(col: &Self::Column) -> &str {
        col.name()
    }

    async fn connect(&self) -> Result<Client<Compat<TcpStream>>> {
        let mut config = Config::new();

        config.host(&self.host);

        if let Some(port) = &self.port {
            config.port(port.parse::<u16>().map_err(|_| {
                SharedError::Sql(Sql::Connect("Could not parse port into a number".into()))
            })?);
        }

        if let Some(database) = &self.database {
            config.database(database);
        }

        if let Some(username) = &self.username {
            config.authentication(AuthMethod::sql_server(
                username,
                self.password.as_ref().unwrap(),
            ));
        }

        config.trust_cert();

        let tcp = TcpStream::connect(config.get_addr())
            .await
            .map_err(|e| SharedError::Sql(Sql::Connect(format!("Failed to connect: {}", e))))?;
        tcp.set_nodelay(true)
            .map_err(|e| SharedError::Sql(Sql::Connect(format!("Failed to set nodelay: {}", e))))?;

        let client = Client::connect(config, tcp.compat_write())
            .await
            .map_err(|e| {
                SharedError::Sql(Sql::Connect(format!("Failed to create client: {}", e)))
            })?;

        Ok(client)
    }

    async fn query(
        &self,
        client: &mut Self::Conn,
        sql: &str,
        max_bytes: Option<u64>,
    ) -> Result<(Vec<Row>, bool)> {
        let mut rows = vec![];
        let mut over_the_limit = false;

        let mut row_stream = client
            .query(sql, &[])
            .await
            .map_err(|e| SharedError::Sql(Sql::Query(e.to_string())))?
            .into_row_stream();

        if let Some(max_bytes) = max_bytes {
            let mut bytes = 0;

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
                    Err(e) => return Err(SharedError::Sql(Sql::Query(e.to_string()))),
                }
            }
        } else {
            while let Some(row_result) = row_stream.next().await {
                match row_result {
                    Ok(row) => rows.push(row),
                    Err(e) => return Err(SharedError::Sql(Sql::Query(e.to_string()))),
                }
            }
        }

        Ok((rows, over_the_limit))
    }

    async fn schema(&self, client: &mut Self::Conn) -> Result<DatabaseSchema> {
        let database = self.database.as_ref().ok_or_else(|| {
            SharedError::Sql(Sql::Schema("Database name is required for MsSQL".into()))
        })?;

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
            .map_err(|e| SharedError::Sql(Sql::Schema(e.to_string())))?
            .into_row_stream();

        let rows: Vec<Row> = row_stream
            .try_collect()
            .await
            .map_err(|e| SharedError::Sql(Sql::Schema(e.to_string())))?;

        let mut schema = DatabaseSchema {
            database: self.database.to_owned().unwrap_or_default(),
            tables: BTreeMap::new(),
        };

        for row in rows {
            let schema_name: &str = row.get(1).unwrap_or_default();
            let table_name: &str = row.get(2).unwrap_or_default();
            let column_name: &str = row.get(3).unwrap_or_default();
            let column_type: &str = row.get(4).unwrap_or_default();
            let is_nullable: &str = row.get(5).unwrap_or_default();

            schema
                .tables
                .entry(table_name.into())
                .or_insert_with(|| SchemaTable {
                    name: table_name.into(),
                    schema: schema_name.into(),
                    columns: vec![],
                })
                .columns
                .push(SchemaColumn {
                    name: column_name.into(),
                    r#type: column_type.into(),
                    is_nullable: is_nullable.to_uppercase() == "YES",
                });
        }

        Ok(schema)
    }

    fn to_arrow(row: &tiberius::Row, _: &tiberius::Column, index: usize) -> ArrowType {
        row.cells().nth(index).map_or(
            ArrowType::Unsupported,
            |(_, column_data)| match column_data {
                ColumnData::Bit(_) => ArrowType::Boolean(convert_mssql_type!(bool, column_data)),
                ColumnData::U8(_) => ArrowType::UInt8(convert_mssql_type!(u8, column_data)),
                ColumnData::I16(_) => ArrowType::Int16(convert_mssql_type!(i16, column_data)),
                ColumnData::I32(_) => ArrowType::Int32(convert_mssql_type!(i32, column_data)),
                ColumnData::I64(_) => ArrowType::Int64(convert_mssql_type!(i64, column_data)),
                ColumnData::F32(_) => ArrowType::Float32(convert_mssql_type!(f32, column_data)),
                ColumnData::F64(_) => ArrowType::Float64(convert_mssql_type!(f64, column_data)),
                ColumnData::Numeric(_) => {
                    ArrowType::BigDecimal(convert_mssql_type!(BigDecimal, column_data))
                }
                ColumnData::Guid(_) => ArrowType::Uuid(convert_mssql_type!(Uuid, column_data)),
                ColumnData::String(_) => {
                    let column_data = column_data.to_owned();
                    ArrowType::Utf8(convert_mssql_type_owned!(String, column_data))
                }
                ColumnData::Binary(_) => {
                    let column_data = column_data.to_owned();
                    let bytes = convert_mssql_type_owned!(Vec<u8>, column_data);
                    ArrowType::Utf8(String::from_utf8(bytes).unwrap_or_default())
                }
                ColumnData::Date(_) => {
                    let naive_date = convert_mssql_type!(NaiveDate, column_data);
                    ArrowType::Date32(Date32Type::from_naive_date(naive_date))
                }
                ColumnData::Time(_) => {
                    ArrowType::Time32(convert_mssql_type!(NaiveTime, column_data))
                }
                ColumnData::SmallDateTime(_)
                | ColumnData::DateTime(_)
                | ColumnData::DateTime2(_) => {
                    ArrowType::Timestamp(convert_mssql_type!(NaiveDateTime, column_data))
                }
                ColumnData::DateTimeOffset(_) => {
                    let date_time = convert_mssql_type!(DateTime<Utc>, column_data);
                    ArrowType::TimestampTz(date_time.with_timezone(&Local))
                }
                ColumnData::Xml(_) => {
                    let xml_string = XmlData::from_sql_owned(column_data.to_owned())
                        .ok()
                        .flatten()
                        .map_or(String::new(), |xml_data| xml_data.into_string());
                    ArrowType::Utf8(xml_string)
                }
            },
        )
    }
}

#[macro_export]
macro_rules! convert_mssql_type {
    ( $kind:ty, $column_data:ident ) => {{
        <$kind>::from_sql($column_data)
            .ok()
            .flatten()
            .unwrap_or_default()
    }};
}

#[macro_export]
macro_rules! convert_mssql_type_owned {
    ( $kind:ty, $column_data:ident ) => {{
        <$kind>::from_sql_owned($column_data)
            .ok()
            .flatten()
            .unwrap_or_default()
    }};
}

#[cfg(test)]
mod tests {

    use std::str::FromStr;

    use super::*;
    // use std::io::Read;
    use bigdecimal::BigDecimal;
    use tracing_test::traced_test;

    fn new_mssql_connection() -> MsSqlConnection {
        MsSqlConnection::new(
            Some("sa".into()),
            Some("yourStrong(!)Password".into()),
            "0.0.0.0".into(),
            Some("1433".into()),
            Some("AllTypes".into()),
        )
    }

    async fn setup() -> (MsSqlConnection, Result<Client<Compat<TcpStream>>>) {
        let connection = new_mssql_connection();
        let client = connection.connect().await;

        (connection, client)
    }

    #[tokio::test]
    #[traced_test]
    async fn test_mssql_connection() {
        let (_, client) = setup().await;

        assert!(client.is_ok());
    }

    #[tokio::test]
    #[traced_test]
    async fn test_mssql_query_to_arrow() {
        let (connection, client) = setup().await;
        let (rows, over_the_limit) = connection
            .query(
                &mut client.unwrap(),
                "SELECT TOP 1 * FROM [dbo].[all_native_data_types] ORDER BY id",
                None,
            )
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
        let to_arrow = |index: usize| MsSqlConnection::to_arrow(row, &columns[index], index);

        assert!(!over_the_limit);

        assert_eq!(to_arrow(0), ArrowType::Int32(1));
        assert_eq!(to_arrow(1), ArrowType::UInt8(255));
        assert_eq!(to_arrow(2), ArrowType::Int16(32767));
        assert_eq!(to_arrow(3), ArrowType::Int32(2147483647));
        assert_eq!(to_arrow(4), ArrowType::Int64(9223372036854775807));
        assert_eq!(to_arrow(5), ArrowType::Boolean(true));
        assert_eq!(
            to_arrow(6),
            ArrowType::BigDecimal(BigDecimal::from_str("12345.67").unwrap())
        );
        assert_eq!(
            to_arrow(7),
            ArrowType::BigDecimal(BigDecimal::from_str("12345.67").unwrap())
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
    #[traced_test]
    async fn test_mysql_schema() {
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
