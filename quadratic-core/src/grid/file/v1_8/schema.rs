use crate::grid::file::v1_6::schema as v1_6;
use crate::grid::file::v1_6::schema_validation as v1_6_validation;
use crate::grid::file::v1_7;
use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};

pub type IdSchema = v1_6::Id;
pub type PosSchema = v1_6::Pos;
pub type RectSchema = v1_6::Rect;
pub type SheetRectSchema = v1_6::SheetRect;
pub type OffsetsSchema = v1_6::Offsets;
pub type RunErrorSchema = v1_7::run_error_schema::RunErrorSchema;
pub type FormatSchema = v1_6::Format;
pub type ValidationsSchema = v1_6_validation::Validations;
pub type ResizeSchema = v1_6::Resize;
pub type CodeRunResultSchema = v1_6::CodeRunResult;
pub type OutputValueSchema = v1_7::schema::OutputValueSchema;
pub type OutputArraySchema = v1_7::schema::OutputArraySchema;
pub type OutputSizeSchema = v1_7::schema::OutputSizeSchema;
pub type OutputValueValueSchema = v1_6::OutputValueValue;
pub type ColumnSchema = v1_7::schema::ColumnSchema;
pub type NumericFormatKindSchema = v1_6::NumericFormatKind;
pub type NumericFormatSchema = v1_6::NumericFormat;
pub type CellValueSchema = v1_7::schema::CellValueSchema;
pub type CodeCellLanguage = v1_6::CodeCellLanguage;
pub type ConnectionKindSchema = v1_6::ConnectionKind;
pub type CodeCellSchema = v1_6::CodeCell;
pub type CellAlignSchema = v1_6::CellAlign;
pub type CellVerticalAlignSchema = v1_6::CellVerticalAlign;
pub type CellWrapSchema = v1_6::CellWrap;
pub type CellBorderSchema = v1_6::CellBorder;
pub type ColumnRepeatSchema<T> = v1_6::ColumnRepeat<T>;
pub type RenderSizeSchema = v1_6::RenderSize;
pub type RunErrorMsgSchema = v1_7::run_error_schema::RunErrorMsgSchema;
pub type AxisSchema = v1_7::schema::AxisSchema;
pub type SpanSchema = v1_7::schema::SpanSchema;
pub type ImportSchema = v1_7::schema::Import;
pub type BordersSchema = v1_7::schema::BordersSchema;
pub type BorderStyleCellSchema = v1_7::schema::BorderStyleCellSchema;
pub type BorderStyleTimestampSchema = v1_7::schema::BorderStyleTimestampSchema;
pub type CellBorderLineSchema = v1_7::schema::CellBorderLineSchema;
pub type RgbaSchema = v1_7::schema::RgbaSchema;
pub type BorderStyleCell = v1_7::schema::BorderStyleCellSchema;

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
pub type ValidationListSchema = v1_6_validation::ValidationList;
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

#[derive(Default, Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct SheetSchema {
    pub id: IdSchema,
    pub name: String,
    pub color: Option<String>,
    pub order: String,
    pub offsets: OffsetsSchema,
    pub columns: Vec<(i64, ColumnSchema)>,
    pub data_tables: Vec<(PosSchema, DataTableSchema)>,
    pub formats_all: Option<FormatSchema>,
    pub formats_columns: Vec<(i64, (FormatSchema, i64))>,
    pub formats_rows: Vec<(i64, (FormatSchema, i64))>,
    pub rows_resize: Vec<(i64, ResizeSchema)>,
    pub validations: ValidationsSchema,
    pub borders: BordersSchema,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct CodeRunSchema {
    pub formatted_code_string: Option<String>,
    pub std_out: Option<String>,
    pub std_err: Option<String>,
    pub cells_accessed: Vec<SheetRectSchema>,
    pub error: Option<RunErrorSchema>,
    pub return_type: Option<String>,
    pub line_number: Option<u32>,
    pub output_type: Option<String>,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct DataTableColumnSchema {
    pub name: String,
    pub display: bool,
    pub value_index: u32,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub enum DataTableKindSchema {
    CodeRun(CodeRunSchema),
    Import(ImportSchema),
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct DataTableSchema {
    pub kind: DataTableKindSchema,
    pub name: String,
    pub columns: Option<Vec<DataTableColumnSchema>>,
    pub display_buffer: Option<Vec<u64>>,
    pub value: OutputValueSchema,
    pub readonly: bool,
    pub spill_error: bool,
    pub last_modified: Option<DateTime<Utc>>,
}

impl From<i8> for AxisSchema {
    fn from(val: i8) -> Self {
        match val {
            0 => AxisSchema::X,
            1 => AxisSchema::Y,
            _ => panic!("Invalid Axis value: {}", val),
        }
    }
}

impl From<AxisSchema> for i8 {
    fn from(val: AxisSchema) -> Self {
        match val {
            AxisSchema::X => 0,
            AxisSchema::Y => 1,
        }
    }
}
