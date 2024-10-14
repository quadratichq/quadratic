use serde::Serialize;
use ts_rs::TS;

#[derive(Serialize, Debug, Clone, PartialEq, Eq, TS)]
pub enum A1Error {
    InvalidSheetId(String),
    InvalidSheetMap(String),
    InvalidColumn(String),
    InvalidSheetName(String),
    InvalidSheetNameMissingQuotes(String),
    InvalidRange(String),
    InvalidRow(String),
    TooManySheets(String),
    MismatchedQuotes(String),
    WrongCellCount(String),
    InvalidExclusion(String),
    TranslateInvalid(String),
}

impl From<A1Error> for String {
    fn from(error: A1Error) -> Self {
        serde_json::to_string(&error)
            .unwrap_or(format!("Failed to convert A1Error to string: {:?}", error))
    }
}
impl std::fmt::Display for A1Error {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            A1Error::InvalidSheetId(msg) => write!(f, "Invalid Sheet ID: {}", msg),
            A1Error::InvalidSheetMap(msg) => write!(f, "Invalid Sheet Map: {}", msg),
            A1Error::InvalidColumn(msg) => write!(f, "Invalid Column: {}", msg),
            A1Error::InvalidSheetName(msg) => write!(f, "Invalid Sheet Name: {}", msg),
            A1Error::InvalidSheetNameMissingQuotes(msg) => {
                write!(f, "Invalid Sheet Name Missing Quotes: {}", msg)
            }
            A1Error::InvalidRange(msg) => write!(f, "Invalid Range: {}", msg),
            A1Error::InvalidRow(msg) => write!(f, "Invalid Row: {}", msg),
            A1Error::TooManySheets(msg) => write!(f, "Too Many Sheets: {}", msg),
            A1Error::MismatchedQuotes(msg) => write!(f, "Mismatched Quotes: {}", msg),
            A1Error::WrongCellCount(msg) => write!(f, "Wrong Cell Count: {}", msg),
            A1Error::InvalidExclusion(msg) => write!(f, "Invalid Exclusion: {}", msg),
            A1Error::TranslateInvalid(msg) => write!(f, "Translate Invalid: {}", msg),
        }
    }
}
