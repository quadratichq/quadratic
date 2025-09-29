use crate::grid::file::v1_7_1;
use chrono::{DateTime, NaiveDate, NaiveDateTime, NaiveTime, Utc};
use serde::{Deserialize, Serialize};

use super::{RunErrorSchema, SheetFormattingSchema};

pub(crate) type IdSchema = v1_7_1::IdSchema;
pub(crate) type PosSchema = v1_7_1::PosSchema;
pub(crate) type OffsetsSchema = v1_7_1::OffsetsSchema;
pub(crate) type ValidationsSchema = v1_7_1::ValidationsSchema;
pub(crate) type ResizeSchema = v1_7_1::ResizeSchema;
pub(crate) type OutputSizeSchema = v1_7_1::OutputSizeSchema;
pub(crate) type NumericFormatKindSchema = v1_7_1::NumericFormatKindSchema;
pub(crate) type NumericFormatSchema = v1_7_1::NumericFormatSchema;
pub(crate) type CodeCellLanguageSchema = v1_7_1::CodeCellLanguageSchema;
pub(crate) type ConnectionKindSchema = v1_7_1::ConnectionKindSchema;
pub(crate) type CodeCellSchema = v1_7_1::CodeCellSchema;
pub(crate) type CellAlignSchema = v1_7_1::CellAlignSchema;
pub(crate) type CellVerticalAlignSchema = v1_7_1::CellVerticalAlignSchema;
pub(crate) type CellWrapSchema = v1_7_1::CellWrapSchema;
pub(crate) type RenderSizeSchema = v1_7_1::RenderSizeSchema;
pub(crate) type BordersSchema = v1_7_1::BordersSchema;
pub(crate) type BorderStyleTimestampSchema = v1_7_1::BorderStyleTimestampSchema;
pub(crate) type CellBorderLineSchema = v1_7_1::CellBorderLineSchema;
pub(crate) type RgbaSchema = v1_7_1::RgbaSchema;
pub(crate) type ValidationSchema = v1_7_1::ValidationSchema;
pub(crate) type ValidationStyleSchema = v1_7_1::ValidationStyleSchema;
pub(crate) type ValidationMessageSchema = v1_7_1::ValidationMessageSchema;
pub(crate) type ValidationErrorSchema = v1_7_1::ValidationErrorSchema;
pub(crate) type ValidationRuleSchema = v1_7_1::ValidationRuleSchema;
pub(crate) type ValidationDateTimeSchema = v1_7_1::ValidationDateTimeSchema;
pub(crate) type ValidationNumberSchema = v1_7_1::ValidationNumberSchema;
pub(crate) type ValidationTextSchema = v1_7_1::ValidationTextSchema;
pub(crate) type ValidationLogicalSchema = v1_7_1::ValidationLogicalSchema;
pub(crate) type ValidationListSchema = v1_7_1::ValidationListSchema;
pub(crate) type ValidationListSourceSchema = v1_7_1::ValidationListSourceSchema;
pub(crate) type TextMatchSchema = v1_7_1::TextMatchSchema;
pub(crate) type TextCaseSchema = v1_7_1::TextCaseSchema;
pub(crate) type DateTimeRangeSchema = v1_7_1::DateTimeRangeSchema;
pub(crate) type NumberRangeSchema = v1_7_1::NumberRangeSchema;
pub(crate) type CellsAccessedSchema = v1_7_1::CellsAccessedSchema;
pub(crate) type RefRangeBoundsSchema = v1_7_1::RefRangeBoundsSchema;
pub(crate) type CellRefRangeEndSchema = v1_7_1::CellRefRangeEndSchema;
pub(crate) type CellRefCoordSchema = v1_7_1::CellRefCoordSchema;
pub(crate) type A1SelectionSchema = v1_7_1::A1SelectionSchema;
pub(crate) type Contiguous2DSchema<T> = v1_7_1::Contiguous2DSchema<T>;
pub(crate) type BlockSchema<T> = v1_7_1::BlockSchema<T>;
pub(crate) type BordersSideSchema = v1_7_1::BordersSideSchema;
pub(crate) type DataTablesSchema = Vec<(PosSchema, DataTableSchema)>;
pub(crate) type RowsResizesSchema = Vec<(i64, ResizeSchema)>;
pub(crate) type AxisSchema = v1_7_1::AxisSchema;
pub(crate) type SpanSchema = v1_7_1::SpanSchema;
pub(crate) type RowsResizeSchema = v1_7_1::RowsResizeSchema;
pub(crate) type CellRefRangeSchema = v1_7_1::CellRefRangeSchema;
pub(crate) type TableRefSchema = v1_7_1::TableRefSchema;
pub(crate) type ColRangeSchema = v1_7_1::ColRangeSchema;
pub(crate) type ColumnSchema = Vec<(i64, CellValueSchema)>;
pub(crate) type ColumnsSchema = Vec<(i64, ColumnSchema)>;

#[derive(Default, Debug, PartialEq, Serialize, Deserialize, Clone)]
pub(crate) struct GridSchema {
    pub(crate) sheets: Vec<SheetSchema>,
    pub(crate) version: Option<String>,
}

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

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub(crate) struct CodeRunSchema {
    pub(crate) std_out: Option<String>,
    pub(crate) std_err: Option<String>,
    pub(crate) cells_accessed: CellsAccessedSchema,
    pub(crate) error: Option<RunErrorSchema>,
    pub(crate) return_type: Option<String>,
    pub(crate) line_number: Option<u32>,
    pub(crate) output_type: Option<String>,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub(crate) struct DataTableColumnSchema {
    pub(crate) name: CellValueSchema,
    pub(crate) display: bool,
    pub(crate) value_index: u32,
}

#[allow(clippy::large_enum_variant)]
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub(crate) enum DataTableKindSchema {
    CodeRun(CodeRunSchema),
    Import(ImportSchema),
}

#[derive(Serialize, Deserialize, Debug, Clone, PartialEq)]
pub(crate) enum SortDirectionSchema {
    Ascending,
    Descending,
    None,
}

#[derive(Serialize, Deserialize, Debug, Clone, PartialEq)]
pub(crate) struct DataTableSortOrderSchema {
    pub(crate) column_index: usize,
    pub(crate) direction: SortDirectionSchema,
}

#[derive(Default, Debug, Clone, PartialEq, Serialize, Deserialize)]
pub(crate) struct FormatSchema {
    pub(crate) align: Option<CellAlignSchema>,
    pub(crate) vertical_align: Option<CellVerticalAlignSchema>,
    pub(crate) wrap: Option<CellWrapSchema>,
    pub(crate) numeric_format: Option<NumericFormatSchema>,
    pub(crate) numeric_decimals: Option<i16>,
    pub(crate) numeric_commas: Option<bool>,
    pub(crate) bold: Option<bool>,
    pub(crate) italic: Option<bool>,
    pub(crate) text_color: Option<String>,
    pub(crate) fill_color: Option<String>,
    pub(crate) render_size: Option<RenderSizeSchema>,

    #[serde(default)]
    pub(crate) date_time: Option<String>,
    #[serde(default)]
    pub(crate) underline: Option<bool>,
    #[serde(default)]
    pub(crate) strike_through: Option<bool>,
}
#[derive(Default, Debug, Clone, PartialEq, Serialize, Deserialize)]
pub(crate) struct TableFormatsSchema {
    pub(crate) formats: FormatSchema,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub(crate) struct DataTableSchema {
    pub(crate) kind: DataTableKindSchema,
    pub(crate) name: String,
    pub(crate) header_is_first_row: bool,
    pub(crate) show_ui: bool,
    pub(crate) show_name: bool,
    pub(crate) show_columns: bool,
    pub(crate) columns: Option<Vec<DataTableColumnSchema>>,
    pub(crate) sort: Option<Vec<DataTableSortOrderSchema>>,

    #[serde(default)]
    pub(crate) sort_dirty: bool,

    pub(crate) display_buffer: Option<Vec<u64>>,
    pub(crate) value: OutputValueSchema,
    pub(crate) readonly: bool,
    pub(crate) spill_error: bool,
    pub(crate) last_modified: Option<DateTime<Utc>>,
    pub(crate) alternating_colors: bool,
    pub(crate) formats: SheetFormattingSchema,
    pub(crate) borders: BordersSchema,
    pub(crate) chart_pixel_output: Option<(f32, f32)>,
    pub(crate) chart_output: Option<(u32, u32)>,
}

impl From<i8> for AxisSchema {
    fn from(val: i8) -> Self {
        match val {
            0 => AxisSchema::X,
            1 => AxisSchema::Y,
            _ => panic!("Invalid Axis value: {val}"),
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

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub(crate) struct ImportSchema {
    pub(crate) file_name: String,
}

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

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub(crate) enum CellValueSchema {
    Blank,
    Text(String),
    Number(String),
    Html(String),
    Code(CodeCellSchema),
    Logical(bool),
    Instant(String),
    Date(NaiveDate),
    Time(NaiveTime),
    DateTime(NaiveDateTime),
    Duration(String),
    Error(RunErrorSchema),
    Image(String),
    Import(ImportSchema),
}
impl From<v1_7_1::CellValueSchema> for CellValueSchema {
    fn from(value: v1_7_1::CellValueSchema) -> Self {
        match value {
            v1_7_1::CellValueSchema::Blank => Self::Blank,
            v1_7_1::CellValueSchema::Text(s) => Self::Text(s),
            v1_7_1::CellValueSchema::Number(n) => Self::Number(n),
            v1_7_1::CellValueSchema::Html(h) => Self::Html(h),
            v1_7_1::CellValueSchema::Code(code_cell) => Self::Code(code_cell),
            v1_7_1::CellValueSchema::Logical(l) => Self::Logical(l),
            v1_7_1::CellValueSchema::Instant(i) => Self::Instant(i),
            v1_7_1::CellValueSchema::Date(naive_date) => Self::Date(naive_date),
            v1_7_1::CellValueSchema::Time(naive_time) => Self::Time(naive_time),
            v1_7_1::CellValueSchema::DateTime(naive_date_time) => Self::DateTime(naive_date_time),
            v1_7_1::CellValueSchema::Duration(d) => Self::Duration(d),
            v1_7_1::CellValueSchema::Error(run_error_schema) => {
                Self::Error(run_error_schema.into())
            }
            v1_7_1::CellValueSchema::Image(i) => Self::Image(i),
            v1_7_1::CellValueSchema::Import(import_schema) => Self::Import(import_schema),
        }
    }
}
