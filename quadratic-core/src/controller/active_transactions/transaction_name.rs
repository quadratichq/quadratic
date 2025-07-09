use serde::Serialize;

#[derive(Debug, Serialize, Clone, PartialEq)]
#[cfg_attr(feature = "js", derive(ts_rs::TS))]
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
