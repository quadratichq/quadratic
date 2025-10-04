use crate::grid::file::v1_8;
use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};

pub(crate) type A1SelectionSchema = v1_8::A1SelectionSchema;
pub(crate) type AxisSchema = v1_8::AxisSchema;
pub(crate) type BlockSchema<T> = v1_8::BlockSchema<T>;
pub(crate) type BordersSchema = v1_8::BordersSchema;
pub(crate) type BordersSideSchema = v1_8::BordersSideSchema;
pub(crate) type BorderStyleTimestampSchema = v1_8::BorderStyleTimestampSchema;
pub(crate) type CellAlignSchema = v1_8::CellAlignSchema;
pub(crate) type CellBorderLineSchema = v1_8::CellBorderLineSchema;
pub(crate) type CellRefCoordSchema = v1_8::CellRefCoordSchema;
pub(crate) type CellRefRangeEndSchema = v1_8::CellRefRangeEndSchema;
pub(crate) type CellRefRangeSchema = v1_8::CellRefRangeSchema;
pub(crate) type CellsAccessedSchema = v1_8::CellsAccessedSchema;
pub(crate) type CellValueSchema = v1_8::CellValueSchema;
pub(crate) type CellVerticalAlignSchema = v1_8::CellVerticalAlignSchema;
pub(crate) type CellWrapSchema = v1_8::CellWrapSchema;
pub(crate) type CodeCellLanguageSchema = v1_8::CodeCellLanguageSchema;
pub(crate) type ColRangeSchema = v1_8::ColRangeSchema;
pub(crate) type ColumnSchema = v1_8::ColumnSchema;
pub(crate) type ColumnsSchema = v1_8::ColumnsSchema;
pub(crate) type ConnectionKindSchema = v1_8::ConnectionKindSchema;
pub(crate) type Contiguous2DSchema<T> = v1_8::Contiguous2DSchema<T>;
pub(crate) type DataTableColumnSchema = v1_8::DataTableColumnSchema;
pub(crate) type DataTableSortOrderSchema = v1_8::DataTableSortOrderSchema;
pub(crate) type DateTimeRangeSchema = v1_8::DateTimeRangeSchema;
pub(crate) type IdSchema = v1_8::IdSchema;
pub(crate) type ImportSchema = v1_8::ImportSchema;
pub(crate) type NumberRangeSchema = v1_8::NumberRangeSchema;
pub(crate) type NumericFormatKindSchema = v1_8::NumericFormatKindSchema;
pub(crate) type NumericFormatSchema = v1_8::NumericFormatSchema;
pub(crate) type OffsetsSchema = v1_8::OffsetsSchema;
pub(crate) type OutputArraySchema = v1_8::OutputArraySchema;
pub(crate) type OutputSizeSchema = v1_8::OutputSizeSchema;
pub(crate) type OutputValueSchema = v1_8::OutputValueSchema;
pub(crate) type PosSchema = v1_8::PosSchema;
pub(crate) type RefRangeBoundsSchema = v1_8::RefRangeBoundsSchema;
pub(crate) type RenderSizeSchema = v1_8::RenderSizeSchema;
pub(crate) type ResizeSchema = v1_8::ResizeSchema;
pub(crate) type RgbaSchema = v1_8::RgbaSchema;
pub(crate) type RowsResizeSchema = v1_8::RowsResizeSchema;
pub(crate) type RowsResizesSchema = v1_8::RowsResizesSchema;
pub(crate) type RunErrorMsgSchema = v1_8::RunErrorMsgSchema;
pub(crate) type RunErrorSchema = v1_8::RunErrorSchema;
pub(crate) type SheetFormattingSchema = v1_8::SheetFormattingSchema;
pub(crate) type SortDirectionSchema = v1_8::SortDirectionSchema;
pub(crate) type SpanSchema = v1_8::SpanSchema;
pub(crate) type TableRefSchema = v1_8::TableRefSchema;
pub(crate) type TextCaseSchema = v1_8::TextCaseSchema;
pub(crate) type TextMatchSchema = v1_8::TextMatchSchema;
pub(crate) type ValidationDateTimeSchema = v1_8::ValidationDateTimeSchema;
pub(crate) type ValidationErrorSchema = v1_8::ValidationErrorSchema;
pub(crate) type ValidationListSchema = v1_8::ValidationListSchema;
pub(crate) type ValidationListSourceSchema = v1_8::ValidationListSourceSchema;
pub(crate) type ValidationLogicalSchema = v1_8::ValidationLogicalSchema;
pub(crate) type ValidationMessageSchema = v1_8::ValidationMessageSchema;
pub(crate) type ValidationNumberSchema = v1_8::ValidationNumberSchema;
pub(crate) type ValidationRuleSchema = v1_8::ValidationRuleSchema;
pub(crate) type ValidationSchema = v1_8::ValidationSchema;
pub(crate) type ValidationStyleSchema = v1_8::ValidationStyleSchema;
pub(crate) type ValidationTextSchema = v1_8::ValidationTextSchema;
pub(crate) type ValidationsSchema = v1_8::ValidationsSchema;

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub(crate) struct CodeRunSchema {
    pub(crate) language: CodeCellLanguageSchema,
    pub(crate) code: String,
    pub(crate) std_out: Option<String>,
    pub(crate) std_err: Option<String>,
    pub(crate) cells_accessed: CellsAccessedSchema,
    pub(crate) error: Option<RunErrorSchema>,
    pub(crate) return_type: Option<String>,
    pub(crate) line_number: Option<u32>,
    pub(crate) output_type: Option<String>,
}

#[allow(clippy::large_enum_variant)]
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub(crate) enum DataTableKindSchema {
    CodeRun(CodeRunSchema),
    Import(ImportSchema),
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub(crate) struct DataTableSchema {
    pub(crate) kind: DataTableKindSchema,
    pub(crate) name: String,
    pub(crate) header_is_first_row: bool,
    pub(crate) show_name: Option<bool>,
    pub(crate) show_columns: Option<bool>,
    pub(crate) columns: Option<Vec<DataTableColumnSchema>>,
    pub(crate) sort: Option<Vec<DataTableSortOrderSchema>>,
    pub(crate) sort_dirty: bool,
    pub(crate) display_buffer: Option<Vec<u64>>,
    pub(crate) value: OutputValueSchema,
    pub(crate) spill_error: bool,
    pub(crate) last_modified: Option<DateTime<Utc>>,
    pub(crate) alternating_colors: bool,
    pub(crate) formats: SheetFormattingSchema,
    pub(crate) borders: BordersSchema,
    pub(crate) chart_pixel_output: Option<(f32, f32)>,
    pub(crate) chart_output: Option<(u32, u32)>,
}

pub(crate) type DataTablesSchema = Vec<(PosSchema, DataTableSchema)>;

#[derive(Default, Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct SheetSchema {
    pub(crate) id: IdSchema,
    pub(crate) name: String,
    pub(crate) color: Option<String>,
    pub(crate) order: String,
    pub(crate) offsets: OffsetsSchema,
    pub(crate) validations: ValidationsSchema,
    pub(crate) columns: ColumnsSchema,
    pub(crate) data_tables: DataTablesSchema,
    pub(crate) rows_resize: RowsResizesSchema,
    pub(crate) borders: BordersSchema,
    pub(crate) formats: SheetFormattingSchema,
}

#[derive(Default, Debug, PartialEq, Serialize, Deserialize, Clone)]
pub(crate) struct GridSchema {
    pub(crate) sheets: Vec<SheetSchema>,
    pub(crate) version: Option<String>,
}
