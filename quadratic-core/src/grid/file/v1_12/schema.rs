use crate::grid::file::v1_11;
use crate::util::is_false;
use chrono::{DateTime, NaiveDate, NaiveDateTime, NaiveTime, Utc};
use serde::{Deserialize, Serialize};
use uuid::Uuid;

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
/// CodeRun schema with optional formula AST caching.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct CodeRunSchema {
    pub language: CodeCellLanguageSchema,
    pub code: String,
    #[serde(skip_serializing_if = "Option::is_none", default)]
    pub formula_ast: Option<super::formula_schema::FormulaSchema>,
    #[serde(skip_serializing_if = "Option::is_none", default)]
    pub std_out: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none", default)]
    pub std_err: Option<String>,
    pub cells_accessed: CellsAccessedSchema,
    #[serde(skip_serializing_if = "Option::is_none", default)]
    pub error: Option<RunErrorSchema>,
    #[serde(skip_serializing_if = "Option::is_none", default)]
    pub return_type: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none", default)]
    pub line_number: Option<u32>,
    #[serde(skip_serializing_if = "Option::is_none", default)]
    pub output_type: Option<String>,
}
pub type ColRangeSchema = v1_11::ColRangeSchema;
pub type ColumnRepeatSchema<T> = v1_11::ColumnRepeatSchema<T>;
pub type ConnectionKindSchema = v1_11::ConnectionKindSchema;
pub type Contiguous2DSchema<T> = v1_11::Contiguous2DSchema<T>;
/// DataTableKind schema using the new CodeRunSchema with formula_ast.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[allow(clippy::large_enum_variant)]
pub enum DataTableKindSchema {
    CodeRun(Box<CodeRunSchema>),
    Import(ImportSchema),
}
pub type DataTableSortOrderSchema = v1_11::DataTableSortOrderSchema;
pub type DateTimeRangeSchema = v1_11::DateTimeRangeSchema;
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
pub type SheetRectSchema = v1_11::SheetRectSchema;
pub type SortDirectionSchema = v1_11::SortDirectionSchema;
pub type SpanSchema = v1_11::SpanSchema;
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

/// Schema for conditional format style properties.
/// Only these properties are supported by conditional formatting.
#[derive(Default, Serialize, Deserialize, Debug, Clone, PartialEq)]
pub struct ConditionalFormatStyleSchema {
    #[serde(skip_serializing_if = "Option::is_none", default)]
    pub bold: Option<bool>,

    #[serde(skip_serializing_if = "Option::is_none", default)]
    pub italic: Option<bool>,

    #[serde(skip_serializing_if = "Option::is_none", default)]
    pub underline: Option<bool>,

    #[serde(skip_serializing_if = "Option::is_none", default)]
    pub strike_through: Option<bool>,

    #[serde(skip_serializing_if = "Option::is_none", default)]
    pub text_color: Option<String>,

    #[serde(skip_serializing_if = "Option::is_none", default)]
    pub fill_color: Option<String>,
}

/// Schema for color scale threshold value type.
#[derive(Serialize, Deserialize, Debug, Clone, PartialEq)]
pub enum ColorScaleThresholdValueTypeSchema {
    /// Automatically use the minimum value in the selection.
    Min,
    /// Automatically use the maximum value in the selection.
    Max,
    /// Use a fixed numeric value.
    Number(f64),
    /// Use a percentile (0-100) of the values in the selection.
    Percentile(f64),
    /// Use a percent of the range (0-100).
    Percent(f64),
}

/// Schema for a color scale threshold point.
#[derive(Serialize, Deserialize, Debug, Clone, PartialEq)]
pub struct ColorScaleThresholdSchema {
    pub value_type: ColorScaleThresholdValueTypeSchema,
    pub color: String,
}

/// Schema for a color scale configuration.
#[derive(Serialize, Deserialize, Debug, Clone, PartialEq)]
pub struct ColorScaleSchema {
    pub thresholds: Vec<ColorScaleThresholdSchema>,

    /// When true, automatically inverts text color (white/black) based on
    /// the fill color's luminance to ensure readability.
    #[serde(default)]
    pub invert_text_on_dark: bool,
}

/// Schema for a conditional format configuration (formula-based or color scale).
#[derive(Serialize, Deserialize, Debug, Clone, PartialEq)]
#[serde(tag = "type")]
pub enum ConditionalFormatConfigSchema {
    /// Formula-based conditional format with static style.
    Formula {
        rule: super::formula_schema::FormulaSchema,
        style: ConditionalFormatStyleSchema,
    },
    /// Color scale that applies gradient colors based on numeric values.
    ColorScale { color_scale: ColorScaleSchema },
}

/// Schema for a conditional format rule.
#[derive(Serialize, Deserialize, Debug, Clone, PartialEq)]
pub struct ConditionalFormatSchema {
    pub id: Uuid,
    pub selection: A1SelectionSchema,
    pub config: ConditionalFormatConfigSchema,

    /// Whether to apply the format to blank cells.
    /// If None, uses the default based on the rule type.
    #[serde(skip_serializing_if = "Option::is_none", default)]
    pub apply_to_blank: Option<bool>,
}

/// Schema for all conditional formats in a sheet.
#[derive(Default, Serialize, Deserialize, Debug, Clone, PartialEq)]
pub struct ConditionalFormatsSchema {
    #[serde(skip_serializing_if = "Vec::is_empty", default)]
    pub conditional_formats: Vec<ConditionalFormatSchema>,
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
    #[serde(default)]
    pub font_size: Option<i16>,
}

#[derive(Default, Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct TableFormatsSchema {
    pub formats: FormatSchema,
}

#[derive(Serialize, Deserialize, Default, Debug, Clone, PartialEq)]
pub struct SheetFormattingSchema {
    #[serde(skip_serializing_if = "Vec::is_empty", default)]
    pub align: Contiguous2DSchema<Option<CellAlignSchema>>,

    #[serde(skip_serializing_if = "Vec::is_empty", default)]
    pub vertical_align: Contiguous2DSchema<Option<CellVerticalAlignSchema>>,

    #[serde(skip_serializing_if = "Vec::is_empty", default)]
    pub wrap: Contiguous2DSchema<Option<CellWrapSchema>>,

    #[serde(skip_serializing_if = "Vec::is_empty", default)]
    pub numeric_format: Contiguous2DSchema<Option<NumericFormatSchema>>,

    #[serde(skip_serializing_if = "Vec::is_empty", default)]
    pub numeric_decimals: Contiguous2DSchema<Option<i16>>,

    #[serde(skip_serializing_if = "Vec::is_empty", default)]
    pub numeric_commas: Contiguous2DSchema<Option<bool>>,

    #[serde(skip_serializing_if = "Vec::is_empty", default)]
    pub bold: Contiguous2DSchema<Option<bool>>,

    #[serde(skip_serializing_if = "Vec::is_empty", default)]
    pub italic: Contiguous2DSchema<Option<bool>>,

    #[serde(skip_serializing_if = "Vec::is_empty", default)]
    pub text_color: Contiguous2DSchema<Option<String>>,

    #[serde(skip_serializing_if = "Vec::is_empty", default)]
    pub fill_color: Contiguous2DSchema<Option<String>>,

    #[serde(skip_serializing_if = "Vec::is_empty", default)]
    pub date_time: Contiguous2DSchema<Option<String>>,

    #[serde(skip_serializing_if = "Vec::is_empty", default)]
    pub underline: Contiguous2DSchema<Option<bool>>,

    #[serde(skip_serializing_if = "Vec::is_empty", default)]
    pub strike_through: Contiguous2DSchema<Option<bool>>,

    #[serde(skip_serializing_if = "Vec::is_empty", default)]
    pub font_size: Contiguous2DSchema<Option<i16>>,
}

impl SheetFormattingSchema {
    pub fn is_empty(&self) -> bool {
        self.align.is_empty()
            && self.vertical_align.is_empty()
            && self.wrap.is_empty()
            && self.numeric_format.is_empty()
            && self.numeric_decimals.is_empty()
            && self.numeric_commas.is_empty()
            && self.bold.is_empty()
            && self.italic.is_empty()
            && self.text_color.is_empty()
            && self.fill_color.is_empty()
            && self.date_time.is_empty()
            && self.underline.is_empty()
            && self.strike_through.is_empty()
            && self.font_size.is_empty()
    }
}

/// A span of text with optional inline formatting overrides.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct TextSpanSchema {
    pub text: String,

    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub link: Option<String>,

    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub bold: Option<bool>,

    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub italic: Option<bool>,

    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub underline: Option<bool>,

    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub strike_through: Option<bool>,

    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub text_color: Option<String>,

    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub font_size: Option<i16>,
}

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

#[derive(Default, Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct MergeCellsSchema {
    pub merge_cells: Contiguous2DSchema<Option<PosSchema>>,
}
