use serde::{Deserialize, Serialize};
use uuid::Uuid;

use super::{
    A1SelectionSchema, PosSchema, ValidationDateTimeSchema, ValidationErrorSchema,
    ValidationLogicalSchema, ValidationMessageSchema, ValidationNumberSchema, ValidationTextSchema,
};

#[derive(Serialize, Deserialize, Debug, Clone, PartialEq)]
pub struct ValidationListSchema {
    pub source: ValidationListSourceSchema,
    pub ignore_blank: bool,
    pub drop_down: bool,
}

#[derive(Serialize, Deserialize, Debug, Clone, PartialEq)]
pub enum ValidationRuleSchema {
    None,
    List(ValidationListSchema),
    Logical(ValidationLogicalSchema),
    Text(ValidationTextSchema),
    Number(ValidationNumberSchema),
    DateTime(ValidationDateTimeSchema),
}

#[derive(Serialize, Deserialize, Debug, Clone, PartialEq)]
pub enum ValidationListSourceSchema {
    Selection(A1SelectionSchema),
    List(Vec<String>),
}

#[derive(Serialize, Deserialize, Debug, Clone, PartialEq)]
pub struct ValidationSchema {
    pub selection: A1SelectionSchema,
    pub id: Uuid,
    pub rule: ValidationRuleSchema,
    pub message: ValidationMessageSchema,
    pub error: ValidationErrorSchema,
}

#[derive(Serialize, Deserialize, Default, Debug, Clone, PartialEq)]
pub struct ValidationsSchema {
    #[serde(skip_serializing_if = "Vec::is_empty", default)]
    pub validations: Vec<ValidationSchema>,

    #[serde(skip_serializing_if = "Vec::is_empty", default)]
    pub warnings: Vec<(PosSchema, Uuid)>,
}
