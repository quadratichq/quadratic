//! Neon
//!
//! Functions to interact with Neon
//!
//! Neon is just Postgres, so it uses the same client

use crate::sql::postgres_connection::PostgresConnection;
pub type NeonConnection = PostgresConnection;
