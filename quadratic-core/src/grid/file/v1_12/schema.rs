use crate::grid::file::v1_11;
use crate::util::is_false;
use chrono::{DateTime, NaiveDate, NaiveDateTime, NaiveTime, Utc};
use serde::{Deserialize, Serialize};

pub type A1SelectionSchema = v1_11::A1SelectionSchema;
pub type AxisSchema = v1_11::AxisSchema;
pub type BlockSchema<T> = v1_11::BlockSchema<T>;
pub type BordersSchema = v1_11::BordersSchema;
pub type BordersSideSchema = v1_11::BordersSideSchema;
pub type BorderStyleCellSchema = v1_11::BorderStyleCellSchema;
pub type BorderStyleTimestampSchema = v1_11::BorderStyleTimestampSchema;
pub type CellAlignSchema = v1_11::CellAlignSchema;
pub type CellBorderLineSchema = v1_11::CellBorderLineSchema;
pub type CellBorderSchema = v1_11::CellBorderSchema;
pub type CellRefCoordSchema = v1_11::CellRefCoordSchema;
pub type CellRefRangeEndSchema = v1_11::CellRefRangeEndSchema;
pub type CellRefRangeSchema = v1_11::CellRefRangeSchema;
pub type CellsAccessedSchema = v1_11::CellsAccessedSchema;
pub type CellVerticalAlignSchema = v1_11::CellVerticalAlignSchema;
pub type CellWrapSchema = v1_11::CellWrapSchema;
pub type CodeCellLanguageSchema = v1_11::CodeCellLanguageSchema;
pub type CodeCellSchema = v1_11::CodeCellSchema;
pub type CodeRunResultSchema = v1_11::CodeRunResultSchema;
pub type CodeRunSchema = v1_11::CodeRunSchema;
pub type ColRangeSchema = v1_11::ColRangeSchema;
pub type ColumnRepeatSchema<T> = v1_11::ColumnRepeatSchema<T>;
pub type ConnectionKindSchema = v1_11::ConnectionKindSchema;
pub type Contiguous2DSchema<T> = v1_11::Contiguous2DSchema<T>;
pub type DataTableKindSchema = v1_11::DataTableKindSchema;
pub type DataTableSortOrderSchema = v1_11::DataTableSortOrderSchema;
pub type DateTimeRangeSchema = v1_11::DateTimeRangeSchema;
pub type FormatSchema = v1_11::FormatSchema;
pub type IdSchema = v1_11::IdSchema;
pub type ImportSchema = v1_11::ImportSchema;
pub type NumberRangeSchema = v1_11::NumberRangeSchema;
pub type NumericFormatKindSchema = v1_11::NumericFormatKindSchema;
pub type NumericFormatSchema = v1_11::NumericFormatSchema;
pub type OffsetsSchema = v1_11::OffsetsSchema;
pub type OutputSizeSchema = v1_11::OutputSizeSchema;
pub type PosSchema = v1_11::PosSchema;
pub type RectSchema = v1_11::RectSchema;
pub type RefRangeBoundsSchema = v1_11::RefRangeBoundsSchema;
pub type RenderSizeSchema = v1_11::RenderSizeSchema;
pub type ResizeSchema = v1_11::ResizeSchema;
pub type RgbaSchema = v1_11::RgbaSchema;
pub type RowsResizeSchema = v1_11::RowsResizeSchema;
pub type RowsResizesSchema = v1_11::RowsResizesSchema;
pub type RunErrorMsgSchema = v1_11::RunErrorMsgSchema;
pub type RunErrorSchema = v1_11::RunErrorSchema;
pub type SheetFormattingSchema = v1_11::SheetFormattingSchema;
pub type SheetRectSchema = v1_11::SheetRectSchema;
pub type SortDirectionSchema = v1_11::SortDirectionSchema;
pub type SpanSchema = v1_11::SpanSchema;
pub type TableFormatsSchema = v1_11::TableFormatsSchema;
pub type TableRefSchema = v1_11::TableRefSchema;
pub type TextCaseSchema = v1_11::TextCaseSchema;
pub type TextMatchSchema = v1_11::TextMatchSchema;
pub type ValidationDateTimeSchema = v1_11::ValidationDateTimeSchema;
pub type ValidationErrorSchema = v1_11::ValidationErrorSchema;
pub type ValidationListSchema = v1_11::ValidationListSchema;
pub type ValidationListSourceSchema = v1_11::ValidationListSourceSchema;
pub type ValidationLogicalSchema = v1_11::ValidationLogicalSchema;
pub type ValidationMessageSchema = v1_11::ValidationMessageSchema;
pub type ValidationNumberSchema = v1_11::ValidationNumberSchema;
pub type ValidationRuleSchema = v1_11::ValidationRuleSchema;
pub type ValidationSchema = v1_11::ValidationSchema;
pub type ValidationStyleSchema = v1_11::ValidationStyleSchema;
pub type ValidationTextSchema = v1_11::ValidationTextSchema;
pub type ValidationsSchema = v1_11::ValidationsSchema;

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
