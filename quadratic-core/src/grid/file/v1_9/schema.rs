#![allow(dead_code)] // necessary because old schema may not be used anymore

use crate::grid::file::v1_8;
use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};

pub type A1SelectionSchema = v1_8::A1SelectionSchema;
pub type AxisSchema = v1_8::AxisSchema;
pub type BlockSchema<T> = v1_8::BlockSchema<T>;
pub type BordersSchema = v1_8::BordersSchema;
pub type BordersSideSchema = v1_8::BordersSideSchema;
pub type BorderStyleCellSchema = v1_8::BorderStyleCellSchema;
pub type BorderStyleTimestampSchema = v1_8::BorderStyleTimestampSchema;
pub type CellAlignSchema = v1_8::CellAlignSchema;
pub type CellBorderLineSchema = v1_8::CellBorderLineSchema;
pub type CellBorderSchema = v1_8::CellBorderSchema;
pub type CellRefCoordSchema = v1_8::CellRefCoordSchema;
pub type CellRefRangeEndSchema = v1_8::CellRefRangeEndSchema;
pub type CellRefRangeSchema = v1_8::CellRefRangeSchema;
pub type CellsAccessedSchema = v1_8::CellsAccessedSchema;
pub type CellValueSchema = v1_8::CellValueSchema;
pub type CellVerticalAlignSchema = v1_8::CellVerticalAlignSchema;
pub type CellWrapSchema = v1_8::CellWrapSchema;
pub type CodeCellLanguageSchema = v1_8::CodeCellLanguageSchema;
pub type CodeCellSchema = v1_8::CodeCellSchema;
pub type CodeRunResultSchema = v1_8::CodeRunResultSchema;
pub type ColRangeSchema = v1_8::ColRangeSchema;
pub type ColumnRepeatSchema<T> = v1_8::ColumnRepeatSchema<T>;
pub type ColumnSchema = v1_8::ColumnSchema;
pub type ColumnsSchema = v1_8::ColumnsSchema;
pub type ConnectionKindSchema = v1_8::ConnectionKindSchema;
pub type Contiguous2DSchema<T> = v1_8::Contiguous2DSchema<T>;
pub type DataTableColumnSchema = v1_8::DataTableColumnSchema;
pub type DataTableSortOrderSchema = v1_8::DataTableSortOrderSchema;
pub type DateTimeRangeSchema = v1_8::DateTimeRangeSchema;
pub type FormatSchema = v1_8::FormatSchema;
pub type IdSchema = v1_8::IdSchema;
pub type ImportSchema = v1_8::ImportSchema;
pub type NumberRangeSchema = v1_8::NumberRangeSchema;
pub type NumericFormatKindSchema = v1_8::NumericFormatKindSchema;
pub type NumericFormatSchema = v1_8::NumericFormatSchema;
pub type OffsetsSchema = v1_8::OffsetsSchema;
pub type OutputArraySchema = v1_8::OutputArraySchema;
pub type OutputSizeSchema = v1_8::OutputSizeSchema;
pub type OutputValueSchema = v1_8::OutputValueSchema;
pub type PosSchema = v1_8::PosSchema;
pub type RectSchema = v1_8::RectSchema;
pub type RefRangeBoundsSchema = v1_8::RefRangeBoundsSchema;
pub type RenderSizeSchema = v1_8::RenderSizeSchema;
pub type ResizeSchema = v1_8::ResizeSchema;
pub type RgbaSchema = v1_8::RgbaSchema;
pub type RowsResizeSchema = v1_8::RowsResizeSchema;
pub type RowsResizesSchema = v1_8::RowsResizesSchema;
pub type RunErrorMsgSchema = v1_8::RunErrorMsgSchema;
pub type RunErrorSchema = v1_8::RunErrorSchema;
pub type SheetFormattingSchema = v1_8::SheetFormattingSchema;
pub type SheetRectSchema = v1_8::SheetRectSchema;
pub type SortDirectionSchema = v1_8::SortDirectionSchema;
pub type SpanSchema = v1_8::SpanSchema;
pub type TableFormatsSchema = v1_8::TableFormatsSchema;
pub type TableRefSchema = v1_8::TableRefSchema;
pub type TextCaseSchema = v1_8::TextCaseSchema;
pub type TextMatchSchema = v1_8::TextMatchSchema;
pub type ValidationDateTimeSchema = v1_8::ValidationDateTimeSchema;
pub type ValidationErrorSchema = v1_8::ValidationErrorSchema;
pub type ValidationListSchema = v1_8::ValidationListSchema;
pub type ValidationListSourceSchema = v1_8::ValidationListSourceSchema;
pub type ValidationLogicalSchema = v1_8::ValidationLogicalSchema;
pub type ValidationMessageSchema = v1_8::ValidationMessageSchema;
pub type ValidationNumberSchema = v1_8::ValidationNumberSchema;
pub type ValidationRuleSchema = v1_8::ValidationRuleSchema;
pub type ValidationSchema = v1_8::ValidationSchema;
pub type ValidationStyleSchema = v1_8::ValidationStyleSchema;
pub type ValidationTextSchema = v1_8::ValidationTextSchema;
pub type ValidationsSchema = v1_8::ValidationsSchema;

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct CodeRunSchema {
    pub language: CodeCellLanguageSchema,
    pub code: String,
    pub std_out: Option<String>,
    pub std_err: Option<String>,
    pub cells_accessed: CellsAccessedSchema,
    pub error: Option<RunErrorSchema>,
    pub return_type: Option<String>,
    pub line_number: Option<u32>,
    pub output_type: Option<String>,
}

#[allow(clippy::large_enum_variant)]
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub enum DataTableKindSchema {
    CodeRun(CodeRunSchema),
    Import(ImportSchema),
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct DataTableSchema {
    pub kind: DataTableKindSchema,
    pub name: String,
    pub header_is_first_row: bool,
    pub show_name: Option<bool>,
    pub show_columns: Option<bool>,
    pub columns: Option<Vec<DataTableColumnSchema>>,
    pub sort: Option<Vec<DataTableSortOrderSchema>>,
    pub sort_dirty: bool,
    pub display_buffer: Option<Vec<u64>>,
    pub value: OutputValueSchema,
    pub spill_error: bool,
    pub last_modified: Option<DateTime<Utc>>,
    pub alternating_colors: bool,
    pub formats: SheetFormattingSchema,
    pub borders: BordersSchema,
    pub chart_pixel_output: Option<(f32, f32)>,
    pub chart_output: Option<(u32, u32)>,
}

pub type DataTablesSchema = Vec<(PosSchema, DataTableSchema)>;

#[derive(Default, Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct SheetSchema {
    pub id: IdSchema,
    pub name: String,
    pub color: Option<String>,
    pub order: String,
    pub offsets: OffsetsSchema,
    pub validations: ValidationsSchema,
    pub columns: ColumnsSchema,
    pub data_tables: DataTablesSchema,
    pub rows_resize: RowsResizesSchema,
    pub borders: BordersSchema,
    pub formats: SheetFormattingSchema,
}

#[derive(Default, Debug, PartialEq, Serialize, Deserialize, Clone)]
pub struct GridSchema {
    pub sheets: Vec<SheetSchema>,
    pub version: Option<String>,
}
