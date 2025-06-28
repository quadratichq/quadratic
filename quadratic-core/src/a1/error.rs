use serde::Serialize;
use ts_rs::TS;

use crate::RefError;

#[derive(Serialize, Debug, Clone, PartialEq, Eq, TS)]
#[serde(tag = "type", content = "error")]
pub enum A1Error {
    InvalidCellReference(String),
    InvalidSheetId(String),
    InvalidSheetMap(String),
    InvalidColumn(String),
    InvalidSheetName(String),
    InvalidSheetNameMissingQuotes(String),
    InvalidRange(String),
    InvalidRow(String),
    SpuriousDollarSign(String),
    TooManySheets(String),
    MismatchedQuotes(String),
    WrongCellCount(String),
    InvalidExclusion(String),
    TranslateInvalid(String),
    SheetNotFound,

    InvalidTableRef(String),
    TableNotFound(String),
    MultipleColumnDefinitions,
    MultipleRowDefinitions,
    UnexpectedRowNumber,
    InvalidRowRange(String),

    OutOfBounds(RefError),
}

impl From<A1Error> for String {
    fn from(error: A1Error) -> Self {
        serde_json::to_string(&error)
            .unwrap_or(format!("Failed to convert A1Error to string: {error:?}"))
    }
}
impl std::fmt::Display for A1Error {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            A1Error::InvalidCellReference(msg) => write!(f, "Invalid Cell Reference: {msg}"),
            A1Error::InvalidSheetId(msg) => write!(f, "Invalid Sheet ID: {msg}"),
            A1Error::InvalidSheetMap(msg) => write!(f, "Invalid Sheet Map: {msg}"),
            A1Error::InvalidColumn(msg) => write!(f, "Invalid Column: {msg}"),
            A1Error::InvalidSheetName(msg) => write!(f, "Invalid Sheet Name: {msg}"),
            A1Error::InvalidSheetNameMissingQuotes(msg) => {
                write!(f, "Invalid Sheet Name Missing Quotes: {msg}")
            }
            A1Error::InvalidRange(msg) => write!(f, "Invalid Range: {msg}"),
            A1Error::InvalidRow(msg) => write!(f, "Invalid Row: {msg}"),
            A1Error::SpuriousDollarSign(msg) => write!(f, "Spurious `$`: {msg}"),
            A1Error::TooManySheets(msg) => write!(f, "Too Many Sheets: {msg}"),
            A1Error::MismatchedQuotes(msg) => write!(f, "Mismatched Quotes: {msg}"),
            A1Error::WrongCellCount(msg) => write!(f, "Wrong Cell Count: {msg}"),
            A1Error::InvalidExclusion(msg) => write!(f, "Invalid Exclusion: {msg}"),
            A1Error::TranslateInvalid(msg) => write!(f, "Translate Invalid: {msg}"),
            A1Error::SheetNotFound => write!(f, "Sheet Not Found"),

            A1Error::InvalidTableRef(msg) => write!(f, "Invalid Table Ref: {msg}"),
            A1Error::TableNotFound(msg) => write!(f, "Table Not Found: {msg}"),
            A1Error::MultipleColumnDefinitions => {
                write!(f, "Table reference may only have one column definition")
            }
            A1Error::MultipleRowDefinitions => {
                write!(f, "Table reference may only have one row definition")
            }
            A1Error::UnexpectedRowNumber => write!(
                f,
                "Row numbers in tables must be defined with # (e.g., [#12,15-12])"
            ),
            A1Error::InvalidRowRange(msg) => write!(f, "Invalid row range: {msg}"),

            A1Error::OutOfBounds(RefError) => write!(f, "Out Of Bounds"),
        }
    }
}
