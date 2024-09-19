use serde::Serialize;
use std::collections::BTreeMap;

#[derive(Debug, Serialize, PartialEq)]
pub struct SchemaColumn {
    pub name: String,
    pub r#type: String,
    pub is_nullable: bool,
}

#[derive(Debug, Serialize, PartialEq)]
pub struct SchemaTable {
    pub name: String,
    pub schema: String,
    pub columns: Vec<SchemaColumn>,
}

#[derive(Debug, Serialize, PartialEq)]
pub struct DatabaseSchema {
    pub database: String,
    pub tables: BTreeMap<String, SchemaTable>,
}
