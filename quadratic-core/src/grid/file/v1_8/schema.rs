use crate::grid::file::v1_7_1;
use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};

use super::SheetFormattingSchema;

pub type IdSchema = v1_7_1::IdSchema;
pub type PosSchema = v1_7_1::PosSchema;
pub type RectSchema = v1_7_1::RectSchema;
pub type SheetRectSchema = v1_7_1::SheetRectSchema;
pub type OffsetsSchema = v1_7_1::OffsetsSchema;
pub type RunErrorSchema = v1_7_1::RunErrorSchema;
pub type ValidationsSchema = v1_7_1::ValidationsSchema;
pub type ResizeSchema = v1_7_1::ResizeSchema;
pub type CodeRunResultSchema = v1_7_1::CodeRunResultSchema;
pub type OutputValueSchema = v1_7_1::OutputValueSchema;
pub type OutputArraySchema = v1_7_1::OutputArraySchema;
pub type OutputSizeSchema = v1_7_1::OutputSizeSchema;
pub type OutputValueValueSchema = v1_7_1::OutputValueValueSchema;
pub type ColumnSchema = v1_7_1::ColumnSchema;
pub type NumericFormatKindSchema = v1_7_1::NumericFormatKindSchema;
pub type NumericFormatSchema = v1_7_1::NumericFormatSchema;
pub type CellValueSchema = v1_7_1::CellValueSchema;
pub type CodeCellLanguage = v1_7_1::CodeCellLanguageSchema;
pub type ConnectionKindSchema = v1_7_1::ConnectionKindSchema;
pub type CodeCellSchema = v1_7_1::CodeCellSchema;
pub type CellAlignSchema = v1_7_1::CellAlignSchema;
pub type CellVerticalAlignSchema = v1_7_1::CellVerticalAlignSchema;
pub type CellWrapSchema = v1_7_1::CellWrapSchema;
pub type CellBorderSchema = v1_7_1::CellBorderSchema;
pub type ColumnRepeatSchema<T> = v1_7_1::ColumnRepeatSchema<T>;
pub type RenderSizeSchema = v1_7_1::RenderSizeSchema;
pub type RunErrorMsgSchema = v1_7_1::RunErrorMsgSchema;
pub type BordersSchema = v1_7_1::BordersSchema;
pub type BorderStyleCellSchema = v1_7_1::BorderStyleCellSchema;
pub type BorderStyleTimestampSchema = v1_7_1::BorderStyleTimestampSchema;
pub type CellBorderLineSchema = v1_7_1::CellBorderLineSchema;
pub type RgbaSchema = v1_7_1::RgbaSchema;
pub type BorderStyleCell = v1_7_1::BorderStyleCellSchema;
pub type SelectionSchema = v1_7_1::A1SelectionSchema;
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
pub type ColumnsSchema = Vec<(i64, ColumnSchema)>;
pub type AxisSchema = v1_7_1::AxisSchema;
pub type SpanSchema = v1_7_1::SpanSchema;
pub type RowsResizeSchema = v1_7_1::RowsResizeSchema;
pub type CellRefRangeSchema = v1_7_1::CellRefRangeSchema;
pub type TableRefSchema = v1_7_1::TableRefSchema;
pub type ColRangeSchema = v1_7_1::ColRangeSchema;

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
    pub columns: Vec<(i64, ColumnSchema)>,
    pub data_tables: Vec<(PosSchema, DataTableSchema)>,
    pub rows_resize: Vec<(i64, ResizeSchema)>,
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
pub enum DataTableShowUISchema {
    Show,
    Hide,
    Default,
}

impl From<crate::grid::data_table::DataTableShowUI> for DataTableShowUISchema {
    fn from(val: crate::grid::data_table::DataTableShowUI) -> Self {
        match val {
            crate::grid::data_table::DataTableShowUI::Show => DataTableShowUISchema::Show,
            crate::grid::data_table::DataTableShowUI::Hide => DataTableShowUISchema::Hide,
            crate::grid::data_table::DataTableShowUI::Default => DataTableShowUISchema::Default,
        }
    }
}

impl From<DataTableShowUISchema> for crate::grid::data_table::DataTableShowUI {
    fn from(val: DataTableShowUISchema) -> Self {
        match val {
            DataTableShowUISchema::Show => crate::grid::data_table::DataTableShowUI::Show,
            DataTableShowUISchema::Hide => crate::grid::data_table::DataTableShowUI::Hide,
            DataTableShowUISchema::Default => crate::grid::data_table::DataTableShowUI::Default,
        }
    }
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct DataTableSchema {
    pub kind: DataTableKindSchema,
    pub name: String,
    pub header_is_first_row: bool,
    pub show_header: bool,
    pub show_ui: DataTableShowUISchema,
    pub columns: Option<Vec<DataTableColumnSchema>>,
    pub sort: Option<Vec<DataTableSortOrderSchema>>,
    pub display_buffer: Option<Vec<u64>>,
    pub value: OutputValueSchema,
    pub readonly: bool,
    pub spill_error: bool,
    pub last_modified: Option<DateTime<Utc>>,
    pub alternating_colors: bool,
    pub formats: SheetFormattingSchema,
    pub chart_pixel_output: Option<(f32, f32)>,
    pub chart_output: Option<(u32, u32)>,
}

impl From<i8> for AxisSchema {
    fn from(val: i8) -> Self {
        match val {
            0 => AxisSchema::X,
            1 => AxisSchema::Y,
            _ => panic!("Invalid Axis value: {}", val),
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
