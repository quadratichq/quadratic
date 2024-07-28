//! Data Validation for a Sheet. Validations can be shared across multiple cells
//! through a Uuid.

use std::collections::HashMap;

use serde::{Deserialize, Serialize};
use uuid::Uuid;
use validation::Validation;

use crate::Pos;

pub mod validation;
pub mod validation_rules;
pub mod validations_add;
pub mod validations_get;

#[derive(Default, Serialize, Deserialize, Debug, Clone, PartialEq)]
pub struct Validations {
    // Holds all validations within a sheet mapped to a Uuid.
    #[serde(default)]
    pub validations: HashMap<Uuid, Validation>,

    // Map of validation to a Pos.
    #[serde(default)]
    pub cell_validations: HashMap<Pos, Uuid>,

    // Map of validation to a Column.
    #[serde(default)]
    pub column_validations: HashMap<i64, Uuid>,

    // Map of validation to a Row.
    #[serde(default)]
    pub row_validations: HashMap<i64, Uuid>,

    // validation for the entire sheet.
    #[serde(default)]
    pub all: Option<Uuid>,
}
