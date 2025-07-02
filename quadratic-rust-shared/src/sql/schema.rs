//! Schema
//!
//! Functions to interact with the schema of a database

use serde::Serialize;
use std::collections::BTreeMap;

/// A column in a database
#[derive(Debug, Serialize, PartialEq, Clone)]
pub struct SchemaColumn {
    pub name: String,
    pub r#type: String,
    pub is_nullable: bool,
}

/// A table in a database
#[derive(Debug, Serialize, PartialEq, Clone)]
pub struct SchemaTable {
    pub name: String,
    pub schema: String,
    pub columns: Vec<SchemaColumn>,
}

/// A database schema
#[derive(Debug, Serialize, PartialEq)]
pub struct DatabaseSchema {
    pub database: String,
    pub tables: BTreeMap<String, SchemaTable>,
}
