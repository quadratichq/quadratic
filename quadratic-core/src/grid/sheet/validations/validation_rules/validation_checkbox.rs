use serde::{Deserialize, Serialize};
use ts_rs::TS;

use crate::CellValue;

#[derive(Default, Serialize, Deserialize, Debug, Clone, PartialEq, TS)]
pub struct ValidationCheckbox {
    pub checkbox: bool,
}

impl ValidationCheckbox {
    // Validate a CellValue against the validation rule.
    pub fn validate(value: &CellValue) -> bool {
        matches!(value, CellValue::Logical(_))
    }
}
