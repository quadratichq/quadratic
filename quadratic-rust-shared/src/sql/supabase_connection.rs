//! Supabase
//!
//! Functions to interact with Supabase
//!
//! Supabase is just Postgres, so it uses the same client

use crate::sql::postgres_connection::PostgresConnection;
pub type SupabaseConnection = PostgresConnection;
