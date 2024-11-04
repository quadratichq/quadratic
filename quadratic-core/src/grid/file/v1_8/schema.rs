use std::collections::HashMap;

use crate::grid::file::v1_7;
use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};

pub type IdSchema = v1_7::IdSchema;
pub type PosSchema = v1_7::PosSchema;
pub type RectSchema = v1_7::RectSchema;
pub type SheetRectSchema = v1_7::SheetRectSchema;
pub type OffsetsSchema = v1_7::OffsetsSchema;
pub type RunErrorSchema = v1_7::run_error_schema::RunErrorSchema;
pub type FormatSchema = v1_7::FormatSchema;
pub type ValidationsSchema = v1_7::ValidationsSchema;
pub type ResizeSchema = v1_7::ResizeSchema;
pub type CodeRunResultSchema = v1_7::CodeRunResultSchema;
pub type OutputValueSchema = v1_7::schema::OutputValueSchema;
pub type OutputArraySchema = v1_7::schema::OutputArraySchema;
pub type OutputSizeSchema = v1_7::schema::OutputSizeSchema;
pub type OutputValueValueSchema = v1_7::OutputValueValueSchema;
pub type ColumnSchema = v1_7::schema::ColumnSchema;
pub type NumericFormatKindSchema = v1_7::NumericFormatKindSchema;
pub type NumericFormatSchema = v1_7::NumericFormatSchema;
pub type CellValueSchema = v1_7::schema::CellValueSchema;
pub type CodeCellLanguage = v1_7::CodeCellLanguageSchema;
pub type ConnectionKindSchema = v1_7::ConnectionKindSchema;
pub type CodeCellSchema = v1_7::CodeCellSchema;
pub type CellAlignSchema = v1_7::CellAlignSchema;
pub type CellVerticalAlignSchema = v1_7::CellVerticalAlignSchema;
pub type CellWrapSchema = v1_7::CellWrapSchema;
pub type CellBorderSchema = v1_7::CellBorderSchema;
pub type ColumnRepeatSchema<T> = v1_7::ColumnRepeatSchema<T>;
pub type RenderSizeSchema = v1_7::RenderSizeSchema;
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
pub type SelectionSchema = v1_7::SelectionSchema;
pub type ValidationSchema = v1_7::ValidationSchema;
pub type ValidationStyleSchema = v1_7::ValidationStyleSchema;
pub type ValidationMessageSchema = v1_7::ValidationMessageSchema;
pub type ValidationErrorSchema = v1_7::ValidationErrorSchema;
pub type ValidationRuleSchema = v1_7::ValidationRuleSchema;
pub type ValidationDateTimeSchema = v1_7::ValidationDateTimeSchema;
pub type ValidationNumberSchema = v1_7::ValidationNumberSchema;
pub type ValidationTextSchema = v1_7::ValidationTextSchema;
pub type ValidationLogicalSchema = v1_7::ValidationLogicalSchema;
pub type ValidationListSchema = v1_7::ValidationListSchema;
pub type ValidationListSourceSchema = v1_7::ValidationListSourceSchema;
pub type TextMatchSchema = v1_7::TextMatchSchema;
pub type TextCaseSchema = v1_7::TextCaseSchema;
pub type DateTimeRangeSchema = v1_7::DateTimeRangeSchema;
pub type NumberRangeSchema = v1_7::NumberRangeSchema;

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
    pub name: CellValueSchema,
    pub display: bool,
    pub value_index: u32,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub enum DataTableKindSchema {
    CodeRun(CodeRunSchema),
    Import(ImportSchema),
}

#[derive(Serialize, Deserialize, Debug, Clone, PartialEq)]
pub enum SortDirectionSchema {
    Ascending,
    Descending,
    None,
}

#[derive(Serialize, Deserialize, Debug, Clone, PartialEq)]
pub struct DataTableSortOrderSchema {
    pub column_index: usize,
    pub direction: SortDirectionSchema,
}

#[derive(Default, Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct TableFormatsSchema {
    pub table: Option<FormatSchema>,
    pub columns: HashMap<i64, FormatSchema>,
    pub cells: HashMap<i64, HashMap<i64, ColumnRepeatSchema<FormatSchema>>>,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct DataTableSchema {
    pub kind: DataTableKindSchema,
    pub name: String,
    pub header_is_first_row: bool,
    pub show_header: bool,
    pub columns: Option<Vec<DataTableColumnSchema>>,
    pub sort: Option<Vec<DataTableSortOrderSchema>>,
    pub display_buffer: Option<Vec<u64>>,
    pub value: OutputValueSchema,
    pub readonly: bool,
    pub spill_error: bool,
    pub last_modified: Option<DateTime<Utc>>,
    pub alternating_colors: bool,
    pub formats: TableFormatsSchema,
    pub chart_output: Option<(u32, u32)>,
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
