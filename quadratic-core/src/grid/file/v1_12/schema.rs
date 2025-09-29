use crate::grid::file::v1_11;
use crate::util::is_false;
use chrono::{DateTime, NaiveDate, NaiveDateTime, NaiveTime, Utc};
use serde::{Deserialize, Serialize};

pub(crate) type A1SelectionSchema = v1_11::A1SelectionSchema;
pub(crate) type AxisSchema = v1_11::AxisSchema;
pub(crate) type BlockSchema<T> = v1_11::BlockSchema<T>;
pub(crate) type BordersSchema = v1_11::BordersSchema;
pub(crate) type BordersSideSchema = v1_11::BordersSideSchema;
pub(crate) type BorderStyleTimestampSchema = v1_11::BorderStyleTimestampSchema;
pub(crate) type CellAlignSchema = v1_11::CellAlignSchema;
pub(crate) type CellBorderLineSchema = v1_11::CellBorderLineSchema;
pub(crate) type CellRefCoordSchema = v1_11::CellRefCoordSchema;
pub(crate) type CellRefRangeEndSchema = v1_11::CellRefRangeEndSchema;
pub(crate) type CellRefRangeSchema = v1_11::CellRefRangeSchema;
pub(crate) type CellVerticalAlignSchema = v1_11::CellVerticalAlignSchema;
pub(crate) type CellWrapSchema = v1_11::CellWrapSchema;
pub(crate) type CodeCellLanguageSchema = v1_11::CodeCellLanguageSchema;
pub(crate) type CodeRunSchema = v1_11::CodeRunSchema;
pub(crate) type ColRangeSchema = v1_11::ColRangeSchema;
pub(crate) type ConnectionKindSchema = v1_11::ConnectionKindSchema;
pub(crate) type Contiguous2DSchema<T> = v1_11::Contiguous2DSchema<T>;
pub(crate) type DataTableKindSchema = v1_11::DataTableKindSchema;
pub(crate) type DataTableSortOrderSchema = v1_11::DataTableSortOrderSchema;
pub(crate) type DateTimeRangeSchema = v1_11::DateTimeRangeSchema;
pub(crate) type IdSchema = v1_11::IdSchema;
pub(crate) type ImportSchema = v1_11::ImportSchema;
pub(crate) type NumberRangeSchema = v1_11::NumberRangeSchema;
pub(crate) type NumericFormatKindSchema = v1_11::NumericFormatKindSchema;
pub(crate) type NumericFormatSchema = v1_11::NumericFormatSchema;
pub(crate) type OffsetsSchema = v1_11::OffsetsSchema;
pub(crate) type OutputSizeSchema = v1_11::OutputSizeSchema;
pub(crate) type PosSchema = v1_11::PosSchema;
pub(crate) type RefRangeBoundsSchema = v1_11::RefRangeBoundsSchema;
pub(crate) type RenderSizeSchema = v1_11::RenderSizeSchema;
pub(crate) type ResizeSchema = v1_11::ResizeSchema;
pub(crate) type RgbaSchema = v1_11::RgbaSchema;
pub(crate) type RowsResizeSchema = v1_11::RowsResizeSchema;
pub(crate) type RowsResizesSchema = v1_11::RowsResizesSchema;
pub(crate) type RunErrorMsgSchema = v1_11::RunErrorMsgSchema;
pub(crate) type RunErrorSchema = v1_11::RunErrorSchema;
pub(crate) type SheetFormattingSchema = v1_11::SheetFormattingSchema;
pub(crate) type SortDirectionSchema = v1_11::SortDirectionSchema;
pub(crate) type SpanSchema = v1_11::SpanSchema;
pub(crate) type TableRefSchema = v1_11::TableRefSchema;
pub(crate) type TextCaseSchema = v1_11::TextCaseSchema;
pub(crate) type TextMatchSchema = v1_11::TextMatchSchema;
pub(crate) type ValidationDateTimeSchema = v1_11::ValidationDateTimeSchema;
pub(crate) type ValidationErrorSchema = v1_11::ValidationErrorSchema;
pub(crate) type ValidationListSchema = v1_11::ValidationListSchema;
pub(crate) type ValidationListSourceSchema = v1_11::ValidationListSourceSchema;
pub(crate) type ValidationLogicalSchema = v1_11::ValidationLogicalSchema;
pub(crate) type ValidationMessageSchema = v1_11::ValidationMessageSchema;
pub(crate) type ValidationNumberSchema = v1_11::ValidationNumberSchema;
pub(crate) type ValidationRuleSchema = v1_11::ValidationRuleSchema;
pub(crate) type ValidationSchema = v1_11::ValidationSchema;
pub(crate) type ValidationStyleSchema = v1_11::ValidationStyleSchema;
pub(crate) type ValidationTextSchema = v1_11::ValidationTextSchema;
pub(crate) type ValidationsSchema = v1_11::ValidationsSchema;

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub(crate) enum CellValueSchema {
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

pub(crate) type ColumnSchema = Vec<(i64, CellValueSchema)>;
pub(crate) type ColumnsSchema = Vec<(i64, ColumnSchema)>;

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

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub(crate) struct DataTableColumnSchema {
    pub(crate) name: CellValueSchema,
    pub(crate) display: bool,
    pub(crate) value_index: u32,
}

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

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub(crate) enum OutputValueSchema {
    Single(CellValueSchema),
    Array(OutputArraySchema),
}

#[derive(Default, Debug, Clone, PartialEq, Serialize, Deserialize)]
pub(crate) struct OutputArraySchema {
    pub(crate) size: OutputSizeSchema,
    pub(crate) values: Vec<CellValueSchema>,
}
