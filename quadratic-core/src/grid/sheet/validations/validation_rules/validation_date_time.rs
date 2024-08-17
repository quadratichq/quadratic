use chrono::NaiveTime;
use serde::{Deserialize, Serialize};
use ts_rs::TS;

use crate::CellValue;

#[derive(Serialize, Deserialize, Debug, Clone, PartialEq, TS)]
pub enum DateTimeRange {
    DateRange(Option<i64>, Option<i64>),
    DateEqual(Vec<i64>),
    DateNotEqual(Vec<i64>),

    TimeRange(Option<i64>, Option<i64>),
    TimeEqual(Vec<i64>),
    TimeNotEqual(Vec<i64>),
}

#[derive(Default, Serialize, Deserialize, Debug, Clone, PartialEq, TS)]
pub struct ValidationDateTime {
    pub ignore_blank: bool,

    // allowed CellValue types
    pub date_time: bool,
    pub date: bool,
    pub time: bool,

    pub ranges: Vec<DateTimeRange>,
}

impl ValidationDateTime {
    // Validate a CellValue against the validation rule.
    pub fn validate(&self, value: Option<&CellValue>) -> bool {
        if let Some(value) = value {
            match value {
                CellValue::DateTime(_) => {
                    if !self.date_time {
                        return false;
                    }

                    true
                }
                CellValue::Date(_) => {
                    if !self.date {
                        return false;
                    }
                    true
                }
                CellValue::Time(_) => {
                    if !self.time {
                        return false;
                    }

                    true
                }
                _ => false,
            }
        } else {
            self.ignore_blank
        }
    }
}

#[cfg(test)]
mod tests {
    use chrono::NaiveDateTime;

    // use super::*;
}
