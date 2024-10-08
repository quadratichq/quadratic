use serde::Serialize;

#[derive(Debug, Serialize, ts_rs::TS, Clone, PartialEq)]
pub enum TransactionName {
    Unknown,
    ResizeColumn,
    ResizeRow,
    ResizeRows,
    Autocomplete,
    SetBorders,
    SetCells,
    SetFormats,
    SetDataTableAt,
    CutClipboard,
    PasteClipboard,
    SetCode,
    RunCode,
    FlattenDataTable,
    GridToDataTable,
    Import,
    SetSheetMetadata,
    SheetAdd,
    SheetDelete,
    DuplicateSheet,
    MoveCells,
    Validation,
    ManipulateColumnRow,
}
