use serde::{Deserialize, Serialize};
use uuid::Uuid;

#[derive(Default, Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct GridSchemaV1_5 {
    pub version: String,
    pub sheets: Vec<Sheet>,
    // TODO(ddimaria): this is more complex than a string
    pub dependencies: Vec<String>,
}

#[derive(Default, Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Sheet {
    pub id: Id,
    pub name: String,
    pub color: Option<String>,
    pub order: String,
    pub offsets: Vec<Vec<Vec<f64>>>,
    pub columns: Vec<(i64, Column)>,
    pub rows: Vec<(i64, Id)>,
    pub borders: Borders,
    #[serde(rename = "code_cells")]
    pub code_cells: Vec<(CellRef, CodeCellValue)>,
}

#[derive(Default, Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Id {
    pub id: String,
}
impl Id {
    pub fn new() -> Self {
        Self {
            id: Uuid::new_v4().to_string(),
        }
    }
}

#[derive(Default, Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CellRef {
    pub sheet: String,
    pub column: String,
    pub row: String,
}

#[derive(Default, Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CodeCellValue {
    pub language: String,
    pub code_string: String,
    pub formatted_code_string: Option<String>,
    pub last_modified: String,
    pub output: Option<String>,
}

#[derive(Default, Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Column {
    pub id: Id,
    pub values: Vec<(i64, ColumnValues)>,
    pub spills: Spills,
    pub align: Vec<(i64, ColumnFormatString)>,
    pub wrap: Vec<(i64, String)>,
    #[serde(rename = "numeric_format")]
    pub numeric_format: NumericFormat,
    #[serde(rename = "numeric_decimals")]
    pub numeric_decimals: NumericDecimals,
    pub bold: Vec<(i64, ColumnFormatBool)>,
    pub italic: Vec<(i64, ColumnFormatBool)>,
    #[serde(rename = "text_color")]
    pub text_color: Vec<(i64, ColumnFormatString)>,
    #[serde(rename = "fill_color")]
    pub fill_color: Vec<(i64, ColumnFormatString)>,
}
impl Column {
    pub fn with_id(id: Id) -> Self {
        Column {
            id,
            ..Default::default()
        }
    }
}

#[derive(Default, Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ColumnValues {
    pub y: i64,
    pub content: ColumnContent,
}
#[derive(Default, Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ColumnContent {
    #[serde(rename = "Values")]
    pub values: Vec<ColumnValue>,
}
#[derive(Default, Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ColumnValue {
    #[serde(rename = "type")]
    pub type_field: String,
    pub value: String,
}
// impl From<(i64, ColumnValue)> for ColumnValues {
//     fn from((y, values): (i64, ColumnValue)) -> Self {
//         Self {
//             y,
//             content: ColumnContent { values },
//         }
//     }
// }
// impl From<Vec<ColumnValue>> for ColumnValue {
//     fn from(values: Vec<ColumnValue>) -> Self {
//         values.map(|value| match value.type_field.to_lowercase() {
//             "text" => ColumnValue::from(value.value),

//         });
//         ColumnValue {
//             y: 0,
//             content: ColumnContent { values },
//         }
//     }
// }

#[derive(Default, Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Spills {}

#[derive(Default, Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ColumnFormatString {
    pub y: i64,
    pub content: ColumnContentString,
}
#[derive(Default, Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ColumnContentString {
    pub value: String,
    pub len: i64,
}
impl From<String> for ColumnFormatString {
    fn from(value: String) -> Self {
        ColumnFormatString {
            y: 0,
            content: ColumnContentString { value, len: 1 },
        }
    }
}

#[derive(Default, Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ColumnFormatBool {
    pub y: i64,
    pub content: ColumnContentBool,
}
#[derive(Default, Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ColumnContentBool {
    pub value: bool,
    pub len: i64,
}
impl From<bool> for ColumnFormatBool {
    fn from(value: bool) -> Self {
        ColumnFormatBool {
            y: 0,
            content: ColumnContentBool { value, len: 1 },
        }
    }
}

#[derive(Default, Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Wrap {}

#[derive(Default, Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct NumericFormat {}

#[derive(Default, Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct NumericDecimals {}

#[derive(Default, Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Row {
    pub id: String,
}

#[derive(Default, Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Borders {
    pub horizontal: Vec<Horizontal>,
    pub vertical: Vec<Vertical>,
}

#[derive(Default, Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Horizontal {}

#[derive(Default, Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Vertical {}
