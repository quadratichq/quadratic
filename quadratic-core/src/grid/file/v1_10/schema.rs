#![allow(dead_code)] // necessary because old schema may not be used anymore

use crate::grid::file::v1_9;
use crate::util::is_false;
use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};

pub type A1SelectionSchema = v1_9::A1SelectionSchema;
pub type AxisSchema = v1_9::AxisSchema;
pub type BlockSchema<T> = v1_9::BlockSchema<T>;
pub type BordersSchema = v1_9::BordersSchema;
pub type BordersSideSchema = v1_9::BordersSideSchema;
pub type BorderStyleCellSchema = v1_9::BorderStyleCellSchema;
pub type BorderStyleTimestampSchema = v1_9::BorderStyleTimestampSchema;
pub type CellAlignSchema = v1_9::CellAlignSchema;
pub type CellBorderLineSchema = v1_9::CellBorderLineSchema;
pub type CellBorderSchema = v1_9::CellBorderSchema;
pub type CellRefCoordSchema = v1_9::CellRefCoordSchema;
pub type CellRefRangeEndSchema = v1_9::CellRefRangeEndSchema;
pub type CellRefRangeSchema = v1_9::CellRefRangeSchema;
pub type CellsAccessedSchema = v1_9::CellsAccessedSchema;
pub type CellValueSchema = v1_9::CellValueSchema;
pub type CellVerticalAlignSchema = v1_9::CellVerticalAlignSchema;
pub type CellWrapSchema = v1_9::CellWrapSchema;
pub type CodeCellLanguageSchema = v1_9::CodeCellLanguageSchema;
pub type CodeCellSchema = v1_9::CodeCellSchema;
pub type CodeRunResultSchema = v1_9::CodeRunResultSchema;
pub type CodeRunSchema = v1_9::CodeRunSchema;
pub type ColRangeSchema = v1_9::ColRangeSchema;
pub type ColumnRepeatSchema<T> = v1_9::ColumnRepeatSchema<T>;
pub type ColumnSchema = v1_9::ColumnSchema;
pub type ColumnsSchema = v1_9::ColumnsSchema;
pub type ConnectionKindSchema = v1_9::ConnectionKindSchema;
pub type Contiguous2DSchema<T> = v1_9::Contiguous2DSchema<T>;
pub type DataTableColumnSchema = v1_9::DataTableColumnSchema;
pub type DataTableKindSchema = v1_9::DataTableKindSchema;
pub type DataTableSortOrderSchema = v1_9::DataTableSortOrderSchema;
pub type DateTimeRangeSchema = v1_9::DateTimeRangeSchema;
pub type FormatSchema = v1_9::FormatSchema;
pub type IdSchema = v1_9::IdSchema;
pub type ImportSchema = v1_9::ImportSchema;
pub type NumberRangeSchema = v1_9::NumberRangeSchema;
pub type NumericFormatKindSchema = v1_9::NumericFormatKindSchema;
pub type NumericFormatSchema = v1_9::NumericFormatSchema;
pub type OffsetsSchema = v1_9::OffsetsSchema;
pub type OutputArraySchema = v1_9::OutputArraySchema;
pub type OutputSizeSchema = v1_9::OutputSizeSchema;
pub type OutputValueSchema = v1_9::OutputValueSchema;
pub type PosSchema = v1_9::PosSchema;
pub type RectSchema = v1_9::RectSchema;
pub type RefRangeBoundsSchema = v1_9::RefRangeBoundsSchema;
pub type RenderSizeSchema = v1_9::RenderSizeSchema;
pub type ResizeSchema = v1_9::ResizeSchema;
pub type RgbaSchema = v1_9::RgbaSchema;
pub type RowsResizeSchema = v1_9::RowsResizeSchema;
pub type RowsResizesSchema = v1_9::RowsResizesSchema;
pub type RunErrorMsgSchema = v1_9::RunErrorMsgSchema;
pub type RunErrorSchema = v1_9::RunErrorSchema;
pub type SheetFormattingSchema = v1_9::SheetFormattingSchema;
pub type SheetRectSchema = v1_9::SheetRectSchema;
pub type SortDirectionSchema = v1_9::SortDirectionSchema;
pub type SpanSchema = v1_9::SpanSchema;
pub type TableFormatsSchema = v1_9::TableFormatsSchema;
pub type TableRefSchema = v1_9::TableRefSchema;
pub type TextCaseSchema = v1_9::TextCaseSchema;
pub type TextMatchSchema = v1_9::TextMatchSchema;
pub type ValidationDateTimeSchema = v1_9::ValidationDateTimeSchema;
pub type ValidationErrorSchema = v1_9::ValidationErrorSchema;
pub type ValidationListSchema = v1_9::ValidationListSchema;
pub type ValidationListSourceSchema = v1_9::ValidationListSourceSchema;
pub type ValidationLogicalSchema = v1_9::ValidationLogicalSchema;
pub type ValidationMessageSchema = v1_9::ValidationMessageSchema;
pub type ValidationNumberSchema = v1_9::ValidationNumberSchema;
pub type ValidationRuleSchema = v1_9::ValidationRuleSchema;
pub type ValidationSchema = v1_9::ValidationSchema;
pub type ValidationStyleSchema = v1_9::ValidationStyleSchema;
pub type ValidationTextSchema = v1_9::ValidationTextSchema;
pub type ValidationsSchema = v1_9::ValidationsSchema;

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct DataTableSchema {
    pub kind: DataTableKindSchema,

    pub name: String,

    pub value: OutputValueSchema,

    #[serde(skip_serializing_if = "Option::is_none", default)]
    pub last_modified: Option<DateTime<Utc>>,

    #[serde(skip_serializing_if = "is_false", default)]
    pub header_is_first_row: bool,

    #[serde(skip_serializing_if = "Option::is_none", default)]
    pub show_name: Option<bool>,

    #[serde(skip_serializing_if = "Option::is_none", default)]
    pub show_columns: Option<bool>,

    #[serde(skip_serializing_if = "Option::is_none", default)]
    pub columns: Option<Vec<DataTableColumnSchema>>,

    #[serde(skip_serializing_if = "Option::is_none", default)]
    pub sort: Option<Vec<DataTableSortOrderSchema>>,

    #[serde(skip_serializing_if = "is_false", default)]
    pub sort_dirty: bool,

    #[serde(skip_serializing_if = "Option::is_none", default)]
    pub display_buffer: Option<Vec<u64>>,

    #[serde(skip_serializing_if = "is_false", default)]
    pub spill_value: bool,

    #[serde(skip_serializing_if = "is_false", default)]
    pub spill_data_table: bool,

    #[serde(skip_serializing_if = "is_false", default)]
    pub alternating_colors: bool,

    #[serde(skip_serializing_if = "Option::is_none", default)]
    pub formats: Option<SheetFormattingSchema>,

    #[serde(skip_serializing_if = "Option::is_none", default)]
    pub borders: Option<BordersSchema>,

    #[serde(skip_serializing_if = "Option::is_none", default)]
    pub chart_pixel_output: Option<(f32, f32)>,

    #[serde(skip_serializing_if = "Option::is_none", default)]
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
