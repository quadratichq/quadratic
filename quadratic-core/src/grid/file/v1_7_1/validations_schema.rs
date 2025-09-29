use serde::{Deserialize, Serialize};
use uuid::Uuid;

use super::{
    A1SelectionSchema, PosSchema, ValidationDateTimeSchema, ValidationErrorSchema,
    ValidationLogicalSchema, ValidationMessageSchema, ValidationNumberSchema, ValidationTextSchema,
};

#[derive(Serialize, Deserialize, Debug, Clone, PartialEq)]
pub(crate) struct ValidationListSchema {
    pub(crate) source: ValidationListSourceSchema,
    pub(crate) ignore_blank: bool,
    pub(crate) drop_down: bool,
}

#[derive(Serialize, Deserialize, Debug, Clone, PartialEq)]
pub(crate) enum ValidationRuleSchema {
    None,
    List(ValidationListSchema),
    Logical(ValidationLogicalSchema),
    Text(ValidationTextSchema),
    Number(ValidationNumberSchema),
    DateTime(ValidationDateTimeSchema),
}

#[derive(Serialize, Deserialize, Debug, Clone, PartialEq)]
pub(crate) enum ValidationListSourceSchema {
    Selection(A1SelectionSchema),
    List(Vec<String>),
}

#[derive(Serialize, Deserialize, Debug, Clone, PartialEq)]
pub(crate) struct ValidationSchema {
    pub(crate) selection: A1SelectionSchema,
    pub(crate) id: Uuid,
    pub(crate) rule: ValidationRuleSchema,
    pub(crate) message: ValidationMessageSchema,
    pub(crate) error: ValidationErrorSchema,
}

#[derive(Serialize, Deserialize, Default, Debug, Clone, PartialEq)]
pub(crate) struct ValidationsSchema {
    #[serde(skip_serializing_if = "Vec::is_empty", default)]
    pub(crate) validations: Vec<ValidationSchema>,

    #[serde(skip_serializing_if = "Vec::is_empty", default)]
    pub(crate) warnings: Vec<(PosSchema, Uuid)>,
}
