mod a1_selection_schema;
mod borders_a1_schema;
mod cells_accessed_schema;
mod contiguous_2d_schema;
mod sheet_formatting_schema;
mod sheet_offsets;
mod upgrade;
mod validations_schema;

pub(crate) use a1_selection_schema::*;
pub(crate) use borders_a1_schema::*;
pub(crate) use cells_accessed_schema::*;
pub(crate) use contiguous_2d_schema::*;
pub(crate) use sheet_formatting_schema::*;
pub(crate) use upgrade::*;
pub(crate) use validations_schema::*;

use crate::grid::file::v1_7::schema as v1_7;

use serde::{Deserialize, Serialize};

pub(crate) type IdSchema = v1_7::IdSchema;
pub(crate) type PosSchema = v1_7::PosSchema;
pub(crate) type OffsetsSchema = v1_7::OffsetsSchema;
pub(crate) type RunErrorSchema = v1_7::RunErrorSchema;
pub(crate) type ResizeSchema = v1_7::ResizeSchema;
pub(crate) type CodeRunResultSchema = v1_7::CodeRunResultSchema;
pub(crate) type OutputValueSchema = v1_7::OutputValueSchema;
pub(crate) type OutputSizeSchema = v1_7::OutputSizeSchema;
pub(crate) type NumericFormatKindSchema = v1_7::NumericFormatKindSchema;
pub(crate) type NumericFormatSchema = v1_7::NumericFormatSchema;
pub(crate) type CellValueSchema = v1_7::CellValueSchema;
pub(crate) type CodeCellLanguageSchema = v1_7::CodeCellLanguageSchema;
pub(crate) type ConnectionKindSchema = v1_7::ConnectionKindSchema;
pub(crate) type CodeCellSchema = v1_7::CodeCellSchema;
pub(crate) type CellAlignSchema = v1_7::CellAlignSchema;
pub(crate) type CellVerticalAlignSchema = v1_7::CellVerticalAlignSchema;
pub(crate) type CellWrapSchema = v1_7::CellWrapSchema;
pub(crate) type RenderSizeSchema = v1_7::RenderSizeSchema;
pub(crate) type RunErrorMsgSchema = v1_7::RunErrorMsgSchema;
pub(crate) type ValidationStyleSchema = v1_7::ValidationStyleSchema;
pub(crate) type ValidationMessageSchema = v1_7::ValidationMessageSchema;
pub(crate) type ValidationErrorSchema = v1_7::ValidationErrorSchema;
pub(crate) type ValidationDateTimeSchema = v1_7::ValidationDateTimeSchema;
pub(crate) type ValidationNumberSchema = v1_7::ValidationNumberSchema;
pub(crate) type ValidationTextSchema = v1_7::ValidationTextSchema;
pub(crate) type ValidationLogicalSchema = v1_7::ValidationLogicalSchema;
pub(crate) type TextMatchSchema = v1_7::TextMatchSchema;
pub(crate) type TextCaseSchema = v1_7::TextCaseSchema;
pub(crate) type DateTimeRangeSchema = v1_7::DateTimeRangeSchema;
pub(crate) type NumberRangeSchema = v1_7::NumberRangeSchema;
pub(crate) type RgbaSchema = v1_7::RgbaSchema;
pub(crate) type CellBorderLineSchema = v1_7::CellBorderLineSchema;
pub(crate) type BorderStyleTimestampSchema = v1_7::BorderStyleTimestampSchema;
pub(crate) type AxisSchema = v1_7::AxisSchema;
pub(crate) type SpanSchema = v1_7::SpanSchema;
pub(crate) type RowsResizeSchema = Vec<(i64, ResizeSchema)>;
pub(crate) type CodeRunsSchema = Vec<(PosSchema, CodeRunSchema)>;
pub(crate) type ColumnSchema = Vec<(i64, CellValueSchema)>;
pub(crate) type ColumnsSchema = Vec<(i64, ColumnSchema)>;

#[derive(Serialize, Deserialize, Default, Debug, Clone, PartialEq)]
pub struct SheetSchema {
    pub(crate) id: IdSchema,
    pub(crate) name: String,
    pub(crate) color: Option<String>,
    pub(crate) order: String,
    pub(crate) offsets: OffsetsSchema,
    pub(crate) validations: ValidationsSchema,
    pub(crate) rows_resize: RowsResizeSchema,
    pub(crate) borders: BordersSchema,
    pub(crate) formats: SheetFormattingSchema,
    pub(crate) code_runs: CodeRunsSchema,
    pub(crate) columns: ColumnsSchema,
}

#[derive(Serialize, Deserialize, Default, Debug, Clone, PartialEq)]
pub(crate) struct GridSchema {
    pub(crate) version: String,
    pub(crate) sheets: Vec<SheetSchema>,
}
