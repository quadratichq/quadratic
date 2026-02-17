use std::fs::create_dir_all;

use quadratic_core::a1::A1Error;
use quadratic_core::a1::A1Selection;
use quadratic_core::a1::CellRefCoord;
use quadratic_core::a1::CellRefRange;
use quadratic_core::a1::CellRefRangeEnd;
use quadratic_core::a1::JsTableInfo;
use quadratic_core::a1::RefRangeBounds;
use quadratic_core::a1::TableRef;
use quadratic_core::cellvalue::TextSpan;
use quadratic_core::color::Rgba;
use quadratic_core::controller::active_transactions::transaction_name::TransactionName;
use quadratic_core::controller::execution::TransactionSource;
use quadratic_core::controller::execution::run_code::get_cells::JsCellsA1Error;
use quadratic_core::controller::execution::run_code::get_cells::JsCellsA1Response;
use quadratic_core::controller::execution::run_code::get_cells::JsCellsA1Value;
use quadratic_core::controller::execution::run_code::get_cells::JsCellsA1Values;
use quadratic_core::controller::operations::clipboard::PasteSpecial;
use quadratic_core::controller::operations::tracked_operation::TrackedOperation;
use quadratic_core::controller::tracked_transaction::TrackedTransaction;
use quadratic_core::controller::transaction_types::JsCellValueResult;
use quadratic_core::controller::transaction_types::JsCodeResult;
use quadratic_core::formulas::parse_formula::JsFormulaParseResult;
use quadratic_core::grid::JsCellsAccessed;
use quadratic_core::grid::formats::Format;
use quadratic_core::grid::formats::FormatUpdate;
use quadratic_core::grid::js_types::JsAITransactions;
use quadratic_core::grid::js_types::JsCellValueCode;
use quadratic_core::grid::js_types::JsCellValueKind;
use quadratic_core::grid::js_types::JsCellValueRanges;
use quadratic_core::grid::js_types::JsCellValueSummary;
use quadratic_core::grid::js_types::JsChartContext;
use quadratic_core::grid::js_types::JsCodeErrorContext;
use quadratic_core::grid::js_types::JsCodeTableContext;
use quadratic_core::grid::js_types::JsColumnWidth;
use quadratic_core::grid::js_types::JsCoordinate;
use quadratic_core::grid::js_types::JsDataTableContext;
use quadratic_core::grid::js_types::JsGetAICellResult;
use quadratic_core::grid::js_types::JsHashRenderCells;
use quadratic_core::grid::js_types::JsHashRenderFills;
use quadratic_core::grid::js_types::JsHashValidationWarnings;
use quadratic_core::grid::js_types::JsHashesDirty;
use quadratic_core::grid::js_types::JsResponse;
use quadratic_core::grid::js_types::JsSheetNameToColor;
use quadratic_core::grid::js_types::JsSheetPosText;
use quadratic_core::grid::js_types::JsSummaryContext;
use quadratic_core::grid::js_types::JsUpdateCodeCell;
use quadratic_core::grid::js_types::{
    CellFormatSummary, JsCellValue, JsCellValuePos, JsClipboard, JsCodeCell,
    JsDataTableColumnHeader, JsHtmlOutput, JsNumber, JsOffset, JsRenderCell, JsRenderCellLinkSpan,
    JsRenderCellSpecial, JsRenderCodeCell, JsRenderCodeCellState, JsRenderFill, JsReturnInfo,
    JsRowHeight, JsSheetFill, JsSnackbarSeverity, JsSummarizeSelectionResult, JsValidationWarning,
};
use quadratic_core::grid::sheet::borders::BorderSelection;
use quadratic_core::grid::sheet::borders::BorderSide;
use quadratic_core::grid::sheet::borders::BorderStyle;
use quadratic_core::grid::sheet::borders::BorderStyleCell;
use quadratic_core::grid::sheet::borders::BorderStyleTimestamp;
use quadratic_core::grid::sheet::borders::CellBorderLine;
use quadratic_core::grid::sheet::borders::JsBorderHorizontal;
use quadratic_core::grid::sheet::borders::JsBorderVertical;
use quadratic_core::grid::sheet::borders::JsBordersSheet;
use quadratic_core::grid::sheet::conditional_format::{
    ColorScale, ColorScaleThreshold, ColorScaleThresholdValueType, ConditionalFormat,
    ConditionalFormatClient, ConditionalFormatConfig, ConditionalFormatConfigClient,
    ConditionalFormatConfigUpdate, ConditionalFormatRule, ConditionalFormatStyle,
    ConditionalFormatUpdate, ConditionalFormatValue,
};
use quadratic_core::grid::sheet::search::SearchOptions;
use quadratic_core::grid::sheet::validations::rules::ValidationRule;
use quadratic_core::grid::sheet::validations::rules::validation_date_time::{
    DateTimeRange, ValidationDateTime,
};
use quadratic_core::grid::sheet::validations::rules::validation_list::{
    ValidationList, ValidationListSource,
};
use quadratic_core::grid::sheet::validations::rules::validation_logical::ValidationLogical;
use quadratic_core::grid::sheet::validations::rules::validation_number::{
    NumberRange, ValidationNumber,
};
use quadratic_core::grid::sheet::validations::rules::validation_text::{
    TextCase, TextMatch, ValidationText,
};
use quadratic_core::grid::sheet::validations::validation::ValidationUpdate;
use quadratic_core::grid::sheet::validations::validation::{
    Validation, ValidationError, ValidationMessage, ValidationStyle,
};
use quadratic_core::grid::sort::DataTableSort;
use quadratic_core::grid::sort::SortDirection;
use quadratic_core::grid::{
    CellAlign, CellVerticalAlign, CellWrap, GridBounds, NumericFormat, NumericFormatKind, SheetId,
};
use quadratic_core::grid::{CodeCellLanguage, ConnectionKind};
use quadratic_core::sheet_offsets::resize_transient::TransientResize;
use quadratic_core::sheet_offsets::sheet_offsets_wasm::ColumnRow;
use quadratic_core::small_timestamp::SmallTimestamp;
use quadratic_core::wasm_bindings::controller::sheet_info::{SheetBounds, SheetInfo};
use quadratic_core::{
    ArraySize, Axis, Pos, Rect, RunError, RunErrorMsg, SheetPos, SheetRect, Span,
};
use ts_rs::TS;

macro_rules! generate_type_declarations {
    ($($type:ty),+ $(,)?) => {
        String::new() $(+ "export " + &<$type>::decl() + "\n")+
    };
}

fn main() {
    // TODO: autogenerate this file by parsing the whole project using `syn` and
    // searching for types annotated with `#[derive(TS)]`. This still won't work
    // for types generated by `macro_rules!` macros, so we'll have to handle
    // those some other way.
    let mut s = format!("// This file is automatically generated by {}\n", file!());
    s += "// Do not modify it manually.\n\n";

    s += &generate_type_declarations!(
        A1Error,
        A1Selection,
        ArraySize,
        Axis,
        BorderSelection,
        BorderSide,
        BorderStyle,
        BorderStyleCell,
        BorderStyleTimestamp,
        CellAlign,
        CellBorderLine,
        CellFormatSummary,
        CellRefCoord,
        CellRefRange,
        CellRefRangeEnd,
        CellVerticalAlign,
        CellWrap,
        CodeCellLanguage,
        ColorScale,
        ColorScaleThreshold,
        ColorScaleThresholdValueType,
        ConditionalFormat,
        ConditionalFormatClient,
        ConditionalFormatConfig,
        ConditionalFormatConfigClient,
        ConditionalFormatConfigUpdate,
        ConditionalFormatRule,
        ConditionalFormatStyle,
        ConditionalFormatUpdate,
        ConditionalFormatValue,
        ColumnRow,
        ConnectionKind,
        DataTableSort,
        DateTimeRange,
        Format,
        FormatUpdate,
        GridBounds,
        JsAITransactions,
        JsBorderHorizontal,
        JsBorderVertical,
        JsBordersSheet,
        JsCellsAccessed,
        JsCellsA1Error,
        JsCellsA1Response,
        JsCellsA1Value,
        JsCellsA1Values,
        JsCellValue,
        JsCellValueCode,
        JsCellValueSummary,
        JsCellValueKind,
        JsCellValuePos,
        JsCellValueRanges,
        JsCellValueResult,
        JsChartContext,
        JsClipboard,
        JsCodeCell,
        JsCodeResult,
        JsCodeErrorContext,
        JsCodeTableContext,
        JsColumnWidth,
        JsCoordinate,
        JsDataTableColumnHeader,
        JsDataTableContext,
        JsFormulaParseResult,
        JsGetAICellResult,
        JsHashesDirty,
        JsHashRenderCells,
        JsHashRenderFills,
        JsHashValidationWarnings,
        JsHtmlOutput,
        JsNumber,
        JsOffset,
        JsRenderCell,
        JsRenderCellLinkSpan,
        JsRenderCellSpecial,
        JsRenderCodeCell,
        JsRenderCodeCellState,
        JsRenderFill,
        JsResponse,
        JsReturnInfo,
        JsRowHeight,
        JsSheetFill,
        JsSheetNameToColor,
        JsSheetPosText,
        JsSnackbarSeverity,
        JsSummarizeSelectionResult,
        JsSummaryContext,
        JsTableInfo,
        JsUpdateCodeCell,
        JsValidationWarning,
        NumberRange,
        NumericFormat,
        NumericFormatKind,
        PasteSpecial,
        Pos,
        Rect,
        RefRangeBounds,
        Rgba,
        RunError,
        RunErrorMsg,
        SearchOptions,
        SheetBounds,
        SheetId,
        SheetInfo,
        SheetPos,
        SheetRect,
        SmallTimestamp,
        SortDirection,
        Span,
        TableRef,
        TextCase,
        TextMatch,
        TextSpan,
        TrackedOperation,
        TrackedTransaction,
        TransactionName,
        TransactionSource,
        TransientResize,
        Validation,
        ValidationDateTime,
        ValidationError,
        ValidationList,
        ValidationListSource,
        ValidationLogical,
        ValidationMessage,
        ValidationNumber,
        ValidationRule,
        ValidationStyle,
        ValidationText,
        ValidationUpdate,
    );

    if create_dir_all("../quadratic-client/src/app/quadratic-core-types").is_ok() {
        std::fs::write(
            "../quadratic-client/src/app/quadratic-core-types/index.d.ts",
            s,
        )
        .expect("failed to write types file");
        println!("Types exported successfully");
    }
}
