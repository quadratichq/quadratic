use serde::Serialize;
use ts_rs::TS;

#[derive(Debug, Serialize, Clone, Copy, PartialEq, TS)]
pub enum TransactionName {
    Unknown,
    ResizeColumn,
    ResizeRow,
    ResizeRows,
    ResizeColumns,
    Autocomplete,
    SetBorders,
    SetCells,
    SetFormats,
    SetMergeCells,
    SetDataTableAt,
    CutClipboard,
    PasteClipboard,
    FormatPainter,

    SetCode,
    RunCode,
    FlattenDataTable,
    SwitchDataTableKind,
    GridToDataTable,
    DataTableMeta,
    DataTableMutations,
    DataTableFirstRowAsHeader,
    DataTableAddDataTable,
    Import,

    SetSheetMetadata,
    SheetAdd,
    SheetDelete,
    DuplicateSheet,
    ReplaceSheet,
    MoveCells,
    Validation,
    ConditionalFormat,
    ManipulateColumnRow,
}
