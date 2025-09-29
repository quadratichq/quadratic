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

pub(crate) use super::run_error_schema::AxisSchema;
pub(crate) use super::run_error_schema::RunErrorMsgSchema;
pub(crate) use super::run_error_schema::RunErrorSchema;

pub(crate) type IdSchema = v1_6::Id;
pub(crate) type PosSchema = v1_6::Pos;
pub(crate) type SheetRectSchema = v1_6::SheetRect;
pub(crate) type OffsetsSchema = v1_6::Offsets;
pub(crate) type FormatSchema = v1_6::Format;
pub(crate) type ValidationsSchema = v1_6_validation::Validations;
pub(crate) type ResizeSchema = v1_6::Resize;
pub(crate) type OutputSizeSchema = v1_6::OutputSize;
pub(crate) type NumericFormatKindSchema = v1_6::NumericFormatKind;
pub(crate) type NumericFormatSchema = v1_6::NumericFormat;
pub(crate) type ConnectionKindSchema = v1_6::ConnectionKind;
pub(crate) type CodeCellSchema = v1_6::CodeCell;
pub(crate) type CodeCellLanguageSchema = v1_6::CodeCellLanguage;
pub(crate) type CellAlignSchema = v1_6::CellAlign;
pub(crate) type CellVerticalAlignSchema = v1_6::CellVerticalAlign;
pub(crate) type CellWrapSchema = v1_6::CellWrap;
pub(crate) type ColumnRepeatSchema<T> = v1_6::ColumnRepeat<T>;
pub(crate) type RenderSizeSchema = v1_6::RenderSize;
pub(crate) type SpanSchema = v1_6::Span;
pub(crate) type SelectionSchema = v1_6_validation::Selection;
pub(crate) type ValidationSchema = v1_6_validation::Validation;
pub(crate) type ValidationStyleSchema = v1_6_validation::ValidationStyle;
pub(crate) type ValidationMessageSchema = v1_6_validation::ValidationMessage;
pub(crate) type ValidationErrorSchema = v1_6_validation::ValidationError;
pub(crate) type ValidationRuleSchema = v1_6_validation::ValidationRule;
pub(crate) type ValidationDateTimeSchema = v1_6_validation::ValidationDateTime;
pub(crate) type ValidationNumberSchema = v1_6_validation::ValidationNumber;
pub(crate) type ValidationTextSchema = v1_6_validation::ValidationText;
pub(crate) type ValidationLogicalSchema = v1_6_validation::ValidationLogical;
pub(crate) type ValidationListSourceSchema = v1_6_validation::ValidationListSource;
pub(crate) type TextMatchSchema = v1_6_validation::TextMatch;
pub(crate) type TextCaseSchema = v1_6_validation::TextCase;
pub(crate) type DateTimeRangeSchema = v1_6_validation::DateTimeRange;
pub(crate) type NumberRangeSchema = v1_6_validation::NumberRange;

#[derive(Default, Debug, PartialEq, Serialize, Deserialize, Clone)]
pub(crate) struct GridSchema {
    pub(crate) sheets: Vec<SheetSchema>,
    pub(crate) version: Option<String>,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub(crate) struct CodeRunSchema {
    pub(crate) formatted_code_string: Option<String>,
    pub(crate) std_out: Option<String>,
    pub(crate) std_err: Option<String>,
    pub(crate) cells_accessed: Vec<SheetRectSchema>,
    pub(crate) result: CodeRunResultSchema,
    pub(crate) return_type: Option<String>,
    pub(crate) line_number: Option<u32>,
    pub(crate) output_type: Option<String>,
    pub(crate) spill_error: bool,
    pub(crate) last_modified: Option<DateTime<Utc>>,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub(crate) enum CodeRunResultSchema {
    Ok(OutputValueSchema),
    Err(RunErrorSchema),
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub(crate) enum OutputValueSchema {
    Single(CellValueSchema),
    Array(OutputArraySchema),
}

#[derive(Default, Debug, Clone, PartialEq, Serialize, Deserialize)]
pub(crate) struct OutputArraySchema {
    pub(crate) size: OutputSizeSchema,
    pub(crate) values: Vec<CellValueSchema>,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub(crate) enum CellValueSchema {
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
pub(crate) struct ColumnSchema {
    pub(crate) values: HashMap<String, CellValueSchema>,
    pub(crate) align: HashMap<String, ColumnRepeatSchema<CellAlignSchema>>,
    pub(crate) vertical_align: HashMap<String, ColumnRepeatSchema<CellVerticalAlignSchema>>,
    pub(crate) wrap: HashMap<String, ColumnRepeatSchema<CellWrapSchema>>,
    pub(crate) numeric_format: HashMap<String, ColumnRepeatSchema<NumericFormatSchema>>,
    pub(crate) numeric_decimals: HashMap<String, ColumnRepeatSchema<i16>>,
    pub(crate) numeric_commas: HashMap<String, ColumnRepeatSchema<bool>>,
    pub(crate) bold: HashMap<String, ColumnRepeatSchema<bool>>,
    pub(crate) italic: HashMap<String, ColumnRepeatSchema<bool>>,
    pub(crate) underline: HashMap<String, ColumnRepeatSchema<bool>>,
    pub(crate) strike_through: HashMap<String, ColumnRepeatSchema<bool>>,
    pub(crate) text_color: HashMap<String, ColumnRepeatSchema<String>>,
    pub(crate) fill_color: HashMap<String, ColumnRepeatSchema<String>>,
    pub(crate) render_size: HashMap<String, ColumnRepeatSchema<RenderSizeSchema>>,
    pub(crate) date_time: HashMap<String, ColumnRepeatSchema<String>>,
}

#[derive(Default, Serialize, Deserialize, Debug, Clone, PartialEq)]
pub(crate) struct RgbaSchema {
    pub(crate) red: u8,
    pub(crate) green: u8,
    pub(crate) blue: u8,
    pub(crate) alpha: u8,
}

#[derive(Default, Serialize, Deserialize, Debug, Clone, PartialEq)]
pub(crate) enum CellBorderLineSchema {
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
pub(crate) struct BorderStyleTimestampSchema {
    pub(crate) color: RgbaSchema,
    pub(crate) line: CellBorderLineSchema,
    pub(crate) timestamp: u32,
}

#[derive(Default, Debug, Serialize, Deserialize, Clone, PartialEq)]
pub(crate) struct BorderStyleCellSchema {
    pub(crate) top: Option<BorderStyleTimestampSchema>,
    pub(crate) bottom: Option<BorderStyleTimestampSchema>,
    pub(crate) left: Option<BorderStyleTimestampSchema>,
    pub(crate) right: Option<BorderStyleTimestampSchema>,
}

#[derive(Default, Serialize, Deserialize, Debug, Clone, PartialEq)]
pub(crate) struct BordersSchema {
    pub(crate) all: BorderStyleCellSchema,
    pub(crate) columns: HashMap<i64, BorderStyleCellSchema>,
    pub(crate) rows: HashMap<i64, BorderStyleCellSchema>,

    pub(crate) left: HashMap<i64, HashMap<i64, ColumnRepeatSchema<BorderStyleTimestampSchema>>>,
    pub(crate) right: HashMap<i64, HashMap<i64, ColumnRepeatSchema<BorderStyleTimestampSchema>>>,
    pub(crate) top: HashMap<i64, HashMap<i64, ColumnRepeatSchema<BorderStyleTimestampSchema>>>,
    pub(crate) bottom: HashMap<i64, HashMap<i64, ColumnRepeatSchema<BorderStyleTimestampSchema>>>,
}

#[derive(Default, Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct SheetSchema {
    pub(crate) id: IdSchema,
    pub(crate) name: String,
    pub(crate) color: Option<String>,
    pub(crate) order: String,
    pub(crate) offsets: OffsetsSchema,
    pub(crate) columns: Vec<(i64, ColumnSchema)>,
    pub(crate) code_runs: Vec<(PosSchema, CodeRunSchema)>,
    pub(crate) formats_all: Option<FormatSchema>,
    pub(crate) formats_columns: Vec<(i64, (FormatSchema, i64))>,
    pub(crate) formats_rows: Vec<(i64, (FormatSchema, i64))>,
    pub(crate) rows_resize: Vec<(i64, ResizeSchema)>,
    pub(crate) validations: ValidationsSchema,
    pub(crate) borders: BordersSchema,
}
