use crate::grid::file::v1_7_1;
use chrono::{DateTime, NaiveDate, NaiveDateTime, NaiveTime, Utc};
use serde::{Deserialize, Serialize};

use super::{RunErrorSchema, SheetFormattingSchema};

pub type IdSchema = v1_7_1::IdSchema;
pub type PosSchema = v1_7_1::PosSchema;
pub type RectSchema = v1_7_1::RectSchema;
pub type SheetRectSchema = v1_7_1::SheetRectSchema;
pub type OffsetsSchema = v1_7_1::OffsetsSchema;
pub type ValidationsSchema = v1_7_1::ValidationsSchema;
pub type ResizeSchema = v1_7_1::ResizeSchema;
pub type CodeRunResultSchema = v1_7_1::CodeRunResultSchema;
pub type OutputSizeSchema = v1_7_1::OutputSizeSchema;
pub type NumericFormatKindSchema = v1_7_1::NumericFormatKindSchema;
pub type NumericFormatSchema = v1_7_1::NumericFormatSchema;
pub type CodeCellLanguageSchema = v1_7_1::CodeCellLanguageSchema;
pub type ConnectionKindSchema = v1_7_1::ConnectionKindSchema;
pub type CodeCellSchema = v1_7_1::CodeCellSchema;
pub type CellAlignSchema = v1_7_1::CellAlignSchema;
pub type CellVerticalAlignSchema = v1_7_1::CellVerticalAlignSchema;
pub type CellWrapSchema = v1_7_1::CellWrapSchema;
pub type CellBorderSchema = v1_7_1::CellBorderSchema;
pub type ColumnRepeatSchema<T> = v1_7_1::ColumnRepeatSchema<T>;
pub type RenderSizeSchema = v1_7_1::RenderSizeSchema;
pub type BordersSchema = v1_7_1::BordersSchema;
pub type BorderStyleCellSchema = v1_7_1::BorderStyleCellSchema;
pub type BorderStyleTimestampSchema = v1_7_1::BorderStyleTimestampSchema;
pub type CellBorderLineSchema = v1_7_1::CellBorderLineSchema;
pub type RgbaSchema = v1_7_1::RgbaSchema;
pub type ValidationSchema = v1_7_1::ValidationSchema;
pub type ValidationStyleSchema = v1_7_1::ValidationStyleSchema;
pub type ValidationMessageSchema = v1_7_1::ValidationMessageSchema;
pub type ValidationErrorSchema = v1_7_1::ValidationErrorSchema;
pub type ValidationRuleSchema = v1_7_1::ValidationRuleSchema;
pub type ValidationDateTimeSchema = v1_7_1::ValidationDateTimeSchema;
pub type ValidationNumberSchema = v1_7_1::ValidationNumberSchema;
pub type ValidationTextSchema = v1_7_1::ValidationTextSchema;
pub type ValidationLogicalSchema = v1_7_1::ValidationLogicalSchema;
pub type ValidationListSchema = v1_7_1::ValidationListSchema;
pub type ValidationListSourceSchema = v1_7_1::ValidationListSourceSchema;
pub type TextMatchSchema = v1_7_1::TextMatchSchema;
pub type TextCaseSchema = v1_7_1::TextCaseSchema;
pub type DateTimeRangeSchema = v1_7_1::DateTimeRangeSchema;
pub type NumberRangeSchema = v1_7_1::NumberRangeSchema;
pub type CellsAccessedSchema = v1_7_1::CellsAccessedSchema;
pub type RefRangeBoundsSchema = v1_7_1::RefRangeBoundsSchema;
pub type CellRefRangeEndSchema = v1_7_1::CellRefRangeEndSchema;
pub type CellRefCoordSchema = v1_7_1::CellRefCoordSchema;
pub type A1SelectionSchema = v1_7_1::A1SelectionSchema;
pub type Contiguous2DSchema<T> = v1_7_1::Contiguous2DSchema<T>;
pub type BlockSchema<T> = v1_7_1::BlockSchema<T>;
pub type BordersSideSchema = v1_7_1::BordersSideSchema;
pub type DataTablesSchema = Vec<(PosSchema, DataTableSchema)>;
pub type RowsResizesSchema = Vec<(i64, ResizeSchema)>;
pub type AxisSchema = v1_7_1::AxisSchema;
pub type SpanSchema = v1_7_1::SpanSchema;
pub type RowsResizeSchema = v1_7_1::RowsResizeSchema;
pub type CellRefRangeSchema = v1_7_1::CellRefRangeSchema;
pub type TableRefSchema = v1_7_1::TableRefSchema;
pub type ColRangeSchema = v1_7_1::ColRangeSchema;

pub type ColumnSchema = Vec<(i64, CellValueSchema)>;

pub type ColumnsSchema = Vec<(i64, ColumnSchema)>;

#[derive(Default, Debug, PartialEq, Serialize, Deserialize, Clone)]
pub struct GridSchema {
    pub sheets: Vec<SheetSchema>,
    pub version: Option<String>,
}

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

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct CodeRunSchema {
    pub std_out: Option<String>,
    pub std_err: Option<String>,
    pub cells_accessed: CellsAccessedSchema,
    pub error: Option<RunErrorSchema>,
    pub return_type: Option<String>,
    pub line_number: Option<u32>,
    pub output_type: Option<String>,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct DataTableColumnSchema {
    pub name: CellValueSchema,
    pub display: bool,
    pub value_index: u32,
}

#[allow(clippy::large_enum_variant)]
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub enum DataTableKindSchema {
    CodeRun(CodeRunSchema),
    Import(ImportSchema),
}

#[derive(Serialize, Deserialize, Debug, Clone, PartialEq)]
pub enum SortDirectionSchema {
    Ascending,
    Descending,
    None,
}

#[derive(Serialize, Deserialize, Debug, Clone, PartialEq)]
pub struct DataTableSortOrderSchema {
    pub column_index: usize,
    pub direction: SortDirectionSchema,
}

#[derive(Default, Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct FormatSchema {
    pub align: Option<CellAlignSchema>,
    pub vertical_align: Option<CellVerticalAlignSchema>,
    pub wrap: Option<CellWrapSchema>,
    pub numeric_format: Option<NumericFormatSchema>,
    pub numeric_decimals: Option<i16>,
    pub numeric_commas: Option<bool>,
    pub bold: Option<bool>,
    pub italic: Option<bool>,
    pub text_color: Option<String>,
    pub fill_color: Option<String>,
    pub render_size: Option<RenderSizeSchema>,

    #[serde(default)]
    pub date_time: Option<String>,
    #[serde(default)]
    pub underline: Option<bool>,
    #[serde(default)]
    pub strike_through: Option<bool>,
}
#[derive(Default, Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct TableFormatsSchema {
    pub formats: FormatSchema,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct DataTableSchema {
    pub kind: DataTableKindSchema,
    pub name: String,
    pub header_is_first_row: bool,
    pub show_ui: bool,
    pub show_name: bool,
    pub show_columns: bool,
    pub columns: Option<Vec<DataTableColumnSchema>>,
    pub sort: Option<Vec<DataTableSortOrderSchema>>,

    #[serde(default)]
    pub sort_dirty: bool,

    pub display_buffer: Option<Vec<u64>>,
    pub value: OutputValueSchema,
    pub readonly: bool,
    pub spill_error: bool,
    pub last_modified: Option<DateTime<Utc>>,
    pub alternating_colors: bool,
    pub formats: SheetFormattingSchema,
    pub borders: BordersSchema,
    pub chart_pixel_output: Option<(f32, f32)>,
    pub chart_output: Option<(u32, u32)>,
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
pub struct ImportSchema {
    pub file_name: String,
}

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

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub enum CellValueSchema {
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
