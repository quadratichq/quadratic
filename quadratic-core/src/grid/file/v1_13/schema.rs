use crate::grid::file::v1_12;
use crate::util::is_false;
use chrono::{DateTime, NaiveDate, NaiveDateTime, NaiveTime, Utc};
use serde::{Deserialize, Serialize};

// Re-export unchanged types from v1_12
pub type A1SelectionSchema = v1_12::A1SelectionSchema;
pub type AxisSchema = v1_12::AxisSchema;
pub type BlockSchema<T> = v1_12::BlockSchema<T>;
pub type BordersSchema = v1_12::BordersSchema;
pub type BordersSideSchema = v1_12::BordersSideSchema;
pub type BorderStyleCellSchema = v1_12::BorderStyleCellSchema;
pub type BorderStyleTimestampSchema = v1_12::BorderStyleTimestampSchema;
pub type CellAlignSchema = v1_12::CellAlignSchema;
pub type CellBorderLineSchema = v1_12::CellBorderLineSchema;
pub type CellBorderSchema = v1_12::CellBorderSchema;
pub type CellRefCoordSchema = v1_12::CellRefCoordSchema;
pub type CellRefRangeEndSchema = v1_12::CellRefRangeEndSchema;
pub type CellRefRangeSchema = v1_12::CellRefRangeSchema;
pub type CellsAccessedSchema = v1_12::CellsAccessedSchema;
pub type CellVerticalAlignSchema = v1_12::CellVerticalAlignSchema;
pub type CellWrapSchema = v1_12::CellWrapSchema;
pub type CodeCellLanguageSchema = v1_12::CodeCellLanguageSchema;
pub type CodeCellSchema = v1_12::CodeCellSchema;
pub type CodeRunResultSchema = v1_12::CodeRunResultSchema;
pub type CodeRunSchema = v1_12::CodeRunSchema;
pub type ColRangeSchema = v1_12::ColRangeSchema;
pub type ColorScaleSchema = v1_12::ColorScaleSchema;
pub type ColorScaleThresholdSchema = v1_12::ColorScaleThresholdSchema;
pub type ColorScaleThresholdValueTypeSchema = v1_12::ColorScaleThresholdValueTypeSchema;
pub type ColumnRepeatSchema<T> = v1_12::ColumnRepeatSchema<T>;
pub type ConditionalFormatConfigSchema = v1_12::ConditionalFormatConfigSchema;
pub type ConditionalFormatSchema = v1_12::ConditionalFormatSchema;
pub type ConditionalFormatsSchema = v1_12::ConditionalFormatsSchema;
pub type ConditionalFormatStyleSchema = v1_12::ConditionalFormatStyleSchema;
pub type ConnectionKindSchema = v1_12::ConnectionKindSchema;
pub type Contiguous2DSchema<T> = v1_12::Contiguous2DSchema<T>;
pub type DataTableKindSchema = v1_12::DataTableKindSchema;
pub type DataTableSortOrderSchema = v1_12::DataTableSortOrderSchema;
pub type DateTimeRangeSchema = v1_12::DateTimeRangeSchema;
pub type FormatSchema = v1_12::FormatSchema;
pub type IdSchema = v1_12::IdSchema;
pub type ImportSchema = v1_12::ImportSchema;
pub type MergeCellsSchema = v1_12::MergeCellsSchema;
pub type NumberRangeSchema = v1_12::NumberRangeSchema;
pub type NumericFormatKindSchema = v1_12::NumericFormatKindSchema;
pub type NumericFormatSchema = v1_12::NumericFormatSchema;
pub type OffsetsSchema = v1_12::OffsetsSchema;
pub type OutputSizeSchema = v1_12::OutputSizeSchema;
pub type PosSchema = v1_12::PosSchema;
pub type RectSchema = v1_12::RectSchema;
pub type RefRangeBoundsSchema = v1_12::RefRangeBoundsSchema;
pub type RenderSizeSchema = v1_12::RenderSizeSchema;
pub type ResizeSchema = v1_12::ResizeSchema;
pub type RgbaSchema = v1_12::RgbaSchema;
pub type RowsResizeSchema = v1_12::RowsResizeSchema;
pub type RowsResizesSchema = v1_12::RowsResizesSchema;
pub type RunErrorMsgSchema = v1_12::RunErrorMsgSchema;
pub type RunErrorSchema = v1_12::RunErrorSchema;
pub type SheetFormattingSchema = v1_12::SheetFormattingSchema;
pub type SheetRectSchema = v1_12::SheetRectSchema;
pub type SortDirectionSchema = v1_12::SortDirectionSchema;
pub type SpanSchema = v1_12::SpanSchema;
pub type TableFormatsSchema = v1_12::TableFormatsSchema;
pub type TableRefSchema = v1_12::TableRefSchema;
pub type TextCaseSchema = v1_12::TextCaseSchema;
pub type TextMatchSchema = v1_12::TextMatchSchema;
pub type TextSpanSchema = v1_12::TextSpanSchema;
pub type ValidationDateTimeSchema = v1_12::ValidationDateTimeSchema;
pub type ValidationErrorSchema = v1_12::ValidationErrorSchema;
pub type ValidationListSchema = v1_12::ValidationListSchema;
pub type ValidationListSourceSchema = v1_12::ValidationListSourceSchema;
pub type ValidationLogicalSchema = v1_12::ValidationLogicalSchema;
pub type ValidationMessageSchema = v1_12::ValidationMessageSchema;
pub type ValidationNumberSchema = v1_12::ValidationNumberSchema;
pub type ValidationRuleSchema = v1_12::ValidationRuleSchema;
pub type ValidationSchema = v1_12::ValidationSchema;
pub type ValidationStyleSchema = v1_12::ValidationStyleSchema;
pub type ValidationTextSchema = v1_12::ValidationTextSchema;
pub type ValidationsSchema = v1_12::ValidationsSchema;

/// Single-cell code schema - contains a CodeRun for cells with 1x1 output and no table UI.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct SingleCodeCellSchema {
    /// The code run containing language, code, output, etc.
    pub code_run: CodeRunSchema,
    /// The computed output value (single cell)
    pub output: CellValueSchema,
    /// When the code cell was last modified/run (epoch timestamp in milliseconds).
    pub last_modified: i64,
}

/// CellValue schema for v1.13 - adds Code variant for single-cell code cells.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub enum CellValueSchema {
    Blank,
    Text(String),
    Number(String),
    Html(String),
    Logical(bool),
    Instant(String),
    Date(NaiveDate),
    Time(NaiveTime),
    DateTime(NaiveDateTime),
    Duration(String),
    Error(RunErrorSchema),
    Image(String),
    RichText(Vec<TextSpanSchema>),
    /// Single-cell code (1x1 output, no table UI)
    Code(Box<SingleCodeCellSchema>),
}

pub type ColumnSchema = Vec<(i64, CellValueSchema)>;
pub type ColumnsSchema = Vec<(i64, ColumnSchema)>;

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

    #[serde(default)]
    pub merge_cells: MergeCellsSchema,

    #[serde(default)]
    pub conditional_formats: ConditionalFormatsSchema,
}

#[derive(Default, Debug, PartialEq, Serialize, Deserialize, Clone)]
pub struct GridSchema {
    pub sheets: Vec<SheetSchema>,
    pub version: Option<String>,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct DataTableColumnSchema {
    pub name: CellValueSchema,
    pub display: bool,
    pub value_index: u32,
}

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

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub enum OutputValueSchema {
    Single(CellValueSchema),
    Array(OutputArraySchema),
}

#[derive(Default, Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct OutputArraySchema {
    pub size: OutputSizeSchema,
    pub values: Vec<CellValueSchema>,
}
