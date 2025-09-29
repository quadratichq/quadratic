use std::{
    collections::HashMap,
    fmt::{self, Display},
    num::NonZeroU32,
};

use serde::{Deserialize, Serialize};
use uuid::Uuid;

#[derive(Default, Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct GridSchema {
    pub(crate) sheets: Vec<Sheet>,
    pub(crate) version: Option<String>,
}

#[derive(Default, Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct Pos {
    pub(crate) x: i64,
    pub(crate) y: i64,
}

pub(crate) type Offsets = (Vec<(i64, f64)>, Vec<(i64, f64)>);
pub(crate) type Borders = HashMap<String, Vec<(i64, Vec<Option<CellBorder>>)>>;

#[derive(Default, Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct Sheet {
    pub(crate) id: Id,
    pub(crate) name: String,
    pub(crate) color: Option<String>,
    pub(crate) order: String,
    pub(crate) offsets: Offsets,
    pub(crate) columns: Vec<(i64, Column)>,
    pub(crate) rows: Vec<(i64, Id)>,
    pub(crate) borders: Borders,
    #[serde(rename = "code_cells")]
    pub(crate) code_cells: Vec<(CellRef, CodeCellValue)>,
}

#[derive(Default, Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct Id {
    pub(crate) id: String,
}
impl Id {
    pub(crate) fn new() -> Self {
        Self {
            id: Uuid::new_v4().to_string(),
        }
    }
}
impl From<String> for Id {
    fn from(id: String) -> Self {
        Self { id }
    }
}
impl Display for Id {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        write!(f, "{}", self.id)
    }
}

#[derive(Default, Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct CellRef {
    pub(crate) sheet: Id,
    pub(crate) column: Id,
    pub(crate) row: Id,
}
impl Display for CellRef {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        write!(f, "{}, {}, {}", self.sheet, self.column, self.row)
    }
}

#[derive(Default, Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub(crate) struct CodeCellValue {
    pub(crate) language: String,
    pub(crate) code_string: String,
    pub(crate) formatted_code_string: Option<String>,
    pub(crate) last_modified: String,
    pub(crate) output: Option<CodeCellRunOutput>,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct CodeCellRunOutput {
    pub(crate) std_out: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub(crate) std_err: Option<String>,
    pub(crate) result: CodeCellRunResult,

    #[serde(default)]
    pub(crate) spill: bool,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
#[serde(untagged)]
pub(crate) enum CodeCellRunResult {
    Ok {
        output_value: OutputValue,
        cells_accessed: Vec<CellRef>,
    },
    Err {
        error: Error,
    },
}
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
#[serde(untagged)]
pub(crate) enum OutputValue {
    Single(OutputValueValue),
    Array(OutputArray),
}

#[derive(Default, Debug, Clone, PartialEq, Serialize, Deserialize)]
pub(crate) struct OutputArray {
    pub(crate) size: OutputSize,
    pub(crate) values: Vec<OutputValueValue>,
}
#[derive(Default, Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct OutputSize {
    pub(crate) w: i64,
    pub(crate) h: i64,
}
impl From<(NonZeroU32, NonZeroU32)> for OutputSize {
    fn from((w, h): (NonZeroU32, NonZeroU32)) -> Self {
        Self {
            w: w.get().into(),
            h: h.get().into(),
        }
    }
}
#[derive(Default, Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct RenderSize {
    pub(crate) w: String,
    pub(crate) h: String,
}
#[derive(Default, Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct OutputValueValue {
    #[serde(rename = "type")]
    pub(crate) type_field: String,
    pub(crate) value: String,
}
#[derive(Default, Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct Error {
    pub(crate) span: Option<Span>,
    pub(crate) msg: String,
}

#[derive(Default, Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct Span {
    pub(crate) start: u32,
    pub(crate) end: u32,
}

#[derive(Default, Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct Column {
    pub(crate) id: Id,
    pub(crate) values: HashMap<String, ColumnValues>,
    pub(crate) spills: HashMap<String, ColumnFormatType<String>>,
    pub(crate) align: HashMap<String, ColumnFormatType<String>>,
    pub(crate) wrap: HashMap<String, ColumnFormatType<String>>,
    #[serde(rename = "numeric_format")]
    pub(crate) numeric_format: HashMap<String, ColumnFormatType<NumericFormat>>,
    #[serde(rename = "numeric_decimals")]
    pub(crate) numeric_decimals: HashMap<String, ColumnFormatType<i16>>,
    #[serde(rename = "numeric_commas")]
    pub(crate) numeric_commas: HashMap<String, ColumnFormatType<bool>>,
    pub(crate) bold: HashMap<String, ColumnFormatType<bool>>,
    pub(crate) italic: HashMap<String, ColumnFormatType<bool>>,
    #[serde(rename = "text_color")]
    pub(crate) text_color: HashMap<String, ColumnFormatType<String>>,
    #[serde(rename = "fill_color")]
    pub(crate) fill_color: HashMap<String, ColumnFormatType<String>>,
    #[serde(default)]
    #[serde(rename = "render_size")]
    pub(crate) render_size: HashMap<String, ColumnFormatType<RenderSize>>,
}
impl Column {
    pub(crate) fn with_id(id: Id) -> Self {
        Column {
            id,
            ..Default::default()
        }
    }
}

#[derive(Default, Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct ColumnValues {
    pub(crate) y: i64,
    pub(crate) content: ColumnContent,
}
#[derive(Default, Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct ColumnContent {
    #[serde(rename = "Values")]
    pub(crate) values: Vec<ColumnValue>,
}
#[derive(Default, Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct ColumnValue {
    #[serde(rename = "type")]
    pub(crate) type_field: String,
    pub(crate) value: String,
}
impl From<(i64, ColumnValue)> for ColumnValues {
    fn from((y, values): (i64, ColumnValue)) -> Self {
        Self {
            y,
            content: ColumnContent {
                values: vec![values],
            },
        }
    }
}

// pub(crate) enum  ColumnFormat {
//     Bool,
//     String,
// }

#[derive(Default, Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct ColumnFormatType<T> {
    pub(crate) y: i64,
    pub(crate) content: ColumnFormatContent<T>,
}
#[derive(Default, Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct ColumnFormatContent<T> {
    pub(crate) value: T,
    pub(crate) len: i64,
}
impl<T> From<T> for ColumnFormatType<T> {
    fn from(value: T) -> Self {
        ColumnFormatType {
            y: 0,
            content: ColumnFormatContent { value, len: 1 },
        }
    }
}
impl From<(i64, String)> for ColumnFormatType<String> {
    fn from((y, value): (i64, String)) -> Self {
        // TODO(ddimaria): set len to a value
        ColumnFormatType {
            y,
            content: ColumnFormatContent { value, len: 1 },
        }
    }
}
impl From<(i64, bool)> for ColumnFormatType<bool> {
    fn from((y, value): (i64, bool)) -> Self {
        // TODO(ddimaria): set len to a value
        ColumnFormatType {
            y,
            content: ColumnFormatContent { value, len: 1 },
        }
    }
}
impl From<(i64, NumericFormat)> for ColumnFormatType<NumericFormat> {
    fn from((y, value): (i64, NumericFormat)) -> Self {
        // TODO(ddimaria): set len to a value
        ColumnFormatType {
            y,
            content: ColumnFormatContent { value, len: 1 },
        }
    }
}
impl From<(i64, i16)> for ColumnFormatType<i16> {
    fn from((y, value): (i64, i16)) -> Self {
        // TODO(ddimaria): set len to a value
        ColumnFormatType {
            y,
            content: ColumnFormatContent { value, len: 1 },
        }
    }
}
impl From<(i64, CellRef)> for ColumnFormatType<String> {
    fn from((y, value): (i64, CellRef)) -> Self {
        // TODO(ddimaria): set len to a value
        let value = serde_json::to_string(&value).unwrap();
        ColumnFormatType {
            y,
            content: ColumnFormatContent { value, len: 1 },
        }
    }
}

#[derive(Default, Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct NumericFormat {
    #[serde(rename = "type")]
    pub(crate) kind: String,
    pub(crate) symbol: Option<String>,
}

#[derive(Default, Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct Row {
    pub(crate) id: String,
}

#[derive(Default, Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct CellBorder {
    pub(crate) color: String,
    pub(crate) line: String,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
#[repr(u8)]
pub(crate) enum CellSide {
    Left = 0,
    Top = 1,
    Right = 2,
    Bottom = 3,
}
