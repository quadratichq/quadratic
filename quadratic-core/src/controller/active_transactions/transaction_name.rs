use serde::Serialize;
use ts_rs::TS;

#[derive(Debug, Serialize, Clone, PartialEq, TS)]
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
    MoveCells,
    Validation,
    ManipulateColumnRow,
}
