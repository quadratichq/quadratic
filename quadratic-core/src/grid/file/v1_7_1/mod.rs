mod a1_selection_schema;
mod borders_a1_schema;
mod cells_accessed_schema;
mod contiguous_2d_schema;
mod sheet_formatting_schema;
mod sheet_offsets;
mod upgrade;
mod validations_schema;

pub use a1_selection_schema::*;
pub use borders_a1_schema::*;
pub use cells_accessed_schema::*;
pub use contiguous_2d_schema::*;
pub use sheet_formatting_schema::*;
pub use upgrade::*;
pub use validations_schema::*;

use crate::grid::file::v1_7::schema as v1_7;

use serde::{Deserialize, Serialize};

pub type IdSchema = v1_7::IdSchema;
pub type PosSchema = v1_7::PosSchema;
pub type RectSchema = v1_7::RectSchema;
pub type SheetRectSchema = v1_7::SheetRectSchema;
pub type OffsetsSchema = v1_7::OffsetsSchema;
pub type RunErrorSchema = v1_7::RunErrorSchema;
pub type ResizeSchema = v1_7::ResizeSchema;
pub type CodeRunResultSchema = v1_7::CodeRunResultSchema;
pub type OutputValueSchema = v1_7::OutputValueSchema;
pub type OutputSizeSchema = v1_7::OutputSizeSchema;
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
pub type AxisSchema = v1_7::AxisSchema;
pub type SpanSchema = v1_7::SpanSchema;

pub type RowsResizeSchema = Vec<(i64, ResizeSchema)>;

pub type CodeRunsSchema = Vec<(PosSchema, CodeRunSchema)>;

pub type ColumnSchema = Vec<(i64, CellValueSchema)>;

pub type ColumnsSchema = Vec<(i64, ColumnSchema)>;

#[derive(Serialize, Deserialize, Default, Debug, Clone, PartialEq)]
pub struct SheetSchema {
    pub id: IdSchema,
    pub name: String,
    pub color: Option<String>,
    pub order: String,
    pub offsets: OffsetsSchema,
    pub validations: ValidationsSchema,
    pub rows_resize: RowsResizeSchema,
    pub borders: BordersSchema,
    pub formats: SheetFormattingSchema,
    pub code_runs: CodeRunsSchema,
    pub columns: ColumnsSchema,
}

#[derive(Serialize, Deserialize, Default, Debug, Clone, PartialEq)]
pub struct GridSchema {
    pub version: String,
    pub sheets: Vec<SheetSchema>,
}
