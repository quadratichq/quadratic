mod a1_selection_schema;
mod cells_accessed_schema;

use std::collections::HashMap;

use crate::grid::file::v1_7::schema as v1_7;

pub use a1_selection_schema::*;
pub use cells_accessed_schema::*;

use serde::{Deserialize, Serialize};
use uuid::Uuid;
pub type IdSchema = v1_7::IdSchema;
pub type PosSchema = v1_7::PosSchema;
pub type RectSchema = v1_7::RectSchema;
pub type SheetRectSchema = v1_7::SheetRectSchema;
pub type OffsetsSchema = v1_7::OffsetsSchema;
pub type RunErrorSchema = v1_7::RunErrorSchema;
pub type ResizeSchema = v1_7::ResizeSchema;
pub type CodeRunResultSchema = v1_7::CodeRunResultSchema;
pub type OutputValueSchema = v1_7::OutputValueSchema;
pub type OutputArraySchema = v1_7::OutputArraySchema;
pub type OutputSizeSchema = v1_7::OutputSizeSchema;
pub type OutputValueValueSchema = v1_7::OutputValueValueSchema;
pub type NumericFormatKindSchema = v1_7::NumericFormatKindSchema;
pub type NumericFormatSchema = v1_7::NumericFormatSchema;
pub type CellValueSchema = v1_7::CellValueSchema;
pub type CodeCellLanguageSchema = v1_7::CodeCellLanguageSchema;
pub type ConnectionKindSchema = v1_7::ConnectionKindSchema;
pub type CodeCellSchema = v1_7::CodeCellSchema;
pub type CellAlignSchema = v1_7::CellAlignSchema;
pub type CellVerticalAlignSchema = v1_7::CellVerticalAlignSchema;
pub type CellWrapSchema = v1_7::CellWrapSchema;
pub type CellBorderSchema = v1_7::CellBorderSchema;
pub type ColumnRepeatSchema<T> = v1_7::ColumnRepeatSchema<T>;
pub type RenderSizeSchema = v1_7::RenderSizeSchema;
pub type RunErrorMsgSchema = v1_7::RunErrorMsgSchema;
pub type ValidationStyleSchema = v1_7::ValidationStyleSchema;
pub type ValidationMessageSchema = v1_7::ValidationMessageSchema;
pub type ValidationErrorSchema = v1_7::ValidationErrorSchema;
pub type ValidationDateTimeSchema = v1_7::ValidationDateTimeSchema;
pub type ValidationNumberSchema = v1_7::ValidationNumberSchema;
pub type ValidationTextSchema = v1_7::ValidationTextSchema;
pub type ValidationLogicalSchema = v1_7::ValidationLogicalSchema;
pub type TextMatchSchema = v1_7::TextMatchSchema;
pub type TextCaseSchema = v1_7::TextCaseSchema;
pub type DateTimeRangeSchema = v1_7::DateTimeRangeSchema;
pub type NumberRangeSchema = v1_7::NumberRangeSchema;
pub type RgbaSchema = v1_7::RgbaSchema;
pub type CellBorderLineSchema = v1_7::CellBorderLineSchema;
pub type BorderStyleTimestampSchema = v1_7::BorderStyleTimestampSchema;
pub type BorderStyleCellSchema = v1_7::BorderStyleCellSchema;
pub type BordersSchema = v1_7::BordersSchema;

#[derive(Serialize, Deserialize, Debug, Clone, PartialEq)]
pub struct ValidationListSchema {
    pub source: ValidationListSourceSchema,
    pub ignore_blank: bool,
    pub drop_down: bool,
}

#[derive(Serialize, Deserialize, Debug, Clone, PartialEq)]
pub enum ValidationRuleSchema {
    None,
    List(ValidationListSchema),
    Logical(ValidationLogicalSchema),
    Text(ValidationTextSchema),
    Number(ValidationNumberSchema),
    DateTime(ValidationDateTimeSchema),
}

#[derive(Serialize, Deserialize, Debug, Clone, PartialEq)]
pub enum ValidationListSourceSchema {
    Selection(A1SelectionSchema),
    List(Vec<String>),
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct ValidationSchema {
    pub selection: A1SelectionSchema,
    pub id: Uuid,
    pub rule: ValidationRuleSchema,
    pub message: ValidationMessageSchema,
    pub error: ValidationErrorSchema,
}

#[derive(Default, Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct ValidationsSchema {
    pub validations: Vec<ValidationSchema>,
    pub warnings: Vec<(PosSchema, Uuid)>,
}

#[derive(Serialize, Deserialize, Debug, Clone, PartialEq)]
pub struct FormatSchema {
    #[serde(skip_serializing_if = "Option::is_none")]
    pub align: Option<CellAlignSchema>,

    #[serde(skip_serializing_if = "Option::is_none")]
    pub vertical_align: Option<CellVerticalAlignSchema>,

    #[serde(skip_serializing_if = "Option::is_none")]
    pub wrap: Option<CellWrapSchema>,

    #[serde(skip_serializing_if = "Option::is_none")]
    pub numeric_format: Option<NumericFormatSchema>,

    #[serde(skip_serializing_if = "Option::is_none")]
    pub numeric_decimals: Option<i16>,

    #[serde(skip_serializing_if = "Option::is_none")]
    pub numeric_commas: Option<bool>,

    #[serde(skip_serializing_if = "Option::is_none")]
    pub bold: Option<bool>,

    #[serde(skip_serializing_if = "Option::is_none")]
    pub italic: Option<bool>,

    #[serde(skip_serializing_if = "Option::is_none")]
    pub text_color: Option<String>,

    #[serde(skip_serializing_if = "Option::is_none")]
    pub fill_color: Option<String>,

    #[serde(skip_serializing_if = "Option::is_none")]
    pub render_size: Option<RenderSizeSchema>,

    #[serde(skip_serializing_if = "Option::is_none")]
    pub date_time: Option<String>,

    #[serde(skip_serializing_if = "Option::is_none")]
    pub underline: Option<bool>,

    #[serde(skip_serializing_if = "Option::is_none")]
    pub strike_through: Option<bool>,
}

#[derive(Serialize, Deserialize, Debug, Clone, PartialEq)]
pub struct BlockSchema<T> {
    pub start: u64,
    pub end: u64,
    pub value: T,
}

pub type SheetFormattingSchema = Vec<(u64, BlockSchema<Vec<(u64, BlockSchema<FormatSchema>)>>)>;

#[derive(Default, Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct ColumnSchema {
    pub values: HashMap<String, CellValueSchema>,
}

#[derive(Default, Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct SheetSchema {
    pub id: IdSchema,
    pub name: String,
    pub color: Option<String>,
    pub order: String,
    pub offsets: OffsetsSchema,
    pub validations: ValidationsSchema,
    pub rows_resize: Vec<(i64, ResizeSchema)>,
    pub borders: BordersSchema,
    pub formats: SheetFormattingSchema,
    pub code_runs: Vec<(PosSchema, CodeRunSchema)>,
    pub columns: Vec<(i64, ColumnSchema)>,
}

#[derive(Default, Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct GridSchema {
    pub version: String,
    pub sheets: Vec<SheetSchema>,
}
