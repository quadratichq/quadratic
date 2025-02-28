use std::collections::HashMap;

use crate::grid::file::v1_6::schema as v1_6;
use crate::grid::file::v1_6::schema_validation as v1_6_validation;
use crate::grid::file::v1_8::ImportSchema;
use chrono::DateTime;
use chrono::NaiveDate;
use chrono::NaiveDateTime;
use chrono::NaiveTime;
use chrono::Utc;
use serde::{Deserialize, Serialize};

pub use super::run_error_schema::AxisSchema;
pub use super::run_error_schema::RunErrorMsgSchema;
pub use super::run_error_schema::RunErrorSchema;

pub type IdSchema = v1_6::Id;
pub type PosSchema = v1_6::Pos;
pub type RectSchema = v1_6::Rect;
pub type SheetRectSchema = v1_6::SheetRect;
pub type OffsetsSchema = v1_6::Offsets;
pub type FormatSchema = v1_6::Format;
pub type ValidationsSchema = v1_6_validation::Validations;
pub type ResizeSchema = v1_6::Resize;
pub type OutputSizeSchema = v1_6::OutputSize;
pub type NumericFormatKindSchema = v1_6::NumericFormatKind;
pub type NumericFormatSchema = v1_6::NumericFormat;
pub type ConnectionKindSchema = v1_6::ConnectionKind;
pub type CodeCellSchema = v1_6::CodeCell;
pub type CodeCellLanguageSchema = v1_6::CodeCellLanguage;
pub type CellAlignSchema = v1_6::CellAlign;
pub type CellVerticalAlignSchema = v1_6::CellVerticalAlign;
pub type CellWrapSchema = v1_6::CellWrap;
pub type CellBorderSchema = v1_6::CellBorder;
pub type ColumnRepeatSchema<T> = v1_6::ColumnRepeat<T>;
pub type RenderSizeSchema = v1_6::RenderSize;
pub type SpanSchema = v1_6::Span;

pub type SelectionSchema = v1_6_validation::Selection;

pub type ValidationSchema = v1_6_validation::Validation;
pub type ValidationStyleSchema = v1_6_validation::ValidationStyle;
pub type ValidationMessageSchema = v1_6_validation::ValidationMessage;
pub type ValidationErrorSchema = v1_6_validation::ValidationError;
pub type ValidationRuleSchema = v1_6_validation::ValidationRule;
pub type ValidationDateTimeSchema = v1_6_validation::ValidationDateTime;
pub type ValidationNumberSchema = v1_6_validation::ValidationNumber;
pub type ValidationTextSchema = v1_6_validation::ValidationText;
pub type ValidationLogicalSchema = v1_6_validation::ValidationLogical;
pub type ValidationListSourceSchema = v1_6_validation::ValidationListSource;
pub type TextMatchSchema = v1_6_validation::TextMatch;
pub type TextCaseSchema = v1_6_validation::TextCase;
pub type DateTimeRangeSchema = v1_6_validation::DateTimeRange;
pub type NumberRangeSchema = v1_6_validation::NumberRange;

#[derive(Default, Debug, PartialEq, Serialize, Deserialize, Clone)]
pub struct GridSchema {
    pub sheets: Vec<SheetSchema>,
    pub version: Option<String>,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct CodeRunSchema {
    pub formatted_code_string: Option<String>,
    pub std_out: Option<String>,
    pub std_err: Option<String>,
    pub cells_accessed: Vec<SheetRectSchema>,
    pub result: CodeRunResultSchema,
    pub return_type: Option<String>,
    pub line_number: Option<u32>,
    pub output_type: Option<String>,
    pub spill_error: bool,
    pub last_modified: Option<DateTime<Utc>>,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub enum CodeRunResultSchema {
    Ok(OutputValueSchema),
    Err(RunErrorSchema),
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub enum OutputValueSchema {
    Single(CellValueSchema),
    Array(OutputArraySchema),
}

#[derive(Default, Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct OutputArraySchema {
    pub size: OutputSizeSchema,
    pub values: Vec<CellValueSchema>,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub enum CellValueSchema {
    Blank,
    Text(String),
    Number(String),
    Html(String),
    Code(CodeCellSchema),
    Logical(bool),
    Instant(String),
    Date(NaiveDate),
    Time(NaiveTime),
    DateTime(NaiveDateTime),
    Duration(String),
    Error(RunErrorSchema),
    Image(String),
    Import(ImportSchema),
}

#[derive(Default, Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct ColumnSchema {
    pub values: HashMap<String, CellValueSchema>,
    pub align: HashMap<String, ColumnRepeatSchema<CellAlignSchema>>,
    pub vertical_align: HashMap<String, ColumnRepeatSchema<CellVerticalAlignSchema>>,
    pub wrap: HashMap<String, ColumnRepeatSchema<CellWrapSchema>>,
    pub numeric_format: HashMap<String, ColumnRepeatSchema<NumericFormatSchema>>,
    pub numeric_decimals: HashMap<String, ColumnRepeatSchema<i16>>,
    pub numeric_commas: HashMap<String, ColumnRepeatSchema<bool>>,
    pub bold: HashMap<String, ColumnRepeatSchema<bool>>,
    pub italic: HashMap<String, ColumnRepeatSchema<bool>>,
    pub underline: HashMap<String, ColumnRepeatSchema<bool>>,
    pub strike_through: HashMap<String, ColumnRepeatSchema<bool>>,
    pub text_color: HashMap<String, ColumnRepeatSchema<String>>,
    pub fill_color: HashMap<String, ColumnRepeatSchema<String>>,
    pub render_size: HashMap<String, ColumnRepeatSchema<RenderSizeSchema>>,
    pub date_time: HashMap<String, ColumnRepeatSchema<String>>,
}

#[derive(Default, Serialize, Deserialize, Debug, Clone, PartialEq)]
pub struct RgbaSchema {
    pub red: u8,
    pub green: u8,
    pub blue: u8,
    pub alpha: u8,
}

#[derive(Default, Serialize, Deserialize, Debug, Clone, PartialEq)]
pub enum CellBorderLineSchema {
    #[default]
    Line1,
    Line2,
    Line3,
    Dotted,
    Dashed,
    Double,
    Clear,
}

#[derive(Default, Serialize, Deserialize, Debug, Clone, PartialEq)]
pub struct BorderStyleTimestampSchema {
    pub color: RgbaSchema,
    pub line: CellBorderLineSchema,
    pub timestamp: u32,
}

#[derive(Default, Debug, Serialize, Deserialize, Clone, PartialEq)]
pub struct BorderStyleCellSchema {
    pub top: Option<BorderStyleTimestampSchema>,
    pub bottom: Option<BorderStyleTimestampSchema>,
    pub left: Option<BorderStyleTimestampSchema>,
    pub right: Option<BorderStyleTimestampSchema>,
}

#[derive(Default, Serialize, Deserialize, Debug, Clone, PartialEq)]
pub struct BordersSchema {
    pub all: BorderStyleCellSchema,
    pub columns: HashMap<i64, BorderStyleCellSchema>,
    pub rows: HashMap<i64, BorderStyleCellSchema>,

    pub left: HashMap<i64, HashMap<i64, ColumnRepeatSchema<BorderStyleTimestampSchema>>>,
    pub right: HashMap<i64, HashMap<i64, ColumnRepeatSchema<BorderStyleTimestampSchema>>>,
    pub top: HashMap<i64, HashMap<i64, ColumnRepeatSchema<BorderStyleTimestampSchema>>>,
    pub bottom: HashMap<i64, HashMap<i64, ColumnRepeatSchema<BorderStyleTimestampSchema>>>,
}

#[derive(Default, Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct SheetSchema {
    pub id: IdSchema,
    pub name: String,
    pub color: Option<String>,
    pub order: String,
    pub offsets: OffsetsSchema,
    pub columns: Vec<(i64, ColumnSchema)>,
    pub code_runs: Vec<(PosSchema, CodeRunSchema)>,
    pub formats_all: Option<FormatSchema>,
    pub formats_columns: Vec<(i64, (FormatSchema, i64))>,
    pub formats_rows: Vec<(i64, (FormatSchema, i64))>,
    pub rows_resize: Vec<(i64, ResizeSchema)>,
    pub validations: ValidationsSchema,
    pub borders: BordersSchema,
}
