use crate::grid::file::v1_9;
use crate::util::is_false;
use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};

pub(crate) type A1SelectionSchema = v1_9::A1SelectionSchema;
pub(crate) type AxisSchema = v1_9::AxisSchema;
pub(crate) type BlockSchema<T> = v1_9::BlockSchema<T>;
pub(crate) type BordersSchema = v1_9::BordersSchema;
pub(crate) type BordersSideSchema = v1_9::BordersSideSchema;
pub(crate) type BorderStyleTimestampSchema = v1_9::BorderStyleTimestampSchema;
pub(crate) type CellAlignSchema = v1_9::CellAlignSchema;
pub(crate) type CellBorderLineSchema = v1_9::CellBorderLineSchema;
pub(crate) type CellRefCoordSchema = v1_9::CellRefCoordSchema;
pub(crate) type CellRefRangeEndSchema = v1_9::CellRefRangeEndSchema;
pub(crate) type CellRefRangeSchema = v1_9::CellRefRangeSchema;
pub(crate) type CellValueSchema = v1_9::CellValueSchema;
pub(crate) type CellVerticalAlignSchema = v1_9::CellVerticalAlignSchema;
pub(crate) type CellWrapSchema = v1_9::CellWrapSchema;
pub(crate) type CodeCellLanguageSchema = v1_9::CodeCellLanguageSchema;
pub(crate) type CodeRunSchema = v1_9::CodeRunSchema;
pub(crate) type ColRangeSchema = v1_9::ColRangeSchema;
pub(crate) type ColumnSchema = v1_9::ColumnSchema;
pub(crate) type ColumnsSchema = v1_9::ColumnsSchema;
pub(crate) type ConnectionKindSchema = v1_9::ConnectionKindSchema;
pub(crate) type Contiguous2DSchema<T> = v1_9::Contiguous2DSchema<T>;
pub(crate) type DataTableColumnSchema = v1_9::DataTableColumnSchema;
pub(crate) type DataTableKindSchema = v1_9::DataTableKindSchema;
pub(crate) type DataTableSortOrderSchema = v1_9::DataTableSortOrderSchema;
pub(crate) type DateTimeRangeSchema = v1_9::DateTimeRangeSchema;
pub(crate) type IdSchema = v1_9::IdSchema;
pub(crate) type ImportSchema = v1_9::ImportSchema;
pub(crate) type NumberRangeSchema = v1_9::NumberRangeSchema;
pub(crate) type NumericFormatKindSchema = v1_9::NumericFormatKindSchema;
pub(crate) type NumericFormatSchema = v1_9::NumericFormatSchema;
pub(crate) type OffsetsSchema = v1_9::OffsetsSchema;
pub(crate) type OutputArraySchema = v1_9::OutputArraySchema;
pub(crate) type OutputSizeSchema = v1_9::OutputSizeSchema;
pub(crate) type OutputValueSchema = v1_9::OutputValueSchema;
pub(crate) type PosSchema = v1_9::PosSchema;
pub(crate) type RefRangeBoundsSchema = v1_9::RefRangeBoundsSchema;
pub(crate) type RenderSizeSchema = v1_9::RenderSizeSchema;
pub(crate) type ResizeSchema = v1_9::ResizeSchema;
pub(crate) type RgbaSchema = v1_9::RgbaSchema;
pub(crate) type RowsResizeSchema = v1_9::RowsResizeSchema;
pub(crate) type RowsResizesSchema = v1_9::RowsResizesSchema;
pub(crate) type RunErrorMsgSchema = v1_9::RunErrorMsgSchema;
pub(crate) type RunErrorSchema = v1_9::RunErrorSchema;
pub(crate) type SheetFormattingSchema = v1_9::SheetFormattingSchema;
pub(crate) type SortDirectionSchema = v1_9::SortDirectionSchema;
pub(crate) type SpanSchema = v1_9::SpanSchema;
pub(crate) type TableRefSchema = v1_9::TableRefSchema;
pub(crate) type TextCaseSchema = v1_9::TextCaseSchema;
pub(crate) type TextMatchSchema = v1_9::TextMatchSchema;
pub(crate) type ValidationDateTimeSchema = v1_9::ValidationDateTimeSchema;
pub(crate) type ValidationErrorSchema = v1_9::ValidationErrorSchema;
pub(crate) type ValidationListSchema = v1_9::ValidationListSchema;
pub(crate) type ValidationListSourceSchema = v1_9::ValidationListSourceSchema;
pub(crate) type ValidationLogicalSchema = v1_9::ValidationLogicalSchema;
pub(crate) type ValidationMessageSchema = v1_9::ValidationMessageSchema;
pub(crate) type ValidationNumberSchema = v1_9::ValidationNumberSchema;
pub(crate) type ValidationRuleSchema = v1_9::ValidationRuleSchema;
pub(crate) type ValidationSchema = v1_9::ValidationSchema;
pub(crate) type ValidationStyleSchema = v1_9::ValidationStyleSchema;
pub(crate) type ValidationTextSchema = v1_9::ValidationTextSchema;
pub(crate) type ValidationsSchema = v1_9::ValidationsSchema;

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub(crate) struct DataTableSchema {
    pub(crate) kind: DataTableKindSchema,

    pub(crate) name: String,

    pub(crate) value: OutputValueSchema,

    #[serde(skip_serializing_if = "Option::is_none", default)]
    pub(crate) last_modified: Option<DateTime<Utc>>,

    #[serde(skip_serializing_if = "is_false", default)]
    pub(crate) header_is_first_row: bool,

    #[serde(skip_serializing_if = "Option::is_none", default)]
    pub(crate) show_name: Option<bool>,

    #[serde(skip_serializing_if = "Option::is_none", default)]
    pub(crate) show_columns: Option<bool>,

    #[serde(skip_serializing_if = "Option::is_none", default)]
    pub(crate) columns: Option<Vec<DataTableColumnSchema>>,

    #[serde(skip_serializing_if = "Option::is_none", default)]
    pub(crate) sort: Option<Vec<DataTableSortOrderSchema>>,

    #[serde(skip_serializing_if = "is_false", default)]
    pub(crate) sort_dirty: bool,

    #[serde(skip_serializing_if = "Option::is_none", default)]
    pub(crate) display_buffer: Option<Vec<u64>>,

    #[serde(skip_serializing_if = "is_false", default)]
    pub(crate) spill_value: bool,

    #[serde(skip_serializing_if = "is_false", default)]
    pub(crate) spill_data_table: bool,

    #[serde(skip_serializing_if = "is_false", default)]
    pub(crate) alternating_colors: bool,

    #[serde(skip_serializing_if = "Option::is_none", default)]
    pub(crate) formats: Option<SheetFormattingSchema>,

    #[serde(skip_serializing_if = "Option::is_none", default)]
    pub(crate) borders: Option<BordersSchema>,

    #[serde(skip_serializing_if = "Option::is_none", default)]
    pub(crate) chart_pixel_output: Option<(f32, f32)>,

    #[serde(skip_serializing_if = "Option::is_none", default)]
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
