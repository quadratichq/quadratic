use serde::{Deserialize, Serialize};
use ts_rs::TS;

use crate::CellValue;

#[derive(Default, Serialize, Deserialize, Debug, Clone, PartialEq, TS)]
pub struct ValidationNumber {
    pub ignore_blank: bool,
}

impl ValidationNumber {
    // Validate a CellValue against the validation rule.
    pub fn validate(&self, value: Option<&CellValue>) -> bool {
        if let Some(value) = value {
            matches!(value, CellValue::Logical(_))
        } else {
            self.ignore_blank
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
}
