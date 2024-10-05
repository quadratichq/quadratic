use serde::Serialize;
use ts_rs::TS;

#[derive(Serialize, Debug, Clone, PartialEq, Eq, TS)]
pub enum A1Error {
    InvalidSheetId(String),
    InvalidSheetMap(String),
    InvalidColumn(String),
    InvalidSheetName(String),
    TooManySheets,
}

impl From<A1Error> for String {
    fn from(error: A1Error) -> Self {
        serde_json::to_string(&error)
            .unwrap_or(format!("Failed to convert A1Error to string: {:?}", error))
    }
}
